'use client';

import { useState, useEffect } from 'react';
import { useRouter } from 'next/navigation';
import { supabase } from '../../lib/supabaseClient';
import SiteHeader from '../../components/SiteHeader';
import SiteFooter from '../../components/SiteFooter';

// --- TYPER (Matcher din App struktur) ---
type ThreadItem = {
  thread_id: string;
  post_id?: string | null;
  sender_id: string;
  receiver_id: string;
  text?: string | null;
  // Join fra Supabase (posts tabel)
  posts?: { 
    overskrift?: string | null; 
    omraade?: string | null; 
  } | null;
};

export default function BeskederPage() {
  const router = useRouter();
  const [loading, setLoading] = useState(true);
  const [threads, setThreads] = useState<ThreadItem[]>([]);
  const [userId, setUserId] = useState<string | null>(null);

  // Hent data
  const fetchData = async () => {
    setLoading(true);
    const { data: { session } } = await supabase.auth.getSession();
    if (!session) {
      router.push('/login');
      return;
    }
    setUserId(session.user.id);

    // Her skal vi hente tråde. 
    // Dette er et gæt på din tabel-struktur baseret på din app-kode.
    // Du har nok en view eller en function der hedder 'fetch_threads' eller lignende,
    // eller også henter du direkte fra en 'threads' tabel og joiner 'posts'.
    
    /* EKSEMPEL PÅ SUPABASE QUERY: */
    const { data, error } = await supabase
      .from('threads') // Ret til dit rigtige tabelnavn (fx 'chat_threads')
      .select(`
        thread_id:id, 
        post_id, 
        sender_id, 
        receiver_id, 
        text:last_message, 
        posts ( overskrift, omraade )
      `)
      .or(`sender_id.eq.${session.user.id},receiver_id.eq.${session.user.id}`)
      .order('updated_at', { ascending: false });

    if (!error && data) {
      setThreads(data as any);
    }
    setLoading(false);
  };

  useEffect(() => {
    fetchData();
  }, []);

  // Slet tråd
  const deleteThread = async (threadId: string) => {
    if (!confirm("Er du sikker på, at du vil slette denne samtale?")) return;
    
    const { error } = await supabase
      .from('threads') // Ret til dit tabelnavn
      .delete()
      .eq('id', threadId);

    if (!error) {
      setThreads(prev => prev.filter(t => t.thread_id !== threadId));
    } else {
      alert("Kunne ikke slette tråden.");
    }
  };

  // Naviger til chat
  const goToChat = (item: ThreadItem) => {
    const otherUser = item.sender_id === userId ? item.receiver_id : item.sender_id;
    // På web sender vi params via URL query string
    router.push(`/ChatScreen?threadId=${item.thread_id}&postId=${item.post_id || ''}&otherUserId=${otherUser}`);
  };

  return (
    <div className="min-h-screen flex flex-col bg-[#869FB9]">
      <SiteHeader />

      <main className="flex-1 w-full max-w-6xl mx-auto p-4 pb-20">
        <h1 className="text-white text-2xl font-bold mb-6 mt-4 px-2">Mine Beskeder</h1>

        {loading ? (
          <div className="flex justify-center mt-20">
            <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-white"></div>
          </div>
        ) : threads.length === 0 ? (
          <p className="text-white text-center mt-20 text-lg">Du har ingen beskeder endnu.</p>
        ) : (
          /* RESPONSIVT GRID: 1 kolonne mobil, 2 på tablet, 3 på desktop */
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
            {threads.map((item) => (
              <div 
                key={item.thread_id} 
                className="bg-white rounded-[18px] p-5 shadow-md flex flex-col justify-between hover:shadow-lg transition-shadow"
                style={{ minHeight: '220px' }} // Matcher din CARD_H beregning ca.
              >
                {/* Klikbart område for at læse */}
                <div onClick={() => goToChat(item)} className="cursor-pointer flex-1">
                  <h3 className="text-[#131921] font-bold text-xl mb-1 truncate">
                    {item.posts?.overskrift || "UKENDT OPSLAG"}
                  </h3>
                  <p className="text-[#222] font-semibold text-sm mb-2 truncate">
                    {item.posts?.omraade || " "}
                  </p>
                  <p className="text-[#111] text-sm line-clamp-3 leading-relaxed opacity-80">
                    {item.text || "Ingen beskeder endnu..."}
                  </p>
                </div>

                {/* Knapper i bunden */}
                <div className="flex gap-4 mt-5 pt-2">
                  <button 
                    onClick={() => goToChat(item)}
                    className="flex-1 bg-[#131921] text-white py-2 rounded-[10px] font-bold text-sm hover:bg-gray-800 transition-colors"
                  >
                    LÆS BESKED
                  </button>
                  <button 
                    onClick={() => deleteThread(item.thread_id)}
                    className="flex-1 bg-[#e34141] text-white py-2 rounded-[10px] font-bold text-sm hover:bg-red-700 transition-colors"
                  >
                    SLET
                  </button>
                </div>
              </div>
            ))}
          </div>
        )}
      </main>

      <SiteFooter />
    </div>
  );
}