'use client';
import { useParams, useRouter } from 'next/navigation';
import { useState, useEffect } from 'react';
import { supabase } from '../../../../lib/supabaseClient';
import SiteHeader from '../../../../components/SiteHeader';
import ForeningImages from '../../../../components/ForeningImages';

export default function ImagesPage() {
  const { id } = useParams();
  const router = useRouter();

  const [userId, setUserId] = useState<string|null>(null);
  const [isMember, setIsMember] = useState(false);

  useEffect(() => {
    supabase.auth.getSession().then(({data}) => {
      setUserId(data.session?.user.id || null);
      if(data.session?.user.id && id) {
        supabase.from('foreningsmedlemmer')
          .select('status')
          .eq('forening_id', id)
          .eq('user_id', data.session.user.id)
          .single()
          .then(({data: m}) => setIsMember(m?.status === 'approved'));
      }
    });
  }, [id]);

  const handleClose = () => {
    router.push(`/forening/${id}`);
  };

  return (
    <div className="min-h-screen bg-[#869FB9]">
      <SiteHeader />
      <main className="max-w-4xl mx-auto p-4 bg-white min-h-screen mt-4 rounded-t-3xl">
        
        {/* Header med titel og luk-knap */}
        <div className="flex items-center justify-between mb-6 px-2 pt-2">
          <h1 className="text-2xl font-black text-[#131921]">Billeder</h1>
          
          <button 
            onClick={handleClose}
            // ✅ RETTET: text-[#131921] (Sort) i stedet for grå, så den er tydelig
            className="w-8 h-8 flex items-center justify-center bg-gray-100 hover:bg-gray-200 rounded-full text-[#131921] transition-colors"
          >
            <i className="fa-solid fa-xmark text-lg"></i>
          </button>
        </div>

        <ForeningImages
           foreningId={id as string} 
           userId={userId} 
           isMember={isMember} 
        />
      </main>
    </div>
  );
}