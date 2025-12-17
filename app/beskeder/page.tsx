'use client';

import { useState, useEffect, useRef, Suspense } from 'react';
import { useRouter, useSearchParams } from 'next/navigation';
import { supabase } from '../../lib/supabaseClient';
import SiteHeader from '../../components/SiteHeader';
import SiteFooter from '../../components/SiteFooter';

// --- TYPER ---
type ThreadItem = {
  id: string; // thread_id
  title: string;
  created_at: string;
  forening_id: string;
  forening?: { navn: string };
};

type ChatMessage = {
  id: string;
  text: string;
  created_at: string;
  user_id: string;
  users?: {
    name?: string;
    avatar_url?: string;
  };
};

function BeskederContent() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const startId = searchParams.get('id'); // Kan være foreningId eller threadId

  const [userId, setUserId] = useState<string | null>(null);
  const [threads, setThreads] = useState<ThreadItem[]>([]);
  const [activeThreadId, setActiveThreadId] = useState<string | null>(null);
  const [messages, setMessages] = useState<ChatMessage[]>([]);
  const [newMessage, setNewMessage] = useState("");
  const [loading, setLoading] = useState(true);
  
  const messagesEndRef = useRef<HTMLDivElement>(null);

  // 1. Hent bruger og alle forenings-tråde
  useEffect(() => {
    const init = async () => {
      const { data: { session } } = await supabase.auth.getSession();
      if (!session) {
        router.push('/login');
        return;
      }
      setUserId(session.user.id);

      // A. Find alle foreninger jeg er medlem af
      const { data: memberships } = await supabase
        .from('foreningsmedlemmer')
        .select('forening_id')
        .eq('user_id', session.user.id)
        .eq('status', 'approved');

      const myForeningIds = memberships?.map((m: any) => m.forening_id) || [];

      if (myForeningIds.length > 0) {
        // B. Hent tråde fra disse foreninger
        const { data: threadData } = await supabase
          .from('forening_threads')
          .select(`
            id, 
            title, 
            created_at, 
            forening_id, 
            foreninger ( navn )
          `)
          .in('forening_id', myForeningIds)
          .order('created_at', { ascending: false });

        if (threadData) {
          const mappedThreads = threadData.map((t: any) => ({
            id: t.id,
            title: t.title,
            created_at: t.created_at,
            forening_id: t.forening_id,
            forening: t.foreninger // { navn: "..." }
          }));
          
          setThreads(mappedThreads);

          // Hvis URL har ?id=... (forening ID), find første tråd i den forening
          if (startId) {
            const match = mappedThreads.find(t => t.forening_id === startId);
            if (match) setActiveThreadId(match.id);
          } else if (mappedThreads.length > 0) {
            // Ellers vælg bare den nyeste tråd
            setActiveThreadId(mappedThreads[0].id);
          }
        }
      }
      setLoading(false);
    };
    init();
  }, [startId, router]);

  // 2. Hent beskeder for valgt tråd
  useEffect(() => {
    if (!activeThreadId) return;
    
    const fetchMessages = async () => {
      // 1. Hent beskeder
      const { data: msgs } = await supabase
        .from('forening_messages')
        .select('id, text, created_at, user_id')
        .eq('thread_id', activeThreadId)
        .order('created_at', { ascending: true });

      if (msgs) {
        // 2. Hent brugernavne (manuel join for stabilitet)
        const userIds = [...new Set(msgs.map(m => m.user_id))];
        const { data: users } = await supabase
          .from('users')
          .select('id, name, avatar_url')
          .in('id', userIds);
        
        const userMap: Record<string, any> = {};
        users?.forEach(u => userMap[u.id] = u);

        const fullMessages = msgs.map(m => ({
          ...m,
          users: userMap[m.user_id] || { name: 'Ukendt' }
        }));

        setMessages(fullMessages as any);
        scrollToBottom();
      }
    };

    fetchMessages();
  }, [activeThreadId]);

  const scrollToBottom = () => {
    setTimeout(() => messagesEndRef.current?.scrollIntoView({ behavior: "smooth" }), 100);
  };

  const handleSend = async () => {
    if (!newMessage.trim() || !activeThreadId || !userId) return;
    const text = newMessage.trim();
    setNewMessage("");

    const { data, error } = await supabase
      .from('forening_messages')
      .insert([{ 
        thread_id: activeThreadId,
        user_id: userId, 
        text: text
      }])
      .select()
      .single();

    if (error) {
      alert("Fejl ved afsendelse: " + error.message);
    } else if (data) {
      // Optimistisk update
      // (Vi burde hente rigtig brugerinfo, men "Mig" virker fint indtil refresh)
      setMessages(prev => [...prev, { 
        ...data, 
        users: { name: 'Mig', avatar_url: null } // Midlertidig
      } as any]);
      scrollToBottom();
    }
  };

  const activeThread = threads.find(t => t.id === activeThreadId);

  if (loading) return <div className="min-h-screen bg-[#869FB9] flex items-center justify-center"><div className="animate-spin rounded-full h-12 w-12 border-b-2 border-[#131921]"></div></div>;

  return (
    <div className="min-h-screen flex flex-col bg-[#869FB9]">
      <SiteHeader />

      <main className="flex-1 w-full max-w-6xl mx-auto p-4 pb-20">
        <div className="bg-white rounded-[30px] shadow-xl overflow-hidden min-h-[70vh] flex flex-col md:flex-row">
          
          {/* SIDEBAR (Liste over tråde) */}
          <div className={`w-full md:w-80 bg-gray-50 border-r border-gray-100 flex-shrink-0 flex flex-col ${activeThreadId ? 'hidden md:flex' : 'flex'}`}>
            <div className="p-5 border-b border-gray-100">
              <h2 className="text-xl font-black text-[#131921]">Indbakke</h2>
              <p className="text-xs text-gray-500 mt-1">Dine forenings-chats</p>
            </div>
            <div className="flex-1 overflow-y-auto p-2 space-y-1">
              {threads.length === 0 && <p className="text-center text-gray-400 mt-10 text-sm">Ingen samtaler fundet.</p>}
              {threads.map(t => (
                <button 
                  key={t.id}
                  onClick={() => setActiveThreadId(t.id)}
                  className={`w-full text-left p-3 rounded-xl flex flex-col gap-1 transition-all ${activeThreadId === t.id ? 'bg-white shadow-sm ring-1 ring-gray-100' : 'hover:bg-gray-100'}`}
                >
                  <span className={`font-bold text-sm ${activeThreadId === t.id ? 'text-[#131921]' : 'text-gray-700'}`}>{t.title}</span>
                  <span className="text-[10px] text-gray-400 uppercase font-bold tracking-wide">{t.forening?.navn || 'Ukendt forening'}</span>
                </button>
              ))}
            </div>
          </div>

          {/* CHAT OMRÅDE */}
          <div className={`flex-1 flex flex-col bg-white ${!activeThreadId ? 'hidden md:flex' : 'flex'}`}>
            {activeThreadId ? (
              <>
                {/* Chat Header */}
                <div className="p-4 border-b border-gray-100 flex items-center gap-3 shadow-sm z-10">
                  <button onClick={() => setActiveThreadId(null)} className="md:hidden w-8 h-8 flex items-center justify-center bg-gray-100 rounded-full text-sm">‹</button>
                  <div className="flex-1">
                    <h3 className="font-bold text-[#131921]">{activeThread?.title || 'Chat'}</h3>
                    <p className="text-xs text-gray-500">{activeThread?.forening?.navn}</p>
                  </div>
                </div>

                {/* Messages List */}
                <div className="flex-1 overflow-y-auto p-4 space-y-4 bg-[#F5F7FA]">
                  {messages.length === 0 ? (
                    <div className="flex flex-col items-center justify-center h-full text-gray-400 opacity-60">
                      <i className="fa-solid fa-comments text-4xl mb-2"></i>
                      <p>Start samtalen her!</p>
                    </div>
                  ) : (
                    messages.map(msg => {
                      const isMe = msg.user_id === userId;
                      return (
                        <div key={msg.id} className={`flex gap-3 ${isMe ? 'flex-row-reverse' : ''}`}>
                          <div className="w-8 h-8 rounded-full bg-gray-200 overflow-hidden flex-shrink-0 mt-1 shadow-sm border border-gray-100">
                            {msg.users?.avatar_url ? <img src={msg.users.avatar_url} className="w-full h-full object-cover" /> : null}
                          </div>
                          <div className={`max-w-[75%] rounded-2xl p-3 shadow-sm ${isMe ? 'bg-[#131921] text-white rounded-tr-none' : 'bg-white text-gray-800 rounded-tl-none'}`}>
                            {!isMe && <p className="text-[10px] font-bold text-gray-400 mb-1">{msg.users?.name || 'Ukendt'}</p>}
                            <p className="text-sm leading-relaxed whitespace-pre-wrap">{msg.text}</p>
                            <p className={`text-[9px] mt-1 text-right ${isMe ? 'text-gray-400' : 'text-gray-300'}`}>
                              {new Date(msg.created_at).toLocaleTimeString([], {hour:'2-digit', minute:'2-digit'})}
                            </p>
                          </div>
                        </div>
                      );
                    })
                  )}
                  <div ref={messagesEndRef} />
                </div>

                {/* Input Area */}
                <div className="p-4 bg-white border-t border-gray-100">
                  <div className="flex gap-2 bg-gray-50 p-1.5 rounded-full border border-gray-200 focus-within:ring-2 focus-within:ring-[#131921] transition-all">
                    <input 
                      value={newMessage}
                      onChange={e => setNewMessage(e.target.value)}
                      onKeyDown={e => e.key === 'Enter' && handleSend()}
                      placeholder="Skriv en besked..."
                      className="flex-1 bg-transparent px-4 py-2 outline-none text-sm text-[#131921] placeholder-gray-400"
                    />
                    <button 
                      onClick={handleSend}
                      disabled={!newMessage.trim()}
                      className="w-10 h-10 bg-[#131921] rounded-full text-white flex items-center justify-center hover:bg-black disabled:opacity-50 transition-colors shadow-md"
                    >
                      <i className="fa-solid fa-paper-plane text-xs"></i>
                    </button>
                  </div>
                </div>
              </>
            ) : (
              <div className="flex-1 flex items-center justify-center text-gray-300 flex-col">
                <i className="fa-regular fa-comments text-6xl mb-4 opacity-50"></i>
                <p>Vælg en samtale til venstre</p>
              </div>
            )}
          </div>

        </div>
      </main>
      <SiteFooter />
    </div>
  );
}

export default function BeskederPage() {
  return (
    <Suspense fallback={<div className="flex justify-center pt-20 text-white">Indlæser...</div>}>
      <BeskederContent />
    </Suspense>
  );
}