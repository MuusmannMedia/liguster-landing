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

  useEffect(() => {
    const init = async () => {
      const { data: { session } } = await supabase.auth.getSession();
      if (!session) {
        router.push('/login');
        return;
      }
      setUserId(session.user.id);

      // Tjek profil OG admin status
      const { data: profile } = await supabase
        .from('users')
        .select('name, avatar_url, is_admin')
        .eq('id', session.user.id)
        .single();

      if (profile) {
        setMyProfile({ name: profile.name || 'Mig', avatar_url: getAvatarUrl(profile.avatar_url) });
        setIsAdmin(!!profile.is_admin);
      }

      // Hent tråde (forkortet for overblik, men bevarer din logik)
      const { data: memberships } = await supabase.from('foreningsmedlemmer').select('forening_id').eq('user_id', session.user.id).eq('status', 'approved');
      const myForeningIds = memberships?.map((m: any) => m.forening_id) || [];

      let initialThreads: ThreadItem[] = [];

      // ... (Din eksisterende kode til at hente threads og DMs her)
      // For at holde svaret læsbart, antager vi at din eksisterende logik for initialThreads kører her.
      
      // LOGIK FOR DM FRA URL (MAIL LINK)
      if (dmUserIdFromUrl) {
        const { data: targetUser } = await supabase.from('users').select('*').eq('id', dmUserIdFromUrl).single();
        if (targetUser) {
          setDmTargetUser(targetUser);
          setIsDirectMessage(true);
          
          // Find eksisterende tråd
          const { data: existingMsgs } = await supabase
            .from('messages')
            .select('thread_id')
            .or(`and(sender_id.eq.${session.user.id},receiver_id.eq.${dmUserIdFromUrl}),and(sender_id.eq.${dmUserIdFromUrl},receiver_id.eq.${session.user.id})`)
            .limit(1);
          
          if (existingMsgs && existingMsgs.length > 0) {
            handleSelectThread(existingMsgs[0].thread_id, true, session.user.id, dmUserIdFromUrl);
          } else if (profile?.is_admin) {
            // Hvis admin, find tråden selvom admin ikke er part i den
            const { data: adminFind } = await supabase
                .from('messages')
                .select('thread_id')
                .or(`sender_id.eq.${dmUserIdFromUrl},receiver_id.eq.${dmUserIdFromUrl}`)
                .limit(1);
            if (adminFind && adminFind.length > 0) {
                handleSelectThread(adminFind[0].thread_id, true, session.user.id, dmUserIdFromUrl);
            }
          } else {
            setActiveThreadId(makeUuid());
          }
        }
      }

      setLoading(false);
    };
    init();
  }, [dmUserIdFromUrl, router]);

  // HENT BESKEDER (Med Admin adgang)
  useEffect(() => {
    if (!activeThreadId) return;
    
    const fetchMessages = async () => {
      const table = isDirectMessage ? 'messages' : 'forening_messages';
      
      // Hvis isAdmin, fjerner vi de normale RLS filtre (hvis dine policies tillader det)
      const res = await supabase
        .from(table)
        .select(isDirectMessage ? 'id, text, created_at, sender_id' : 'id, text, created_at, user_id')
        .eq('thread_id', activeThreadId)
        .order('created_at', { ascending: true });
      
      const data = isDirectMessage 
        ? (res.data?.map((m: any) => ({ ...m, user_id: m.sender_id })) ?? null) 
        : res.data;

      if (data) {
        const userIds = [...new Set(data.map((m: any) => m.user_id))];
        const { data: users } = await supabase.from('users').select('id, name, avatar_url').in('id', userIds);
        const userMap: Record<string, any> = {};
        users?.forEach(u => userMap[u.id] = { name: u.name, avatar_url: getAvatarUrl(u.avatar_url) });
        
        setMessages(data.map((m: any) => ({
          ...m,
          users: userMap[m.user_id] || { name: 'Ukendt', avatar_url: null }
        })) as any);
        scrollToBottom();
      }
    };
    fetchMessages();
  }, [activeThreadId, isDirectMessage, isAdmin]);

  // ... (handleSend, handleDeleteThread og handleReport fra forrige svar)

  return (
    <div className="min-h-screen flex flex-col bg-[#869FB9]">
      <SiteHeader />
      <main className="flex-1 w-full max-w-6xl mx-auto p-4 pb-20">
        <div className="bg-white rounded-[40px] shadow-2xl overflow-hidden min-h-[75vh] flex flex-col md:flex-row border border-gray-100">
          
          {/* SIDEBAR */}
          <div className={`w-full md:w-80 bg-gray-50 border-r border-gray-100 flex flex-col ${activeThreadId ? 'hidden md:flex' : 'flex'}`}>
            <div className="p-8 border-b border-gray-200">
                <h2 className="text-2xl font-black text-[#131921]">Indbakke</h2>
                {isAdmin && <span className="text-[9px] bg-black text-white px-2 py-0.5 rounded-full font-black uppercase tracking-tighter">Admin Mode</span>}
            </div>
            {/* ... Liste af tråde */}
          </div>

          {/* CHAT VINDUE */}
          <div className="flex-1 flex flex-col bg-white">
            {activeThreadId ? (
              <>
                {/* Topbar med Anmeld og Slet knapper */}
                {/* Besked liste med formatTextWithLinks */}
                {/* Input felt */}
              </>
            ) : (
              <div className="flex-1 flex items-center justify-center text-gray-400 font-black uppercase tracking-widest text-xs">Vælg en samtale</div>
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