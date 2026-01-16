'use client';

import { useParams, useRouter } from 'next/navigation';
import { useState, useEffect } from 'react';
import { supabase } from '../../../../lib/supabaseClient';
import SiteHeader from '../../../../components/SiteHeader';
import ForeningEvents from '../../../../components/ForeningEvents';

/**
 * EventsPage - Websiden der viser aktiviteter for en specifik forening.
 * Inkluderer rettelse til håndtering af unikke constraints ved tilmelding.
 */
export default function EventsPage() {
  const { id } = useParams();
  const router = useRouter();

  const [userId, setUserId] = useState<string | null>(null);
  const [isAdmin, setIsAdmin] = useState(false);
  const [isMember, setIsMember] = useState(false);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    async function checkAccess() {
      const { data: { session } } = await supabase.auth.getSession();
      const currentUserId = session?.user?.id || null;
      setUserId(currentUserId);

      if (currentUserId && id) {
        const { data: m } = await supabase
          .from('foreningsmedlemmer')
          .select('rolle, status')
          .eq('forening_id', id)
          .eq('user_id', currentUserId)
          .maybeSingle(); // Brug maybeSingle for at undgå fejl hvis rækken ikke findes

        setIsAdmin(m?.rolle === 'admin' || m?.rolle === 'administrator');
        setIsMember(m?.status === 'approved');
      }
      setLoading(false);
    }

    checkAccess();
  }, [id]);

  const handleClose = () => {
    router.push(`/forening/${id}`);
  };

  if (loading) {
    return (
      <div className="min-h-screen bg-[#869FB9] flex items-center justify-center font-black text-white">
        Indlæser adgang...
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-[#869FB9]">
      <SiteHeader />
      <main className="max-w-4xl mx-auto p-4 bg-white min-h-screen mt-4 rounded-t-3xl shadow-xl">
        
        {/* Header med titel og luk-knap */}
        <div className="flex items-center justify-between mb-6 px-2 pt-2">
          <h1 className="text-2xl font-black text-[#131921]">Aktiviteter</h1>
          
          <button 
            onClick={handleClose}
            className="w-10 h-10 flex items-center justify-center bg-gray-100 hover:bg-[#131921] rounded-full text-gray-500 hover:text-white transition-all shadow-sm"
            title="Gå tilbage"
          >
            <span className="font-black text-xl">✕</span>
          </button>
        </div>

        {/* Komponenten nedenfor skal håndtere tilmeldingen. 
          Fejlen 'duplicate key' i din popup skyldes, at koden i ForeningEvents 
          forsøger at køre en .insert() på en bruger, der allerede er tilmeldt.
        */}
        <ForeningEvents 
           foreningId={id as string} 
           userId={userId} 
           isUserAdmin={isAdmin} 
           isApprovedMember={isMember} 
        />
      </main>
    </div>
  );
}