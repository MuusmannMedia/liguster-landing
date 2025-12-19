'use client';

import { useState, useEffect, useMemo, useRef } from 'react';
import { useParams, useRouter } from 'next/navigation';
import { supabase } from '../../../lib/supabaseClient';
import SiteHeader from '../../../components/SiteHeader';
import SiteFooter from '../../../components/SiteFooter';
import Image from 'next/image';

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

type Thread = { id: string; title: string; created_at: string; created_by: string };
type Event = { id: string; title: string; start_at: string; end_at: string; location?: string; price?: number };
type ImagePreview = { id: number; image_url: string };

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

const fmtDate = (d: string) => new Date(d).toLocaleDateString("da-DK", { day: 'numeric', month: 'short' });
const fmtTime = (d: string) => new Date(d).toLocaleTimeString("da-DK", { hour: '2-digit', minute: '2-digit' });

// --- KALENDER HJÆLPERE ---
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
  const id = params.id as string;
  
  const [loading, setLoading] = useState(true);
  const [forening, setForening] = useState<Forening | null>(null);
  const [medlemmer, setMedlemmer] = useState<Medlem[]>([]);
  const [userId, setUserId] = useState<string | null>(null);
  const [uploading, setUploading] = useState(false);
  
  // Ref til fil-input
  const fileInputRef = useRef<HTMLInputElement>(null);

  // Previews Data
  const [threads, setThreads] = useState<Thread[]>([]);
  const [events, setEvents] = useState<Event[]>([]);
  const [images, setImages] = useState<ImagePreview[]>([]);

  // Kalender State
  const [monthCursor, setMonthCursor] = useState(new Date());
  const [calendarEvents, setCalendarEvents] = useState<Event[]>([]);
  const [selectedDateEvents, setSelectedDateEvents] = useState<{date: string, events: Event[]} | null>(null);

  // Modal State
  const [showMembers, setShowMembers] = useState(false);
  const [selectedMember, setSelectedMember] = useState<Medlem | null>(null);
  
  useEffect(() => {
    const init = async () => {
      const { data: { session } } = await supabase.auth.getSession();
      if (session) setUserId(session.user.id);
      await Promise.all([
        fetchForening(), 
        fetchMedlemmer(),
        fetchThreads(),
        fetchEvents(),
        fetchImages()
      ]);
      setLoading(false);
    };
    init();
  }, [id]);

  useEffect(() => {
    fetchCalendarEvents(monthCursor);
  }, [id, monthCursor]);

  const fetchForening = async () => {
    const { data } = await supabase.from("foreninger").select("*").eq("id", id).single();
    setForening(data);
  };

  const fetchMedlemmer = async () => {
    const { data } = await supabase
      .from("foreningsmedlemmer")
      .select("user_id, rolle, status, users:users!foreningsmedlemmer_user_id_fkey (name, username, avatar_url, email)")
      .eq("forening_id", id);
    if (data) setMedlemmer(data as unknown as Medlem[]);
  };

  const fetchThreads = async () => {
    const { data } = await supabase.from("forening_threads").select("*").eq("forening_id", id).order("created_at", { ascending: false }).limit(3);
    if (data) setThreads(data);
  };

  const fetchEvents = async () => {
    const { data } = await supabase.from("forening_events").select("*").eq("forening_id", id).order("start_at", { ascending: false }).limit(3);
    if (data) setEvents(data);
  };

  const fetchCalendarEvents = async (base: Date) => {
    const first = startOfMonth(base);
    const last = endOfMonth(base);
    const bufferStart = new Date(first); bufferStart.setDate(first.getDate() - 7);
    const bufferEnd = new Date(last); bufferEnd.setDate(last.getDate() + 7);

    const { data } = await supabase
      .from("forening_events")
      .select("id, title, start_at, end_at, location, price")
      .eq("forening_id", id)
      .gte("start_at", bufferStart.toISOString())
      .lte("start_at", bufferEnd.toISOString());
    
    if (data) setCalendarEvents(data);
  };

  const fetchImages = async () => {
    const { data: evs } = await supabase.from("forening_events").select("id").eq("forening_id", id).limit(5);
    if (evs && evs.length > 0) {
      const ids = evs.map(e => e.id);
      const { data } = await supabase.from("event_images").select("id, image_url").in("event_id", ids).order("created_at", { ascending: false }).limit(3);
      if (data) setImages(data);
    }
  };

  // --- HANDLINGS-FUNKTIONER ---

  // 1. Bliv medlem
  const handleJoin = async () => {
    if (!userId) return alert("Du skal være logget ind for at blive medlem.");
    const { error } = await supabase
      .from('foreningsmedlemmer')
      .insert([{ forening_id: id, user_id: userId, rolle: 'medlem', status: 'pending' }]);

    if (error) {
      alert('Fejl ved tilmelding: ' + error.message);
    } else {
      alert('Din anmodning er sendt! Du afventer nu godkendelse.');
      fetchMedlemmer(); 
    }
  };

  // 2. Forlad forening
  const handleLeave = async () => {
    if (!confirm("Er du sikker på, at du vil melde dig ud af foreningen?")) return;
    
    const { error } = await supabase
      .from('foreningsmedlemmer')
      .delete()
      .eq('forening_id', id)
      .eq('user_id', userId);

    if (error) {
      alert("Fejl: " + error.message);
    } else {
      alert("Du har forladt foreningen.");
      fetchMedlemmer(); // Opdater UI
    }
  };

  // 3. Upload billede
  const triggerImageSelect = () => {
    fileInputRef.current?.click();
  };

  const handleImageUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    if (!e.target.files || e.target.files.length === 0) return;
    const file = e.target.files[0];
    
    setUploading(true);
    const fileName = `${id}_${Date.now()}`;
    
    // Upload til Storage
    const { data, error: uploadError } = await supabase.storage
      .from('foreningsbilleder') // Sørg for at denne bucket findes og er public
      .upload(fileName, file);

    if (uploadError) {
      alert("Kunne ikke uploade billede: " + uploadError.message);
      setUploading(false);
      return;
    }

    // Hent public URL
    const { data: publicUrlData } = supabase.storage
      .from('foreningsbilleder')
      .getPublicUrl(fileName);

    // Opdater forening i DB
    const { error: dbError } = await supabase
      .from('foreninger')
      .update({ billede_url: publicUrlData.publicUrl })
      .eq('id', id);

    if (dbError) {
      alert("Fejl ved opdatering af database: " + dbError.message);
    } else {
      // Opdater visning
      fetchForening();
    }
    setUploading(false);
  };

  // 4. Slet forening
  const handleDeleteForening = async () => {
    if (!confirm("ADVARSEL: Er du sikker på, at du vil slette denne forening permanent? Dette kan ikke fortrydes.")) return;
    
    const { error } = await supabase
      .from('foreninger')
      .delete()
      .eq('id', id);

    if (error) {
      alert("Kunne ikke slette forening: " + error.message);
    } else {
      alert("Foreningen er slettet.");
      router.push('/opslag'); // Eller hvor du vil sende dem hen
    }
  };

  // Beregn status
  const approved = medlemmer.filter(m => m.status === "approved");
  const pending = medlemmer.filter(m => m.status === "pending");
  
  const isMember = approved.some(m => m.user_id === userId);
  const isPending = pending.some(m => m.user_id === userId);
  const isOwner = forening?.oprettet_af === userId;

  const eventsByDate = useMemo(() => {
    const map = new Map<string, Event[]>();
    calendarEvents.forEach(e => {
      const key = toKey(new Date(e.start_at));
      const list = map.get(key) || [];
      list.push(e);
      map.set(key, list);
    });
    return map;
  }, [calendarEvents]);

  const changeMonth = (delta: number) => {
    setMonthCursor(prev => new Date(prev.getFullYear(), prev.getMonth() + delta, 1));
  };

  if (loading) return <div className="min-h-screen bg-[#869FB9] flex items-center justify-center"><div className="animate-spin rounded-full h-12 w-12 border-b-2 border-[#131921]"></div></div>;
  if (!forening) return <div className="min-h-screen bg-[#869FB9] p-10 text-center text-white">Forening ikke fundet</div>;

  return (
    <div className="min-h-screen flex flex-col bg-[#869FB9]">
      <SiteHeader />

      <main className="flex-1 w-full max-w-4xl mx-auto p-4 pb-20 space-y-6">
        
        {/* Skjult input til fil-upload */}
        <input 
          type="file" 
          accept="image/*" 
          ref={fileInputRef} 
          className="hidden" 
          onChange={handleImageUpload}
        />

        {/* --- FORENING INFO KORT --- */}
        <div className="bg-white rounded-[24px] p-5 shadow-md mt-6">
          <div className="relative w-full aspect-square rounded-[18px] overflow-hidden bg-gray-100 mb-4">
            {forening.billede_url ? (
              <img src={forening.billede_url} className="w-full h-full object-cover" alt="Cover" />
            ) : (
              <div className="w-full h-full flex items-center justify-center text-gray-400">Intet billede</div>
            )}
          </div>

          <h1 className="text-2xl font-black text-[#131921] mb-1 underline decoration-gray-300">{forening.navn}</h1>
          <p className="text-gray-700 font-bold mb-4">{forening.sted}</p>
          
          <p className="text-[#444] text-sm leading-relaxed whitespace-pre-wrap mb-4">
            {forening.beskrivelse}
          </p>

          {!isMember && (
            isPending ? (
               <div className="w-full py-3 bg-gray-400 text-white rounded-full font-bold text-center cursor-default">
                 Afventer godkendelse...
               </div>
            ) : (
              <button 
                onClick={handleJoin}
                className="w-full py-3 bg-[#131921] text-white rounded-full font-bold shadow-md hover:bg-gray-900 transition-colors"
              >
                Bliv medlem
              </button>
            )
          )}
        </div>

        {/* --- BESKEDER KNAP --- */}
        <button 
          onClick={() => router.push(`/beskeder?id=${id}`)}
          className="w-full bg-white p-4 rounded-[24px] shadow-sm flex items-center hover:bg-gray-50 transition-colors"
        >
           <div className="bg-[#131921] text-white px-4 py-2 rounded-full font-black text-sm tracking-wider">
             BESKEDER
           </div>
        </button>

        {/* --- MEDLEMMER PREVIEW --- */}
        <div className="bg-white rounded-[24px] p-4 shadow-sm">
          <div className="flex justify-between items-center mb-3 px-2">
            <h3 className="font-black text-[#131921]">MEDLEMMER</h3>
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

        {/* --- SAMTALER PREVIEW --- */}
        <div 
          onClick={() => router.push(`/forening/${id}/threads`)} 
          className="bg-white rounded-[24px] p-4 shadow-sm cursor-pointer hover:shadow-md transition-shadow"
        >
          <div className="bg-[#131921] text-white px-4 py-1.5 rounded-full font-black text-sm tracking-wider inline-block mb-3">
            SAMTALER
          </div>
          {threads.length === 0 ? <p className="text-sm text-gray-400">Ingen tråde endnu.</p> : (
            <div className="space-y-3">
              {threads.map((t, idx) => (
                <div key={t.id} className={`flex justify-between ${idx !== 0 ? 'border-t border-gray-100 pt-3' : ''}`}>
                  <div>
                    <h4 className="font-bold text-[#131921] text-lg">{t.title}</h4>
                    <p className="text-xs text-gray-500 mt-1">Oprettet {fmtDate(t.created_at)}</p>
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>

        {/* --- AKTIVITETER PREVIEW --- */}
        <div 
          onClick={() => router.push(`/forening/${id}/events`)} 
          className="bg-white rounded-[24px] p-4 shadow-sm cursor-pointer hover:shadow-md transition-shadow"
        >
          <div className="bg-[#131921] text-white px-4 py-1.5 rounded-full font-black text-sm tracking-wider inline-block mb-3">
            AKTIVITETER
          </div>
          {events.length === 0 ? <p className="text-sm text-gray-400">Ingen aktiviteter endnu.</p> : (
            <div className="space-y-3">
              {events.map((e, idx) => (
                <div key={e.id} className={`flex justify-between ${idx !== 0 ? 'border-t border-gray-100 pt-3' : ''}`}>
                  <div>
                    <h4 className="font-bold text-[#131921] text-lg">{e.title}</h4>
                    <p className="text-xs text-gray-500 mt-1">{fmtDate(e.start_at)} {e.location && `• ${e.location}`}</p>
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>

        {/* --- KALENDER SEKTION --- */}
        <div className="bg-white rounded-[24px] p-4 shadow-sm">
          <div className="bg-[#131921] text-white px-4 py-1.5 rounded-full font-black text-sm tracking-wider inline-block mb-3">
            KALENDER
          </div>
          
          <div className="flex items-center justify-between mb-4 px-2">
            <button onClick={() => changeMonth(-1)} className="w-8 h-8 flex items-center justify-center rounded-full bg-gray-100 hover:bg-gray-200">‹</button>
            <h3 className="font-bold text-[#131921] capitalize">
              {monthCursor.toLocaleDateString("da-DK", { month: 'long', year: 'numeric' })}
            </h3>
            <button onClick={() => changeMonth(1)} className="w-8 h-8 flex items-center justify-center rounded-full bg-gray-100 hover:bg-gray-200">›</button>
          </div>

          <div className="grid grid-cols-7 text-center mb-2">
            {['Man', 'Tir', 'Ons', 'Tor', 'Fre', 'Lør', 'Søn'].map(d => (
              <span key={d} className="text-xs font-bold text-gray-400 uppercase">{d}</span>
            ))}
          </div>

          <div className="grid grid-cols-7 gap-1">
            {buildMonthGrid(monthCursor).map((week, wIdx) => (
              week.map((day, dIdx) => {
                const isCurrentMonth = day.getMonth() === monthCursor.getMonth();
                const key = toKey(day);
                const dayEvents = eventsByDate.get(key) || [];
                const hasEvents = dayEvents.length > 0;

                return (
                  <div 
                    key={`${wIdx}-${dIdx}`} 
                    onClick={() => hasEvents && setSelectedDateEvents({ date: key, events: dayEvents })}
                    className={`aspect-square flex flex-col items-center justify-center rounded-lg text-sm relative cursor-pointer ${
                      isCurrentMonth ? 'text-gray-800' : 'text-gray-300'
                    } ${hasEvents ? 'bg-blue-50 font-bold hover:bg-blue-100' : ''}`}
                  >
                    {day.getDate()}
                    {hasEvents && (
                      <div className="absolute bottom-1.5 w-1.5 h-1.5 bg-[#131921] rounded-full"></div>
                    )}
                  </div>
                );
              })
            ))}
          </div>
        </div>

        {/* --- BILLEDER PREVIEW --- */}
        <div 
          onClick={() => router.push(`/forening/${id}/images`)} 
          className="bg-white rounded-[24px] p-4 shadow-sm cursor-pointer hover:shadow-md transition-shadow"
        >
          <div className="bg-[#131921] text-white px-4 py-1.5 rounded-full font-black text-sm tracking-wider inline-block mb-3">
            BILLEDER
          </div>
          {images.length === 0 ? <p className="text-sm text-gray-400">Ingen billeder endnu.</p> : (
            <div className="flex gap-2 mt-2">
              {images.map(img => (
                <div key={img.id} className="w-24 h-24 rounded-[14px] overflow-hidden bg-gray-100 relative">
                  <Image src={img.image_url} alt="" fill className="object-cover" />
                </div>
              ))}
            </div>
          )}
        </div>

        {/* --- BUND HANDLINGER (NU AKTIVE) --- */}
        <div className="bg-white rounded-[24px] p-4 shadow-sm space-y-3 mb-10">
           {isMember && (
             <button 
               onClick={handleLeave}
               className="w-full py-3 bg-gray-200 text-gray-600 rounded-full font-bold hover:bg-gray-300 transition-colors"
             >
               Afslut medlemskab
             </button>
           )}
           {isOwner && (
             <>
               <button 
                 onClick={triggerImageSelect}
                 disabled={uploading}
                 className="w-full py-3 bg-[#131921] text-white rounded-full font-bold hover:bg-gray-900 transition-colors disabled:opacity-50"
               >
                 {uploading ? "Uploader..." : "Upload foreningsbillede"}
               </button>
               
               <button 
                 onClick={handleDeleteForening}
                 className="w-full py-3 bg-red-100 text-red-600 rounded-full font-bold hover:bg-red-200 transition-colors"
               >
                 Slet forening
               </button>
             </>
           )}
        </div>

      </main>
      <SiteFooter />

      {/* MEDLEMS MODAL */}
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
                <h3 className="text-xl font-bold">{getDisplayName(selectedMember)}</h3>
                <p className="text-[10px] uppercase font-bold text-[#131921] mb-1">{selectedMember.rolle || 'MEDLEM'}</p>
                <p className="text-sm text-gray-500 mb-6">{selectedMember.users?.email}</p>
                
                <button 
                  onClick={() => router.push(`/beskeder?dmUser=${selectedMember.user_id}`)}
                  className="w-full py-3 bg-[#131921] text-white rounded-full font-bold mb-3 hover:bg-gray-900 transition-colors"
                >
                  Skriv til medlem
                </button>

                <button onClick={() => setSelectedMember(null)} className="text-sm font-bold text-gray-400 hover:text-black mt-2">← Tilbage til liste</button>
              </div>
            ) : (
              <div className="max-h-[60vh] overflow-y-auto">
                <h3 className="font-black text-[#131921] mb-4">MEDLEMMER ({approved.length})</h3>
                {approved.map(m => {
                  const avatarSrc = getAvatarUrl(m.users?.avatar_url);
                  return (
                    <div key={m.user_id} onClick={() => setSelectedMember(m)} className="flex items-center gap-3 p-2 hover:bg-gray-50 rounded-xl cursor-pointer">
                      <div className="w-10 h-10 rounded-[10px] bg-gray-100 overflow-hidden">
                        {avatarSrc ? <img src={avatarSrc} className="w-full h-full object-cover" /> : null}
                      </div>
                      <div>
                        <p className="font-bold text-sm">{getDisplayName(m)}</p>
                        <p className="text-[10px] text-gray-500 uppercase font-bold text-[#131921]">{m.rolle || 'MEDLEM'}</p>
                      </div>
                    </div>
                  );
                })}
              </div>
            )}
          </div>
        </div>
      )}

      {/* KALENDER EVENT MODAL */}
      {selectedDateEvents && (
        <div className="fixed inset-0 z-[200] flex items-center justify-center p-4 bg-black/80 backdrop-blur-sm animate-in fade-in duration-200">
          <div className="bg-white w-full max-w-md rounded-[24px] shadow-2xl p-5 relative">
            <button onClick={() => setSelectedDateEvents(null)} className="absolute top-4 right-4 text-gray-400 hover:text-black text-xl">✕</button>
            
            <h3 className="font-black text-[#131921] mb-1 capitalize">
              {new Date(selectedDateEvents.date).toLocaleDateString("da-DK", { weekday: 'long', day: 'numeric', month: 'long' })}
            </h3>
            <p className="text-xs text-gray-500 mb-4">{selectedDateEvents.events.length} aktiviteter</p>

            <div className="space-y-3 max-h-[50vh] overflow-y-auto">
              {selectedDateEvents.events.map(e => (
                <div key={e.id} className="bg-gray-50 p-3 rounded-xl">
                  <h4 className="font-bold text-[#131921]">{e.title}</h4>
                  <p className="text-xs text-gray-600 mt-1">
                    {fmtTime(e.start_at)} {e.end_at ? `- ${fmtTime(e.end_at)}` : ''}
                  </p>
                  {e.location && <p className="text-xs text-gray-500 mt-0.5">📍 {e.location}</p>}
                </div>
              ))}
            </div>
          </div>
        </div>
      )}

    </div>
  );
}