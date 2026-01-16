'use client';

import { useEffect, useMemo, useState } from 'react';
import { supabase } from '../lib/supabaseClient';

type EventRow = {
  id: string;
  forening_id: string;
  title: string;
  start_at: string;
  end_at: string;
  location?: string | null;
  price?: number | null;
  description?: string | null;
  image_url?: string | null;
};

type SignupRow = {
  id: string;
  event_id: string;
  user_id: string;
  created_at: string;
};

function fmtDateTime(d: any) {
  const dt = new Date(d);
  const date = dt.toLocaleDateString('da-DK', { day: 'numeric', month: 'long', year: 'numeric' });
  const time = dt.toLocaleTimeString('da-DK', { hour: '2-digit', minute: '2-digit' });
  return `${date} kl. ${time}`;
}

function fmtTime(d: any) {
  return new Date(d).toLocaleTimeString('da-DK', { hour: '2-digit', minute: '2-digit' });
}

function getEventImageUrl(path: string | null | undefined) {
  if (!path) return '';
  if (path.startsWith('http')) return path;
  const { data } = supabase.storage.from('event_images').getPublicUrl(path);
  return data.publicUrl;
}

export default function ForeningEvents(props: {
  foreningId: string;
  userId: string | null;
  isUserAdmin: boolean;
  isApprovedMember: boolean;
}) {
  const { foreningId, userId, isApprovedMember } = props;

  const [loading, setLoading] = useState(true);
  const [events, setEvents] = useState<EventRow[]>([]);
  const [signups, setSignups] = useState<SignupRow[]>([]);
  const [openEventId, setOpenEventId] = useState<string | null>(null);

  const [joiningId, setJoiningId] = useState<string | null>(null);
  const [leavingId, setLeavingId] = useState<string | null>(null);

  const joinedSet = useMemo(() => new Set(signups.map((s) => s.event_id)), [signups]);

  const load = async () => {
    setLoading(true);

    // 1) Events
    const { data: ev, error: evErr } = await supabase
      .from('forening_events')
      .select('id, forening_id, title, start_at, end_at, location, price, description, image_url')
      .eq('forening_id', foreningId)
      .order('start_at', { ascending: true });

    if (evErr) {
      console.error(evErr);
      setEvents([]);
    } else {
      setEvents((ev || []) as any);
    }

    // 2) Signups for current user (kun hvis logged in)
    if (userId) {
      const { data: su, error: suErr } = await supabase
        .from('forening_event_tilmeldinger')
        .select('id, event_id, user_id, created_at')
        .eq('user_id', userId);

      if (suErr) {
        console.error(suErr);
        setSignups([]);
      } else {
        setSignups((su || []) as any);
      }
    } else {
      setSignups([]);
    }

    setLoading(false);
  };

  useEffect(() => {
    load();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [foreningId, userId]);

  const handleJoin = async (eventId: string) => {
    if (!userId) {
      alert('Du skal være logget ind for at tilmelde dig.');
      return;
    }
    if (!isApprovedMember) {
      alert('Du skal være godkendt medlem for at tilmelde dig.');
      return;
    }

    setJoiningId(eventId);
    try {
      // ✅ Robust: ingen duplicate-fejl
      const { error } = await supabase
        .from('forening_event_tilmeldinger')
        .upsert(
          { event_id: eventId, user_id: userId },
          { onConflict: 'event_id,user_id', ignoreDuplicates: true }
        );

      if (error) throw error;

      // Refresh local signups (hurtigt UI)
      setSignups((prev) => {
        if (prev.some((p) => p.event_id === eventId)) return prev;
        return [
          ...prev,
          { id: `temp-${eventId}`, event_id: eventId, user_id: userId, created_at: new Date().toISOString() },
        ];
      });
    } catch (e) {
      console.error(e);
      alert('Kunne ikke tilmelde dig (prøv igen).');
    } finally {
      setJoiningId(null);
    }
  };

  const handleLeave = async (eventId: string) => {
    if (!userId) return;

    setLeavingId(eventId);
    try {
      const { error } = await supabase
        .from('forening_event_tilmeldinger')
        .delete()
        .eq('event_id', eventId)
        .eq('user_id', userId);

      if (error) throw error;

      setSignups((prev) => prev.filter((s) => !(s.event_id === eventId && s.user_id === userId)));
    } catch (e) {
      console.error(e);
      alert('Kunne ikke framelde (prøv igen).');
    } finally {
      setLeavingId(null);
    }
  };

  if (loading) {
    return <div className="text-center text-gray-500 font-bold py-10">Indlæser aktiviteter...</div>;
  }

  if (events.length === 0) {
    return <div className="text-center text-gray-400 font-bold py-10">Ingen aktiviteter endnu.</div>;
  }

  return (
    <>
      <div className="space-y-4 pb-10">
        {events.map((e) => {
          const isJoined = joinedSet.has(e.id);

          return (
            <div
              key={e.id}
              className="border border-gray-100 rounded-3xl p-4 shadow-sm hover:shadow-md transition-shadow"
            >
              <div className="flex items-start gap-3">
                {e.image_url ? (
                  <div className="w-20 h-20 rounded-2xl overflow-hidden bg-gray-100 flex-shrink-0">
                    <img src={getEventImageUrl(e.image_url)} className="w-full h-full object-cover" alt="" />
                  </div>
                ) : (
                  <div className="w-20 h-20 rounded-2xl bg-gray-100 flex-shrink-0" />
                )}

                <div className="min-w-0 flex-1">
                  <h2 className="text-lg font-black text-[#131921] truncate">{e.title}</h2>

                  <p className="text-xs font-bold text-gray-600 mt-1">
                    {fmtDateTime(e.start_at)} – {fmtTime(e.end_at)}
                  </p>

                  <p className="text-xs font-bold text-gray-500 mt-1">
                    {e.location ? e.location : 'Lokation ikke angivet'}
                    {typeof e.price === 'number' ? ` • ${e.price > 0 ? `${e.price} kr.` : 'Gratis'}` : ''}
                  </p>

                  {e.description ? (
                    <button
                      onClick={() => setOpenEventId((prev) => (prev === e.id ? null : e.id))}
                      className="mt-2 text-xs font-black text-[#131921] underline"
                    >
                      {openEventId === e.id ? 'Skjul detaljer' : 'Vis detaljer'}
                    </button>
                  ) : null}
                </div>
              </div>

              {openEventId === e.id && e.description ? (
                <div className="mt-3 bg-gray-50 border border-gray-100 rounded-2xl p-3 text-sm text-gray-700 whitespace-pre-wrap">
                  {e.description}
                </div>
              ) : null}

              <div className="mt-4 flex items-center justify-end gap-2">
                {!isJoined ? (
                  <button
                    disabled={!isApprovedMember || joiningId === e.id}
                    onClick={() => handleJoin(e.id)}
                    className="px-4 py-2 rounded-full bg-[#131921] text-white font-black text-xs disabled:opacity-50"
                  >
                    {joiningId === e.id ? 'Tilmelder...' : 'Tilmeld'}
                  </button>
                ) : (
                  <>
                    <div className="px-3 py-2 rounded-full bg-green-100 text-green-700 font-black text-xs">
                      Tilmeldt
                    </div>
                    <button
                      disabled={leavingId === e.id}
                      onClick={() => handleLeave(e.id)}
                      className="px-4 py-2 rounded-full bg-gray-100 text-gray-700 font-black text-xs disabled:opacity-50"
                      title="Frameld"
                    >
                      {leavingId === e.id ? 'Frameld...' : 'Frameld'}
                    </button>
                  </>
                )}
              </div>
            </div>
          );
        })}
      </div>
    </>
  );
}