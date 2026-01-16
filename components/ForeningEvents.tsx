'use client';

import { useState, useEffect, useMemo } from 'react';
import { supabase } from '../lib/supabaseClient';
import { useRouter } from 'next/navigation';

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
    id?: string;
    name?: string | null;
    username?: string | null;
    email?: string | null;
    avatar_url?: string | null;
  } | null;
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

const displayName = (u?: Attendee['users'] | null) => {
  const n = u?.name?.trim() || u?.username?.trim();
  if (n) return n;
  const email = u?.email || '';
  return email.includes('@') ? email.split('@')[0] : 'Ukendt';
};

// Billed-komprimering (browser)
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
      ctx.canvas.toBlob((blob) => (blob ? resolve(blob) : reject(new Error('Blob error'))), 'image/jpeg', quality);
    };
    img.onerror = (e) => {
      URL.revokeObjectURL(objectUrl);
      reject(e);
    };
  });
}

export default function ForeningEvents({ foreningId, userId, isUserAdmin, isApprovedMember }: Props) {
  const router = useRouter();

  const [events, setEvents] = useState<EventRow[]>([]);
  const [loading, setLoading] = useState(true);

  // counts pr event
  const [regCounts, setRegCounts] = useState<Record<string, number>>({});

  // Modal
  const [showModal, setShowModal] = useState(false);
  const [modalMode, setModalMode] = useState<'create' | 'details' | 'edit'>('create');
  const [activeEvent, setActiveEvent] = useState<EventRow | null>(null);

  // Attendees
  const [attendees, setAttendees] = useState<Attendee[]>([]);

  // Form fields
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

  // Push stats
  const [pushStats, setPushStats] = useState<{ active: number; total: number } | null>(null);
  const [hasPushed, setHasPushed] = useState(false);

  useEffect(() => {
    fetchEvents();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [foreningId]);

  const fetchCounts = async (evs: EventRow[]) => {
    const counts: Record<string, number> = {};
    for (const ev of evs) {
      const { count, error } = await supabase
        .from('forening_event_registrations')
        .select('event_id', { count: 'exact', head: true })
        .eq('event_id', ev.id);

      if (error) {
        console.error('Count error:', error.message);
        counts[ev.id] = 0;
      } else {
        counts[ev.id] = count || 0;
      }
    }
    setRegCounts(counts);
  };

  const fetchEvents = async () => {
    setLoading(true);
    const { data, error } = await supabase
      .from('forening_events')
      .select('*')
      .eq('forening_id', foreningId)
      .order('start_at', { ascending: false });

    if (error) {
      console.error('fetchEvents error:', error.message);
      setEvents([]);
      setRegCounts({});
      setLoading(false);
      return;
    }

    const evs = (data || []) as EventRow[];
    setEvents(evs);
    await fetchCounts(evs);
    setLoading(false);
  };

  /**
   * IMPORTANT:
   * Hent attendees som appen gør:
   * 1) hent regs
   * 2) hent users separat
   * 3) merge
   */
  const fetchAttendees = async (eventId: string) => {
    // 1) regs
    const { data: regs, error: rErr } = await supabase
      .from('forening_event_registrations')
      .select('user_id, created_at')
      .eq('event_id', eventId)
      .order('created_at', { ascending: true });

    if (rErr) {
      console.error('fetchAttendees regs error:', rErr.message);
      setAttendees([]);
      return;
    }

    const ids = [...new Set((regs || []).map((r: any) => r.user_id))];
    if (ids.length === 0) {
      setAttendees([]);
      return;
    }

    // 2) users (separat)
    const { data: users, error: uErr } = await supabase
      .from('users')
      .select('id, name, username, email, avatar_url')
      .in('id', ids);

    if (uErr) {
      console.error('fetchAttendees users error:', uErr.message);
      // fallback: vis i det mindste user_id
      setAttendees((regs || []) as any);
      return;
    }

    const byId = new Map((users || []).map((u: any) => [u.id, u]));

    // 3) merge
    const merged: Attendee[] = (regs || []).map((r: any) => ({
      user_id: r.user_id,
      created_at: r.created_at,
      users: byId.get(r.user_id) || null,
    }));

    setAttendees(merged);
  };

  const checkPushStatus = async (eventId: string) => {
    const { data } = await supabase.from('event_push_broadcasts').select('id').eq('event_id', eventId).maybeSingle();
    setHasPushed(!!data);

    const { data: stats, error } = await supabase
      .from('v_forening_push_stats')
      .select('*')
      .eq('forening_id', foreningId)
      .maybeSingle();

    if (!error && stats) setPushStats({ active: stats.active_push_members, total: stats.total_members });
    else setPushStats(null);
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
    setActiveEvent(null);
    setAttendees([]);
    setModalMode('create');
    setShowModal(true);
  };

  const handleOpenDetails = async (ev: EventRow) => {
    setActiveEvent(ev);
    setModalMode('details');
    setShowModal(true);
    await fetchAttendees(ev.id);
    if (isUserAdmin || ev.created_by === userId) await checkPushStatus(ev.id);
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
    setAllowReg(!!ev.allow_registration);
    setImageFile(null);
    setModalMode('edit');
    setShowModal(true);
  };

  const handleSave = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!userId) return;

    setLoadingAction(true);
    try {
      let imageUrl = activeEvent?.image_url || null;

      if (imageFile) {
        const compressed = await resizeImage(imageFile);
        const path = `events/${foreningId}/ev_${Date.now()}.jpg`;

        const { error: upErr } = await supabase.storage
          .from('foreningsbilleder')
          .upload(path, compressed, { upsert: true, contentType: 'image/jpeg' });

        if (upErr) throw upErr;

        const { data: urlData } = supabase.storage.from('foreningsbilleder').getPublicUrl(path);
        imageUrl = urlData.publicUrl;
      }

      const payload = {
        forening_id: foreningId,
        title: title.trim(),
        description: description.trim() || null,
        location: location.trim() || null,
        start_at: new Date(startAt).toISOString(),
        end_at: new Date(endAt).toISOString(),
        price: price ? Number(price) : null,
        capacity: capacity ? Number(capacity) : null,
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
      alert('Fejl: ' + (err?.message || 'Ukendt fejl'));
    } finally {
      setLoadingAction(false);
    }
  };

  const handleDelete = async () => {
    if (!activeEvent) return;
    if (!confirm('Er du sikker på, at du vil slette denne aktivitet?')) return;

    setLoadingAction(true);
    try {
      const { error } = await supabase.from('forening_events').delete().eq('id', activeEvent.id);
      if (error) throw error;
      setEvents((prev) => prev.filter((x) => x.id !== activeEvent.id));
      setShowModal(false);
    } catch (err: any) {
      alert('Fejl ved sletning: ' + (err?.message || 'Ukendt fejl'));
    } finally {
      setLoadingAction(false);
    }
  };

  const handleJoinLeave = async (action: 'join' | 'leave') => {
    if (!userId || !activeEvent) return;

    setLoadingAction(true);
    try {
      if (action === 'join') {
        const { error } = await supabase
          .from('forening_event_registrations')
          .insert([{ event_id: activeEvent.id, user_id: userId }]);

        // Duplicate = OK (du er allerede tilmeldt)
        if (error && !/duplicate|23505/i.test(String(error.message))) throw error;
      } else {
        const { error } = await supabase
          .from('forening_event_registrations')
          .delete()
          .eq('event_id', activeEvent.id)
          .eq('user_id', userId);

        if (error) throw error;
      }

      await fetchAttendees(activeEvent.id);
      await fetchEvents(); // opdater counts + list
    } catch (err: any) {
      alert('Fejl: ' + (err?.message || 'Ukendt fejl'));
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
      alert('Fejl ved push: ' + (err?.message || 'Ukendt fejl'));
    } finally {
      setLoadingAction(false);
    }
  };

  // --- VISUALS / derived ---
  const isRegistered = useMemo(() => {
    if (!activeEvent || !userId) return false;
    return attendees.some((a) => a.user_id === userId);
  }, [attendees, activeEvent, userId]);

  const isFull = useMemo(() => {
    if (!activeEvent?.capacity) return false;
    return attendees.length >= activeEvent.capacity;
  }, [attendees.length, activeEvent?.capacity]);

  const canEdit = useMemo(() => {
    if (!activeEvent || !userId) return false;
    return isUserAdmin || activeEvent.created_by === userId;
  }, [activeEvent, isUserAdmin, userId]);

  const now = new Date();
  const upcoming = events.filter((e) => new Date(e.end_at) >= now);
  const past = events.filter((e) => new Date(e.end_at) < now);

  return (
    <div>
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
        <div className="text-center py-10 text-gray-400">Henter aktiviteter...</div>
      ) : events.length === 0 ? (
        <div className="text-center py-10 bg-gray-50 rounded-2xl border border-dashed border-gray-200">
          <p className="text-gray-400">Ingen aktiviteter endnu.</p>
        </div>
      ) : (
        <div className="space-y-8">
          {upcoming.length > 0 && (
            <div>
              <h4 className="text-xs font-bold text-gray-500 uppercase mb-3">Kommende</h4>
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                {upcoming.map((ev) => (
                  <EventCard key={ev.id} ev={ev} count={regCounts[ev.id] ?? 0} onClick={() => handleOpenDetails(ev)} />
                ))}
              </div>
            </div>
          )}

          {past.length > 0 && (
            <div>
              <h4 className="text-xs font-bold text-gray-500 uppercase mb-3 opacity-70">Afsluttede</h4>
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4 opacity-70 grayscale-[0.5]">
                {past.map((ev) => (
                  <EventCard key={ev.id} ev={ev} count={regCounts[ev.id] ?? 0} onClick={() => handleOpenDetails(ev)} />
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
              <button
                onClick={() => setShowModal(false)}
                className="text-white/70 hover:text-white text-2xl leading-none"
              >
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
                      {!!activeEvent.price && (
                        <span className="px-3 py-1 bg-gray-100 rounded-full text-xs font-bold text-gray-600">
                          💰 {activeEvent.price} kr.
                        </span>
                      )}
                      {!!activeEvent.capacity && (
                        <span className="px-3 py-1 bg-gray-100 rounded-full text-xs font-bold text-gray-600">
                          👥 Plads til {activeEvent.capacity}
                        </span>
                      )}
                    </div>

                    {activeEvent.description ? (
                      <p className="text-gray-700 whitespace-pre-wrap leading-relaxed">{activeEvent.description}</p>
                    ) : null}
                  </div>

                  {/* Tilmelding */}
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
                            <div className="w-8 h-8 rounded-full bg-gray-200 overflow-hidden flex items-center justify-center">
                              {att.users?.avatar_url ? (
                                <img src={att.users.avatar_url} className="w-full h-full object-cover" alt="" />
                              ) : (
                                <span className="text-xs font-black text-[#131921]">
                                  {displayName(att.users).slice(0, 1).toUpperCase()}
                                </span>
                              )}
                            </div>
                            <span className="text-sm font-bold text-gray-700">{displayName(att.users)}</span>
                          </div>
                        ))}
                        {attendees.length === 0 && <p className="text-xs text-gray-400">Ingen tilmeldte endnu.</p>}
                      </div>
                    </div>
                  )}

                  {/* Handlings-knapper */}
                  <div className="flex flex-col gap-3 mt-2">
                    <button
                      onClick={() => router.push(`/forening/${foreningId}/images`)}
                      className="w-full py-3.5 bg-[#131921] text-white rounded-xl font-bold hover:bg-gray-900 transition-colors shadow-sm"
                    >
                      Billeder
                    </button>

                    {canEdit && (
                      <>
                        <button
                          onClick={handleSendPush}
                          disabled={loadingAction || hasPushed}
                          className={`w-full py-3.5 rounded-xl font-bold shadow-sm transition-colors ${
                            hasPushed ? 'bg-green-600 text-white cursor-default' : 'bg-[#131921] text-white hover:bg-gray-900'
                          }`}
                        >
                          {hasPushed ? 'Push sendt' : 'Send push'}
                        </button>

                        <button
                          onClick={() => activeEvent && handleOpenEdit(activeEvent)}
                          className="w-full py-3.5 bg-[#131921] text-white rounded-xl font-bold hover:bg-gray-900 transition-colors shadow-sm"
                        >
                          Rediger
                        </button>

                        <button
                          onClick={handleDelete}
                          disabled={loadingAction}
                          className="w-full py-3.5 bg-[#D32F2F] text-white rounded-xl font-bold hover:bg-red-700 transition-colors shadow-sm"
                        >
                          Slet
                        </button>

                        {pushStats && (
                          <p className="text-xs text-gray-500 pt-1">
                            🔔 Push sendes til {pushStats.active} ud af {pushStats.total} medlemmer
                          </p>
                        )}
                      </>
                    )}
                  </div>
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

                  <div className="p-3 bg-gray-50 rounded-xl border border-dashed border-gray-300 text-center cursor-pointer relative hover:bg-gray-100 transition-colors">
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
                    className="w-full py-4 bg-[#131921] text-white rounded-xl font-bold hover:bg-gray-900 mt-2 disabled:opacity-60"
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

// --- EventCard ---
function EventCard({ ev, count, onClick }: { ev: EventRow; count: number; onClick: () => void }) {
  return (
    <div
      onClick={onClick}
      className="bg-white border border-gray-100 rounded-xl p-3 flex gap-4 cursor-pointer hover:shadow-md transition-shadow"
    >
      <div className="w-24 h-24 shrink-0 bg-gray-100 rounded-lg overflow-hidden relative aspect-square">
        {ev.image_url ? (
          <img src={ev.image_url} className="w-full h-full object-cover" alt="" />
        ) : (
          <div className="w-full h-full flex flex-col items-center justify-center bg-[#131921] text-white">
            <span className="text-xs font-bold uppercase">
              {new Date(ev.start_at).toLocaleString('da-DK', { month: 'short' })}
            </span>
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