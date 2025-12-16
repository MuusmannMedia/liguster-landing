// app/forening/[id]/page.tsx

'use client';

import { useState, useEffect, useRef } from 'react';
import { useParams, useRouter } from 'next/navigation';
import { supabase } from '../../../lib/supabaseClient';
import SiteHeader from '../../../components/SiteHeader';
import SiteFooter from '../../../components/SiteFooter';
import ForeningEvents from '../../../components/ForeningEvents';
import ForeningImages from '../../../components/ForeningImages';
import ForeningThreads from '../../../components/ForeningThreads';

// --- TYPER ---
type Forening = {
  id: string;
  navn: string;
  sted: string;
  beskrivelse: string;
  billede_url?: string;
  oprettet_af?: string;
};

type Medlem = {
  user_id: string;
  rolle?: string | null;
  status?: "pending" | "approved" | "declined" | null;
  users?: {
    name?: string | null;
    username?: string | null;
    avatar_url?: string | null;
    email?: string | null;
  } | null;
};

// --- HJÆLPERE ---
const getDisplayName = (m: Medlem) => {
  const n = m.users?.name?.trim() || m.users?.username?.trim();
  if (n) return n;
  const email = m.users?.email || "";
  return email.includes("@") ? email.split("@")[0] : "Ukendt";
};

const isAdmin = (m: Medlem, ownerId?: string) => {
  const r = (m.rolle || "").toLowerCase();
  return r === "admin" || r === "administrator" || (!!ownerId && m.user_id === ownerId);
};

const StatusBadge = ({ status }: { status?: string | null }) => {
  if (!status) return null;
  let colorClass = "bg-gray-200 text-gray-600";
  if (status === "approved") colorClass = "bg-green-100 text-green-700 border border-green-200";
  if (status === "pending") colorClass = "bg-yellow-100 text-yellow-700 border border-yellow-200";
  if (status === "declined") colorClass = "bg-red-100 text-red-700 border border-red-200";
  
  return (
    <span className={`px-2 py-0.5 rounded-md text-[10px] font-bold uppercase tracking-wide ${colorClass}`}>
      {status}
    </span>
  );
};

// Billed-komprimering til header-upload
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

export default function ForeningDetaljePage() {
  const params = useParams();
  const router = useRouter();
  const id = params.id as string;
  
  const [loading, setLoading] = useState(true);
  const [forening, setForening] = useState<Forening | null>(null);
  const [medlemmer, setMedlemmer] = useState<Medlem[]>([]);
  const [userId, setUserId] = useState<string | null>(null);
  
  // Tabs State
  const [activeTab, setActiveTab] = useState<'oversigt' | 'events' | 'billeder' | 'traade'>('oversigt');

  // Modal State (Medlemsliste)
  const [showMembers, setShowMembers] = useState(false);
  const [selectedMember, setSelectedMember] = useState<Medlem | null>(null);
  
  // Upload State (Header)
  const [uploading, setUploading] = useState(false);
  const fileInputRef = useRef<HTMLInputElement>(null);

  // Initial Fetch
  useEffect(() => {
    const init = async () => {
      const { data: { session } } = await supabase.auth.getSession();
      if (session) setUserId(session.user.id);
      await Promise.all([fetchForening(), fetchMedlemmer()]);
      setLoading(false);
    };
    init();
  }, [id]);

  const fetchForening = async () => {
    const { data, error } = await supabase.from("foreninger").select("*").eq("id", id).single();
    if (!error) setForening(data);
  };

  const fetchMedlemmer = async () => {
    const { data, error } = await supabase
      .from("foreningsmedlemmer")
      .select("user_id, rolle, status, users:users!foreningsmedlemmer_user_id_fkey (name, username, avatar_url, email)")
      .eq("forening_id", id);
      
    if (!error && data) setMedlemmer(data as unknown as Medlem[]);
  };

  // Beregnede værdier
  const approved = medlemmer.filter(m => m.status === "approved");
  const pending = medlemmer.filter(m => m.status === "pending");
  const declined = medlemmer.filter(m => m.status === "declined");
  
  const isMember = approved.some(m => m.user_id === userId);
  const isPending = pending.some(m => m.user_id === userId);
  
  const currentUserMember = medlemmer.find(m => m.user_id === userId);
  const isUserAdmin = currentUserMember && forening && isAdmin(currentUserMember, forening.oprettet_af);

  // --- ACTIONS (Kun for selve foreningen) ---

  const handleJoin = async () => {
    if (!userId) return router.push('/login');
    const { error } = await supabase.from("foreningsmedlemmer").insert([{ forening_id: id, user_id: userId, rolle: "medlem", status: "pending" }]);
    if (error) alert("Fejl: " + error.message);
    else { alert("Anmodning sendt!"); fetchMedlemmer(); }
  };

  const handleLeave = async () => {
    if (!confirm("Er du sikker på, at du vil forlade foreningen?")) return;
    const { error } = await supabase.from("foreningsmedlemmer").delete().eq("forening_id", id).eq("user_id", userId);
    if (error) alert("Fejl: " + error.message);
    else fetchMedlemmer();
  };

  const handleUploadHeader = async (e: React.ChangeEvent<HTMLInputElement>) => {
    if (!e.target.files || !e.target.files[0] || !userId) return;
    const file = e.target.files[0];
    
    try {
      setUploading(true);
      const compressed = await resizeImage(file);
      const path = `${id}_${Date.now()}.jpg`;
      
      const { error: upErr } = await supabase.storage.from("foreningsbilleder").upload(path, compressed, { upsert: true });
      if (upErr) throw upErr;

      const { data: urlData } = supabase.storage.from("foreningsbilleder").getPublicUrl(path);
      const publicUrl = urlData.publicUrl;

      await supabase.from("foreninger").update({ billede_url: publicUrl }).eq("id", id);
      
      setForening(prev => prev ? { ...prev, billede_url: publicUrl } : null);
    } catch (err: any) {
      alert("Fejl ved upload: " + err.message);
    } finally {
      setUploading(false);
    }
  };

  const handleMemberAction = async (uid: string, action: "approved" | "declined") => {
    const { error } = await supabase.from("foreningsmedlemmer").update({ status: action }).eq("forening_id", id).eq("user_id", uid);
    if (!error) fetchMedlemmer();
  };

  if (loading) return (
    <div className="min-h-screen bg-[#869FB9] flex items-center justify-center">
      <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-[#131921]"></div>
    </div>
  );

  if (!forening) return <div className="min-h-screen bg-[#869FB9] p-10 text-center text-white">Forening ikke fundet</div>;

  return (
    <div className="min-h-screen flex flex-col bg-[#869FB9]">
      <SiteHeader />

      <main className="flex-1 w-full max-w-4xl mx-auto p-4 pb-20">
        
        {/* TOP NAVIGATION */}
        <div className="flex justify-between items-center mb-4 pt-4">
          <button onClick={() => router.back()} className="w-10 h-10 rounded-full bg-[#131921] text-white flex items-center justify-center hover:bg-black transition-colors">
            ‹
          </button>
          <button 
            onClick={() => setShowMembers(true)}
            className="flex items-center gap-2 bg-white/20 backdrop-blur-sm px-4 py-2 rounded-full text-[#131921] font-bold hover:bg-white/30 transition-colors"
          >
            <i className="fa-solid fa-users"></i>
            <span>{approved.length}</span>
            {isUserAdmin && pending.length > 0 && (
              <span className="bg-red-500 text-white text-[10px] px-1.5 py-0.5 rounded-full ml-1">{pending.length}</span>
            )}
          </button>
        </div>

        {/* MAIN CARD */}
        <div className="bg-white rounded-[30px] p-5 shadow-lg mb-6">
          {/* Header Image */}
          <div className="relative w-full h-56 md:h-72 rounded-[20px] overflow-hidden bg-gray-100 mb-5 group">
            {forening.billede_url ? (
              <img src={forening.billede_url} alt="Header" className="w-full h-full object-cover" />
            ) : (
              <div className="w-full h-full flex items-center justify-center text-gray-400">Intet billede</div>
            )}
            
            {/* Upload Button (Owner only) */}
            {forening.oprettet_af === userId && (
              <label className="absolute bottom-4 right-4 bg-white/90 text-[#131921] px-4 py-2 rounded-xl text-sm font-bold shadow-md cursor-pointer hover:bg-white transition-all opacity-0 group-hover:opacity-100">
                {uploading ? "..." : <><i className="fa-solid fa-camera mr-2"></i> Skift billede</>}
                <input type="file" className="hidden" accept="image/*" ref={fileInputRef} onChange={handleUploadHeader} />
              </label>
            )}
          </div>

          <h1 className="text-3xl font-black text-[#254890] mb-1">{forening.navn}</h1>
          <p className="text-gray-600 font-bold mb-4 flex items-center gap-1">
            <i className="fa-solid fa-location-dot text-sm"></i> {forening.sted}
          </p>

          {/* TAB MENU */}
          <div className="flex gap-2 border-b border-gray-100 pb-1 mb-6 overflow-x-auto no-scrollbar">
            {[
              { id: 'oversigt', label: 'Oversigt', icon: 'fa-circle-info' },
              { id: 'events', label: 'Kalender', icon: 'fa-calendar-days' },
              { id: 'billeder', label: 'Galleri', icon: 'fa-images' },
              { id: 'traade', label: 'Debat', icon: 'fa-comments' },
            ].map(tab => (
              <button
                key={tab.id}
                onClick={() => setActiveTab(tab.id as any)}
                className={`px-4 py-2 rounded-xl text-sm font-bold flex items-center gap-2 transition-all whitespace-nowrap ${
                  activeTab === tab.id ? 'bg-[#131921] text-white shadow-md' : 'text-gray-500 hover:bg-gray-50'
                }`}
              >
                <i className={`fa-solid ${tab.icon}`}></i> {tab.label}
              </button>
            ))}
          </div>

          {/* --- CONTENT AREA --- */}
          
          {/* OVERSIGT */}
          {activeTab === 'oversigt' && (
            <div className="animate-in fade-in slide-in-from-bottom-2 duration-300">
              <p className="text-[#4d5a6a] leading-relaxed whitespace-pre-wrap mb-6">
                {forening.beskrivelse}
              </p>

              {/* Action Buttons */}
              {isMember ? (
                <button onClick={handleLeave} className="w-full py-3 bg-gray-200 text-gray-600 rounded-xl font-bold hover:bg-gray-300 transition-colors">
                  Afslut medlemskab
                </button>
              ) : isPending ? (
                <button disabled className="w-full py-3 bg-yellow-100 text-yellow-700 border border-yellow-200 rounded-xl font-bold cursor-not-allowed">
                  Anmodning afventer godkendelse
                </button>
              ) : (
                <button onClick={handleJoin} className="w-full py-3 bg-[#131921] text-white rounded-xl font-bold hover:bg-gray-900 transition-colors shadow-md">
                  Bliv medlem
                </button>
              )}
            </div>
          )}

          {/* EVENTS */}
          {activeTab === 'events' && (
            <div className="animate-in fade-in slide-in-from-bottom-2 duration-300 min-h-[200px]">
              <ForeningEvents 
                foreningId={id} 
                userId={userId} 
                isUserAdmin={!!isUserAdmin} 
                isApprovedMember={isMember} 
              />
            </div>
          )}

          {/* BILLEDER */}
          {activeTab === 'billeder' && (
            <div className="animate-in fade-in slide-in-from-bottom-2 duration-300 min-h-[200px]">
              <ForeningImages 
                foreningId={id} 
                userId={userId} 
                isMember={isMember} 
              />
            </div>
          )}

          {/* TRÅDE */}
          {activeTab === 'traade' && (
            <div className="animate-in fade-in slide-in-from-bottom-2 duration-300 min-h-[200px]">
              <ForeningThreads 
                foreningId={id} 
                userId={userId} 
                isUserAdmin={!!isUserAdmin} 
                isMember={isMember} 
              />
            </div>
          )}

        </div>

        {/* MEDLEMMER PREVIEW (Kun på oversigt) */}
        {activeTab === 'oversigt' && (
          <div className="bg-[#748a9f] p-4 rounded-[20px] shadow-inner">
            <h3 className="text-[#183c7a] font-bold mb-3 pl-2">Medlemmer</h3>
            <div className="flex gap-4 overflow-x-auto pb-2 scrollbar-hide px-2">
              {approved.length === 0 && <p className="text-white/60 text-sm">Ingen medlemmer endnu.</p>}
              {approved.map(m => (
                <div key={m.user_id} className="flex flex-col items-center min-w-[60px]" onClick={() => { setSelectedMember(m); setShowMembers(true); }}>
                  <div className="w-12 h-12 rounded-full bg-gray-200 overflow-hidden mb-1 border-2 border-white/20">
                    {m.users?.avatar_url ? (
                      <img src={m.users.avatar_url} alt="" className="w-full h-full object-cover" />
                    ) : (
                      <div className="w-full h-full flex items-center justify-center text-[#254890] font-bold">?</div>
                    )}
                  </div>
                  <span className="text-[10px] font-bold text-[#0b2a5a] truncate w-16 text-center">{getDisplayName(m)}</span>
                </div>
              ))}
            </div>
          </div>
        )}

      </main>
      <SiteFooter />

      {/* MEDLEMS MODAL */}
      {showMembers && (
        <div className="fixed inset-0 z-[200] flex items-center justify-center p-4 bg-black/60 backdrop-blur-sm">
          <div className="bg-white w-full max-w-lg rounded-2xl shadow-2xl overflow-hidden flex flex-col max-h-[85vh]">
            <div className="flex justify-between items-center p-4 border-b border-gray-100">
              <h2 className="text-[#183c7a] font-bold text-lg">
                {selectedMember ? "Medlemsprofil" : "Medlemmer"}
              </h2>
              <button onClick={() => { setShowMembers(false); setSelectedMember(null); }} className="text-gray-400 hover:text-gray-600 text-2xl leading-none">&times;</button>
            </div>

            <div className="overflow-y-auto p-4">
              {selectedMember ? (
                // PROFIL VISNING
                <div className="flex flex-col items-center py-4">
                  <div className="w-32 h-32 rounded-2xl bg-gray-100 overflow-hidden mb-4 shadow-inner">
                    {selectedMember.users?.avatar_url ? (
                      <img src={selectedMember.users.avatar_url} className="w-full h-full object-cover" />
                    ) : (
                       <div className="w-full h-full flex items-center justify-center text-gray-300 text-4xl font-bold">?</div>
                    )}
                  </div>
                  <h3 className="text-xl font-bold text-[#1d2b3a]">{getDisplayName(selectedMember)}</h3>
                  <p className="text-sm text-gray-500 mb-4">{selectedMember.users?.email || "Ingen email"}</p>
                  
                  <div className="flex gap-2 mb-8">
                     <span className="px-3 py-1 bg-gray-100 text-[#254890] rounded-full text-xs font-bold">
                       {isAdmin(selectedMember, forening.oprettet_af) ? "ADMIN" : "MEDLEM"}
                     </span>
                     <StatusBadge status={selectedMember.status} />
                  </div>

                  <button onClick={() => setSelectedMember(null)} className="text-sm text-gray-500 hover:text-[#131921] underline">
                    &larr; Tilbage til liste
                  </button>
                </div>
              ) : (
                // LISTE VISNING
                <div className="space-y-6">
                  {/* PENDING (KUN ADMIN) */}
                  {isUserAdmin && pending.length > 0 && (
                    <div>
                       <h4 className="text-xs font-bold text-gray-500 uppercase mb-2">Afventer godkendelse ({pending.length})</h4>
                       <div className="space-y-2">
                         {pending.map(m => (
                           <div key={m.user_id} className="flex items-center justify-between p-2 bg-yellow-50 rounded-xl border border-yellow-100">
                             <div className="flex items-center gap-3">
                               <div className="w-8 h-8 rounded-full bg-gray-200 overflow-hidden">
                                 {m.users?.avatar_url && <img src={m.users.avatar_url} className="w-full h-full object-cover" />}
                               </div>
                               <div>
                                 <p className="text-sm font-bold text-[#1d2b3a]">{getDisplayName(m)}</p>
                                 <p className="text-[10px] text-gray-500">{m.users?.email}</p>
                               </div>
                             </div>
                             <div className="flex gap-2">
                               <button onClick={() => handleMemberAction(m.user_id, 'approved')} className="text-xs font-bold text-green-600 bg-white px-3 py-1.5 rounded-lg shadow-sm hover:bg-green-50 border border-green-100">Godkend</button>
                               <button onClick={() => handleMemberAction(m.user_id, 'declined')} className="text-xs font-bold text-red-600 bg-white px-3 py-1.5 rounded-lg shadow-sm hover:bg-red-50 border border-red-100">Afvis</button>
                             </div>
                           </div>
                         ))}
                       </div>
                    </div>
                  )}

                  {/* MEMBERS */}
                  <div>
                    <h4 className="text-xs font-bold text-gray-500 uppercase mb-2">Medlemmer ({approved.length})</h4>
                    <div className="space-y-1">
                      {approved.map(m => (
                        <div key={m.user_id} onClick={() => setSelectedMember(m)} className="flex items-center gap-3 p-2 hover:bg-gray-50 rounded-xl cursor-pointer transition-colors group">
                           <div className="w-10 h-10 rounded-full bg-gray-200 overflow-hidden border border-gray-100">
                             {m.users?.avatar_url ? <img src={m.users.avatar_url} className="w-full h-full object-cover" /> : <div className="flex items-center justify-center h-full text-xs font-bold text-gray-400">?</div>}
                           </div>
                           <div className="flex-1">
                             <div className="flex items-center gap-2">
                               <p className="text-sm font-bold text-[#1d2b3a]">{getDisplayName(m)}</p>
                               {isAdmin(m, forening.oprettet_af) && <span className="text-[9px] font-bold bg-blue-50 text-blue-600 px-1.5 rounded">ADMIN</span>}
                             </div>
                             <p className="text-xs text-gray-400 group-hover:text-gray-500">{m.users?.email}</p>
                           </div>
                           <div className="text-gray-300">›</div>
                        </div>
                      ))}
                      {approved.length === 0 && <p className="text-sm text-gray-400 italic">Ingen medlemmer endnu.</p>}
                    </div>
                  </div>

                  {/* DECLINED (KUN ADMIN) */}
                  {isUserAdmin && declined.length > 0 && (
                     <div className="opacity-60 grayscale">
                        <h4 className="text-xs font-bold text-gray-500 uppercase mb-2 mt-6">Afviste ({declined.length})</h4>
                        {declined.map(m => (
                          <div key={m.user_id} className="flex items-center gap-3 p-2">
                             <div className="w-8 h-8 rounded-full bg-gray-200"></div>
                             <p className="text-sm font-bold text-gray-500">{getDisplayName(m)}</p>
                          </div>
                        ))}
                     </div>
                  )}

                </div>
              )}
            </div>
          </div>
        </div>
      )}

    </div>
  );
}