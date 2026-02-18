'use client';

import { useState, useEffect, useRef, Suspense, useMemo } from 'react';
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
  message_reactions?: MessageReaction[];
  users?: {
    name?: string;
    avatar_url?: string | null;
  };
};

type MessageReaction = {
  id: string;
  message_id: string;
  user_id: string;
  emoji: string;
};

const QUICK_REACTIONS = ['❤️', '😂', '👍', '😮', '😢', '😡'];

// --- HJÆLPERE ---
const getAvatarUrl = (path: string | null | undefined) => {
  if (!path) return null;
  if (path.startsWith('http')) return path;
  const { data } = supabase.storage.from('avatars').getPublicUrl(path);
  return data.publicUrl;
};

const buildAvatarFallback = (name: string) =>
  `https://ui-avatars.com/api/?name=${encodeURIComponent(name || 'Bruger')}&background=E5E7EB&color=111827&size=128`;

const formatTextWithLinks = (text: string) => {
  const cleanParts = text.split(/(\s+)/).map((word, i) => {
    if (word.startsWith('/forening/')) {
      return (
        <Link key={i} href={word} className="text-blue-600 underline hover:text-blue-800 break-all">
          {word}
        </Link>
      );
    }
    if (word.match(/^https?:\/\//)) {
      return (
        <a
          key={i}
          href={word}
          target="_blank"
          rel="noopener noreferrer"
          className="text-blue-600 underline hover:text-blue-800 break-all"
        >
          {word}
        </a>
      );
    }
    return word;
  });
  return cleanParts;
};

function BeskederContent() {
  const router = useRouter();
  const searchParams = useSearchParams();

  const threadIdFromUrl = searchParams.get('id');   // <- vigtigt
  const dmUserIdFromUrl = searchParams.get('dmUser') || searchParams.get('chatWith');

  const [userId, setUserId] = useState<string | null>(null);
  const [isAdmin, setIsAdmin] = useState(false);
  const [myProfile, setMyProfile] = useState<{ name: string; avatar_url: string | null } | null>(null);

  const [threads, setThreads] = useState<ThreadItem[]>([]);
  const threadsRef = useRef<ThreadItem[]>([]);
  useEffect(() => {
    threadsRef.current = threads;
  }, [threads]);

  const [activeThreadId, setActiveThreadId] = useState<string | null>(null);
  const [isDirectMessage, setIsDirectMessage] = useState(false);
  const [dmTargetUser, setDmTargetUser] = useState<any>(null);

  const [messages, setMessages] = useState<ChatMessage[]>([]);
  const [newMessage, setNewMessage] = useState('');
  const [selectedMessage, setSelectedMessage] = useState<ChatMessage | null>(null);
  const [forwardMessage, setForwardMessage] = useState<ChatMessage | null>(null);
  const [forwardingToThreadId, setForwardingToThreadId] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);

  const [dmDeletedMap, setDmDeletedMap] = useState<Record<string, string | null>>({});
  const scrollRef = useRef<HTMLDivElement>(null);

  const scrollToBottom = () => {
    setTimeout(() => {
      if (scrollRef.current) scrollRef.current.scrollTop = scrollRef.current.scrollHeight;
    }, 100);
  };

  const getDmDeletedAt = (threadId: string | null) => {
    if (!threadId) return null;
    return dmDeletedMap[threadId] ?? null;
  };

  const makeUuid = () => {
    return 'xxxxxxxx-xxxx-4xxx-yxxx-xxxxxxxxxxxx'.replace(/[xy]/g, (c) => {
      const r = (Math.random() * 16) | 0;
      const v = c === 'x' ? r : (r & 0x3) | 0x8;
      return v.toString(16);
    });
  };

  const findExistingDmThreadId = async (firstUserId: string, secondUserId: string) => {
    const { data } = await supabase
      .from('messages')
      .select('thread_id, created_at')
      .or(
        `and(sender_id.eq.${firstUserId},receiver_id.eq.${secondUserId}),and(sender_id.eq.${secondUserId},receiver_id.eq.${firstUserId})`
      )
      .order('created_at', { ascending: false })
      .limit(1);

    return data?.[0]?.thread_id ?? null;
  };

  // --- persist menu-dot state til header ---
  const hasUnread = useMemo(() => threads.some(t => (t.unreadCount ?? 0) > 0), [threads]);
  useEffect(() => {
    try {
      localStorage.setItem('liguster_has_unread', hasUnread ? '1' : '0');
      window.dispatchEvent(new CustomEvent('liguster:unread', { detail: { hasUnread } }));
    } catch {}
  }, [hasUnread]);

  // --- markér tråd som læst (DB + local) ---
  const markThreadAsRead = async (threadId: string, isDm: boolean) => {
    if (!userId) return;
    const now = new Date().toISOString();

    if (isDm) {
      // state: last_read_at
      await supabase
        .from('dm_thread_state')
        .upsert({ thread_id: threadId, user_id: userId, last_read_at: now }, { onConflict: 'thread_id,user_id' });

      // markér DM beskeder som læst (kun dem du modtager)
      await supabase
        .from('messages')
        .update({ is_read: true })
        .eq('thread_id', threadId)
        .eq('receiver_id', userId)
        .eq('is_read', false);

    } else {
      // forening: last_read_at
      await supabase
        .from('forening_thread_state')
        .upsert({ thread_id: threadId, user_id: userId, last_read_at: now }, { onConflict: 'thread_id,user_id' });
    }

    // lokal nulstilling
    setThreads(prev => prev.map(t => (t.id === threadId ? { ...t, unreadCount: 0 } : t)));
  };

  async function handleSelectThread(threadId: string, isDm: boolean, currentUserId: string, targetUserId?: string) {
    setActiveThreadId(threadId);
    setIsDirectMessage(isDm);

    if (isDm && targetUserId) {
      const { data: tUser } = await supabase.from('users').select('*').eq('id', targetUserId).single();
      if (tUser) setDmTargetUser(tUser);
    } else {
      setDmTargetUser(null);
    }

    // markér som læst i DB (så det virker efter reload)
    await markThreadAsRead(threadId, isDm);
  }

  const upsertThreadToTop = async (opts: {
    threadId: string;
    otherUserId: string;
    created_at: string;
    isIncoming: boolean;
  }) => {
    const { threadId, otherUserId, created_at, isIncoming } = opts;

    const deletedAt = dmDeletedMap[threadId];
    if (deletedAt && new Date(created_at).getTime() <= new Date(deletedAt).getTime()) return;

    // Opdater eksisterende DM-tråd (eller flyt til top)
    setThreads((prev) => {
      const existing = prev.find((t) => t.id === threadId && t.isDm);
      if (existing) {
        const updated: ThreadItem = {
          ...existing,
          created_at,
          unreadCount: activeThreadId === threadId ? 0 : (existing.unreadCount ?? 0) + (isIncoming ? 1 : 0),
        };
        const rest = prev.filter((t) => !(t.id === threadId && t.isDm));
        return [updated, ...rest].sort((a, b) => new Date(b.created_at).getTime() - new Date(a.created_at).getTime());
      }
      return prev;
    });

    // Hvis tråden ikke findes (ny DM), tilføj den
    const already = threadsRef.current.find((t) => t.id === threadId && t.isDm);
    if (!already) {
      const { data: u } = await supabase.from('users').select('id, name, avatar_url').eq('id', otherUserId).single();

      const newThread: ThreadItem = {
        id: threadId,
        title: u?.name || 'Bruger',
        created_at,
        isDm: true,
        dmUserId: otherUserId,
        dmUserAvatar: getAvatarUrl(u?.avatar_url),
        unreadCount: activeThreadId === threadId ? 0 : isIncoming ? 1 : 0,
      };

      setThreads((prev) => {
        const rest = prev.filter((t) => !(t.id === threadId && t.isDm));
        return [newThread, ...rest].sort((a, b) => new Date(b.created_at).getTime() - new Date(a.created_at).getTime());
      });
    }
  };

  const handleSend = async () => {
    if (!newMessage.trim() || !activeThreadId || !userId) return;
    const text = newMessage.trim();
    setNewMessage('');

    const tempId = 'temp-' + Date.now();
    const optimisticMsg: ChatMessage = {
      id: tempId,
      text,
      created_at: new Date().toISOString(),
      user_id: userId,
      users: { name: myProfile?.name || 'Mig', avatar_url: myProfile?.avatar_url },
    };

    setMessages((prev) => [...prev, optimisticMsg]);
    scrollToBottom();

    let res;
    if (isDirectMessage && dmTargetUser) {
      res = await supabase
        .from('messages')
        .insert([{ thread_id: activeThreadId, sender_id: userId, receiver_id: dmTargetUser.id, text, is_read: false }])
        .select()
        .single();
    } else {
      res = await supabase
        .from('forening_messages')
        .insert([{ thread_id: activeThreadId, user_id: userId, text }])
        .select()
        .single();
    }

    if (res.error) {
      alert('Fejl: ' + res.error.message);
      setMessages((prev) => prev.filter((m) => m.id !== tempId));
      return;
    }

    setMessages((prev) => prev.map((m) => (m.id === tempId ? { ...m, id: res.data.id } : m)));

    // flyt tråd til top lokalt
    if (isDirectMessage && dmTargetUser) {
      await upsertThreadToTop({ threadId: activeThreadId, otherUserId: dmTargetUser.id, created_at: res.data.created_at, isIncoming: false });
    } else {
      setThreads((prev) => {
        const idx = prev.findIndex((t) => t.id === activeThreadId && !t.isDm);
        if (idx === -1) return prev;
        const existing = prev[idx];
        const updated: ThreadItem = { ...existing, created_at: res.data.created_at, unreadCount: 0 };
        const rest = prev.filter((_, i) => i !== idx);
        return [updated, ...rest].sort((a, b) => new Date(b.created_at).getTime() - new Date(a.created_at).getTime());
      });

      // jeg har skrevet -> så er tråden "læst" for mig
      await markThreadAsRead(activeThreadId, false);
    }
  };

  const handleToggleReaction = async (message: ChatMessage, emoji: string) => {
    if (!userId || !isDirectMessage) return;

    const previousReactions = message.message_reactions || [];
    const ownReaction = previousReactions.find((r) => r.user_id === userId);
    const removeOwnReaction = ownReaction?.emoji === emoji;

    const nextReactions = removeOwnReaction
      ? previousReactions.filter((r) => r.user_id !== userId)
      : [
          ...previousReactions.filter((r) => r.user_id !== userId),
          {
            id: `temp-${Date.now()}`,
            message_id: message.id,
            user_id: userId,
            emoji,
          },
        ];

    setMessages((prev) =>
      prev.map((m) => (m.id === message.id ? { ...m, message_reactions: nextReactions } : m))
    );
    setSelectedMessage(null);

    const delRes = await supabase
      .from('message_reactions')
      .delete()
      .eq('message_id', message.id)
      .eq('user_id', userId);

    if (delRes.error) {
      setMessages((prev) =>
        prev.map((m) => (m.id === message.id ? { ...m, message_reactions: previousReactions } : m))
      );
      alert('Kunne ikke opdatere reaktion.');
      return;
    }

    if (removeOwnReaction) return;

    const insRes = await supabase
      .from('message_reactions')
      .insert({ message_id: message.id, user_id: userId, emoji });

    if (insRes.error) {
      setMessages((prev) =>
        prev.map((m) => (m.id === message.id ? { ...m, message_reactions: previousReactions } : m))
      );
      alert('Kunne ikke gemme reaktion.');
    }
  };

  const handleDeleteMessage = async (message: ChatMessage) => {
    if (!userId || message.user_id !== userId) return;
    if (!confirm('Vil du slette denne besked?')) return;

    const table = isDirectMessage ? 'messages' : 'forening_messages';
    const { error } = await supabase.from(table).delete().eq('id', message.id);

    if (error) {
      alert('Fejl: ' + error.message);
      return;
    }

    setMessages((prev) => prev.filter((m) => m.id !== message.id));
    setSelectedMessage(null);
  };

  const handleReportMessage = async (message: ChatMessage) => {
    if (!userId || !activeThreadId) return;
    const reason = window.prompt('Hvorfor vil du anmelde denne besked?');
    if (!reason) return;

    const richInsert = await supabase.from('reports').insert({
      reporter_id: userId,
      thread_id: activeThreadId,
      target_id: message.id,
      target_type: isDirectMessage ? 'message' : 'forening_message',
      reason,
      status: 'pending',
      metadata: {
        text: message.text,
        sender: message.user_id,
      },
    });

    if (richInsert.error) {
      const fallbackInsert = await supabase.from('reports').insert({
        reporter_id: userId,
        thread_id: activeThreadId,
        reason,
        status: 'pending',
      });

      if (fallbackInsert.error) {
        alert('Fejl: ' + fallbackInsert.error.message);
        return;
      }
    }

    setSelectedMessage(null);
    alert('Tak, anmeldelse modtaget.');
  };

  const handleOpenForward = (message: ChatMessage) => {
    setSelectedMessage(null);
    setForwardMessage(message);
  };

  const handleForwardMessageToThread = async (targetThread: ThreadItem) => {
    if (!forwardMessage || !userId) return;
    const text = forwardMessage.text.trim();
    if (!text) return;

    setForwardingToThreadId(targetThread.id);

    if (targetThread.isDm) {
      if (!targetThread.dmUserId) {
        setForwardingToThreadId(null);
        alert('Kan ikke videresende til denne tråd.');
        return;
      }

      const insRes = await supabase
        .from('messages')
        .insert([
          {
            thread_id: targetThread.id,
            sender_id: userId,
            receiver_id: targetThread.dmUserId,
            text,
            is_read: false,
          },
        ])
        .select('id, text, created_at, sender_id')
        .single();

      if (insRes.error) {
        setForwardingToThreadId(null);
        alert('Fejl: ' + insRes.error.message);
        return;
      }

      if (targetThread.id === activeThreadId) {
        const inserted = insRes.data;
        setMessages((prev) => [
          ...prev,
          {
            id: inserted.id,
            text: inserted.text,
            created_at: inserted.created_at,
            user_id: inserted.sender_id,
            message_reactions: [],
            users: { name: myProfile?.name || 'Mig', avatar_url: myProfile?.avatar_url || null },
          },
        ]);
        scrollToBottom();
      }

      await upsertThreadToTop({
        threadId: targetThread.id,
        otherUserId: targetThread.dmUserId,
        created_at: insRes.data.created_at,
        isIncoming: false,
      });
    } else {
      const insRes = await supabase
        .from('forening_messages')
        .insert([
          {
            thread_id: targetThread.id,
            user_id: userId,
            text,
          },
        ])
        .select('id, text, created_at, user_id')
        .single();

      if (insRes.error) {
        setForwardingToThreadId(null);
        alert('Fejl: ' + insRes.error.message);
        return;
      }

      if (targetThread.id === activeThreadId) {
        const inserted = insRes.data;
        setMessages((prev) => [
          ...prev,
          {
            id: inserted.id,
            text: inserted.text,
            created_at: inserted.created_at,
            user_id: inserted.user_id,
            users: { name: myProfile?.name || 'Mig', avatar_url: myProfile?.avatar_url || null },
          },
        ]);
        scrollToBottom();
      }

      setThreads((prev) => {
        const idx = prev.findIndex((t) => t.id === targetThread.id && !t.isDm);
        if (idx === -1) return prev;

        const existing = prev[idx];
        const updated: ThreadItem = {
          ...existing,
          created_at: insRes.data.created_at,
          unreadCount: targetThread.id === activeThreadId ? 0 : existing.unreadCount ?? 0,
        };
        const rest = prev.filter((_, i) => i !== idx);
        return [updated, ...rest].sort(
          (a, b) => new Date(b.created_at).getTime() - new Date(a.created_at).getTime()
        );
      });
    }

    setForwardingToThreadId(null);
    setForwardMessage(null);
  };

  const handleReport = async () => {
    if (!activeThreadId || !userId || !dmTargetUser) return;
    const reason = window.prompt('Hvorfor vil du anmelde?');
    if (!reason) return;

    try {
      const currentT = threads.find((t) => t.id === activeThreadId);
      const { data: ins } = await supabase
        .from('reports')
        .insert({ reporter_id: userId, thread_id: activeThreadId, reason, status: 'pending' })
        .select('id')
        .single();

      const last = messages[messages.length - 1]?.text || '...';

      await fetch('https://hook.eu1.make.com/cvdk1pfd6augxw0w57s5l1rtgl9mhqrc', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          source: 'BESKEDER',
          reportId: ins?.id,
          reason,
          threadId: activeThreadId,
          postId: currentT?.forening_id,
          reporterId: userId,
          ownerId: dmTargetUser.id,
          beskedTekst: last,
        }),
      });

      alert('Tak, anmeldelse modtaget.');
    } catch (e) {
      alert('Anmeldelse sendt.');
    }
  };

  const handleDeleteThreadById = async (threadId: string, isDmThread: boolean) => {
    if (!userId || !confirm('Vil du slette denne samtale?')) return;

    if (isDmThread) {
      const deletedAt = new Date().toISOString();
      const { error } = await supabase
        .from('dm_thread_state')
        .upsert({ thread_id: threadId, user_id: userId, deleted_at: deletedAt }, { onConflict: 'thread_id,user_id' });

      if (error) {
        alert('Fejl: ' + error.message);
        return;
      }

      setDmDeletedMap((prev) => ({ ...prev, [threadId]: deletedAt }));
      setThreads((prev) => prev.filter((t) => t.id !== threadId));
      if (activeThreadId === threadId) {
        setActiveThreadId(null);
        setMessages([]);
        setIsDirectMessage(false);
        setDmTargetUser(null);
      }
      return;
    }

    const { error } = await supabase.from('forening_threads').delete().eq('id', threadId);
    if (!error) {
      setThreads((prev) => prev.filter((t) => t.id !== threadId));
      if (activeThreadId === threadId) {
        setActiveThreadId(null);
        setMessages([]);
      }
    }
  };

  const handleDeleteThread = async () => {
    if (!activeThreadId) return;
    await handleDeleteThreadById(activeThreadId, isDirectMessage);
  };

  // --- INIT ---
  useEffect(() => {
    const init = async () => {
      const { data: { session } } = await supabase.auth.getSession();

      if (!session) {
        router.push('/login');
        return;
      }

      const cId = session.user.id;
      setUserId(cId);

      const { data: prof } = await supabase
        .from('users')
        .select('name, avatar_url, is_admin')
        .eq('id', cId)
        .single();

      if (prof) {
        setMyProfile({ name: prof.name || 'Mig', avatar_url: getAvatarUrl(prof.avatar_url) });
        setIsAdmin(!!prof.is_admin);
      }

      // DM soft-delete map
      const { data: dmState } = await supabase
        .from('dm_thread_state')
        .select('thread_id, deleted_at')
        .eq('user_id', cId);

      const deletedMap: Record<string, string | null> = {};
      dmState?.forEach((r: any) => (deletedMap[r.thread_id] = r.deleted_at));
      setDmDeletedMap(deletedMap);

      // Foreninger jeg er medlem af
      const { data: mems } = await supabase
        .from('foreningsmedlemmer')
        .select('forening_id')
        .eq('user_id', cId)
        .eq('status', 'approved');

      const fIds = mems?.map((m: any) => m.forening_id) || [];
      let initT: ThreadItem[] = [];

      // Forening-tråde
      if (fIds.length > 0) {
        const { data: td } = await supabase
          .from('forening_threads')
          .select(`id, title, created_at, forening_id, foreninger(navn)`)
          .in('forening_id', fIds);

        if (td) {
          initT = td.map((t: any) => ({
            id: t.id,
            title: t.title,
            created_at: t.created_at,
            forening_id: t.forening_id,
            forening: t.foreninger,
            isDm: false,
            unreadCount: 0,
          }));
        }
      }

      // DM-tråde ud fra messages (seneste pr thread, respekter deleted_at)
      const { data: dms } = await supabase
        .from('messages')
        .select('thread_id, sender_id, receiver_id, created_at')
        .or(`sender_id.eq.${cId},receiver_id.eq.${cId}`)
        .order('created_at', { ascending: false });

      if (dms && dms.length > 0) {
        const uniq = new Map<string, any>();
        const oIds = new Set<string>();

        for (const m of dms as any[]) {
          const delAt = deletedMap[m.thread_id] ?? null;
          if (delAt && new Date(m.created_at).getTime() <= new Date(delAt).getTime()) continue;

          if (!uniq.has(m.thread_id)) {
            const oId = m.sender_id === cId ? m.receiver_id : m.sender_id;
            uniq.set(m.thread_id, { ...m, oId });
            oIds.add(oId);
          }
        }

        if (uniq.size > 0) {
          const { data: usrs } = await supabase
            .from('users')
            .select('id, name, avatar_url')
            .in('id', Array.from(oIds));

          const uMap = new Map<string, any>();
          usrs?.forEach((u: any) => uMap.set(u.id, u));

          const dmt: ThreadItem[] = Array.from(uniq.values()).map((t: any) => {
            const u = uMap.get(t.oId);
            return {
              id: t.thread_id,
              title: u?.name || 'Bruger',
              created_at: t.created_at,
              isDm: true,
              dmUserId: t.oId,
              dmUserAvatar: getAvatarUrl(u?.avatar_url),
              unreadCount: 0,
            };
          });

          initT = [...dmt, ...initT];
        }
      }

      // --- HENT PERSISTENTE UNREAD COUNTS (DM + Forening) ---
      const [dmUnreadRes, fUnreadRes] = await Promise.all([
        supabase.rpc('get_dm_unread_counts', { p_user: cId }),
        supabase.rpc('get_forening_unread_counts', { p_user: cId }),
      ]);

      const dmUnreadMap: Record<string, number> = {};
      (dmUnreadRes.data ?? []).forEach((r: any) => (dmUnreadMap[r.thread_id] = r.unread_count));

      const fUnreadMap: Record<string, number> = {};
      (fUnreadRes.data ?? []).forEach((r: any) => (fUnreadMap[r.thread_id] = r.unread_count));

      initT = initT.map(t => {
        const u = t.isDm ? (dmUnreadMap[t.id] ?? 0) : (fUnreadMap[t.id] ?? 0);
        return { ...t, unreadCount: u };
      });

      initT.sort((a, b) => new Date(b.created_at).getTime() - new Date(a.created_at).getTime());
      setThreads(initT);

      // Auto-open hvis man kommer via link
      if (threadIdFromUrl) {
        const asDm = !!dmUserIdFromUrl;
        setActiveThreadId(threadIdFromUrl);
        setIsDirectMessage(asDm);

        if (asDm && dmUserIdFromUrl) {
          const { data: tUser } = await supabase.from('users').select('*').eq('id', dmUserIdFromUrl).single();
          if (tUser) setDmTargetUser(tUser);
          await markThreadAsRead(threadIdFromUrl, true);
        } else {
          await markThreadAsRead(threadIdFromUrl, false);
        }
      } else if (dmUserIdFromUrl) {
        setIsDirectMessage(true);

        const { data: tUser } = await supabase.from('users').select('*').eq('id', dmUserIdFromUrl).single();
        if (tUser) setDmTargetUser(tUser);

        const existingThreadId = await findExistingDmThreadId(cId, dmUserIdFromUrl);
        const threadIdToOpen = existingThreadId || makeUuid();

        setActiveThreadId(threadIdToOpen);
        await markThreadAsRead(threadIdToOpen, true);
      }

      setLoading(false);
    };

    init();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [router]);

  // --- FETCH BESKEDER I AKTIV TRÅD ---
  useEffect(() => {
    if (!activeThreadId || !userId) return;

    const fetchM = async () => {
      if (isDirectMessage) {
        const deletedAt = getDmDeletedAt(activeThreadId);

        let q = supabase
          .from('messages')
          .select('id, text, created_at, sender_id, message_reactions(id, message_id, user_id, emoji)')
          .eq('thread_id', activeThreadId)
          .order('created_at', { ascending: true });

        if (deletedAt) q = q.gt('created_at', deletedAt);

        const res = await q;
        const data = res.data?.map((m: any) => ({ ...m, user_id: m.sender_id })) ?? [];

        const uIds = [...new Set(data.map((m: any) => m.user_id))];
        const { data: us } = await supabase.from('users').select('id, name, avatar_url').in('id', uIds);

        const uMap: Record<string, any> = {};
        us?.forEach((u: any) => (uMap[u.id] = { name: u.name, avatar_url: getAvatarUrl(u.avatar_url) }));

        setMessages(data.map((m: any) => ({ ...m, users: uMap[m.user_id] || { name: '?', avatar_url: null } })) as any);
        scrollToBottom();
        return;
      }

      const res = await supabase
        .from('forening_messages')
        .select('id, text, created_at, user_id')
        .eq('thread_id', activeThreadId)
        .order('created_at', { ascending: true });

      const data = res.data ?? [];
      const uIds = [...new Set(data.map((m: any) => m.user_id))];
      const { data: us } = await supabase.from('users').select('id, name, avatar_url').in('id', uIds);

      const uMap: Record<string, any> = {};
      us?.forEach((u: any) => (uMap[u.id] = { name: u.name, avatar_url: getAvatarUrl(u.avatar_url) }));

      setMessages(data.map((m: any) => ({ ...m, users: uMap[m.user_id] || { name: '?', avatar_url: null } })) as any);
      scrollToBottom();
    };

    fetchM();
  }, [activeThreadId, isDirectMessage, userId, dmDeletedMap]);

  useEffect(() => {
    setSelectedMessage(null);
    setForwardMessage(null);
    setForwardingToThreadId(null);
  }, [activeThreadId]);

  // --- REALTIME: DM INBOX (opdater tråd + unread dot) ---
  useEffect(() => {
    if (!userId) return;

    const ch = supabase
      .channel(`inbox-dm-${userId}`)
      .on('postgres_changes', { event: 'INSERT', schema: 'public', table: 'messages', filter: `receiver_id=eq.${userId}` }, async (payload) => {
        const m: any = payload.new;
        await upsertThreadToTop({ threadId: m.thread_id, otherUserId: m.sender_id, created_at: m.created_at, isIncoming: true });
      })
      .on('postgres_changes', { event: 'INSERT', schema: 'public', table: 'messages', filter: `sender_id=eq.${userId}` }, async (payload) => {
        const m: any = payload.new;
        await upsertThreadToTop({ threadId: m.thread_id, otherUserId: m.receiver_id, created_at: m.created_at, isIncoming: false });
      })
      .subscribe();

    return () => {
      supabase.removeChannel(ch);
    };
  }, [userId, dmDeletedMap, activeThreadId]);

  // --- REALTIME: FORENING INBOX (unread dot + flyt til top) ---
  useEffect(() => {
    if (!userId) return;

    const ch = supabase
      .channel(`inbox-forening-${userId}`)
      .on('postgres_changes', { event: 'INSERT', schema: 'public', table: 'forening_messages' }, async (payload) => {
        const m: any = payload.new;
        const threadId = m.thread_id;

        setThreads((prev) => {
          const idx = prev.findIndex((t) => t.id === threadId && !t.isDm);
          if (idx === -1) return prev;

          const existing = prev[idx];
          const updated: ThreadItem = {
            ...existing,
            created_at: m.created_at,
            unreadCount: activeThreadId === threadId ? 0 : (existing.unreadCount ?? 0) + 1,
          };

          const rest = prev.filter((_, i) => i !== idx);
          return [updated, ...rest].sort((a, b) => new Date(b.created_at).getTime() - new Date(a.created_at).getTime());
        });
      })
      .subscribe();

    return () => {
      supabase.removeChannel(ch);
    };
  }, [userId, activeThreadId]);

  const getThreadAvatarSrc = (thread: ThreadItem) => {
    if (thread.isDm) {
      return thread.dmUserAvatar || buildAvatarFallback(thread.title || 'Bruger');
    }
    return buildAvatarFallback(thread.forening?.navn || thread.title || 'Forening');
  };

  const activeThreadMeta = useMemo(() => {
    const activeThread = threads.find((t) => t.id === activeThreadId) || null;

    if (isDirectMessage) {
      const title = dmTargetUser?.name || activeThread?.title || 'Besked';
      const avatar =
        getAvatarUrl(dmTargetUser?.avatar_url) ||
        activeThread?.dmUserAvatar ||
        buildAvatarFallback(title);
      return { title, subtitle: 'Privat', avatar };
    }

    const title = activeThread?.title || 'Chat';
    return {
      title,
      subtitle: activeThread?.forening?.navn || '',
      avatar: buildAvatarFallback(activeThread?.forening?.navn || title),
    };
  }, [activeThreadId, isDirectMessage, dmTargetUser, threads]);

  const renderReactionBadges = (msg: ChatMessage, isMe: boolean) => {
    if (!msg.message_reactions || msg.message_reactions.length === 0) return null;
    const counts = new Map<string, number>();
    msg.message_reactions.forEach((reaction) => {
      counts.set(reaction.emoji, (counts.get(reaction.emoji) ?? 0) + 1);
    });

    return (
      <div className={`mt-2 flex flex-wrap gap-1 ${isMe ? 'justify-end' : 'justify-start'}`}>
        {Array.from(counts.entries()).map(([emoji, count]) => (
          <span
            key={`${msg.id}-${emoji}`}
            className="inline-flex items-center px-2 py-0.5 rounded-full text-xs font-bold bg-[#131921] text-white border border-gray-300"
          >
            {emoji}
            {count > 1 ? ` ${count}` : ''}
          </span>
        ))}
      </div>
    );
  };

  if (loading) {
    return (
      <div className="min-h-screen bg-[#869FB9] flex items-center justify-center font-black">
        Indlæser...
      </div>
    );
  }

  return (
    <div className="min-h-screen flex flex-col bg-[#869FB9]">
      <SiteHeader />
      <main className="flex-1 content-shell py-4 pb-20">
        <div className="bg-white rounded-[40px] shadow-2xl overflow-hidden min-h-[75vh] flex flex-col md:flex-row border border-gray-100">
          <div className={`w-full md:w-80 bg-gray-50 border-r border-gray-100 flex-shrink-0 flex flex-col ${activeThreadId ? 'hidden md:flex' : 'flex'}`}>
            <div className="p-8 border-b border-gray-200">
              <h2 className="text-2xl font-black text-[#131921]">Indbakke</h2>
              {isAdmin && (
                <span className="text-[9px] bg-black text-white px-2 py-0.5 rounded-full font-black uppercase">
                  Admin
                </span>
              )}
            </div>

            <div className="flex-1 overflow-y-auto p-3 space-y-1.5">
              {threads.map((t, index) => {
                const isActive = activeThreadId === t.id;
                const rowTone = index % 2 === 0 ? 'bg-white' : 'bg-[#E8EDF3]';

                return (
                  <div
                    key={t.id}
                    className={`w-full p-3 rounded-2xl flex items-center gap-3 transition-all ${
                      isActive
                        ? 'bg-white shadow-md ring-1 ring-gray-200 scale-[1.02]'
                        : `${rowTone} hover:bg-[#DDE4EC]`
                    }`}
                  >
                    <button
                      onClick={() => handleSelectThread(t.id, !!t.isDm, userId!, t.dmUserId)}
                      className="flex-1 min-w-0 text-left"
                    >
                      <div className="flex items-center gap-3 min-w-0">
                        <img
                          src={getThreadAvatarSrc(t)}
                          alt={t.title}
                          className="w-10 h-10 rounded-full object-cover border border-gray-200 bg-gray-200 shrink-0"
                          onError={(e) => {
                            e.currentTarget.src = buildAvatarFallback(t.title || 'Bruger');
                          }}
                        />
                        <div className="min-w-0 flex-1">
                          <div className="flex items-center justify-between gap-2">
                            <span className="font-black text-[15px] text-[#131921] truncate">{t.title}</span>

                            {!!t.unreadCount && t.unreadCount > 0 && (
                              <div className="flex items-center gap-2 shrink-0">
                                <span className="relative flex h-3 w-3">
                                  <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-red-400 opacity-75"></span>
                                  <span className="relative inline-flex rounded-full h-3 w-3 bg-red-500"></span>
                                </span>
                                <span className="text-[11px] font-black text-red-600">{t.unreadCount}</span>
                              </div>
                            )}
                          </div>

                          <span className="text-[10px] text-gray-600 font-black uppercase tracking-widest">
                            {t.isDm ? 'Privat' : t.forening?.navn}
                          </span>
                        </div>
                      </div>
                    </button>

                    <button
                      onClick={(e) => {
                        e.stopPropagation();
                        void handleDeleteThreadById(t.id, !!t.isDm);
                      }}
                      className="w-9 h-9 rounded-xl flex items-center justify-center text-gray-400 hover:text-red-600 hover:bg-red-50 transition-colors shrink-0"
                      aria-label="Slet tråd"
                      title="Slet tråd"
                    >
                      <i className="fa-regular fa-trash-can"></i>
                    </button>
                  </div>
                );
              })}
            </div>
          </div>

          <div className={`flex-1 flex flex-col bg-white ${!activeThreadId ? 'hidden md:flex' : 'flex'}`}>
            {activeThreadId ? (
              <>
                <div className="p-6 border-b border-gray-100 flex items-center justify-between shadow-sm bg-white">
                  <div className="flex items-center gap-4">
                    <button
                      onClick={() => setActiveThreadId(null)}
                      className="md:hidden w-11 h-11 flex items-center justify-center bg-gray-50 rounded-2xl border"
                    >
                      <i className="fa-solid fa-arrow-left"></i>
                    </button>
                    <img
                      src={activeThreadMeta.avatar}
                      alt={activeThreadMeta.title}
                      className="w-11 h-11 rounded-full object-cover border border-gray-200 bg-gray-200"
                      onError={(e) => {
                        e.currentTarget.src = buildAvatarFallback(activeThreadMeta.title || 'Bruger');
                      }}
                    />
                    <div className="min-w-0">
                      <h3 className="font-black text-[#131921] text-xl truncate">{activeThreadMeta.title}</h3>
                      <p className="text-[11px] text-gray-500 font-black uppercase tracking-widest">
                        {activeThreadMeta.subtitle}
                      </p>
                    </div>
                  </div>
                  <div className="flex items-center gap-2">
                    <button
                      onClick={handleReport}
                      className="text-orange-600 text-[11px] font-black uppercase flex items-center gap-2 px-4 py-2 rounded-xl hover:bg-orange-50 transition-colors"
                    >
                      <i className="fa-solid fa-triangle-exclamation"></i> Anmeld
                    </button>
                    <button
                      onClick={handleDeleteThread}
                      className="text-red-600 text-[11px] font-black uppercase flex items-center gap-2 px-4 py-2 rounded-xl hover:bg-red-50 transition-colors"
                    >
                      <i className="fa-regular fa-trash-can"></i> Slet chat
                    </button>
                  </div>
                </div>

                <div ref={scrollRef} className="flex-1 overflow-y-auto p-8 space-y-8 bg-[#F9FBFC]">
                  {messages.map((msg) => {
                    const isMe = msg.user_id === userId;
                    return (
                      <div key={msg.id} className={`flex gap-4 items-end ${isMe ? 'flex-row-reverse' : 'flex-row'}`}>
                        <div className="w-10 h-10 rounded-full overflow-hidden border-2 border-white shadow-md flex-shrink-0 bg-gray-200">
                          <img
                            src={msg.users?.avatar_url || `https://ui-avatars.com/api/?name=${msg.users?.name || '?'}&background=random`}
                            alt=""
                            className="w-full h-full object-cover"
                          />
                        </div>
                        <div className={`max-w-[75%] flex flex-col ${isMe ? 'items-end' : 'items-start'}`}>
                          <div className={`flex items-end gap-2 ${isMe ? 'flex-row-reverse' : 'flex-row'}`}>
                            <div className={`rounded-2xl p-4 shadow-sm ${isMe ? 'bg-[#131921] text-white rounded-br-none' : 'bg-white text-gray-900 rounded-bl-none border border-gray-100'}`}>
                              <p className="text-[15px] leading-relaxed font-semibold whitespace-pre-wrap">
                                {formatTextWithLinks(msg.text)}
                              </p>
                            </div>
                            <button
                              onClick={() => setSelectedMessage(msg)}
                              className="w-8 h-8 rounded-full bg-white border border-gray-200 text-gray-500 hover:text-[#131921] hover:bg-gray-100 transition-colors"
                              title="Beskedmenu"
                              aria-label="Beskedmenu"
                            >
                              <i className="fa-solid fa-ellipsis"></i>
                            </button>
                          </div>
                          {renderReactionBadges(msg, isMe)}
                        </div>
                      </div>
                    );
                  })}
                </div>

                <div className="p-6 bg-white border-t border-gray-100">
                  <div className="flex gap-4 bg-gray-50 p-2 rounded-2xl border border-gray-200">
                    <input
                      value={newMessage}
                      onChange={(e) => setNewMessage(e.target.value)}
                      onKeyDown={(e) => e.key === 'Enter' && handleSend()}
                      placeholder="Skriv besked..."
                      className="flex-1 bg-transparent px-5 py-3 outline-none text-[16px] text-[#131921] font-semibold"
                    />
                    <button
                      onClick={handleSend}
                      disabled={!newMessage.trim()}
                      className="w-14 h-14 bg-[#131921] text-white rounded-xl flex items-center justify-center shadow-xl hover:bg-black transition-all active:scale-95"
                    >
                      <i className="fa-solid fa-paper-plane"></i>
                    </button>
                  </div>
                </div>
              </>
            ) : (
              <div className="flex-1 flex items-center justify-center text-gray-400 font-black uppercase tracking-[0.3em] text-xs">
                Vælg en samtale
              </div>
            )}
          </div>
        </div>
      </main>

      {selectedMessage && (
        <div
          className="fixed inset-0 z-[120] bg-black/45 flex items-end md:items-center justify-center p-4"
          onClick={() => setSelectedMessage(null)}
        >
          <div
            className="w-full max-w-md bg-[#131921] rounded-2xl border border-white/10 overflow-hidden shadow-2xl"
            onClick={(e) => e.stopPropagation()}
          >
            {isDirectMessage && selectedMessage.user_id !== userId && (
              <div className="flex items-center justify-between gap-2 px-4 py-4 border-b border-white/10">
                {QUICK_REACTIONS.map((emoji) => (
                  <button
                    key={emoji}
                    onClick={() => void handleToggleReaction(selectedMessage, emoji)}
                    className="w-11 h-11 rounded-full bg-white/10 hover:bg-white/20 transition-colors text-2xl"
                    aria-label={`Reager med ${emoji}`}
                    title={`Reager med ${emoji}`}
                  >
                    {emoji}
                  </button>
                ))}
              </div>
            )}

            <button
              onClick={() => handleOpenForward(selectedMessage)}
              className="w-full px-5 py-4 text-left text-white font-black flex items-center gap-3 hover:bg-white/10 transition-colors"
            >
              <i className="fa-solid fa-share"></i> Forward
            </button>

            {selectedMessage.user_id === userId ? (
              <button
                onClick={() => void handleDeleteMessage(selectedMessage)}
                className="w-full px-5 py-4 text-left text-red-300 font-black flex items-center gap-3 hover:bg-red-500/10 transition-colors border-t border-white/10"
              >
                <i className="fa-regular fa-trash-can"></i> Slet
              </button>
            ) : (
              <button
                onClick={() => void handleReportMessage(selectedMessage)}
                className="w-full px-5 py-4 text-left text-orange-200 font-black flex items-center gap-3 hover:bg-orange-500/10 transition-colors border-t border-white/10"
              >
                <i className="fa-solid fa-triangle-exclamation"></i> Anmeld
              </button>
            )}

            <button
              onClick={() => setSelectedMessage(null)}
              className="w-full px-5 py-4 text-center text-white/90 font-black border-t border-white/10 hover:bg-white/10 transition-colors"
            >
              Annuller
            </button>
          </div>
        </div>
      )}

      {forwardMessage && (
        <div
          className="fixed inset-0 z-[120] bg-black/45 flex items-end md:items-center justify-center p-4"
          onClick={() => {
            setForwardMessage(null);
            setForwardingToThreadId(null);
          }}
        >
          <div
            className="w-full max-w-lg bg-white rounded-2xl border border-gray-200 overflow-hidden shadow-2xl"
            onClick={(e) => e.stopPropagation()}
          >
            <div className="px-5 py-4 border-b border-gray-100">
              <h4 className="text-lg font-black text-[#131921]">Forward besked</h4>
              <p className="text-sm text-gray-500 font-semibold">Vælg hvilken samtale beskeden skal sendes til</p>
            </div>

            <div className="max-h-[55vh] overflow-y-auto p-3 space-y-2 bg-[#F8FAFC]">
              {threads.length === 0 ? (
                <p className="text-sm text-gray-500 p-3">Ingen tråde fundet.</p>
              ) : (
                threads.map((t) => (
                  <button
                    key={`forward-${t.id}`}
                    onClick={() => void handleForwardMessageToThread(t)}
                    disabled={!!forwardingToThreadId}
                    className="w-full bg-white rounded-xl border border-gray-200 px-4 py-3 flex items-center gap-3 text-left hover:bg-gray-50 disabled:opacity-60 disabled:cursor-not-allowed"
                  >
                    <img
                      src={getThreadAvatarSrc(t)}
                      alt={t.title}
                      className="w-10 h-10 rounded-full object-cover border border-gray-200 bg-gray-100 shrink-0"
                    />
                    <div className="min-w-0 flex-1">
                      <div className="font-black text-[#131921] truncate">{t.title}</div>
                      <div className="text-[11px] uppercase tracking-widest text-gray-500 font-black">
                        {t.isDm ? 'Privat' : t.forening?.navn}
                      </div>
                    </div>
                    {forwardingToThreadId === t.id ? (
                      <span className="text-xs font-black text-[#131921]">Sender...</span>
                    ) : (
                      <i className="fa-solid fa-arrow-right text-gray-400"></i>
                    )}
                  </button>
                ))
              )}
            </div>

            <div className="p-3 border-t border-gray-100">
              <button
                onClick={() => {
                  setForwardMessage(null);
                  setForwardingToThreadId(null);
                }}
                className="w-full h-11 rounded-xl bg-[#131921] text-white font-black"
              >
                Luk
              </button>
            </div>
          </div>
        </div>
      )}

      <SiteFooter />
    </div>
  );
}

export default function BeskederPage() {
  return (
    <Suspense fallback={<div>Indlæser...</div>}>
      <BeskederContent />
    </Suspense>
  );
}
