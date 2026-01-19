'use client';

import { useEffect, useMemo, useRef, useState } from 'react';
import { useParams, useRouter } from 'next/navigation';
import { supabase } from '../../../lib/supabaseClient';
import SiteHeader from '../../../components/SiteHeader';
import SiteFooter from '../../../components/SiteFooter';

// --- TYPER ---
// ... (Samme typer som før) ...
type Forening = {
  id: string;
  navn: string;
  sted: string;
  beskrivelse: string;
  billede_url?: string;
  images?: string[];
  oprettet_af?: string;
  slug?: string;
  is_public?: boolean;
};

// ... (Resten af typerne er uændrede) ...
type Medlem = {
  user_id: string;
  rolle?: string | null;
  status?: 'pending' | 'approved' | 'declined' | null;
  users?: {
    id?: string | null;
    name?: string | null;
    username?: string | null;
    avatar_url?: string | null;
    email?: string | null;
  } | null;
};

type Thread = { id: string; title: string; created_at: string; created_by: string };
type Event = { id: string; title: string; start_at: string; end_at: string; location?: string; price?: number; description?: string; image_url?: string; };
type ImagePreview = { id: number; image_url: string };
type UserSearchResult = { id: string; name: string | null; username: string | null; avatar_url: string | null; email: string | null; };
type ConfirmModalState = { isOpen: boolean; title: string; message: string; actionType: 'leave' | 'delete'; isLoading: boolean; };

// --- HJÆLPERE ---
// ... (Samme hjælpere som før) ...
const getDisplayName = (m: any) => { const user = m?.users || m; const n = user?.name?.trim() || user?.username?.trim(); if (n) return n; const email = user?.email || ''; return email.includes('@') ? email.split('@')[0] : 'Ukendt'; };
const getAvatarUrl = (path: string | null | undefined) => { if (!path) return null; if (path.startsWith('http')) return path; const { data } = supabase.storage.from('avatars').getPublicUrl(path); return data.publicUrl; };
const getEventImageUrl = (path: string | null | undefined) => { if (!path) return ''; if (path.startsWith('http')) return path; const { data } = supabase.storage.from('event_images').getPublicUrl(path); return data.publicUrl; };
const makeUuid = () => { return 'xxxxxxxx-xxxx-4xxx-yxxx-xxxxxxxxxxxx'.replace(/[xy]/g, (c) => { const r = (Math.random() * 16) | 0; const v = c === 'x' ? r : (r & 0x3) | 0x8; return v.toString(16); }); };
const fmtDate = (d: any) => new Date(d).toLocaleDateString('da-DK', { day: 'numeric', month: 'long' });
const fmtTime = (d: any) => new Date(d).toLocaleTimeString('da-DK', { hour: '2-digit', minute: '2-digit' });
const startOfMonth = (d: Date) => new Date(d.getFullYear(), d.getMonth(), 1);
const endOfMonth = (d: Date) => new Date(d.getFullYear(), d.getMonth() + 1, 0);
const pad = (n: number) => (n < 10 ? `0${n}` : `${n}`);
const toKey = (d: Date) => `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`;
const buildMonthGrid = (base: Date) => { const first = startOfMonth(base); const last = endOfMonth(base); const firstWeekday = (first.getDay() + 6) % 7; const daysInMonth = last.getDate(); const cells: Date[] = []; for (let i = 0; i < firstWeekday; i++) { const d = new Date(first); d.setDate(first.getDate() - (firstWeekday - i)); cells.push(d); } for (let d = 1; d <= daysInMonth; d++) cells.push(new Date(base.getFullYear(), base.getMonth(), d)); while (cells.length < 42) { const lastCell = cells[cells.length - 1]; const next = new Date(lastCell); next.setDate(lastCell.getDate() + 1); cells.push(next); } const weeks: Date[][] = []; for (let i = 0; i < 6; i++) weeks.push(cells.slice(i * 7, i * 7 + 7)); return weeks; };
const dayColorClass = (hasEvents: boolean) => (hasEvents ? 'bg-[#131921] text-white' : '');

export default function ForeningDetaljePage() {
  const params = useParams();
  const router = useRouter();
  const idOrSlug = params.id as string;

  // States
  const [realForeningId, setRealForeningId] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);
  const [forening, setForening] = useState<Forening | null>(null);
  const [medlemmer, setMedlemmer] = useState<Medlem[]>([]);
  const [userId, setUserId] = useState<string | null>(null);
  const [uploading, setUploading] = useState(false);

  // Edit States
  const [isEditing, setIsEditing] = useState(false);
  const [editNavn, setEditNavn] = useState('');
  const [editSted, setEditSted] = useState('');
  const [editDescription, setEditDescription] = useState('');

  // Hero Image States
  const [heroImages, setHeroImages] = useState<string[]>([]);
  const [activeHeroIndex, setActiveHeroIndex] = useState(0);
  const [lightboxOpen, setLightboxOpen] = useState(false); // Ny state til lightbox

  const fileInputRef = useRef<HTMLInputElement>(null);

  // Data Arrays
  const [threads, setThreads] = useState<Thread[]>([]);
  const [events, setEvents] = useState<Event[]>([]);
  const [images, setImages] = useState<ImagePreview[]>([]);
  const [calendarEvents, setCalendarEvents] = useState<Event[]>([]);

  // UI / Modal States
  const [monthCursor, setMonthCursor] = useState(new Date());
  const [showMembers, setShowMembers] = useState(false);
  const [selectedMember, setSelectedMember] = useState<Medlem | null>(null);
  const [showFirstMessageModal, setShowFirstMessageModal] = useState(false);
  const [firstMessageText, setFirstMessageText] = useState('');
  const [isSendingFirstMessage, setIsSendingFirstMessage] = useState(false);
  const [selectedDayKey, setSelectedDayKey] = useState<string | null>(null);
  const [descExpanded, setDescExpanded] = useState(false);

  // Invite modal
  const [showInviteModal, setShowInviteModal] = useState(false);
  const [inviteQuery, setInviteQuery] = useState('');
  const [inviteLoading, setInviteLoading] = useState(false);
  const [inviteResults, setInviteResults] = useState<UserSearchResult[]>([]);
  const [inviteInfo, setInviteInfo] = useState<string | null>(null);

  // Confirm Modal
  const [confirmModal, setConfirmModal] = useState<ConfirmModalState>({
    isOpen: false, title: '', message: '', actionType: 'leave', isLoading: false,
  });

  // --- LOAD DATA ---
  useEffect(() => {
    async function loadAllData() {
      setLoading(true);
      try {
        const { data: { session } } = await supabase.auth.getSession();
        setUserId(session?.user?.id || null);

        if (!idOrSlug) return;
        const isUuid = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(idOrSlug);
        let query = supabase.from('foreninger').select('*');
        if (isUuid) query = query.eq('id', idOrSlug);
        else query = query.eq('slug', idOrSlug);

        const { data: foreningData } = await query.single();
        if (!foreningData) { setForening(null); setLoading(false); return; }

        setForening(foreningData);
        setRealForeningId(foreningData.id);
        setEditNavn(foreningData.navn || '');
        setEditSted(foreningData.sted || '');
        setEditDescription(foreningData.beskrivelse || '');

        // Indlæs billeder: Bruger 'images' array hvis det findes, ellers fallback til 'billede_url'
        const imgs = foreningData.images && Array.isArray(foreningData.images) && foreningData.images.length > 0 
          ? foreningData.images 
          : foreningData.billede_url ? [foreningData.billede_url] : [];
        setHeroImages(imgs);

        const fId = foreningData.id;
        const [res1, res2, res3, res4] = await Promise.all([
          supabase.from('foreningsmedlemmer').select('user_id, rolle, status, users:users!foreningsmedlemmer_user_id_fkey (id, name, username, avatar_url, email)').eq('forening_id', fId),
          supabase.from('forening_threads').select('*').eq('forening_id', fId).order('created_at', { ascending: false }).limit(3),
          supabase.from('forening_events').select('*').eq('forening_id', fId).order('start_at', { ascending: false }).limit(3),
          supabase.from('forening_events').select('id, title, start_at, end_at, location, price, description, image_url').eq('forening_id', fId),
        ]);

        const eventIds = (res4.data || []).map((e: any) => e.id);
        if (eventIds.length > 0) {
          const imgRes = await supabase.from('event_images').select('id, image_url').in('event_id', eventIds).order('created_at', { ascending: false }).limit(9);
          if (imgRes.data) setImages(imgRes.data as any);
        }

        if (res1.data) setMedlemmer(res1.data as unknown as Medlem[]);
        if (res2.data) setThreads(res2.data);
        if (res3.data) setEvents(res3.data);
        if (res4.data) setCalendarEvents(res4.data as any);

        setLoading(false);
      } catch { setLoading(false); }
    }
    loadAllData();
  }, [idOrSlug, router]);

  // --- MEMOS ---
  const approved = useMemo(() => medlemmer.filter((m) => m.status === 'approved'), [medlemmer]);
  const myMembership = useMemo(() => medlemmer.find((m) => m.user_id === userId), [medlemmer, userId]);
  const isApprovedMember = myMembership?.status === 'approved';
  const isPending = myMembership?.status === 'pending';
  const isOwner = forening?.oprettet_af === userId;
  const isMeAdmin = isOwner || myMembership?.rolle === 'admin';
  const memberIdSet = useMemo(() => new Set(medlemmer.map((m) => m.user_id)), [medlemmer]);

  // --- CALENDAR LOGIC ---
  const eventsByDate = useMemo(() => {
    const map = new Map<string, Event[]>();
    for (const e of calendarEvents) {
      const key = toKey(new Date(e.start_at));
      map.set(key, [...(map.get(key) || []), e]);
    }
    return map;
  }, [calendarEvents]);
  const todayKey = useMemo(() => toKey(new Date()), []);
  const selectedDayEvents = useMemo(() => (selectedDayKey ? eventsByDate.get(selectedDayKey) || [] : []), [eventsByDate, selectedDayKey]);
  const selectedDayLabel = useMemo(() => {
    if (!selectedDayKey) return '';
    const [y, m, d] = selectedDayKey.split('-').map((x) => parseInt(x, 10));
    const dt = new Date(y, m - 1, d);
    return dt.toLocaleDateString('da-DK', { weekday: 'long', day: 'numeric', month: 'long' });
  }, [selectedDayKey]);

  const hasLongDesc = (forening?.beskrivelse || '').trim().length > 220;

  // --- HERO NAVIGATION ---
  const nextHeroImage = (e?: React.MouseEvent) => {
    e?.stopPropagation();
    setActiveHeroIndex((prev) => (prev + 1) % heroImages.length);
  };
  const prevHeroImage = (e?: React.MouseEvent) => {
    e?.stopPropagation();
    setActiveHeroIndex((prev) => (prev === 0 ? heroImages.length - 1 : prev - 1));
  };

  // --- UPLOAD IMAGE (ADD TO GALLERY) ---
  const handleImageUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    if (!e.target.files || !realForeningId) return;
    const file = e.target.files[0];

    if (heroImages.length >= 6) {
        alert("Du kan maksimalt uploade 6 billeder.");
        return;
    }

    setUploading(true);
    const fileName = `${realForeningId}_${Date.now()}`;
    const { error: uploadError } = await supabase.storage.from('foreningsbilleder').upload(fileName, file);

    if (!uploadError) {
      const { data } = supabase.storage.from('foreningsbilleder').getPublicUrl(fileName);
      const newUrl = data.publicUrl;
      
      // Opdater lokalt
      const newImages = [...heroImages, newUrl];
      setHeroImages(newImages);
      setActiveHeroIndex(newImages.length - 1); // Hop til det nye billede

      // Gem i DB (Forudsætter at du har 'images' kolonne, ellers gemmer vi kun i 'billede_url')
      await supabase.from('foreninger')
        .update({ 
            billede_url: newUrl, // Sætter nyeste som main
            images: newImages    // Gemmer array (kræver DB understøttelse)
        })
        .eq('id', realForeningId);
    }
    setUploading(false);
    // Reset input
    if (fileInputRef.current) fileInputRef.current.value = '';
  };

  // --- DELETE IMAGE FROM GALLERY ---
  const handleDeleteHeroImage = async (indexToDelete: number) => {
    if (!realForeningId) return;
    if (!confirm("Er du sikker på, at du vil slette dette billede?")) return;

    const newImages = heroImages.filter((_, idx) => idx !== indexToDelete);
    setHeroImages(newImages);
    
    // Juster index hvis nødvendigt
    if (activeHeroIndex >= newImages.length) {
        setActiveHeroIndex(Math.max(0, newImages.length - 1));
    }

    // Gem i DB
    await supabase.from('foreninger')
        .update({ 
            images: newImages, 
            billede_url: newImages.length > 0 ? newImages[0] : null // Fallback hvis alle slettes
        })
        .eq('id', realForeningId);
  };

  // --- SAVE INFO ---
  const handleSaveInfo = async () => {
    if (!realForeningId) return;
    const { error } = await supabase
      .from('foreninger')
      .update({ navn: editNavn, sted: editSted, beskrivelse: editDescription })
      .eq('id', realForeningId);
    if (!error) {
      setForening((prev) => (prev ? { ...prev, navn: editNavn, sted: editSted, beskrivelse: editDescription } : null));
      setIsEditing(false);
    } else {
      alert('Kunne ikke gemme.');
    }
  };

  // --- ACTIONS ---
  const handleCopyLink = async () => { await navigator.clipboard.writeText(window.location.href); alert('Link kopieret ✅'); };
  const handleShare = async () => { if (typeof navigator !== 'undefined' && (navigator as any).share) { try { await (navigator as any).share({ title: forening?.navn || 'Forening', url: window.location.href }); return; } catch {} } await handleCopyLink(); };
  
  const handleOpenInvite = () => { setInviteInfo(null); setInviteQuery(''); setInviteResults([]); setShowInviteModal(true); };
  const runInviteSearch = async (q: string) => { const query = q.trim(); setInviteQuery(q); setInviteInfo(null); if (query.length < 2) { setInviteResults([]); return; } setInviteLoading(true); try { const { data, error } = await supabase.from('users').select('id, name, username, avatar_url, email').or(`username.ilike.%${query}%,email.ilike.%${query}%,name.ilike.%${query}%`).limit(10); if (error) throw error; const filtered = (data || []).filter((u: any) => u?.id && !memberIdSet.has(u.id)); setInviteResults(filtered as UserSearchResult[]); } catch { setInviteResults([]); setInviteInfo('Kunne ikke søge efter brugere.'); } finally { setInviteLoading(false); } };
  const inviteUser = async (targetUserId: string) => { if (!realForeningId) return; try { const { error } = await supabase.from('foreningsmedlemmer').insert([{ forening_id: realForeningId, user_id: targetUserId, rolle: 'medlem', status: 'pending' }]); if (error) { setInviteInfo('Kunne ikke invitere.'); return; } setInviteInfo('Invitation sendt ✅'); setInviteResults((prev) => prev.filter((u) => u.id !== targetUserId)); } catch { setInviteInfo('Kunne ikke invitere.'); } };

  const handleOpenMessageModal = (member: Medlem) => { setSelectedMember(member); setShowFirstMessageModal(true); };
  const handleSendFirstMessage = async () => { if (!userId || !selectedMember || !firstMessageText.trim()) return; setIsSendingFirstMessage(true); const targetUserId = selectedMember.user_id; try { const { data: existingThread } = await supabase.from('messages').select('thread_id').or(`and(sender_id.eq.${userId},receiver_id.eq.${targetUserId}),and(sender_id.eq.${targetUserId},receiver_id.eq.${userId})`).limit(1).maybeSingle(); const threadIdToUse = existingThread?.thread_id || makeUuid(); const { error: sendErr } = await supabase.from('messages').insert([{ thread_id: threadIdToUse, sender_id: userId, receiver_id: targetUserId, text: firstMessageText.trim(), is_read: false }]); if (sendErr) throw sendErr; router.push(`/beskeder?id=${threadIdToUse}&dmUser=${targetUserId}`); } catch { alert('Kunne ikke sende besked.'); } finally { setIsSendingFirstMessage(false); setShowFirstMessageModal(false); setFirstMessageText(''); } };

  const handleJoin = async () => { if (!userId || !realForeningId) { router.push('/opret'); return; } await supabase.from('foreningsmedlemmer').insert([{ forening_id: realForeningId, user_id: userId, rolle: 'medlem', status: 'pending' }]); window.location.reload(); };
  const handleClickLeave = () => { setConfirmModal({ isOpen: true, title: 'Afslut medlemskab', message: 'Er du sikker på, at du vil forlade foreningen?', actionType: 'leave', isLoading: false }); };
  const handleClickDelete = () => { setConfirmModal({ isOpen: true, title: 'Slet forening', message: 'Er du sikker på, at du vil slette denne forening?', actionType: 'delete', isLoading: false }); };
  const executeConfirmAction = async () => { if (!userId || !realForeningId) return; setConfirmModal((prev) => ({ ...prev, isLoading: true })); try { if (confirmModal.actionType === 'leave') { const { error } = await supabase.from('foreningsmedlemmer').delete().eq('forening_id', realForeningId).eq('user_id', userId); if (error) throw error; router.push('/opslag'); router.refresh(); } else if (confirmModal.actionType === 'delete') { const { error } = await supabase.from('foreninger').delete().eq('id', realForeningId); if (error) throw error; router.push('/opslag'); router.refresh(); } } catch (err: any) { alert('Der opstod en fejl: ' + err.message); setConfirmModal((prev) => ({ ...prev, isLoading: false })); } };

  if (loading) return <div className="min-h-screen bg-[#869FB9] flex items-center justify-center font-black text-white">Indlæser...</div>;
  if (!forening) return <div className="min-h-screen bg-[#869FB9] p-10 text-center text-white">Forening ikke fundet</div>;

  return (
    <div className="min-h-screen flex flex-col bg-[#869FB9]">
      <SiteHeader />

      <main className="flex-1 w-full max-w-4xl mx-auto p-4 pb-20 space-y-6">
        <input type="file" accept="image/*" ref={fileInputRef} className="hidden" onChange={handleImageUpload} />

        {/* HERO */}
        <div className="bg-white rounded-[24px] p-5 shadow-md mt-6 flex flex-col gap-4">
          
          {/* ✅ Opdateret Hero Container: aspect-square på mobil, aspect-[21/9] på desktop */}
          <div className="relative w-full aspect-square md:aspect-[21/9] rounded-[18px] overflow-hidden bg-gray-100 group">
            {heroImages.length > 0 ? (
              <>
                <img 
                  src={heroImages[activeHeroIndex]} 
                  className="w-full h-full object-cover transition-opacity duration-300 cursor-zoom-in" 
                  alt="Cover" 
                  onClick={() => setLightboxOpen(true)} // Åbn lightbox ved klik
                />
                
                {/* Pile (hvis flere billeder) */}
                {heroImages.length > 1 && (
                  <>
                    <button onClick={prevHeroImage} className="absolute left-2 top-1/2 -translate-y-1/2 bg-black/30 hover:bg-black/50 text-white w-8 h-8 rounded-full flex items-center justify-center backdrop-blur-sm">❮</button>
                    <button onClick={nextHeroImage} className="absolute right-2 top-1/2 -translate-y-1/2 bg-black/30 hover:bg-black/50 text-white w-8 h-8 rounded-full flex items-center justify-center backdrop-blur-sm">❯</button>
                    <div className="absolute bottom-3 left-0 right-0 flex justify-center gap-1.5">
                      {heroImages.map((_, idx) => (
                        <div key={idx} className={`w-1.5 h-1.5 rounded-full transition-all ${idx === activeHeroIndex ? 'bg-white w-3' : 'bg-white/50'}`} />
                      ))}
                    </div>
                  </>
                )}
              </>
            ) : (
              <div className="w-full h-full flex items-center justify-center text-gray-400 font-bold">Ingen forside</div>
            )}
            {uploading && <div className="absolute inset-0 bg-black/50 flex items-center justify-center text-white font-black">Uploader...</div>}
          </div>

          <div className="w-full">
            {isEditing ? (
              <div className="flex flex-col gap-3">
                {/* ✅ Billed-manager i edit mode */}
                <div className="mb-2">
                    <p className="text-xs font-bold text-gray-500 uppercase mb-2">Billeder ({heroImages.length}/6)</p>
                    <div className="flex gap-2 overflow-x-auto pb-2">
                        {heroImages.map((img, idx) => (
                            <div key={idx} className="relative w-16 h-16 shrink-0 rounded-lg overflow-hidden group">
                                <img src={img} className="w-full h-full object-cover" />
                                <button 
                                    onClick={() => handleDeleteHeroImage(idx)}
                                    className="absolute top-0 right-0 bg-red-600 text-white w-5 h-5 flex items-center justify-center rounded-bl-lg text-xs font-bold"
                                >✕</button>
                            </div>
                        ))}
                        {heroImages.length < 6 && (
                            <button 
                                onClick={() => fileInputRef.current?.click()}
                                className="w-16 h-16 shrink-0 rounded-lg border-2 border-dashed border-gray-300 flex items-center justify-center text-gray-400 hover:bg-gray-50 font-bold text-2xl"
                            >
                                +
                            </button>
                        )}
                    </div>
                </div>

                <input value={editNavn} onChange={(e) => setEditNavn(e.target.value)} className="w-full p-3 border rounded-xl text-black font-black" placeholder="Foreningens navn" />
                <input value={editSted} onChange={(e) => setEditSted(e.target.value)} className="w-full p-3 border rounded-xl text-black font-black" placeholder="Sted" />
                <textarea value={editDescription} onChange={(e) => setEditDescription(e.target.value)} className="w-full min-h-[120px] p-3 border rounded-xl text-black" placeholder="Beskrivelse" />
                
                <div className="flex gap-2 justify-end pt-2">
                  <button onClick={() => setIsEditing(false)} className="px-4 py-2 bg-gray-100 rounded-full text-xs font-bold text-gray-700">ANNULLER</button>
                  <button onClick={handleSaveInfo} className="px-4 py-2 bg-[#131921] text-white rounded-full text-xs font-bold">GEM</button>
                </div>
              </div>
            ) : (
              <div className="flex flex-col gap-1">
                <h1 className="text-2xl font-black text-[#131921] underline decoration-gray-300">{forening.navn}</h1>
                <p className="text-gray-700 font-bold mb-3">{forening.sted}</p>
                <div className="text-[#444] text-sm whitespace-pre-wrap">
                  <p className={descExpanded ? '' : 'line-clamp-4'}>{forening.beskrivelse}</p>
                  {hasLongDesc && <button onClick={() => setDescExpanded((v) => !v)} className="mt-2 text-xs font-black text-[#131921] underline">{descExpanded ? 'Læs mindre' : 'Læs mere'}</button>}
                </div>
                {isApprovedMember && (
                  <div className="flex flex-wrap gap-2 mt-4">
                    <button onClick={handleCopyLink} className="px-4 py-2 bg-gray-100 text-black text-xs font-bold rounded-full uppercase">Kopiér link</button>
                    <button onClick={handleShare} className="px-4 py-2 bg-gray-100 text-black text-xs font-bold rounded-full uppercase">Del</button>
                    {isMeAdmin && (
                      <>
                        <button onClick={() => setIsEditing(true)} className="px-4 py-2 bg-gray-100 text-black text-xs font-bold rounded-full uppercase">Rediger</button>
                        <button onClick={handleOpenInvite} className="px-4 py-2 bg-gray-100 text-black text-xs font-bold rounded-full uppercase">Inviter</button>
                      </>
                    )}
                  </div>
                )}
              </div>
            )}
          </div>

          {!isApprovedMember &&
            (isPending ? (
              <div className="w-full py-3 bg-gray-400 text-white rounded-full font-bold text-center">Anmodning sendt - afventer godkendelse</div>
            ) : (
              <button onClick={handleJoin} className="w-full py-3 bg-[#131921] text-white rounded-full font-bold">Bliv medlem</button>
            ))}
        </div>

        {/* ... (RESTEN AF INDHOLDET: BESKEDER, MEDLEMMER, SAMTALER, EVENTS, KALENDER, BILLEDER, FOOTER) ... */}
        {isApprovedMember && (
          <>
            <button onClick={() => router.push('/beskeder')} className="w-full bg-white p-4 rounded-[24px] shadow-sm flex items-center hover:bg-gray-50 transition-colors">
              <div className="bg-[#131921] text-white px-4 py-2 rounded-full font-black text-sm tracking-wider uppercase">Beskeder</div>
            </button>

            {/* MEDLEMMER */}
            <div className="bg-white rounded-[24px] p-4 shadow-sm relative">
              <div className="flex justify-between items-center mb-3 px-2">
                <h3 className="font-black text-[#131921]">MEDLEMMER</h3>
                <button onClick={() => setShowMembers(true)} className="text-xs font-bold text-gray-500">Se alle</button>
              </div>
              <div className="flex gap-4 overflow-x-auto pb-2 px-2 scrollbar-hide">
                {approved.map((m) => (
                  <div key={m.user_id} className="flex flex-col items-center min-w-[64px] cursor-pointer" onClick={() => { setSelectedMember(m); setShowMembers(true); }}>
                    <div className="w-14 h-14 rounded-[14px] bg-gray-100 overflow-hidden mb-1">{getAvatarUrl(m.users?.avatar_url) ? <img src={getAvatarUrl(m.users?.avatar_url)!} className="w-full h-full object-cover" alt="" /> : <div className="w-full h-full flex items-center justify-center font-bold text-gray-400">?</div>}</div>
                    <span className="text-xs font-bold text-black truncate w-16 text-center">{getDisplayName(m)}</span>
                  </div>
                ))}
              </div>
            </div>

            {/* SAMTALER & AKTIVITETER */}
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <div onClick={() => router.push(`/forening/${realForeningId}/threads`)} className="bg-white rounded-[24px] p-4 shadow-sm cursor-pointer hover:shadow-md transition-shadow">
                <div className="bg-[#131921] text-white px-4 py-1.5 rounded-full font-black text-sm tracking-wider inline-block mb-3 uppercase">Samtaler</div>
                {threads.length === 0 ? <p className="text-sm text-gray-400">Ingen tråde endnu.</p> : <div className="space-y-3">{threads.map((t, idx) => <div key={t.id} className={`${idx !== 0 ? 'border-t border-gray-100 pt-3' : ''}`}><h4 className="font-bold text-[#131921] text-lg">{t.title}</h4><p className="text-xs text-gray-500 mt-1">Oprettet {fmtDate(t.created_at)}</p></div>)}</div>}
              </div>
              <div onClick={() => router.push(`/forening/${realForeningId}/events`)} className="bg-white rounded-[24px] p-4 shadow-sm cursor-pointer hover:shadow-md transition-shadow">
                <div className="bg-[#131921] text-white px-4 py-1.5 rounded-full font-black text-sm tracking-wider inline-block mb-3 uppercase">Aktiviteter</div>
                {events.length === 0 ? <p className="text-sm text-gray-400">Ingen aktiviteter endnu.</p> : <div className="space-y-3">{events.map((e, idx) => <div key={e.id} className={`${idx !== 0 ? 'border-t border-gray-100 pt-3' : ''}`}><h4 className="font-bold text-[#131921] text-lg">{e.title}</h4><p className="text-xs text-gray-500 mt-1">{fmtDate(e.start_at)} {e.location && `• ${e.location}`}</p></div>)}</div>}
              </div>
            </div>

            {/* KALENDER & BILLEDER */}
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <div className="bg-white rounded-[24px] p-4 shadow-sm">
                <div className="bg-[#131921] text-white px-4 py-1.5 rounded-full font-black text-sm tracking-wider inline-block mb-3 uppercase">Kalender</div>
                <div className="flex items-center justify-between mb-3 px-2">
                  <button onClick={() => { setMonthCursor((prev) => new Date(prev.getFullYear(), prev.getMonth() - 1, 1)); setSelectedDayKey(null); }} className="w-9 h-9 flex items-center justify-center rounded-full bg-white hover:bg-gray-100 text-[#131921] text-lg font-bold border-2 border-gray-200">❮</button>
                  <h3 className="font-black text-[#131921] text-sm md:text-base capitalize">{monthCursor.toLocaleDateString('da-DK', { month: 'long', year: 'numeric' })}</h3>
                  <button onClick={() => { setMonthCursor((prev) => new Date(prev.getFullYear(), prev.getMonth() + 1, 1)); setSelectedDayKey(null); }} className="w-9 h-9 flex items-center justify-center rounded-full bg-white hover:bg-gray-100 text-[#131921] text-lg font-bold border-2 border-gray-200">❯</button>
                </div>
                <div className="grid grid-cols-7 gap-1.5 px-1 mb-2 text-[10px] font-black text-gray-400 uppercase tracking-wider">{['Man', 'Tir', 'Ons', 'Tor', 'Fre', 'Lør', 'Søn'].map((d) => <div key={d} className="text-center">{d}</div>)}</div>
                <div className="grid grid-cols-7 gap-1.5">
                  {buildMonthGrid(monthCursor).flat().map((day, idx) => {
                    const key = toKey(day);
                    const dayEvents = eventsByDate.get(key) || [];
                    const hasEvents = dayEvents.length > 0;
                    return <button key={idx} type="button" onClick={() => hasEvents ? setSelectedDayKey(key) : setSelectedDayKey(null)} className={['aspect-square rounded-xl relative flex items-center justify-center text-sm font-bold transition-all', hasEvents ? dayColorClass(true) : 'bg-transparent', hasEvents ? '' : (day.getMonth() !== monthCursor.getMonth() ? 'text-gray-300' : 'text-gray-800'), hasEvents ? 'shadow-sm hover:shadow-md hover:scale-[1.02]' : '', key === selectedDayKey && !hasEvents ? 'ring-2 ring-[#131921]' : '', key === selectedDayKey ? 'ring-4 ring-white/70' : ''].join(' ')}><span>{day.getDate()}</span>{hasEvents && dayEvents.length > 1 && <span className="absolute top-1 right-1 text-[10px] font-black bg-white/20 px-1.5 py-0.5 rounded-full">{dayEvents.length}</span>}</button>;
                  })}
                </div>
                {selectedDayKey && selectedDayEvents.length > 0 && (
                  <div className="mt-4 bg-[#F9FBFC] border border-gray-100 rounded-2xl p-4">
                    <div className="flex items-start justify-between gap-3">
                      <div><p className="text-[11px] font-black uppercase tracking-widest text-gray-500">Aktiviteter</p><h4 className="text-base md:text-lg font-black text-[#131921] capitalize">{selectedDayLabel}</h4></div>
                      <button onClick={() => setSelectedDayKey(null)} className="text-gray-400 font-black text-xl leading-none hover:text-black">✕</button>
                    </div>
                    <div className="mt-3 space-y-3">
                      {selectedDayEvents.map((e) => (
                        <div key={e.id} className="bg-white rounded-2xl border border-gray-100 p-4 shadow-sm">
                          <div className="flex items-start justify-between gap-3">
                            <div className="min-w-0">
                              <div className="flex items-center gap-2 mb-1"><span className="text-[10px] font-black uppercase text-gray-400 tracking-widest">{fmtTime(e.start_at)}–{fmtTime(e.end_at)}</span></div>
                              <h5 className="font-black text-[#131921] text-base truncate">{e.title}</h5>
                              <p className="text-xs text-gray-600 font-bold mt-1">{e.location ? e.location : 'Lokation ikke angivet'} • {typeof e.price === 'number' && e.price > 0 ? `${e.price} kr.` : 'Gratis'}</p>
                              {e.description && <p className="text-sm text-gray-700 mt-2 line-clamp-3 whitespace-pre-wrap">{e.description}</p>}
                            </div>
                            {e.image_url ? <div className="w-16 h-16 rounded-xl overflow-hidden bg-gray-100 flex-shrink-0"><img src={getEventImageUrl(e.image_url)} className="w-full h-full object-cover" alt="" /></div> : null}
                          </div>
                          <div className="mt-3 flex items-center justify-end gap-2"><button onClick={() => router.push(`/forening/${realForeningId}/events?event=${e.id}`)} className="px-4 py-2 rounded-full bg-[#131921] text-white font-black text-xs hover:bg-black transition-colors">Åbn aktivitet / join</button></div>
                        </div>
                      ))}
                    </div>
                    <div className="mt-3 flex justify-end"><button onClick={() => router.push(`/forening/${realForeningId}/events`)} className="text-xs font-black text-[#131921] underline">Se alle aktiviteter →</button></div>
                  </div>
                )}
              </div>

              <div onClick={() => router.push(`/forening/${realForeningId}/images`)} className="bg-white rounded-[24px] p-4 shadow-sm cursor-pointer hover:shadow-md transition-shadow">
                <div className="bg-[#131921] text-white px-4 py-1.5 rounded-full font-black text-sm tracking-wider inline-block mb-3 uppercase">Billeder</div>
                {images.length === 0 ? <p className="text-sm text-gray-400">Ingen billeder.</p> : <div className="grid grid-cols-3 gap-2">{images.slice(0, 9).map((img) => <div key={img.id} className="aspect-square rounded-xl overflow-hidden bg-gray-100"><img src={getEventImageUrl(img.image_url)} className="w-full h-full object-cover" alt="Event" /></div>)}</div>}
              </div>
            </div>

            {/* Footer-actions */}
            <div className="bg-white rounded-[24px] p-4 shadow-sm flex flex-col md:flex-row gap-3 mb-10">
              <button onClick={handleClickLeave} className="flex-1 py-3 bg-gray-100 text-gray-600 rounded-full font-bold hover:bg-gray-200 transition-colors">Afslut medlemskab</button>
              {/* NOTE: 'Skift billede' knappen er fjernet herfra, da upload nu sker i 'Rediger' mode for at håndtere galleriet */}
              {isOwner && <button onClick={handleClickDelete} className="flex-1 py-3 bg-red-100 text-red-700 rounded-full font-bold hover:bg-red-200 transition-colors">Slet forening</button>}
            </div>
          </>
        )}
      </main>

      {/* --- LIGHTBOX (Fuldskærm) --- */}
      {lightboxOpen && heroImages.length > 0 && (
        <div className="fixed inset-0 z-[400] bg-black flex items-center justify-center animate-in fade-in duration-200">
          <button 
            onClick={() => setLightboxOpen(false)}
            className="absolute top-6 right-6 text-white/80 hover:text-white bg-white/10 hover:bg-white/20 w-10 h-10 rounded-full flex items-center justify-center backdrop-blur-md transition-colors z-20"
          >
            <i className="fa-solid fa-xmark text-xl"></i>
          </button>
          
          <img 
            src={heroImages[activeHeroIndex]} 
            alt="Fuldskærm" 
            className="max-w-full max-h-full object-contain p-4 select-none"
            draggable="false"
          />

           {/* Pile i Lightbox */}
           {heroImages.length > 1 && (
              <>
                <button 
                  className="absolute left-4 top-1/2 -translate-y-1/2 text-white/80 hover:text-white text-4xl p-4 z-20"
                  onClick={prevHeroImage}
                >‹</button>
                <button 
                  className="absolute right-4 top-1/2 -translate-y-1/2 text-white/80 hover:text-white text-4xl p-4 z-20"
                  onClick={nextHeroImage}
                >›</button>
              </>
            )}
        </div>
      )}

      {/* MODALER (Bekræft, Invite, Besked, Medlemmer) */}
      {confirmModal.isOpen && (
        <div className="fixed inset-0 z-[300] flex items-center justify-center p-4 bg-black/80 backdrop-blur-sm animate-in fade-in duration-200">
          <div className="bg-white w-full max-w-sm rounded-[24px] shadow-2xl p-6 text-center">
            <h3 className="text-xl font-black text-[#131921] mb-2">{confirmModal.title}</h3>
            <p className="text-gray-600 text-sm mb-6">{confirmModal.message}</p>
            <div className="flex gap-3 justify-center">
              <button disabled={confirmModal.isLoading} onClick={() => setConfirmModal(prev => ({...prev, isOpen: false}))} className="px-6 py-3 rounded-full font-bold text-sm bg-gray-100 text-gray-700 hover:bg-gray-200">Annuller</button>
              <button disabled={confirmModal.isLoading} onClick={executeConfirmAction} className={`px-6 py-3 rounded-full font-bold text-sm text-white ${confirmModal.actionType === 'delete' ? 'bg-red-600 hover:bg-red-700' : 'bg-[#131921] hover:bg-black'}`}>{confirmModal.isLoading ? 'Behandler...' : 'Bekræft'}</button>
            </div>
          </div>
        </div>
      )}
      
      {/* ... De andre modaler (Invite, Besked, Medlemmer) ... */}
      {isApprovedMember && isMeAdmin && showInviteModal && (
        <div className="fixed inset-0 z-[260] flex items-center justify-center p-4 bg-black/80 backdrop-blur-sm animate-in fade-in duration-200">
          <div className="bg-white w-full max-w-md rounded-[24px] shadow-2xl p-6 relative">
            <button onClick={() => setShowInviteModal(false)} className="absolute top-4 right-4 text-gray-400 text-xl font-black">✕</button>
            <div className="mb-4"><h3 className="text-xl font-black text-[#131921]">Inviter</h3><p className="text-xs text-gray-500 font-bold mt-1">Kopiér link eller invitér en bruger.</p></div>
            <div className="flex gap-2"><button onClick={handleCopyLink} className="flex-1 px-4 py-3 bg-[#131921] text-white rounded-full font-black text-xs">Kopiér invite-link</button><button onClick={handleShare} className="flex-1 px-4 py-3 bg-gray-100 text-[#131921] rounded-full font-black text-xs">Del link</button></div>
            <div className="mt-5"><p className="text-[11px] font-black uppercase tracking-widest text-gray-500 mb-2">Invitér bruger</p><input value={inviteQuery} onChange={(e) => runInviteSearch(e.target.value)} placeholder="Søg på navn, brugernavn eller email..." className="w-full p-3 bg-gray-50 border border-gray-100 rounded-2xl outline-none focus:ring-2 focus:ring-[#131921] transition-all font-bold text-black" />{inviteInfo && <p className="mt-2 text-xs font-bold text-gray-600">{inviteInfo}</p>}<div className="mt-3 space-y-2 max-h-[260px] overflow-y-auto">{inviteLoading ? <p className="text-sm text-gray-400">Søger...</p> : inviteResults.length === 0 ? <p className="text-sm text-gray-400">{inviteQuery.trim().length < 2 ? 'Skriv mindst 2 tegn for at søge.' : 'Ingen resultater.'}</p> : inviteResults.map((u) => <div key={u.id} className="flex items-center justify-between gap-3 p-2 rounded-xl hover:bg-gray-50"><div className="flex items-center gap-3 min-w-0"><div className="w-10 h-10 rounded-[10px] bg-gray-100 overflow-hidden flex-shrink-0">{getAvatarUrl(u.avatar_url) ? <img src={getAvatarUrl(u.avatar_url)!} className="w-full h-full object-cover" alt="" /> : null}</div><div className="min-w-0"><p className="font-black text-sm text-[#131921] truncate">{u.name || u.username || (u.email ? u.email.split('@')[0] : 'Ukendt')}</p><p className="text-[11px] text-gray-500 font-bold truncate">{u.username ? `@${u.username}` : u.email}</p></div></div><button onClick={() => inviteUser(u.id)} className="px-3 py-2 rounded-full bg-[#131921] text-white font-black text-xs hover:bg-black">Inviter</button></div>)}</div></div></div>
        </div>
      )}

      {isApprovedMember && showFirstMessageModal && selectedMember && (
        <div className="fixed inset-0 z-[300] flex items-center justify-center p-4 bg-black/80 backdrop-blur-sm animate-in fade-in duration-200">
          <div className="bg-white w-full max-w-md rounded-[24px] shadow-2xl p-6 relative">
            <button onClick={() => { setShowFirstMessageModal(false); setFirstMessageText(''); }} className="absolute top-4 right-4 text-gray-400 text-xl font-black">✕</button>
            <div className="text-center mb-6"><div className="w-20 h-20 rounded-full bg-gray-100 overflow-hidden mx-auto mb-3">{getAvatarUrl(selectedMember.users?.avatar_url) ? <img src={getAvatarUrl(selectedMember.users?.avatar_url)!} className="w-full h-full object-cover" alt="" /> : <div className="w-full h-full bg-gray-200 flex items-center justify-center text-2xl font-black">?</div>}</div><h3 className="text-xl font-bold text-[#131921]">Skriv til {getDisplayName(selectedMember)}</h3></div>
            <textarea value={firstMessageText} onChange={(e) => setFirstMessageText(e.target.value)} placeholder="Skriv din første besked her..." className="w-full h-32 p-4 bg-gray-50 border border-gray-100 rounded-2xl outline-none focus:ring-2 focus:ring-[#131921] transition-all font-medium text-black" />
            <button onClick={handleSendFirstMessage} disabled={isSendingFirstMessage || !firstMessageText.trim()} className="w-full py-4 mt-4 bg-[#131921] text-white rounded-full font-black shadow-lg hover:bg-black transition-all active:scale-95 disabled:opacity-50">{isSendingFirstMessage ? 'Sender...' : 'Send besked'}</button>
          </div>
        </div>
      )}

      {isApprovedMember && showMembers && (
        <div className="fixed inset-0 z-[200] flex items-center justify-center p-4 bg-black/80 backdrop-blur-sm animate-in fade-in duration-200">
          <div className="bg-white w-full max-w-md rounded-[24px] shadow-2xl p-5 relative max-h-[80vh] overflow-y-auto">
            <button onClick={() => setShowMembers(false)} className="absolute top-4 right-4 text-gray-400 text-xl font-black">✕</button>
            {selectedMember ? <div className="flex flex-col items-center pt-4"><div className="w-24 h-24 rounded-2xl bg-gray-100 overflow-hidden mb-4">{getAvatarUrl(selectedMember.users?.avatar_url) ? <img src={getAvatarUrl(selectedMember.users?.avatar_url)!} className="w-full h-full object-cover" alt="" /> : <div className="w-full h-full bg-gray-200 flex items-center justify-center text-3xl font-black">?</div>}</div><h3 className="text-xl font-bold text-[#131921]">{getDisplayName(selectedMember)}</h3><p className="text-xs uppercase font-bold text-gray-400 mb-6">{selectedMember.rolle || 'MEDLEM'}</p><button onClick={() => handleOpenMessageModal(selectedMember)} className="w-full py-3 bg-[#131921] text-white rounded-full font-bold mb-3 shadow-lg hover:bg-gray-900 transition-colors">Skriv til medlem</button><button onClick={() => setSelectedMember(null)} className="text-sm font-bold text-gray-400 mt-2 hover:text-black">← Tilbage</button></div> : <div><h3 className="font-black text-[#131921] mb-4 uppercase tracking-widest text-sm">MEDLEMMER ({approved.length})</h3><div className="space-y-2">{approved.map((m) => <div key={m.user_id} onClick={() => setSelectedMember(m)} className="flex items-center gap-3 p-2 hover:bg-gray-50 rounded-xl cursor-pointer transition-colors"><div className="w-10 h-10 rounded-[10px] bg-gray-100 overflow-hidden">{getAvatarUrl(m.users?.avatar_url) ? <img src={getAvatarUrl(m.users?.avatar_url)!} className="w-full h-full object-cover" alt="" /> : null}</div><div className="min-w-0"><p className="font-bold text-sm text-black truncate">{getDisplayName(m)}</p><p className="text-[10px] text-gray-400 font-bold uppercase">{m.rolle || 'MEDLEM'}</p></div></div>)}</div></div>}
          </div>
        </div>
      )}

      <SiteFooter />
    </div>
  );
}