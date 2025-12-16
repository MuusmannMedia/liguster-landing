'use client';

import { useState, useRef } from 'react';
import { supabase } from '../lib/supabaseClient';

type Props = {
  isOpen: boolean;
  onClose: () => void;
  onPostCreated: () => void; // Så vi kan opdatere listen bagved
};

const KATEGORIER = ['Gives væk', 'Søges', 'Lån', 'Hjælp', 'Event', 'Andet'];

export default function CreatePostModal({ isOpen, onClose, onPostCreated }: Props) {
  const [loading, setLoading] = useState(false);
  const [overskrift, setOverskrift] = useState('');
  const [text, setText] = useState('');
  const [kategori, setKategori] = useState(KATEGORIER[0]);
  const [omraade, setOmraade] = useState(''); // F.eks. bynavn
  const [imageFile, setImageFile] = useState<File | null>(null);

  // Reference til den skjulte fil-input knap
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

      // 1. Hent brugerens ID
      const { data: { session } } = await supabase.auth.getSession();
      if (!session) throw new Error('Ingen bruger logget ind');
      const userId = session.user.id;

      let imageUrl = null;

      // 2. Upload billede (hvis der er valgt et)
      if (imageFile) {
        const fileExt = imageFile.name.split('.').pop();
        const fileName = `${Date.now()}.${fileExt}`;
        const filePath = `${userId}/${fileName}`;

        const { error: uploadError } = await supabase.storage
          .from('post-images')
          .upload(filePath, imageFile);

        if (uploadError) throw uploadError;

        // Få den offentlige URL
        const { data: urlData } = supabase.storage
          .from('post-images')
          .getPublicUrl(filePath);
        
        imageUrl = urlData.publicUrl;
      }

      // 3. Gem opslaget i databasen
      const { error: dbError } = await supabase
        .from('posts')
        .insert({
          overskrift,
          text,
          kategori,
          omraade,
          image_url: imageUrl,
          user_id: userId,
        });

      if (dbError) throw dbError;

      // 4. Succes! Luk og nulstil
      setOverskrift('');
      setText('');
      setImageFile(null);
      onPostCreated(); // Fortæl "mor" at der er nyt data
      onClose();

    } catch (error: any) {
      alert('Fejl ved oprettelse: ' + error.message);
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
          <form onSubmit={handleCreate} className="space-y-4">
            
            {/* Kategori Vælger */}
            <div>
              <label className="block text-xs font-bold text-gray-500 uppercase mb-1">Kategori</label>
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
                className="w-full bg-gray-50 border border-gray-200 rounded-xl px-4 py-3 outline-none focus:ring-2 focus:ring-[#131921]"
                placeholder="F.eks. Gratis sofa..."
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
                className="w-full bg-gray-50 border border-gray-200 rounded-xl px-4 py-3 h-32 outline-none focus:ring-2 focus:ring-[#131921] resize-none"
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
                className="w-full bg-gray-50 border border-gray-200 rounded-xl px-4 py-3 outline-none focus:ring-2 focus:ring-[#131921]"
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