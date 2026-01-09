'use client';

import { useState, useEffect } from 'react';
import { useRouter } from 'next/navigation';
import { supabase } from '../../lib/supabaseClient';
import SiteHeader from '../../components/SiteHeader';
import SiteFooter from '../../components/SiteFooter';
// Importer din nye modal
import CreatePostModal from '../../components/CreatePostModal';

// --- TYPER ---
type Post = {
  id: string;
  user_id: string;
  overskrift: string | null;
  omraade: string | null;
  text: string | null;
  kategori: string | null;
  image_url: string | null;
  images?: string[] | null;
  created_at: string;
  expires_at?: string | null;
  is_public?: boolean; // ✅ NYT FELT
};

// --- HJÆLPERE ---
const MS_DAY = 24 * 60 * 60 * 1000;
const EXPIRES_DAYS = 14;

const getExpiry = (p: Post) => {
  const createdMs = p.created_at ? new Date(p.created_at).getTime() : NaN;
  const expiresMsExplicit = p.expires_at ? new Date(p.expires_at).getTime() : NaN;
  const expiresAt = !isNaN(expiresMsExplicit) ? expiresMsExplicit : (!isNaN(createdMs) ? createdMs + EXPIRES_DAYS * MS_DAY : NaN);
  
  if (isNaN(expiresAt)) return { label: "", state: "ok" };

  const diff = expiresAt - Date.now();
  if (diff <= 0) return { label: "Udløbet", state: "overdue" };

  const days = Math.floor(diff / MS_DAY);
  const hours = Math.floor((diff % MS_DAY) / (60 * 60 * 1000));

  const label = days > 0 ? `Udløber om ${days}d ${hours}t` : `Udløber om ${hours}t`;
  const state = diff < 2 * MS_DAY ? "soon" : "ok";
  return { label, state };
};

const getPrimaryImage = (p: Post) => {
  if (p.image_url) return p.image_url;
  if (p.images && p.images.length > 0) return p.images[0];
  return null;
};

// --- REDIGER MODAL (Nu med is_public checkbox) ---
function EditPostModal({ isOpen, onClose, post, onSaved }: { isOpen: boolean, onClose: () => void, post: Post | null, onSaved: () => void }) {
  const [text, setText] = useState("");
  const [isPublic, setIsPublic] = useState(false);
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    if (post) {
      setText(post.text || "");
      setIsPublic(post.is_public || false);
    }
  }, [post]);

  if (!isOpen || !post) return null;

  const handleUpdate = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);
    const { error } = await supabase
      .from("posts")
      .update({ 
        text: text,
        is_public: isPublic 
      })
      .eq("id", post.id);
      
    setLoading(false);
    if (!error) {
      onSaved();
      onClose();
    } else {
      alert("Fejl: " + error.message);
    }
  };

  return (
    <div className="fixed inset-0 z-[200] flex items-center justify-center p-4 bg-black/60 backdrop-blur-sm animate-in fade-in duration-200">
      <div className="bg-white w-full max-w-md rounded-2xl shadow-2xl overflow-hidden flex flex-col">
        <div className="bg-[#131921] px-6 py-4 flex justify-between items-center">
          <h2 className="text-white text-lg font-bold uppercase tracking-wider">Rediger Opslag</h2>
          <button onClick={onClose} className="text-gray-400 hover:text-white transition-colors">
            <i className="fa-solid fa-xmark text-xl"></i>
          </button>
        </div>
        
        <form onSubmit={handleUpdate} className="p-6 space-y-4">
          <div>
            <label className="block text-xs font-bold text-gray-500 uppercase mb-1">Beskrivelse</label>
            <textarea 
              className="w-full bg-white border border-gray-300 rounded-xl px-4 py-3 h-32 outline-none focus:ring-2 focus:ring-[#131921] resize-none" 
              value={text} 
              onChange={e => setText(e.target.value)} 
            />
          </div>

          {/* ✅ CHECKBOX: GØR OFFENTLIG */}
          <div className="flex items-center gap-3 bg-gray-50 p-3 rounded-xl border border-gray-100">
            <input 
              type="checkbox" 
              id="publicCheckEdit"
              checked={isPublic} 
              onChange={(e) => setIsPublic(e.target.checked)}
              className="w-5 h-5 accent-[#131921] cursor-pointer"
            />
            <div>
              <label htmlFor="publicCheckEdit" className="text-sm font-bold text-[#131921] cursor-pointer select-none">
                Gør opslaget offentligt
              </label>
              <p className="text-[10px] text-gray-500">
                Hvis markeret, kan opslaget ses af alle på forsiden.
              </p>
            </div>
          </div>

          <div className="flex gap-3 pt-2">
            <button type="button" onClick={onClose} className="flex-1 py-3 rounded-xl font-bold text-gray-700 bg-gray-100 hover:bg-gray-200 transition-colors">Annuller</button>
            <button type="submit" disabled={loading} className="flex-[2] py-3 rounded-xl font-bold text-white bg-[#131921] hover:bg-gray-900 transition-colors">Gem Ændringer</button>
          </div>
        </form>
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
  
  // Modal states
  const [isCreateOpen, setIsCreateOpen] = useState(false);
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

  return (
    <div className="min-h-screen flex flex-col bg-[#869FB9]">
      <SiteHeader />

      <div className="bg-[#869FB9] py-6 px-4 shadow-sm relative z-10">
        <div className="max-w-6xl mx-auto space-y-4">
          <button 
            className="w-full bg-[#131921] text-white font-bold text-lg py-4 rounded-2xl shadow-lg hover:bg-gray-900 transition-all uppercase tracking-wider flex items-center justify-center gap-2 transform hover:scale-[1.01]"
            onClick={() => setIsCreateOpen(true)}
          >
            <i className="fa-solid fa-plus-circle text-2xl"></i> Opret nyt opslag
          </button>
        </div>
      </div>

      <main className="flex-1 w-full max-w-6xl mx-auto px-4 py-8">
        
        {loading ? (
          <div className="flex justify-center mt-20"><div className="animate-spin rounded-full h-12 w-12 border-b-2 border-[#131921]"></div></div>
        ) : posts.length === 0 ? (
          <div className="text-center text-white mt-20 opacity-80">
            <p className="text-lg font-medium">Du har ingen opslag endnu.</p>
            <p className="text-sm mt-2 opacity-70">Opret dit første opslag ovenfor!</p>
          </div>
        ) : (
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
            {posts.map(post => {
              const img = getPrimaryImage(post);
              const expiry = getExpiry(post);

              return (
                <div key={post.id} className="bg-white rounded-[24px] overflow-hidden shadow-md flex flex-col h-full hover:shadow-xl transition-shadow relative">
                  
                  {/* Billede */}
                  <div className="w-full aspect-square bg-[#E7EBF0] relative flex items-center justify-center overflow-hidden">
                    {img ? (
                      <img src={img} alt="" className="w-full h-full object-cover" />
                    ) : (
                      <span className="text-[#536071] font-bold text-sm">Ingen billede</span>
                    )}
                    
                    {/* ✅ PUBLIC BADGE */}
                    {post.is_public && (
                      <div className="absolute top-3 right-3 bg-green-500 text-white text-[10px] font-black px-2 py-1 rounded-full shadow-sm uppercase tracking-wider">
                        Offentlig
                      </div>
                    )}
                  </div>

                  {/* Indhold */}
                  <div className="p-4 flex-1 flex flex-col">
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

                    {/* ✅ KNAPPER (Stylet som forenings-siden) */}
                    <div className="flex flex-wrap gap-2 mt-auto pt-3 border-t border-gray-100">
                      
                      {/* Forlæng Knap */}
                      <button 
                        onClick={() => handleExtend(post)}
                        className={`flex-1 px-4 py-2.5 rounded-xl text-xs font-bold text-white uppercase tracking-wide flex items-center justify-center gap-2 transition-colors ${expiry.state === 'overdue' ? 'bg-orange-500 hover:bg-orange-600' : 'bg-[#131921] hover:bg-gray-800'}`}
                      >
                        <i className="fa-solid fa-clock-rotate-left"></i> {expiry.state === 'overdue' ? 'Aktivér' : 'Forlæng'}
                      </button>
                      
                      {/* Rediger Knap */}
                      <button 
                        onClick={() => setEditPost(post)} 
                        className="px-4 py-2.5 bg-[#e9eef5] hover:bg-gray-200 text-[#0f172a] text-xs font-bold rounded-xl transition-colors uppercase tracking-wide flex items-center justify-center gap-2"
                      >
                        <i className="fa-solid fa-pen-to-square"></i> Ret
                      </button>
                      
                      {/* Slet Knap */}
                      <button 
                        onClick={() => handleDelete(post.id)} 
                        className="px-4 py-2.5 bg-red-50 hover:bg-red-100 text-red-600 text-xs font-bold rounded-xl transition-colors uppercase tracking-wide flex items-center justify-center gap-2"
                      >
                        <i className="fa-solid fa-trash"></i>
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

      {/* OPRET MODAL */}
      <CreatePostModal 
        isOpen={isCreateOpen}
        onClose={() => setIsCreateOpen(false)}
        onPostCreated={() => userId && fetchPosts(userId)}
      />

      {/* REDIGER MODAL */}
      <EditPostModal 
        isOpen={!!editPost}
        onClose={() => setEditPost(null)}
        post={editPost}
        onSaved={() => userId && fetchPosts(userId)}
      />
    </div>
  );
}