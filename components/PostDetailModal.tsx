'use client';

import { useState, useEffect, useMemo } from 'react';
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

// Helper for unique IDs
const makeUuid = () => {
  return 'xxxxxxxx-xxxx-4xxx-yxxx-xxxxxxxxxxxx'.replace(/[xy]/g, (c) => {
    const r = (Math.random() * 16) | 0;
    const v = c === 'x' ? r : (r & 0x3) | 0x8;
    return v.toString(16);
  });
};

export default function PostDetailModal({ isOpen, post, onClose, currentUserId }: Props) {
  const router = useRouter();

  const [lightboxOpen, setLightboxOpen] = useState(false);
  const [activeImageIndex, setActiveImageIndex] = useState(0);
  const [isStartingChat, setIsStartingChat] = useState(false);

  useEffect(() => {
    if (isOpen) {
      setActiveImageIndex(0);
      setLightboxOpen(false);
      setIsStartingChat(false);
    }
  }, [isOpen, post]);

  if (!isOpen || !post) return null;

  const images: string[] = useMemo(() => {
    const out: string[] = [];
    if (post.images && post.images.length > 0) out.push(...post.images);
    else if (post.image_url) out.push(post.image_url);
    return out;
  }, [post.images, post.image_url]);

  const isOwnPost = currentUserId === post.user_id;
  const shareUrl =
    typeof window !== 'undefined' ? `${window.location.origin}/opslag?id=${post.id}` : '';

  const handleCopyLink = async () => {
    try {
      await navigator.clipboard.writeText(shareUrl);
      alert('Link kopieret til udklipsholder!');
    } catch {
      alert('Kunne ikke kopiere link.');
    }
  };

  const handleShare = async () => {
    // @ts-ignore
    if (navigator.share) {
      try {
        // @ts-ignore
        await navigator.share({
          title: post.overskrift,
          text: `Se dette opslag på Liguster: ${post.overskrift}`,
          url: shareUrl,
        });
      } catch {
        // bruger annullerede
      }
    } else {
      handleCopyLink();
    }
  };

  const findExistingThreadId = async (me: string, other: string) => {
    // Find seneste thread_id mellem de to brugere (mere stabilt end limit(1) uden sort)
    const { data, error } = await supabase
      .from('messages')
      .select('thread_id, created_at')
      .or(
        `and(sender_id.eq.${me},receiver_id.eq.${other}),and(sender_id.eq.${other},receiver_id.eq.${me})`
      )
      .order('created_at', { ascending: false })
      .limit(5);

    if (error) throw error;

    const firstWithThread = (data || []).find((x) => x.thread_id);
    return firstWithThread?.thread_id as string | null;
  };

  const handleContact = async () => {
    if (!currentUserId) {
      alert('Du skal være logget ind for at skrive en besked.');
      return;
    }
    if (isOwnPost) return;

    setIsStartingChat(true);

    try {
      const me = currentUserId;
      const other = post.user_id;

      // 1) Find eksisterende thread
      let threadId = await findExistingThreadId(me, other);

      // 2) Hvis ingen: opret en ny via første besked
      if (!threadId) {
        threadId = makeUuid();

        const initialMessage = `Hej! Jeg skriver angående dit opslag: "${post.overskrift}"`;

        const { error: insErr } = await supabase.from('messages').insert({
          thread_id: threadId,
          sender_id: me,
          receiver_id: other,
          text: initialMessage,
          is_read: false,
        });

        if (insErr) throw insErr;
      }

      // 3) Gå til beskeder (indbakke / tråd)
      onClose();
      router.push(`/beskeder?thread=${encodeURIComponent(threadId)}&dmUser=${encodeURIComponent(other)}`);
    } catch (error: any) {
      console.error('Fejl ved start af chat:', error);
      alert(`Kunne ikke starte samtalen: ${error?.message || 'Ukendt fejl'}`);
    } finally {
      setIsStartingChat(false);
    }
  };

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
      <div className="absolute inset-0 bg-black/60 backdrop-blur-sm transition-opacity" onClick={onClose} />

      <div className="relative bg-white w-full max-w-2xl rounded-2xl shadow-2xl overflow-hidden flex flex-col max-h-[90vh] animate-in fade-in zoom-in-95 duration-200">
        <button
          onClick={onClose}
          className="absolute top-4 right-4 z-10 bg-black/20 hover:bg-black/40 text-white w-8 h-8 rounded-full flex items-center justify-center backdrop-blur-md transition-colors"
        >
          <i className="fa-solid fa-xmark text-lg"></i>
        </button>

        <div className="overflow-y-auto flex-1 bg-white">
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
                <i className="fa-solid fa-image text-4xl mb-2"></i>
                <p>Intet billede</p>
              </div>
            )}
          </div>

          <div className="p-6">
            <div className="flex flex-wrap gap-2 mb-4">
              {post.kategori && (
                <span className="px-3 py-1 bg-[#eef2ff] text-[#1e293b] text-sm font-bold rounded-full">
                  {post.kategori}
                </span>
              )}
              {post.omraade && (
                <span className="px-3 py-1 bg-gray-100 text-[#334155] text-sm font-bold rounded-full flex items-center gap-1">
                  <i className="fa-solid fa-location-dot text-xs"></i> {post.omraade}
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

        <div className="p-4 border-t border-gray-100 bg-white flex flex-col md:flex-row gap-3 items-stretch md:items-center justify-between shrink-0">
          <div className="flex gap-2">
            <button
              onClick={handleCopyLink}
              className="flex-1 md:flex-none px-4 py-2.5 bg-[#e9eef5] hover:bg-gray-200 text-[#0f172a] text-xs font-bold rounded-xl transition-colors uppercase tracking-wide flex items-center justify-center gap-2"
            >
              <i className="fa-solid fa-link"></i> Kopiér
            </button>
            <button
              onClick={handleShare}
              className="flex-1 md:flex-none px-4 py-2.5 bg-[#e9eef5] hover:bg-gray-200 text-[#0f172a] text-xs font-bold rounded-xl transition-colors uppercase tracking-wide flex items-center justify-center gap-2"
            >
              <i className="fa-solid fa-share-nodes"></i> Del
            </button>
          </div>

          {isOwnPost ? (
            <div className="px-4 py-2.5 bg-gray-50 border border-gray-200 text-gray-500 text-xs font-bold rounded-xl text-center uppercase tracking-wide cursor-default">
              Det er dit opslag
            </div>
          ) : (
            <button
              onClick={handleContact}
              disabled={isStartingChat}
              className={`flex-1 md:flex-none px-6 py-3 text-white text-xs font-bold rounded-xl transition-all uppercase tracking-wide shadow-md flex items-center justify-center gap-2
                ${isStartingChat ? 'bg-gray-400 cursor-not-allowed' : 'bg-[#131921] hover:bg-gray-900'}
              `}
            >
              {isStartingChat ? (
                <span>Starter samtale...</span>
              ) : (
                <>
                  <i className="fa-solid fa-comment"></i> Skriv besked
                </>
              )}
            </button>
          )}
        </div>
      </div>

      {lightboxOpen && images.length > 0 && (
        <div className="fixed inset-0 z-[200] bg-black flex items-center justify-center animate-in fade-in duration-200">
          <button
            onClick={() => setLightboxOpen(false)}
            className="absolute top-6 right-6 text-white/80 hover:text-white bg-white/10 hover:bg-white/20 w-10 h-10 rounded-full flex items-center justify-center backdrop-blur-md transition-colors z-20"
          >
            <i className="fa-solid fa-xmark text-xl"></i>
          </button>

          <img
            src={images[activeImageIndex]}
            alt="Fuldskærm"
            className="max-w-full max-h-full object-contain p-4 select-none"
            draggable="false"
          />

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