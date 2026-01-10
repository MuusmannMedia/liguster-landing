'use client';

import { useState, useEffect, useMemo, useRef } from 'react';
import { useParams, useRouter } from 'next/navigation';
import { supabase } from '../../../lib/supabaseClient';
import SiteHeader from '../../../components/SiteHeader';
import SiteFooter from '../../../components/SiteFooter';
import Link from 'next/link';
import Image from 'next/image';

// --- TYPER ---
type Forening = {
  id: string;
  navn: string;
  sted: string;
  beskrivelse: string;
  billede_url?: string;
  oprettet_af?: string;
  slug?: string;
  is_public?: boolean;
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

type Thread = { id: string; title: string; created_at: string; created_by: string };

type Event = { 
  id: string; 
  title: string; 
  start_at: string; 
  end_at: string; 
  location?: string; 
  price?: number;
  description?: string;
  image_url?: string; 
};

type ImagePreview = { id: number; image_url: string };

type UserSearchResult = {
  id: string;
  name: string | null;
  username: string | null;
  avatar_url: string | null;
};

// --- HJÆLPERE ---
const getDisplayName = (m: any) => {
  const user = m?.users || m; 
  const n = user?.name?.trim() || user?.username?.trim();
  if (n) return n;
  const email = user?.email || "";
  return email.includes("@") ? email.split("@")[0] : "Ukendt";
};

const getAvatarUrl = (path: string | null | undefined) => {
  if (!path) return null;
  if (path.startsWith('http')) return path; 
  const { data } = supabase.storage.from('avatars').getPublicUrl(path);
  return data.publicUrl;
};

const getEventImageUrl = (path: string | null | undefined) => {
  if (!path) return ""; 
  if (path.startsWith('http')) return path;
  const { data } = supabase.storage.from('event_images').getPublicUrl(path);
  return data.publicUrl;
};

const fmtDate = (d: any) => new Date(d).toLocaleDateString("da-DK", { day: 'numeric', month: 'long' });
const fmtTime = (d: any) => new Date(d).toLocaleTimeString("da-DK", { hour: '2-digit', minute: '2-digit' });

const startOfMonth = (d: Date) => new Date(d.getFullYear(), d.getMonth(), 1);
const endOfMonth = (d: Date) => new Date(d.getFullYear(), d.getMonth() + 1, 0);
const pad = (n: number) => (n < 10 ? `0${n}` : `${n}`);
const toKey = (d: Date) => `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`;

const buildMonthGrid = (base: Date) => {
  const first = startOfMonth(base);
  const last = endOfMonth(base);
  const firstWeekday = (first.getDay() + 6) % 7; 
  const daysInMonth = last.getDate();
  const cells: Date[] = [];
  for (let i = 0; i < firstWeekday; i++) {
    const d = new Date(first);
    d.setDate(first.getDate() - (firstWeekday - i));
    cells.push(d);
  }
  for (let d = 1; d <= daysInMonth; d++) {
    cells.push(new Date(base.getFullYear(), base.getMonth(), d));
  }
  while (cells.length < 42) {
    const lastCell = cells[cells.length - 1];
    const next = new Date(lastCell);
    next.setDate(lastCell.getDate() + 1);
    cells.push(next);
  }
  const weeks: Date[][] = [];
  for (let i = 0; i < 6; i++) weeks.push(cells.slice(i * 7, i * 7 + 7));
  return weeks;
};

export default function ForeningDetaljePage() {
  const params = useParams();
  const router = useRouter();
  
  const idOrSlug = params.id as string;
  const [realForeningId, setRealForeningId] = useState<string | null>(null);

  const [loading, setLoading] = useState(true);
  const [forening, setForening] = useState<Forening | null>(null);
  const [medlemmer, setMedlemmer] = useState<Medlem[]>([]);
  const [userId, setUserId] = useState<string | null>(null);
  const [uploading, setUploading] = useState(false);
  
  // Edit States
  const [isEditing, setIsEditing] = useState(false);
  const [editNavn, setEditNavn] = useState("");
  const [editSted, setEditSted] = useState("");
  const [editDescription, setEditDescription] = useState("");
  const [editIsPublic, setEditIsPublic] = useState(false);

  const fileInputRef = useRef<HTMLInputElement>(null);

  const [threads, setThreads] = useState<Thread[]>([]);
  const [events, setEvents] = useState<Event[]>([]);
  const [images, setImages] = useState<ImagePreview[]>([]);

  const [monthCursor, setMonthCursor] = useState(new Date());
  const [calendarEvents, setCalendarEvents] = useState<Event[]>([]);
  const [selectedDateEvents, setSelectedDateEvents] = useState<{date: string, events: Event[]} | null>(null);

  const [showMembers, setShowMembers] = useState(false);
  const [selectedMember, setSelectedMember] = useState<Medlem | null>(null);

  // Invite States
  const [showInviteModal, setShowInviteModal] = useState(false);
  const [searchQuery, setSearchQuery] = useState("");
  const [searchResults, setSearchResults] = useState<UserSearchResult[]>([]);
  const [isSearching, setIsSearching] = useState(false);
  const [inviteMessage, setInviteMessage] = useState("");
  
  // --- SAMLET DATA LOADER ---
  useEffect(() => {
    async function loadAllData() {
      setLoading(true);
      
      try {
        const { data: { session } } = await supabase.auth.getSession();
        const currentUserId = session?.user?.id || null;
        setUserId(currentUserId);

        if (!idOrSlug) return;
        const isUuid = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(idOrSlug);
        let query = supabase.from("foreninger").select("*");
        if (isUuid) query = query.eq("id", idOrSlug);
        else query = query.eq("slug", idOrSlug);
        
        const { data: foreningData, error } = await query.single();

        if (error || !foreningData) {
          setForening(null);
          setLoading(false);
          return;
        }

        setForening(foreningData);
        setRealForeningId(foreningData.id);
        setEditNavn(foreningData.navn || "");
        setEditSted(foreningData.sted || "");
        setEditDescription(foreningData.beskrivelse || "");
        setEditIsPublic(foreningData.is_public || false);

        if (!currentUserId) {
          if (foreningData.is_public) {
            setLoading(false);
            return;
          } else {
            router.replace('/login');
            return;
          }
        }

        if (currentUserId) {
          const fId = foreningData.id;
          
          const p1 = supabase.from("foreningsmedlemmer").select("user_id, rolle, status, users:users!foreningsmedlemmer_user_id_fkey (name, username, avatar_url, email)").eq("forening_id", fId);
          const p2 = supabase.from("forening_threads").select("*").eq("forening_id", fId).order("created_at", { ascending: false }).limit(3);
          const p3 = supabase.from("forening_events").select("*").eq("forening_id", fId).order("start_at", { ascending: false }).limit(3);
          
          const today = new Date();
          const first = startOfMonth(today);
          const last = endOfMonth(today);
          const bufferStart = new Date(first); bufferStart.setDate(first.getDate() - 7);
          const bufferEnd = new Date(last); bufferEnd.setDate(last.getDate() + 7);
          
          const p4 = supabase.from("forening_events")
            .select("id, title, start_at, end_at, location, price, description, image_url")
            .eq("forening_id", fId)
            .gte("start_at", bufferStart.toISOString())
            .lte("start_at", bufferEnd.toISOString());

          const { data: allEvents } = await supabase.from("forening_events").select("id").eq("forening_id", fId);
          let p5: any = Promise.resolve({ data: [] });
          if (allEvents && allEvents.length > 0) {
             const eventIds = allEvents.map(e => e.id);
             p5 = supabase.from("event_images").select("id, image_url").in("event_id", eventIds).order("created_at", { ascending: false }).limit(8);
          }

          const [res1, res2, res3, res4, res5] = await Promise.all([p1, p2, p3, p4, p5]);

          if (res1.data) setMedlemmer(res1.data as unknown as Medlem[]);
          if (res2.data) setThreads(res2.data);
          if (res3.data) setEvents(res3.data);
          if (res4.data) setCalendarEvents(res4.data);
          if (res5.data) setImages(res5.data);
          
          setLoading(false);
        }

      } catch (err) {
        console.error("Critical error loading page:", err);
        setLoading(false);
      }
    }

    loadAllData();
  }, [idOrSlug]);

  useEffect(() => {
    if (realForeningId && userId) {
        const fetchCal = async () => {
            const first = startOfMonth(monthCursor);
            const last = endOfMonth(monthCursor);
            const bufferStart = new Date(first); bufferStart.setDate(first.getDate() - 7);
            const bufferEnd = new Date(last); bufferEnd.setDate(last.getDate() + 7);
            const { data } = await supabase.from("forening_events")
                .select("id, title, start_at, end_at, location, price, description, image_url")
                .eq("forening_id", realForeningId)
                .gte("start_at", bufferStart.toISOString())
                .lte("start_at", bufferEnd.toISOString());
            if(data) setCalendarEvents(data);
        };
        fetchCal();
    }
  }, [monthCursor, realForeningId, userId]);


  // --- ACTIONS ---
  const handleShareForening = async () => {
    if (!forening) return;
    const shareUrl = typeof window !== 'undefined' ? window.location.href : '';
    if (navigator.share) {
      try { await navigator.share({ title: forening.navn, text: `Tjek ${forening.navn} på Liguster!`, url: shareUrl }); } catch (err) {}
    } else {
      handleCopyLink();
    }
  };

  const handleCopyLink = async () => {
    const shareUrl = typeof window !== 'undefined' ? window.location.href : '';
    try { await navigator.clipboard.writeText(shareUrl); alert("Link kopieret!"); } catch (err) { alert("Kunne ikke kopiere link."); }
  };

  const handleSaveInfo = async () => {
    if (!realForeningId) return;
    const { error } = await supabase.from('foreninger').update({ 
        navn: editNavn, 
        sted: editSted, 
        beskrivelse: editDescription,
        is_public: editIsPublic 
    }).eq('id', realForeningId);

    if (error) {
      alert("Fejl: " + error.message);
    } else {
      setForening(prev => prev ? { ...prev, navn: editNavn, sted: editSted, beskrivelse: editDescription, is_public: editIsPublic } : null);
      setIsEditing(false);
    }
  };

  const handleJoin = async () => {
    if (!userId || !realForeningId) {
        router.push('/opret');
        return;
    }
    const { error } = await supabase.from('foreningsmedlemmer').insert([{ forening_id: realForeningId, user_id: userId, rolle: 'medlem', status: 'pending' }]);
    if (!error) { alert('Anmodning sendt!'); window.location.reload(); }
  };

  const handleLeave = async () => {
    if (!userId || !realForeningId || !confirm("Er du sikker?")) return;
    const { error } = await supabase.from('foreningsmedlemmer').delete().eq('forening_id', realForeningId).eq('user_id', userId);
    if (!error) { alert("Udmeldt."); window.location.reload(); }
  };

  const handleImageUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    if (!e.target.files || !realForeningId) return;
    const file = e.target.files[0];
    setUploading(true);
    const fileName = `${realForeningId}_${Date.now()}`;
    const { error: uploadError } = await supabase.storage.from('foreningsbilleder').upload(fileName, file);
    if (!uploadError) {
      const { data } = supabase.storage.from('foreningsbilleder').getPublicUrl(fileName);
      await supabase.from('foreninger').update({ billede_url: data.publicUrl }).eq('id', realForeningId);
      const { data: updated } = await supabase.from("foreninger").select("*").eq("id", realForeningId).single();
      setForening(updated);
    }
    setUploading(false);
  };

  const handleDeleteForening = async () => {
    if (!realForeningId || !confirm("Er du sikker?")) return;
    const { error } = await supabase.from('foreninger').delete().eq('id', realForeningId);
    if (!error) { alert("Slettet."); router.push('/opslag'); }
  };

  const promoteToAdmin = async (targetUserId: string) => {
    if (!realForeningId || !confirm("Er du sikker?")) return;
    const { error } = await supabase.from('foreningsmedlemmer').update({ rolle: 'admin' }).eq('forening_id', realForeningId).eq('user_id', targetUserId);
    if (!error) { alert("Opdateret."); window.location.reload(); }
  };

  const inviteUser = async (targetUserId: string) => {
    if (!realForeningId || !confirm("Vil du invitere denne bruger?")) return;

    // 1. Opret invitationen (status: pending)
    const { error: inviteError } = await supabase.from('foreningsmedlemmer').insert({
        forening_id: realForeningId,
        user_id: targetUserId,
        rolle: 'medlem',
        status: 'pending'
    });

    if (inviteError) {
        if (inviteError.code === '23505') {
            alert("Brugeren er allerede medlem eller inviteret.");
        } else {
            alert("Fejl ved invitation: " + inviteError.message);
        }
        return;
    }

    // 2. Send en besked med link til foreningen (Automatisk DM)
    if (forening && userId) {
        const link = `/forening/${forening.slug || forening.id}`;
        
        const intro = inviteMessage.trim() !== "" 
            ? inviteMessage 
            : `Hej! Jeg har inviteret dig til at være med i foreningen "${forening.navn}".`;

        const msgText = `${intro}\n\nDu kan se foreningen og acceptere invitationen her: ${link}`;

        const { error: msgError } = await supabase.from('messages').insert({
            sender_id: userId,
            receiver_id: targetUserId,
            content: msgText, 
            is_read: false
        });

        if (msgError) {
            console.warn("Invitation oprettet, men kunne ikke sende besked:", msgError);
        }
    }

    alert("Invitation og besked sendt!");
    setShowInviteModal(false);
    setSearchQuery("");
    setInviteMessage("");
    setSearchResults([]);
    fetchMedlemmer(); // Opdater listen med det samme
  };

  // Genindlæs medlemmer (til brug efter invite)
  const fetchMedlemmer = async () => {
    if (!realForeningId) return;
    const { data } = await supabase.from("foreningsmedlemmer").select("user_id, rolle, status, users:users!foreningsmedlemmer_user_id_fkey (name, username, avatar_url, email)").eq("forening_id", realForeningId);
    if (data) setMedlemmer(data as unknown as Medlem[]);
  };

  // Søge funktion til modal
  useEffect(() => {
    const searchUsers = async () => {
        if (searchQuery.trim().length < 2) {
            setSearchResults([]);
            return;
        }
        setIsSearching(true);
        const { data, error } = await supabase
            .from('users')
            .select('id, name, username, avatar_url')
            .or(`name.ilike.%${searchQuery}%,username.ilike.%${searchQuery}%`)
            .limit(5);
        
        if (!error && data) {
            const existingMemberIds = medlemmer.map(m => m.user_id);
            const filtered = data.filter((u: any) => !existingMemberIds.includes(u.id));
            setSearchResults(filtered);
        }
        setIsSearching(false);
    };

    const timeoutId = setTimeout(() => {
        searchUsers();
    }, 500); 

    return () => clearTimeout(timeoutId);
  }, [searchQuery, medlemmer]);


  const triggerImageSelect = () => { fileInputRef.current?.click(); };
  const changeMonth = (delta: number) => { setMonthCursor(prev => new Date(prev.getFullYear(), prev.getMonth() + delta, 1)); };

  // ✅ FILTRERING: Opdel i godkendte og pending
  const approved = medlemmer.filter(m => m.status === "approved");
  const pending = medlemmer.filter(m => m.status === "pending"); // Ventende invitationer

  const myMembership = medlemmer.find(m => m.user_id === userId);
  const isMember = myMembership?.status === "approved";
  const isPending = myMembership?.status === "pending";
  const isOwner = forening?.oprettet_af === userId;
  const isMeAdmin = isOwner || myMembership?.rolle === 'admin'; 

  const eventsByDate = useMemo(() => {
    const map = new Map<string, Event[]>();
    calendarEvents.forEach(e => { const key = toKey(new Date(e.start_at)); const list = map.get(key) || []; list.push(e); map.set(key, list); });
    return map;
  }, [calendarEvents]);

  if (loading) return <div className="min-h-screen bg-[#869FB9] flex items-center justify-center"><div className="animate-spin rounded-full h-12 w-12 border-b-2 border-[#131921]"></div></div>;
  if (!forening) return <div className="min-h-screen bg-[#869FB9] p-10 text-center text-white">Forening ikke fundet</div>;

  if (!userId) {
    return (
      <div className="min-h-screen flex flex-col bg-[#869FB9]">
        <SiteHeader />
        <main className="flex-1 w-full max-w-4xl mx-auto p-4 pb-20 space-y-6">
          <div className="bg-white rounded-[24px] p-5 shadow-md mt-6 flex flex-col gap-4">
            <div className="relative w-full aspect-square rounded-[18px] overflow-hidden bg-gray-100">
              {forening.billede_url ? (
                <img src={forening.billede_url} className="w-full h-full object-cover" alt="Cover" />
              ) : (
                <div className="w-full h-full flex items-center justify-center text-gray-400">Intet billede</div>
              )}
              <div className="absolute top-4 right-4 bg-white/90 backdrop-blur-sm text-[#131921] text-xs font-black px-3 py-1.5 rounded-full shadow-sm uppercase tracking-wider">
                 Offentlig visning
              </div>
            </div>
            <div className="flex flex-col gap-1">
              <h1 className="text-2xl font-black text-[#131921] underline decoration-gray-300">{forening.navn}</h1>
              <p className="text-gray-700 font-bold mb-3">{forening.sted}</p>
              <p className="text-[#444] text-sm leading-relaxed whitespace-pre-wrap">{forening.beskrivelse}</p>
            </div>
          </div>
          <div className="bg-[#0D253F] rounded-[24px] p-8 md:p-10 text-center shadow-lg relative overflow-hidden">
            <div className="flex flex-col items-center mb-6">
               <div className="relative w-48 h-16">
                  <Image src="/Liguster-logo-NEG.png" alt="Liguster" fill className="object-contain" />
               </div>
            </div>
            <h2 className="text-white text-2xl md:text-3xl font-bold mb-4">Klar til at gøre en forskel lokalt?</h2>
            <p className="text-white/80 text-sm md:text-base leading-relaxed mb-8 max-w-lg mx-auto">
              Opret en bruger i dag for at se aktiviteter, beskeder og medlemmer i <strong>{forening.navn}</strong>. 
              Det er gratis, enkelt og tager kun et øjeblik.
            </p>
            <Link href="/opret" className="inline-flex items-center gap-2 bg-white text-[#0D253F] px-8 py-4 rounded-full font-bold text-sm shadow-md hover:bg-gray-100 transition-colors">
              <i className="fa-solid fa-user-plus"></i> Opret bruger nu
            </Link>
            <div className="mt-4">
                <Link href="/login" className="text-white/60 text-xs hover:text-white underline">
                    Har du allerede en bruger? Log ind her
                </Link>
            </div>
          </div>
        </main>
        <SiteFooter />
      </div>
    );
  }

  return (
    <div className="min-h-screen flex flex-col bg-[#869FB9]">
      <SiteHeader />

      <main className="flex-1 w-full max-w-4xl mx-auto p-4 pb-20 space-y-6">
        <input type="file" accept="image/*" ref={fileInputRef} className="hidden" onChange={handleImageUpload} />

        <div className="bg-white rounded-[24px] p-5 shadow-md mt-6 flex flex-col gap-4">
          <div className="relative w-full aspect-square rounded-[18px] overflow-hidden bg-gray-100">
            {forening.billede_url ? (
              <img src={forening.billede_url} className="w-full h-full object-cover" alt="Cover" />
            ) : (
              <div className="w-full h-full flex items-center justify-center text-gray-400">Intet billede</div>
            )}
          </div>

          <div className="w-full">
            {isEditing ? (
              <div className="flex flex-col gap-3">
                <input value={editNavn} onChange={(e) => setEditNavn(e.target.value)} style={{ color: '#000000' }} className="w-full p-3 border border-gray-300 rounded-xl focus:outline-none focus:border-[#131921] font-black text-xl text-gray-900 bg-white" placeholder="Foreningens navn" />
                <input value={editSted} onChange={(e) => setEditSted(e.target.value)} style={{ color: '#000000' }} className="w-full p-3 border border-gray-300 rounded-xl focus:outline-none focus:border-[#131921] font-bold text-gray-700 bg-white" placeholder="Sted" />
                <textarea value={editDescription} onChange={(e) => setEditDescription(e.target.value)} style={{ color: '#000000' }} className="w-full min-h-[150px] p-3 border border-gray-300 rounded-xl focus:outline-none focus:border-[#131921] text-sm text-gray-900 placeholder-gray-500 bg-white" placeholder="Beskrivelse..." />
                
                <div className="flex items-center gap-3 px-1 border-t border-gray-100 pt-3 mt-1">
                  <input 
                    type="checkbox" 
                    id="isPublicCheck"
                    checked={editIsPublic} 
                    onChange={(e) => setEditIsPublic(e.target.checked)}
                    className="w-5 h-5 accent-[#131921] cursor-pointer"
                  />
                  <div>
                    <label htmlFor="isPublicCheck" className="text-sm font-bold text-[#131921] cursor-pointer select-none">
                      Gør foreningssiden offentlig
                    </label>
                    <p className="text-xs text-gray-500 mt-0.5">Hvis markeret, vises foreningen på den offentlige liste.</p>
                  </div>
                </div>

                <div className="flex gap-2 justify-end pt-2">
                  <button onClick={() => setIsEditing(false)} className="px-4 py-2.5 bg-gray-100 text-gray-700 rounded-full text-xs font-bold hover:bg-gray-200">ANNULLER</button>
                  <button onClick={handleSaveInfo} className="px-4 py-2.5 bg-[#131921] text-white rounded-full text-xs font-bold hover:bg-gray-900">GEM ÆNDRINGER</button>
                </div>
              </div>
            ) : (
              <div className="flex flex-col gap-1">
                <div className="flex justify-between items-start">
                   <h1 className="text-2xl font-black text-[#131921] underline decoration-gray-300">{forening.navn}</h1>
                   {forening.is_public && (
                     <span className="bg-green-100 text-green-700 text-[10px] font-bold px-2 py-1 rounded-full uppercase tracking-wide border border-green-200">
                       Offentlig
                     </span>
                   )}
                </div>
                <p className="text-gray-700 font-bold mb-3">{forening.sted}</p>
                <p className="text-[#444] text-sm leading-relaxed whitespace-pre-wrap">{forening.beskrivelse}</p>
                
                <div className="flex flex-wrap gap-2 mt-4">
                  <button onClick={handleCopyLink} className="px-4 py-2.5 bg-[#e9eef5] hover:bg-gray-200 text-[#0f172a] text-xs font-bold rounded-xl transition-colors uppercase tracking-wide flex items-center justify-center gap-2"><i className="fa-solid fa-link"></i> Kopiér</button>
                  <button onClick={handleShareForening} className="px-4 py-2.5 bg-[#e9eef5] hover:bg-gray-200 text-[#0f172a] text-xs font-bold rounded-xl transition-colors uppercase tracking-wide flex items-center justify-center gap-2"><i className="fa-solid fa-share-nodes"></i> Del</button>
                  {isMeAdmin && (
                    <>
                      <button onClick={() => setIsEditing(true)} className="px-4 py-2.5 bg-[#e9eef5] hover:bg-gray-200 text-[#0f172a] text-xs font-bold rounded-xl transition-colors uppercase tracking-wide flex items-center justify-center gap-2"><i className="fa-solid fa-pen-to-square"></i> Rediger</button>
                      <button onClick={() => setShowInviteModal(true)} className="px-4 py-2.5 bg-[#e9eef5] hover:bg-gray-200 text-[#0f172a] text-xs font-bold rounded-xl transition-colors uppercase tracking-wide flex items-center justify-center gap-2"><i className="fa-solid fa-user-plus"></i> Inviter</button>
                    </>
                  )}
                </div>
              </div>
            )}
          </div>

          {!isMember && (
            isPending ? <div className="w-full py-3 bg-gray-400 text-white rounded-full font-bold text-center cursor-default">Afventer godkendelse...</div> : 
            <button onClick={handleJoin} className="w-full py-3 bg-[#131921] text-white rounded-full font-bold shadow-md hover:bg-gray-900 transition-colors">Bliv medlem</button>
          )}
        </div>

        <button onClick={() => router.push(`/beskeder?id=${realForeningId}`)} className="w-full bg-white p-4 rounded-[24px] shadow-sm flex items-center hover:bg-gray-50 transition-colors">
           <div className="bg-[#131921] text-white px-4 py-2 rounded-full font-black text-sm tracking-wider">BESKEDER</div>
        </button>

        {/* ✅ MEDLEMMER PREVIEW MED RØD PRIK */}
        <div className="bg-white rounded-[24px] p-4 shadow-sm relative">
          <div className="flex justify-between items-center mb-3 px-2">
            <h3 className="font-black text-[#131921]">MEDLEMMER</h3>
            {/* Rød prik hvis der er pending members */}
            {pending.length > 0 && isMeAdmin && (
               <div className="absolute top-5 left-32 w-2.5 h-2.5 bg-red-500 rounded-full animate-pulse"></div>
            )}
            <button onClick={() => setShowMembers(true)} className="text-xs font-bold text-gray-500 hover:text-black">Se alle</button>
          </div>
          <div className="flex gap-4 overflow-x-auto pb-2 px-2 scrollbar-hide">
            {approved.map(m => {
              const avatarSrc = getAvatarUrl(m.users?.avatar_url);
              return (
                <div key={m.user_id} className="flex flex-col items-center min-w-[64px] cursor-pointer" onClick={() => { setSelectedMember(m); setShowMembers(true); }}>
                  <div className="w-14 h-14 rounded-[14px] bg-gray-100 overflow-hidden mb-1">
                    {avatarSrc ? <img src={avatarSrc} className="w-full h-full object-cover" /> : <div className="w-full h-full flex items-center justify-center font-bold text-gray-400">?</div>}
                  </div>
                  <span className="text-xs font-bold text-black truncate w-16 text-center">{getDisplayName(m)}</span>
                </div>
              );
            })}
            {approved.length === 0 && <p className="text-sm text-gray-400">Ingen medlemmer endnu.</p>}
          </div>
        </div>

        <div onClick={() => router.push(`/forening/${realForeningId}/threads`)} className="bg-white rounded-[24px] p-4 shadow-sm cursor-pointer hover:shadow-md transition-shadow">
          <div className="bg-[#131921] text-white px-4 py-1.5 rounded-full font-black text-sm tracking-wider inline-block mb-3">SAMTALER</div>
          {threads.length === 0 ? <p className="text-sm text-gray-400">Ingen tråde endnu.</p> : (
            <div className="space-y-3">
              {threads.map((t, idx) => (
                <div key={t.id} className={`flex justify-between ${idx !== 0 ? 'border-t border-gray-100 pt-3' : ''}`}>
                  <div><h4 className="font-bold text-[#131921] text-lg">{t.title}</h4><p className="text-xs text-gray-500 mt-1">Oprettet {fmtDate(t.created_at)}</p></div>
                </div>
              ))}
            </div>
          )}
        </div>

        <div onClick={() => router.push(`/forening/${realForeningId}/events`)} className="bg-white rounded-[24px] p-4 shadow-sm cursor-pointer hover:shadow-md transition-shadow">
          <div className="bg-[#131921] text-white px-4 py-1.5 rounded-full font-black text-sm tracking-wider inline-block mb-3">AKTIVITETER</div>
          {events.length === 0 ? <p className="text-sm text-gray-400">Ingen aktiviteter endnu.</p> : (
            <div className="space-y-3">
              {events.map((e, idx) => (
                <div key={e.id} className={`flex justify-between ${idx !== 0 ? 'border-t border-gray-100 pt-3' : ''}`}>
                  <div><h4 className="font-bold text-[#131921] text-lg">{e.title}</h4><p className="text-xs text-gray-500 mt-1">{fmtDate(e.start_at)} {e.location && `• ${e.location}`}</p></div>
                </div>
              ))}
            </div>
          )}
        </div>

        {/* KALENDER */}
        <div className="bg-white rounded-[24px] p-4 shadow-sm">
          <div className="bg-[#131921] text-white px-4 py-1.5 rounded-full font-black text-sm tracking-wider inline-block mb-3">KALENDER</div>
          
          <div className="flex items-center justify-between mb-4 px-2">
            <button 
              onClick={() => changeMonth(-1)} 
              className="w-10 h-10 flex items-center justify-center rounded-full bg-white hover:bg-gray-100 text-[#131921] text-lg font-bold border-2 border-gray-200 hover:border-[#131921] transition-all"
            >
              <i className="fa-solid fa-chevron-left"></i>
            </button>
            <h3 className="font-black text-[#131921] text-xl capitalize tracking-tight">
              {monthCursor.toLocaleDateString("da-DK", { month: 'long', year: 'numeric' })}
            </h3>
            <button 
              onClick={() => changeMonth(1)} 
              className="w-10 h-10 flex items-center justify-center rounded-full bg-white hover:bg-gray-100 text-[#131921] text-lg font-bold border-2 border-gray-200 hover:border-[#131921] transition-all"
            >
              <i className="fa-solid fa-chevron-right"></i>
            </button>
          </div>

          <div className="grid grid-cols-7 text-center mb-2">
            {['Man', 'Tir', 'Ons', 'Tor', 'Fre', 'Lør', 'Søn'].map(d => (
              <span key={d} className="text-xs font-black text-gray-400 uppercase tracking-widest">{d}</span>
            ))}
          </div>
          
          <div className="grid grid-cols-7 gap-1.5">
            {buildMonthGrid(monthCursor).map((week, wIdx) => week.map((day, dIdx) => {
                const isCurrentMonth = day.getMonth() === monthCursor.getMonth();
                const key = toKey(day);
                const dayEvents = eventsByDate.get(key) || [];
                const hasEvents = dayEvents.length > 0;
                
                return (
                  <div 
                    key={`${wIdx}-${dIdx}`} 
                    onClick={() => hasEvents && setSelectedDateEvents({ date: key, events: dayEvents })} 
                    className={`
                      aspect-square flex flex-col items-center justify-center rounded-xl text-sm relative cursor-pointer transition-all duration-200
                      ${!isCurrentMonth ? 'text-gray-300' : 'text-gray-800'}
                      ${hasEvents 
                        ? 'bg-[#131921] text-white shadow-lg transform hover:scale-105 font-bold border-2 border-[#131921]'
                        : 'hover:bg-gray-100 hover:font-bold'
                      }
                    `}
                  >
                    {day.getDate()}
                    {hasEvents && (
                      <div className="w-1.5 h-1.5 bg-white rounded-full mt-1"></div>
                    )}
                  </div>
                );
              }))}
          </div>
        </div>

        <div onClick={() => router.push(`/forening/${realForeningId}/images`)} className="bg-white rounded-[24px] p-4 shadow-sm cursor-pointer hover:shadow-md transition-shadow">
          <div className="flex justify-between items-center mb-3">
            <div className="bg-[#131921] text-white px-4 py-1.5 rounded-full font-black text-sm tracking-wider inline-block">BILLEDER</div>
            <button className="text-xs font-bold text-gray-500 hover:text-black">Se alle</button>
          </div>
          {images.length === 0 ? <p className="text-sm text-gray-400">Ingen billeder endnu.</p> : (
            <div className="flex gap-2 mt-2 overflow-x-auto pb-2 scrollbar-hide md:flex-wrap md:overflow-visible">
              {images.map((img, index) => {
                const src = getEventImageUrl(img.image_url);
                return (
                  <div key={img.id} className={`w-24 h-24 flex-shrink-0 rounded-[14px] overflow-hidden bg-gray-100 relative ${index >= 4 ? 'hidden md:block' : ''}`}>
                    {src ? <img src={src} alt="" className="w-full h-full object-cover" /> : <div className="w-full h-full flex items-center justify-center text-gray-300 font-bold">?</div>}
                  </div>
                );
              })}
            </div>
          )}
        </div>

        <div className="bg-white rounded-[24px] p-4 shadow-sm space-y-3 mb-10">
           {isMember && <button onClick={handleLeave} className="w-full py-3 bg-gray-200 text-gray-600 rounded-full font-bold hover:bg-gray-300 transition-colors">Afslut medlemskab</button>}
           {isOwner && (
             <>
               <button onClick={triggerImageSelect} disabled={uploading} className="w-full py-3 bg-[#131921] text-white rounded-full font-bold hover:bg-gray-900 transition-colors disabled:opacity-50">{uploading ? "Uploader..." : "Upload foreningsbillede"}</button>
               <button onClick={handleDeleteForening} className="w-full py-3 bg-red-100 text-red-600 rounded-full font-bold hover:bg-red-200 transition-colors">Slet forening</button>
             </>
           )}
        </div>

      </main>
      <SiteFooter />

      {showMembers && (
        <div className="fixed inset-0 z-[200] flex items-center justify-center p-4 bg-black/80 backdrop-blur-sm animate-in fade-in duration-200">
          <div className="bg-white w-full max-w-md rounded-[24px] shadow-2xl p-5 relative">
            <button onClick={() => setShowMembers(false)} className="absolute top-4 right-4 text-gray-400 hover:text-black text-xl">✕</button>
            {selectedMember ? (
              <div className="flex flex-col items-center pt-4">
                <div className="w-32 h-32 rounded-[20px] bg-gray-100 overflow-hidden mb-4 relative">
                  {(() => {
                    const src = getAvatarUrl(selectedMember.users?.avatar_url);
                    return src ? <img src={src} className="w-full h-full object-cover" /> : <div className="w-full h-full bg-gray-200 flex items-center justify-center text-4xl">?</div>;
                  })()}
                </div>
                <h3 className="text-xl font-bold text-[#131921]">{getDisplayName(selectedMember)}</h3>
                <p className="text-[10px] uppercase font-bold text-[#131921] mb-1">{selectedMember.rolle || 'MEDLEM'}</p>
                <p className="text-sm text-gray-500 mb-6 font-bold">{selectedMember.users?.email}</p> 
                <button onClick={() => router.push(`/beskeder?dmUser=${selectedMember.user_id}`)} className="w-full py-3 bg-[#131921] text-white rounded-full font-bold mb-3 hover:bg-gray-900 transition-colors">Skriv til medlem</button>
                {isMeAdmin && selectedMember.rolle !== 'admin' && <button onClick={() => promoteToAdmin(selectedMember.user_id)} className="w-full py-3 bg-blue-100 text-blue-700 rounded-full font-bold mb-3 hover:bg-blue-200 transition-colors">Gør til admin</button>}
                <button onClick={() => setSelectedMember(null)} className="text-sm font-bold text-gray-400 hover:text-black mt-2">← Tilbage til liste</button>
              </div>
            ) : (
              <div className="max-h-[60vh] overflow-y-auto">
                <h3 className="font-black text-[#131921] mb-4">MEDLEMMER ({approved.length})</h3>
                
                {/* Godkendte medlemmer */}
                {approved.map(m => {
                  const avatarSrc = getAvatarUrl(m.users?.avatar_url);
                  return (
                    <div key={m.user_id} onClick={() => setSelectedMember(m)} className="flex items-center gap-3 p-2 hover:bg-gray-50 rounded-xl cursor-pointer">
                      <div className="w-10 h-10 rounded-[10px] bg-gray-100 overflow-hidden">{avatarSrc ? <img src={avatarSrc} className="w-full h-full object-cover" /> : null}</div>
                      <div><p className="font-bold text-sm">{getDisplayName(m)}</p><p className="text-[10px] text-gray-500 uppercase font-bold text-[#131921]">{m.rolle || 'MEDLEM'}</p></div>
                    </div>
                  );
                })}

                {/* ✅ PENDING MEDLEMMER (Hvis der er nogen) */}
                {pending.length > 0 && (
                  <>
                    <h3 className="font-black text-[#131921] mt-6 mb-2 text-sm uppercase">Afventer svar ({pending.length})</h3>
                    {pending.map(m => {
                      const avatarSrc = getAvatarUrl(m.users?.avatar_url);
                      return (
                        <div key={m.user_id} className="flex items-center gap-3 p-2 rounded-xl opacity-60 grayscale">
                          <div className="w-10 h-10 rounded-[10px] bg-gray-100 overflow-hidden relative">
                             {avatarSrc ? <img src={avatarSrc} className="w-full h-full object-cover" /> : null}
                          </div>
                          <div>
                             <p className="font-bold text-sm text-gray-600">{getDisplayName(m)}</p>
                             <span className="bg-yellow-100 text-yellow-800 text-[9px] font-black px-2 py-0.5 rounded-full uppercase tracking-wide border border-yellow-200">
                               Inviteret
                             </span>
                          </div>
                        </div>
                      );
                    })}
                  </>
                )}

              </div>
            )}
          </div>
        </div>
      )}

      {/* ✅ DETALJERET EVENT MODAL */}
      {selectedDateEvents && (
        <div className="fixed inset-0 z-[200] flex items-center justify-center p-4 bg-black/80 backdrop-blur-sm animate-in fade-in duration-200">
          <div className="bg-white w-full max-w-xl rounded-[24px] shadow-2xl relative overflow-hidden max-h-[85vh] overflow-y-auto">
            <button onClick={() => setSelectedDateEvents(null)} className="absolute top-4 right-4 z-10 w-8 h-8 flex items-center justify-center bg-white/80 rounded-full text-black hover:bg-white shadow-sm">✕</button>
            
            <div className="p-6">
              <h3 className="font-black text-[#131921] text-2xl mb-1 capitalize border-b border-gray-100 pb-4">
                {new Date(selectedDateEvents.date).toLocaleDateString("da-DK", { weekday: 'long', day: 'numeric', month: 'long' })}
              </h3>
              
              <div className="space-y-6 mt-6">
                {selectedDateEvents.events.map(e => (
                  <div key={e.id} className="flex flex-col gap-3">
                    
                    {e.image_url && (
                      <div className="w-full aspect-video rounded-2xl overflow-hidden bg-gray-100 relative shadow-sm">
                        {/* eslint-disable-next-line @next/next/no-img-element */}
                        <img src={getEventImageUrl(e.image_url) || ""} alt="" className="w-full h-full object-cover" />
                      </div>
                    )}

                    <div>
                      <div className="flex justify-between items-start">
                        <h4 className="font-bold text-[#131921] text-xl">{e.title}</h4>
                        {e.price && e.price > 0 && <span className="bg-green-100 text-green-800 text-xs font-bold px-2 py-1 rounded-full">{e.price} kr.</span>}
                      </div>
                      
                      <div className="flex gap-4 mt-2 mb-3">
                        <p className="text-sm font-bold text-[#131921] bg-gray-100 px-3 py-1 rounded-lg flex items-center gap-2">
                          <i className="fa-regular fa-clock"></i> 
                          {fmtTime(e.start_at)} {e.end_at ? `- ${fmtTime(e.end_at)}` : ''}
                        </p>
                        {e.location && (
                          <p className="text-sm font-bold text-gray-500 bg-gray-50 px-3 py-1 rounded-lg flex items-center gap-2">
                            <i className="fa-solid fa-location-dot"></i> {e.location}
                          </p>
                        )}
                      </div>

                      {e.description && (
                        <p className="text-sm text-gray-600 leading-relaxed whitespace-pre-wrap">{e.description}</p>
                      )}
                    </div>
                  </div>
                ))}
              </div>
            </div>
          </div>
        </div>
      )}

      {/* ✅ NY INVITE MODAL - RETTET */}
      {showInviteModal && (
        <div className="fixed inset-0 z-[200] flex items-center justify-center p-4 bg-black/80 backdrop-blur-sm animate-in fade-in duration-200">
          <div className="bg-white w-full max-w-md rounded-[24px] shadow-2xl p-5 relative">
            <button onClick={() => setShowInviteModal(false)} className="absolute top-4 right-4 text-gray-400 hover:text-black text-xl">✕</button>
            <h3 className="text-xl font-bold text-[#131921] mb-4">Inviter bruger</h3>
            <div className="mb-4">
              <input
                type="text"
                className="w-full bg-gray-50 border border-gray-200 rounded-xl px-4 py-3 outline-none text-black placeholder-gray-500 font-medium"
                placeholder="Søg på navn eller brugernavn..."
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
              />
              
              <textarea
                className="w-full bg-gray-50 border border-gray-200 rounded-xl px-4 py-3 mt-3 h-24 outline-none text-black placeholder-gray-500 resize-none font-medium text-sm"
                placeholder="Personlig besked (valgfri)"
                value={inviteMessage}
                onChange={(e) => setInviteMessage(e.target.value)}
              />
            </div>
            
            <div className="max-h-[50vh] overflow-y-auto">
                {isSearching ? (
                    <div className="text-center text-gray-500 py-4">Søger...</div>
                ) : searchResults.length > 0 ? (
                    searchResults.map(user => (
                        <div key={user.id} className="flex items-center justify-between p-2 hover:bg-gray-50 rounded-xl">
                            <div className="flex items-center gap-3">
                                <div className="w-10 h-10 rounded-[10px] bg-gray-100 overflow-hidden">
                                    {getAvatarUrl(user.avatar_url) ? <img src={getAvatarUrl(user.avatar_url) || ""} className="w-full h-full object-cover" /> : null}
                                </div>
                                <div>
                                    <p className="font-bold text-sm text-gray-900">{user.name}</p>
                                    <p className="text-[10px] text-gray-500 uppercase">{user.username}</p>
                                </div>
                            </div>
                            <button 
                                onClick={() => inviteUser(user.id)}
                                className="px-3 py-1.5 bg-[#131921] text-white text-xs font-bold rounded-lg hover:bg-gray-900"
                            >
                                Inviter
                            </button>
                        </div>
                    ))
                ) : searchQuery.length >= 2 ? (
                    <div className="text-center text-gray-500 py-4">Ingen brugere fundet.</div>
                ) : null}
            </div>
          </div>
        </div>
      )}

    </div>
  );
}