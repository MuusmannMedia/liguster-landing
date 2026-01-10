'use client';

import { useState, useEffect } from 'react';
import { useRouter } from 'next/navigation';
import { supabase } from '../../lib/supabaseClient'; 
import SiteHeader from '../../components/SiteHeader';
import SiteFooter from '../../components/SiteFooter';

// --- TYPER ---
type Forening = {
  id: string;
  navn: string;
  sted: string;
  beskrivelse: string;
  billede_url?: string;
  slug?: string;
  oprettet_af?: string;
  has_pending_members?: boolean; // ✅ NYT: Markør for om der er ventende medlemmer
};

// --- HJÆLPER: GENERER SLUG ---
const generateSlug = (text: string) => {
  return text
    .toString()
    .toLowerCase()
    .replace(/\s+/g, '-')           
    .replace(/[æ]/g, 'ae')          
    .replace(/[ø]/g, 'oe')          
    .replace(/[å]/g, 'aa')          
    .replace(/[^\w\-]+/g, '')       
    .replace(/\-\-+/g, '-')         
    .replace(/^-+/, '')             
    .replace(/-+$/, '');            
};

// --- KOMPONENT: OPRET FORENING MODAL ---
function CreateForeningModal({ isOpen, onClose, userId, onCreated }: { isOpen: boolean; onClose: () => void; userId: string; onCreated: () => void }) {
  const [loading, setLoading] = useState(false);
  const [navn, setNavn] = useState("");
  const [sted, setSted] = useState("");
  const [beskrivelse, setBeskrivelse] = useState("");

  if (!isOpen) return null;

  const handleOpret = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!navn || !sted || !beskrivelse) {
      alert("Udfyld venligst alle felter");
      return;
    }

    try {
      setLoading(true);

      const rawSlug = `${navn}-${sted}`;
      const slug = generateSlug(rawSlug) + '-' + Date.now().toString().slice(-4);

      // 1. Opret foreningen
      const { data: foreningData, error: foreningError } = await supabase
        .from("foreninger")
        .insert([{ 
          navn: navn.trim(), 
          sted: sted.trim(), 
          beskrivelse: beskrivelse.trim(), 
          slug: slug,
          oprettet_af: userId,
          is_public: false 
        }])
        .select("id")
        .single();

      if (foreningError) throw foreningError;

      // 2. Gør brugeren til admin
      if (foreningData?.id) {
        await supabase.from("foreningsmedlemmer").insert([{ 
            forening_id: foreningData.id, 
            user_id: userId, 
            rolle: "admin", 
            status: "approved" 
        }]);
      }

      setNavn(""); setSted(""); setBeskrivelse("");
      onCreated();
      onClose();

    } catch (error: any) {
      alert("Fejl ved oprettelse: " + error.message);
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="fixed inset-0 z-[200] flex items-center justify-center p-4 bg-black/60 backdrop-blur-sm animate-in fade-in duration-200">
      <div className="bg-white w-full max-w-md rounded-2xl shadow-2xl overflow-hidden flex flex-col">
        <div className="bg-[#131921] px-6 py-4 flex justify-between items-center">
          <h2 className="text-white text-lg font-bold uppercase tracking-wider">Opret Forening</h2>
          <button onClick={onClose} className="text-gray-400 hover:text-white transition-colors"><i className="fa-solid fa-xmark text-xl"></i></button>
        </div>
        <form onSubmit={handleOpret} className="p-6 space-y-5">
          <div>
            <label className="block text-xs font-bold text-gray-500 uppercase mb-1 ml-1">Foreningens navn</label>
            <input type="text" className="w-full bg-gray-50 border border-gray-200 rounded-xl px-4 py-3 outline-none focus:ring-2 focus:ring-[#131921] focus:bg-white text-[#131921] transition-all" placeholder="F.eks. Grundejerforeningen Solvang" value={navn} onChange={e => setNavn(e.target.value)} autoFocus />
            <div className="mt-3 bg-amber-50 border border-amber-200 rounded-xl p-3 flex gap-3 items-start">
              <i className="fa-solid fa-circle-exclamation text-amber-600 mt-0.5 text-sm"></i>
              <p className="text-xs text-amber-900 leading-relaxed font-medium"><strong>Vigtigt:</strong> Navnet bestemmer foreningens permanente link (URL). Selvom du kan rette navnet senere, vil linket forblive det samme.</p>
            </div>
          </div>
          <div>
            <label className="block text-xs font-bold text-gray-500 uppercase mb-1 ml-1">Sted / By</label>
            <input type="text" className="w-full bg-gray-50 border border-gray-200 rounded-xl px-4 py-3 outline-none focus:ring-2 focus:ring-[#131921] focus:bg-white text-[#131921] transition-all" placeholder="F.eks. Odense C" value={sted} onChange={e => setSted(e.target.value)} />
          </div>
          <div>
            <label className="block text-xs font-bold text-gray-500 uppercase mb-1 ml-1">Kort beskrivelse</label>
            <textarea className="w-full bg-gray-50 border border-gray-200 rounded-xl px-4 py-3 h-24 outline-none focus:ring-2 focus:ring-[#131921] focus:bg-white text-[#131921] resize-none transition-all" placeholder="Hvad er formålet med foreningen?" value={beskrivelse} onChange={e => setBeskrivelse(e.target.value)} />
          </div>
          <div className="pt-2 flex gap-3">
            <button type="button" onClick={onClose} className="flex-1 py-3 rounded-xl font-bold text-gray-600 bg-gray-100 hover:bg-gray-200 transition-colors">Annuller</button>
            <button type="submit" disabled={loading} className="flex-[2] py-3 rounded-xl font-bold text-white bg-[#131921] hover:bg-gray-900 flex items-center justify-center transition-colors shadow-md disabled:opacity-70">{loading ? <span className="animate-spin mr-2">⏳</span> : null} Opret Forening</button>
          </div>
        </form>
      </div>
    </div>
  );
}

// --- MAIN PAGE ---
export default function ForeningPage() {
  const router = useRouter();
  const [visning, setVisning] = useState<"mine" | "alle">("mine");
  const [search, setSearch] = useState("");
  const [foreninger, setForeninger] = useState<Forening[]>([]);
  const [invites, setInvites] = useState<Forening[]>([]); 
  const [loading, setLoading] = useState(true);
  const [userId, setUserId] = useState<string | null>(null);
  const [isCreateOpen, setIsCreateOpen] = useState(false);

  useEffect(() => {
    const init = async () => {
      const { data: { session } } = await supabase.auth.getSession();
      
      if (session) {
        setUserId(session.user.id);
        setVisning("mine");
        fetchData(session.user.id, "mine");
      } else {
        router.replace('/login');
      }
    };
    init();
  }, [router]);

  useEffect(() => {
    if (userId) fetchData(userId, visning);
  }, [visning, userId]);

  const fetchData = async (uid: string, mode: "mine" | "alle") => {
    setLoading(true);
    try {
      let data: any[] | null = [];
      
      // 1. Hent invitationer (til dig)
      const { data: invitesData } = await supabase
        .from("foreninger")
        .select("*, foreningsmedlemmer!inner(user_id, status)")
        .eq("foreningsmedlemmer.user_id", uid)
        .eq("foreningsmedlemmer.status", "pending");
        
      if (invitesData) setInvites(invitesData);

      // 2. Hent liste over foreninger
      if (mode === "alle") {
        const { data: res } = await supabase
          .from("foreninger")
          .select("*")
          .order("navn", { ascending: true });
        data = res;
      } 
      else if (mode === "mine" && uid) {
        // Hent foreninger hvor jeg er godkendt medlem
        const { data: res } = await supabase
          .from("foreninger")
          .select("*, foreningsmedlemmer!inner(user_id, status)")
          .eq("foreningsmedlemmer.user_id", uid)
          .eq("foreningsmedlemmer.status", "approved");
        
        // Tjek for ventende medlemmer i disse foreninger (hvis jeg er admin)
        // Dette er en "tung" operation, men nødvendig for den røde prik på kortet
        if (res && res.length > 0) {
            const foreningIds = res.map((f: any) => f.id);
            
            // Tjek hvilke af mine foreninger der har pending medlemmer
            const { data: pendingMembers } = await supabase
                .from("foreningsmedlemmer")
                .select("forening_id")
                .in("forening_id", foreningIds)
                .eq("status", "pending");

            if (pendingMembers) {
                // Lav et Set af ID'er med pending members for hurtig opslag
                const pendingSet = new Set(pendingMembers.map((pm: any) => pm.forening_id));
                
                // Opdater data med has_pending_members flag
                data = res.map((f: any) => ({
                    ...f,
                    has_pending_members: pendingSet.has(f.id)
                }));
            } else {
                data = res;
            }
        } else {
            data = res;
        }
      }
      setForeninger(data || []);
    } catch (err) {
      console.error("Fejl:", err);
    } finally {
      setLoading(false);
    }
  };

  const handleAcceptInvite = async (foreningId: string) => {
    if(!userId) return;
    const { error } = await supabase
        .from("foreningsmedlemmer")
        .update({ status: 'approved' })
        .eq("forening_id", foreningId)
        .eq("user_id", userId);
    
    if(!error) {
        alert("Du er nu medlem!");
        fetchData(userId, visning);
    }
  };

  const handleDeclineInvite = async (foreningId: string) => {
    if(!userId) return;
    if(!confirm("Er du sikker på, at du vil afvise invitationen?")) return;
    
    const { error } = await supabase
        .from("foreningsmedlemmer")
        .delete()
        .eq("forening_id", foreningId)
        .eq("user_id", userId);
    
    if(!error) {
        fetchData(userId, visning);
    }
  };

  const filtered = foreninger.filter(f => {
    const s = search.toLowerCase();
    return (
      f.navn.toLowerCase().includes(s) ||
      f.sted.toLowerCase().includes(s) ||
      f.beskrivelse.toLowerCase().includes(s)
    );
  });

  if (!userId) return null; 

  return (
    <div className="min-h-screen flex flex-col bg-[#869FB9]">
      <SiteHeader />
      
      <div className="sticky top-16 z-40 bg-[#869FB9] px-4 pb-6 pt-4 shadow-md rounded-b-[40px]">
        <div className="max-w-4xl mx-auto space-y-4">
          
          <div className="flex gap-3">
            <div className="flex-1 relative">
               <i className="fa-solid fa-search absolute left-4 top-1/2 -translate-y-1/2 text-[#254890]"></i>
               <input type="text" className="w-full h-12 rounded-full pl-12 pr-4 bg-white text-[#222] placeholder-gray-400 outline-none shadow-sm focus:ring-2 focus:ring-[#131921]" placeholder="Søg i foreninger..." value={search} onChange={e => setSearch(e.target.value)} />
            </div>
            <button onClick={() => setIsCreateOpen(true)} className="h-12 w-12 rounded-full bg-[#131921] flex items-center justify-center text-white shadow-md hover:bg-gray-900 transition-colors"><i className="fa-solid fa-plus text-xl"></i></button>
          </div>

          <div className="flex bg-white/10 p-1 rounded-full backdrop-blur-sm gap-1">
            <button onClick={() => setVisning("mine")} className={`flex-1 py-3 rounded-full text-xs font-bold tracking-wider transition-all ${visning === "mine" ? "bg-[#131921] text-white shadow-md" : "bg-white text-[#131921] hover:bg-gray-50"}`}>MINE FORENINGER</button>
            <button onClick={() => setVisning("alle")} className={`flex-1 py-3 rounded-full text-xs font-bold tracking-wider transition-all ${visning === "alle" ? "bg-[#131921] text-white shadow-md" : "bg-white text-[#131921] hover:bg-gray-50"}`}>ALLE FORENINGER</button>
          </div>

        </div>
      </div>

      <main className="flex-1 max-w-4xl mx-auto w-full px-4 py-6 space-y-8">
        
        {/* INVITATIONER SEKTION */}
        {invites.length > 0 && (
            <div className="bg-[#131921] rounded-[24px] p-6 shadow-xl border border-white/10 animate-in slide-in-from-top-4 duration-500">
                <h3 className="text-white font-black text-lg mb-4 flex items-center gap-2">
                    <i className="fa-solid fa-envelope-open-text text-yellow-400"></i> Du har modtaget invitationer!
                </h3>
                <div className="grid grid-cols-1 gap-4">
                    {invites.map(inv => (
                        <div key={inv.id} className="bg-white rounded-xl p-4 flex flex-col sm:flex-row sm:items-center justify-between gap-4">
                            <div className="flex items-center gap-4">
                                <div className="w-12 h-12 rounded-lg bg-gray-200 overflow-hidden flex-shrink-0">
                                    {inv.billede_url ? <img src={inv.billede_url} className="w-full h-full object-cover"/> : null}
                                </div>
                                <div>
                                    <h4 className="font-bold text-[#131921] text-lg leading-tight">{inv.navn}</h4>
                                    <p className="text-sm text-gray-500">{inv.sted}</p>
                                </div>
                            </div>
                            <div className="flex gap-2 w-full sm:w-auto">
                                <button onClick={() => handleAcceptInvite(inv.id)} className="flex-1 sm:flex-none px-5 py-2.5 bg-green-500 hover:bg-green-600 text-white font-bold rounded-lg transition-colors shadow-sm">Accepter</button>
                                <button onClick={() => handleDeclineInvite(inv.id)} className="flex-1 sm:flex-none px-5 py-2.5 bg-gray-100 hover:bg-gray-200 text-gray-700 font-bold rounded-lg transition-colors">Afvis</button>
                            </div>
                        </div>
                    ))}
                </div>
            </div>
        )}

        {loading ? (
          <div className="flex justify-center pt-20"><div className="animate-spin rounded-full h-12 w-12 border-b-2 border-[#131921]"></div></div>
        ) : filtered.length === 0 ? (
          <div className="text-center text-white mt-20 opacity-80">
            <p className="text-lg font-medium">
              {visning === "mine" ? "Du er endnu ikke medlem af nogen foreninger." : "Ingen foreninger fundet."}
            </p>
          </div>
        ) : (
          <div className="grid grid-cols-1 md:grid-cols-2 gap-5">
            {filtered.map(forening => (
              <div 
                key={forening.id}
                onClick={() => router.push(`/forening/${forening.slug || forening.id}`)}
                className="bg-white rounded-[24px] p-4 shadow-sm hover:shadow-lg transition-shadow cursor-pointer flex flex-col h-full transform hover:scale-[1.02] duration-200 relative overflow-hidden"
              >
                <div className="w-full aspect-square rounded-[18px] mb-3 overflow-hidden bg-[#E7EBF0] flex items-center justify-center relative">
                  {forening.billede_url ? (
                    <img src={forening.billede_url} alt={forening.navn} className="w-full h-full object-cover" />
                  ) : (
                    <span className="text-[#536071] font-bold text-xl px-4 text-center line-clamp-2">{forening.navn}</span>
                  )}
                  
                  {/* ✅ RØD PRIK HVIS DER ER PENDING MEDLEMMER (OG DU ER MEDLEM/ADMIN) */}
                  {forening.has_pending_members && (
                    <div className="absolute top-3 right-3 w-4 h-4 bg-red-500 rounded-full border-2 border-white shadow-md animate-pulse"></div>
                  )}
                </div>
                <h3 className="font-bold text-lg text-[#131921] mb-1 underline decoration-gray-300 truncate pr-4">{forening.navn}</h3>
                <p className="text-[#222] text-sm font-semibold mb-2 truncate">{forening.sted}</p>
                <p className="text-[#444] text-sm line-clamp-2 h-10 leading-relaxed">{forening.beskrivelse}</p>
              </div>
            ))}
          </div>
        )}
      </main>
      <SiteFooter />
      
      {userId && (
        <CreateForeningModal 
          isOpen={isCreateOpen} 
          onClose={() => setIsCreateOpen(false)} 
          userId={userId} 
          onCreated={() => fetchData(userId, visning)}
        />
      )}
    </div>
  );
}