'use client';

import { useEffect, useMemo, useState } from 'react';
import { useRouter } from 'next/navigation';
import { supabase } from '../lib/supabaseClient';

type Post = {
  id: string;
  created_at: string;
  overskrift: string;
  text: string;
  image_url?: string;
  images?: string[];
  kategori?: string;
  omraade?: string;
  user_id: string;
};

type Props = {
  isOpen: boolean;
  post: Post | null;
  onClose: () => void;
  currentUserId: string | null;
};

export default function PostDetailModal({ isOpen, post, onClose, currentUserId }: Props) {
  const router = useRouter();

  const [lightboxOpen, setLightboxOpen] = useState(false);
  const [activeImageIndex, setActiveImageIndex] = useState(0);

  // Compose modal til første besked
  const [composeOpen, setComposeOpen] = useState(false);
  const [firstMessage, setFirstMessage] = useState('');
  const [sending, setSending] = useState(false);
  const [sendError, setSendError] = useState<string | null>(null);

  // Nulstil når modal åbnes med nyt opslag
  useEffect(() => {
    if (isOpen) {
      setActiveImageIndex(0);
      setLightboxOpen(false);
      setComposeOpen(false);
      setFirstMessage('');
      setSendError(null);
      setSending(false);
    }
  }, [isOpen, post]);

  if (!isOpen || !post) return null;

  // 1. Normaliser billeder
  const images: string[] = useMemo(() => {
    const out: string[] = [];
    if (post.images && post.images.length > 0) out.push(...post.images);
    else if (post.image_url) out.push(post.image_url);
    return out;
  }, [post.images, post.image_url]);

  const isOwnPost = currentUserId === post.user_id;
  const shareUrl =
    typeof window !== 'undefined' ? `${window.location.origin}/opslag?id=${post.id}` : '';

  // --- Handlinger ---
  const handleCopyLink = async () => {
    try {
      await navigator.clipboard.writeText(shareUrl);
      alert('Link kopieret til udklipsholder!');
    } catch {
      alert('Kunne ikke kopiere link.');
    }
  };

  const handleShare = async () => {
    if ((navigator as any).share) {
      try {
        await (navigator as any).share({
          title: post.overskrift,
          text: `Se dette opslag på Liguster: ${post.overskrift}`,
          url: shareUrl,
        });
      } catch {
        // Bruger annullerede deling
      }
    } else {
      handleCopyLink(); // Fallback
    }
  };

  // Find/opret DM-tråd mellem currentUserId og post.user_id via dm_thread_state
  const getOrCreateDmThread = async (me: string, other: string) => {
    // 1) Find eksisterende thread_id
    const { data: existing, error: exErr } = await supabase
      .from('dm_thread_state')
      .select('thread_id')
      .eq('user_id', me)
      .eq('other_user_id', other)
      .maybeSingle();

    if (!exErr && existing?.thread_id) return existing.thread_id as string;

    // 2) Opret ny tråd-id
    const threadId =
      typeof crypto !== 'undefined' && 'randomUUID' in crypto
        ? crypto.randomUUID()
        : `${Date.now()}-${Math.random().toString(16).slice(2)}`;

    // 3) Opret state-rækker for begge brugere
    //    (hvis du har unique på (user_id, other_user_id) er upsert vigtig)
    const { error: upErr } = await supabase
      .from('dm_thread_state')
      .upsert(
        [
          { thread_id: threadId, user_id: me, other_user_id: other },
          { thread_id: threadId, user_id: other, other_user_id: me },
        ],
        { onConflict: 'user_id,other_user_id' }
      );

    // Hvis upsert fejler pga. onConflict/constraint, så prøv en simpel insert og ignorer dup
    if (upErr) {
      // Nogle projekter har ikke onConflict tilladt fra client – fallback:
      const { error: insErr } = await supabase.from('dm_thread_state').insert([
        { thread_id: threadId, user_id: me, other_user_id: other },
        { thread_id: threadId, user_id: other, other_user_id: me },
      ]);

      if (insErr && !/duplicate|23505/i.test(String(insErr.message))) {
        throw insErr;
      }

      // Hvis det var duplicate, så re-fetch det rigtige thread_id
      const { data: existing2, error: ex2Err } = await supabase
        .from('dm_thread_state')
        .select('thread_id')
        .eq('user_id', me)
        .eq('other_user_id', other)
        .maybeSingle();

      if (!ex2Err && existing2?.thread_id) return existing2.thread_id as string;
    }

    return threadId;
  };

  // Robust insert i messages – prøver flere feltnavne til tekst
  const insertMessageRobust = async (threadId: string, senderId: string, text: string) => {
    const candidates: any[] = [
      { thread_id: threadId, sender_id: senderId, body: text },
      { thread_id: threadId, sender_id: senderId, text },
      { thread_id: threadId, sender_id: senderId, message: text },
      { thread_id: threadId, sender_id: senderId, content: text },
      // fallback hvis din tabel bruger user_id i stedet for sender_id:
      { thread_id: threadId, user_id: senderId, body: text },
      { thread_id: threadId, user_id: senderId, text },
      { thread_id: threadId, user_id: senderId, message: text },
      { thread_id: threadId, user_id: senderId, content: text },
    ];

    let lastErr: any = null;
    for (const payload of candidates) {
      const { error } = await supabase.from('messages').insert([payload]);
      if (!error) return;
      lastErr = error;
      // Hvis fejlen handler om "column does not exist", så prøv næste payload
      const msg = String(error.message || '');
      if (!/column .* does not exist|unknown column|could not find/i.test(msg)) {
        // Hvis det er en anden fejl (RLS, permission, etc.), stop og smid den
        throw error;
      }
    }
    throw lastErr ?? new Error('Kunne ikke indsætte beskeden.');
  };

  const handleContact = () => {
    if (isOwnPost) return;
    setSendError(null);
    setFirstMessage('');
    setComposeOpen(true);
  };

  const handleSendFirstMessage = async () => {
    if (!currentUserId) {
      alert('Du skal være logget ind for at sende en besked.');
      return;
    }
    if (!post?.user_id) return;
    if (currentUserId === post.user_id) return;

    const msg = firstMessage.trim();
    if (!msg) {
      setSendError('Skriv en besked før du sender.');
      return;
    }

    setSending(true);
    setSendError(null);

    try {
      const threadId = await getOrCreateDmThread(currentUserId, post.user_id);

      await insertMessageRobust(threadId, currentUserId, msg);

      // Luk compose + post modal og gå til indbakken
      setComposeOpen(false);
      onClose();

      // Åbn indbakken – med hint om tråden (så du evt. kan autoåbne tråden der)
      router.push(`/beskeder?thread=${encodeURIComponent(threadId)}`);
    } catch (e: any) {
      setSendError(e?.message ?? 'Kunne ikke sende beskeden.');
    } finally {
      setSending(false);
    }
  };

  // Navigations-funktioner (Brugt både i kort og lightbox)
  const nextImage = (e?: React.MouseEvent) => {
    e?.stopPropagation();
    if (images.length <= 1) return;
    setActiveImageIndex((prev) => (prev + 1) % images.length);
  };

  const prevImage = (e?: React.MouseEvent) => {
    e?.stopPropagation();
    if (images.length <= 1) return;
    setActiveImageIndex((prev) => (prev === 0 ? images.length - 1 : prev - 1));
  };

  return (
    <div className="fixed inset-0 z-[150] flex items-center justify-center p-4 z-50">
      {/* 1. Backdrop */}
      <div className="absolute inset-0 bg-black/60 backdrop-blur-sm transition-opacity" onClick={onClose} />

      {/* 2. Selve Kortet */}
      <div className="relative bg-white w-full max-w-2xl rounded-2xl shadow-2xl overflow-hidden flex flex-col max-h-[90vh] animate-in fade-in zoom-in-95 duration-200">
        {/* Luk Knap */}
        <button
          onClick={onClose}
          className="absolute top-4 right-4 z-10 bg-black/20 hover:bg-black/40 text-white w-8 h-8 rounded-full flex items-center justify-center backdrop-blur-md transition-colors"
        >
          <i className="fa-solid fa-xmark text-lg" />
        </button>

        {/* Scrollbart indhold */}
        <div className="overflow-y-auto flex-1 bg-white">
          {/* A. Billed-sektion */}
          <div className="relative bg-gray-100 w-full aspect-[4/3] group select-none">
            {images.length > 0 ? (
              <>
                <img
                  src={images[activeImageIndex]}
                  alt={post.overskrift}
                  className="w-full h-full object-cover cursor-zoom-in"
                  onClick={() => setLightboxOpen(true)}
                  draggable="false"
                />

                {/* Dots til galleri */}
                {images.length > 1 && (
                  <div className="absolute bottom-4 left-0 right-0 flex justify-center gap-2 z-10">
                    {images.map((_, idx) => (
                      <button
                        key={idx}
                        onClick={(e) => {
                          e.stopPropagation();
                          setActiveImageIndex(idx);
                        }}
                        className={`w-2 h-2 rounded-full transition-all shadow-sm ${
                          idx === activeImageIndex ? 'bg-white w-4' : 'bg-white/50'
                        }`}
                      />
                    ))}
                  </div>
                )}

                {/* PILE TIL GALLERI */}
                {images.length > 1 && (
                  <>
                    <button
                      className="absolute left-2 top-1/2 -translate-y-1/2 bg-black/40 text-white w-10 h-10 rounded-full flex items-center justify-center hover:bg-black/60 transition-colors z-10"
                      onClick={prevImage}
                    >
                      ‹
                    </button>
                    <button
                      className="absolute right-2 top-1/2 -translate-y-1/2 bg-black/40 text-white w-10 h-10 rounded-full flex items-center justify-center hover:bg-black/60 transition-colors z-10"
                      onClick={nextImage}
                    >
                      ›
                    </button>
                  </>
                )}
              </>
            ) : (
              <div className="w-full h-full flex flex-col items-center justify-center text-gray-400">
                <i className="fa-solid fa-image text-4xl mb-2" />
                <p>Intet billede</p>
              </div>
            )}
          </div>

          {/* B. Indhold */}
          <div className="p-6">
            <div className="flex flex-wrap gap-2 mb-4">
              {post.kategori && (
                <span className="px-3 py-1 bg-[#eef2ff] text-[#1e293b] text-sm font-bold rounded-full">
                  {post.kategori}
                </span>
              )}
              {post.omraade && (
                <span className="px-3 py-1 bg-gray-100 text-[#334155] text-sm font-bold rounded-full flex items-center gap-1">
                  <i className="fa-solid fa-location-dot text-xs" /> {post.omraade}
                </span>
              )}
            </div>

            <h2 className="text-2xl font-bold text-[#0f172a] mb-4">{post.overskrift}</h2>

            <p className="text-[#0f172a] leading-relaxed whitespace-pre-wrap">{post.text}</p>

            <div className="mt-8 pt-6 border-t border-gray-100 text-sm text-gray-500">
              Oprettet {new Date(post.created_at).toLocaleDateString()}
            </div>
          </div>
        </div>

        {/* C. Footer */}
        <div className="p-4 border-t border-gray-100 bg-white flex flex-col md:flex-row gap-3 items-stretch md:items-center justify-between shrink-0">
          <div className="flex gap-2">
            <button
              onClick={handleCopyLink}
              className="flex-1 md:flex-none px-4 py-2.5 bg-[#e9eef5] hover:bg-gray-200 text-[#0f172a] text-xs font-bold rounded-xl transition-colors uppercase tracking-wide flex items-center justify-center gap-2"
            >
              <i className="fa-solid fa-link" /> Kopiér
            </button>
            <button
              onClick={handleShare}
              className="flex-1 md:flex-none px-4 py-2.5 bg-[#e9eef5] hover:bg-gray-200 text-[#0f172a] text-xs font-bold rounded-xl transition-colors uppercase tracking-wide flex items-center justify-center gap-2"
            >
              <i className="fa-solid fa-share-nodes" /> Del
            </button>
          </div>

          {isOwnPost ? (
            <div className="px-4 py-2.5 bg-gray-50 border border-gray-200 text-gray-500 text-xs font-bold rounded-xl text-center uppercase tracking-wide cursor-default">
              Det er dit opslag
            </div>
          ) : (
            <button
              onClick={handleContact}
              className="flex-1 md:flex-none px-6 py-3 bg-[#131921] hover:bg-gray-900 text-white text-xs font-bold rounded-xl transition-colors uppercase tracking-wide shadow-md flex items-center justify-center gap-2"
            >
              <i className="fa-solid fa-comment" /> Skriv besked
            </button>
          )}
        </div>
      </div>

      {/* --- Compose modal: skriv første besked --- */}
      {composeOpen && !isOwnPost && (
        <div className="fixed inset-0 z-[180] flex items-center justify-center p-4">
          <div
            className="absolute inset-0 bg-black/70 backdrop-blur-sm"
            onClick={() => (!sending ? setComposeOpen(false) : null)}
          />
          <div className="relative w-full max-w-lg bg-white rounded-2xl shadow-2xl overflow-hidden">
            <div className="bg-[#131921] px-5 py-4 flex items-center justify-between">
              <div className="text-white font-black tracking-wide uppercase text-sm">
                Skriv besked
              </div>
              <button
                className="text-white/80 hover:text-white text-2xl leading-none"
                onClick={() => (!sending ? setComposeOpen(false) : null)}
                aria-label="Luk"
              >
                &times;
              </button>
            </div>

            <div className="p-5 space-y-3">
              <div className="text-sm text-gray-600">
                Til: <span className="font-bold text-gray-900">opslags-ejeren</span>
                <div className="text-xs text-gray-400 mt-1">
                  Dit opslag: <span className="font-bold">{post.overskrift}</span>
                </div>
              </div>

              <textarea
                value={firstMessage}
                onChange={(e) => setFirstMessage(e.target.value)}
                placeholder="Skriv din besked her…"
                className="w-full min-h-[120px] p-3 bg-gray-50 rounded-xl border border-gray-200 outline-none focus:border-[#131921] text-[#131921] placeholder-gray-500 font-medium"
                disabled={sending}
              />

              {sendError && (
                <div className="text-xs text-red-600 font-bold">{sendError}</div>
              )}

              <div className="flex gap-2 pt-2">
                <button
                  onClick={() => setComposeOpen(false)}
                  disabled={sending}
                  className="flex-1 px-4 py-3 rounded-xl bg-gray-100 hover:bg-gray-200 text-[#131921] font-bold text-sm"
                >
                  Annullér
                </button>
                <button
                  onClick={handleSendFirstMessage}
                  disabled={sending}
                  className="flex-1 px-4 py-3 rounded-xl bg-[#131921] hover:bg-gray-900 text-white font-bold text-sm disabled:opacity-60"
                >
                  {sending ? 'Sender…' : 'Send'}
                </button>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* --- LIGHTBOX (Fuldskærm) --- */}
      {lightboxOpen && images.length > 0 && (
        <div className="fixed inset-0 z-[200] bg-black flex items-center justify-center animate-in fade-in duration-200">
          <button
            onClick={() => setLightboxOpen(false)}
            className="absolute top-6 right-6 text-white/80 hover:text-white bg-white/10 hover:bg-white/20 w-10 h-10 rounded-full flex items-center justify-center backdrop-blur-md transition-colors z-20"
          >
            <i className="fa-solid fa-xmark text-xl" />
          </button>

          <img
            src={images[activeImageIndex]}
            alt="Fuldskærm"
            className="max-w-full max-h-full object-contain p-4 select-none"
            draggable="false"
          />

          {/* Pile i Lightbox */}
          {images.length > 1 && (
            <>
              <button
                className="absolute left-4 top-1/2 -translate-y-1/2 text-white/80 hover:text-white text-4xl p-4 z-20"
                onClick={prevImage}
              >
                ‹
              </button>
              <button
                className="absolute right-4 top-1/2 -translate-y-1/2 text-white/80 hover:text-white text-4xl p-4 z-20"
                onClick={nextImage}
              >
                ›
              </button>
            </>
          )}
        </div>
      )}
    </div>
  );
}