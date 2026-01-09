'use client';

import { useState, useEffect } from 'react';
import { useRouter } from 'next/navigation';
import { supabase } from '../../lib/supabaseClient'; 
import SiteHeader from '../../components/SiteHeader';
import SiteFooter from '../../components/SiteFooter';
import Link from 'next/link';

type Forening = {
  id: string;
  navn: string;
  sted: string;
  beskrivelse: string;
  billede_url?: string;
  slug?: string;
};

export default function OffentligeForeningerPage() {
  const router = useRouter();
  const [foreninger, setForeninger] = useState<Forening[]>([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState("");

  useEffect(() => {
    const fetchPublicAssociations = async () => {
      setLoading(true);
      const { data, error } = await supabase
        .from("foreninger")
        .select("*")
        .eq("is_public", true) // ✅ HENT KUN OFFENTLIGE
        .order("navn", { ascending: true });

      if (!error && data) {
        setForeninger(data);
      }
      setLoading(false);
    };

    fetchPublicAssociations();
  }, []);

  const filtered = foreninger.filter(f => {
    const s = search.toLowerCase();
    return (
      f.navn.toLowerCase().includes(s) ||
      f.sted.toLowerCase().includes(s) ||
      f.beskrivelse.toLowerCase().includes(s)
    );
  });

  return (
    <div className="min-h-screen flex flex-col bg-[#869FB9]">
      <SiteHeader />

      {/* --- HERO SEKTION (Top Banner) --- */}
      <div className="bg-[#0D253F] px-4 pt-10 pb-16 text-center relative overflow-hidden">
        <div className="max-w-3xl mx-auto relative z-10">
          <h1 className="text-3xl md:text-4xl font-black text-white mb-4 tracking-tight">
            Find dit næste fællesskab her
          </h1>
          <p className="text-white/80 text-sm md:text-base leading-relaxed max-w-xl mx-auto mb-8">
            Uanset om det er grundejerforeningen, dartklubben, en løbegruppe eller et nyt initiativ i opgangen. 
            Her kan du se de foreninger og klubber, der har åbnet dørene op på Liguster. 
            Kig indenfor – eller start dit eget fællesskab i dag.
          </p>
          
          {/* Søgefelt */}
          <div className="relative max-w-md mx-auto">
             <i className="fa-solid fa-search absolute left-4 top-1/2 -translate-y-1/2 text-[#0D253F]"></i>
             <input 
               type="text" 
               className="w-full h-12 rounded-full pl-12 pr-4 bg-white text-[#222] placeholder-gray-500 outline-none shadow-lg focus:ring-4 focus:ring-white/20 transition-all" 
               placeholder="Søg efter navn, by eller interesse..." 
               value={search} 
               onChange={e => setSearch(e.target.value)} 
             />
          </div>
        </div>
        
        {/* Dekorativ baggrund */}
        <div className="absolute top-0 left-0 w-full h-full opacity-5 pointer-events-none bg-gradient-to-br from-white to-transparent"></div>
      </div>

      {/* --- LISTE OVER FORENINGER --- */}
      <main className="flex-1 max-w-6xl mx-auto w-full px-4 -mt-8 relative z-20 pb-20">
        {loading ? (
          <div className="flex justify-center pt-20"><div className="animate-spin rounded-full h-12 w-12 border-b-2 border-white"></div></div>
        ) : filtered.length === 0 ? (
          <div className="text-center bg-white rounded-[24px] p-10 shadow-md">
            <i className="fa-solid fa-ghost text-4xl text-gray-300 mb-3"></i>
            <p className="text-gray-500 font-bold">Ingen offentlige foreninger fundet.</p>
            <Link href="/opret" className="text-[#131921] underline mt-2 inline-block text-sm">Opret din egen forening her</Link>
          </div>
        ) : (
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
            {filtered.map(forening => (
              <div 
                key={forening.id}
                onClick={() => router.push(`/forening/${forening.slug || forening.id}`)}
                className="bg-white rounded-[24px] p-4 shadow-md hover:shadow-xl transition-all cursor-pointer flex flex-col h-full transform hover:-translate-y-1 duration-200 group"
              >
                <div className="w-full aspect-[4/3] rounded-[18px] mb-4 overflow-hidden bg-[#E7EBF0] flex items-center justify-center relative">
                  {forening.billede_url ? (
                    <img src={forening.billede_url} alt={forening.navn} className="w-full h-full object-cover group-hover:scale-105 transition-transform duration-500" />
                  ) : (
                    <span className="text-[#536071] font-bold text-xl px-4 text-center line-clamp-2">{forening.navn}</span>
                  )}
                  {/* Public Badge */}
                  <div className="absolute top-3 right-3 bg-white/90 backdrop-blur-sm text-[#131921] text-[10px] font-black px-3 py-1 rounded-full shadow-sm uppercase tracking-wider">
                    Åben
                  </div>
                </div>
                
                <div className="px-1 pb-2">
                  <h3 className="font-bold text-lg text-[#131921] mb-1 leading-snug group-hover:underline decoration-gray-300">{forening.navn}</h3>
                  <div className="flex items-center gap-1.5 text-gray-500 text-xs font-bold mb-3 uppercase tracking-wide">
                    <i className="fa-solid fa-location-dot"></i> {forening.sted}
                  </div>
                  <p className="text-[#444] text-sm line-clamp-3 leading-relaxed">{forening.beskrivelse}</p>
                </div>
                
                <div className="mt-auto pt-4 flex justify-end">
                   <span className="text-[#131921] text-xs font-bold flex items-center gap-1 group-hover:gap-2 transition-all">
                     Besøg forening <i className="fa-solid fa-arrow-right"></i>
                   </span>
                </div>
              </div>
            ))}
          </div>
        )}
      </main>
      <SiteFooter />
    </div>
  );
}