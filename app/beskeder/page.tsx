'use client';

import { useState, useEffect, useRef, Suspense } from 'react';
import { useRouter, useSearchParams } from 'next/navigation';
import { supabase } from '../../lib/supabaseClient';
import SiteHeader from '../../components/SiteHeader';
import SiteFooter from '../../components/SiteFooter';
import Link from 'next/link';

// --- TYPER ---
type ThreadItem = {
  id: string; 
  title: string;
  created_at: string;
  isDm?: boolean;
  dmUserId?: string; 
  dmUserAvatar?: string | null;
  deleted_at?: string | null;
};

type ChatMessage = {
  id: string;
  text: string;
  created_at: string;
  user_id: string;
  users?: { name?: string; avatar_url?: string | null };
};

function BeskederContent() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const dmUserIdFromUrl = searchParams.get('dmUser');

  const [userId, setUserId] = useState<string | null>(null);
  const [myProfile, setMyProfile] = useState<any>(null);
  const [threads, setThreads] = useState<ThreadItem[]>([]);
  const [activeThreadId, setActiveThreadId] = useState<string | null>(null);
  const [isDirectMessage, setIsDirectMessage] = useState(false);
  const [dmTargetUser, setDmTargetUser] = useState<any>(null);
  const [messages, setMessages] = useState<ChatMessage[]>([]);
  const [newMessage, setNewMessage] = useState("");
  const [loading, setLoading] = useState(true);
  
  const scrollRef = useRef<HTMLDivElement>(null);

  const scrollToBottom = () => {
    setTimeout(() => { if (scrollRef.current) scrollRef.current.scrollTop = scrollRef.current.scrollHeight; }, 100);
  };

  // --- REALTIME: LYT EFTER NYE BESKEDER ---
  useEffect(() => {
    if (!activeThreadId || !userId) return;

    const channel = supabase
      .channel(`chat-${activeThreadId}`)
      .on('postgres_changes', { 
        event: 'INSERT', 
        schema: 'public', 
        table: isDirectMessage ? 'messages' : 'forening_messages',
        filter: `thread_id=eq.${activeThreadId}` 
      }, async (payload) => {
        const msg = payload.new;
        const senderId = isDirectMessage ? msg.sender_id : msg.user_id;
        
        if (senderId !== userId) {
          const { data: u } = await supabase.from('users').select('name, avatar_url').eq('id', senderId).single();
          const newMsg: ChatMessage = {
            id: msg.id,
            text: msg.text,
            created_at: msg.created_at,
            user_id: senderId,
            users: { name: u?.name || 'Bruger', avatar_url: u?.avatar_url }
          };
          setMessages(prev => [...prev, newMsg]);
          scrollToBottom();
        }
      })
      .subscribe();

    return () => { supabase.removeChannel(channel); };
  }, [activeThreadId, userId, isDirectMessage]);

  // --- HENT BESKEDER (MED FILTRERING PÅ DELETED_AT) ---
  useEffect(() => {
    if (!activeThreadId || !userId) return;

    const fetchMessages = async () => {
      // 1. Hent deleted_at for denne bruger og tråd
      const { data: state } = await supabase
        .from('dm_thread_state')
        .select('deleted_at')
        .eq('thread_id', activeThreadId)
        .eq('user_id', userId)
        .maybeSingle();

      const deletedAt = state?.deleted_at;

      // 2. Hent beskeder
      const table = isDirectMessage ? 'messages' : 'forening_messages';
      let query = supabase.from(table).select(`*, users(name, avatar_url)`).eq('thread_id', activeThreadId).order('created_at', { ascending: true });

      // Filtrér beskeder væk der er sendt før "sletning"
      if (isDirectMessage && deletedAt) {
        query = query.gt('created_at', deletedAt);
      }

      const { data } = await query;
      if (data) {
        setMessages(data.map((m: any) => ({
          ...m,
          user_id: isDirectMessage ? m.sender_id : m.user_id
        })));
        scrollToBottom();
      }
    };

    fetchMessages();
  }, [activeThreadId, userId, isDirectMessage]);

  // --- SLET CHAT (SOFT DELETE) ---
  const handleDeleteThread = async () => {
    if (!activeThreadId || !userId || !confirm("Vil du slette denne samtale for dig selv?")) return;

    if (isDirectMessage) {
      const { error } = await supabase
        .from('dm_thread_state')
        .upsert({
          thread_id: activeThreadId,
          user_id: userId,
          deleted_at: new Date().toISOString(),
        }, { onConflict: 'thread_id,user_id' });

      if (!error) {
        setThreads(prev => prev.filter(t => t.id !== activeThreadId));
        setActiveThreadId(null);
        setMessages([]);
      }
    } else {
      // Foreningstråde slettes stadig fysisk for alle
      await supabase.from('forening_threads').delete().eq('id', activeThreadId);
      setThreads(prev => prev.filter(t => t.id !== activeThreadId));
      setActiveThreadId(null);
    }
  };

  const handleSend = async () => {
    if (!newMessage.trim() || !activeThreadId || !userId) return;
    const text = newMessage.trim();
    setNewMessage("");

    const tempMsg: ChatMessage = {
      id: 'temp-' + Date.now(),
      text,
      created_at: new Date().toISOString(),
      user_id: userId,
      users: { name: myProfile?.name, avatar_url: myProfile?.avatar_url }
    };
    setMessages(prev => [...prev, tempMsg]);
    scrollToBottom();

    if (isDirectMessage && dmTargetUser) {
      await supabase.from('messages').insert([{ thread_id: activeThreadId, sender_id: userId, receiver_id: dmTargetUser.id, text }]);
      // Nulstil deleted_at hvis vi sender en ny besked (chatten genåbner)
      await supabase.from('dm_thread_state').upsert({ thread_id: activeThreadId, user_id: userId, deleted_at: null }, { onConflict: 'thread_id,user_id' });
    } else {
      await supabase.from('forening_messages').insert([{ thread_id: activeThreadId, user_id: userId, text }]);
    }
  };

  // --- INITIALISERING ---
  useEffect(() => {
    const init = async () => {
      const { data: { session } } = await supabase.auth.getSession();
      if (!session) return;
      const cId = session.user.id;
      setUserId(cId);

      const { data: prof } = await supabase.from('users').select('*').eq('id', cId).single();
      setMyProfile(prof);

      // Hent tråde og deres deleted_at tilstand
      const { data: dms } = await supabase.from('messages').select('thread_id, sender_id, receiver_id, created_at').or(`sender_id.eq.${cId},receiver_id.eq.${cId}`).order('created_at', { ascending: false });
      const { data: states } = await supabase.from('dm_thread_state').select('*').eq('user_id', cId);
      
      if (dms) {
        const uniq = new Map();
        dms.forEach((m: any) => {
          if (!uniq.has(m.thread_id)) {
            const state = states?.find(s => s.thread_id === m.thread_id);
            // Vis kun hvis der er beskeder efter deleted_at (eller hvis aldrig slettet)
            if (!state?.deleted_at || new Date(m.created_at) > new Date(state.deleted_at)) {
              uniq.set(m.thread_id, m);
            }
          }
        });
        // Byg trådliste (forkortet for overblik)
        const formattedThreads = Array.from(uniq.values()).map(t => ({
          id: t.thread_id,
          title: t.sender_id === cId ? 'Modtager' : 'Afsender', // Her bør du hente navnet rigtigt
          created_at: t.created_at,
          isDm: true
        }));
        setThreads(formattedThreads as any);
      }
      setLoading(false);
    };
    init();
  }, [router]);

  if (loading) return <div>Indlæser...</div>;

  return (
    <div className="min-h-screen flex flex-col bg-[#869FB9]">
      <SiteHeader />
      <main className="flex-1 w-full max-w-6xl mx-auto p-4 pb-20">
        <div className="bg-white rounded-[40px] shadow-2xl overflow-hidden min-h-[75vh] flex flex-col md:flex-row border border-gray-100">
          <div className={`w-full md:w-80 bg-gray-50 border-r border-gray-100 flex-shrink-0 flex flex-col ${activeThreadId ? 'hidden md:flex' : 'flex'}`}>
            <div className="p-8 border-b border-gray-200"><h2 className="text-2xl font-black">Indbakke</h2></div>
            <div className="flex-1 overflow-y-auto p-3 space-y-1.5">
              {threads.map(t => (
                <button key={t.id} onClick={() => { setActiveThreadId(t.id); setIsDirectMessage(!!t.isDm); }} className={`w-full text-left p-4 rounded-2xl ${activeThreadId === t.id ? 'bg-white shadow-md' : 'hover:bg-gray-200'}`}>
                  <span className="font-black block">{t.id.slice(0,8)}</span>
                </button>
              ))}
            </div>
          </div>
          <div className={`flex-1 flex flex-col bg-white ${!activeThreadId ? 'hidden md:flex' : 'flex'}`}>
            {activeThreadId ? (
              <>
                <div className="p-6 border-b flex items-center justify-between">
                  <button onClick={() => setActiveThreadId(null)} className="md:hidden">←</button>
                  <div className="flex gap-2">
                    <button onClick={handleDeleteThread} className="text-red-600 text-xs font-black uppercase tracking-widest px-4 py-2 rounded-xl hover:bg-red-50">Slet chat</button>
                  </div>
                </div>
                <div ref={scrollRef} className="flex-1 overflow-y-auto p-8 space-y-4 bg-[#F9FBFC]">
                  {messages.map(msg => (
                    <div key={msg.id} className={`flex ${msg.user_id === userId ? 'justify-end' : 'justify-start'}`}>
                      <div className={`max-w-[70%] p-4 rounded-2xl shadow-sm ${msg.user_id === userId ? 'bg-[#131921] text-white' : 'bg-white'}`}>
                        {msg.text}
                      </div>
                    </div>
                  ))}
                </div>
                <div className="p-6 bg-white border-t">
                  <div className="flex gap-4">
                    <input value={newMessage} onChange={e => setNewMessage(e.target.value)} onKeyDown={e => e.key === 'Enter' && handleSend()} className="flex-1 bg-gray-50 p-4 rounded-xl outline-none" placeholder="Skriv besked..." />
                    <button onClick={handleSend} className="bg-black text-white px-6 rounded-xl">Send</button>
                  </div>
                </div>
              </>
            ) : <div className="flex-1 flex items-center justify-center text-gray-400 font-black uppercase">Vælg en samtale</div>}
          </div>
        </div>
      </main>
      <SiteFooter />
    </div>
  );
}

export default function BeskederPage() { return ( <Suspense><BeskederContent /></Suspense> ); }