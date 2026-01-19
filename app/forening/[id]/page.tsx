'use client';

import { useEffect, useMemo, useRef, useState } from 'react';
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
    id?: string | null;
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
  email: string | null;
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

const supabaseErrText = (err: any) => {
  if (!err) return 'Ukendt fejl';
  const parts = [
    err.message,
    err.details ? `details: ${err.details}` : null,
    err.hint ? `hint: ${err.hint}` : null,
    err.code ? `code: ${err.code}` : null,
  ].filter(Boolean);
  return parts.join('\n');
};

const fmtDate = (d: any) => new Date(d).toLocaleDateString('da-DK', { day: 'numeric', month: 'long' });

const fmtTime = (d: any) =>
  new Date(d).toLocaleTimeString('da-DK', { hour: '2-digit', minute: '2-digit' });

const startOfMonth = (d: Date) => new Date(d.getFullYear(), d.getMonth(), 1);
const endOfMonth = (d: Date) => new Date(d.getFullYear(), d.getMonth() + 1, 0);
const pad = (n: number) => (n < 10 ? `0${n}` : `${n}`);
const toKey = (d: Date) => `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`;

const buildMonthGrid = (base: Date) => {
  const first = startOfMonth(base);
  const last = endOfMonth(base);
  const firstWeekday = (first.getDay() + 6) % 7; // Monday=0
  const daysInMonth = last.getDate();
  const cells: Date[] = [];

  for (let i = 0; i < firstWeekday; i++) {
    const d = new Date(first);
    d.setDate(first.getDate() - (firstWeekday - i));
    cells.push(d);
  }
  for (let d = 1; d <= daysInMonth; d++) cells.push(new Date(base.getFullYear(), base.getMonth(), d));

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

const dayColorClass = (hasEvents: boolean) => (hasEvents ? 'bg-[#131921] text-white' : '');

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
  const [editNavn, setEditNavn] = useState('');
  const [editSted, setEditSted] = useState('');
  const [editDescription, setEditDescription] = useState('');

  const fileInputRef = useRef<HTMLInputElement>(null);

  const [threads, setThreads] = useState<Thread[]>([]);
  const [events, setEvents] = useState<Event[]>([]);
  const [images, setImages] = useState<ImagePreview[]>([]);

  const [monthCursor, setMonthCursor] = useState(new Date());
  const [calendarEvents, setCalendarEvents] = useState<Event[]>([]);

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

  // ✅ Loading til destructive actions
  const [actionLoading, setActionLoading] = useState<'leave' | 'delete' | null>(null);

  useEffect(() => {
    async function loadAllData() {
      setLoading(true);
      try {
        const {
          data: { session },
        } = await supabase.auth.getSession();

        const currentUserId = session?.user?.id || null;
        setUserId(currentUserId);

        if (!idOrSlug) return;

        const isUuid =
          /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(idOrSlug);

        let query = supabase.from('foreninger').select('*');
        if (isUuid) query = query.eq('id', idOrSlug);
        else query = query.eq('slug', idOrSlug);

        const { data: foreningData, error } = await query.single();
        if (error || !foreningData) {
          setForening(null);
          setLoading(false);
          return;
        }

        setForening(foreningData);
        setRealForeningId(foreningData.id);
        setEditNavn(foreningData.navn || '');
        setEditSted(foreningData.sted || '');
        setEditDescription(foreningData.beskrivelse || '');

        const fId = foreningData.id;

        const [res1, res2, res3, res4] = await Promise.all([
          supabase
            .from('foreningsmedlemmer')
            .select(
              'user_id, rolle, status, users:users!foreningsmedlemmer_user_id_fkey (id, name, username, avatar_url, email)'
            )
            .eq('forening_id', fId),
          supabase
            .from('forening_threads')
            .select('*')
            .eq('forening_id', fId)
            .order('created_at', { ascending: false })
            .limit(3),
          supabase
            .from('forening_events')
            .select('*')
            .eq('forening_id', fId)
            .order('start_at', { ascending: false })
            .limit(3),
          supabase
            .from('forening_events')
            .select('id, title, start_at, end_at, location, price, description, image_url')
            .eq('forening_id', fId),
        ]);

        const eventIds = (res4.data || []).map((e: any) => e.id);

        if (eventIds.length > 0) {
          const imgRes = await supabase
            .from('event_images')
            .select('id, image_url')
            .in('event_id', eventIds)
            .order('created_at', { ascending: false })
            .limit(9);
          if (imgRes.data) setImages(imgRes.data as any);
        }

        if (res1.data) setMedlemmer(res1.data as unknown as Medlem[]);
        if (res2.data) setThreads(res2.data);
        if (res3.data) setEvents(res3.data);
        if (res4.data) setCalendarEvents(res4.data as any);

        setLoading(false);
      } catch {
        setLoading(false);
      }
    }

    loadAllData();
  }, [idOrSlug, router]);

  const approved = useMemo(() => medlemmer.filter((m) => m.status === 'approved'), [medlemmer]);
  const myMembership = useMemo(() => medlemmer.find((m) => m.user_id === userId), [medlemmer, userId]);
  const isApprovedMember = myMembership?.status === 'approved';
  const isPending = myMembership?.status === 'pending';
  const isOwner = forening?.oprettet_af === userId;
  const isMeAdmin = isOwner || myMembership?.rolle === 'admin';

  const memberIdSet = useMemo(() => new Set(medlemmer.map((m) => m.user_id)), [medlemmer]);

  const eventsByDate = useMemo(() => {
    const map = new Map<string, Event[]>();
    for (const e of calendarEvents) {
      const key = toKey(new Date(e.start_at));
      const list = map.get(key) || [];
      list.push(e);
      map.set(key, list);
    }
    for (const [k, list] of map.entries()) {
      list.sort((a, b) => new Date(a.start_at).getTime() - new Date(b.start_at).getTime());
      map.set(k, list);
    }
    return map;
  }, [calendarEvents]);

  const todayKey = useMemo(() => toKey(new Date()), []);

  const selectedDayEvents = useMemo(() => {
    if (!selectedDayKey) return [];
    return eventsByDate.get(selectedDayKey) || [];
  }, [eventsByDate, selectedDayKey]);

  const selectedDayLabel = useMemo(() => {
    if (!selectedDayKey) return '';
    const [y, m, d] = selectedDayKey.split('-').map((x) => parseInt(x, 10));
    const dt = new Date(y, m - 1, d);
    return dt.toLocaleDateString('da-DK', { weekday: 'long', day: 'numeric', month: 'long' });
  }, [selectedDayKey]);

  const hasLongDesc = (forening?.beskrivelse || '').trim().length > 220;

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
      alert('Kunne ikke gemme.\n\n' + supabaseErrText(error));
    }
  };

  const handleCopyLink = async () => {
    await navigator.clipboard.writeText(window.location.href);
    alert('Link kopieret ✅');
  };

  const handleShare = async () => {
    if (typeof navigator !== 'undefined' && (navigator as any).share) {
      try {
        await (navigator as any).share({ title: forening?.navn || 'Forening', url: window.location.href });
        return;
      } catch {}
    }
    await handleCopyLink();
  };

  const handleOpenInvite = () => {
    setInviteInfo(null);
    setInviteQuery('');
    setInviteResults([]);
    setShowInviteModal(true);
  };

  const runInviteSearch = async (q: string) => {
    const query = q.trim();
    setInviteQuery(q);
    setInviteInfo(null);

    if (query.length < 2) {
      setInviteResults([]);
      return;
    }

    setInviteLoading(true);
    try {
      const { data, error } = await supabase
        .from('users')
        .select('id, name, username, avatar_url, email')
        .or(`username.ilike.%${query}%,email.ilike.%${query}%,name.ilike.%${query}%`)
        .limit(10);

      if (error) throw error;

      const filtered = (data || []).filter((u: any) => u?.id && !memberIdSet.has(u.id));
      setInviteResults(filtered as UserSearchResult[]);
    } catch {
      setInviteResults([]);
      setInviteInfo('Kunne ikke søge efter brugere.');
    } finally {
      setInviteLoading(false);
    }
  };

  const inviteUser = async (targetUserId: string) => {
    if (!realForeningId) return;
    try {
      const { error } = await supabase.from('foreningsmedlemmer').insert([
        {
          forening_id: realForeningId,
          user_id: targetUserId,
          rolle: 'medlem',
          status: 'pending',
        },
      ]);

      if (error) {
        setInviteInfo('Kunne ikke invitere (måske er brugeren allerede inviteret).');
        return;
      }

      setInviteInfo('Invitation sendt ✅');
      setInviteResults((prev) => prev.filter((u) => u.id !== targetUserId));
    } catch {
      setInviteInfo('Kunne ikke invitere.');
    }
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
      const { data: existingThread, error: thErr } = await supabase
        .from('messages')
        .select('thread_id')
        .or(
          `and(sender_id.eq.${userId},receiver_id.eq.${targetUserId}),and(sender_id.eq.${targetUserId},receiver_id.eq.${userId})`
        )
        .limit(1)
        .maybeSingle();

      if (thErr) throw thErr;

      const threadIdToUse = existingThread?.thread_id || makeUuid();

      const { error: sendErr } = await supabase.from('messages').insert([
        {
          thread_id: threadIdToUse,
          sender_id: userId,
          receiver_id: targetUserId,
          text: firstMessageText.trim(),
          is_read: false,
          created_at: new Date().toISOString(),
          id: makeUuid(),
        } as any,
      ]);

      if (sendErr) throw sendErr;

      router.push(`/beskeder?id=${threadIdToUse}&dmUser=${targetUserId}`);
    } catch (e: any) {
      alert('Kunne ikke sende besked.\n\n' + supabaseErrText(e));
    } finally {
      setIsSendingFirstMessage(false);
      setShowFirstMessageModal(false);
      setFirstMessageText('');
    }
  };

  const handleJoin = async () => {
    if (!userId || !realForeningId) {
      router.push('/opret');
      return;
    }
    await supabase
      .from('foreningsmedlemmer')
      .insert([{ forening_id: realForeningId, user_id: userId, rolle: 'medlem', status: 'pending' }]);
    window.location.reload();
  };

  // ✅ FIX: Leave viser fejl + navigerer væk ved succes
  const handleLeave = async () => {
    if (!realForeningId) return;

    const {
      data: { session },
    } = await supabase.auth.getSession();

    const uid = session?.user?.id || userId;
    if (!uid) {
      alert('Du er ikke logget ind.');
      return;
    }

    if (!confirm('Er du sikker på at du vil forlade foreningen?')) return;

    setActionLoading('leave');
    try {
      const { error } = await supabase
        .from('foreningsmedlemmer')
        .delete()
        .eq('forening_id', realForeningId)
        .eq('user_id', uid);

      if (error) throw error;

      // Gå væk fra siden – ellers ender man tit i "tom state" / stale data
      router.push('/opslag');
      router.refresh();
    } catch (e: any) {
      alert('Kunne ikke afslutte medlemskab.\n\n' + supabaseErrText(e));
    } finally {
      setActionLoading(null);
    }
  };

  // ✅ FIX: Delete forening med cascade-delete af relaterede rows først
  const handleDeleteForening = async () => {
    if (!realForeningId) return;

    const {
      data: { session },
    } = await supabase.auth.getSession();

    const uid = session?.user?.id || userId;
    if (!uid) {
      alert('Du er ikke logget ind.');
      return;
    }

    // Ekstra sikkerhed: kun ejer
    if (forening?.oprettet_af !== uid) {
      alert('Kun ejeren kan slette foreningen.');
      return;
    }

    const ok = confirm('SLET FORENING?\n\nDette sletter foreningen (og kan ikke fortrydes). Er du helt sikker?');
    if (!ok) return;

    setActionLoading('delete');
    try {
      // 1) Find event ids
      const { data: evs, error: evErr } = await supabase
        .from('forening_events')
        .select('id')
        .eq('forening_id', realForeningId);

      if (evErr) throw evErr;

      const eventIds = (evs || []).map((x: any) => x.id).filter(Boolean);

      // 2) Slet event-relaterede data (hvis tabellerne findes – ellers får du en tydelig fejl)
      if (eventIds.length > 0) {
        // event_images (DB tabel) – ikke storage bucket
        const { error: imgErr } = await supabase.from('event_images').delete().in('event_id', eventIds);
        if (imgErr) throw imgErr;

        // Registreringer
        const { error: regErr } = await supabase.from('forening_event_registrations').delete().in('event_id', eventIds);
        if (regErr) throw regErr;

        // Push broadcasts (hvis du bruger den tabel)
        const { error: pbErr } = await supabase.from('event_push_broadcasts').delete().in('event_id', eventIds);
        if (pbErr && pbErr.code !== '42P01') throw pbErr; // ignore "table does not exist"
      }

      // 3) Slet events
      const { error: delEventsErr } = await supabase.from('forening_events').delete().eq('forening_id', realForeningId);
      if (delEventsErr) throw delEventsErr;

      // 4) Slet tråde + evt. state/messages (hvis dine tabeller findes)
      const { error: delThreadStateErr } = await supabase
        .from('forening_thread_state')
        .delete()
        .eq('forening_id', realForeningId);
      if (delThreadStateErr && delThreadStateErr.code !== '42P01') throw delThreadStateErr;

      const { error: delForMsgErr } = await supabase.from('forening_messages').delete().eq('forening_id', realForeningId);
      if (delForMsgErr && delForMsgErr.code !== '42P01') throw delForMsgErr;

      const { error: delThreadsErr } = await supabase.from('forening_threads').delete().eq('forening_id', realForeningId);
      if (delThreadsErr) throw delThreadsErr;

      // 5) Slet medlemmer
      const { error: delMembersErr } = await supabase
        .from('foreningsmedlemmer')
        .delete()
        .eq('forening_id', realForeningId);
      if (delMembersErr) throw delMembersErr;

      // 6) Til sidst: slet selve foreningen
      const { error: delForErr } = await supabase.from('foreninger').delete().eq('id', realForeningId);
      if (delForErr) throw delForErr;

      router.push('/opslag');
      router.refresh();
    } catch (e: any) {
      alert('Kunne ikke slette foreningen.\n\n' + supabaseErrText(e));
    } finally {
      setActionLoading(null);
    }
  };

  if (loading) {
    return (
      <div className="min-h-screen bg-[#869FB9] flex items-center justify-center font-black text-white">
        Indlæser...
      </div>
    );
  }

  if (!forening) {
    return <div className="min-h-screen bg-[#869FB9] p-10 text-center text-white">Forening ikke fundet</div>;
  }

  return (
    <div className="min-h-screen flex flex-col bg-[#869FB9]">
      <SiteHeader />

      <main className="flex-1 w-full max-w-4xl mx-auto p-4 pb-20 space-y-6">
        <input type="file" accept="image/*" ref={fileInputRef} className="hidden" onChange={handleImageUpload} />

        {/* HERO */}
        <div className="bg-white rounded-[24px] p-5 shadow-md mt-6 flex flex-col gap-4">
          <div className="relative w-full aspect-square rounded-[18px] overflow-hidden bg-gray-100">
            {forening.billede_url ? (
              <img src={forening.billede_url} className="w-full h-full object-cover" alt="Cover" />
            ) : (
              <div className="w-full h-full flex items-center justify-center text-gray-400 font-bold">Ingen forside</div>
            )}

            {uploading && (
              <div className="absolute inset-0 bg-black/50 flex items-center justify-center text-white font-black">
                Uploader...
              </div>
            )}
          </div>

          <div className="w-full">
            {isEditing ? (
              <div className="flex flex-col gap-3">
                <input
                  value={editNavn}
                  onChange={(e) => setEditNavn(e.target.value)}
                  className="w-full p-3 border rounded-xl text-black font-black"
                />
                <input
                  value={editSted}
                  onChange={(e) => setEditSted(e.target.value)}
                  className="w-full p-3 border rounded-xl text-black font-black"
                  placeholder="Sted"
                />
                <textarea
                  value={editDescription}
                  onChange={(e) => setEditDescription(e.target.value)}
                  className="w-full min-h-[120px] p-3 border rounded-xl text-black"
                />
                <div className="flex gap-2 justify-end pt-2">
                  <button
                    onClick={() => setIsEditing(false)}
                    className="px-4 py-2 bg-gray-100 rounded-full text-xs font-bold text-gray-700"
                  >
                    ANNULLER
                  </button>
                  <button
                    onClick={handleSaveInfo}
                    className="px-4 py-2 bg-[#131921] text-white rounded-full text-xs font-bold"
                  >
                    GEM
                  </button>
                </div>
              </div>
            ) : (
              <div className="flex flex-col gap-1">
                <h1 className="text-2xl font-black text-[#131921] underline decoration-gray-300">{forening.navn}</h1>
                <p className="text-gray-700 font-bold mb-3">{forening.sted}</p>

                <div className="text-[#444] text-sm whitespace-pre-wrap">
                  <p className={descExpanded ? '' : 'line-clamp-4'}>{forening.beskrivelse}</p>

                  {hasLongDesc && (
                    <button
                      onClick={() => setDescExpanded((v) => !v)}
                      className="mt-2 text-xs font-black text-[#131921] underline"
                    >
                      {descExpanded ? 'Læs mindre' : 'Læs mere'}
                    </button>
                  )}
                </div>

                {isApprovedMember && (
                  <div className="flex flex-wrap gap-2 mt-4">
                    <button
                      onClick={handleCopyLink}
                      className="px-4 py-2 bg-gray-100 text-black text-xs font-bold rounded-full uppercase"
                    >
                      Kopiér link
                    </button>
                    <button
                      onClick={handleShare}
                      className="px-4 py-2 bg-gray-100 text-black text-xs font-bold rounded-full uppercase"
                    >
                      Del
                    </button>

                    {isMeAdmin && (
                      <>
                        <button
                          onClick={() => setIsEditing(true)}
                          className="px-4 py-2 bg-gray-100 text-black text-xs font-bold rounded-full uppercase"
                        >
                          Rediger
                        </button>
                        <button
                          onClick={handleOpenInvite}
                          className="px-4 py-2 bg-gray-100 text-black text-xs font-bold rounded-full uppercase"
                        >
                          Inviter
                        </button>
                      </>
                    )}
                  </div>
                )}
              </div>
            )}
          </div>

          {!isApprovedMember &&
            (isPending ? (
              <div className="w-full py-3 bg-gray-400 text-white rounded-full font-bold text-center">
                Anmodning sendt - afventer godkendelse
              </div>
            ) : (
              <button onClick={handleJoin} className="w-full py-3 bg-[#131921] text-white rounded-full font-bold">
                Bliv medlem
              </button>
            ))}
        </div>

        {isApprovedMember && (
          <>
            <button
              onClick={() => router.push('/beskeder')}
              className="w-full bg-white p-4 rounded-[24px] shadow-sm flex items-center hover:bg-gray-50 transition-colors"
            >
              <div className="bg-[#131921] text-white px-4 py-2 rounded-full font-black text-sm tracking-wider uppercase">
                Beskeder
              </div>
            </button>

            {/* ... resten af din UI er uændret ... */}

            {/* Footer-actions */}
            <div className="bg-white rounded-[24px] p-4 shadow-sm flex flex-col md:flex-row gap-3 mb-10">
              <button
                onClick={handleLeave}
                disabled={actionLoading !== null}
                className={`flex-1 py-3 rounded-full font-bold transition-colors ${
                  actionLoading === 'leave'
                    ? 'bg-gray-200 text-gray-500 cursor-not-allowed'
                    : 'bg-gray-100 text-gray-600 hover:bg-gray-200'
                }`}
              >
                {actionLoading === 'leave' ? 'Afslutter…' : 'Afslut medlemskab'}
              </button>

              {isMeAdmin && (
                <button
                  onClick={() => fileInputRef.current?.click()}
                  disabled={actionLoading !== null}
                  className={`flex-1 py-3 rounded-full font-bold transition-colors ${
                    actionLoading
                      ? 'bg-[#e9eef5] text-[#131921]/60 cursor-not-allowed'
                      : 'bg-[#e9eef5] text-[#131921] hover:bg-[#d0dbe9]'
                  }`}
                >
                  Skift billede
                </button>
              )}

              {isOwner && (
                <button
                  onClick={handleDeleteForening}
                  disabled={actionLoading !== null}
                  className={`flex-1 py-3 rounded-full font-bold transition-colors ${
                    actionLoading === 'delete'
                      ? 'bg-red-200 text-red-700/70 cursor-not-allowed'
                      : 'bg-red-100 text-red-700 hover:bg-red-200'
                  }`}
                >
                  {actionLoading === 'delete' ? 'Sletter…' : 'Slet forening'}
                </button>
              )}
            </div>
          </>
        )}
      </main>

      {/* ... resten af dine modals er uændret ... */}

      <SiteFooter />
    </div>
  );
}