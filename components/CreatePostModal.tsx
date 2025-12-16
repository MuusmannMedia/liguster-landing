'use client';

import { useState, useRef } from 'react';
import { supabase } from '../lib/supabaseClient';

type Props = {
  isOpen: boolean;
  onClose: () => void;
  onPostCreated: () => void;
};

// Skal matche navnet på din bucket fra appen
const BUCKET_NAME = 'opslagsbilleder';

const KATEGORIER = [
  'Værktøj', 'Arbejde tilbydes', 'Affald', 'Mindre ting', 
  'Større ting', 'Hjælp søges', 'Hjælp tilbydes', 
  'Byttes', 'Udlejning', 'Sælges', 'Andet'
];

// --- HJÆLPEFUNKTION: Robust Billed-komprimering ---
async function resizeImage(file: File, maxWidth = 1200, quality = 0.8): Promise<Blob> {
  return new Promise((resolve, reject) => {
    const img = new Image();
    // Brug createObjectURL for bedre performance med store filer
    const objectUrl = URL.createObjectURL(file);
    img.src = objectUrl;

    img.onload = () => {
      // Frigiv hukommelse
      URL.revokeObjectURL(objectUrl);

      const elem = document.createElement('canvas');
      // Beregn ny størrelse (behold aspect ratio)
      const scaleFactor = Math.min(1, maxWidth / img.width);
      
      elem.width = img.width * scaleFactor;
      elem.height = img.height * scaleFactor;
      
      const ctx = elem.getContext('2d');
      if (!ctx) {
        reject(new Error('Browseren kunne ikke behandle billedet'));
        return;
      }
      
      ctx.drawImage(img, 0, 0, elem.width, elem.height);
      
      ctx.canvas.toBlob((blob) => {
        if (blob) {
          console.log(`Billede komprimeret: Fra ${(file.size / 1024).toFixed(0)}KB til ${(blob.size / 1024).toFixed(0)}KB`);
          resolve(blob);
        } else {
          reject(new Error('Fejl ved generering af blob'));
        }
      }, 'image/jpeg', quality);
    };

    img.onerror = (error) => {
      URL.revokeObjectURL(objectUrl);
      reject(error);
    };
  });
}

export default function CreatePostModal({ isOpen, onClose, onPostCreated }: Props) {
  const [loading, setLoading] = useState(false);
  const [overskrift, setOverskrift] = useState('');
  const [text, setText] = useState('');
  const [kategori, setKategori] = useState(KATEGORIER[0]);
  const [omraade, setOmraade] = useState('');
  const [imageFile, setImageFile] = useState<File | null>(null);

  const fileInputRef = useRef<HTMLInputElement>(null);

  if (!isOpen) return null;

  const handleCreate = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!overskrift || !text) {
      alert('Udfyld venligst overskrift og tekst');
      return;
    }

    try {
      setLoading(true);

      const { data: { session } } = await supabase.auth.getSession();
      if (!session) throw new Error('Ingen bruger logget ind');
      const userId = session.user.id;

      let imageUrl = null;
      let imagePath = null;

      if (imageFile) {
        console.log('Starter billedbehandling...');
        // 1. Komprimer
        const compressedBlob = await resizeImage(imageFile);
        
        // 2. Upload
        const fileName = `post_${Date.now()}_${Math.floor(Math.random() * 1000)}.jpg`;
        const filePath = `posts/${userId}/${fileName}`;

        console.log('Uploader til:', BUCKET_NAME, filePath);

        const { error: uploadError } = await supabase.storage
          .from(BUCKET_NAME)
          .upload(filePath, compressedBlob, {
            contentType: 'image/jpeg',
            upsert: true
          });

        if (uploadError) {
          console.error('Upload fejl:', uploadError);
          throw uploadError;
        }

        // 3. Hent public URL
        const { data: urlData } = supabase.storage
          .from(BUCKET_NAME)
          .getPublicUrl(filePath);
        
        imageUrl = urlData.publicUrl;
        imagePath = filePath; // Gem path hvis du får brug for det senere
        console.log('Billede uploaded. URL:', imageUrl);
      } else {
        console.log('Intet billede valgt.');
      }

      // 4. Gem i databasen (Både i images array og image_url)
      const postData = {
        overskrift,
        text,
        kategori,
        omraade,
        image_url: imageUrl,     // Legacy felt
        images: imageUrl ? [imageUrl] : null, // Array felt (som appen bruger)
        user_id: userId,
      };

      console.log('Gemmer post data:', postData);

      const { error: dbError } = await supabase
        .from('posts')
        .insert(postData);

      if (dbError) throw dbError;

      console.log('Opslag oprettet succesfuldt!');

      // Nulstil og luk
      setOverskrift('');
      setText('');
      setOmraade('');
      setImageFile(null);
      
      onPostCreated();
      onClose();

    } catch (error: any) {
      console.error('CRITICAL ERROR:', error);
      alert('Fejl ved oprettelse: ' + (error.message || 'Ukendt fejl'));
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="fixed inset-0 z-[200] flex items-center justify-center p-4 bg-black/60 backdrop-blur-sm">
      <div className="bg-white w-full max-w-lg rounded-2xl shadow-2xl overflow-hidden flex flex-col max-h-[90vh]">
        
        {/* Header */}
        <div className="bg-[#131921] px-6 py-4 flex justify-between items-center">
          <h2 className="text-white text-lg font-bold uppercase tracking-wider">Opret Opslag</h2>
          <button onClick={onClose} className="text-gray-400 hover:text-white transition-colors">
            <i className="fa-solid fa-xmark text-xl"></i>
          </button>
        </div>

        {/* Form - Scrollable content */}
        <div className="p-6 overflow-y-auto">
          <form onSubmit={handleCreate} className="space-y-5">
            
            {/* Kategori Vælger */}
            <div>
              <label className="block text-xs font-bold text-gray-500 uppercase mb-2">Kategori</label>
              <div className="flex flex-wrap gap-2">
                {KATEGORIER.map(cat => (
                  <button
                    key={cat}
                    type="button"
                    onClick={() => setKategori(cat)}
                    className={`px-3 py-1.5 rounded-full text-sm font-medium border transition-all ${
                      kategori === cat 
                        ? 'bg-[#131921] text-white border-[#131921]' 
                        : 'bg-white text-gray-600 border-gray-200 hover:border-gray-400'
                    }`}
                  >
                    {cat}
                  </button>
                ))}
              </div>
            </div>

            {/* Overskrift */}
            <div>
              <label className="block text-xs font-bold text-gray-500 uppercase mb-1">Overskrift</label>
              <input
                type="text"
                className="w-full bg-gray-50 border border-gray-200 rounded-xl px-4 py-3 outline-none focus:ring-2 focus:ring-[#131921] text-[#131921] placeholder-gray-400 font-medium"
                placeholder="F.eks. Boremaskine udlejes..."
                value={overskrift}
                onChange={e => setOverskrift(e.target.value)}
              />
            </div>

            {/* Billede Upload */}
            <div>
              <label className="block text-xs font-bold text-gray-500 uppercase mb-1">Billede</label>
              <div 
                onClick={() => fileInputRef.current?.click()}
                className="border-2 border-dashed border-gray-300 rounded-xl p-6 flex flex-col items-center justify-center text-gray-500 cursor-pointer hover:bg-gray-50 hover:border-gray-400 transition-colors"
              >
                {imageFile ? (
                  <div className="text-center">
                    <p className="text-[#131921] font-bold mb-1">Fil valgt:</p>
                    <p className="text-sm truncate max-w-[200px]">{imageFile.name}</p>
                    <p className="text-xs text-green-600 mt-2">Klik for at ændre</p>
                  </div>
                ) : (
                  <>
                    <i className="fa-solid fa-camera text-3xl mb-2"></i>
                    <p className="text-sm font-medium">Klik for at vælge billede</p>
                  </>
                )}
                <input 
                  type="file" 
                  ref={fileInputRef} 
                  onChange={e => e.target.files?.[0] && setImageFile(e.target.files[0])}
                  className="hidden" 
                  accept="image/*"
                />
              </div>
            </div>

            {/* Tekst */}
            <div>
              <label className="block text-xs font-bold text-gray-500 uppercase mb-1">Beskrivelse</label>
              <textarea
                className="w-full bg-gray-50 border border-gray-200 rounded-xl px-4 py-3 h-32 outline-none focus:ring-2 focus:ring-[#131921] resize-none text-[#131921] placeholder-gray-400 font-medium"
                placeholder="Beskriv tingen eller opgaven..."
                value={text}
                onChange={e => setText(e.target.value)}
              />
            </div>

            {/* Område */}
            <div>
              <label className="block text-xs font-bold text-gray-500 uppercase mb-1">Område / By</label>
              <input
                type="text"
                className="w-full bg-gray-50 border border-gray-200 rounded-xl px-4 py-3 outline-none focus:ring-2 focus:ring-[#131921] text-[#131921] placeholder-gray-400 font-medium"
                placeholder="F.eks. Lyngby"
                value={omraade}
                onChange={e => setOmraade(e.target.value)}
              />
            </div>

            {/* Footer Buttons */}
            <div className="pt-4 flex gap-3">
              <button 
                type="button" 
                onClick={onClose}
                className="flex-1 py-3 rounded-xl font-bold text-gray-600 bg-gray-100 hover:bg-gray-200 transition-colors"
              >
                Annuller
              </button>
              <button 
                type="submit" 
                disabled={loading}
                className="flex-[2] py-3 rounded-xl font-bold text-white bg-[#131921] hover:bg-gray-900 transition-colors disabled:opacity-70 flex items-center justify-center"
              >
                {loading ? <span className="animate-spin mr-2">⏳</span> : null}
                {loading ? 'Opretter...' : 'OPRET OPSLAG'}
              </button>
            </div>

          </form>
        </div>
      </div>
    </div>
  );
}