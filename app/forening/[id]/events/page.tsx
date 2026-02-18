'use client';

import { useParams, useRouter } from 'next/navigation';
import { useEffect, useState } from 'react';
import { supabase } from '../../../../lib/supabaseClient';
import SiteHeader from '../../../../components/SiteHeader';
import ForeningEvents from '../../../../components/ForeningEvents';

export default function EventsPage() {
  const params = useParams();
  const router = useRouter();
  const id = params?.id as string;

  const [userId, setUserId] = useState<string | null>(null);
  const [isAdmin, setIsAdmin] = useState(false);
  const [isMember, setIsMember] = useState(false);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    let isMounted = true;

    async function checkAccess() {
      setLoading(true);

      const { data: { session } } = await supabase.auth.getSession();
      const currentUserId = session?.user?.id || null;

      if (!isMounted) return;
      setUserId(currentUserId);

      if (currentUserId && id) {
        const { data: m } = await supabase
          .from('foreningsmedlemmer')
          .select('rolle, status')
          .eq('forening_id', id)
          .eq('user_id', currentUserId)
          .maybeSingle();

        const role = (m?.rolle || '').toLowerCase();
        setIsAdmin(role === 'admin' || role === 'administrator');
        setIsMember(m?.status === 'approved');
      } else {
        setIsAdmin(false);
        setIsMember(false);
      }

      if (!isMounted) return;
      setLoading(false);
    }

    checkAccess();
    return () => {
      isMounted = false;
    };
  }, [id]);

  if (loading) {
    return (
      <div className="min-h-screen bg-[#869FB9] flex items-center justify-center font-black text-white">
        Indlæser...
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-[#869FB9]">
      <SiteHeader />

      <main className="content-shell py-4 bg-white min-h-screen mt-4 rounded-t-3xl shadow-xl">
        <div className="flex items-center justify-between mb-6 px-2 pt-2">
          <h1 className="text-2xl font-black text-[#131921]">Aktiviteter</h1>

          <button
            onClick={() => router.push(`/forening/${id}`)}
            className="w-10 h-10 flex items-center justify-center bg-gray-100 hover:bg-[#131921] rounded-full text-gray-500 hover:text-white transition-all shadow-sm"
            aria-label="Luk"
          >
            <span className="font-black text-xl">✕</span>
          </button>
        </div>

        <ForeningEvents
          foreningId={id}
          userId={userId}
          isUserAdmin={isAdmin}
          isApprovedMember={isMember}
        />
      </main>
    </div>
  );
}
