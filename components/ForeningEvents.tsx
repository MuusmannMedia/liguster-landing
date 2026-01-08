'use client';

import { useState, useEffect, useRef, useMemo } from 'react';
import { supabase } from '../lib/supabaseClient';

// --- TYPER ---
type EventRow = {
  id: string;
  forening_id: string;
  title: string;
  description: string | null;
  location: string | null;
  start_at: string;
  end_at: string;
  price: number | null;
  capacity: number | null;
  allow_registration: boolean | null;
  image_url: string | null;
  created_by: string;
  created_at: string;
};

type Attendee = {
  user_id: string;
  created_at: string;
  users?: {
    name?: string | null;
    username?: string | null;
    email?: string | null;
    avatar_url?: string | null;
  } | null;
};

type EventImageRow = {
  id: number;
  event_id: string;
  image_url: string;
  created_at: string;
};

type Props = {
  foreningId: string;
  userId: string | null;
  isUserAdmin: boolean;
  isApprovedMember: boolean;
};

// --- HJÆLPERE ---
const fmtDate = (d: Date) => d.toLocaleDateString('da-DK', { day: 'numeric', month: 'long' });
const fmtTime = (d: Date) => d.toLocaleTimeString('da-DK', { hour: '2-digit', minute: '2-digit' });

const fmtRange = (sISO: string, eISO: string) => {
  const s = new Date(sISO);
  const e = new Date(eISO);
  const sameDay = s.toDateString() === e.toDateString();
  return sameDay
    ? `${fmtDate(s)} kl. ${fmtTime(s)} - ${fmtTime(e)}`
    : `${fmtDate(s)} ${fmtTime(s)} - ${fmtDate(e)} ${fmtTime(e)}`;
};

// ✅ Event image URL helper (matcher din tidligere getEventImageUrl)
const getEventImageUrl = (path: string | null | undefined) => {
  if (!path) return null;
  if (path.startsWith('http')) return path;
  const { data } = supabase.storage.from('event_images').getPublicUrl(path);
  return data?.publicUrl || null;
};

// Billed-komprimering (Genbrug)
async function resizeImage(file: File, maxWidth = 1200, quality = 0.8): Promise<Blob> {
  return new Promise((resolve, reject) => {
    const img = document.createElement('img');
    const objectUrl = URL.createObjectURL(file);
    img.src = objectUrl;

    img.onload = () => {
      URL.revokeObjectURL(objectUrl);
      const canvas = document.createElement('canvas');
      const scaleFactor = Math.min(1, maxWidth / img.width);
      canvas.width = img.width * scaleFactor;
      canvas.height = img.height * scaleFactor;

      const ctx = canvas.getContext('2d');
      if (!ctx) return reject(new Error('Canvas error'));

      ctx.drawImage(img, 0, 0, canvas.width, canvas.height);
      canvas.toBlob(
        (blob) => (blob ? resolve(blob) : reject(new Error('Blob error'))),
        'image/jpeg',
        quality
      );
    };

    img.onerror = (e) => {
      URL.revokeObjectURL(objectUrl);
      reject(e);
    };
  });
}

export default function ForeningEvents({ foreningId, userId, isUserAdmin, isApprovedMember }: Props) {
  const [events, setEvents] = useState<EventRow[]>([]);
  const [loading, setLoading] = useState(true);
  const [regCounts, setRegCounts] = useState<Record<string, number>>({});

  // Modal / Form States
  const [showModal, setShowModal] = useState(false);
  const [modalMode, setModalMode] = useState<'create' | 'details' | 'edit'>('create');
  const [activeEvent, setActiveEvent] = useState<EventRow | null>(null);
  const [attendees, setAttendees] = useState<Attendee[]>([]);

  // ✅ Event billeder (til details modal)
  const [eventImages, setEventImages] = useState<EventImageRow[]>([]);
  const [uploadingEventImage, setUploadingEventImage] = useState(false);

  // Form Fields
  const [title, setTitle] = useState('');
  const [description, setDescription] = useState('');
  const [location, setLocation] = useState('');
  const [startAt, setStartAt] = useState('');
  const [endAt, setEndAt] = useState('');
  const [price, setPrice] = useState('');
  const [capacity, setCapacity] = useState('');
  const [allowReg, setAllowReg] = useState(false);
  const [imageFile, setImageFile] = useState<File | null>(null);
  const [loadingAction, setLoadingAction] = useState(false);

  // Push Stats
  const [pushStats, setPushStats] = useState<{ active: number; total: number } | null>(null);
  const [hasPushed, setHasPushed] = useState(false);

  // ✅ Hidden input til “upload fra kortet”
  const quickUploadInputRef = useRef<HTMLInputElement>(null);
  const uploadTargetEventRef = useRef<EventRow | null>(null);

  useEffect(() => {
    fetchEvents();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [foreningId]);

  const fetchEvents = async () => {
    setLoading(true);

    const { data } = await supabase
      .from('forening_events')
      .select('*')
      .eq('forening_id', foreningId)
      .order('start_at', { ascending: false });

    if (data) {
      setEvents(data);

      // Hent counts
      const counts: Record<string, number> = {};
      for (const ev of data) {
        const { count } = await supabase
          .from('forening_event_registrations')
          .select('*', { count: 'exact', head: true })
          .eq('event_id', ev.id);
        counts[ev.id] = count || 0;
      }
      setRegCounts(counts);
    }

    setLoading(false);
  };

  const fetchAttendees = async (eventId: string) => {
    const { data } = await supabase
      .from('forening_event_registrations')
      .select('user_id, created_at, users:users (name, username, email, avatar_url)')
      .eq('event_id', eventId)
      .order('created_at');

    if (data) setAttendees(data as any);
  };

  const fetchEventImages = async (eventId: string) => {
    const { data, error } = await supabase
      .from('event_images')
      .select('id, event_id, image_url, created_at')
      .eq('event_id', eventId)
      .order('created_at', { ascending: false })
      .limit(12);

    if (!error && data) setEventImages(data as any);
  };

  const checkPushStatus = async (eventId: string) => {
    const { data } = await supabase.from('event_push_broadcasts').select('id').eq('event_id', eventId).maybeSingle();
    setHasPushed(!!data);

    const { data: stats } = await supabase
      .from('v_forening_push_stats')
      .select('*')
      .eq('forening_id', foreningId)
      .maybeSingle();

    if (stats) setPushStats({ active: stats.active_push_members, total: stats.total_members });
  };

  // --- Upload event-billede (til event_images)
  const uploadEventImage = async (file: File, ev: EventRow) => {
    if (!userId) throw new Error('Du skal være logget ind.');
    if (!isApprovedMember) throw new Error('Du skal være godkendt medlem for at uploade billeder.');

    setUploadingEventImage(true);
    try {
      const compressed = await resizeImage(file, 1400, 0.8);

      // ✅ Storage path i bucket "event_images"
      const path = `events/${foreningId}/${ev.id}/${Date.now()}.jpg`;

      const { error: upErr } = await supabase.storage
        .from('event_images')
        .upload(path, compressed, { upsert: true, contentType: 'image/jpeg' });

      if (upErr) throw upErr;

      // ✅ Gem path i DB (ikke public URL)
      const { error: dbErr } = await supabase.from('event_images').insert([
        {
          event_id: ev.id,
          image_url: path,
          // hvis du har created_by i tabellen, kan du tilføje:
          // created_by: userId,
        },
      ]);

      if (dbErr) throw dbErr;

      // refresh modal preview hvis det er samme event
      if (activeEvent?.id === ev.id) {
        await fetchEventImages(ev.id);
      }
    } finally {
      setUploadingEventImage(false);
    }
  };

  // --- ACTIONS ---
  const handleOpenCreate = () => {
    setTitle('');
    setDescription('');
    setLocation('');
    setStartAt('');
    setEndAt('');
    setPrice('');
    setCapacity('');
    setAllowReg(false);
    setImageFile(null);

    setModalMode('create');
    setShowModal(true);
  };

  const handleOpenDetails = async (ev: EventRow) => {
    setActiveEvent(ev);
    setEventImages([]);
    await Promise.all([
      fetchAttendees(ev.id),
      fetchEventImages(ev.id),
      (isUserAdmin || ev.created_by === userId) ? checkPushStatus(ev.id) : Promise.resolve(),
    ]);
    setModalMode('details');
    setShowModal(true);
  };

  const handleOpenEdit = (ev: EventRow) => {
    setActiveEvent(ev);
    setTitle(ev.title);
    setDescription(ev.description || '');
    setLocation(ev.location || '');
    setStartAt(new Date(ev.start_at).toISOString().slice(0, 16));
    setEndAt(new Date(ev.end_at).toISOString().slice(0, 16));
    setPrice(ev.price?.toString() || '');
    setCapacity(ev.capacity?.toString() || '');
    setAllowReg(ev.allow_registration || false);
    setImageFile(null);
    setModalMode('edit');
  };

  const handleSave = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!userId) return;
    setLoadingAction(true);

    try {
      let imageUrl = activeEvent?.image_url || null;

      // Upload cover-billede til event (image_url på forening_events)
      if (imageFile) {
        const compressed = await resizeImage(imageFile);
        const path = `events/${foreningId}/ev_${Date.now()}.jpg`;
        const { error: upErr } = await supabase.storage.from('foreningsbilleder').upload(path, compressed, { upsert: true });
        if (upErr) throw upErr;
        const { data: urlData } = supabase.storage.from('foreningsbilleder').getPublicUrl(path);
        imageUrl = urlData.publicUrl;
      }

      const payload = {
        forening_id: foreningId,
        title,
        description: description || null,
        location: location || null,
        start_at: new Date(startAt).toISOString(),
        end_at: new Date(endAt).toISOString(),
        price: price ? parseFloat(price) : null,
        capacity: capacity ? parseInt(capacity) : null,
        allow_registration: allowReg,
        image_url: imageUrl,
        created_by: userId,
      };

      if (modalMode === 'create') {
        const { error } = await supabase.from('forening_events').insert([payload]);
        if (error) throw error;
      } else if (modalMode === 'edit' && activeEvent) {
        const { error } = await supabase.from('forening_events').update(payload).eq('id', activeEvent.id);
        if (error) throw error;
      }

      await fetchEvents();
      setShowModal(false);
    } catch (err: any) {
      alert('Fejl: ' + err.message);
    } finally {
      setLoadingAction(false);
    }
  };

  const handleDelete = async () => {
    if (!activeEvent || !confirm('Er du sikker på, at du vil slette denne aktivitet?')) return;
    setLoadingAction(true);
    const { error } = await supabase.from('forening_events').delete().eq('id', activeEvent.id);
    if (!error) {
      setEvents((prev) => prev.filter((x) => x.id !== activeEvent.id));
      setShowModal(false);
    } else {
      alert('Fejl ved sletning: ' + error.message);
    }
    setLoadingAction(false);
  };

  const handleJoinLeave = async (action: 'join' | 'leave') => {
    if (!userId || !activeEvent) return;
    setLoadingAction(true);

    try {
      if (action === 'join') {
        const { error } = await supabase
          .from('forening_event_registrations')
          .insert([{ event_id: activeEvent.id, user_id: userId }]);
        if (error) throw error;
      } else {
        const { error } = await supabase
          .from('forening_event_registrations')
          .delete()
          .eq('event_id', activeEvent.id)
          .eq('user_id', userId);
        if (error) throw error;
      }

      await fetchAttendees(activeEvent.id);
      await fetchEvents();
    } catch (err: any) {
      alert('Fejl: ' + err.message);
    } finally {
      setLoadingAction(false);
    }
  };

  const handleSendPush = async () => {
    if (!activeEvent || !userId) return;
    if (!confirm('Vil du sende en push-besked til alle medlemmer om denne aktivitet?')) return;

    setLoadingAction(true);
    try {
      const { data, error } = await supabase.rpc('send_event_push', {
        p_forening_id: foreningId,
        p_event_id: activeEvent.id,
        p_sender_id: userId,
        p_title: activeEvent.title,
        p_body: `${activeEvent.location ? activeEvent.location + ' • ' : ''}${fmtRange(activeEvent.start_at, activeEvent.end_at)}`,
      });

      if (error) throw error;

      await supabase.functions.invoke('push-worker', { body: { source: 'event', eventId: activeEvent.id } });
      alert(`Push sendt til ${data} medlemmer!`);
      setHasPushed(true);
    } catch (err: any) {
      alert('Fejl ved push: ' + err.message);
    } finally {
      setLoadingAction(false);
    }
  };

  // ✅ Upload fra “kamera” på kortet
  const handleQuickUploadClick = (ev: EventRow, e: React.MouseEvent) => {
    e.stopPropagation();
    uploadTargetEventRef.current = ev;
    quickUploadInputRef.current?.click();
  };

  const handleQuickUploadChange = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    e.target.value = ''; // vigtigt så man kan vælge samme fil igen
    const ev = uploadTargetEventRef.current;

    if (!file || !ev) return;

    try {
      await uploadEventImage(file, ev);
      alert('Billede uploadet ✅');
    } catch (err: any) {
      alert('Fejl ved upload: ' + (err?.message || 'Ukendt fejl'));
    } finally {
      uploadTargetEventRef.current = null;
    }
  };

  // --- VISUALS ---
  const isRegistered = activeEvent && attendees.some((a) => a.user_id === userId);
  const isFull = activeEvent && activeEvent.capacity && attendees.length >= activeEvent.capacity;
  const canEdit = activeEvent && (isUserAdmin || activeEvent.created_by === userId);

  const now = new Date();
  const upcoming = events.filter((e) => new Date(e.end_at) >= now);
  const past = events.filter((e) => new Date(e.end_at) < now);

  return (
    <div>
      {/* Hidden input til upload fra kort */}
      <input
        ref={quickUploadInputRef}
        type="file"
        accept="image/*"
        className="hidden"
        onChange={handleQuickUploadChange}
      />

      {/* Top Bar */}
      <div className="flex justify-between items-center mb-6">
        <h3 className="font-bold text-[#131921] text-lg">Aktiviteter</h3>
        {isApprovedMember && (
          <button
            onClick={handleOpenCreate}
            className="bg-[#131921] text-white px-4 py-2 rounded-xl text-sm font-bold shadow-md hover:bg-gray-900 transition-colors"
          >
            + Opret aktivitet
          </button>
        )}
      </div>

      {loading ? (
        <div className="text-center py-10 text-gray-400">Henter kalender...</div>
      ) : events.length === 0 ? (
        <div className="text-center py-10 bg-gray-50 rounded-2xl border border-dashed border-gray-200">
          <p className="text-gray-400">Ingen aktiviteter endnu.</p>
        </div>
      ) : (
        <div className="space-y-8">
          {/* Upcoming */}
          {upcoming.length > 0 && (
            <div>
              <h4 className="text-xs font-bold text-gray-500 uppercase mb-3">Kommende</h4>
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                {upcoming.map((ev) => (
                  <EventCard
                    key={ev.id}
                    ev={ev}
                    count={regCounts[ev.id]}
                    onClick={() => handleOpenDetails(ev)}
                    showUpload={isApprovedMember}
                    onUploadClick={handleQuickUploadClick}
                    uploading={uploadingEventImage}
                  />
                ))}
              </div>
            </div>
          )}

          {/* Past */}
          {past.length > 0 && (
            <div>
              <h4 className="text-xs font-bold text-gray-500 uppercase mb-3 opacity-70">Afsluttede</h4>
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4 opacity-70 grayscale-[0.5]">
                {past.map((ev) => (
                  <EventCard
                    key={ev.id}
                    ev={ev}
                    count={regCounts[ev.id]}
                    onClick={() => handleOpenDetails(ev)}
                    showUpload={isApprovedMember}
                    onUploadClick={handleQuickUploadClick}
                    uploading={uploadingEventImage}
                  />
                ))}
              </div>
            </div>
          )}
        </div>
      )}

      {/* --- MODAL --- */}
      {showModal && (
        <div className="fixed inset-0 z-[200] flex items-center justify-center p-4 bg-black/60 backdrop-blur-sm">
          <div className="bg-white w-full max-w-lg rounded-2xl shadow-2xl overflow-hidden flex flex-col max-h-[90vh]">
            <div className="bg-[#131921] px-5 py-4 flex justify-between items-center">
              <h2 className="text-white font-bold uppercase tracking-wider">
                {modalMode === 'create' ? 'Opret Aktivitet' : modalMode === 'edit' ? 'Rediger' : 'Detaljer'}
              </h2>
              <button onClick={() => setShowModal(false)} className="text-white/70 hover:text-white text-2xl leading-none">
                &times;
              </button>
            </div>

            <div className="overflow-y-auto p-5">
              {/* === DETAILS MODE === */}
              {modalMode === 'details' && activeEvent && (
                <div className="space-y-6">
                  {activeEvent.image_url && (
                    <div className="relative w-full aspect-square rounded-xl overflow-hidden">
                      <img src={activeEvent.image_url} alt="" className="w-full h-full object-cover" />
                    </div>
                  )}

                  <div>
                    <h2 className="text-2xl font-black text-[#131921] mb-1">{activeEvent.title}</h2>
                    <p className="text-[#254890] font-bold text-sm mb-4">
                      {fmtRange(activeEvent.start_at, activeEvent.end_at)}
                    </p>

                    <div className="flex flex-wrap gap-2 mb-4">
                      {activeEvent.location && (
                        <span className="px-3 py-1 bg-gray-100 rounded-full text-xs font-bold text-gray-600">
                          📍 {activeEvent.location}
                        </span>
                      )}
                      {activeEvent.price && (
                        <span className="px-3 py-1 bg-gray-100 rounded-full text-xs font-bold text-gray-600">
                          💰 {activeEvent.price} kr.
                        </span>
                      )}
                      {activeEvent.capacity && (
                        <span className="px-3 py-1 bg-gray-100 rounded-full text-xs font-bold text-gray-600">
                          👥 Plads til {activeEvent.capacity}
                        </span>
                      )}
                    </div>

                    <p className="text-gray-700 whitespace-pre-wrap leading-relaxed">{activeEvent.description}</p>
                  </div>

                  {/* ✅ BILLEDER (event_images) */}
                  <div className="border border-gray-200 rounded-xl p-4 bg-gray-50">
                    <div className="flex items-center justify-between mb-3">
                      <h4 className="font-bold text-sm text-gray-700">Billeder</h4>

                      {isApprovedMember && (
                        <label className="px-3 py-2 bg-[#131921] text-white rounded-xl text-xs font-bold cursor-pointer hover:bg-gray-900">
                          {uploadingEventImage ? 'Uploader…' : '+ Upload'}
                          <input
                            type="file"
                            accept="image/*"
                            className="hidden"
                            onChange={async (e) => {
                              const f = e.target.files?.[0];
                              e.target.value = '';
                              if (!f) return;
                              try {
                                await uploadEventImage(f, activeEvent);
                              } catch (err: any) {
                                alert('Fejl ved upload: ' + (err?.message || 'Ukendt fejl'));
                              }
                            }}
                          />
                        </label>
                      )}
                    </div>

                    {eventImages.length === 0 ? (
                      <p className="text-xs text-gray-400">Ingen billeder endnu.</p>
                    ) : (
                      <div className="flex gap-2 overflow-x-auto pb-1">
                        {eventImages.slice(0, 8).map((img) => {
                          const src = getEventImageUrl(img.image_url);
                          return (
                            <div
                              key={img.id}
                              className="w-20 h-20 flex-shrink-0 rounded-xl overflow-hidden bg-gray-200"
                              title={new Date(img.created_at).toLocaleString('da-DK')}
                            >
                              {src ? <img src={src} className="w-full h-full object-cover" /> : null}
                            </div>
                          );
                        })}
                      </div>
                    )}
                  </div>

                  {/* Tilmelding Boks */}
                  {activeEvent.allow_registration && (
                    <div className="border border-gray-200 rounded-xl p-4 bg-gray-50">
                      <div className="flex justify-between items-center mb-3">
                        <h4 className="font-bold text-sm text-gray-700">
                          Tilmeldinger ({attendees.length}
                          {activeEvent.capacity ? `/${activeEvent.capacity}` : ''})
                        </h4>
                      </div>

                      {isApprovedMember ? (
                        <div className="mb-4">
                          {isRegistered ? (
                            <button
                              onClick={() => handleJoinLeave('leave')}
                              disabled={loadingAction}
                              className="w-full py-3 bg-gray-200 text-gray-700 rounded-xl font-bold hover:bg-gray-300"
                            >
                              {loadingAction ? '...' : 'Afmeld dig'}
                            </button>
                          ) : (
                            <button
                              onClick={() => handleJoinLeave('join')}
                              disabled={loadingAction || (!!isFull && !isRegistered)}
                              className="w-full py-3 bg-[#131921] text-white rounded-xl font-bold hover:bg-gray-900 disabled:opacity-50"
                            >
                              {loadingAction ? '...' : isFull ? 'Fuldt booket' : 'Tilmeld dig'}
                            </button>
                          )}
                        </div>
                      ) : (
                        <p className="text-xs text-red-500 mb-4">Du skal være godkendt medlem for at tilmelde dig.</p>
                      )}

                      <div className="space-y-2 max-h-40 overflow-y-auto">
                        {attendees.map((att) => (
                          <div key={att.user_id} className="flex items-center gap-3">
                            <div className="w-8 h-8 rounded-full bg-gray-200 overflow-hidden">
                              {att.users?.avatar_url ? <img src={att.users.avatar_url} className="w-full h-full object-cover" /> : null}
                            </div>
                            <span className="text-sm font-bold text-gray-700">
                              {att.users?.name || att.users?.email?.split('@')[0]}
                            </span>
                          </div>
                        ))}
                        {attendees.length === 0 && <p className="text-xs text-gray-400">Ingen tilmeldte endnu.</p>}
                      </div>
                    </div>
                  )}

                  {/* Admin Tools */}
                  {canEdit && (
                    <div className="pt-4 border-t border-gray-100 flex flex-col gap-2">
                      <div className="flex gap-2">
                        <button
                          onClick={() => setModalMode('edit')}
                          className="flex-1 py-2 bg-gray-100 text-gray-700 font-bold rounded-lg text-sm"
                        >
                          Rediger
                        </button>
                        <button
                          onClick={handleDelete}
                          disabled={loadingAction}
                          className="flex-1 py-2 bg-red-50 text-red-600 font-bold rounded-lg text-sm"
                        >
                          Slet
                        </button>
                      </div>

                      <button
                        onClick={handleSendPush}
                        disabled={loadingAction || hasPushed}
                        className={`w-full py-3 rounded-lg text-sm font-bold flex items-center justify-center gap-2 ${
                          hasPushed ? 'bg-green-50 text-green-700 cursor-default' : 'bg-blue-50 text-blue-700 hover:bg-blue-100'
                        }`}
                      >
                        {hasPushed ? (
                          <>
                            <i className="fa-solid fa-check"></i> Push sendt til appen
                          </>
                        ) : (
                          <>
                            <i className="fa-solid fa-bell"></i> Send push til app ({pushStats?.active || 0} modtagere)
                          </>
                        )}
                      </button>
                    </div>
                  )}
                </div>
              )}

              {/* === CREATE / EDIT MODE === */}
              {(modalMode === 'create' || modalMode === 'edit') && (
                <form onSubmit={handleSave} className="space-y-4">
                  <input
                    required
                    placeholder="Overskrift"
                    className="w-full p-3 bg-gray-50 rounded-xl border border-gray-200 focus:border-[#131921] outline-none text-[#131921] placeholder-gray-500 font-medium"
                    value={title}
                    onChange={(e) => setTitle(e.target.value)}
                  />
                  <textarea
                    placeholder="Beskrivelse"
                    className="w-full p-3 bg-gray-50 rounded-xl border border-gray-200 h-24 resize-none outline-none text-[#131921] placeholder-gray-500 font-medium"
                    value={description}
                    onChange={(e) => setDescription(e.target.value)}
                  />
                  <input
                    placeholder="Sted (f.eks. Klubhus)"
                    className="w-full p-3 bg-gray-50 rounded-xl border border-gray-200 outline-none text-[#131921] placeholder-gray-500 font-medium"
                    value={location}
                    onChange={(e) => setLocation(e.target.value)}
                  />

                  <div className="grid grid-cols-2 gap-3">
                    <div>
                      <label className="text-xs font-bold text-gray-500 ml-1">Start</label>
                      <input
                        required
                        type="datetime-local"
                        className="w-full p-3 bg-gray-50 rounded-xl border border-gray-200 outline-none text-sm text-[#131921] placeholder-gray-500 font-medium"
                        value={startAt}
                        onChange={(e) => setStartAt(e.target.value)}
                      />
                    </div>
                    <div>
                      <label className="text-xs font-bold text-gray-500 ml-1">Slut</label>
                      <input
                        required
                        type="datetime-local"
                        className="w-full p-3 bg-gray-50 rounded-xl border border-gray-200 outline-none text-sm text-[#131921] placeholder-gray-500 font-medium"
                        value={endAt}
                        onChange={(e) => setEndAt(e.target.value)}
                      />
                    </div>
                  </div>

                  <div className="grid grid-cols-2 gap-3">
                    <input
                      type="number"
                      placeholder="Pris (kr)"
                      className="w-full p-3 bg-gray-50 rounded-xl border border-gray-200 outline-none text-[#131921] placeholder-gray-500 font-medium"
                      value={price}
                      onChange={(e) => setPrice(e.target.value)}
                    />
                    <input
                      type="number"
                      placeholder="Max antal"
                      className="w-full p-3 bg-gray-50 rounded-xl border border-gray-200 outline-none text-[#131921] placeholder-gray-500 font-medium"
                      value={capacity}
                      onChange={(e) => setCapacity(e.target.value)}
                    />
                  </div>

                  <label className="flex items-center gap-3 p-3 bg-gray-50 rounded-xl border border-gray-200 cursor-pointer">
                    <input
                      type="checkbox"
                      checked={allowReg}
                      onChange={(e) => setAllowReg(e.target.checked)}
                      className="w-5 h-5 accent-[#131921]"
                    />
                    <span className="font-bold text-gray-700 text-sm">Tillad tilmelding</span>
                  </label>

                  <div className="p-3 bg-gray-50 rounded-xl border border-dashed border-gray-300 text-center cursor-pointer relative hover:bg-gray-100">
                    <input
                      type="file"
                      accept="image/*"
                      onChange={(e) => setImageFile(e.target.files?.[0] || null)}
                      className="absolute inset-0 opacity-0 cursor-pointer"
                    />
                    <span className="text-sm font-bold text-gray-500">
                      {imageFile
                        ? `Valgt: ${imageFile.name}`
                        : activeEvent?.image_url && modalMode === 'edit'
                        ? 'Skift billede (valgfrit)'
                        : '+ Vælg billede'}
                    </span>
                  </div>

                  <button
                    type="submit"
                    disabled={loadingAction}
                    className="w-full py-4 bg-[#131921] text-white rounded-xl font-bold hover:bg-gray-900 mt-2"
                  >
                    {loadingAction ? 'Gemmer...' : modalMode === 'create' ? 'Opret Aktivitet' : 'Gem Ændringer'}
                  </button>
                </form>
              )}
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

// Kort-komponent
function EventCard({
  ev,
  count,
  onClick,
  showUpload,
  onUploadClick,
  uploading,
}: {
  ev: EventRow;
  count: number;
  onClick: () => void;
  showUpload: boolean;
  onUploadClick: (ev: EventRow, e: React.MouseEvent) => void;
  uploading: boolean;
}) {
  return (
    <div
      onClick={onClick}
      className="bg-white border border-gray-100 rounded-xl p-3 flex gap-4 cursor-pointer hover:shadow-md transition-shadow relative"
    >
      {/* Upload-knap på kortet */}
      {showUpload && (
        <button
          onClick={(e) => onUploadClick(ev, e)}
          title="Upload billede til aktiviteten"
          className="absolute top-3 right-3 w-9 h-9 rounded-full bg-[#131921] text-white flex items-center justify-center shadow hover:bg-black transition-colors"
        >
          <i className={`fa-solid ${uploading ? 'fa-spinner fa-spin' : 'fa-camera'}`}></i>
        </button>
      )}

      {/* Billede / Dato boks */}
      <div className="w-24 h-24 shrink-0 bg-gray-100 rounded-lg overflow-hidden relative aspect-square">
        {ev.image_url ? (
          <img src={ev.image_url} className="w-full h-full object-cover" />
        ) : (
          <div className="w-full h-full flex flex-col items-center justify-center bg-[#131921] text-white">
            <span className="text-xs font-bold uppercase">{new Date(ev.start_at).toLocaleString('da-DK', { month: 'short' })}</span>
            <span className="text-2xl font-black">{new Date(ev.start_at).getDate()}</span>
          </div>
        )}
      </div>

      <div className="flex-1 flex flex-col justify-center min-w-0">
        <h4 className="font-bold text-[#131921] truncate mb-1 text-lg">{ev.title}</h4>
        <p className="text-xs text-gray-500 mb-2">
          {new Date(ev.start_at).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
          {ev.location && ` • ${ev.location}`}
        </p>
        {ev.allow_registration && (
          <span className="inline-block bg-gray-100 text-gray-600 text-[10px] font-bold px-2 py-0.5 rounded-md self-start">
            {count}
            {ev.capacity ? ` / ${ev.capacity}` : ''} tilmeldt
          </span>
        )}
      </div>
    </div>
  );
}