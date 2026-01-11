'use client';

import { useState, useEffect, useRef } from 'react';
import { useRouter } from 'next/navigation';
import { supabase } from '../../lib/supabaseClient';
import SiteHeader from '../../components/SiteHeader';
import SiteFooter from '../../components/SiteFooter';
import Image from 'next/image';

// --- Billed-komprimering Helper ---
async function resizeImage(file: File, maxWidth = 1200, quality = 0.5): Promise<Blob> {
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
      if (!ctx) { reject(new Error('Canvas fejl')); return; }
      ctx.drawImage(img, 0, 0, elem.width, elem.height);
      ctx.canvas.toBlob((blob) => blob ? resolve(blob) : reject(new Error('Blob fejl')), 'image/jpeg', quality);
    };
    img.onerror = (e) => { URL.revokeObjectURL(objectUrl); reject(e); };
  });
}

export default function MigPage() {
  const router = useRouter();
  const [loading, setLoading] = useState(true);
  const [user, setUser] = useState<any>(null);
  const [profile, setProfile] = useState<any>(null);
  
  // Actions states
  const [isEditingName, setIsEditingName] = useState(false);
  const [newName, setNewName] = useState("");
  const [saving, setSaving] = useState(false);
  const [uploading, setUploading] = useState(false);

  const fileInputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    const init = async () => {
      const { data: { session } } = await supabase.auth.getSession();
      if (!session) {
        router.push('/login');
        return;
      }
      setUser(session.user);
      
      // Hent profil data
      const { data } = await supabase.from('users').select('*').eq('id', session.user.id).single();
      
      if (data) {
        // --- LOGIK FRA APPEN: Håndter avatar URL ---
        let finalAvatarUrl = null;
        if (data.avatar_url) {
          // Hvis det allerede er en fuld http-url
          if (data.avatar_url.startsWith('http')) {
            finalAvatarUrl = `${data.avatar_url}?t=${Date.now()}`;
          } else {
            // Hvis det er en sti (som appen gemmer), hent public URL
            const { data: urlData } = supabase.storage.from('avatars').getPublicUrl(data.avatar_url);
            if (urlData?.publicUrl) {
              finalAvatarUrl = `${urlData.publicUrl}?t=${Date.now()}`;
            }
          }
        }

        setProfile({ ...data, avatar_url: finalAvatarUrl });
        setNewName(data.name || "");
      } else {
        setNewName(session.user.user_metadata?.full_name || "");
      }
      
      setLoading(false);
    };
    init();
  }, [router]);

  const handleLogout = async () => {
    await supabase.auth.signOut();
    router.push('/login');
  };

  const handleSaveName = async () => {
    if (!newName.trim()) return alert("Navn kan ikke være tomt");
    setSaving(true);
    
    // 1. Opdater auth metadata
    await supabase.auth.updateUser({ data: { full_name: newName } });
    
    // 2. Opdater public users tabel
    const { error } = await supabase.from('users').update({ name: newName }).eq('id', user.id);
    
    if (error) {
      alert("Fejl: " + error.message);
    } else {
      setProfile({ ...profile, name: newName });
      setIsEditingName(false);
    }
    setSaving(false);
  };

  const handleUploadAvatar = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file || !user) return;

    try {
      setUploading(true);
      const compressedBlob = await resizeImage(file);
      
      // Vi bruger samme sti-struktur som appen: userId/timestamp.jpg
      const filePath = `${user.id}/${Date.now()}.jpg`;

      // Upload
      const { error: upErr } = await supabase.storage.from('avatars').upload(filePath, compressedBlob, { upsert: false });
      if (upErr) throw upErr;

      // Opdater DB med STIEN (ikke URL'en), så appen også forstår det
      const { error: updErr } = await supabase.from('users').update({ avatar_url: filePath }).eq('id', user.id);
      if (updErr) throw updErr;

      // Generer URL til visning her og nu
      const { data } = supabase.storage.from('avatars').getPublicUrl(filePath);
      const publicUrl = data.publicUrl ? `${data.publicUrl}?t=${Date.now()}` : null;

      setProfile({ ...profile, avatar_url: publicUrl });
    } catch (err: any) {
      alert("Upload fejl: " + err.message);
    } finally {
      setUploading(false);
    }
  };

  const handleDeleteAvatar = async () => {
    if (!confirm("Vil du slette dit profilbillede?")) return;
    const { error } = await supabase.from('users').update({ avatar_url: null }).eq('id', user.id);
    if (!error) setProfile({ ...profile, avatar_url: null });
  };

  // --- RETTET FUNKTION: Sender nu TOKEN med til serveren ---
  const handleDeleteAccount = async () => {
    if (!confirm("ER DU SIKKER? Dette sletter din konto og alt data permanent!")) return;
    
    setSaving(true);

    try {
      // 1. Hent den aktuelle session (dit adgangskort)
      const { data: { session } } = await supabase.auth.getSession();
      
      if (!session) {
        throw new Error("Kunne ikke finde din session. Prøv at logge ud og ind igen.");
      }

      // 2. Kald serveren og vis adgangskortet i 'Authorization' headeren
      const res = await fetch('/api/auth/delete-user', {
        method: 'DELETE',
        headers: {
          'Authorization': `Bearer ${session.access_token}`, // <--- HER ER MAGIEN
        }
      });
      
      if (!res.ok) {
        const data = await res.json();
        throw new Error(data.error || "Kunne ikke slette konto");
      }
      
      // 3. Log ud og send væk
      await supabase.auth.signOut();
      router.push('/login');
    } catch (err: any) {
      alert("Fejl: " + err.message);
      setSaving(false);
    }
  };

  if (loading) return <div className="min-h-screen bg-[#869FB9] flex items-center justify-center"><div className="animate-spin rounded-full h-12 w-12 border-b-2 border-[#131921]"></div></div>;

  const displayName = profile?.name || user?.user_metadata?.full_name || user?.email?.split('@')[0] || "Bruger";
  
  // Fallback hvis ingen avatar
  const avatarUrl = profile?.avatar_url || `https://ui-avatars.com/api/?name=${displayName}&background=random&size=256`;

  return (
    <div className="min-h-screen flex flex-col bg-[#869FB9]">
      <SiteHeader />

      <main className="flex-1 w-full max-w-2xl mx-auto p-4 pb-20 flex items-center justify-center">
        
        <div className="bg-white w-full rounded-[30px] p-8 shadow-xl flex flex-col items-center">
          
          {/* Avatar - NU KVADRATISK (1:1) og FULD BREDDE */}
          <div className="relative w-full aspect-square rounded-[24px] overflow-hidden mb-6 bg-gray-100 shadow-inner">
            <Image 
              src={avatarUrl} 
              alt="Profil" 
              fill 
              className="object-cover"
              unoptimized // Vigtigt da vi henter fra eksterne URL'er (Supabase storage)
            />
            {uploading && (
              <div className="absolute inset-0 bg-black/50 flex items-center justify-center text-white">
                <span className="animate-pulse font-bold">Uploader...</span>
              </div>
            )}
          </div>

          {/* Navn Redigering */}
          {isEditingName ? (
            <div className="w-full max-w-xs mb-6 flex flex-col items-center gap-3">
              <input 
                value={newName} 
                onChange={e => setNewName(e.target.value)} 
                className="w-full text-center text-xl font-bold bg-gray-50 border-b-2 border-[#131921] py-2 outline-none text-[#131921]" // ✅ RETTET HER: text-[#131921]
                autoFocus
              />
              <div className="flex gap-4 text-sm font-bold">
                <button onClick={handleSaveName} disabled={saving} className="text-green-600 hover:underline">
                  {saving ? "GEMMER..." : "GEM"}
                </button>
                <button onClick={() => { setIsEditingName(false); setNewName(displayName); }} className="text-red-500 hover:underline">
                  ANNULLER
                </button>
              </div>
            </div>
          ) : (
            <>
              <h2 className="text-2xl md:text-3xl font-black text-[#131921] mb-2 text-center">{displayName}</h2>
              <button 
                onClick={() => setIsEditingName(true)}
                className="bg-[#131921] text-white px-5 py-2 rounded-full text-xs font-bold mb-8 hover:bg-gray-900 transition-colors"
              >
                RET NAVN
              </button>
            </>
          )}

          {/* Handlinger */}
          <div className="w-full grid grid-cols-2 gap-4 mb-8">
            <button 
              onClick={() => fileInputRef.current?.click()}
              disabled={uploading}
              className="py-3 bg-[#131921] text-white rounded-full font-bold text-xs hover:bg-gray-900 transition-colors"
            >
              RET BILLEDE
            </button>
            <input type="file" ref={fileInputRef} onChange={handleUploadAvatar} accept="image/*" className="hidden" />

            <button 
              onClick={handleDeleteAvatar}
              className="py-3 bg-[#131921] text-white rounded-full font-bold text-xs hover:bg-gray-900 transition-colors"
            >
              SLET BILLEDE
            </button>

            <button 
              onClick={handleLogout}
              className="py-3 bg-[#131921] text-white rounded-full font-bold text-xs hover:bg-gray-900 transition-colors"
            >
              LOG UD
            </button>

            {/* --- KNAP: type="button" og e.preventDefault() --- */}
            <button 
              type="button" 
              onClick={(e) => {
                e.preventDefault();
                handleDeleteAccount();
              }}
              disabled={saving}
              className="py-3 bg-[#131921] text-white rounded-full font-bold text-xs hover:bg-gray-900 transition-colors"
            >
              {saving ? "SLETTER..." : "SLET KONTO"}
            </button>
          </div>

          {/* Info */}
          <div className="text-center text-gray-500 text-sm">
            <p>{user.email}</p>
            <p className="opacity-60 text-xs mt-1">Du er logget ind</p>
          </div>

        </div>

      </main>
      <SiteFooter />
    </div>
  );
}