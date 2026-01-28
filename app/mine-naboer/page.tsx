'use client';

import { useState, useEffect, useRef } from 'react';
import { useRouter } from 'next/navigation';
import { supabase } from '../../lib/supabaseClient'; // Ret stien hvis nødvendigt
import SiteHeader from '../../components/SiteHeader';
import SiteFooter from '../../components/SiteFooter';

// --- TYPER ---
type NeighborItem = {
  id: string;             
  status: string;         
  isIncoming: boolean;    
  user: {                 
    id: string;
    name: string | null;
    username: string | null;
    avatar_url: string | null;
  };
};

// Hjælper til ID-generering
const makeUuid = () => {
  return 'xxxxxxxx-xxxx-4xxx-yxxx-xxxxxxxxxxxx'.replace(/[xy]/g, (c) => {
    const r = (Math.random() * 16) | 0;
    const v = c === 'x' ? r : (r & 0x3) | 0x8;
    return v.toString(16);
  });
};

export default function MineNaboerPage() {
  const router = useRouter();
  
  // State
  const [currentUserId, setCurrentUserId] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);
  
  const [requests, setRequests] = useState<NeighborItem[]>([]); 
  const [friends, setFriends] = useState<NeighborItem[]>([]); 

  // Invite Modal State
  const [isInviteModalOpen, setIsInviteModalOpen] = useState(false);
  const [searchQuery, setSearchQuery] = useState('');
  const [searchResults, setSearchResults] = useState<any[]>([]);
  const [inviteMessage, setInviteMessage] = useState('');
  const [isInviting, setIsInviting] = useState(false);

  // --- 1. INITIAL LOAD & AUTH ---
  useEffect(() => {
    const checkUser = async () => {
      const { data: { session } } = await supabase.auth.getSession();
      if (!session) {
        router.replace('/login');
        return;
      }
      setCurrentUserId(session.user.id);
    };
    checkUser();
  }, [router]);

  // --- 2. DATA FETCHING & REALTIME ---
  useEffect(() => {
    if (!currentUserId) return;

    fetchData();

    // Realtime subscription
    const channel = supabase
      .channel('public:neighbors')
      .on(
        'postgres_changes',
        { event: '*', schema: 'public', table: 'neighbors' },
        () => {
          console.log('⚡️ Realtime update - henter nye data...');
          fetchData();
        }
      )
      .subscribe();

    return () => {
      supabase.removeChannel(channel);
    };
  }, [currentUserId]);

  const fetchData = async () => {
    if (!currentUserId) return;
    try {
      // A) Hent relationer
      const { data: rows, error } = await supabase
        .from('neighbors')
        .select('*')
        .or(`requester_id.eq.${currentUserId},receiver_id.eq.${currentUserId}`);

      if (error) throw error;

      // B) Find de andres ID'er
      const otherUserIds = new Set<string>();
      rows?.forEach((r) => {
        const otherId = r.requester_id === currentUserId ? r.receiver_id : r.requester_id;
        otherUserIds.add(otherId);
      });

      // C) Hent brugerdata
      let usersMap: Record<string, any> = {};
      if (otherUserIds.size > 0) {
        const { data: users } = await supabase
          .from('users')
          .select('id, name, username, avatar_url')
          .in('id', Array.from(otherUserIds));
        
        users?.forEach((u) => (usersMap[u.id] = u));
      }

      // D) Sortering
      const newRequests: NeighborItem[] = [];
      const newFriends: NeighborItem[] = [];

      rows?.forEach((r) => {
        const otherId = r.requester_id === currentUserId ? r.receiver_id : r.requester_id;
        
        const otherUser = usersMap[otherId] || {
            id: otherId,
            name: "Ukendt Bruger",
            username: "",
            avatar_url: null
        };

        const item: NeighborItem = {
          id: r.id,
          status: r.status,
          isIncoming: r.receiver_id === currentUserId,
          user: otherUser,
        };

        if (r.status === 'accepted') {
          newFriends.push(item);
        } else if (r.status === 'pending') {
          if (item.isIncoming) {
            newRequests.push(item);
          }
        }
      });

      setRequests(newRequests);
      setFriends(newFriends);
      setLoading(false);

    } catch (error) {
      console.error('Fejl ved hentning:', error);
      setLoading(false);
    }
  };

  // --- 3. ACTIONS (Accept/Decline) ---
  const handleAccept = async (item: NeighborItem) => {
    try {
      const { error } = await supabase
        .from('neighbors')
        .update({ status: 'accepted' })
        .eq('id', item.id);

      if (error) throw error;

      // Send bekræftelse i chat
      const threadId = makeUuid();
      await supabase.from('messages').insert({
        thread_id: threadId,
        sender_id: currentUserId,
        receiver_id: item.user.id,
        text: "Fantastisk! Jeg har accepteret din anmodning. Vi er nu forbundet. 👋",
        is_read: false
      });

      // fetchData kaldes via realtime
    } catch (err) {
      console.error(err);
      alert('Der opstod en fejl.');
    }
  };

  const handleDeclineOrRemove = async (item: NeighborItem, confirmMessage?: string) => {
    if (confirmMessage && !window.confirm(confirmMessage)) return;

    try {
      const { error } = await supabase
        .from('neighbors')
        .delete()
        .eq('id', item.id);

      if (error) throw error;
    } catch (err) {
      console.error(err);
      alert('Der opstod en fejl.');
    }
  };

  // --- 4. INVITE LOGIK ---
  // Søg mens man taster (Debounce effekt via useEffect)
  useEffect(() => {
    const timer = setTimeout(async () => {
      if (searchQuery.length < 2) {
        setSearchResults([]);
        return;
      }

      const { data } = await supabase
        .from('users')
        .select('id, name, username, avatar_url')
        .ilike('name', `%${searchQuery}%`)
        .limit(5);

      // Filtrer eksisterende fra
      const knownIds = new Set([currentUserId, ...friends.map(f=>f.user.id), ...requests.map(r=>r.user.id)]);
      const filtered = (data || []).filter((u:any) => !knownIds.has(u.id));
      setSearchResults(filtered);
    }, 500);

    return () => clearTimeout(timer);
  }, [searchQuery, friends, requests, currentUserId]);

  const sendInvite = async (targetId: string) => {
    if (isInviting || !currentUserId) return;
    setIsInviting(true);

    try {
      // Opret relation
      const { error: dbErr } = await supabase.from('neighbors').insert({
        requester_id: currentUserId,
        receiver_id: targetId,
        status: 'pending'
      });

      if (dbErr) {
        if (dbErr.code === '23505') alert('Allerede inviteret.');
        else throw dbErr;
      }

      // Send besked
      const threadId = makeUuid();
      const msg = inviteMessage.trim() || "Hej! Jeg har sendt dig en anmodning under 'Mine Naboer'.";
      
      await supabase.from('messages').insert({
        thread_id: threadId,
        sender_id: currentUserId,
        receiver_id: targetId,
        text: msg,
        is_read: false
      });

      alert('Invitation sendt!');
      setIsInviteModalOpen(false);
      setSearchQuery('');
      setInviteMessage('');
      setSearchResults([]);
    } catch (err: any) {
      console.error(err);
      alert('Fejl: ' + err.message);
    } finally {
      setIsInviting(false);
    }
  };

  // --- RENDER ---
  if (loading) {
    return (
      <div className="min-h-screen bg-[#869FB9] flex flex-col items-center justify-center">
        <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-[#131921]"></div>
      </div>
    );
  }

  return (
    <div className="min-h-screen flex flex-col bg-[#f0f2f5]">
      <SiteHeader />

      {/* TOP BAR / ACTION AREA */}
      <div className="bg-[#869FB9] py-8 px-4 shadow-sm">
        <div className="max-w-4xl mx-auto">
          {/* Tekst fjernet - kun knap tilbage, justeret til højre */}
          <div className="flex flex-col md:flex-row justify-end items-center gap-4">
            
            <button 
              onClick={() => setIsInviteModalOpen(true)}
              className="bg-[#131921] text-white font-bold py-3 px-8 rounded-full shadow-lg hover:bg-gray-900 transition-all uppercase tracking-wider flex items-center gap-2 transform hover:scale-105"
            >
              <i className="fa-solid fa-user-plus"></i> Inviter nabo
            </button>
          </div>
        </div>
      </div>

      <main className="flex-1 max-w-4xl mx-auto px-4 py-8 w-full space-y-8">
        
        {/* --- ANMODNINGER --- */}
        {requests.length > 0 && (
          <section>
            <h2 className="text-xl font-bold text-[#131921] mb-4 flex items-center gap-2">
              <i className="fa-solid fa-bell text-[#131921]"></i> 
              Anmodninger <span className="bg-red-500 text-white text-xs px-2 py-0.5 rounded-full">{requests.length}</span>
            </h2>
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              {requests.map(req => (
                <div key={req.id} className="bg-white p-4 rounded-2xl shadow-sm border border-orange-100 flex items-center justify-between">
                  <div className="flex items-center gap-3">
                    <img 
                      src={req.user.avatar_url || "https://placehold.co/100"} 
                      alt={req.user.name || "User"} 
                      className="w-12 h-12 rounded-full bg-gray-100 object-cover"
                    />
                    <div>
                      <p className="font-bold text-[#131921]">{req.user.name}</p>
                      <p className="text-xs text-gray-500">Vil gerne være din nabo</p>
                    </div>
                  </div>
                  <div className="flex gap-2">
                    <button 
                      onClick={() => handleDeclineOrRemove(req)}
                      className="bg-red-50 text-red-600 p-2 rounded-full hover:bg-red-100 transition-colors"
                      title="Afvis"
                    >
                      <i className="fa-solid fa-xmark"></i>
                    </button>
                    <button 
                      onClick={() => handleAccept(req)}
                      className="bg-green-50 text-green-600 p-2 rounded-full hover:bg-green-100 transition-colors"
                      title="Accepter"
                    >
                      <i className="fa-solid fa-check"></i>
                    </button>
                  </div>
                </div>
              ))}
            </div>
          </section>
        )}

        {/* --- VENNER --- */}
        <section>
          <h2 className="text-xl font-bold text-[#131921] mb-4">Mine Naboer</h2>
          
          {friends.length === 0 ? (
            <div className="bg-white rounded-2xl p-8 text-center border border-gray-100 shadow-sm">
              <i className="fa-solid fa-users text-4xl text-gray-300 mb-3"></i>
              <p className="text-gray-500 font-medium">Du har ingen naboer endnu.</p>
              <p className="text-sm text-gray-400 mt-1">Inviter nogen for at komme i gang!</p>
            </div>
          ) : (
            <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 gap-4">
              {friends.map(friend => (
                <div key={friend.id} className="bg-white p-5 rounded-2xl shadow-sm hover:shadow-md transition-shadow border border-gray-100 flex flex-col items-center text-center">
                  <div className="relative mb-3">
                    <img 
                      src={friend.user.avatar_url || "https://placehold.co/200"} 
                      alt={friend.user.name || "User"} 
                      className="w-20 h-20 rounded-full bg-gray-100 object-cover border-4 border-white shadow-sm"
                    />
                    <div className="absolute bottom-0 right-0 w-5 h-5 bg-green-500 border-2 border-white rounded-full"></div>
                  </div>
                  
                  <h3 className="font-bold text-lg text-[#131921] mb-1">{friend.user.name}</h3>
                  <p className="text-xs text-gray-400 mb-4">{friend.user.username ? `@${friend.user.username}` : 'Nabo'}</p>
                  
                  <div className="flex w-full gap-2 mt-auto">
                    <button 
                      onClick={() => router.push(`/beskeder?chatWith=${friend.user.id}`)}
                      className="flex-1 bg-[#131921] text-white text-xs font-bold py-2 rounded-lg hover:bg-gray-800 transition-colors"
                    >
                      Chat
                    </button>
                    <button 
                      onClick={() => handleDeclineOrRemove(friend, `Er du sikker på, at du vil fjerne ${friend.user.name} fra dine naboer?`)}
                      className="px-3 bg-gray-50 text-gray-400 hover:text-red-500 hover:bg-red-50 rounded-lg transition-colors"
                      title="Fjern nabo"
                    >
                      <i className="fa-solid fa-trash-can"></i>
                    </button>
                  </div>
                </div>
              ))}
            </div>
          )}
        </section>

      </main>

      <SiteFooter />

      {/* --- INVITE MODAL --- */}
      {isInviteModalOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/60 backdrop-blur-sm animate-in fade-in duration-200">
          <div className="bg-white w-full max-w-md rounded-3xl p-6 shadow-2xl flex flex-col animate-in zoom-in-95 duration-200">
            
            <div className="flex justify-between items-center mb-6">
              <h3 className="text-xl font-bold text-[#131921]">Inviter nabo</h3>
              <button onClick={() => setIsInviteModalOpen(false)} className="text-gray-400 hover:text-gray-600">
                <i className="fa-solid fa-xmark text-2xl"></i>
              </button>
            </div>

            <div className="space-y-4">
              <div className="relative">
                <i className="fa-solid fa-magnifying-glass absolute left-4 top-3.5 text-gray-400"></i>
                <input 
                  type="text" 
                  placeholder="Søg på navn..." 
                  className="w-full bg-gray-50 rounded-xl pl-10 pr-4 py-3 outline-none focus:ring-2 focus:ring-[#131921] transition-all text-gray-900 placeholder-gray-400"
                  value={searchQuery}
                  onChange={(e) => setSearchQuery(e.target.value)}
                />
              </div>

              <textarea 
                placeholder="Skriv en besked (valgfri)" 
                className="w-full bg-gray-50 rounded-xl p-4 outline-none focus:ring-2 focus:ring-[#131921] min-h-[80px] resize-none transition-all text-gray-900 placeholder-gray-400"
                value={inviteMessage}
                onChange={(e) => setInviteMessage(e.target.value)}
              />

              {/* SEARCH RESULTS */}
              <div className="min-h-[150px] max-h-[250px] overflow-y-auto border-t border-gray-100 pt-2">
                {searchQuery.length < 2 ? (
                  <p className="text-center text-gray-400 text-sm mt-8">Indtast navn for at søge...</p>
                ) : searchResults.length === 0 ? (
                  <p className="text-center text-gray-400 text-sm mt-8">Ingen brugere fundet.</p>
                ) : (
                  <div className="space-y-2">
                    {searchResults.map(user => (
                      <div key={user.id} className="flex items-center justify-between p-2 hover:bg-gray-50 rounded-xl transition-colors">
                        <div className="flex items-center gap-3">
                          <img 
                            src={user.avatar_url || "https://placehold.co/50"} 
                            className="w-10 h-10 rounded-full bg-gray-200" 
                            alt={user.name}
                          />
                          <div>
                            <p className="font-bold text-sm text-[#131921]">{user.name}</p>
                            <p className="text-xs text-gray-500">{user.username ? `@${user.username}` : ''}</p>
                          </div>
                        </div>
                        <button 
                          onClick={() => sendInvite(user.id)}
                          disabled={isInviting}
                          className="bg-[#131921] text-white text-xs font-bold px-4 py-2 rounded-lg hover:bg-gray-800 disabled:opacity-50"
                        >
                          Inviter
                        </button>
                      </div>
                    ))}
                  </div>
                )}
              </div>
            </div>

          </div>
        </div>
      )}

    </div>
  );
}