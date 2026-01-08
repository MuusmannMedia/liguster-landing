'use client';

import { useState, useEffect, useRef } from 'react';
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
  const [lightboxOpen, setLightboxOpen] = useState(false);
  const [activeImageIndex, setActiveImageIndex] = useState(0);

  // --- SWIPE LOGIK ---
  const [touchStart, setTouchStart] = useState<number | null>(null);
  const [touchEnd, setTouchEnd] = useState<number | null>(null);

  // Minimum swipe distance (i pixels)
  const minSwipeDistance = 50;

  const onTouchStart = (e: React.TouchEvent) => {
    setTouchEnd(null); // Reset
    setTouchStart(e.targetTouches[0].clientX);
  };

  const onTouchMove = (e: React.TouchEvent) => {
    setTouchEnd(e.targetTouches[0].clientX);
  };

  const onTouchEnd = () => {
    if (!touchStart || !touchEnd) return;
    
    const distance = touchStart - touchEnd;
    const isLeftSwipe = distance > minSwipeDistance;
    const isRightSwipe = distance < -minSwipeDistance;

    if (isLeftSwipe) {
      // Swipe til venstre -> Næste billede
      setActiveImageIndex(prev => (prev + 1) % images.length);
    } 
    
    if (isRightSwipe) {
       // Swipe til højre -> Forrige billede
       setActiveImageIndex(prev => (prev === 0 ? images.length - 1 : prev - 1));
    }
  };
  // -------------------

  // Nulstil når modal åbnes med nyt opslag
  useEffect(() => {
    if (isOpen) {
      setActiveImageIndex(0);
      setLightboxOpen(false);
    }
  }, [isOpen, post]);

  if (!isOpen || !post) return null;

  // 1. Normaliser billeder
  const images: string[] = [];
  if (post.images && post.images.length > 0) {
    post.images.forEach(img => images.push(img));
  } else if (post.image_url) {
    images.push(post.image_url);
  }

  const isOwnPost = currentUserId === post.user_id;
  const shareUrl = typeof window !== 'undefined' ? `${window.location.origin}/opslag?id=${post.id}` : '';

  // --- Handlinger ---
  const handleCopyLink = async () => {
    try {
      await navigator.clipboard.writeText(shareUrl);
      alert("Link kopieret til udklipsholder!");
    } catch (err) {
      alert("Kunne ikke kopiere link.");
    }
  };

  const handleShare = async () => {
    if (navigator.share) {
      try {
        await navigator.share({
          title: post.overskrift,
          text: `Se dette opslag på Liguster: ${post.overskrift}`,
          url: shareUrl,
        });
      } catch (err) {
        // Bruger annullerede deling
      }
    } else {
      handleCopyLink(); // Fallback
    }
  };

  const handleContact = () => {
    if (isOwnPost) return;
    alert("Chat-funktionen kommer snart!");
  };

  return (
    <div className="fixed inset-0 z-[150] flex items-center justify-center p-4 z-50">
      {/* 1. Backdrop */}
      <div 
        className="absolute inset-0 bg-black/60 backdrop-blur-sm transition-opacity"
        onClick={onClose}
      ></div>

      {/* 2. Selve Kortet */}
      <div className="relative bg-white w-full max-w-2xl rounded-2xl shadow-2xl overflow-hidden flex flex-col max-h-[90vh] animate-in fade-in zoom-in-95 duration-200">
        
        {/* Luk Knap */}
        <button 
          onClick={onClose}
          className="absolute top-4 right-4 z-10 bg-black/20 hover:bg-black/40 text-white w-8 h-8 rounded-full flex items-center justify-center backdrop-blur-md transition-colors"
        >
          <i className="fa-solid fa-xmark text-lg"></i>
        </button>

        {/* Scrollbart indhold */}
        <div className="overflow-y-auto flex-1 bg-white">
          
          {/* A. Billed-sektion (NU MED SWIPE) */}
          <div 
            className="relative bg-gray-100 w-full aspect-[4/3] group select-none"
            onTouchStart={onTouchStart}
            onTouchMove={onTouchMove}
            onTouchEnd={onTouchEnd}
          >
            {images.length > 0 ? (
              <>
                <img 
                  src={images[activeImageIndex]} 
                  alt={post.overskrift}
                  className="w-full h-full object-cover cursor-zoom-in pointer-events-none md:pointer-events-auto" // pointer-events-none på mobil for at swipe virker bedst
                  onClick={() => setLightboxOpen(true)}
                  draggable="false" // Vigtigt for ikke at trække billedet i stedet for swipe
                />
                
                {/* Dots til galleri */}
                {images.length > 1 && (
                  <div className="absolute bottom-4 left-0 right-0 flex justify-center gap-2">
                    {images.map((_, idx) => (
                      <button
                        key={idx}
                        onClick={(e) => { e.stopPropagation(); setActiveImageIndex(idx); }}
                        className={`w-2 h-2 rounded-full transition-all ${idx === activeImageIndex ? 'bg-white w-4' : 'bg-white/50'}`}
                      />
                    ))}
                  </div>
                )}
                
                {/* Pile til galleri (Kun synlige på desktop via group-hover) */}
                {images.length > 1 && (
                  <>
                    <button 
                      className="hidden md:flex absolute left-2 top-1/2 -translate-y-1/2 bg-black/30 text-white w-8 h-8 rounded-full items-center justify-center opacity-0 group-hover:opacity-100 transition-opacity"
                      onClick={(e) => {
                        e.stopPropagation();
                        setActiveImageIndex(prev => (prev === 0 ? images.length - 1 : prev - 1));
                      }}
                    >
                      ‹
                    </button>
                    <button 
                      className="hidden md:flex absolute right-2 top-1/2 -translate-y-1/2 bg-black/30 text-white w-8 h-8 rounded-full items-center justify-center opacity-0 group-hover:opacity-100 transition-opacity"
                      onClick={(e) => {
                        e.stopPropagation();
                        setActiveImageIndex(prev => (prev + 1) % images.length);
                      }}
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
                  <i className="fa-solid fa-location-dot text-xs"></i> {post.omraade}
                </span>
              )}
            </div>

            <h2 className="text-2xl font-bold text-[#0f172a] mb-4">{post.overskrift}</h2>
            
            <p className="text-[#0f172a] leading-relaxed whitespace-pre-wrap">
              {post.text}
            </p>

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
              className="flex-1 md:flex-none px-6 py-3 bg-[#131921] hover:bg-gray-900 text-white text-xs font-bold rounded-xl transition-colors uppercase tracking-wide shadow-md flex items-center justify-center gap-2"
            >
              <i className="fa-solid fa-comment"></i> Skriv besked
            </button>
          )}
        </div>
      </div>

      {/* --- LIGHTBOX (Fuldskærm) --- */}
      {lightboxOpen && images.length > 0 && (
        <div 
          className="fixed inset-0 z-[200] bg-black flex items-center justify-center animate-in fade-in duration-200"
          onTouchStart={onTouchStart} // Swipe også her
          onTouchMove={onTouchMove}
          onTouchEnd={onTouchEnd}
        >
          <button 
            onClick={() => setLightboxOpen(false)}
            className="absolute top-6 right-6 text-white/80 hover:text-white bg-white/10 hover:bg-white/20 w-10 h-10 rounded-full flex items-center justify-center backdrop-blur-md transition-colors"
          >
            <i className="fa-solid fa-xmark text-xl"></i>
          </button>
          
          <img 
            src={images[activeImageIndex]} 
            alt="Fuldskærm" 
            className="max-w-full max-h-full object-contain p-4 select-none"
            draggable="false"
          />

           {/* Pile i Lightbox (synlige på desktop) */}
           {images.length > 1 && (
              <>
                <button 
                  className="hidden md:block absolute left-4 top-1/2 -translate-y-1/2 text-white/80 hover:text-white text-4xl p-4"
                  onClick={(e) => { e.stopPropagation(); setActiveImageIndex(prev => (prev === 0 ? images.length - 1 : prev - 1)); }}
                >‹</button>
                <button 
                  className="hidden md:block absolute right-4 top-1/2 -translate-y-1/2 text-white/80 hover:text-white text-4xl p-4"
                  onClick={(e) => { e.stopPropagation(); setActiveImageIndex(prev => (prev + 1) % images.length); }}
                >›</button>
              </>
            )}
        </div>
      )}

    </div>
  );
}