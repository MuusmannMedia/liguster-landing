'use client';
import { useParams } from 'next/navigation';
import { useState, useEffect } from 'react';
import { supabase } from '../../../../lib/supabaseClient';
import SiteHeader from '../../../../components/SiteHeader';
import ForeningEvents from '../../../../components/ForeningEvents';

export default function EventsPage() {
  const { id } = useParams();
  const [userId, setUserId] = useState<string|null>(null);
  const [isAdmin, setIsAdmin] = useState(false);
  const [isMember, setIsMember] = useState(false);

  useEffect(() => {
    supabase.auth.getSession().then(({data}) => {
      setUserId(data.session?.user.id || null);
      if(data.session?.user.id && id) {
        supabase.from('foreningsmedlemmer')
          .select('rolle, status')
          .eq('forening_id', id)
          .eq('user_id', data.session.user.id)
          .single()
          .then(({data: m}) => {
             setIsAdmin(m?.rolle === 'admin' || m?.rolle === 'administrator');
             setIsMember(m?.status === 'approved');
          });
      }
    });
  }, [id]);

  return (
    <div className="min-h-screen bg-[#869FB9]">
      <SiteHeader />
      <main className="max-w-4xl mx-auto p-4 bg-white min-h-screen mt-4 rounded-t-3xl">
        <h1 className="text-2xl font-black text-[#131921] mb-6 px-2">Aktiviteter</h1>
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