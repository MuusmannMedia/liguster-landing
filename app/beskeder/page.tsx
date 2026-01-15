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
  forening_id?: string;
  forening?: { navn: string };
  isDm?: boolean;
  dmUserId?: string; 
  dmUserAvatar?: string | null;
  unreadCount?: number; 
};

type ChatMessage = {
  id: string;
  text: string;
  created_at: string;
  user_id: string;
  users?: {
    name?: string;
    avatar_url?: string | null;
  };
};

// --- HJÆLPERE ---
const getAvatarUrl = (path: string | null | undefined) => {
  if (!path) return null;
  if (path.startsWith('http')) return path; 
  const { data } = supabase.storage.from('avatars').getPublicUrl(path);
  return data.publicUrl;
};

const makeUuid = () => {
  return 'xxxxxxxx-xxxx-4xxx-yxxx-xxxxxxxxxxxx'.replace(/[xy]/g, (c) => {
    const r = (Math.random() * 16) | 0;
    const v = c === 'x' ? r : (r & 0x3) | 0x8;
    return v.toString(16);
  });
};

const formatTextWithLinks = (text: string) => {
  const urlRegex = /(\b(https?|ftp|file):\/\/[-A-Z0-9+&@#\/%?=~_|!:,.;]*[-A-Z0-9+&@#\/%=~_|])|(\/forening\/[\w-]+)/ig;
  const cleanParts = text.split(/(\s+)/).map((word, i) => {
    if (word.startsWith('/forening/')) {
        return <Link key={i} href={word} className="text-blue-600 underline hover:text-blue-800 break-all">{word}</Link>;
    }
    if (word.match(/^https?:\/\//)) {
        return <a key={i} href={word} target="_blank" rel="noopener noreferrer" className="text-blue-600 underline hover:text-blue-800 break-all">{word}</a>;
    }
    return word;
  });
  return cleanParts;
};

function BeskederContent() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const startId = searchParams.get('id');
  const dmUserIdFromUrl = searchParams.get('dmUser');

  const [userId, setUserId] = useState<string | null>(null);
  const [isAdmin, setIsAdmin] = useState(false);
  const [myProfile, setMyProfile] = useState<{ name: string, avatar_url: string | null } | null>(null);
  const [threads, setThreads] = useState<ThreadItem[]>([]);
  const [activeThreadId, setActiveThreadId] = useState<string | null>(null);
  const [isDirectMessage, setIsDirectMessage] = useState(false);
  const [dmTargetUser, setDmTargetUser] = useState<any>(null);
  const [messages, setMessages] = useState<ChatMessage[]>([]);
  const [newMessage, setNewMessage] = useState("");
  const [loading, setLoading] = useState(true);
  const [submittingReport, setSubmittingReport] = useState(false);
  
  const scrollRef = useRef<HTMLDivElement>(null);

  // --- VI BRUGER EN FUNCTION DEKLARATION HER (HOISTING) FOR AT UNDGÅ BUILD FEJL ---
  async function handleSelectThread(threadId: string, isDm: boolean, currentUserId: string, targetUserId?: string) {
    setActiveThreadId(threadId);
    setIsDirectMessage(isDm);
    if (isDm && targetUserId) {
       const { data: tUser } = await supabase.from('users').select('*').eq('id', targetUserId).single();
       if(tUser) setDmTargetUser(tUser);
    } else {
       setDmTargetUser(null);
    }
    setThreads(prev => prev.map(t => t.id === threadId ? { ...t, unreadCount: 0 } : t));
    if (isDm) {
      await supabase.from('messages').update({ is_read: true }).eq('thread_id', threadId).eq('receiver_id', currentUserId).eq('is_read', false);
    }
  }

  useEffect(() => {
    const init = async () => {
      const { data: { session } } = await supabase.auth.getSession();
      if (!session) {
        router.push('/login');
        return;
      }
      const currentUserId = session.user.id;
      setUserId(currentUserId);

      const { data: profile } = await supabase.from('users').select('name, avatar_url, is_admin').eq('id', currentUserId).single();
      if (profile) {
        setMyProfile({ name: profile.name || 'Mig', avatar_url: getAvatarUrl(profile.avatar_url) });
        setIsAdmin(!!profile.is_admin);
      }

      // Hent alle tråde (Din fulde oprindelige logik)
      const { data: memberships } = await supabase.from('foreningsmedlemmer').select('forening_id').eq('user_id', currentUserId).eq('status', 'approved');
      const myForeningIds = memberships?.map((m: any) => m.forening_id) || [];

      let initialThreads: ThreadItem[] = [];

      // 1. Forenings tråde
      if (myForeningIds.length > 0) {
        const { data: tData } = await supabase.from('forening_threads').select(`id, title, created_at, forening_id, foreninger(navn)`).in('forening_id', myForeningIds);
        if (tData) {
          initialThreads = tData.map((t: any) => ({
            id: t.id, title: t.title, created_at: t.created_at, forening_id: t.forening_id, forening: t.foreninger, isDm: false, unreadCount: 0
          }));
        }
      }

      // 2. DM tråde
      const { data: dmData } = await supabase.from('messages').select('thread_id, sender_id, receiver_id, created_at').or(`sender_id.eq.${currentUserId},receiver_id.eq.${currentUserId}`).order('created_at', { ascending: false });
      if (dmData && dmData.length > 0) {
        const unique = new Map();
        const otherIds = new Set<string>();
        dmData.forEach((m: any) => {
          if (!unique.has(m.thread_id)) {
            const otherId = m.sender_id === currentUserId ? m.receiver_id : m.sender_id;
            unique.set(m.thread_id, { ...m, otherId });
            otherIds.add(otherId);
          }
        });
        const { data: users } = await supabase.from('users').select('id, name, avatar_url').in('id', Array.from(otherIds));
        const uMap = new Map();
        users?.forEach(u => uMap.set(u.id, u));

        const dmThreads: ThreadItem[] = Array.from(unique.values()).map((t: any) => {
          const u = uMap.get(t.otherId);
          return { id: t.thread_id, title: u?.name || 'Bruger', created_at: t.created_at, isDm: true, dmUserId: t.otherId, dmUserAvatar: getAvatarUrl(u?.avatar_url), unreadCount: 0 };
        });
        initialThreads = [...dmThreads, ...initialThreads];
      }

      initialThreads.sort((a, b) => new Date(b.created_at).getTime() - new Date(a.created_at).getTime());
      setThreads(initialThreads);

      // URL LOGIK (Admin / Link tjek)
      if (dmUserIdFromUrl) {
        const { data: target } = await supabase.from('users').select('*').eq('id', dmUserIdFromUrl).single();
        if (target) {
          setDmTargetUser(target);
          setIsDirectMessage(true);
          const { data: existing } = await supabase.from('messages').select('thread_id').or(`and(sender_id.eq.${currentUserId},receiver_id.eq.${dmUserIdFromUrl}),and(sender_id.eq.${dmUserIdFromUrl},receiver_id.eq.${currentUserId})`).limit(1);
          if (existing && existing.length > 0) {
            handleSelectThread(existing[0].thread_id, true, currentUserId, dmUserIdFromUrl);
          } else if (profile?.is_admin) {
             const { data: adm } = await supabase.from('messages').select('thread_id').or(`sender_id.eq.${dmUserIdFromUrl},receiver_id.eq.${dmUserIdFromUrl}`).limit(1);
             if (adm && adm.length > 0) handleSelectThread(adm[0].thread_id, true, currentUserId, dmUserIdFromUrl);
          }
        }
      }

      setLoading(false);
    };
    init();
  }, [dmUserIdFromUrl, router]);

  // Hent Beskeder
  useEffect(() => {
    if (!activeThreadId) return;
    const fetchMsgs = async () => {
      const table = isDirectMessage ? 'messages' : 'forening_messages';
      const res = await supabase.from(table).select(isDirectMessage ? 'id, text, created_at, sender_id' : 'id, text, created_at, user_id').eq('thread_id', activeThreadId).order('created_at', { ascending: true });
      const data = isDirectMessage ? (res.data?.map((m: any) => ({ ...m, user_id: m.sender_id })) ?? null) : res.data;
      if (data) {
        const uIds = [...new Set(data.map((m: any) => m.user_id))];
        const { data: us } = await supabase.from('users').select('id, name, avatar_url').in('id', uIds);
        const uMap: Record<string, any> = {};
        us?.forEach(u => uMap[u.id] = { name: u.name, avatar_url: getAvatarUrl(u.avatar_url) });
        setMessages(data.map((m: any) => ({ ...m, users: uMap[m.user_id] || { name: '?', avatar_url: null } })) as any);
        scrollToBottom();
      }
    };
    fetchMsgs();
  }, [activeThreadId, isDirectMessage]);

  const scrollToBottom = () => { setTimeout(() => { if (scrollRef.current) scrollRef.current.scrollTo({ top: scrollRef.current.scrollHeight, behavior: 'smooth' }); }, 100); };

  if (loading) return <div className="min-h-screen bg-[#869FB9] flex items-center justify-center"><div className="animate-spin rounded-full h-12 w-12 border-b-2 border-[#131921]"></div></div>;

  return (
    <div className="min-h-screen flex flex-col bg-[#869FB9]">
      <SiteHeader />
      <main className="flex-1 w-full max-w-6xl mx-auto p-4 pb-20">
        <div className="bg-white rounded-[40px] shadow-2xl overflow-hidden min-h-[75vh] flex flex-col md:flex-row border border-gray-100">
          
          <div className={`w-full md:w-80 bg-gray-50 border-r border-gray-100 flex flex-col ${activeThreadId ? 'hidden md:flex' : 'flex'}`}>
            <div className="p-8 border-b border-gray-200">
                <h2 className="text-2xl font-black text-[#131921]">Indbakke</h2>
                {isAdmin && <span className="text-[9px] bg-black text-white px-2 py-0.5 rounded-full font-black uppercase tracking-tighter">Admin</span>}
            </div>
            <div className="flex-1 overflow-y-auto p-3 space-y-1.5">
              {threads.map(t => (
                <button key={t.id} onClick={() => handleSelectThread(t.id, !!t.isDm, userId!, t.dmUserId)} className={`w-full text-left p-4 rounded-2xl flex flex-col gap-1 transition-all ${activeThreadId === t.id ? 'bg-white shadow-md ring-1 ring-gray-200 scale-[1.02]' : 'hover:bg-gray-200'}`}>
                  <span className="font-black text-[15px] text-[#131921] truncate">{t.title}</span>
                  <span className="text-[10px] text-gray-600 font-black uppercase tracking-widest">{t.isDm ? 'Privat' : t.forening?.navn}</span>
                </button>
              ))}
            </div>
          </div>

          <div className={`flex-1 flex flex-col bg-white ${!activeThreadId ? 'hidden md:flex' : 'flex'}`}>
            {activeThreadId ? (
              <>
                <div className="p-6 border-b border-gray-100 flex items-center justify-between shadow-sm bg-white">
                    <div className="flex items-center gap-4">
                        <button onClick={() => setActiveThreadId(null)} className="md:hidden w-11 h-11 flex items-center justify-center bg-gray-50 rounded-2xl border"><i className="fa-solid fa-arrow-left"></i></button>
                        <div><h3 className="font-black text-[#131921] text-xl">{activeThreadInfo?.title || 'Chat'}</h3><p className="text-[11px] text-gray-500 font-black uppercase tracking-widest">{activeThreadInfo?.subtitle || ''}</p></div>
                    </div>
                </div>
                <div ref={scrollRef} className="flex-1 overflow-y-auto p-8 space-y-8 bg-[#F9FBFC]">
                  {messages.map(msg => (
                    <div key={msg.id} className={`flex gap-4 items-end ${msg.user_id === userId ? 'flex-row-reverse' : 'flex-row'}`}>
                        <div className="w-10 h-10 rounded-full overflow-hidden border-2 border-white shadow-md flex-shrink-0 bg-gray-200">
                            <img src={msg.users?.avatar_url || `https://ui-avatars.com/api/?name=${msg.users?.name || '?'}`} alt="" className="w-full h-full object-cover" />
                        </div>
                        <div className={`max-w-[70%] rounded-2xl p-4 shadow-sm ${msg.user_id === userId ? 'bg-[#131921] text-white rounded-br-none' : 'bg-white text-gray-900 rounded-bl-none border border-gray-100'}`}>
                            <p className="text-[15px] leading-relaxed font-semibold whitespace-pre-wrap">{formatTextWithLinks(msg.text)}</p>
                        </div>
                    </div>
                  ))}
                </div>
              </>
            ) : (
              <div className="flex-1 flex items-center justify-center text-gray-300 flex-col py-20"><i className="fa-regular fa-comments text-8xl mb-8 opacity-10"></i><p className="text-gray-400 font-black uppercase tracking-widest text-xs">Vælg en samtale</p></div>
            )}
          </div>
        </div>
      </main>
      <SiteFooter />
    </div>
  );
}

export default function BeskederPage() {
  return ( <Suspense fallback={<div>Indlæser...</div>}><BeskederContent /></Suspense> );
}