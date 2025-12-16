'use client';

import { useState, useEffect } from 'react';
import { useRouter } from 'next/navigation';
import { supabase } from '../../lib/supabaseClient';
import SiteHeader from '../../components/SiteHeader';
import SiteFooter from '../../components/SiteFooter';
import CreatePostModal from '../../components/CreatePostModal';
import PostDetailModal from '../../components/PostDetailModal';

// Type definition
type Post = {
  id: string;
  created_at: string;
  overskrift: string;
  text: string;
  image_url?: string;
  images?: string[];
  kategori?: string;
  omraade?: string;
  user_id: string;
};

// Data konstanter
const KATEGORIER = [
  'Værktøj', 'Arbejde tilbydes', 'Affald', 'Mindre ting', 
  'Større ting', 'Hjælp søges', 'Hjælp tilbydes', 
  'Byttes', 'Udlejning', 'Sælges', 'Andet'
];

const RADIUS_OPTIONS = [1, 2, 3, 5, 10, 20, 50];

export default function OpslagPage() {
  const router = useRouter();
  const [posts, setPosts] = useState<Post[]>([]);
  const [loading, setLoading] = useState(true);
  
  // Filter States
  const [searchQuery, setSearchQuery] = useState('');
  const [radius, setRadius] = useState(50); // Standard 50 km
  const [selectedCategory, setSelectedCategory] = useState<string | null>(null);
  const [isCategoryMenuOpen, setIsCategoryMenuOpen] = useState(false);
  const [isRadiusMenuOpen, setIsRadiusMenuOpen] = useState(false); // <--- NY STATE

  // Modal States
  const [isCreateModalOpen, setIsCreateModalOpen] = useState(false);
  const [selectedPost, setSelectedPost] = useState<Post | null>(null);
  const [currentUserId, setCurrentUserId] = useState<string | null>(null);

  // SIKKERHEDSTJEK & DATA HENTNING
  useEffect(() => {
    const checkUserAndFetch = async () => {
      setLoading(true);
      const { data: { session } } = await supabase.auth.getSession();
      
      if (!session) {
        router.replace('/login');
        return; 
      }
      
      setCurrentUserId(session.user.id);
      await fetchPosts();
    };
    checkUserAndFetch();
  }, [router]);

  const fetchPosts = async () => {
    try {
      const { data, error } = await supabase
        .from('posts')
        .select('*')
        .order('created_at', { ascending: false });

      if (error) throw error;
      setPosts(data || []);
    } catch (error) {
      console.error('Fejl ved hentning af opslag:', error);
    } finally {
      setLoading(false);
    }
  };

  // --- LOGIK: FILTRERING ---
  const filteredPosts = posts.filter((post) => {
    // 1. Søgning
    const matchesSearch = 
      searchQuery === '' ||
      post.overskrift.toLowerCase().includes(searchQuery.toLowerCase()) ||
      post.text.toLowerCase().includes(searchQuery.toLowerCase());

    // 2. Kategori filter
    const matchesCategory = 
      selectedCategory === null || 
      post.kategori === selectedCategory;

    // (Note: Radius filtrering kræver geolokation på opslagene i databasen, 
    // så indtil videre er det kun en visuel indstilling)

    return matchesSearch && matchesCategory;
  });

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

      {/* Filter Bar og Knapper */}
      <div className="bg-[#869FB9] py-6 px-4 shadow-sm relative z-10">
        <div className="max-w-4xl mx-auto space-y-4">
          
          <button 
            className="w-full bg-[#131921] text-white font-bold text-lg py-4 rounded-2xl shadow-lg hover:bg-gray-900 transition-all uppercase tracking-wider flex items-center justify-center gap-2 transform hover:scale-[1.01]"
            onClick={() => setIsCreateModalOpen(true)}
          >
            <i className="fa-solid fa-plus-circle text-2xl"></i> Opret nyt opslag
          </button>

          {/* Filter Bar Container */}
          <div className="flex items-center gap-2 bg-white/20 p-2 rounded-2xl backdrop-blur-sm relative">
            
            {/* Søgefelt */}
            <div className="flex-1 relative">
              <i className="fa-solid fa-magnifying-glass absolute left-4 top-1/2 transform -translate-y-1/2 text-gray-500"></i>
              <input
                type="text"
                placeholder="Søg i opslag..."
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                className="w-full bg-white rounded-xl pl-10 pr-4 py-3 text-gray-900 outline-none shadow-sm focus:ring-2 focus:ring-[#131921]"
              />
            </div>

            {/* Kategori Knap */}
            <div className="relative">
              <button 
                onClick={() => setIsCategoryMenuOpen(!isCategoryMenuOpen)}
                className={`w-12 h-12 rounded-xl flex items-center justify-center shadow-sm transition-colors ${
                  selectedCategory 
                    ? 'bg-[#131921] text-white' 
                    : 'bg-white text-[#131921] hover:bg-gray-50' 
                }`}
              >
                <i className="fa-solid fa-filter"></i>
              </button>

              {isCategoryMenuOpen && (
                <>
                  <div className="fixed inset-0 z-10" onClick={() => setIsCategoryMenuOpen(false)}/>
                  <div className="absolute top-full right-0 mt-2 w-64 bg-white rounded-xl shadow-xl z-20 overflow-hidden border border-gray-100 py-2">
                    <button
                      onClick={() => { setSelectedCategory(null); setIsCategoryMenuOpen(false); }}
                      className={`w-full text-left px-4 py-3 text-sm font-bold hover:bg-gray-50 ${!selectedCategory ? 'text-[#131921] bg-gray-50' : 'text-gray-600'}`}
                    >
                      Alle kategorier
                    </button>
                    <div className="h-px bg-gray-100 my-1" />
                    {KATEGORIER.map(cat => (
                      <button
                        key={cat}
                        onClick={() => { setSelectedCategory(cat); setIsCategoryMenuOpen(false); }}
                        className={`w-full text-left px-4 py-2.5 text-sm hover:bg-gray-50 ${selectedCategory === cat ? 'text-[#131921] font-bold bg-blue-50' : 'text-gray-600'}`}
                      >
                        {cat}
                      </button>
                    ))}
                  </div>
                </>
              )}
            </div>

            {/* Radius Knap - Åbner nu modal */}
            <button 
              onClick={() => setIsRadiusMenuOpen(true)}
              className="h-12 px-4 bg-white rounded-xl flex items-center justify-center shadow-sm text-[#131921] font-bold text-sm hover:bg-gray-50 min-w-[70px]"
            >
              {radius} km
            </button>
          </div>

        </div>
      </div>

      {/* Liste med opslag */}
      <main className="flex-1 max-w-4xl mx-auto px-4 py-8 w-full">
        {filteredPosts.length > 0 ? (
          <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
            {filteredPosts.map((post) => (
              <div 
                key={post.id} 
                className="bg-white rounded-2xl p-4 shadow-sm hover:shadow-md transition-all cursor-pointer border border-gray-100 flex flex-col h-full"
                onClick={() => setSelectedPost(post)}
              >
                {post.image_url ? (
                  <div className="relative w-full h-48 mb-4 overflow-hidden rounded-xl">
                    <img 
                      src={post.image_url} 
                      alt={post.overskrift}
                      className="w-full h-full object-cover hover:scale-105 transition-transform duration-500"
                    />
                  </div>
                ) : (
                  <div className="w-full h-32 bg-gray-50 rounded-xl mb-4 flex items-center justify-center text-gray-300">
                    <i className="fa-solid fa-image text-3xl"></i>
                  </div>
                )}

                <div className="flex-1 flex flex-col">
                  <div className="flex justify-between items-start mb-2">
                    {post.kategori && (
                      <span className="inline-block bg-blue-50 text-blue-800 px-3 py-1 rounded-full text-xs font-bold border border-blue-100">
                        {post.kategori}
                      </span>
                    )}
                    {post.omraade && (
                      <span className="text-gray-400 text-xs flex items-center gap-1">
                        <i className="fa-solid fa-location-dot"></i> {post.omraade}
                      </span>
                    )}
                  </div>

                  <h3 className="text-gray-900 font-bold text-lg mb-2 leading-tight">
                    {post.overskrift}
                  </h3>
                  <p className="text-gray-500 text-sm mb-4 line-clamp-2">
                    {post.text}
                  </p>
                  
                  <div className="mt-auto pt-3 border-t border-gray-100 flex justify-between items-center text-xs text-gray-400 font-medium">
                     <span>{new Date(post.created_at).toLocaleDateString()}</span>
                     <span className="text-blue-600 font-bold">Læs mere →</span>
                  </div>
                </div>
              </div>
            ))}
          </div>
        ) : (
          <div className="flex flex-col items-center justify-center pt-20 text-gray-400">
            <i className="fa-solid fa-magnifying-glass text-4xl mb-4 opacity-50"></i>
            <p className="text-lg font-medium">Ingen opslag fundet</p>
            {(searchQuery || selectedCategory) && (
              <button 
                onClick={() => { setSearchQuery(''); setSelectedCategory(null); }}
                className="mt-4 text-[#131921] underline text-sm"
              >
                Nulstil filtre
              </button>
            )}
          </div>
        )}
      </main>

      <SiteFooter />

      {/* --- OPRET MODAL --- */}
      <CreatePostModal 
        isOpen={isCreateModalOpen} 
        onClose={() => setIsCreateModalOpen(false)}
        onPostCreated={() => fetchPosts()}
      />

      {/* --- DETALJE MODAL --- */}
      <PostDetailModal 
        isOpen={!!selectedPost}
        post={selectedPost}
        onClose={() => setSelectedPost(null)}
        currentUserId={currentUserId}
      />

      {/* --- RADIUS MODAL (NY) --- */}
      {isRadiusMenuOpen && (
        <div className="fixed inset-0 z-[200] flex items-center justify-center p-4 bg-black/60 backdrop-blur-sm animate-in fade-in duration-200">
          <div className="bg-white w-full max-w-sm rounded-3xl p-6 shadow-2xl flex flex-col items-center animate-in zoom-in-95 duration-200">
            
            <h3 className="text-lg font-bold text-[#131921] mb-6">Vis opslag indenfor</h3>
            
            <div className="w-full space-y-3">
              {RADIUS_OPTIONS.map((r) => (
                <button
                  key={r}
                  onClick={() => { setRadius(r); setIsRadiusMenuOpen(false); }}
                  className={`w-full py-3.5 rounded-2xl text-sm font-bold transition-all ${
                    radius === r
                      ? 'bg-[#131921] text-white shadow-md transform scale-[1.02]'
                      : 'bg-gray-50 text-gray-600 hover:bg-gray-100'
                  }`}
                >
                  {r} km
                </button>
              ))}
            </div>

            <button 
              onClick={() => setIsRadiusMenuOpen(false)}
              className="mt-8 text-[#131921] font-bold text-sm px-8 py-2.5 rounded-full hover:bg-gray-50 transition-colors"
            >
              Luk
            </button>
          </div>
        </div>
      )}
    </div>
  );
}