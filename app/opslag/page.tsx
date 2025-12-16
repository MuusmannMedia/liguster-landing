'use client';

import { useState, useEffect } from 'react';
import { useRouter } from 'next/navigation';
import { supabase } from '../../lib/supabaseClient';
import SiteHeader from '../../components/SiteHeader'; // Vores nye menu
import SiteFooter from '../../components/SiteFooter'; // Vores nye footer

// Type definition
type Post = {
  id: string;
  created_at: string;
  overskrift: string;
  text: string;
  image_url?: string;
  kategori?: string;
  omraade?: string;
  user_id: string;
};

export default function OpslagPage() {
  const router = useRouter();
  const [posts, setPosts] = useState<Post[]>([]);
  const [loading, setLoading] = useState(true);
  const [searchQuery, setSearchQuery] = useState('');

  // SIKKERHEDSTJEK & DATA HENTNING
  useEffect(() => {
    const checkUserAndFetch = async () => {
      setLoading(true);
      const { data: { session } } = await supabase.auth.getSession();
      
      if (!session) {
        router.replace('/login');
        return; 
      }
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

  if (loading) {
    return (
      <div className="min-h-screen bg-[#869FB9] flex flex-col items-center justify-center">
        <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-[#131921]"></div>
      </div>
    );
  }

  return (
    <div className="min-h-screen flex flex-col bg-[#f0f2f5]">
      {/* 1. Global Navigation */}
      <SiteHeader />

      {/* 2. Sub-header med knapper og filtre (Nu under menuen) */}
      <div className="bg-[#869FB9] py-6 px-4 shadow-sm">
        <div className="max-w-4xl mx-auto space-y-4">
          
          {/* Opret Knap */}
          <button 
            className="w-full bg-[#131921] text-white font-bold text-lg py-4 rounded-2xl shadow-lg hover:bg-gray-900 transition-all uppercase tracking-wider flex items-center justify-center gap-2 transform hover:scale-[1.01]"
            onClick={() => alert("Her kommer opret funktionen snart!")}
          >
            <i className="fa-solid fa-plus-circle text-2xl"></i> Opret nyt opslag
          </button>

          {/* Filter Bar */}
          <div className="flex items-center gap-2 bg-white/20 p-2 rounded-2xl backdrop-blur-sm">
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
            <button className="w-12 h-12 bg-white rounded-xl flex items-center justify-center shadow-sm text-[#131921] hover:bg-gray-50">
              <i className="fa-solid fa-filter"></i>
            </button>
            <button className="h-12 px-4 bg-white rounded-xl flex items-center justify-center shadow-sm text-[#131921] font-bold text-sm hover:bg-gray-50">
              50 km
            </button>
          </div>

        </div>
      </div>

      {/* 3. Selve listen med opslag */}
      <main className="flex-1 max-w-4xl mx-auto px-4 py-8 w-full">
        <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
          {posts.map((post) => (
            <div 
              key={post.id} 
              className="bg-white rounded-2xl p-4 shadow-sm hover:shadow-md transition-all cursor-pointer border border-gray-100 flex flex-col h-full"
              onClick={() => alert(`Her ville vi åbne detaljer for: ${post.overskrift}`)}
            >
              {/* Billede */}
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

              {/* Indhold */}
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
                   <span>For 2 timer siden</span>
                   <span className="text-blue-600 font-bold">Læs mere →</span>
                </div>
              </div>
            </div>
          ))}
        </div>
      </main>

      {/* 4. Global Footer */}
      <SiteFooter />
    </div>
  );
}