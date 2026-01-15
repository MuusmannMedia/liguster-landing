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

  // --- VI DEFINERER FUNKTIONEN HERUPPE FOR AT UNDGÅ BUILD-FEJL ---
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
    const init = async () => {
      const { data: { session } } = await supabase.auth.getSession();
      if (!session) {
        router.push('/login');
        return;
      }
      setUserId(session.user.id);

      const { data: profile } = await supabase
        .from('users')
        .select('name, avatar_url, is_admin')
        .eq('id', session.user.id)
        .single();

      if (profile) {
        setMyProfile({ name: profile.name || 'Mig', avatar_url: getAvatarUrl(profile.avatar_url) });
        setIsAdmin(!!profile.is_admin);
      }

      // Her bør din logik til at hente threads ligge (initialThreads)
      // ... (Vi springer direkte til URL-logikken som fejlede)

      if (dmUserIdFromUrl) {
        const { data: targetUser } = await supabase.from('users').select('*').eq('id', dmUserIdFromUrl).single();
        if (targetUser) {
          setDmTargetUser(targetUser);
          setIsDirectMessage(true);
          
          const { data: existingMsgs } = await supabase
            .from('messages')
            .select('thread_id')
            .or(`and(sender_id.eq.${session.user.id},receiver_id.eq.${dmUserIdFromUrl}),and(sender_id.eq.${dmUserIdFromUrl},receiver_id.eq.${session.user.id})`)
            .limit(1);
          
          if (existingMsgs && existingMsgs.length > 0) {
            handleSelectThread(existingMsgs[0].thread_id, true, session.user.id, dmUserIdFromUrl);
          } else if (profile?.is_admin) {
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

  // Resten af koden (fetchMessages, handleSend, render osv.)
  // ... (Sørg for at indsætte resten af din BeskederContent her)

  return (
    <div className="min-h-screen flex flex-col bg-[#869FB9]">
      <SiteHeader />
      <main className="flex-1 w-full max-w-6xl mx-auto p-4 pb-20">
        {/* ... (Din render logik som i forrige svar) */}
        <div className="bg-white rounded-[40px] shadow-2xl overflow-hidden min-h-[75vh] flex flex-col md:flex-row border border-gray-100 text-[#131921]">
            {/* Sidebar og Chat vindue */}
            <div className="p-8"><h2 className="text-2xl font-black">Indbakke</h2></div>
        </div>
      </main>
      <SiteFooter />
    </div>
  );
}

export default function BeskederPage() {
  return ( <Suspense fallback={<div>Indlæser...</div>}><BeskederContent /></Suspense> );
}