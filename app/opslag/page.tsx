'use client';

import { useState, useEffect } from 'react';
// HER ER RETTELSEN: Vi bruger ../.. for at finde lib-mappen i roden
import { supabase } from '../../lib/supabaseClient';
import Image from 'next/image';

// Type definition baseret på din app
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
  const [posts, setPosts] = useState<Post[]>([]);
  const [loading, setLoading] = useState(true);
  const [searchQuery, setSearchQuery] = useState('');

  // Hent data når siden loader
  useEffect(() => {
    fetchPosts();
  }, []);

  const fetchPosts = async () => {
    try {
      setLoading(true);
      // Simpel fetch - du kan udvide med filtre senere
      const { data, error } = await supabase
        .from('posts') // Husk at rette tabellens navn hvis den ikke hedder 'posts'
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

  return (
    <div className="min-h-screen bg-[#869FB9] pb-20">
      
      {/* Sticky Header */}
      <div className="sticky top-0 z-50 bg-[#869FB9] shadow-lg rounded-b-[40px] px-4 pt-4 pb-6">
        <div className="max-w-4xl mx-auto">
          {/* Opret Knap */}
          <button className="w-full bg-[#131921] text-white font-bold text-lg py-3 rounded-full shadow-md hover:bg-gray-900 transition-colors uppercase tracking-wider">
            Opret nyt opslag
          </button>

          {/* Filter Række */}
          <div className="flex items-center gap-3 mt-4">
            <input
              type="text"
              placeholder="Søg i opslag..."
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              className="flex-1 bg-white rounded-full px-5 py-3 text-gray-900 outline-none shadow-sm"
            />
            {/* Kategori Knap (Simuleret) */}
            <button className="w-12 h-12 bg-[#131921] rounded-full flex items-center justify-center shadow-sm text-white font-bold text-xl hover:bg-gray-900">
              ▼
            </button>
            {/* Radius Knap (Simuleret) */}
            <button className="h-12 px-4 bg-[#131921] rounded-full flex items-center justify-center shadow-sm text-white font-bold text-sm hover:bg-gray-900">
              50 km
            </button>
          </div>
        </div>
      </div>

      {/* Liste af Opslag (Grid) */}
      <div className="max-w-4xl mx-auto px-4 mt-6">
        {loading ? (
          <div className="text-center text-white mt-10">Henter opslag...</div>
        ) : (
          <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
            {posts.map((post) => (
              <div 
                key={post.id} 
                className="bg-white rounded-[24px] p-4 shadow-md hover:shadow-lg transition-shadow cursor-pointer"
                onClick={() => alert(`Her ville vi åbne detaljer for: ${post.overskrift}`)}
              >
                {/* Billede */}
                {post.image_url ? (
                  <div className="relative w-full h-48 mb-3">
                    {/* Vi bruger standard img tag her for at undgå config-bøvl med eksterne domæner lige nu */}
                    <img 
                      src={post.image_url} 
                      alt={post.overskrift}
                      className="w-full h-full object-cover rounded-[18px]"
                    />
                  </div>
                ) : (
                  <div className="w-full h-32 bg-gray-100 rounded-[18px] mb-3 flex items-center justify-center text-gray-400">
                    Intet billede
                  </div>
                )}

                {/* Kategori Badge */}
                {post.kategori && (
                  <span className="inline-block bg-[#25489022] text-[#131921] px-3 py-1 rounded-full text-xs font-bold mb-2">
                    {post.kategori}
                  </span>
                )}

                {/* Tekst */}
                <h3 className="text-[#131921] font-bold text-lg mb-1 truncate underline decoration-gray-300">
                  {post.overskrift}
                </h3>
                <p className="text-gray-600 text-sm mb-2 line-clamp-2">
                  {post.text}
                </p>
                
                {/* Sted */}
                {post.omraade && (
                  <p className="text-gray-900 text-xs font-medium">
                    📍 {post.omraade}
                  </p>
                )}
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}