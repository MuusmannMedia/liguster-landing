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
  forening_id?: string;
  forening?: { navn: string };
  isDm?: boolean; // Ny flag for at skelne
};

type ChatMessage = {
  id: string;
  text: string;
  created_at: string;
  user_id: string; // I 'messages' tabellen hedder den sender_id, men vi normaliserer til user_id
  users?: {
    name?: string;
    avatar_url?: string | null;
  };
};

// --- HJÆLPER: Konverter sti til URL ---
const getAvatarUrl = (path: string | null | undefined) => {
  if (!path) return null;
  if (path.startsWith('http')) return path; 
  const { data } = supabase.storage.from('avatars').getPublicUrl(path);
  return data.publicUrl;
};

// --- UUID GENERATOR (Hvis ingen findes) ---
const makeUuid = () => {
  return 'xxxxxxxx-xxxx-4xxx-yxxx-xxxxxxxxxxxx'.replace(/[xy]/g, (c) => {
    const r = (Math.random() * 16) | 0;
    const v = c === 'x' ? r : (r & 0x3) | 0x8;
    return v.toString(16);
  });
};

function BeskederContent() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const startId = searchParams.get('id'); // Forening ID
  const dmUserId = searchParams.get('dmUser'); // Direkte besked modtager ID

  const [userId, setUserId] = useState<string | null>(null);
  const [myProfile, setMyProfile] = useState<{ name: string, avatar_url: string | null } | null>(null);
  
  const [threads, setThreads] = useState<ThreadItem[]>([]);
  const [activeThreadId, setActiveThreadId] = useState<string | null>(null);
  const [isDirectMessage, setIsDirectMessage] = useState(false); // Holder styr på om vi er i DM mode
  const [dmTargetUser, setDmTargetUser] = useState<any>(null); // Brugeren vi skriver med

  const [messages, setMessages] = useState<ChatMessage[]>([]);
  const [newMessage, setNewMessage] = useState("");
  const [loading, setLoading] = useState(true);
  
  const messagesEndRef = useRef<HTMLDivElement>(null);

  // 1. Initialisering
  useEffect(() => {
    const init = async () => {
      const { data: { session } } = await supabase.auth.getSession();
      if (!session) {
        router.push('/login');
        return;
      }
      setUserId(session.user.id);

      // Min profil
      const { data: profile } = await supabase.from('users').select('name, avatar_url').eq('id', session.user.id).single();
      if (profile) {
        setMyProfile({ name: profile.name || 'Mig', avatar_url: getAvatarUrl(profile.avatar_url) });
      }

      // Hent forenings-tråde (sidebar)
      const { data: memberships } = await supabase.from('foreningsmedlemmer').select('forening_id').eq('user_id', session.user.id).eq('status', 'approved');
      const myForeningIds = memberships?.map((m: any) => m.forening_id) || [];

      let initialThreads: ThreadItem[] = [];
      if (myForeningIds.length > 0) {
        const { data: threadData } = await supabase
          .from('forening_threads')
          .select(`id, title, created_at, forening_id, foreninger ( navn )`)
          .in('forening_id', myForeningIds)
          .order('created_at', { ascending: false });

        if (threadData) {
          initialThreads = threadData.map((t: any) => ({
            id: t.id,
            title: t.title,
            created_at: t.created_at,
            forening_id: t.forening_id,
            forening: t.foreninger,
            isDm: false
          }));
        }
      }
      setThreads(initialThreads);

      // --- DM LOGIC ---
      if (dmUserId) {
        // Hent modtager info
        const { data: targetUser } = await supabase.from('users').select('*').eq('id', dmUserId).single();
        if (targetUser) {
          setDmTargetUser(targetUser);
          setIsDirectMessage(true);

          // Find eksisterende tråd ID i 'messages' tabellen
          const { data: existingMsgs } = await supabase
            .from('messages')
            .select('thread_id')
            .or(`and(sender_id.eq.${session.user.id},receiver_id.eq.${dmUserId}),and(sender_id.eq.${dmUserId},receiver_id.eq.${session.user.id})`)
            .limit(1);
          
          if (existingMsgs && existingMsgs.length > 0) {
            setActiveThreadId(existingMsgs[0].thread_id);
          } else {
            // Generer nyt thread ID (som appen gør)
            const newThreadId = makeUuid();
            setActiveThreadId(newThreadId);
          }
        }
      } else if (startId) {
        // Forening link
        const match = initialThreads.find(t => t.forening_id === startId);
        if (match) {
          setActiveThreadId(match.id);
          setIsDirectMessage(false);
        }
      } else if (initialThreads.length > 0) {
        setActiveThreadId(initialThreads[0].id);
        setIsDirectMessage(false);
      }

      setLoading(false);
    };
    init();
  }, [startId, dmUserId, router]);

  // 2. Hent beskeder (Afhængig af om det er DM eller Forening)
  useEffect(() => {
    if (!activeThreadId) return;
    
    const fetchMessages = async () => {
      let data: any[] | null = null;

      if (isDirectMessage) {
        // Hent fra 'messages' tabellen
        const res = await supabase
          .from('messages')
          .select('id, text, created_at, sender_id') // sender_id er brugeren
          .eq('thread_id', activeThreadId)
          .order('created_at', { ascending: true });
        data = res.data?.map(m => ({ ...m, user_id: m.sender_id })) || [];
      } else {
        // Hent fra 'forening_messages'
        const res = await supabase
          .from('forening_messages')
          .select('id, text, created_at, user_id')
          .eq('thread_id', activeThreadId)
          .order('created_at', { ascending: true });
        data = res.data;
      }

      if (data) {
        // Join Users
        const userIds = [...new Set(data.map(m => m.user_id))];
        const { data: users } = await supabase.from('users').select('id, name, avatar_url').in('id', userIds);
        
        const userMap: Record<string, any> = {};
        users?.forEach(u => {
          userMap[u.id] = {
            name: u.name,
            avatar_url: getAvatarUrl(u.avatar_url)
          };
        });

        const fullMessages = data.map(m => ({
          ...m,
          users: userMap[m.user_id] || { name: 'Ukendt', avatar_url: null }
        }));

        setMessages(fullMessages as any);
        scrollToBottom();
      }
    };

    fetchMessages();
    const interval = setInterval(fetchMessages, 4000); 
    return () => clearInterval(interval);

  }, [activeThreadId, isDirectMessage]);

  const scrollToBottom = () => {
    setTimeout(() => messagesEndRef.current?.scrollIntoView({ behavior: "smooth" }), 100);
  };

  const handleSend = async () => {
    if (!newMessage.trim() || !activeThreadId || !userId) return;
    const text = newMessage.trim();
    setNewMessage("");

    // Optimistisk update
    const tempId = "temp-" + Date.now();
    setMessages(prev => [...prev, { 
      id: tempId,
      text: text,
      created_at: new Date().toISOString(),
      user_id: userId,
      users: { name: myProfile?.name || 'Mig', avatar_url: myProfile?.avatar_url }
    }]);
    scrollToBottom();

    let error = null;

    if (isDirectMessage && dmTargetUser) {
      // Indsæt i 'messages'
      const { error: e } = await supabase.from('messages').insert([{
        thread_id: activeThreadId,
        sender_id: userId,
        receiver_id: dmTargetUser.id,
        text: text
      }]);
      error = e;
    } else {
      // Indsæt i 'forening_messages'
      const { error: e } = await supabase.from('forening_messages').insert([{ 
        thread_id: activeThreadId,
        user_id: userId, 
        text: text
      }]);
      error = e;
    }

    if (error) {
      alert("Fejl ved afsendelse: " + error.message);
      setMessages(prev => prev.filter(m => m.id !== tempId));
    }
  };

  // Find aktiv tråd info til headeren
  const activeThreadInfo = isDirectMessage 
    ? { title: dmTargetUser?.name || 'Direkte Besked', subtitle: 'Privat samtale' }
    : threads.find(t => t.id === activeThreadId) 
      ? { title: threads.find(t => t.id === activeThreadId)?.title, subtitle: threads.find(t => t.id === activeThreadId)?.forening?.navn }
      : { title: 'Chat', subtitle: '' };

  if (loading) return <div className="min-h-screen bg-[#869FB9] flex items-center justify-center"><div className="animate-spin rounded-full h-12 w-12 border-b-2 border-[#131921]"></div></div>;

  return (
    <div className="min-h-screen flex flex-col bg-[#869FB9]">
      <SiteHeader />

      <main className="flex-1 w-full max-w-6xl mx-auto p-4 pb-20">
        <div className="bg-white rounded-[30px] shadow-xl overflow-hidden min-h-[70vh] flex flex-col md:flex-row">
          
          {/* SIDEBAR */}
          <div className={`w-full md:w-80 bg-gray-50 border-r border-gray-100 flex-shrink-0 flex flex-col ${activeThreadId ? 'hidden md:flex' : 'flex'}`}>
            <div className="p-5 border-b border-gray-100">
              <h2 className="text-xl font-black text-[#131921]">Indbakke</h2>
              <p className="text-xs text-gray-500 mt-1">Dine forenings-chats</p>
            </div>
            <div className="flex-1 overflow-y-auto p-2 space-y-1">
              
              {/* Vis DM hvis aktiv */}
              {isDirectMessage && dmTargetUser && (
                <button className="w-full text-left p-3 rounded-xl flex flex-col gap-1 bg-white shadow-sm ring-1 ring-[#131921] mb-2">
                  <span className="font-bold text-sm text-[#131921]">{dmTargetUser.name}</span>
                  <span className="text-[10px] text-blue-600 uppercase font-bold tracking-wide">Direkte Besked</span>
                </button>
              )}

              {threads.map(t => (
                <button 
                  key={t.id}
                  onClick={() => { setActiveThreadId(t.id); setIsDirectMessage(false); }}
                  className={`w-full text-left p-3 rounded-xl flex flex-col gap-1 transition-all ${activeThreadId === t.id && !isDirectMessage ? 'bg-white shadow-sm ring-1 ring-gray-100' : 'hover:bg-gray-100'}`}
                >
                  <span className={`font-bold text-sm ${activeThreadId === t.id && !isDirectMessage ? 'text-[#131921]' : 'text-gray-700'}`}>{t.title}</span>
                  <span className="text-[10px] text-gray-400 uppercase font-bold tracking-wide">{t.forening?.navn}</span>
                </button>
              ))}
            </div>
          </div>

          {/* CHAT OMRÅDE */}
          <div className={`flex-1 flex flex-col bg-white ${!activeThreadId ? 'hidden md:flex' : 'flex'}`}>
            {activeThreadId ? (
              <>
                <div className="p-4 border-b border-gray-100 flex items-center gap-3 shadow-sm z-10">
                  <button onClick={() => setActiveThreadId(null)} className="md:hidden w-8 h-8 flex items-center justify-center bg-gray-100 rounded-full text-sm">‹</button>
                  <div className="flex-1">
                    <h3 className="font-bold text-[#131921]">{activeThreadInfo.title}</h3>
                    <p className="text-xs text-gray-500">{activeThreadInfo.subtitle}</p>
                  </div>
                </div>

                <div className="flex-1 overflow-y-auto p-4 space-y-4 bg-[#F5F7FA]">
                  {messages.length === 0 ? (
                    <div className="flex flex-col items-center justify-center h-full text-gray-400 opacity-60">
                      <i className="fa-solid fa-comments text-4xl mb-2"></i>
                      <p>Start samtalen her!</p>
                    </div>
                  ) : (
                    messages.map(msg => {
                      const isMe = msg.user_id === userId;
                      const avatarSrc = msg.users?.avatar_url 
                        ? msg.users.avatar_url 
                        : `https://ui-avatars.com/api/?name=${msg.users?.name || '?'}&background=random`;

                      return (
                        <div key={msg.id} className={`flex gap-3 items-end ${isMe ? 'flex-row-reverse' : 'flex-row'}`}>
                          <div className="w-8 h-8 rounded-full bg-gray-200 overflow-hidden flex-shrink-0 shadow-sm border border-gray-100 relative">
                            <img src={avatarSrc} alt="" className="w-full h-full object-cover" />
                          </div>
                          <div className={`max-w-[75%] rounded-2xl p-3 shadow-sm relative ${isMe ? 'bg-[#131921] text-white rounded-br-none' : 'bg-white text-gray-800 rounded-bl-none'}`}>
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