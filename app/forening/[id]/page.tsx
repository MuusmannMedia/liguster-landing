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

const makeUuid = () => {
  return 'xxxxxxxx-xxxx-4xxx-yxxx-xxxxxxxxxxxx'.replace(/[xy]/g, (c) => {
    const r = (Math.random() * 16) | 0;
    const v = c === 'x' ? r : (r & 0x3) | 0x8;
    return v.toString(16);
  });
};

const fmtDate = (d: any) => new Date(d).toLocaleDateString("da-DK", { day: 'numeric', month: 'long' });

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

  const [showMembers, setShowMembers] = useState(false);
  const [selectedMember, setSelectedMember] = useState<Medlem | null>(null);

  const [showFirstMessageModal, setShowFirstMessageModal] = useState(false);
  const [firstMessageText, setFirstMessageText] = useState("");
  const [isSendingFirstMessage, setIsSendingFirstMessage] = useState(false);
  
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
        if (error || !foreningData) { setForening(null); setLoading(false); return; }
        setForening(foreningData);
        setRealForeningId(foreningData.id);
        setEditNavn(foreningData.navn || "");
        setEditSted(foreningData.sted || "");
        setEditDescription(foreningData.beskrivelse || "");
        setEditIsPublic(foreningData.is_public || false);
        
        const fId = foreningData.id;
        const [res1, res2, res3, res4] = await Promise.all([
          supabase.from("foreningsmedlemmer").select("user_id, rolle, status, users:users!foreningsmedlemmer_user_id_fkey (name, username, avatar_url, email)").eq("forening_id", fId),
          supabase.from("forening_threads").select("*").eq("forening_id", fId).order("created_at", { ascending: false }).limit(3),
          supabase.from("forening_events").select("*").eq("forening_id", fId).order("start_at", { ascending: false }).limit(3),
          supabase.from("forening_events").select("id, title, start_at, end_at, location, price, description, image_url").eq("forening_id", fId)
        ]);

        const { data: imgData } = await supabase.from("event_images").select("id, image_url").in("event_id", (res4.data || []).map(e => e.id)).order("created_at", { ascending: false }).limit(8);
        
        if (res1.data) setMedlemmer(res1.data as unknown as Medlem[]);
        if (res2.data) setThreads(res2.data);
        if (res3.data) setEvents(res3.data);
        if (res4.data) setCalendarEvents(res4.data);
        if (imgData) setImages(imgData);
        setLoading(false);
      } catch (err) { setLoading(false); }
    }
    loadAllData();
  }, [idOrSlug, router]);

  const handleImageUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    if (!e.target.files || !realForeningId) return;
    const file = e.target.files[0];
    setUploading(true);
    const fileName = `${realForeningId}_${Date.now()}`;
    const { error: uploadError } = await supabase.storage.from('foreningsbilleder').upload(fileName, file);
    if (!uploadError) {
      const { data } = supabase.storage.from('foreningsbilleder').getPublicUrl(fileName);
      await supabase.from('foreninger').update({ billede_url: data.publicUrl }).eq('id', realForeningId);
      window.location.reload();
    }
    setUploading(false);
  };

  const handleOpenMessageModal = (member: Medlem) => {
    setSelectedMember(member);
    setShowFirstMessageModal(true);
  };

  const handleSendFirstMessage = async () => {
    if (!userId || !selectedMember || !firstMessageText.trim()) return;
    setIsSendingFirstMessage(true);
    const targetUserId = selectedMember.user_id;
    try {
      const { data: existingThread } = await supabase.from('messages').select('thread_id').or(`and(sender_id.eq.${userId},receiver_id.eq.${targetUserId}),and(sender_id.eq.${targetUserId},receiver_id.eq.${userId})`).limit(1).maybeSingle();
      const threadIdToUse = existingThread?.thread_id || makeUuid();
      const { error: sendErr } = await supabase.from('messages').insert([{ thread_id: threadIdToUse, sender_id: userId, receiver_id: targetUserId, text: firstMessageText.trim(), is_read: false }]);
      if (sendErr) throw sendErr;
      router.push(`/beskeder?id=${threadIdToUse}&dmUser=${targetUserId}`);
    } catch (err) { alert("Kunne ikke sende besked."); } finally { setIsSendingFirstMessage(false); }
  };

  const handleSaveInfo = async () => {
    if (!realForeningId) return;
    const { error } = await supabase.from('foreninger').update({ navn: editNavn, sted: editSted, beskrivelse: editDescription }).eq('id', realForeningId);
    if (!error) { setForening(prev => prev ? { ...prev, navn: editNavn, sted: editSted, beskrivelse: editDescription } : null); setIsEditing(false); }
  };

  const handleJoin = async () => {
    if (!userId || !realForeningId) { router.push('/opret'); return; }
    await supabase.from('foreningsmedlemmer').insert([{ forening_id: realForeningId, user_id: userId, rolle: 'medlem', status: 'pending' }]);
    window.location.reload();
  };

  const handleLeave = async () => {
    if (!userId || !realForeningId || !confirm("Er du sikker?")) return;
    await supabase.from('foreningsmedlemmer').delete().eq('forening_id', realForeningId).eq('user_id', userId);
    window.location.reload();
  };

  const handleDeleteForening = async () => {
    if (!realForeningId || !confirm("Er du sikker?")) return;
    await supabase.from('foreninger').delete().eq('id', realForeningId);
    router.push('/opslag');
  };

  const promoteToAdmin = async (targetUserId: string) => {
    if (!realForeningId || !confirm("Er du sikker?")) return;
    await supabase.from('foreningsmedlemmer').update({ rolle: 'admin' }).eq('forening_id', realForeningId).eq('user_id', targetUserId);
    window.location.reload();
  };

  const approved = medlemmer.filter(m => m.status === "approved");
  const myMembership = medlemmer.find(m => m.user_id === userId);
  const isApprovedMember = myMembership?.status === "approved";
  const isPending = myMembership?.status === "pending";
  const isOwner = forening?.oprettet_af === userId;
  const isMeAdmin = isOwner || myMembership?.rolle === 'admin'; 

  if (loading) return <div className="min-h-screen bg-[#869FB9] flex items-center justify-center font-black text-white">Indlæser...</div>;
  if (!forening) return <div className="min-h-screen bg-[#869FB9] p-10 text-center text-white">Forening ikke fundet</div>;

  return (
    <div className="min-h-screen flex flex-col bg-[#869FB9]">
      <SiteHeader />
      <main className="flex-1 w-full max-w-4xl mx-auto p-4 pb-20 space-y-6">
        <input type="file" accept="image/*" ref={fileInputRef} className="hidden" onChange={handleImageUpload} />

        {/* HERO KORT - ALTID SYNLIGT FOR ALLE */}
        <div className="bg-white rounded-[24px] p-5 shadow-md mt-6 flex flex-col gap-4">
          <div className="relative w-full aspect-square rounded-[18px] overflow-hidden bg-gray-100">
            {forening.billede_url ? <img src={forening.billede_url} className="w-full h-full object-cover" alt="Cover" /> : <div className="w-full h-full flex items-center justify-center text-gray-400 font-bold">Ingen forside</div>}
            {uploading && <div className="absolute inset-0 bg-black/50 flex items-center justify-center text-white font-black">Uploader...</div>}
          </div>
          <div className="w-full">
            {isEditing ? (
              <div className="flex flex-col gap-3">
                <input value={editNavn} onChange={(e) => setEditNavn(e.target.value)} className="w-full p-3 border rounded-xl text-black font-black" />
                <textarea value={editDescription} onChange={(e) => setEditDescription(e.target.value)} className="w-full min-h-[120px] p-3 border rounded-xl text-black" />
                <div className="flex gap-2 justify-end pt-2">
                  <button onClick={() => setIsEditing(false)} className="px-4 py-2 bg-gray-100 rounded-full text-xs font-bold text-gray-700">ANNULLER</button>
                  <button onClick={handleSaveInfo} className="px-4 py-2 bg-[#131921] text-white rounded-full text-xs font-bold">GEM</button>
                </div>
              </div>
            ) : (
              <div className="flex flex-col gap-1">
                <h1 className="text-2xl font-black text-[#131921] underline decoration-gray-300">{forening.navn}</h1>
                <p className="text-gray-700 font-bold mb-3">{forening.sted}</p>
                <p className="text-[#444] text-sm whitespace-pre-wrap">{forening.beskrivelse}</p>
                
                {/* ADMINISTRATIVE KNAPPER - KUN FOR ADMINS/GODKENDTE */}
                {isApprovedMember && (
                  <div className="flex flex-wrap gap-2 mt-4">
                    <button onClick={() => navigator.clipboard.writeText(window.location.href)} className="px-4 py-2 bg-gray-100 text-black text-xs font-bold rounded-full uppercase">Kopiér link</button>
                    <button className="px-4 py-2 bg-gray-100 text-black text-xs font-bold rounded-full uppercase">Del</button>
                    {isMeAdmin && (
                      <>
                        <button onClick={() => setIsEditing(true)} className="px-4 py-2 bg-gray-100 text-black text-xs font-bold rounded-full uppercase">Rediger tekst</button>
                        <button className="px-4 py-2 bg-gray-100 text-black text-xs font-bold rounded-full uppercase">Inviter</button>
                      </>
                    )}
                  </div>
                )}
              </div>
            )}
          </div>

          {/* BLIV MEDLEM BJÆLKE - SYNLIG HVIS MAN IKKE ER GODKENDT ELLER PENDING */}
          {!isApprovedMember && (
            isPending ? (
              <div className="w-full py-3 bg-gray-400 text-white rounded-full font-bold text-center">Anmodning sendt - afventer godkendelse</div>
            ) : (
              <button onClick={handleJoin} className="w-full py-3 bg-[#131921] text-white rounded-full font-bold">Bliv medlem</button>
            )
          )}
        </div>

        {/* --- ALT HERUNDER SKJULES HVIS MAN IKKE ER GODKENDT MEDLEM --- */}
        {isApprovedMember && (
          <>
            <button onClick={() => router.push(`/beskeder?id=${realForeningId}`)} className="w-full bg-white p-4 rounded-[24px] shadow-sm flex items-center hover:bg-gray-50 transition-colors">
               <div className="bg-[#131921] text-white px-4 py-2 rounded-full font-black text-sm tracking-wider">BESKEDER</div>
            </button>

            <div className="bg-white rounded-[24px] p-4 shadow-sm relative">
              <div className="flex justify-between items-center mb-3 px-2">
                <h3 className="font-black text-[#131921]">MEDLEMMER</h3>
                <button onClick={() => setShowMembers(true)} className="text-xs font-bold text-gray-500">Se alle</button>
              </div>
              <div className="flex gap-4 overflow-x-auto pb-2 px-2 scrollbar-hide">
                {approved.map(m => (
                  <div key={m.user_id} className="flex flex-col items-center min-w-[64px] cursor-pointer" onClick={() => { setSelectedMember(m); setShowMembers(true); }}>
                    <div className="w-14 h-14 rounded-[14px] bg-gray-100 overflow-hidden mb-1">
                      {getAvatarUrl(m.users?.avatar_url) ? <img src={getAvatarUrl(m.users?.avatar_url)!} className="w-full h-full object-cover" /> : <div className="w-full h-full flex items-center justify-center font-bold text-gray-400">?</div>}
                    </div>
                    <span className="text-xs font-bold text-black truncate w-16 text-center">{getDisplayName(m)}</span>
                  </div>
                ))}
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

            <div className="bg-white rounded-[24px] p-4 shadow-sm">
              <div className="bg-[#131921] text-white px-4 py-1.5 rounded-full font-black text-sm tracking-wider inline-block mb-3">KALENDER</div>
              <div className="flex items-center justify-between mb-4 px-2">
                <button onClick={(e) => { e.stopPropagation(); setMonthCursor(prev => new Date(prev.getFullYear(), prev.getMonth() - 1, 1)); }} className="w-10 h-10 flex items-center justify-center rounded-full bg-white hover:bg-gray-100 text-[#131921] text-lg font-bold border-2 border-gray-200">❮</button>
                <h3 className="font-black text-[#131921] text-xl capitalize">{monthCursor.toLocaleDateString("da-DK", { month: 'long', year: 'numeric' })}</h3>
                <button onClick={(e) => { e.stopPropagation(); setMonthCursor(prev => new Date(prev.getFullYear(), prev.getMonth() + 1, 1)); }} className="w-10 h-10 flex items-center justify-center rounded-full bg-white hover:bg-gray-100 text-[#131921] text-lg font-bold border-2 border-gray-200">❯</button>
              </div>
              <div className="grid grid-cols-7 gap-1.5">
                {buildMonthGrid(monthCursor).map((week) => week.map((day, idx) => (
                  <div key={idx} className={`aspect-square flex items-center justify-center rounded-xl text-sm ${day.getMonth() !== monthCursor.getMonth() ? 'text-gray-300' : 'text-gray-800'}`}>
                    {day.getDate()}
                  </div>
                )))}
              </div>
            </div>

            <div onClick={() => router.push(`/forening/${realForeningId}/images`)} className="bg-white rounded-[24px] p-4 shadow-sm cursor-pointer hover:shadow-md transition-shadow">
              <div className="bg-[#131921] text-white px-4 py-1.5 rounded-full font-black text-sm tracking-wider inline-block mb-3">BILLEDER</div>
              <div className="flex gap-2 overflow-x-auto pb-2">
                {images.length === 0 ? <p className="text-sm text-gray-400">Ingen billeder endnu.</p> : images.map(img => (
                  <div key={img.id} className="w-20 h-20 rounded-xl overflow-hidden bg-gray-100 flex-shrink-0">
                    <img src={getEventImageUrl(img.image_url)} className="w-full h-full object-cover" alt="Event" />
                  </div>
                ))}
              </div>
            </div>

            <div className="bg-white rounded-[24px] p-4 shadow-sm flex flex-col md:flex-row gap-3 mb-10">
               <button onClick={handleLeave} className="flex-1 py-3 bg-gray-100 text-gray-600 rounded-full font-bold hover:bg-gray-200 transition-colors">Afslut medlemskab</button>
               {isMeAdmin && <button onClick={() => fileInputRef.current?.click()} className="flex-1 py-3 bg-[#e9eef5] text-[#131921] rounded-full font-bold hover:bg-[#d0dbe9] transition-colors">Skift billede</button>}
               {isOwner && <button onClick={handleDeleteForening} className="flex-1 py-3 bg-red-100 text-red-600 rounded-full font-bold hover:bg-red-200 transition-colors">Slet forening</button>}
            </div>
          </>
        )}
      </main>

      {/* MODALER - KUN TILGÆNGELIGE FOR GODKENDTE MEDLEMMER */}
      {isApprovedMember && (
        <>
          {showFirstMessageModal && selectedMember && (
            <div className="fixed inset-0 z-[300] flex items-center justify-center p-4 bg-black/80 backdrop-blur-sm animate-in fade-in duration-200">
              <div className="bg-white w-full max-w-md rounded-[24px] shadow-2xl p-6 relative">
                <button onClick={() => setShowFirstMessageModal(false)} className="absolute top-4 right-4 text-gray-400 text-xl font-black">✕</button>
                <div className="text-center mb-6">
                   <div className="w-20 h-20 rounded-full bg-gray-100 overflow-hidden mx-auto mb-3">
                      {getAvatarUrl(selectedMember.users?.avatar_url) ? <img src={getAvatarUrl(selectedMember.users?.avatar_url)!} className="w-full h-full object-cover" /> : <div className="w-full h-full bg-gray-200 flex items-center justify-center text-2xl font-black">?</div>}
                   </div>
                   <h3 className="text-xl font-bold text-[#131921]">Skriv til {getDisplayName(selectedMember)}</h3>
                </div>
                <textarea value={firstMessageText} onChange={(e) => setFirstMessageText(e.target.value)} placeholder="Skriv din første besked her..." className="w-full h-32 p-4 bg-gray-50 border border-gray-100 rounded-2xl outline-none focus:ring-2 focus:ring-[#131921] transition-all font-medium text-black" />
                <button onClick={handleSendFirstMessage} disabled={isSendingFirstMessage || !firstMessageText.trim()} className="w-full py-4 mt-4 bg-[#131921] text-white rounded-full font-black shadow-lg hover:bg-black transition-all active:scale-95 disabled:opacity-50">{isSendingFirstMessage ? 'Sender...' : 'Send besked'}</button>
              </div>
            </div>
          )}

          {showMembers && (
            <div className="fixed inset-0 z-[200] flex items-center justify-center p-4 bg-black/80 backdrop-blur-sm animate-in fade-in duration-200">
              <div className="bg-white w-full max-w-md rounded-[24px] shadow-2xl p-5 relative max-h-[80vh] overflow-y-auto">
                <button onClick={() => setShowMembers(false)} className="absolute top-4 right-4 text-gray-400 text-xl font-black">✕</button>
                {selectedMember && !showFirstMessageModal ? (
                  <div className="flex flex-col items-center pt-4">
                    <div className="w-24 h-24 rounded-2xl bg-gray-100 overflow-hidden mb-4">
                       {getAvatarUrl(selectedMember.users?.avatar_url) ? <img src={getAvatarUrl(selectedMember.users?.avatar_url)!} className="w-full h-full object-cover" /> : <div className="w-full h-full bg-gray-200 flex items-center justify-center text-3xl font-black">?</div>}
                    </div>
                    <h3 className="text-xl font-bold text-[#131921]">{getDisplayName(selectedMember)}</h3>
                    <p className="text-xs uppercase font-bold text-gray-400 mb-6">{selectedMember.rolle || 'MEDLEM'}</p>
                    <button onClick={() => handleOpenMessageModal(selectedMember)} className="w-full py-3 bg-[#131921] text-white rounded-full font-bold mb-3 shadow-lg hover:bg-gray-900 transition-colors">Skriv til medlem</button>
                    {isMeAdmin && selectedMember.rolle !== 'admin' && <button onClick={() => promoteToAdmin(selectedMember.user_id)} className="w-full py-3 bg-blue-100 text-blue-700 rounded-full font-bold mb-3 hover:bg-blue-200 transition-colors">Gør til admin</button>}
                    <button onClick={() => setSelectedMember(null)} className="text-sm font-bold text-gray-400 mt-2 hover:text-black">← Tilbage</button>
                  </div>
                ) : (
                  <div>
                    <h3 className="font-black text-[#131921] mb-4 uppercase tracking-widest text-sm">MEDLEMMER ({approved.length})</h3>
                    <div className="space-y-2">
                      {approved.map(m => (
                        <div key={m.user_id} onClick={() => setSelectedMember(m)} className="flex items-center gap-3 p-2 hover:bg-gray-50 rounded-xl cursor-pointer transition-colors">
                          <div className="w-10 h-10 rounded-[10px] bg-gray-100 overflow-hidden">{getAvatarUrl(m.users?.avatar_url) ? <img src={getAvatarUrl(m.users?.avatar_url)!} className="w-full h-full object-cover" /> : null}</div>
                          <div><p className="font-bold text-sm text-black">{getDisplayName(m)}</p><p className="text-[10px] text-gray-400 font-bold uppercase">{m.rolle || 'MEDLEM'}</p></div>
                        </div>
                      ))}
                    </div>
                  </div>
                )}
              </div>
            </div>
          )}
        </>
      )}
      <SiteFooter />
    </div>
  );
}