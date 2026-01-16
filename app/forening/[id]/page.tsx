'use client';

import { useState, useEffect, useMemo, useRef } from 'react';
import { useParams, useRouter } from 'next/navigation';
import { supabase } from '../../../lib/supabaseClient';
import SiteHeader from '../../../components/SiteHeader';
import SiteFooter from '../../../components/SiteFooter';

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
  status?: 'pending' | 'approved' | 'declined' | 'rejected' | null;
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
  const email = user?.email || '';
  return email.includes('@') ? email.split('@')[0] : 'Ukendt';
};

const resolveAvatarUrl = (path: string | null | undefined) => {
  if (!path) return null;
  if (path.startsWith('http')) return path;
  const { data } = supabase.storage.from('avatars').getPublicUrl(path);
  return data.publicUrl;
};

const getEventImageUrl = (path: string | null | undefined) => {
  if (!path) return '';
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

const fmtDate = (d: any) =>
  new Date(d).toLocaleDateString('da-DK', { day: 'numeric', month: 'long', year: 'numeric' });

const fmtTime = (d: any) =>
  new Date(d).toLocaleTimeString('da-DK', { hour: '2-digit', minute: '2-digit' });

const toKey = (d: Date) => 
  `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;

const buildMonthGrid = (base: Date) => {
  const first = new Date(base.getFullYear(), base.getMonth(), 1);
  const last = new Date(base.getFullYear(), base.getMonth() + 1, 0);
  const firstWeekday = (first.getDay() + 6) % 7; 
  const cells: Date[] = [];

  for (let i = 0; i < firstWeekday; i++) {
    const d = new Date(first);
    d.setDate(first.getDate() - (firstWeekday - i));
    cells.push(d);
  }
  for (let d = 1; d <= last.getDate(); d++) cells.push(new Date(base.getFullYear(), base.getMonth(), d));
  while (cells.length < 42) {
    const lastCell = cells[cells.length - 1];
    const next = new Date(lastCell);
    next.setDate(lastCell.getDate() + 1);
    cells.push(next);
  }
  return cells;
};

export default function ForeningWebPage() {
  const params = useParams();
  const router = useRouter();
  const idOrSlug = params.id as string;

  // --- STATES ---
  const [forening, setForening] = useState<Forening | null>(null);
  const [loading, setLoading] = useState(true);
  const [userId, setUserId] = useState<string | null>(null);
  const [medlemmer, setMedlemmer] = useState<Medlem[]>([]);
  const [threads, setThreads] = useState<Thread[]>([]);
  const [events, setEvents] = useState<Event[]>([]);
  const [images, setImages] = useState<any[]>([]);
  
  // UI States
  const [isEditing, setIsEditing] = useState(false);
  const [uploading, setUploading] = useState(false);
  const [showMembersModal, setShowMembersModal] = useState(false);
  const [showInviteModal, setShowInviteModal] = useState(false);
  const [selectedMember, setSelectedMember] = useState<Medlem | null>(null);
  
  // Redigering
  const [editNavn, setEditNavn] = useState('');
  const [editSted, setEditSted] = useState('');
  const [editDesc, setEditDesc] = useState('');
  
  // Invitation
  const [searchQuery, setSearchQuery] = useState('');
  const [searchResults, setSearchResults] = useState<UserSearchResult[]>([]);
  const [inviteMsg, setInviteMsg] = useState('');

  // Kalender
  const [monthCursor, setMonthCursor] = useState(new Date());
  const [selectedDayKey, setSelectedDayKey] = useState<string | null>(null);

  const fileInputRef = useRef<HTMLInputElement>(null);

  // --- DATA FETCH ---
  useEffect(() => {
    async function loadData() {
      setLoading(true);
      const { data: { session } } = await supabase.auth.getSession();
      const currentUserId = session?.user?.id || null;
      setUserId(currentUserId);

      const isUuid = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(idOrSlug);
      let query = supabase.from('foreninger').select('*');
      if (isUuid) query = query.eq('id', idOrSlug);
      else query = query.eq('slug', idOrSlug);

      const { data: fData } = await query.single();
      if (!fData) { setLoading(false); return; }

      setForening(fData);
      setEditNavn(fData.navn);
      setEditSted(fData.sted);
      setEditDesc(fData.beskrivelse);

      const [resM, resT, resE, resImg] = await Promise.all([
        supabase.from('foreningsmedlemmer').select('user_id, rolle, status, users:users(name, username, avatar_url, email)').eq('forening_id', fData.id),
        supabase.from('forening_threads').select('*').eq('forening_id', fData.id).order('created_at', { ascending: false }).limit(3),
        supabase.from('forening_events').select('*').eq('forening_id', fData.id).order('start_at', { ascending: false }),
        supabase.from('event_images').select('*, forening_events!inner(forening_id)').eq('forening_events.forening_id', fData.id).limit(3)
      ]);

      if (resM.data) setMedlemmer(resM.data as any);
      if (resT.data) setThreads(resT.data);
      if (resE.data) setEvents(resE.data);
      if (resImg.data) setImages(resImg.data);

      setLoading(false);
    }
    loadData();
  }, [idOrSlug]);

  // --- LOGIK ---
  const myMembership = medlemmer.find(m => m.user_id === userId);
  const isApproved = myMembership?.status === 'approved';
  const isAdmin = myMembership?.rolle === 'admin' || forening?.oprettet_af === userId;
  const isOwner = forening?.oprettet_af === userId;

  const handleCopyLink = () => {
    const url = window.location.href;
    navigator.clipboard.writeText(url);
    alert("Link kopieret!");
  };

  const handleSaveInfo = async () => {
    if (!forening) return;
    const { error } = await supabase.from('foreninger').update({ navn: editNavn, sted: editSted, beskrivelse: editDesc }).eq('id', forening.id);
    if (!error) {
      setForening({ ...forening, navn: editNavn, sted: editSted, beskrivelse: editDesc });
      setIsEditing(false);
    }
  };

  const handleJoin = async () => {
    if (!userId || !forening) return;
    await supabase.from('foreningsmedlemmer').insert([{ forening_id: forening.id, user_id: userId, status: 'pending', rolle: 'medlem' }]);
    window.location.reload();
  };

  // Invitation søgning
  useEffect(() => {
    if (searchQuery.length < 2) { setSearchResults([]); return; }
    const delay = setTimeout(async () => {
      const { data } = await supabase.from('users').select('id, name, username, avatar_url')
        .or(`name.ilike.%${searchQuery}%,username.ilike.%${searchQuery}%`).limit(5);
      if (data) {
        const existingIds = medlemmer.map(m => m.user_id);
        setSearchResults(data.filter(u => !existingIds.includes(u.id)));
      }
    }, 500);
    return () => clearTimeout(delay);
  }, [searchQuery, medlemmer]);

  const sendInvite = async (targetId: string) => {
    if (!forening || !userId) return;
    const { error } = await supabase.from('foreningsmedlemmer').insert([{ forening_id: forening.id, user_id: targetId, status: 'pending', rolle: 'medlem' }]);
    if (!error) {
      const threadId = makeUuid();
      const msg = inviteMsg.trim() || `Hej! Jeg har inviteret dig til ${forening.navn}.`;
      await supabase.from('messages').insert([{ thread_id: threadId, sender_id: userId, receiver_id: targetId, text: msg }]);
      alert("Invitation sendt!");
      setShowInviteModal(false);
    }
  };

  // Kalender map
  const eventsByDate = useMemo(() => {
    const map = new Map<string, Event[]>();
    events.forEach(e => {
      const key = toKey(new Date(e.start_at));
      map.set(key, [...(map.get(key) || []), e]);
    });
    return map;
  }, [events]);

  if (loading) return <div className="min-h-screen bg-[#869FB9] flex items-center justify-center text-white font-bold">Indlæser...</div>;
  if (!forening) return <div className="min-h-screen bg-[#869FB9] flex items-center justify-center text-white">Forening ikke fundet</div>;

  return (
    <div className="min-h-screen flex flex-col bg-[#869FB9] font-sans text-[#131921]">
      <SiteHeader />

      <main className="flex-1 w-full max-w-4xl mx-auto p-4 space-y-4 pb-20">
        
        {/* HERO CARD */}
        <section className="bg-white rounded-[24px] p-5 shadow-lg">
          <div className="relative aspect-video md:aspect-[2/1] rounded-[18px] overflow-hidden bg-gray-100 mb-4">
            {forening.billede_url ? (
              <img src={forening.billede_url} className="w-full h-full object-cover" alt="Cover" />
            ) : (
              <div className="w-full h-full flex items-center justify-center text-gray-400 font-bold">Ingen forside</div>
            )}
          </div>

          {isEditing ? (
            <div className="space-y-3">
              <input value={editNavn} onChange={e => setEditNavn(e.target.value)} className="w-full p-3 bg-gray-50 rounded-xl font-bold border" />
              <input value={editSted} onChange={e => setEditSted(e.target.value)} className="w-full p-3 bg-gray-50 rounded-xl border" />
              <textarea value={editDesc} onChange={e => setEditDesc(e.target.value)} className="w-full p-3 bg-gray-50 rounded-xl border min-h-[100px]" />
              <div className="flex gap-2 justify-end">
                <button onClick={() => setIsEditing(false)} className="px-6 py-2 bg-gray-200 rounded-full font-bold text-sm">Annuller</button>
                <button onClick={handleSaveInfo} className="px-6 py-2 bg-[#131921] text-white rounded-full font-bold text-sm">Gem</button>
              </div>
            </div>
          ) : (
            <>
              <h1 className="text-2xl font-black underline decoration-gray-300">{forening.navn}</h1>
              <p className="font-bold text-gray-700 mt-1">{forening.sted}</p>
              <p className="text-sm text-gray-600 mt-3 whitespace-pre-wrap leading-relaxed">{forening.beskrivelse}</p>
              
              <div className="flex flex-wrap gap-2 mt-5">
                <button onClick={handleCopyLink} className="bg-[#e9eef5] px-4 py-2 rounded-full text-xs font-bold uppercase hover:bg-gray-200">Kopiér link</button>
                <button onClick={() => { if(navigator.share) navigator.share({title: forening.navn, url: window.location.href}) }} className="bg-[#e9eef5] px-4 py-2 rounded-full text-xs font-bold uppercase hover:bg-gray-200">Del</button>
                {isAdmin && (
                  <>
                    <button onClick={() => setIsEditing(true)} className="bg-[#e9eef5] px-4 py-2 rounded-full text-xs font-bold uppercase hover:bg-gray-200">Rediger</button>
                    <button onClick={() => setShowInviteModal(true)} className="bg-[#e9eef5] px-4 py-2 rounded-full text-xs font-bold uppercase hover:bg-gray-200">Inviter</button>
                  </>
                )}
              </div>
            </>
          )}

          {!isApproved && (
            <button 
              onClick={handleJoin}
              disabled={myMembership?.status === 'pending'}
              className={`w-full mt-6 py-4 rounded-full font-black text-white shadow-md transition-transform active:scale-95 ${myMembership?.status === 'pending' ? 'bg-gray-400' : 'bg-[#131921]'}`}
            >
              {myMembership?.status === 'pending' ? 'Anmodning sendt...' : 'Bliv medlem'}
            </button>
          )}
        </section>

        {isApproved && (
          <>
            {/* BESKEDER KNAP */}
            <button 
              onClick={() => router.push(`/beskeder?id=${forening.id}`)}
              className="w-full bg-white p-4 rounded-[24px] shadow-md flex items-center hover:bg-gray-50 transition-colors"
            >
              <span className="bg-[#131921] text-white px-5 py-2 rounded-full font-black text-sm tracking-widest uppercase">Beskeder</span>
            </button>

            {/* MEDLEMMER SEKTION */}
            <section className="bg-white rounded-[24px] p-5 shadow-md">
              <div className="flex justify-between items-center mb-4">
                <div className="bg-[#131921] text-white px-4 py-1.5 rounded-full font-black text-xs tracking-wider uppercase">Medlemmer</div>
                <button onClick={() => setShowMembersModal(true)} className="flex items-center bg-[#131921] px-3 py-1.5 rounded-full text-white">
                  <span className="text-xs font-bold">{medlemmer.filter(m => m.status === 'approved').length}</span>
                </button>
              </div>
              <div className="flex gap-4 overflow-x-auto pb-2 scrollbar-hide">
                {medlemmer.filter(m => m.status === 'approved').map(m => (
                  <div key={m.user_id} className="flex flex-col items-center min-w-[70px] cursor-pointer" onClick={() => { setSelectedMember(m); setShowMembersModal(true); }}>
                    <div className="w-14 h-14 rounded-2xl bg-gray-100 overflow-hidden mb-1 border-2 border-transparent hover:border-[#131921]">
                      {m.users?.avatar_url ? (
                        <img src={resolveAvatarUrl(m.users.avatar_url)!} className="w-full h-full object-cover" alt="" />
                      ) : (
                        <div className="w-full h-full flex items-center justify-center font-bold text-gray-400">?</div>
                      )}
                    </div>
                    <span className="text-[10px] font-bold truncate w-16 text-center">{getDisplayName(m)}</span>
                  </div>
                ))}
              </div>
            </section>

            {/* SAMTALER & AKTIVITETER */}
            <div className="grid md:grid-cols-2 gap-4">
              <section className="bg-white rounded-[24px] p-5 shadow-md cursor-pointer hover:shadow-xl transition-shadow" onClick={() => router.push(`/forening/${forening.id}/threads`)}>
                <div className="bg-[#131921] text-white px-4 py-1.5 rounded-full font-black text-xs tracking-wider uppercase inline-block mb-4">Samtaler</div>
                <div className="space-y-3">
                  {threads.length === 0 ? <p className="text-xs text-gray-400">Ingen tråde endnu.</p> : threads.map(t => (
                    <div key={t.id} className="border-b border-gray-100 pb-2">
                      <h4 className="font-bold text-sm line-clamp-1">{t.title}</h4>
                      <p className="text-[10px] text-gray-400 mt-0.5">{fmtDate(t.created_at)}</p>
                    </div>
                  ))}
                </div>
              </section>

              <section className="bg-white rounded-[24px] p-5 shadow-md cursor-pointer hover:shadow-xl transition-shadow" onClick={() => router.push(`/forening/${forening.id}/events`)}>
                <div className="bg-[#131921] text-white px-4 py-1.5 rounded-full font-black text-xs tracking-wider uppercase inline-block mb-4">Aktiviteter</div>
                <div className="space-y-3">
                  {events.length === 0 ? <p className="text-xs text-gray-400">Ingen aktiviteter endnu.</p> : events.slice(0,3).map(e => (
                    <div key={e.id} className="border-b border-gray-100 pb-2">
                      <h4 className="font-bold text-sm line-clamp-1">{e.title}</h4>
                      <p className="text-[10px] text-gray-400 mt-0.5">{fmtDate(e.start_at)}</p>
                    </div>
                  ))}
                </div>
              </section>
            </div>

            {/* KALENDER SEKTION */}
            <section className="bg-white rounded-[24px] p-5 shadow-md">
              <div className="bg-[#131921] text-white px-4 py-1.5 rounded-full font-black text-xs tracking-wider uppercase inline-block mb-6">Kalender</div>
              
              <div className="flex items-center justify-between mb-6">
                <button onClick={() => setMonthCursor(new Date(monthCursor.getFullYear(), monthCursor.getMonth() - 1, 1))} className="w-10 h-10 rounded-full bg-gray-50 flex items-center justify-center font-bold">❮</button>
                <h3 className="font-black text-lg capitalize">{monthCursor.toLocaleDateString('da-DK', { month: 'long', year: 'numeric' })}</h3>
                <button onClick={() => setMonthCursor(new Date(monthCursor.getFullYear(), monthCursor.getMonth() + 1, 1))} className="w-10 h-10 rounded-full bg-gray-50 flex items-center justify-center font-bold">❯</button>
              </div>

              <div className="grid grid-cols-7 gap-1 text-center mb-2">
                {['Man', 'Tir', 'Ons', 'Tor', 'Fre', 'Lør', 'Søn'].map(d => <div key={d} className="text-[10px] font-black text-gray-400 uppercase">{d}</div>)}
              </div>

              <div className="grid grid-cols-7 gap-1">
                {buildMonthGrid(monthCursor).map((date, i) => {
                  const key = toKey(date);
                  const hasEvents = eventsByDate.has(key);
                  const isOtherMonth = date.getMonth() !== monthCursor.getMonth();
                  const isSelected = selectedDayKey === key;

                  return (
                    <button 
                      key={i} 
                      onClick={() => hasEvents && setSelectedDayKey(isSelected ? null : key)}
                      className={`aspect-square rounded-xl flex flex-col items-center justify-center relative transition-all ${hasEvents ? 'bg-[#131921] text-white shadow-sm hover:scale-105' : 'text-gray-800'} ${isOtherMonth && !hasEvents ? 'opacity-20' : ''} ${isSelected ? 'ring-4 ring-[#869FB9]' : ''}`}
                    >
                      <span className="text-xs font-bold">{date.getDate()}</span>
                      {hasEvents && <div className="absolute bottom-1 w-1 h-1 bg-white rounded-full" />}
                    </button>
                  );
                })}
              </div>

              {selectedDayKey && eventsByDate.has(selectedDayKey) && (
                <div className="mt-6 p-4 bg-gray-50 rounded-2xl animate-in slide-in-from-top-2">
                  <h4 className="font-black text-sm mb-3 uppercase tracking-widest">Aktiviteter d. {fmtDate(selectedDayKey)}</h4>
                  <div className="space-y-3">
                    {eventsByDate.get(selectedDayKey)?.map(e => (
                      <div key={e.id} className="bg-white p-3 rounded-xl shadow-sm flex justify-between items-center">
                        <div>
                          <p className="font-bold text-sm">{e.title}</p>
                          <p className="text-[10px] text-gray-500">{fmtTime(e.start_at)} {e.location && `• ${e.location}`}</p>
                        </div>
                        <button onClick={() => router.push(`/forening/${forening.id}/events?id=${e.id}`)} className="text-[10px] font-black uppercase bg-[#131921] text-white px-3 py-1.5 rounded-full">Åbn</button>
                      </div>
                    ))}
                  </div>
                </div>
              )}
            </section>

            {/* BILLEDER SEKTION */}
            <section className="bg-white rounded-[24px] p-5 shadow-md cursor-pointer" onClick={() => router.push(`/forening/${forening.id}/images`)}>
              <div className="bg-[#131921] text-white px-4 py-1.5 rounded-full font-black text-xs tracking-wider uppercase inline-block mb-4">Billeder</div>
              <div className="flex gap-2 overflow-x-auto">
                {images.length === 0 ? <p className="text-xs text-gray-400">Ingen billeder endnu.</p> : images.map(img => (
                  <div key={img.id} className="w-24 h-24 rounded-xl overflow-hidden flex-shrink-0 bg-gray-100">
                    <img src={img.image_url} className="w-full h-full object-cover" alt="" />
                  </div>
                ))}
              </div>
            </section>

            {/* BUND-HANDLINGER */}
            <div className="bg-white rounded-[24px] p-4 shadow-md flex flex-col md:flex-row gap-2">
              <button className="flex-1 py-3 bg-gray-100 rounded-full font-bold text-sm text-gray-600">Afslut medlemskab</button>
              {isOwner && (
                <>
                  <button onClick={() => fileInputRef.current?.click()} className="flex-1 py-3 bg-[#131921] text-white rounded-full font-bold text-sm">Upload billede</button>
                  <button className="flex-1 py-3 bg-red-100 text-red-600 rounded-full font-bold text-sm">Slet forening</button>
                </>
              )}
            </div>
            <input type="file" ref={fileInputRef} className="hidden" onChange={() => {}} />
          </>
        )}
      </main>

      {/* MODAL: INVITATION (Matcher App-logik) */}
      {showInviteModal && (
        <div className="fixed inset-0 z-[100] bg-black/80 flex items-center justify-center p-4">
          <div className="bg-white w-full max-w-md rounded-[28px] p-6">
            <div className="flex justify-between mb-4">
              <h3 className="font-black uppercase tracking-widest">Inviter bruger</h3>
              <button onClick={() => setShowInviteModal(false)} className="text-xl">✕</button>
            </div>
            <input 
              placeholder="Søg på navn eller brugernavn..." 
              className="w-full p-4 bg-gray-100 rounded-2xl mb-4 font-bold"
              value={searchQuery}
              onChange={e => setSearchQuery(e.target.value)}
            />
            <textarea 
              placeholder="Skriv en personlig besked (valgfri)..." 
              className="w-full p-4 bg-gray-100 rounded-2xl mb-4 h-24"
              value={inviteMsg}
              onChange={e => setInviteMsg(e.target.value)}
            />
            <div className="max-h-60 overflow-y-auto space-y-2">
              {searchResults.map(u => (
                <div key={u.id} className="flex items-center justify-between p-2 border-b">
                  <div className="flex items-center gap-3">
                    <div className="w-10 h-10 rounded-full bg-gray-200 overflow-hidden">
                      {u.avatar_url && <img src={resolveAvatarUrl(u.avatar_url)!} className="w-full h-full object-cover" />}
                    </div>
                    <div>
                      <p className="font-bold text-sm">{u.name}</p>
                      <p className="text-xs text-gray-400">@{u.username}</p>
                    </div>
                  </div>
                  <button onClick={() => sendInvite(u.id)} className="bg-[#131921] text-white px-4 py-1.5 rounded-full text-xs font-bold uppercase">Inviter</button>
                </div>
              ))}
            </div>
          </div>
        </div>
      )}

      {/* MODAL: MEDLEMMER (Matcher App-stil) */}
      {showMembersModal && (
        <div className="fixed inset-0 z-[100] bg-black/80 flex items-center justify-center p-4">
          <div className="bg-white w-full max-w-md rounded-[28px] p-6 max-h-[80vh] overflow-y-auto">
            <button onClick={() => {setShowMembersModal(false); setSelectedMember(null);}} className="float-right text-xl">✕</button>
            
            {selectedMember ? (
              <div className="flex flex-col items-center pt-6">
                <div className="w-48 h-64 rounded-[24px] bg-gray-100 overflow-hidden mb-4 shadow-xl">
                  {selectedMember.users?.avatar_url ? (
                    <img src={resolveAvatarUrl(selectedMember.users.avatar_url)!} className="w-full h-full object-cover" />
                  ) : <div className="w-full h-full flex items-center justify-center text-4xl">?</div>}
                </div>
                <h3 className="text-xl font-black">{getDisplayName(selectedMember)}</h3>
                <span className="bg-[#131921] text-white px-4 py-1 rounded-full text-[10px] font-black uppercase mt-2 mb-6">
                  {selectedMember.rolle || 'Medlem'}
                </span>
                <button onClick={() => router.push(`/beskeder?other=${selectedMember.user_id}`)} className="w-full py-4 bg-[#131921] text-white rounded-full font-black uppercase tracking-widest mb-3">Skriv besked</button>
                <button onClick={() => setSelectedMember(null)} className="text-gray-400 font-bold uppercase text-xs">← Tilbage til listen</button>
              </div>
            ) : (
              <>
                <h3 className="font-black uppercase tracking-widest mb-6 border-b-2 border-[#131921] inline-block">Medlemmer</h3>
                <div className="space-y-4">
                  {medlemmer.map(m => (
                    <div key={m.user_id} className="flex items-center justify-between cursor-pointer group" onClick={() => setSelectedMember(m)}>
                      <div className="flex items-center gap-4">
                        <div className="w-12 h-12 rounded-xl bg-gray-100 overflow-hidden">
                          {m.users?.avatar_url && <img src={resolveAvatarUrl(m.users.avatar_url)!} className="w-full h-full object-cover" />}
                        </div>
                        <div>
                          <p className="font-bold text-sm group-hover:underline">{getDisplayName(m)}</p>
                          <p className="text-[10px] font-black text-gray-400 uppercase tracking-widest">{m.rolle || 'Medlem'}</p>
                        </div>
                      </div>
                    </div>
                  ))}
                </div>
              </>
            )}
          </div>
        </div>
      )}

      <SiteFooter />
    </div>
  );
}