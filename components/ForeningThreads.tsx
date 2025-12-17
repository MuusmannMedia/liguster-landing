'use client';

import { useState, useEffect, useRef } from 'react';
import { supabase } from '../lib/supabaseClient';

// --- TYPER ---
type ThreadRow = {
  id: string;
  forening_id: string;
  title: string;
  created_at: string;
  created_by: string;
};

// Vi definerer UI-beskeden separat for at håndtere bruger-info manuelt
type UiMessage = {
  id: string;
  user_id: string;
  text: string;
  created_at: string;
  user: {
    name?: string | null;
    email?: string | null;
    avatar_url?: string | null;
  };
};

type Props = {
  foreningId: string;
  userId: string | null;
  isUserAdmin: boolean;
  isMember: boolean;
};

// --- HJÆLPERE ---
const getDisplayName = (user: any) => {
  const n = user?.name?.trim() || user?.username?.trim();
  if (n) return n;
  const email = user?.email || "";
  return email.includes("@") ? email.split("@")[0] : "Ukendt";
};

export default function ForeningThreads({ foreningId, userId, isUserAdmin, isMember }: Props) {
  const [loading, setLoading] = useState(true);
  const [threads, setThreads] = useState<ThreadRow[]>([]);
  const [newThreadTitle, setNewThreadTitle] = useState("");
  const [creating, setCreating] = useState(false);

  // Modal / Chat State
  const [activeThread, setActiveThread] = useState<ThreadRow | null>(null);
  const [messages, setMessages] = useState<UiMessage[]>([]);
  const [newMessage, setNewMessage] = useState("");
  const [sending, setSending] = useState(false);
  
  // Cache til brugernavne (så vi slipper for joins der kan fejle)
  const [userCache, setUserCache] = useState<Record<string, any>>({});

  useEffect(() => {
    fetchThreads();
  }, [foreningId]);

  const fetchThreads = async () => {
    setLoading(true);
    const { data } = await supabase
      .from("forening_threads")
      .select("*")
      .eq("forening_id", foreningId)
      .order("created_at", { ascending: false });
    
    if (data) {
      setThreads(data);
      // Hent navne på tråd-oprettere
      resolveUserNames(data.map(t => t.created_by));
    }
    setLoading(false);
  };

  // Robust funktion til at hente beskeder og derefter brugere (Ligesom i appen)
  const fetchMessages = async (threadId: string) => {
    // 1. Hent rå beskeder
    const { data: rawMsgs, error } = await supabase
      .from("forening_messages")
      .select("id, user_id, text, created_at")
      .eq("thread_id", threadId)
      .order("created_at", { ascending: true });
    
    if (error || !rawMsgs) {
      console.error("Fejl ved hentning af beskeder:", error);
      setMessages([]);
      return;
    }

    // 2. Find unikke bruger-ID'er vi mangler info på
    const userIds = [...new Set(rawMsgs.map(m => m.user_id))];
    await resolveUserNames(userIds);

    // 3. Sammensæt beskeder med brugerdata fra cachen
    const uiMsgs: UiMessage[] = rawMsgs.map(m => {
      // Vi henter fra cachen. Hvis brugeren ikke er loadet endnu, viser vi midlertidig info.
      // (State opdatering er async, så vi stoler på at resolveUserNames trigger en re-render)
      return {
        ...m,
        user: userCache[m.user_id] || { name: '...', email: '' }
      };
    });

    setMessages(uiMsgs);
  };

  // Hjælper til at hente brugere og gemme i cache
  const resolveUserNames = async (ids: string[]) => {
    // Filtrer ID'er vi allerede kender fra
    const missing = ids.filter(id => !userCache[id]);
    if (missing.length === 0) return;

    const { data: users } = await supabase
      .from("users")
      .select("id, name, username, email, avatar_url")
      .in("id", missing);

    if (users) {
      setUserCache(prev => {
        const next = { ...prev };
        users.forEach(u => { next[u.id] = u; });
        return next;
      });
      
      // Hvis chatten er åben, opdater beskederne med de nye navne
      setMessages(prev => prev.map(msg => ({
        ...msg,
        user: users.find(u => u.id === msg.user_id) || msg.user
      })));
    }
  };

  const createThread = async () => {
    if (!newThreadTitle.trim() || !userId) return;
    setCreating(true);
    const { data, error } = await supabase
      .from("forening_threads")
      .insert([{ forening_id: foreningId, title: newThreadTitle.trim(), created_by: userId }])
      .select()
      .single();
    
    if (!error && data) {
      setThreads(prev => [data, ...prev]);
      setNewThreadTitle("");
    } else {
      alert("Fejl: " + (error?.message || "Kunne ikke oprette tråd"));
    }
    setCreating(false);
  };

  const deleteThread = async (t: ThreadRow) => {
    if (!confirm("Vil du slette denne tråd og alle beskeder?")) return;
    const { error } = await supabase.from("forening_threads").delete().eq("id", t.id);
    if (!error) {
      setThreads(prev => prev.filter(x => x.id !== t.id));
      if (activeThread?.id === t.id) setActiveThread(null);
    }
  };

  const openThread = (t: ThreadRow) => {
    setActiveThread(t);
    setMessages([]); // Tøm mens vi loader for at undgå at vise gamle beskeder
    fetchMessages(t.id);
  };

  const sendMessage = async () => {
    if (!activeThread || !userId || !newMessage.trim()) return;
    setSending(true);
    const text = newMessage.trim();
    
    const { data, error } = await supabase
      .from("forening_messages")
      .insert([{ thread_id: activeThread.id, user_id: userId, text }])
      .select()
      .single();
    
    if (!error && data) {
      // Tilføj beskeden med det samme (optimistisk opdatering)
      const myUserData = userCache[userId] || { name: 'Mig', email: '' };
      const newMsg: UiMessage = {
        id: data.id,
        user_id: userId,
        text: data.text,
        created_at: data.created_at,
        user: myUserData
      };
      setMessages(prev => [...prev, newMsg]);
      setNewMessage("");
    }
    setSending(false);
  };

  const deleteMessage = async (msgId: string) => {
    if (!confirm("Slet besked?")) return;
    const { error } = await supabase.from("forening_messages").delete().eq("id", msgId);
    if (!error) setMessages(prev => prev.filter(m => m.id !== msgId));
  };

  if (loading) return <div className="text-center py-10 text-gray-400">Henter debatter...</div>;

  return (
    <div>
      {/* OPRET TRÅD */}
      {isMember && (
        <div className="bg-white p-4 rounded-xl border border-gray-100 shadow-sm mb-6 flex gap-3">
          <input 
            value={newThreadTitle}
            onChange={e => setNewThreadTitle(e.target.value)}
            onKeyDown={e => e.key === 'Enter' && createThread()}
            placeholder="Ny tråd - skriv en overskrift..."
            className="flex-1 bg-gray-50 border border-gray-200 rounded-xl px-4 py-2 outline-none focus:ring-2 focus:ring-[#131921] text-[#131921]"
          />
          <button 
            onClick={createThread} 
            disabled={creating || !newThreadTitle.trim()}
            className="bg-[#131921] text-white px-5 py-2 rounded-xl font-bold hover:bg-gray-900 disabled:opacity-50"
          >
            {creating ? "..." : "Opret"}
          </button>
        </div>
      )}

      {/* TRÅD LISTE */}
      <div className="space-y-3 pb-20">
        {threads.length === 0 && <p className="text-center text-gray-400 py-10">Ingen tråde endnu.</p>}
        
        {threads.map(t => (
          <div key={t.id} className="bg-white p-4 rounded-xl border border-gray-100 hover:shadow-md transition-shadow flex justify-between items-center cursor-pointer" onClick={() => openThread(t)}>
            <div>
              <h3 className="font-bold text-[#131921] text-lg">{t.title}</h3>
              <p className="text-xs text-gray-500 mt-1">
                Oprettet af {userCache[t.created_by] ? getDisplayName(userCache[t.created_by]) : '...'} · {new Date(t.created_at).toLocaleDateString()}
              </p>
            </div>
            
            {(isUserAdmin || t.created_by === userId) && (
              <button 
                onClick={(e) => { e.stopPropagation(); deleteThread(t); }}
                className="w-8 h-8 flex items-center justify-center rounded-full hover:bg-red-50 text-gray-300 hover:text-red-500 transition-colors"
              >
                <i className="fa-solid fa-trash-can"></i>
              </button>
            )}
          </div>
        ))}
      </div>

      {/* CHAT MODAL (SAMME DESIGN SOM APP) */}
      {activeThread && (
        <div className="fixed inset-0 z-[200] flex items-center justify-center p-4 bg-black/60 backdrop-blur-sm animate-in fade-in duration-200">
          <div className="bg-white w-full max-w-2xl h-[80vh] rounded-2xl shadow-2xl overflow-hidden flex flex-col relative">
            
            {/* Header */}
            <div className="bg-white px-6 py-4 flex justify-between items-center shrink-0 border-b border-gray-100">
              <h2 className="text-[#131921] font-black text-xl truncate pr-4">{activeThread.title}</h2>
              <button onClick={() => setActiveThread(null)} className="bg-[#131921] text-white rounded-xl px-3 py-1 font-bold text-sm hover:bg-gray-900 transition-colors">Luk</button>
            </div>

            {/* Beskeder */}
            <div className="flex-1 overflow-y-auto p-4 space-y-4 bg-white">
              {messages.length === 0 && <p className="text-center text-gray-400 mt-10">Ingen beskeder endnu.</p>}
              
              {messages.map(msg => {
                // Tjek om det er mig, for evt. styling (valgfrit - appen har dem alle til venstre, men vi kan gøre dem lidt forskellige hvis ønsket)
                const isMe = msg.user_id === userId;
                
                return (
                  <div key={msg.id} className="flex gap-3 py-2 border-b border-gray-50 last:border-0 group relative">
                    {/* Avatar */}
                    <div className="w-8 h-8 rounded-full bg-gray-100 overflow-hidden shrink-0 mt-1 flex items-center justify-center font-bold text-gray-400 border border-gray-100">
                      {msg.user?.avatar_url ? (
                        <img src={msg.user.avatar_url} className="w-full h-full object-cover" />
                      ) : (
                        <span>?</span>
                      )}
                    </div>
                    
                    <div className="flex-1">
                      <div className="flex items-baseline gap-2">
                        <p className="text-xs font-black text-[#223]">
                          {getDisplayName(msg.user)}
                        </p>
                        <span className="text-[10px] text-gray-400">
                          {new Date(msg.created_at).toLocaleTimeString([], {hour: '2-digit', minute:'2-digit'})}
                        </span>
                      </div>
                      <p className="text-sm text-[#111] mt-1 leading-relaxed whitespace-pre-wrap">{msg.text}</p>
                    </div>

                    {/* Slet knap (hover) */}
                    {(isUserAdmin || isMe) && (
                      <button 
                        onClick={() => deleteMessage(msg.id)}
                        className="absolute top-2 right-2 text-gray-300 hover:text-red-500 text-xs opacity-0 group-hover:opacity-100 transition-opacity"
                        title="Slet besked"
                      >
                        <i className="fa-solid fa-trash"></i>
                      </button>
                    )}
                  </div>
                );
              })}
            </div>

            {/* Input felt */}
            {isMember ? (
              <div className="p-3 border-t border-gray-100 flex gap-2 shrink-0 bg-white">
                <input 
                  value={newMessage}
                  onChange={e => setNewMessage(e.target.value)}
                  onKeyDown={e => e.key === 'Enter' && sendMessage()}
                  placeholder="Skriv en besked..."
                  className="flex-1 bg-[#F4F6F8] rounded-xl px-4 py-3 outline-none text-black placeholder-gray-400 font-medium"
                />
                <button 
                  onClick={sendMessage} 
                  disabled={sending || !newMessage.trim()}
                  className="bg-[#131921] text-white px-5 rounded-xl font-black hover:bg-gray-900 disabled:opacity-50 transition-colors"
                >
                  {sending ? '...' : 'Send'}
                </button>
              </div>
            ) : (
              <div className="p-4 bg-gray-50 text-center text-xs text-gray-500 font-bold uppercase tracking-wider">
                Kun medlemmer kan skrive her
              </div>
            )}

          </div>
        </div>
      )}
    </div>
  );
}