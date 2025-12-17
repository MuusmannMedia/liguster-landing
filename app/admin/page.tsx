'use client';

import { useState, useEffect } from 'react';
import { useRouter } from 'next/navigation';
import { supabase } from '../../lib/supabaseClient';
import SiteHeader from '../../components/SiteHeader';
import SiteFooter from '../../components/SiteFooter';
import Image from 'next/image';

// --- KONFIGURATION ---
const ADMIN_EMAILS = ['kontakt@liguster-app.dk', 'morten.muusmann@gmail.com']; 

// --- HJÆLPERE ---
const getAvatarUrl = (path: string | null | undefined) => {
  if (!path) return null;
  if (path.startsWith('http')) return path; 
  const { data } = supabase.storage.from('avatars').getPublicUrl(path);
  return data.publicUrl;
};

const fmtDate = (dateString: string) => {
  if (!dateString) return '-';
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
  
  // Søgning
  const [searchQuery, setSearchQuery] = useState("");

  // Modal state
  const [inspectUser, setInspectUser] = useState<any | null>(null);
  const [inspectLoading, setInspectLoading] = useState(false);
  const [userContent, setUserContent] = useState<{posts: any[], foreninger: any[]}>({ posts: [], foreninger: [] });

  useEffect(() => {
    const checkAccess = async () => {
      const { data: { session } } = await supabase.auth.getSession();
      
      if (!session) {
        router.push('/login');
        return;
      }

      const email = session.user.email || '';
      if (!ADMIN_EMAILS.includes(email)) {
        alert("Adgang nægtet.");
        router.push('/'); 
        return;
      }

      setIsAuthorized(true);
      fetchUsers();
    };

    checkAccess();
  }, [router]);

  // 1. HENT KUN BRUGERE
  const fetchUsers = async () => {
    setLoading(true);
    const { data, error } = await supabase
      .from('users')
      .select('*')
      .order('created_at', { ascending: false });

    if (error) {
      console.error("Fejl:", error);
      alert("Kunne ikke hente brugere: " + error.message);
    } else {
      setUsers(data || []);
    }
    setLoading(false);
  };

  // 2. HENT INDHOLD VED INSPEKTION
  const handleInspectClick = async (user: any) => {
    setInspectUser(user);
    setInspectLoading(true);
    setUserContent({ posts: [], foreninger: [] }); 

    const { data: posts } = await supabase
      .from('posts')
      .select('id, overskrift, created_at')
      .eq('user_id', user.id); 

    const { data: foreninger } = await supabase
      .from('foreninger')
      .select('id, navn, created_at')
      .eq('oprettet_af', user.id); 

    setUserContent({
      posts: posts || [],
      foreninger: foreninger || []
    });
    setInspectLoading(false);
  };

  // --- SLETTE FUNKTIONER ---
  const handleDeleteUser = async (userId: string) => {
    if(!confirm("ER DU SIKKER? Dette sletter brugeren permanent.")) return;
    
    const { error } = await supabase.from('users').delete().eq('id', userId);
    
    if (error) {
      alert("Fejl ved sletning: " + error.message);
    } else {
      setUsers(prev => prev.filter(u => u.id !== userId));
      setInspectUser(null);
    }
  };

  // --- SØGE LOGIK ---
  const filteredUsers = users.filter(u => {
    const query = searchQuery.toLowerCase();
    const name = (u.name || "").toLowerCase();
    const email = (u.email || "").toLowerCase();
    return name.includes(query) || email.includes(query);
  });

  if (loading) return <div className="min-h-screen bg-[#869FB9] flex items-center justify-center text-white">Indlæser brugere...</div>;
  if (!isAuthorized) return null;

  return (
    <div className="min-h-screen flex flex-col bg-[#869FB9]">
      <SiteHeader />

      <main className="flex-1 w-full max-w-7xl mx-auto p-4 pb-20">
        
        <div className="bg-white rounded-[30px] p-8 shadow-xl mt-6">
          
          {/* HEADER & SØGNING */}
          <div className="flex flex-col md:flex-row justify-between items-center mb-6 gap-4">
            <div className="flex items-center gap-4">
              <h1 className="text-3xl font-black text-[#131921]">Admin Oversigt</h1>
              <div className="bg-blue-100 text-blue-800 px-4 py-2 rounded-full font-bold text-sm">
                {users.length} Total
              </div>
            </div>

            {/* SØGEFELT */}
            <div className="relative w-full md:w-96">
              <i className="fa-solid fa-magnifying-glass absolute left-4 top-1/2 transform -translate-y-1/2 text-gray-400"></i>
              <input 
                type="text" 
                placeholder="Søg efter navn eller email..." 
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                className="w-full pl-10 pr-4 py-3 bg-gray-50 border border-gray-200 rounded-full focus:outline-none focus:ring-2 focus:ring-[#131921] transition-all"
              />
            </div>
          </div>

          <div className="overflow-x-auto">
            <table className="w-full text-left border-collapse">
              <thead>
                <tr className="border-b-2 border-gray-100 text-gray-500 text-sm uppercase">
                  <th className="p-4">Bruger</th>
                  <th className="p-4">Email</th>
                  <th className="p-4">Oprettet</th>
                  <th className="p-4 text-right">Handling</th>
                </tr>
              </thead>
              <tbody className="text-sm text-gray-700">
                {filteredUsers.length === 0 && (
                  <tr>
                    <td colSpan={4} className="p-8 text-center text-gray-400">Ingen brugere fundet.</td>
                  </tr>
                )}
                {filteredUsers.map((u) => {
                  const avatarSrc = getAvatarUrl(u.avatar_url) || `https://ui-avatars.com/api/?name=${u.name || '?'}&background=random`;
                  
                  return (
                    <tr key={u.id} className="border-b border-gray-50 hover:bg-gray-50 transition-colors">
                      <td className="p-4 flex items-center gap-3">
                        <div className="w-10 h-10 rounded-full bg-gray-200 overflow-hidden relative border border-gray-300 flex-shrink-0">
                          <Image src={avatarSrc} alt="" fill className="object-cover" />
                        </div>
                        <div className="flex flex-col">
                          <span className="font-bold text-[#131921]">{u.name || 'Uden navn'}</span>
                          <span className="text-xs text-gray-400 font-mono">{u.id.split('-')[0]}...</span>
                        </div>
                      </td>
                      <td className="p-4 text-gray-600">{u.email}</td>
                      <td className="p-4 whitespace-nowrap">{fmtDate(u.created_at)}</td>
                      <td className="p-4 text-right space-x-2">
                        <button 
                          onClick={() => handleInspectClick(u)}
                          className="bg-[#131921] text-white font-bold text-xs px-4 py-2 rounded-full hover:bg-gray-800 transition-colors shadow-sm"
                        >
                          INSPEKTÉR
                        </button>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        </div>

      </main>
      <SiteFooter />

      {/* --- INSPEKTION MODAL --- */}
      {inspectUser && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/80 backdrop-blur-sm animate-in fade-in duration-200">
          <div className="bg-white w-full max-w-2xl rounded-[24px] shadow-2xl p-6 relative max-h-[90vh] overflow-y-auto">
            <button 
              onClick={() => setInspectUser(null)} 
              className="absolute top-4 right-4 text-gray-400 hover:text-black text-2xl"
            >
              ✕
            </button>

            <div className="flex items-center gap-4 border-b border-gray-100 pb-6 mb-6">
              <div className="w-20 h-20 rounded-full bg-gray-200 overflow-hidden relative border-2 border-white shadow-md">
                <Image 
                  src={getAvatarUrl(inspectUser.avatar_url) || `https://ui-avatars.com/api/?name=${inspectUser.name}&background=random`} 
                  alt="Avatar" 
                  fill 
                  className="object-cover" 
                />
              </div>
              <div>
                <h2 className="text-2xl font-black text-[#131921]">{inspectUser.name || 'Ukendt Navn'}</h2>
                <p className="text-gray-500">{inspectUser.email}</p>
                <p className="text-xs text-gray-400 mt-1">ID: {inspectUser.id}</p>
              </div>
              <div className="ml-auto">
                 <button 
                    onClick={() => handleDeleteUser(inspectUser.id)}
                    className="bg-red-100 text-red-600 px-4 py-2 rounded-lg font-bold text-sm hover:bg-red-200 transition-colors"
                  >
                    Slet Bruger
                  </button>
              </div>
            </div>

            {inspectLoading ? (
              <div className="text-center py-10 text-gray-500 flex flex-col items-center">
                <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-[#131921] mb-2"></div>
                Henter indhold...
              </div>
            ) : (
              <>
                <div className="mb-8">
                  <h3 className="text-lg font-bold text-[#131921] mb-3 flex items-center gap-2">
                    <i className="fa-solid fa-pen-to-square"></i> Brugerens Opslag ({userContent.posts.length})
                  </h3>
                  <div className="bg-gray-50 rounded-xl p-2 space-y-2">
                    {userContent.posts.length === 0 && <p className="text-gray-400 text-sm text-center py-4">Ingen opslag fundet.</p>}
                    {userContent.posts.map((p) => (
                      <div key={p.id} className="bg-white p-3 rounded-lg shadow-sm flex justify-between items-center">
                        <div>
                          <p className="font-bold text-sm text-[#131921]">{p.overskrift || 'Uden overskrift'}</p>
                          <p className="text-xs text-gray-400">{fmtDate(p.created_at)}</p>
                        </div>
                      </div>
                    ))}
                  </div>
                </div>

                <div>
                  <h3 className="text-lg font-bold text-[#131921] mb-3 flex items-center gap-2">
                    <i className="fa-solid fa-users"></i> Brugerens Foreninger ({userContent.foreninger.length})
                  </h3>
                  <div className="bg-gray-50 rounded-xl p-2 space-y-2">
                    {userContent.foreninger.length === 0 && <p className="text-gray-400 text-sm text-center py-4">Ingen foreninger fundet.</p>}
                    {userContent.foreninger.map((f) => (
                      <div key={f.id} className="bg-white p-3 rounded-lg shadow-sm flex justify-between items-center">
                        <div>
                          <p className="font-bold text-sm text-[#131921]">{f.navn || 'Uden navn'}</p>
                          <p className="text-xs text-gray-400">{fmtDate(f.created_at)}</p>
                        </div>
                      </div>
                    ))}
                  </div>
                </div>
              </>
            )}

          </div>
        </div>
      )}

    </div>
  );
}