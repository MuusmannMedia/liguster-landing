'use client';

import { useState, useEffect, useRef } from 'react';
import { supabase } from '../lib/supabaseClient';
import Image from 'next/image';

// --- TYPER ---
type ThreadRow = {
  id: string;
  forening_id: string;
  title: string;
  created_at: string;
  created_by: string;
};

type MessageRow = {
  id: string;
  user_id: string;
  text: string;
  created_at: string;
  users?: {
    name?: string | null;
    username?: string | null;
    email?: string | null;
    avatar_url?: string | null;
  } | null;
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
  const [messages, setMessages] = useState<MessageRow[]>([]);
  const [newMessage, setNewMessage] = useState("");
  const [sending, setSending] = useState(false);
  
  // Cache af brugernavne til trådlisten (opretter-info)
  const [userCache, setUserCache] = useState<Record<string, string>>({});

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
      // Hent navne på oprettere vi ikke kender
      const unknownIds = [...new Set(data.map(t => t.created_by))].filter(id => !userCache[id]);
      if (unknownIds.length > 0) {
        const { data: users } = await supabase.from("users").select("id, name, username, email").in("id", unknownIds);
        if (users) {
          const newCache = { ...userCache };
          users.forEach(u => newCache[u.id] = getDisplayName(u));
          setUserCache(newCache);
        }
      }
    }
    setLoading(false);
  };

  const fetchMessages = async (threadId: string) => {
    const { data } = await supabase
      .from("forening_messages")
      .select("id, user_id, text, created_at, users:users (name, username, email, avatar_url)")
      .eq("thread_id", threadId)
      .order("created_at", { ascending: true });
    
    if (data) setMessages(data as any);
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
      // Opdater cache for current user hvis nødvendigt
      if (!userCache[userId]) {
         const { data: me } = await supabase.auth.getUser(); 
      }
    } else {
      // HER VAR FEJLEN: Vi bruger nu error?.message || 'Ukendt fejl'
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
    fetchMessages(t.id);
  };

  const sendMessage = async () => {
    if (!activeThread || !userId || !newMessage.trim()) return;
    setSending(true);
    const { data, error } = await supabase
      .from("forening_messages")
      .insert([{ thread_id: activeThread.id, user_id: userId, text: newMessage.trim() }])
      .select("*, users:users (name, username, email, avatar_url)")
      .single();
    
    if (!error && data) {
      setMessages(prev => [...prev, data as any]);
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
            className="flex-1 bg-gray-50 border border-gray-200 rounded-xl px-4 py-2 outline-none focus:ring-2 focus:ring-[#131921]"
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
      <div className="space-y-3">
        {threads.length === 0 && <p className="text-center text-gray-400 py-10">Ingen tråde endnu.</p>}
        
        {threads.map(t => (
          <div key={t.id} className="bg-white p-4 rounded-xl border border-gray-100 hover:shadow-md transition-shadow flex justify-between items-center cursor-pointer" onClick={() => openThread(t)}>
            <div>
              <h3 className="font-bold text-[#131921] text-lg">{t.title}</h3>
              <p className="text-xs text-gray-500 mt-1">
                Oprettet af {userCache[t.created_by] || '...'} · {new Date(t.created_at).toLocaleDateString()}
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

      {/* CHAT MODAL */}
      {activeThread && (
        <div className="fixed inset-0 z-[200] flex items-center justify-center p-4 bg-black/60 backdrop-blur-sm">
          <div className="bg-white w-full max-w-2xl h-[80vh] rounded-2xl shadow-2xl overflow-hidden flex flex-col">
            
            {/* Header */}
            <div className="bg-[#131921] px-6 py-4 flex justify-between items-center shrink-0">
              <h2 className="text-white font-bold text-lg truncate pr-4">{activeThread.title}</h2>
              <button onClick={() => setActiveThread(null)} className="text-white/70 hover:text-white text-2xl leading-none">&times;</button>
            </div>

            {/* Beskeder */}
            <div className="flex-1 overflow-y-auto p-4 space-y-4 bg-gray-50">
              {messages.length === 0 && <p className="text-center text-gray-400 mt-10">Ingen beskeder endnu.</p>}
              
              {messages.map(msg => {
                const isMe = msg.user_id === userId;
                return (
                  <div key={msg.id} className={`flex gap-3 ${isMe ? 'flex-row-reverse' : ''}`}>
                    <div className="w-8 h-8 rounded-full bg-gray-200 overflow-hidden shrink-0 mt-1">
                      {msg.users?.avatar_url ? <img src={msg.users.avatar_url} className="w-full h-full object-cover" /> : null}
                    </div>
                    
                    <div className={`max-w-[80%] rounded-2xl p-3 shadow-sm relative group ${isMe ? 'bg-[#131921] text-white rounded-tr-none' : 'bg-white text-gray-800 rounded-tl-none border border-gray-100'}`}>
                      <p className={`text-[10px] font-bold mb-1 opacity-70 ${isMe ? 'text-gray-300' : 'text-[#254890]'}`}>
                        {getDisplayName(msg.users)}
                      </p>
                      <p className="text-sm leading-relaxed whitespace-pre-wrap">{msg.text}</p>
                      <p className={`text-[9px] mt-1 text-right opacity-50 ${isMe ? 'text-white' : 'text-gray-500'}`}>
                        {new Date(msg.created_at).toLocaleTimeString([], {hour: '2-digit', minute:'2-digit'})}
                      </p>

                      {/* Slet knap (hover) */}
                      {(isUserAdmin || isMe) && (
                        <button 
                          onClick={() => deleteMessage(msg.id)}
                          className="absolute -top-2 -right-2 w-5 h-5 bg-red-500 text-white rounded-full text-xs flex items-center justify-center opacity-0 group-hover:opacity-100 transition-opacity shadow-sm"
                        >
                          &times;
                        </button>
                      )}
                    </div>
                  </div>
                );
              })}
            </div>

            {/* Input felt */}
            {isMember ? (
              <div className="p-4 bg-white border-t border-gray-100 flex gap-3 shrink-0">
                <input 
                  value={newMessage}
                  onChange={e => setNewMessage(e.target.value)}
                  onKeyDown={e => e.key === 'Enter' && sendMessage()}
                  placeholder="Skriv en besked..."
                  className="flex-1 bg-gray-50 border border-gray-200 rounded-full px-5 py-3 outline-none focus:ring-2 focus:ring-[#131921]"
                />
                <button 
                  onClick={sendMessage} 
                  disabled={sending || !newMessage.trim()}
                  className="w-12 h-12 rounded-full bg-[#131921] text-white flex items-center justify-center hover:bg-gray-900 disabled:opacity-50 transition-colors"
                >
                  <i className="fa-solid fa-paper-plane text-sm"></i>
                </button>
              </div>
            ) : (
              <div className="p-4 bg-gray-100 text-center text-xs text-gray-500 font-bold uppercase tracking-wider">
                Kun medlemmer kan skrive her
              </div>
            )}

          </div>
        </div>
      )}
    </div>
  );
}