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
  status?: 'pending' | 'approved' | 'declined' | null;
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
  const email = user?.email || '';
  return email.includes('@') ? email.split('@')[0] : 'Ukendt';
};

const getAvatarUrl = (path: string | null | undefined) => {
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
  new Date(d).toLocaleDateString('da-DK', { day: 'numeric', month: 'long' });

const fmtTime = (d: any) =>
  new Date(d).toLocaleTimeString('da-DK', { hour: '2-digit', minute: '2-digit' });

const toKey = (d: Date) => `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;

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
  const weeks: Date[][] = [];
  for (let i = 0; i < 6; i++) weeks.push(cells.slice(i * 7, i * 7 + 7));
  return weeks;
};

const dayColorClass = (events: Event[]) => {
  if (!events || events.length === 0) return '';
  return 'bg-[#131921] text-white'; 
};

export default function ForeningDetaljePage() {
  const params = useParams();
  const router = useRouter();
  const idOrSlug = params.id as string;

  const [forening, setForening] = useState<Forening | null>(null);
  const [loading, setLoading] = useState(true);
  const [realForeningId, setRealForeningId] = useState<string | null>(null);
  const [userId, setUserId] = useState<string | null>(null);
  const [uploading, setUploading] = useState(false);

  const [isEditing, setIsEditing] = useState(false);
  const [descExpanded, setDescExpanded] = useState(false);
  const [editNavn, setEditNavn] = useState('');
  const [editSted, setEditSted] = useState('');
  const [editDescription, setEditDescription] = useState('');

  const [medlemmer, setMedlemmer] = useState<Medlem[]>([]);
  const [threads, setThreads] = useState<Thread[]>([]);
  const [events, setEvents] = useState<Event[]>([]);
  const [images, setImages] = useState<ImagePreview[]>([]);
  const [calendarEvents, setCalendarEvents] = useState<Event[]>([]);

  const [showMembers, setShowMembers] = useState(false);
  const [showInvite, setShowInvite] = useState(false);
  const [selectedMember, setSelectedMember] = useState<Medlem | null>(null);
  const [searchQuery, setSearchQuery] = useState('');
  const [searchResults, setSearchResults] = useState<UserSearchResult[]>([]);

  const [monthCursor, setMonthCursor] = useState(new Date());
  const [selectedDayKey, setSelectedDayKey] = useState<string | null>(null);

  const fileInputRef = useRef<HTMLInputElement>(null);

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
        if (!foreningData) return setLoading(false);

        setForening(foreningData);
        setRealForeningId(foreningData.id);
        setEditNavn(foreningData.navn);
        setEditSted(foreningData.sted);
        setEditDescription(foreningData.beskrivelse);

        const [resM, resT, resE, resC] = await Promise.all([
          supabase.from('foreningsmedlemmer').select('user_id, rolle, status, users:users!foreningsmedlemmer_user_id_fkey (name, username, avatar_url, email)').eq('forening_id', foreningData.id),
          supabase.from('forening_threads').select('*').eq('forening_id', foreningData.id).order('created_at', { ascending: false }).limit(3),
          supabase.from('forening_events').select('*').eq('forening_id', foreningData.id).order('start_at', { ascending: false }).limit(3),
          supabase.from('forening_events').select('*').eq('forening_id', foreningData.id)
        ]);

        if (resM.data) setMedlemmer(resM.data as any);
        if (resT.data) setThreads(resT.data);
        if (resE.data) setEvents(resE.data);
        if (resC.data) {
          setCalendarEvents(resC.data);
          const eIds = resC.data.map(e => e.id);
          if (eIds.length > 0) {
            const { data: imgData } = await supabase.from('event_images').select('id, image_url').in('event_id', eIds).limit(8);
            if (imgData) setImages(imgData);
          }
        }
      } finally { setLoading(false); }
    }
    loadAllData();
  }, [idOrSlug]);

  const handleInviteSearch = async (val: string) => {
    setSearchQuery(val);
    if (val.length < 2) return setSearchResults([]);
    const { data } = await supabase.from('users').select('id, name, username, avatar_url').or(`name.ilike.%${val}%,username.ilike.%${val}%`).limit(5);
    if (data) setSearchResults(data.filter(u => !medlemmer.some(m => m.user_id === u.id)));
  };

  const inviteUser = async (targetId: string) => {
    if (!realForeningId) return;
    await supabase.from('foreningsmedlemmer').insert([{ forening_id: realForeningId, user_id: targetId, status: 'pending', rolle: 'medlem' }]);
    alert('Invitation sendt!');
    setShowInvite(false);
  };

  const handleSaveInfo = async () => {
    if (!realForeningId) return;
    const { error } = await supabase.from('foreninger').update({ navn: editNavn, sted: editSted, beskrivelse: editDescription }).eq('id', realForeningId);
    if (!error) {
      setForening(prev => prev ? { ...prev, navn: editNavn, sted: editSted, beskrivelse: editDescription } : null);
      setIsEditing(false);
    }
  };

  const eventsByDate = useMemo(() => {
    const map = new Map<string, Event[]>();
    calendarEvents.forEach(e => {
      const key = toKey(new Date(e.start_at));
      map.set(key, [...(map.get(key) || []), e]);
    });
    return map;
  }, [calendarEvents]);

  const approved = medlemmer.filter(m => m.status === 'approved');
  const myMembership = medlemmer.find(m => m.user_id === userId);
  const isApprovedMember = myMembership?.status === 'approved';
  const isMeAdmin = isOwner || myMembership?.rolle === 'admin';
  const isOwner = forening?.oprettet_af === userId;

  if (loading) return <div className="min-h-screen bg-[#869FB9] flex items-center justify-center font-black text-white">Indlæser...</div>;
  if (!forening) return <div className="min-h-screen bg-[#869FB9] p-10 text-center text-white">Forening ikke fundet</div>;

  return (
    <div className="min-h-screen flex flex-col bg-[#869FB9]">
      <SiteHeader />

      <main className="flex-1 w-full max-w-4xl mx-auto p-4 pb-20 space-y-6">
        {/* HERO */}
        <div className="bg-white rounded-[24px] p-5 shadow-md mt-6 flex flex-col gap-4">
          <div className="relative w-full aspect-square md:aspect-video rounded-[18px] overflow-hidden bg-gray-100">
            {forening.billede_url ? (
              <img src={forening.billede_url} className="w-full h-full object-cover" alt="Cover" />
            ) : ( <div className="w-full h-full flex items-center justify-center text-gray-400 font-bold">Ingen forside</div> )}
          </div>

          <div className="w-full">
            {isEditing ? (
              <div className="flex flex-col gap-3">
                <input value={editNavn} onChange={e => setEditNavn(e.target.value)} className="w-full p-3 border rounded-xl font-bold" />
                <input value={editSted} onChange={e => setEditSted(e.target.value)} className="w-full p-3 border rounded-xl" />
                <textarea value={editDescription} onChange={e => setEditDescription(e.target.value)} className="w-full min-h-[120px] p-3 border rounded-xl" />
                <div className="flex gap-2 justify-end">
                  <button onClick={() => setIsEditing(false)} className="px-4 py-2 bg-gray-100 rounded-full text-xs font-bold">ANNULLER</button>
                  <button onClick={handleSaveInfo} className="px-4 py-2 bg-[#131921] text-white rounded-full text-xs font-bold">GEM</button>
                </div>
              </div>
            ) : (
              <div className="flex flex-col gap-1">
                <h1 className="text-2xl font-black text-[#131921] underline decoration-gray-300">{forening.navn}</h1>
                <p className="text-gray-700 font-bold mb-3">{forening.sted}</p>
                <div className="relative">
                  <p className={`text-[#444] text-sm whitespace-pre-wrap ${!descExpanded && 'line-clamp-3'}`}>{forening.beskrivelse}</p>
                  <button onClick={() => setDescExpanded(!descExpanded)} className="text-[#131921] font-bold text-xs mt-2 hover:underline">
                    {descExpanded ? 'Læs mindre' : 'Læs mere'}
                  </button>
                </div>

                {isApprovedMember && (
                  <div className="flex flex-wrap gap-2 mt-5">
                    <button onClick={() => { navigator.clipboard.writeText(window.location.href); alert('Link kopieret!'); }} className="px-4 py-2 bg-[#e9eef5] text-[#131921] text-xs font-bold rounded-full uppercase">Kopiér link</button>
                    <button onClick={() => { if (navigator.share) navigator.share({ title: forening.navn, url: window.location.href }); }} className="px-4 py-2 bg-[#e9eef5] text-[#131921] text-xs font-bold rounded-full uppercase">Del</button>
                    {isMeAdmin && (
                      <>
                        <button onClick={() => setIsEditing(true)} className="px-4 py-2 bg-[#e9eef5] text-[#131921] text-xs font-bold rounded-full uppercase">Rediger</button>
                        <button onClick={() => setShowInvite(true)} className="px-4 py-2 bg-[#e9eef5] text-[#131921] text-xs font-bold rounded-full uppercase">Inviter</button>
                      </>
                    )}
                  </div>
                )}
              </div>
            )}
          </div>
        </div>

        {isApprovedMember && (
          <>
            <button onClick={() => router.push(`/beskeder?id=${realForeningId}`)} className="w-full bg-white p-4 rounded-[24px] shadow-sm flex items-center hover:bg-gray-50 transition-colors">
              <div className="bg-[#131921] text-white px-4 py-2 rounded-full font-black text-sm tracking-wider uppercase">BESKEDER</div>
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
                    <div className="w-14 h-14 rounded-[14px] bg-gray-100 overflow-hidden mb-1">
                      {getAvatarUrl(m.users?.avatar_url) ? ( <img src={getAvatarUrl(m.users?.avatar_url)!} className="w-full h-full object-cover" alt="" /> ) : ( <div className="w-full h-full flex items-center justify-center font-bold text-gray-400">?</div> )}
                    </div>
                    <span className="text-[10px] font-bold text-black truncate w-16 text-center">{getDisplayName(m)}</span>
                  </div>
                ))}
              </div>
            </div>

            {/* SAMTALER OG AKTIVITETER GRID */}
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <div onClick={() => router.push(`/forening/${realForeningId}/threads`)} className="bg-white rounded-[24px] p-4 shadow-sm cursor-pointer hover:shadow-md transition-shadow h-full">
                <div className="bg-[#131921] text-white px-4 py-1.5 rounded-full font-black text-xs tracking-wider inline-block mb-3 uppercase">SAMTALER</div>
                {threads.length === 0 ? ( <p className="text-xs text-gray-400">Ingen tråde endnu.</p> ) : (
                  <div className="space-y-3">
                    {threads.map((t, idx) => (
                      <div key={t.id} className={`${idx !== 0 ? 'border-t border-gray-100 pt-3' : ''}`}>
                        <h4 className="font-bold text-[#131921] text-sm line-clamp-1">{t.title}</h4>
                        <p className="text-[10px] text-gray-500 mt-1">Oprettet {fmtDate(t.created_at)}</p>
                      </div>
                    ))}
                  </div>
                )}
              </div>

              <div onClick={() => router.push(`/forening/${realForeningId}/events`)} className="bg-white rounded-[24px] p-4 shadow-sm cursor-pointer hover:shadow-md transition-shadow h-full">
                <div className="bg-[#131921] text-white px-4 py-1.5 rounded-full font-black text-xs tracking-wider inline-block mb-3 uppercase">AKTIVITETER</div>
                {events.length === 0 ? ( <p className="text-xs text-gray-400">Ingen aktiviteter endnu.</p> ) : (
                  <div className="space-y-3">
                    {events.map((e, idx) => (
                      <div key={e.id} className={`${idx !== 0 ? 'border-t border-gray-100 pt-3' : ''}`}>
                        <h4 className="font-bold text-[#131921] text-sm line-clamp-1">{e.title}</h4>
                        <p className="text-[10px] text-gray-500 mt-1">{fmtDate(e.start_at)}</p>
                      </div>
                    ))}
                  </div>
                )}
              </div>
            </div>

            {/* KALENDER OG BILLEDER GRID */}
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <div className="bg-white rounded-[24px] p-4 shadow-sm h-full">
                <div className="bg-[#131921] text-white px-4 py-1.5 rounded-full font-black text-xs tracking-wider inline-block mb-3 uppercase">KALENDER</div>
                <div className="flex items-center justify-between mb-3">
                  <button onClick={() => setMonthCursor(new Date(monthCursor.getFullYear(), monthCursor.getMonth() - 1, 1))} className="w-8 h-8 flex items-center justify-center rounded-full bg-gray-50 font-bold">❮</button>
                  <h3 className="font-black text-[#131921] text-sm capitalize">{monthCursor.toLocaleDateString('da-DK', { month: 'long', year: 'numeric' })}</h3>
                  <button onClick={() => setMonthCursor(new Date(monthCursor.getFullYear(), monthCursor.getMonth() + 1, 1))} className="w-8 h-8 flex items-center justify-center rounded-full bg-gray-50 font-bold">❯</button>
                </div>
                <div className="grid grid-cols-7 gap-1 text-[8px] font-black text-gray-400 uppercase mb-2">
                  {['Man', 'Tir', 'Ons', 'Tor', 'Fre', 'Lør', 'Søn'].map(d => <div key={d} className="text-center">{d}</div>)}
                </div>
                <div className="grid grid-cols-7 gap-1">
                  {buildMonthGrid(monthCursor).flat().map((day, idx) => {
                    const key = toKey(day);
                    const hasEvents = eventsByDate.has(key);
                    const isOtherMonth = day.getMonth() !== monthCursor.getMonth();
                    return (
                      <button key={idx} onClick={() => hasEvents && setSelectedDayKey(key)} className={`aspect-square rounded-lg flex items-center justify-center text-[10px] font-bold ${hasEvents ? 'bg-[#131921] text-white shadow-sm' : isOtherMonth ? 'text-gray-200' : 'text-gray-800'}`}>
                        {day.getDate()}
                      </button>
                    );
                  })}
                </div>
              </div>

              <div onClick={() => router.push(`/forening/${realForeningId}/images`)} className="bg-white rounded-[24px] p-4 shadow-sm cursor-pointer hover:shadow-md h-full transition-shadow">
                <div className="bg-[#131921] text-white px-4 py-1.5 rounded-full font-black text-xs tracking-wider inline-block mb-3 uppercase">BILLEDER</div>
                <div className="grid grid-cols-3 gap-2">
                  {images.length === 0 ? ( <p className="text-xs text-gray-400 col-span-3">Ingen billeder endnu.</p> ) : (
                    images.slice(0, 6).map((img) => (
                      <div key={img.id} className="aspect-square rounded-xl overflow-hidden bg-gray-100">
                        <img src={getEventImageUrl(img.image_url)} className="w-full h-full object-cover" alt="Event" />
                      </div>
                    ))
                  )}
                </div>
              </div>
            </div>

            <div className="bg-white rounded-[24px] p-4 shadow-sm flex flex-col md:flex-row gap-3 mb-10">
              <button onClick={handleLeave} className="flex-1 py-3 bg-gray-100 text-gray-600 rounded-full font-bold hover:bg-gray-200 transition-colors">Afslut medlemskab</button>
              {isMeAdmin && ( <button onClick={() => fileInputRef.current?.click()} className="flex-1 py-3 bg-[#e9eef5] text-[#131921] rounded-full font-bold hover:bg-[#d0dbe9] transition-colors">Skift billede</button> )}
            </div>
          </>
        )}
      </main>

      {/* MODAL: INVITER */}
      {showInvite && (
        <div className="fixed inset-0 z-[300] flex items-center justify-center p-4 bg-black/80 backdrop-blur-sm animate-in fade-in duration-200">
          <div className="bg-white w-full max-w-md rounded-[24px] shadow-2xl p-6 relative">
            <button onClick={() => setShowInvite(false)} className="absolute top-4 right-4 text-gray-400 text-xl font-black">✕</button>
            <h3 className="text-xl font-black text-[#131921] mb-4 uppercase">Inviter bruger</h3>
            <input placeholder="Søg på navn..." onChange={e => handleInviteSearch(e.target.value)} className="w-full p-3 border rounded-xl mb-4 font-bold" />
            <div className="space-y-3">
              {searchResults.map(u => (
                <div key={u.id} className="flex items-center justify-between p-2 hover:bg-gray-50 rounded-xl transition-colors">
                  <div className="flex items-center gap-3">
                    <div className="w-10 h-10 rounded-full bg-gray-100 overflow-hidden">
                      {getAvatarUrl(u.avatar_url) ? <img src={getAvatarUrl(u.avatar_url)!} className="w-full h-full object-cover" /> : <div className="w-full h-full flex items-center justify-center font-bold text-gray-400">?</div>}
                    </div>
                    <div>
                      <p className="font-bold text-sm text-black">{u.name}</p>
                      <p className="text-[10px] text-gray-400 uppercase font-bold">@{u.username}</p>
                    </div>
                  </div>
                  <button onClick={() => inviteUser(u.id)} className="bg-[#131921] text-white px-4 py-1.5 rounded-full text-[10px] font-black uppercase">Inviter</button>
                </div>
              ))}
              {searchQuery.length >= 2 && searchResults.length === 0 && <p className="text-center text-gray-400 text-xs py-4">Ingen brugere fundet.</p>}
            </div>
          </div>
        </div>
      )}

      {/* ... (MEDLEMS MODAL OG BESKED MODAL BLIVER HERUNDER SOM I TIDLIGERE KODE) */}
      <SiteFooter />
    </div>
  );
}