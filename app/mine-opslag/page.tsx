'use client';

import { useState, useEffect, useRef } from 'react';
import { useRouter } from 'next/navigation';
import { supabase } from '../../lib/supabaseClient';
import SiteHeader from '../../components/SiteHeader';
import SiteFooter from '../../components/SiteFooter';

// --- TYPER ---
type Post = {
  id: string;
  user_id: string;
  overskrift: string | null;
  omraade: string | null;
  text: string | null;
  kategori: string | null;
  image_url: string | null;
  images?: string[] | null; // Nogle gange gemt som array
  created_at: string;
  expires_at?: string | null;
};

// --- HJÆLPERE ---
const MS_DAY = 24 * 60 * 60 * 1000;
const EXPIRES_DAYS = 14;

// Beregn udløbsstatus (som i appen)
const getExpiry = (p: Post) => {
  const createdMs = p.created_at ? new Date(p.created_at).getTime() : NaN;
  const expiresMsExplicit = p.expires_at ? new Date(p.expires_at).getTime() : NaN;

  // Brug explicit udløb eller fallback (14 dage fra oprettelse)
  const expiresAt = !isNaN(expiresMsExplicit) ? expiresMsExplicit : (!isNaN(createdMs) ? createdMs + EXPIRES_DAYS * MS_DAY : NaN);
  
  if (isNaN(expiresAt)) return { label: "", state: "ok" };

  const diff = expiresAt - Date.now();
  if (diff <= 0) return { label: "Udløbet", state: "overdue" };

  const days = Math.floor(diff / MS_DAY);
  const hours = Math.floor((diff % MS_DAY) / (60 * 60 * 1000));

  const label = days > 0 ? `Udløber om ${days}d ${hours}t` : `Udløber om ${hours}t`;
  const state = diff < 2 * MS_DAY ? "soon" : "ok"; // Rød hvis under 2 dage
  return { label, state };
};

// Billed-helper (hvis gemt som array eller string)
const getPrimaryImage = (p: Post) => {
  if (p.image_url) return p.image_url;
  if (p.images && p.images.length > 0) return p.images[0];
  return null;
};

// Billed-komprimering
async function resizeImage(file: File, maxWidth = 1200, quality = 0.8): Promise<Blob> {
  return new Promise((resolve, reject) => {
    const img = document.createElement('img');
    const objectUrl = URL.createObjectURL(file);
    img.src = objectUrl;
    img.onload = () => {
      URL.revokeObjectURL(objectUrl);
      const elem = document.createElement('canvas');
      const scaleFactor = Math.min(1, maxWidth / img.width);
      elem.width = img.width * scaleFactor;
      elem.height = img.height * scaleFactor;
      const ctx = elem.getContext('2d');
      if (!ctx) { reject(new Error('Canvas error')); return; }
      ctx.drawImage(img, 0, 0, elem.width, elem.height);
      ctx.canvas.toBlob((blob) => blob ? resolve(blob) : reject(new Error('Blob error')), 'image/jpeg', quality);
    };
    img.onerror = (e) => { URL.revokeObjectURL(objectUrl); reject(e); };
  });
}

// --- MODAL: OPRET/REDIGER OPSLAG ---
function PostModal({ isOpen, onClose, userId, initialData, onSaved }: { isOpen: boolean, onClose: () => void, userId: string, initialData: Post | null, onSaved: () => void }) {
  const [overskrift, setOverskrift] = useState("");
  const [omraade, setOmraade] = useState("");
  const [text, setText] = useState("");
  const [kategori, setKategori] = useState("Værktøj"); // Default
  const [imageFile, setImageFile] = useState<File | null>(null);
  const [loading, setLoading] = useState(false);

  // Udfyld felter hvis vi redigerer
  useEffect(() => {
    if (initialData) {
      setOverskrift(initialData.overskrift || "");
      setOmraade(initialData.omraade || "");
      setText(initialData.text || "");
      setKategori(initialData.kategori || "Værktøj");
    } else {
      setOverskrift(""); setOmraade(""); setText(""); setKategori("Værktøj"); setImageFile(null);
    }
  }, [initialData, isOpen]);

  if (!isOpen) return null;

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);
    try {
      let imageUrl = initialData?.image_url || null;

      // Upload nyt billede
      if (imageFile) {
        const compressed = await resizeImage(imageFile);
        const path = `posts/${userId}/${Date.now()}.jpg`;
        const { error: upErr } = await supabase.storage.from("post-images").upload(path, compressed, { upsert: true });
        if (upErr) throw upErr;
        const { data: urlData } = supabase.storage.from("post-images").getPublicUrl(path);
        imageUrl = urlData.publicUrl;
      }

      const payload = {
        user_id: userId,
        overskrift,
        omraade,
        text,
        kategori,
        image_url: imageUrl,
        // Hvis nyt opslag, sæt expires_at
        ...(initialData ? {} : { expires_at: new Date(Date.now() + 14 * MS_DAY).toISOString() })
      };

      if (initialData) {
        const { error } = await supabase.from("posts").update(payload).eq("id", initialData.id);
        if (error) throw error;
      } else {
        const { error } = await supabase.from("posts").insert([payload]);
        if (error) throw error;
      }

      onSaved();
      onClose();
    } catch (err: any) {
      alert("Fejl: " + err.message);
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="fixed inset-0 z-[200] flex items-center justify-center p-4 bg-black/60 backdrop-blur-sm">
      <div className="bg-white w-full max-w-lg rounded-2xl shadow-2xl overflow-hidden flex flex-col max-h-[90vh]">
        <div className="bg-[#131921] px-5 py-4 flex justify-between items-center shrink-0">
          <h2 className="text-white font-bold uppercase tracking-wider">{initialData ? "Rediger Opslag" : "Nyt Opslag"}</h2>
          <button onClick={onClose} className="text-white/70 hover:text-white text-2xl leading-none">&times;</button>
        </div>
        <div className="overflow-y-auto p-5">
          <form onSubmit={handleSubmit} className="space-y-4">
            <input required placeholder="Overskrift (Hvad vil du låne/udleje?)" className="w-full p-3 bg-gray-50 rounded-xl border border-gray-200 outline-none focus:border-[#131921] text-[#131921]" value={overskrift} onChange={e => setOverskrift(e.target.value)} />
            <input required placeholder="Område (f.eks. Vejnavn)" className="w-full p-3 bg-gray-50 rounded-xl border border-gray-200 outline-none focus:border-[#131921] text-[#131921]" value={omraade} onChange={e => setOmraade(e.target.value)} />
            
            <select className="w-full p-3 bg-gray-50 rounded-xl border border-gray-200 outline-none text-[#131921]" value={kategori} onChange={e => setKategori(e.target.value)}>
              <option value="Værktøj">Værktøj</option>
              <option value="Have">Have</option>
              <option value="Elektronik">Elektronik</option>
              <option value="Fest">Fest</option>
              <option value="Andet">Andet</option>
            </select>

            <textarea required placeholder="Beskrivelse..." className="w-full p-3 bg-gray-50 rounded-xl border border-gray-200 h-28 resize-none outline-none focus:border-[#131921] text-[#131921]" value={text} onChange={e => setText(e.target.value)} />

            <div className="p-3 bg-gray-50 rounded-xl border border-dashed border-gray-300 text-center cursor-pointer relative hover:bg-gray-100">
              <input type="file" accept="image/*" onChange={e => setImageFile(e.target.files?.[0] || null)} className="absolute inset-0 opacity-0 cursor-pointer" />
              <span className="text-sm font-bold text-gray-500">
                {imageFile ? `Valgt: ${imageFile.name}` : initialData?.image_url ? "Skift billede (valgfrit)" : "+ Vælg billede"}
              </span>
            </div>

            <button type="submit" disabled={loading} className="w-full py-4 bg-[#131921] text-white rounded-xl font-bold hover:bg-gray-900 mt-2">
              {loading ? "Gemmer..." : initialData ? "Gem Ændringer" : "Opret Opslag"}
            </button>
          </form>
        </div>
      </div>
    </div>
  );
}

// --- MAIN PAGE ---
export default function MineOpslagPage() {
  const router = useRouter();
  const [userId, setUserId] = useState<string | null>(null);
  const [posts, setPosts] = useState<Post[]>([]);
  const [loading, setLoading] = useState(true);
  
  // Modal state
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [editPost, setEditPost] = useState<Post | null>(null);

  useEffect(() => {
    const init = async () => {
      const { data: { session } } = await supabase.auth.getSession();
      if (!session) {
        router.push('/login');
        return;
      }
      setUserId(session.user.id);
      fetchPosts(session.user.id);
    };
    init();
  }, [router]);

  const fetchPosts = async (uid: string) => {
    setLoading(true);
    const { data } = await supabase
      .from("posts")
      .select("*")
      .eq("user_id", uid)
      .order("created_at", { ascending: false });
    
    if (data) setPosts(data);
    setLoading(false);
  };

  const handleDelete = async (postId: string) => {
    if (!confirm("Er du sikker på, at du vil slette dette opslag?")) return;
    const { error } = await supabase.from("posts").delete().eq("id", postId);
    if (!error) {
      setPosts(prev => prev.filter(p => p.id !== postId));
    } else {
      alert("Kunne ikke slette: " + error.message);
    }
  };

  const handleExtend = async (post: Post) => {
    try {
      const currentExpiry = post.expires_at ? new Date(post.expires_at).getTime() : NaN;
      const now = Date.now();
      // Forlæng fra nuværende udløb (hvis i fremtiden) eller fra nu
      const base = !isNaN(currentExpiry) && currentExpiry > now ? currentExpiry : now;
      const newExpiry = new Date(base + 7 * MS_DAY).toISOString();

      const { error } = await supabase.from("posts").update({ expires_at: newExpiry }).eq("id", post.id);
      if (error) throw error;

      alert("Opslaget er forlænget med 1 uge!");
      if (userId) fetchPosts(userId);
    } catch (err: any) {
      alert("Fejl: " + err.message);
    }
  };

  const openCreate = () => {
    setEditPost(null);
    setIsModalOpen(true);
  };

  const openEdit = (p: Post) => {
    setEditPost(p);
    setIsModalOpen(true);
  };

  return (
    <div className="min-h-screen flex flex-col bg-[#869FB9]">
      <SiteHeader />

      <main className="flex-1 w-full max-w-6xl mx-auto p-4 pb-20">
        
        {/* Sticky Header Action */}
        <div className="sticky top-20 z-10 mb-6 flex justify-center">
          <button 
            onClick={openCreate}
            className="bg-[#131921] text-white px-8 py-3 rounded-full font-bold shadow-lg hover:bg-gray-900 transition-transform active:scale-95 tracking-wide text-sm"
          >
            OPRET NYT OPSLAG
          </button>
        </div>

        {loading ? (
          <div className="flex justify-center mt-20"><div className="animate-spin rounded-full h-12 w-12 border-b-2 border-[#131921]"></div></div>
        ) : posts.length === 0 ? (
          <div className="text-center text-white mt-20 opacity-80">
            <p className="text-lg">Du har ingen opslag endnu.</p>
          </div>
        ) : (
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
            {posts.map(post => {
              const img = getPrimaryImage(post);
              const expiry = getExpiry(post);

              return (
                <div key={post.id} className="bg-white rounded-[24px] overflow-hidden shadow-md flex flex-col h-full hover:shadow-xl transition-shadow">
                  {/* Billede */}
                  <div className="w-full aspect-square bg-[#E7EBF0] relative flex items-center justify-center overflow-hidden">
                    {img ? (
                      <img src={img} alt="" className="w-full h-full object-cover" />
                    ) : (
                      <span className="text-[#536071] font-bold text-sm">Ingen billede</span>
                    )}
                  </div>

                  {/* Indhold */}
                  <div className="p-4 flex-1 flex flex-col">
                    {/* Tags */}
                    <div className="flex gap-2 mb-3">
                      {post.kategori && (
                        <span className="bg-[#EBF2FA] text-[#131921] text-[10px] font-extrabold px-3 py-1 rounded-full uppercase tracking-wide">
                          {post.kategori}
                        </span>
                      )}
                      {expiry.label && (
                        <span className={`text-[10px] font-extrabold px-3 py-1 rounded-full uppercase tracking-wide border ${
                          expiry.state === 'overdue' ? 'bg-red-50 text-red-600 border-red-200' : 
                          expiry.state === 'soon' ? 'bg-orange-50 text-orange-600 border-orange-200' : 
                          'bg-[#EBF2FA] text-[#131921] border-transparent'
                        }`}>
                          {expiry.label}
                        </span>
                      )}
                    </div>

                    <h3 className="font-bold text-lg text-[#131921] underline decoration-gray-300 mb-1 truncate">{post.overskrift}</h3>
                    <p className="text-sm font-semibold text-[#222] mb-2 truncate">{post.omraade}</p>
                    <p className="text-sm text-[#444] line-clamp-2 mb-4 flex-1">{post.text}</p>

                    {/* Knapper */}
                    <div className="flex gap-2 pt-2 border-t border-gray-100">
                      <button 
                        onClick={() => handleExtend(post)}
                        className={`flex-1 py-2 rounded-full text-[10px] font-bold text-white uppercase tracking-wider ${expiry.state === 'overdue' ? 'bg-orange-500 hover:bg-orange-600' : 'bg-[#131921] hover:bg-gray-800'}`}
                      >
                        {expiry.state === 'overdue' ? 'Aktivér igen' : 'Forlæng'}
                      </button>
                      
                      <button onClick={() => openEdit(post)} className="px-4 py-2 bg-[#131921] text-white rounded-full text-[10px] font-bold uppercase hover:bg-gray-800">
                        Ret
                      </button>
                      
                      <button onClick={() => handleDelete(post.id)} className="px-4 py-2 bg-red-500 text-white rounded-full text-[10px] font-bold uppercase hover:bg-red-600">
                        Slet
                      </button>
                    </div>
                  </div>
                </div>
              );
            })}
          </div>
        )}
      </main>

      <SiteFooter />

      {userId && (
        <PostModal 
          isOpen={isModalOpen}
          onClose={() => setIsModalOpen(false)}
          userId={userId}
          initialData={editPost}
          onSaved={() => fetchPosts(userId)}
        />
      )}
    </div>
  );
}