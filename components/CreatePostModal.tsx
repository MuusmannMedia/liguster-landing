'use client';

import { useState, useRef, useEffect } from 'react';
import { supabase } from '../lib/supabaseClient';

type Props = {
  isOpen: boolean;
  onClose: () => void;
  onPostCreated: () => void;
};

// Konstante kategorier (samme som på forsiden)
const KATEGORIER = [
  'Værktøj', 'Arbejde tilbydes', 'Affald', 'Mindre ting', 
  'Større ting', 'Hjælp søges', 'Hjælp tilbydes', 
  'Byttes', 'Udlejning', 'Sælges', 'Andet'
];

export default function CreatePostModal({ isOpen, onClose, onPostCreated }: Props) {
  const [loading, setLoading] = useState(false);
  
  // Form felter
  const [overskrift, setOverskrift] = useState('');
  const [text, setText] = useState('');
  const [kategori, setKategori] = useState(KATEGORIER[0]);
  const [omraade, setOmraade] = useState('');
  
  // Billeder
  const [images, setImages] = useState<File[]>([]);
  const [previewUrls, setPreviewUrls] = useState<string[]>([]);
  
  // NYT: Lokation
  const [location, setLocation] = useState<{lat: number, lng: number} | null>(null);
  const [locationStatus, setLocationStatus] = useState<'idle' | 'loading' | 'success' | 'error'>('idle');

  // Nulstil alt når modal åbner
  useEffect(() => {
    if (isOpen) {
      setOverskrift('');
      setText('');
      setKategori(KATEGORIER[0]);
      setOmraade('');
      setImages([]);
      setPreviewUrls([]);
      setLocation(null);
      setLocationStatus('idle');
      
      // Prøv automatisk at hente lokation når modal åbner
      getLocation();
    }
  }, [isOpen]);

  // Funktion til at hente GPS
  const getLocation = () => {
    if (!('geolocation' in navigator)) {
      setLocationStatus('error');
      return;
    }

    setLocationStatus('loading');
    
    navigator.geolocation.getCurrentPosition(
      (position) => {
        setLocation({
          lat: position.coords.latitude,
          lng: position.coords.longitude
        });
        setLocationStatus('success');
        // Vi kan evt. prøve at udfylde "Område" automatisk her, men det kræver et API-kald (Reverse Geocoding),
        // så vi holder det simpelt og lader brugeren skrive bynavn selv indtil videre.
      },
      (error) => {
        console.warn("Kunne ikke hente position:", error);
        setLocationStatus('error');
      }
    );
  };

  const handleImageChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    if (e.target.files && e.target.files.length > 0) {
      const newFiles = Array.from(e.target.files);
      setImages((prev) => [...prev, ...newFiles]);
      
      // Lav previews
      const newPreviews = newFiles.map(file => URL.createObjectURL(file));
      setPreviewUrls((prev) => [...prev, ...newPreviews]);
    }
  };

  const removeImage = (index: number) => {
    setImages(prev => prev.filter((_, i) => i !== index));
    setPreviewUrls(prev => prev.filter((_, i) => i !== index));
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);

    try {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) throw new Error('Ingen bruger fundet');

      // 1. Upload billeder (hvis nogen)
      const imageUrls: string[] = [];
      
      for (const file of images) {
        const fileExt = file.name.split('.').pop();
        const fileName = `${Math.random()}.${fileExt}`;
        const filePath = `${user.id}/${fileName}`;

        const { error: uploadError } = await supabase.storage
          .from('post-images')
          .upload(filePath, file);

        if (uploadError) throw uploadError;

        const { data: { publicUrl } } = supabase.storage
          .from('post-images')
          .getPublicUrl(filePath);

        imageUrls.push(publicUrl);
      }

      // 2. Opret opslag i databasen
      const { error } = await supabase
        .from('posts')
        .insert({
          user_id: user.id,
          overskrift,
          text,
          kategori,
          omraade, // Bynavn som tekst
          images: imageUrls,
          image_url: imageUrls[0] || null, // Bagudkompatibilitet
          // NYT: Gem GPS koordinater
          latitude: location?.lat || null,
          longitude: location?.lng || null,
          // Sæt udløbsdato til 30 dage fra nu (standard)
          expires_at: new Date(Date.now() + 30 * 24 * 60 * 60 * 1000).toISOString(),
        });

      if (error) throw error;

      onPostCreated();
      onClose();

    } catch (error) {
      console.error('Fejl ved oprettelse:', error);
      alert('Der skete en fejl. Prøv igen.');
    } finally {
      setLoading(false);
    }
  };

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 z-[100] flex items-center justify-center p-4 bg-black/60 backdrop-blur-sm animate-in fade-in duration-200">
      <div className="bg-white w-full max-w-lg rounded-3xl p-6 shadow-2xl max-h-[90vh] overflow-y-auto animate-in zoom-in-95 duration-200">
        
        <div className="flex justify-between items-center mb-6">
          <h2 className="text-2xl font-bold text-[#131921]">Opret opslag</h2>
          <button onClick={onClose} className="text-gray-400 hover:text-gray-600">
            <i className="fa-solid fa-times text-2xl"></i>
          </button>
        </div>

        <form onSubmit={handleSubmit} className="space-y-5">
          
          {/* Titel */}
          <div>
            <label className="block text-sm font-bold text-gray-700 mb-1">Overskrift</label>
            <input
              type="text"
              required
              value={overskrift}
              onChange={(e) => setOverskrift(e.target.value)}
              className="w-full rounded-xl border-gray-200 bg-gray-50 p-3 focus:ring-2 focus:ring-[#131921] outline-none transition-all"
              placeholder="Hvad handler det om?"
            />
          </div>

          {/* Kategori */}
          <div>
            <label className="block text-sm font-bold text-gray-700 mb-1">Kategori</label>
            <select
              value={kategori}
              onChange={(e) => setKategori(e.target.value)}
              className="w-full rounded-xl border-gray-200 bg-gray-50 p-3 focus:ring-2 focus:ring-[#131921] outline-none"
            >
              {KATEGORIER.map(k => <option key={k} value={k}>{k}</option>)}
            </select>
          </div>

          {/* Lokation (Område tekst + GPS Status) */}
          <div className="grid grid-cols-2 gap-4">
            <div>
              <label className="block text-sm font-bold text-gray-700 mb-1">By / Område</label>
              <input
                type="text"
                required
                value={omraade}
                onChange={(e) => setOmraade(e.target.value)}
                className="w-full rounded-xl border-gray-200 bg-gray-50 p-3 focus:ring-2 focus:ring-[#131921] outline-none"
                placeholder="F.eks. Lyngby"
              />
            </div>
            
            {/* GPS Indikator */}
            <div>
               <label className="block text-sm font-bold text-gray-700 mb-1">GPS Placering</label>
               <div className={`w-full rounded-xl p-3 flex items-center gap-2 text-sm font-medium border ${
                 locationStatus === 'success' ? 'bg-green-50 border-green-100 text-green-700' :
                 locationStatus === 'error' ? 'bg-yellow-50 border-yellow-100 text-yellow-700' :
                 'bg-gray-50 border-gray-100 text-gray-500'
               }`}>
                 {locationStatus === 'loading' && <i className="fa-solid fa-spinner animate-spin"></i>}
                 {locationStatus === 'success' && <i className="fa-solid fa-check-circle"></i>}
                 {locationStatus === 'error' && <i className="fa-solid fa-triangle-exclamation"></i>}
                 {locationStatus === 'idle' && <i className="fa-solid fa-location-crosshairs"></i>}
                 
                 <span>
                   {locationStatus === 'loading' && 'Henter...'}
                   {locationStatus === 'success' && 'Position fundet'}
                   {locationStatus === 'error' && 'Ingen GPS (vises kun lokalt)'}
                   {locationStatus === 'idle' && 'Venter...'}
                 </span>

                 {/* Genopfrisk knap hvis det fejlede */}
                 {locationStatus === 'error' && (
                   <button type="button" onClick={getLocation} className="ml-auto text-[#131921] underline text-xs">
                     Prøv igen
                   </button>
                 )}
               </div>
            </div>
          </div>

          {/* Tekst */}
          <div>
            <label className="block text-sm font-bold text-gray-700 mb-1">Beskrivelse</label>
            <textarea
              required
              rows={4}
              value={text}
              onChange={(e) => setText(e.target.value)}
              className="w-full rounded-xl border-gray-200 bg-gray-50 p-3 focus:ring-2 focus:ring-[#131921] outline-none resize-none"
              placeholder="Fortæl lidt mere..."
            />
          </div>

          {/* Billeder */}
          <div>
            <label className="block text-sm font-bold text-gray-700 mb-2">Billeder</label>
            
            <div className="grid grid-cols-4 gap-2 mb-2">
              {previewUrls.map((url, i) => (
                <div key={i} className="relative aspect-square rounded-lg overflow-hidden group">
                  <img src={url} className="w-full h-full object-cover" />
                  <button
                    type="button"
                    onClick={() => removeImage(i)}
                    className="absolute top-1 right-1 bg-red-500 text-white w-6 h-6 rounded-full flex items-center justify-center opacity-0 group-hover:opacity-100 transition-opacity"
                  >
                    <i className="fa-solid fa-times text-xs"></i>
                  </button>
                </div>
              ))}
              
              <label className="aspect-square rounded-xl border-2 border-dashed border-gray-300 flex flex-col items-center justify-center cursor-pointer hover:border-[#131921] hover:bg-gray-50 transition-colors text-gray-400 hover:text-[#131921]">
                <i className="fa-solid fa-camera text-2xl mb-1"></i>
                <span className="text-xs font-bold">Tilføj</span>
                <input type="file" multiple accept="image/*" className="hidden" onChange={handleImageChange} />
              </label>
            </div>
          </div>

          {/* Submit Knap */}
          <button
            type="submit"
            disabled={loading}
            className="w-full bg-[#131921] text-white font-bold py-4 rounded-xl shadow-lg hover:bg-gray-900 transition-all transform active:scale-[0.98] disabled:opacity-70 disabled:cursor-not-allowed flex items-center justify-center gap-2"
          >
            {loading ? (
              <><i className="fa-solid fa-spinner animate-spin"></i> Opretter...</>
            ) : (
              'Opret Opslag'
            )}
          </button>

        </form>
      </div>
    </div>
  );
}