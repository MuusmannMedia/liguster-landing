'use client';

import { useState, useEffect } from 'react';
import { useRouter } from 'next/navigation';
import { supabase } from '../../lib/supabaseClient';
import SiteHeader from '../../components/SiteHeader';
import SiteFooter from '../../components/SiteFooter';
import Image from 'next/image';

// --- KONFIGURATION ---
// Indsæt den/de emails, der må se denne side
const ADMIN_EMAILS = ['kontakt@liguster-app.dk', 'morten.muusmann@gmail.com']; 

// --- HJÆLPERE ---
const getAvatarUrl = (path: string | null | undefined) => {
  if (!path) return null;
  if (path.startsWith('http')) return path; 
  const { data } = supabase.storage.from('avatars').getPublicUrl(path);
  return data.publicUrl;
};

const fmtDate = (dateString: string) => {
  return new Date(dateString).toLocaleDateString('da-DK', {
    year: 'numeric', month: 'short', day: 'numeric',
    hour: '2-digit', minute: '2-digit'
  });
};

export default function AdminPage() {
  const router = useRouter();
  const [loading, setLoading] = useState(true);
  const [users, setUsers] = useState<any[]>([]);
  const [isAuthorized, setIsAuthorized] = useState(false);

  useEffect(() => {
    const checkAccess = async () => {
      const { data: { session } } = await supabase.auth.getSession();
      
      // 1. Tjek om bruger er logget ind
      if (!session) {
        router.push('/login');
        return;
      }

      // 2. Tjek om emailen er på admin-listen
      const email = session.user.email || '';
      if (!ADMIN_EMAILS.includes(email)) {
        alert("Adgang nægtet: Du har ikke administrator-rettigheder.");
        router.push('/'); // Send dem væk
        return;
      }

      setIsAuthorized(true);

      // 3. Hent alle brugere
      // Bemærk: Dette kræver at RLS policies tillader 'select' på users tabellen for denne bruger
      const { data, error } = await supabase
        .from('users')
        .select('*')
        .order('created_at', { ascending: false });

      if (error) {
        console.error("Fejl ved hentning af brugere:", error);
        alert("Kunne ikke hente brugere. Tjek RLS policies.");
      } else {
        setUsers(data || []);
      }
      
      setLoading(false);
    };

    checkAccess();
  }, [router]);

  const handleDeleteUser = async (userId: string) => {
    if(!confirm("Er du sikker? Dette sletter brugeren fra databasen (men måske ikke fra Auth systemet uden en Edge Function).")) return;
    
    const { error } = await supabase.from('users').delete().eq('id', userId);
    if (error) {
      alert("Fejl: " + error.message);
    } else {
      setUsers(prev => prev.filter(u => u.id !== userId));
    }
  };

  if (loading) return <div className="min-h-screen bg-[#869FB9] flex items-center justify-center text-white">Tjekker rettigheder...</div>;
  if (!isAuthorized) return null;

  return (
    <div className="min-h-screen flex flex-col bg-[#869FB9]">
      <SiteHeader />

      <main className="flex-1 w-full max-w-6xl mx-auto p-4 pb-20">
        
        <div className="bg-white rounded-[30px] p-8 shadow-xl mt-6">
          <div className="flex justify-between items-center mb-6">
            <h1 className="text-3xl font-black text-[#131921]">Admin Oversigt</h1>
            <div className="bg-blue-100 text-blue-800 px-4 py-2 rounded-full font-bold text-sm">
              Antal brugere: {users.length}
            </div>
          </div>

          <div className="overflow-x-auto">
            <table className="w-full text-left border-collapse">
              <thead>
                <tr className="border-b-2 border-gray-100 text-gray-500 text-sm uppercase">
                  <th className="p-4">Bruger</th>
                  <th className="p-4">Email</th>
                  <th className="p-4">Oprettet</th>
                  <th className="p-4">ID</th>
                  <th className="p-4 text-right">Handling</th>
                </tr>
              </thead>
              <tbody className="text-sm text-gray-700">
                {users.map((u) => {
                  const avatarSrc = getAvatarUrl(u.avatar_url) || `https://ui-avatars.com/api/?name=${u.name || '?'}&background=random`;
                  
                  return (
                    <tr key={u.id} className="border-b border-gray-50 hover:bg-gray-50 transition-colors">
                      <td className="p-4 flex items-center gap-3">
                        <div className="w-10 h-10 rounded-full bg-gray-200 overflow-hidden relative border border-gray-300">
                          <Image src={avatarSrc} alt="" fill className="object-cover" />
                        </div>
                        <span className="font-bold text-[#131921]">{u.name || 'Uden navn'}</span>
                      </td>
                      <td className="p-4 text-gray-600">{u.email}</td>
                      <td className="p-4 whitespace-nowrap">{u.created_at ? fmtDate(u.created_at) : '-'}</td>
                      <td className="p-4 font-mono text-xs text-gray-400">{u.id.split('-')[0]}...</td>
                      <td className="p-4 text-right">
                        <button 
                          onClick={() => handleDeleteUser(u.id)}
                          className="text-red-500 hover:text-red-700 font-bold text-xs border border-red-200 px-3 py-1 rounded-full hover:bg-red-50 transition-colors"
                        >
                          SLET
                        </button>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
            
            {users.length === 0 && (
              <div className="p-10 text-center text-gray-400">
                Der blev ikke fundet nogen brugere (eller du har ikke rettigheder til at se dem).
              </div>
            )}
          </div>
        </div>

      </main>
      <SiteFooter />
    </div>
  );
}