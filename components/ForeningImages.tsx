'use client';

import { useState, useEffect } from 'react';
import { supabase } from '../lib/supabaseClient';
import Image from 'next/image';

// --- TYPER ---
type EventRow = {
  id: string;
  title: string | null;
  start_at: string;
  end_at: string | null;
};

type ImageRow = {
  id: number;
  image_url: string;
  created_at: string;
  event_id: string;
};

type Props = {
  foreningId: string;
  userId: string | null;
  isMember: boolean;
};

// --- HJÆLPERE ---
const fmtRange = (sISO: string, eISO?: string | null) => {
  const s = new Date(sISO);
  const e = eISO ? new Date(eISO) : null;
  const d = (d: Date) => d.toLocaleDateString("da-DK", { day: "numeric", month: "short" });
  if (!e) return d(s);
  return `${d(s)} - ${d(e)}`;
};

async function resizeImage(file: File, maxWidth = 1600, quality = 0.8): Promise<Blob> {
  return new Promise((resolve, reject) => {
    const img = document.createElement('img');
    const objectUrl = URL.createObjectURL(file);
    img.src = objectUrl;
    img.onload = () => {
      URL.revokeObjectURL(objectUrl);
      const elem = document.createElement('canvas');
      const scaleFactor = Math.min(1, maxWidth / img.width);
      elem.width = img.width * scaleFactor;
      elem.height = img.height * scaleFactor;
      const ctx = elem.getContext('2d');
      if (!ctx) { reject(new Error('Canvas error')); return; }
      ctx.drawImage(img, 0, 0, elem.width, elem.height);
      ctx.canvas.toBlob((blob) => blob ? resolve(blob) : reject(new Error('Blob error')), 'image/jpeg', quality);
    };
    img.onerror = (e) => { URL.revokeObjectURL(objectUrl); reject(e); };
  });
}

export default function ForeningImages({ foreningId, userId, isMember }: Props) {
  const [loading, setLoading] = useState(true);
  const [events, setEvents] = useState<EventRow[]>([]);
  const [counts, setCounts] = useState<Record<string, number>>({});
  const [thumbs, setThumbs] = useState<Record<string, string | null>>({});

  // Modal State (Galleri visning)
  const [activeEvent, setActiveEvent] = useState<EventRow | null>(null);
  const [images, setImages] = useState<ImageRow[]>([]);
  const [uploading, setUploading] = useState(false);
  const [lightboxIndex, setLightboxIndex] = useState<number | null>(null);

  useEffect(() => {
    fetchEvents();
  }, [foreningId]);

  const fetchEvents = async () => {
    setLoading(true);
    const { data } = await supabase
      .from("forening_events")
      .select("id, title, start_at, end_at")
      .eq("forening_id", foreningId)
      .order("start_at", { ascending: false });
    
    if (data) {
      setEvents(data);
      // Hent counts og thumbs parallelt
      const newCounts: Record<string, number> = {};
      const newThumbs: Record<string, string | null> = {};
      
      await Promise.all(data.map(async (ev) => {
        const { data: imgData, count } = await supabase
          .from("event_images")
          .select("image_url", { count: 'exact', head: false }) // head:false for at få data med til thumb
          .eq("event_id", ev.id)
          .order("created_at", { ascending: false })
          .limit(1);
          
        newCounts[ev.id] = count || 0;
        newThumbs[ev.id] = imgData?.[0]?.image_url || null;
      }));
      
      setCounts(newCounts);
      setThumbs(newThumbs);
    }
    setLoading(false);
  };

  const openGallery = async (ev: EventRow) => {
    setActiveEvent(ev);
    const { data } = await supabase
      .from("event_images")
      .select("*")
      .eq("event_id", ev.id)
      .order("created_at", { ascending: false });
    setImages(data || []);
  };

  const handleUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    if (!e.target.files || !e.target.files[0] || !activeEvent || !userId) return;
    try {
      setUploading(true);
      const file = e.target.files[0];
      const compressed = await resizeImage(file);
      const path = `events/${activeEvent.id}/img_${Date.now()}.jpg`;
      
      const { error: upErr } = await supabase.storage.from("eventbilleder").upload(path, compressed, { upsert: true });
      if (upErr) throw upErr;

      const { data: urlData } = supabase.storage.from("eventbilleder").getPublicUrl(path);
      const imageUrl = urlData.publicUrl;

      const { data: inserted, error: dbErr } = await supabase
        .from("event_images")
        .insert([{ event_id: activeEvent.id, image_url: imageUrl, uploaded_by: userId, storage_path: path }])
        .select()
        .single();
        
      if (dbErr) throw dbErr;

      setImages(prev => [inserted, ...prev]);
      setCounts(prev => ({ ...prev, [activeEvent.id]: (prev[activeEvent.id] || 0) + 1 }));
      setThumbs(prev => ({ ...prev, [activeEvent.id]: imageUrl })); // Opdater thumb til nyeste
    } catch (err: any) {
      alert("Fejl: " + err.message);
    } finally {
      setUploading(false);
    }
  };

  const handleDelete = async (img: ImageRow) => {
    if (!confirm("Slet billede permanent?")) return;
    const { error } = await supabase.from("event_images").delete().eq("id", img.id);
    if (!error) {
      setImages(prev => prev.filter(i => i.id !== img.id));
      setCounts(prev => ({ ...prev, [activeEvent!.id]: Math.max(0, (prev[activeEvent!.id] || 1) - 1) }));
    }
  };

  if (loading) return <div className="text-center py-10 text-gray-400">Henter gallerier...</div>;

  return (
    <div>
      {/* EVENT LISTE */}
      {!activeEvent ? (
        <div className="space-y-3">
          {events.length === 0 && <p className="text-center text-gray-400 py-10">Ingen begivenheder endnu.</p>}
          {events.map(ev => (
            <div 
              key={ev.id} 
              onClick={() => openGallery(ev)}
              className="flex items-center bg-white p-3 rounded-xl border border-gray-100 cursor-pointer hover:shadow-md transition-shadow gap-4"
            >
              <div className="w-20 h-14 bg-gray-100 rounded-lg overflow-hidden flex-shrink-0 relative">
                {thumbs[ev.id] ? (
                  <img src={thumbs[ev.id]!} className="w-full h-full object-cover" alt="" />
                ) : (
                  <div className="w-full h-full flex items-center justify-center text-gray-300 font-bold text-xs">Ingen</div>
                )}
                {counts[ev.id] > 0 && (
                  <span className="absolute bottom-1 right-1 bg-black/60 text-white text-[9px] px-1.5 rounded-md font-bold">
                    {counts[ev.id]}
                  </span>
                )}
              </div>
              <div className="flex-1 min-w-0">
                <h4 className="font-bold text-[#131921] truncate">{ev.title || "Uden navn"}</h4>
                <p className="text-xs text-gray-500">{fmtRange(ev.start_at, ev.end_at)}</p>
              </div>
              <div className="text-gray-300">›</div>
            </div>
          ))}
        </div>
      ) : (
        /* ENKELT GALLERI VISNING */
        <div className="animate-in slide-in-from-right-4 duration-300">
          <div className="flex items-center gap-3 mb-4">
            <button onClick={() => setActiveEvent(null)} className="w-8 h-8 rounded-full bg-gray-100 hover:bg-gray-200 flex items-center justify-center font-bold">‹</button>
            <div>
              <h3 className="font-bold text-lg leading-tight">{activeEvent.title}</h3>
              <p className="text-xs text-gray-500">{fmtRange(activeEvent.start_at, activeEvent.end_at)}</p>
            </div>
            {isMember && (
              <label className="ml-auto bg-[#131921] text-white text-xs px-3 py-1.5 rounded-lg font-bold cursor-pointer hover:bg-gray-900 flex items-center gap-1">
                {uploading ? "..." : <><i className="fa-solid fa-plus"></i> Tilføj</>}
                <input type="file" accept="image/*" className="hidden" onChange={handleUpload} disabled={uploading} />
              </label>
            )}
          </div>

          <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-3">
            {images.map((img, idx) => (
              <div key={img.id} className="aspect-square bg-gray-100 rounded-xl overflow-hidden relative group cursor-pointer" onClick={() => setLightboxIndex(idx)}>
                <img src={img.image_url} className="w-full h-full object-cover transition-transform group-hover:scale-105" alt="" />
                {userId && (
                  <button 
                    onClick={(e) => { e.stopPropagation(); handleDelete(img); }}
                    className="absolute top-1 right-1 bg-red-500 text-white w-6 h-6 rounded-full opacity-0 group-hover:opacity-100 flex items-center justify-center text-xs"
                  >
                    ×
                  </button>
                )}
              </div>
            ))}
            {images.length === 0 && <p className="col-span-full text-center text-gray-400 py-10">Ingen billeder i dette album endnu.</p>}
          </div>
        </div>
      )}

      {/* LIGHTBOX */}
      {lightboxIndex !== null && (
        <div className="fixed inset-0 z-[200] bg-black flex items-center justify-center animate-in fade-in duration-200" onClick={() => setLightboxIndex(null)}>
          <button className="absolute top-4 right-4 text-white/70 hover:text-white text-4xl">&times;</button>
          <img src={images[lightboxIndex].image_url} className="max-w-full max-h-full object-contain p-4" onClick={e => e.stopPropagation()} />
          
          {images.length > 1 && (
            <>
              <button 
                className="absolute left-4 text-white/50 hover:text-white text-6xl p-4"
                onClick={(e) => { e.stopPropagation(); setLightboxIndex(prev => (prev === 0 ? images.length - 1 : prev! - 1)); }}
              >‹</button>
              <button 
                className="absolute right-4 text-white/50 hover:text-white text-6xl p-4"
                onClick={(e) => { e.stopPropagation(); setLightboxIndex(prev => (prev! + 1) % images.length); }}
              >›</button>
            </>
          )}
        </div>
      )}
    </div>
  );
}