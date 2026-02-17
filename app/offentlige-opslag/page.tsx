'use client';

import { useCallback, useEffect, useMemo, useState } from 'react';
import Image from 'next/image';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import SiteFooter from '../../components/SiteFooter';
import SiteHeader from '../../components/SiteHeader';
import { supabase } from '../../lib/supabaseClient';

type Post = {
  id: string;
  overskrift: string;
  text: string;
  image_url?: string;
  kategori?: string;
  pris?: number;
  omraade?: string;
  created_at: string;
};

const PAGE_SIZE = 18;

function canOptimizeImage(src: string) {
  try {
    const url = new URL(src);
    return url.hostname.endsWith('.supabase.co') || url.hostname === 'www.liguster-app.dk';
  } catch {
    return false;
  }
}

function toSearchTerm(input: string) {
  return input.trim().replace(/[%_,'"]/g, ' ');
}

export default function OffentligeOpslagPage() {
  const router = useRouter();

  const [posts, setPosts] = useState<Post[]>([]);
  const [loading, setLoading] = useState(true);
  const [loadingMore, setLoadingMore] = useState(false);
  const [search, setSearch] = useState('');
  const [debouncedSearch, setDebouncedSearch] = useState('');
  const [page, setPage] = useState(0);
  const [hasMore, setHasMore] = useState(false);
  const [totalCount, setTotalCount] = useState(0);

  useEffect(() => {
    const timeout = setTimeout(() => {
      setDebouncedSearch(search);
    }, 250);

    return () => {
      clearTimeout(timeout);
    };
  }, [search]);

  const getCategoryColor = useCallback((cat: string | undefined) => {
    const c = cat?.toLowerCase() || '';
    if (c.includes('sælges')) return 'bg-blue-100 text-blue-800';
    if (c.includes('gives') || c.includes('gratis')) return 'bg-green-100 text-green-800';
    if (c.includes('søges')) return 'bg-purple-100 text-purple-800';
    if (c.includes('hjælp')) return 'bg-amber-100 text-amber-800';
    return 'bg-gray-100 text-gray-800';
  }, []);

  const fetchPublicPosts = useCallback(async (targetPage: number, append: boolean, currentSearch: string) => {
    if (append) {
      setLoadingMore(true);
    } else {
      setLoading(true);
    }

    try {
      const from = targetPage * PAGE_SIZE;
      const to = from + PAGE_SIZE - 1;
      const safeSearch = toSearchTerm(currentSearch);

      let query = supabase
        .from('posts')
        .select('id, overskrift, text, image_url, kategori, pris, omraade, created_at', { count: 'exact' })
        .eq('is_public', true)
        .order('created_at', { ascending: false })
        .range(from, to);

      if (safeSearch) {
        query = query.or(
          `overskrift.ilike.%${safeSearch}%,text.ilike.%${safeSearch}%,omraade.ilike.%${safeSearch}%,kategori.ilike.%${safeSearch}%`
        );
      }

      const { data, error, count } = await query;

      if (error) {
        console.error('Kunne ikke hente offentlige opslag:', error.message);
        return;
      }

      const nextPosts = data ?? [];
      setTotalCount(count || 0);
      setHasMore(to + 1 < (count || 0));

      setPosts((prev) => (append ? [...prev, ...nextPosts] : nextPosts));
    } finally {
      if (append) {
        setLoadingMore(false);
      } else {
        setLoading(false);
      }
    }
  }, []);

  useEffect(() => {
    setPage(0);
    void fetchPublicPosts(0, false, debouncedSearch);
  }, [debouncedSearch, fetchPublicPosts]);

  useEffect(() => {
    if (page === 0) return;
    void fetchPublicPosts(page, true, debouncedSearch);
  }, [debouncedSearch, fetchPublicPosts, page]);

  const headerText = useMemo(() => {
    if (debouncedSearch.trim()) {
      return `${totalCount} opslag fundet`;
    }
    return `${totalCount} offentlige opslag`;
  }, [debouncedSearch, totalCount]);

  return (
    <div className="min-h-screen flex flex-col bg-[#869FB9]">
      <SiteHeader />

      <div className="bg-[#0D253F] px-4 pt-10 pb-16 text-center relative overflow-hidden">
        <div className="max-w-3xl mx-auto relative z-10">
          <h1 className="text-3xl md:text-4xl font-black text-white mb-4 tracking-tight">
            Det sker lige nu i nabolaget
          </h1>
          <p className="text-white/80 text-sm md:text-base leading-relaxed max-w-xl mx-auto mb-8">
            Gør et kup, find hjælp til hækken eller se, hvad dine naboer giver væk.
            Her er et udpluk af de nyeste offentlige opslag på Liguster.
          </p>

          <div className="relative max-w-md mx-auto">
            <i className="fa-solid fa-search absolute left-4 top-1/2 -translate-y-1/2 text-[#0D253F]" aria-hidden="true"></i>
            <input
              type="text"
              className="w-full h-12 rounded-full pl-12 pr-4 bg-white text-[#222] placeholder-gray-500 outline-none shadow-lg focus:ring-4 focus:ring-white/20 transition-all"
              placeholder="Søg efter sofa, hjælp, eller by..."
              value={search}
              onChange={(e) => setSearch(e.target.value)}
            />
          </div>

          {!loading && (
            <p className="text-white/70 text-xs md:text-sm mt-3 font-medium">{headerText}</p>
          )}
        </div>

        <div className="absolute top-0 left-0 w-full h-full opacity-5 pointer-events-none bg-gradient-to-br from-white to-transparent"></div>
      </div>

      <main className="flex-1 max-w-6xl mx-auto w-full px-4 -mt-8 relative z-20 pb-20">
        {loading ? (
          <div className="flex justify-center pt-20">
            <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-white"></div>
          </div>
        ) : posts.length === 0 ? (
          <div className="text-center bg-white rounded-[24px] p-10 shadow-md">
            <i className="fa-solid fa-box-open text-4xl text-gray-300 mb-3" aria-hidden="true"></i>
            <p className="text-gray-500 font-bold">Ingen offentlige opslag fundet.</p>
            <Link href="/opret" className="text-[#131921] underline mt-2 inline-block text-sm">
              Vær den første til at oprette et!
            </Link>
          </div>
        ) : (
          <>
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
              {posts.map((post) => (
                <div
                  key={post.id}
                  onClick={() => router.push('/login')}
                  className="bg-white rounded-[24px] p-4 shadow-md hover:shadow-xl transition-all cursor-pointer flex flex-col h-full transform hover:-translate-y-1 duration-200 group"
                >
                  <div className="w-full aspect-[4/3] rounded-[18px] mb-4 overflow-hidden bg-[#E7EBF0] flex items-center justify-center relative">
                    {post.image_url ? (
                      <Image
                        src={post.image_url}
                        alt={post.overskrift}
                        fill
                        className="object-cover group-hover:scale-105 transition-transform duration-500"
                        sizes="(min-width: 1024px) 360px, (min-width: 768px) 50vw, 100vw"
                        unoptimized={!canOptimizeImage(post.image_url)}
                      />
                    ) : (
                      <i className="fa-solid fa-image text-gray-400 text-3xl" aria-hidden="true"></i>
                    )}

                    {post.kategori && (
                      <div className={`absolute top-3 left-3 px-3 py-1 rounded-full text-[10px] font-black uppercase tracking-wider shadow-sm ${getCategoryColor(post.kategori)}`}>
                        {post.kategori}
                      </div>
                    )}
                  </div>

                  <div className="px-1 pb-2 flex-1 flex flex-col">
                    <div className="flex justify-between items-start gap-2 mb-1">
                      <h3 className="font-bold text-lg text-[#131921] leading-snug line-clamp-2 decoration-gray-300 group-hover:underline">
                        {post.overskrift}
                      </h3>
                      {post.pris && post.pris > 0 ? (
                        <span className="font-bold text-green-700 whitespace-nowrap">{post.pris} kr.</span>
                      ) : post.kategori?.toLowerCase() === 'gives væk' || post.kategori?.toLowerCase() === 'gratis' ? (
                        <span className="font-bold text-green-700 text-xs uppercase">Gratis</span>
                      ) : null}
                    </div>

                    {post.omraade && (
                      <div className="flex items-center gap-1.5 text-gray-500 text-xs font-bold mb-3 uppercase tracking-wide">
                        <i className="fa-solid fa-location-dot" aria-hidden="true"></i> {post.omraade}
                      </div>
                    )}

                    <p className="text-[#444] text-sm line-clamp-3 leading-relaxed mb-4">{post.text}</p>

                    <div className="mt-auto pt-3 border-t border-gray-100 flex justify-between items-center">
                      <span className="text-gray-400 text-[10px] uppercase font-bold">
                        {new Date(post.created_at).toLocaleDateString('da-DK')}
                      </span>
                      <span className="text-[#131921] text-xs font-bold group-hover:gap-2 flex items-center gap-1 transition-all">
                        Se opslag <i className="fa-solid fa-arrow-right" aria-hidden="true"></i>
                      </span>
                    </div>
                  </div>
                </div>
              ))}
            </div>

            {hasMore && (
              <div className="flex justify-center mt-10">
                <button
                  type="button"
                  onClick={() => setPage((prev) => prev + 1)}
                  disabled={loadingMore}
                  className="inline-flex items-center gap-2 px-6 py-3 rounded-full bg-[#131921] text-white font-bold shadow-md hover:bg-black transition-colors disabled:opacity-60"
                >
                  {loadingMore ? 'Henter flere...' : 'Vis flere opslag'}
                </button>
              </div>
            )}
          </>
        )}
      </main>
      <SiteFooter />
    </div>
  );
}
