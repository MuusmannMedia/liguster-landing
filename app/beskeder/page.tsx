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

  // --- FUNKTIONER ---
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

  const handleSend = async () => {
    if (!newMessage.trim() || !activeThreadId || !userId) return;
    const text = newMessage.trim();
    setNewMessage("");
    const tempId = "temp-" + Date.now();
    setMessages(prev => [...prev, { id: tempId, text, created_at: new Date().toISOString(), user_id: userId, users: { name: myProfile?.name || 'Mig', avatar_url: myProfile?.avatar_url } }]);
    
    let res;
    if (isDirectMessage && dmTargetUser) {
      res = await supabase.from('messages').insert([{ thread_id: activeThreadId, sender_id: userId, receiver_id: dmTargetUser.id, text, is_read: false }]).select().single();
    } else {
      res = await supabase.from('forening_messages').insert([{ thread_id: activeThreadId, user_id: userId, text }]).select().single();
    }
    if (res.error) { alert("Fejl: " + res.error.message); setMessages(prev => prev.filter(m => m.id !== tempId)); }
    else if (res.data) setMessages(prev => prev.map(m => m.id === tempId ? { ...m, id: res.data.id } : m));
    setTimeout(() => scrollRef.current?.scrollTo({ top: scrollRef.current.scrollHeight, behavior: 'smooth' }), 100);
  };

  const handleReport = async () => {
    if (!activeThreadId || !userId || !dmTargetUser) return;
    const reason = window.prompt("Hvorfor vil du anmelde?");
    if (!reason) return;
    setSubmittingReport(true);
    try {
      const currentT = threads.find(t => t.id === activeThreadId);
      const { data: ins } = await supabase.from("reports").insert({ reporter_id: userId, thread_id: activeThreadId, reason, status: "pending" }).select("id").single();
      const last = messages[messages.length - 1]?.text || "...";
      await fetch("https://hook.eu1.make.com/cvdk1pfd6augxw0w57s5l1rtgl9mhqrc", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ source: "BESKEDER", reportId: ins?.id, reason, threadId: activeThreadId, postId: currentT?.forening_id, reporterId: userId, ownerId: dmTargetUser.id, beskedTekst: last }),
      });
      alert("Tak, anmeldelse modtaget.");
    } catch (e) { alert("Modtaget i systemet."); } finally { setSubmittingReport(false); }
  };

  useEffect(() => {
    const init = async () => {
      const { data: { session } } = await supabase.auth.getSession();
      if (!session) { router.push('/login'); return; }
      const cId = session.user.id;
      setUserId(cId);

      const { data: prof } = await supabase.from('users').select('name, avatar_url, is_admin').eq('id', cId).single();
      if (prof) { setMyProfile({ name: prof.name || 'Mig', avatar_url: getAvatarUrl(prof.avatar_url) }); setIsAdmin(!!prof.is_admin); }

      const { data: mems } = await supabase.from('foreningsmedlemmer').select('forening_id').eq('user_id', cId).eq('status', 'approved');
      const fIds = mems?.map((m: any) => m.forening_id) || [];
      let initT: ThreadItem[] = [];

      if (fIds.length > 0) {
        const { data: td } = await supabase.from('forening_threads').select(`id, title, created_at, forening_id, foreninger(navn)`).in('forening_id', fIds);
        if (td) initT = td.map((t: any) => ({ id: t.id, title: t.title, created_at: t.created_at, forening_id: t.forening_id, forening: t.foreninger, isDm: false, unreadCount: 0 }));
      }

      const { data: dms } = await supabase.from('messages').select('thread_id, sender_id, receiver_id, created_at').or(`sender_id.eq.${cId},receiver_id.eq.${cId}`).order('created_at', { ascending: false });
      if (dms && dms.length > 0) {
        const uniq = new Map();
        const oIds = new Set<string>();
        dms.forEach((m: any) => { if (!uniq.has(m.thread_id)) { const oId = m.sender_id === cId ? m.receiver_id : m.sender_id; uniq.set(m.thread_id, { ...m, oId }); oIds.add(oId); } });
        const { data: usrs } = await supabase.from('users').select('id, name, avatar_url').in('id', Array.from(oIds));
        const uMap = new Map(); usrs?.forEach(u => uMap.set(u.id, u));
        const dmt: ThreadItem[] = Array.from(uniq.values()).map((t: any) => { const u = uMap.get(t.oId); return { id: t.thread_id, title: u?.name || 'Bruger', created_at: t.created_at, isDm: true, dmUserId: t.oId, dmUserAvatar: getAvatarUrl(u?.avatar_url), unreadCount: 0 }; });
        initT = [...dmt, ...initT];
      }
      initT.sort((a, b) => new Date(b.created_at).getTime() - new Date(a.created_at).getTime());
      setThreads(initT);

      if (dmUserIdFromUrl) {
        const { data: tar } = await supabase.from('users').select('*').eq('id', dmUserIdFromUrl).single();
        if (tar) {
          setDmTargetUser(tar); setIsDirectMessage(true);
          const { data: ex } = await supabase.from('messages').select('thread_id').or(`and(sender_id.eq.${cId},receiver_id.eq.${dmUserIdFromUrl}),and(sender_id.eq.${dmUserIdFromUrl},receiver_id.eq.${cId})`).limit(1);
          if (ex && ex.length > 0) handleSelectThread(ex[0].thread_id, true, cId, dmUserIdFromUrl);
          else if (prof?.is_admin) {
            const { data: adm } = await supabase.from('messages').select('thread_id').or(`sender_id.eq.${dmUserIdFromUrl},receiver_id.eq.${dmUserIdFromUrl}`).limit(1);
            if (adm && adm.length > 0) handleSelectThread(adm[0].thread_id, true, cId, dmUserIdFromUrl);
          }
        }
      }
      setLoading(false);
    };
    init();
  }, [dmUserIdFromUrl, router]);

  useEffect(() => {
    if (!activeThreadId) return;
    const fetchM = async () => {
      const table = isDirectMessage ? 'messages' : 'forening_messages';
      const res = await supabase.from(table).select(isDirectMessage ? 'id, text, created_at, sender_id' : 'id, text, created_at, user_id').eq('thread_id', activeThreadId).order('created_at', { ascending: true });
      const data = isDirectMessage ? (res.data?.map((m: any) => ({ ...m, user_id: m.sender_id })) ?? null) : res.data;
      if (data) {
        const uIds = [...new Set(data.map((m: any) => m.user_id))];
        const { data: us } = await supabase.from('users').select('id, name, avatar_url').in('id', uIds);
        const uMap: Record<string, any> = {}; us.forEach(u => uMap[u.id] = { name: u.name, avatar_url: getAvatarUrl(u.avatar_url) });
        setMessages(data.map((m: any) => ({ ...m, users: uMap[m.user_id] || { name: '?', avatar_url: null } })) as any);
        setTimeout(() => scrollRef.current?.scrollTo({ top: scrollRef.current.scrollHeight }), 100);
      }
    };
    fetchM();
  }, [activeThreadId, isDirectMessage]);

  const activeThreadInfo = isDirectMessage 
    ? { title: dmTargetUser?.name || 'Besked', subtitle: 'Privat' } 
    : { title: threads.find(t => t.id === activeThreadId)?.title || 'Chat', subtitle: threads.find(t => t.id === activeThreadId)?.forening?.navn || '' };

  if (loading) return <div className="min-h-screen bg-[#869FB9] flex items-center justify-center font-black">Indlæser...</div>;

  return (
    <div className="min-h-screen flex flex-col bg-[#869FB9]">
      <SiteHeader />
      <main className="flex-1 w-full max-w-6xl mx-auto p-4 pb-20">
        <div className="bg-white rounded-[40px] shadow-2xl overflow-hidden min-h-[75vh] flex flex-col md:flex-row border border-gray-100">
          <div className={`w-full md:w-80 bg-gray-50 border-r border-gray-100 flex-shrink-0 flex flex-col ${activeThreadId ? 'hidden md:flex' : 'flex'}`}>
            <div className="p-8 border-b border-gray-200">
                <h2 className="text-2xl font-black text-[#131921]">Indbakke</h2>
                {isAdmin && <span className="text-[9px] bg-black text-white px-2 py-0.5 rounded-full font-black uppercase">Admin</span>}
            </div>
            <div className="flex-1 overflow-y-auto p-3 space-y-1.5">
              {threads.map(t => (
                <button key={t.id} onClick={() => handleSelectThread(t.id, !!t.isDm, userId!, t.dmUserId)} className={`w-full text-left p-4 rounded-2xl flex flex-col gap-1 ${activeThreadId === t.id ? 'bg-white shadow-md ring-1 ring-gray-200' : 'hover:bg-gray-200'}`}>
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
                        <div>
                          <h3 className="font-black text-[#131921] text-xl">{activeThreadInfo.title}</h3>
                          <p className="text-[11px] text-gray-500 font-black uppercase tracking-widest">{activeThreadInfo.subtitle}</p>
                        </div>
                    </div>
                    <button onClick={handleReport} className="text-orange-600 text-[11px] font-black uppercase flex items-center gap-2 px-4 py-2 rounded-xl hover:bg-orange-50"><i className="fa-solid fa-triangle-exclamation"></i> Anmeld</button>
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
                <div className="p-6 bg-white border-t border-gray-100">
                  <div className="flex gap-4 bg-gray-50 p-2 rounded-2xl border border-gray-200">
                    <input value={newMessage} onChange={e => setNewMessage(e.target.value)} onKeyDown={e => e.key === 'Enter' && handleSend()} placeholder="Skriv besked..." className="flex-1 bg-transparent px-5 py-3 outline-none text-[16px] text-[#131921] font-semibold" />
                    <button onClick={handleSend} disabled={!newMessage.trim()} className="w-14 h-14 bg-[#131921] text-white rounded-xl flex items-center justify-center shadow-xl hover:bg-black transition-all active:scale-95"><i className="fa-solid fa-paper-plane"></i></button>
                  </div>
                </div>
              </>
            ) : (
              <div className="flex-1 flex items-center justify-center text-gray-400 font-black uppercase tracking-[0.3em] text-xs">Vælg en samtale</div>
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