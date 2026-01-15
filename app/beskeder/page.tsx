'use client';

import { useState, useEffect, useRef, Suspense } from 'react';
import { useRouter, useSearchParams } from 'next/navigation';
import { supabase } from '../../lib/supabaseClient';
import SiteHeader from '../../components/SiteHeader';
import SiteFooter from '../../components/SiteFooter';
import Link from 'next/link';

// --- TYPER ---
type ThreadItem = {
  id: string; // thread_id
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
        return <Link key={i} href={word} className="text-blue-300 underline hover:text-blue-100 break-all">{word}</Link>;
    }
    if (word.match(/^https?:\/\//)) {
        return <a key={i} href={word} target="_blank" rel="noopener noreferrer" className="text-blue-300 underline hover:text-blue-100 break-all">{word}</a>;
    }
    return word;
  });
  return cleanParts;
};

function BeskederContent() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const startId = searchParams.get('id');
  const dmUserId = searchParams.get('dmUser');

  const [userId, setUserId] = useState<string | null>(null);
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

  useEffect(() => {
    const init = async () => {
      const { data: { session } } = await supabase.auth.getSession();
      if (!session) {
        router.push('/login');
        return;
      }
      setUserId(session.user.id);

      const { data: profile } = await supabase.from('users').select('name, avatar_url').eq('id', session.user.id).single();
      if (profile) {
        setMyProfile({ name: profile.name || 'Mig', avatar_url: getAvatarUrl(profile.avatar_url) });
      }

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
            isDm: false,
            unreadCount: 0 
          }));
        }
      }

      const { data: dmData } = await supabase
        .from('messages')
        .select('thread_id, sender_id, receiver_id, created_at')
        .or(`sender_id.eq.${session.user.id},receiver_id.eq.${session.user.id}`)
        .order('created_at', { ascending: false });

      const { data: unreadData } = await supabase
        .from('messages')
        .select('thread_id')
        .eq('receiver_id', session.user.id)
        .eq('is_read', false);

      const unreadMap = new Map<string, number>();
      unreadData?.forEach((row: any) => {
        unreadMap.set(row.thread_id, (unreadMap.get(row.thread_id) || 0) + 1);
      });

      if (dmData && dmData.length > 0) {
        const uniqueThreads = new Map();
        const otherUserIds = new Set<string>();
        dmData.forEach((msg: any) => {
            if (!uniqueThreads.has(msg.thread_id)) {
                const otherId = msg.sender_id === session.user.id ? msg.receiver_id : msg.sender_id;
                uniqueThreads.set(msg.thread_id, { ...msg, otherId });
                otherUserIds.add(otherId);
            }
        });

        if (otherUserIds.size > 0) {
            const { data: users } = await supabase
                .from('users')
                .select('id, name, avatar_url')
                .in('id', Array.from(otherUserIds));

            const userMap = new Map();
            users?.forEach((u: any) => userMap.set(u.id, u));

            const dmThreads: ThreadItem[] = Array.from(uniqueThreads.values()).map((t: any) => {
                const otherUser = userMap.get(t.otherId);
                return {
                    id: t.thread_id,
                    title: otherUser?.name || 'Ukendt Bruger',
                    created_at: t.created_at,
                    isDm: true,
                    dmUserId: t.otherId,
                    dmUserAvatar: getAvatarUrl(otherUser?.avatar_url),
                    unreadCount: unreadMap.get(t.thread_id) || 0 
                };
            });
             initialThreads = [...dmThreads, ...initialThreads];
        }
      }
      
      initialThreads.sort((a, b) => new Date(b.created_at).getTime() - new Date(a.created_at).getTime());
      setThreads(initialThreads);

      if (dmUserId) {
        const { data: targetUser } = await supabase.from('users').select('*').eq('id', dmUserId).single();
        if (targetUser) {
          setDmTargetUser(targetUser);
          setIsDirectMessage(true);
          const { data: existingMsgs } = await supabase
            .from('messages')
            .select('thread_id')
            .or(`and(sender_id.eq.${session.user.id},receiver_id.eq.${dmUserId}),and(sender_id.eq.${dmUserId},receiver_id.eq.${session.user.id})`)
            .limit(1);
          if (existingMsgs && existingMsgs.length > 0) {
            handleSelectThread(existingMsgs[0].thread_id, true, session.user.id, dmUserId);
          } else {
            setActiveThreadId(makeUuid());
          }
        }
      } else if (startId) {
        const match = initialThreads.find(t => t.forening_id === startId);
        if (match) handleSelectThread(match.id, false, session.user.id);
      } else if (initialThreads.length > 0 && window.innerWidth >= 768) {
        const first = initialThreads[0];
        handleSelectThread(first.id, !!first.isDm, session.user.id, first.dmUserId);
      }
      setLoading(false);
    };
    init();
  }, [startId, dmUserId, router]);

  const handleSelectThread = async (threadId: string, isDm: boolean, currentUserId: string, targetUserId?: string) => {
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
  };

  useEffect(() => {
    if (!activeThreadId) return;
    const fetchMessages = async () => {
      const table = isDirectMessage ? 'messages' : 'forening_messages';
      const res = await supabase.from(table).select(isDirectMessage ? 'id, text, created_at, sender_id' : 'id, text, created_at, user_id').eq('thread_id', activeThreadId).order('created_at', { ascending: true });
      const data = isDirectMessage ? (res.data?.map((m: any) => ({ ...m, user_id: m.sender_id })) ?? null) : res.data;

      if (data) {
        const userIds = [...new Set(data.map((m: any) => m.user_id))];
        const { data: users } = await supabase.from('users').select('id, name, avatar_url').in('id', userIds);
        const userMap: Record<string, any> = {};
        users?.forEach(u => userMap[u.id] = { name: u.name, avatar_url: getAvatarUrl(u.avatar_url) });
        const fullMessages = data.map((m: any) => ({ ...m, users: userMap[m.user_id] || { name: 'Ukendt', avatar_url: null } }));
        setMessages(fullMessages as any);
        scrollToBottom();
      }
    };
    fetchMessages();

    const table = isDirectMessage ? 'messages' : 'forening_messages';
    const channel = supabase.channel(`chat:${activeThreadId}`).on('postgres_changes', { event: 'INSERT', schema: 'public', table: table, filter: `thread_id=eq.${activeThreadId}` },
        async (payload) => {
          const newMsg = payload.new as any;
          if (isDirectMessage && newMsg.sender_id !== userId) await supabase.from('messages').update({ is_read: true }).eq('id', newMsg.id);
          setMessages((prev) => {
            if (prev.some(m => m.id === newMsg.id)) return prev;
            const senderId = isDirectMessage ? newMsg.sender_id : newMsg.user_id;
            return [...prev, { id: newMsg.id, text: newMsg.text, created_at: newMsg.created_at, user_id: senderId, users: { name: '...', avatar_url: null } }].sort((a, b) => new Date(a.created_at).getTime() - new Date(b.created_at).getTime());
          });
          scrollToBottom();
        }
      ).subscribe();
    return () => { supabase.removeChannel(channel); };
  }, [activeThreadId, isDirectMessage, userId]);

  const scrollToBottom = () => {
    setTimeout(() => { if (scrollRef.current) scrollRef.current.scrollTo({ top: scrollRef.current.scrollHeight, behavior: 'smooth' }); }, 100);
  };

  const handleSend = async () => {
    if (!newMessage.trim() || !activeThreadId || !userId) return;
    const text = newMessage.trim();
    setNewMessage("");
    const tempId = "temp-" + Date.now();
    setMessages(prev => [...prev, { id: tempId, text, created_at: new Date().toISOString(), user_id: userId, users: { name: myProfile?.name || 'Mig', avatar_url: myProfile?.avatar_url } }]);
    scrollToBottom();

    let res;
    if (isDirectMessage && dmTargetUser) {
      res = await supabase.from('messages').insert([{ thread_id: activeThreadId, sender_id: userId, receiver_id: dmTargetUser.id, text, is_read: false }]).select().single();
    } else {
      res = await supabase.from('forening_messages').insert([{ thread_id: activeThreadId, user_id: userId, text }]).select().single();
    }
    if (res.error) { alert("Fejl: " + res.error.message); setMessages(prev => prev.filter(m => m.id !== tempId)); }
    else if (res.data) setMessages(prev => prev.map(m => m.id === tempId ? { ...m, id: res.data.id } : m));
  };

  const handleDeleteThread = async () => {
    if (!activeThreadId || !confirm("Vil du slette denne samtale?")) return;
    const res = isDirectMessage ? await supabase.from('messages').delete().eq('thread_id', activeThreadId) : await supabase.from('forening_threads').delete().eq('id', activeThreadId);
    if (res.error) alert("Fejl: " + res.error.message);
    else { setThreads(prev => prev.filter(t => t.id !== activeThreadId)); setActiveThreadId(null); setMessages([]); }
  };

  /* ───────── ANMELD LOGIK (Matcher Appen) ───────── */
  const handleReport = async () => {
    if (!activeThreadId || !userId || !dmTargetUser) return;
    const reason = window.prompt("Hvorfor vil du anmelde denne samtale? (stødende, chikane, spam)");
    if (!reason) return;
    setSubmittingReport(true);
    try {
      const { data: inserted, error: dbErr } = await supabase.from("reports").insert({
        reporter_id: userId,
        thread_id: activeThreadId,
        reason: reason,
        status: "pending"
      }).select("id").single();
      if (dbErr) throw dbErr;

      const lastMsg = messages[messages.length - 1]?.text || "Ingen beskeder endnu";
      await fetch("https://hook.eu1.make.com/cvdk1pfd6augxw0w57s5l1rtgl9mhqrc", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          source: "BESKEDER",
          reportId: inserted.id,
          reason: reason,
          note: reason,
          threadId: activeThreadId,
          reporterId: userId,
          ownerId: dmTargetUser.id,
          beskedTekst: lastMsg
        }),
      });
      alert("Tak, din anmeldelse er modtaget.");
    } catch (err) { alert("Anmeldelsen er modtaget i systemet."); } 
    finally { setSubmittingReport(false); }
  };

  const activeThreadInfo = isDirectMessage ? { title: dmTargetUser?.name || 'Besked', subtitle: 'Privat' } : { title: threads.find(t => t.id === activeThreadId)?.title, subtitle: threads.find(t => t.id === activeThreadId)?.forening?.navn };

  if (loading) return <div className="min-h-screen bg-[#869FB9] flex items-center justify-center"><div className="animate-spin rounded-full h-12 w-12 border-b-2 border-[#131921]"></div></div>;

  return (
    <div className="min-h-screen flex flex-col bg-[#869FB9]">
      <SiteHeader />
      <main className="flex-1 w-full max-w-6xl mx-auto p-4 pb-20">
        <div className="bg-white rounded-[30px] shadow-xl overflow-hidden min-h-[70vh] flex flex-col md:flex-row">
          <div className={`w-full md:w-80 bg-gray-50 border-r border-gray-100 flex-shrink-0 flex flex-col ${activeThreadId ? 'hidden md:flex' : 'flex'}`}>
            <div className="p-5 border-b border-gray-100"><h2 className="text-xl font-black text-[#131921]">Indbakke</h2></div>
            <div className="flex-1 overflow-y-auto p-2 space-y-1">
              {threads.map(t => (
                <button key={t.id} onClick={() => handleSelectThread(t.id, !!t.isDm, userId!, t.dmUserId)} className={`w-full text-left p-3 rounded-xl flex flex-col gap-1 transition-all ${activeThreadId === t.id ? 'bg-white shadow-sm ring-1 ring-gray-100' : 'hover:bg-gray-100'}`}>
                  <div className="flex justify-between items-center w-full"><span className="font-bold text-sm truncate">{t.title}</span>{t.unreadCount ? <span className="h-3 w-3 rounded-full bg-red-500 border border-white"></span> : null}</div>
                  <span className="text-[10px] text-gray-400 uppercase font-bold tracking-wide">{t.isDm ? 'Privat' : t.forening?.navn}</span>
                </button>
              ))}
            </div>
          </div>

          <div className={`flex-1 flex flex-col bg-white ${!activeThreadId ? 'hidden md:flex' : 'flex'}`}>
            {activeThreadId ? (
              <>
                <div className="p-4 border-b border-gray-100 flex items-center justify-between shadow-sm bg-white">
                  <div className="flex items-center gap-3">
                    <button onClick={() => setActiveThreadId(null)} className="md:hidden w-10 h-10 flex items-center justify-center bg-white border border-gray-100 rounded-full"><i className="fa-solid fa-arrow-left"></i></button>
                    <div><h3 className="font-bold text-[#131921]">{activeThreadInfo.title}</h3><p className="text-xs text-gray-500">{activeThreadInfo.subtitle}</p></div>
                  </div>
                  <div className="flex gap-2">
                    {isDirectMessage && (
                      <button onClick={handleReport} disabled={submittingReport} className="flex items-center gap-2 px-3 py-1.5 rounded-lg hover:bg-orange-50 text-orange-600 transition-colors">
                        <span className="text-xs font-bold uppercase tracking-wide">Anmeld</span>
                        <i className="fa-solid fa-triangle-exclamation"></i>
                      </button>
                    )}
                    <button onClick={handleDeleteThread} className="flex items-center gap-2 px-3 py-1.5 rounded-lg hover:bg-red-50 text-red-600 transition-colors">
                      <span className="text-xs font-bold uppercase tracking-wide">Slet</span>
                      <i className="fa-regular fa-trash-can"></i>
                    </button>
                  </div>
                </div>

                <div ref={scrollRef} className="flex-1 overflow-y-auto p-4 space-y-4 bg-[#F5F7FA]">
                  {messages.map(msg => (
                    <div key={msg.id} className={`flex gap-3 items-end ${msg.user_id === userId ? 'flex-row-reverse' : 'flex-row'}`}>
                      <div className="w-8 h-8 rounded-full overflow-hidden border border-gray-100 shadow-sm"><img src={msg.users?.avatar_url || `https://ui-avatars.com/api/?name=${msg.users?.name || '?'}`} alt="" className="w-full h-full object-cover" /></div>
                      <div className={`max-w-[75%] rounded-2xl p-3 shadow-sm ${msg.user_id === userId ? 'bg-[#131921] text-white rounded-br-none' : 'bg-white text-gray-800 rounded-bl-none'}`}>
                        <p className="text-sm whitespace-pre-wrap">{formatTextWithLinks(msg.text)}</p>
                        <p className="text-[9px] mt-1 text-right opacity-60">{new Date(msg.created_at).toLocaleTimeString([], {hour:'2-digit', minute:'2-digit'})}</p>
                      </div>
                    </div>
                  ))}
                </div>

                <div className="p-4 bg-white border-t border-gray-100">
                  <div className="flex gap-2 bg-gray-50 p-1.5 rounded-full border border-gray-200">
                    <input value={newMessage} onChange={e => setNewMessage(e.target.value)} onKeyDown={e => e.key === 'Enter' && handleSend()} placeholder="Skriv besked..." className="flex-1 bg-transparent px-4 py-2 outline-none text-sm" />
                    <button onClick={handleSend} disabled={!newMessage.trim()} className="w-10 h-10 bg-[#131921] rounded-full text-white flex items-center justify-center hover:bg-black transition-colors shadow-md"><i className="fa-solid fa-paper-plane text-xs"></i></button>
                  </div>
                </div>
              </>
            ) : (
              <div className="flex-1 flex items-center justify-center text-gray-300 flex-col"><i className="fa-regular fa-comments text-6xl mb-4 opacity-50"></i><p>Vælg en samtale</p></div>
            )}
          </div>
        </div>
      </main>
      <SiteFooter />
    </div>
  );
}

export default function BeskederPage() {
  return ( <Suspense fallback={<div className="flex justify-center pt-20 text-white">Indlæser...</div>}><BeskederContent /></Suspense> );
}