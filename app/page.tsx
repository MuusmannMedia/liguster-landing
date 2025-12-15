'use client';

import React, { useState, useEffect, useRef } from 'react';
import Image from 'next/image';

export default function LigusterLandingPage() {
  // --- STATE ---
  const [isLoginOpen, setIsLoginOpen] = useState(false);
  const [activeTab, setActiveTab] = useState<'neighbor' | 'event'>('neighbor');
  
  // Carousel State
  const [currentSlide, setCurrentSlide] = useState(0);
  const totalSlides = 10; // Opdateret til 10 billeder
  const autoPlayRef = useRef<NodeJS.Timeout | null>(null);

  // AI State
  const [neighborInput, setNeighborInput] = useState('');
  const [neighborOutput, setNeighborOutput] = useState('Indtast en udfordring til venstre for at se magien ske...');
  const [eventInput, setEventInput] = useState('');
  const [eventOutput, setEventOutput] = useState('Fortæl os lidt om jeres fest, så kommer vi med forslag...');
  const [loading, setLoading] = useState(false);

  // --- CAROUSEL LOGIC ---
  const nextSlide = () => setCurrentSlide((prev) => (prev + 1) % totalSlides);
  const prevSlide = () => setCurrentSlide((prev) => (prev === 0 ? totalSlides - 1 : prev - 1));

  const resetAutoPlay = () => {
    if (autoPlayRef.current) clearInterval(autoPlayRef.current);
    autoPlayRef.current = setInterval(nextSlide, 3500);
  };

  useEffect(() => {
    resetAutoPlay();
    return () => { if (autoPlayRef.current) clearInterval(autoPlayRef.current); };
  }, []);

  // Swipe handlers
  const [touchStart, setTouchStart] = useState(0);
  const [touchEnd, setTouchEnd] = useState(0);

  const handleTouchStart = (e: React.TouchEvent) => {
    setTouchStart(e.targetTouches[0].clientX);
    if (autoPlayRef.current) clearInterval(autoPlayRef.current);
  };

  const handleTouchEnd = (e: React.TouchEvent) => {
    setTouchEnd(e.changedTouches[0].clientX);
    if (touchStart - touchEnd > 50) nextSlide();
    if (touchStart - touchEnd < -50) prevSlide();
    resetAutoPlay();
  };

  // --- API CALL ---
  const callGemini = async (prompt: string, type: 'neighbor' | 'event') => {
    setLoading(true);
    const setOutput = type === 'neighbor' ? setNeighborOutput : setEventOutput;
    setOutput("Tænker så det knager...");

    try {
      const response = await fetch('/api/gemini', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ prompt })
      });

      const data = await response.json();
      if (!response.ok) throw new Error(data.error || 'Fejl ved forbindelse');
      
      setOutput(data.text);

    } catch (error: any) {
      console.error("Fejl:", error);
      setOutput(`Hov, der skete en fejl: ${error.message}. (Husk at sætte API nøglen i .env.local lokalt eller på Vercel)`);
    } finally {
      setLoading(false);
    }
  };

  const handleNeighborGenerate = () => {
    if (!neighborInput) return alert("Du skal skrive en udfordring først :)");
    const prompt = `Du er en diplomatisk assistent for en dansk grundejerforening. Skriv en venlig besked til en nabo om: "${neighborInput}". Krav: Imødekommende tone, dansk sprog, løsningsorienteret.`;
    callGemini(prompt, 'neighbor');
  };

  const handleEventGenerate = () => {
    if (!eventInput) return alert("Du skal beskrive begivenheden først :)");
    const prompt = `Du er en eventplanlægger for en grundejerforening. Baseret på noterne: "${eventInput}", kom med 3 forslag (Titel, Beskrivelse, Sjov detalje). Sprog: Dansk.`;
    callGemini(prompt, 'event');
  };

  // --- BILLEDER ---
  // Disse filer skal ligge i 'public' mappen
  const slides = [
    '/app-01.png',
    '/app-02.png',
    '/app-03.png',
    '/app-04.png',
    '/app-05.png',
    '/app-06.png',
    '/app-07.png',
    '/app-08.png',
    '/app-09.png',
    '/app-10.png',
  ];

  return (
    <div className="font-sans text-gray-800 bg-gray-50 min-h-screen pb-20">
      {/* FontAwesome CDN */}
      <link rel="stylesheet" href="https://cdnjs.cloudflare.com/ajax/libs/font-awesome/6.4.0/css/all.min.css" />
      
      {/* Global Styles */}
      <style jsx global>{`
        .bg-liguster-gradient { background: linear-gradient(135deg, #0e2a47 0%, #1a4d7c 100%); }
        .text-liguster { color: #1a4d7c; }
        .bg-liguster { background-color: #1a4d7c; }
        .hover-bg-liguster:hover { background-color: #0e2a47; }
        .mockup-frame { box-shadow: 0 25px 50px -12px rgba(0, 0, 0, 0.5); }
        .fade-in-up { animation: fadeInUp 0.8s ease-out; }
        @keyframes fadeInUp {
          from { opacity: 0; transform: translateY(20px); }
          to { opacity: 1; transform: translateY(0); }
        }
        .loader {
            border: 3px solid #f3f3f3;
            border-radius: 50%;
            border-top: 3px solid #1a4d7c;
            width: 20px;
            height: 20px;
            animation: spin 1s linear infinite;
        }
        @keyframes spin { 0% { transform: rotate(0deg); } 100% { transform: rotate(360deg); } }
      `}</style>

      {/* Navigation */}
      <nav className="absolute w-full z-20 top-0 start-0 border-b border-white/10">
        <div className="max-w-screen-xl flex flex-wrap items-center justify-between mx-auto p-4">
          <div className="flex items-center space-x-3">
             {/* Logo */}
             <div className="relative h-10 w-32 md:h-12 md:w-40">
                <Image 
                    src="/Liguster-logo-NEG.png" 
                    alt="Liguster Logo" 
                    fill 
                    className="object-contain object-left"
                    priority
                />
             </div>
          </div>
          <div className="flex md:order-2 space-x-3 md:space-x-0 rtl:space-x-reverse">
            <button 
              onClick={() => setIsLoginOpen(true)}
              className="text-white bg-white/20 hover:bg-white/30 font-medium rounded-lg text-sm px-5 py-2.5 transition-all backdrop-blur-sm border border-white/40 flex items-center"
            >
              <i className="fa-solid fa-right-to-bracket mr-2"></i> Log ind
            </button>
          </div>
        </div>
      </nav>

      {/* Hero Section */}
      <section className="bg-liguster-gradient relative min-h-[95vh] flex items-center overflow-hidden">
        {/* Background Icons */}
        <div className="absolute top-0 left-0 w-full h-full overflow-hidden opacity-10 pointer-events-none">
          <i className="fa-solid fa-leaf absolute text-9xl text-white top-10 left-10 transform -rotate-12"></i>
          <i className="fa-solid fa-wifi absolute text-9xl text-white bottom-20 right-20 transform rotate-12"></i>
        </div>

        <div className="grid max-w-screen-xl px-4 py-8 mx-auto lg:gap-8 xl:gap-0 lg:py-16 lg:grid-cols-12 relative z-10 pt-24 md:pt-0">
          <div className="mr-auto place-self-center lg:col-span-7 fade-in-up">
            <span className="bg-blue-500/30 text-blue-100 text-xs font-medium px-2.5 py-0.5 rounded-full mb-4 inline-block border border-blue-400/50">
              Nyhed: Version 2.0 med AI-assistent
            </span>
            <h1 className="max-w-2xl mb-4 text-4xl font-extrabold tracking-tight leading-none md:text-5xl xl:text-6xl text-white">
              Det digitale samlingspunkt for din forening
            </h1>
            <p className="max-w-2xl mb-6 font-light text-gray-200 lg:mb-8 md:text-lg lg:text-xl">
              Liguster samler kommunikation, dokumenter og naboskab ét sted. Få fuldt overblik over grundejerforeningen direkte fra lommen.
            </p>
            <div className="flex flex-col md:flex-row gap-4">
              <a href="#features" className="inline-flex items-center justify-center px-5 py-3 text-base font-medium text-center text-gray-900 border border-gray-300 rounded-lg bg-white hover:bg-gray-100 transition-colors">
                Læs mere
              </a>
              <div className="flex items-center gap-4 text-white/80 text-sm mt-2 md:mt-0">
                <div className="flex items-center"><i className="fa-brands fa-apple text-xl mr-2"></i> iOS</div>
                <div className="flex items-center"><i className="fa-brands fa-android text-xl mr-2"></i> Android</div>
              </div>
            </div>
          </div>
          
          <div className="hidden lg:mt-0 lg:col-span-5 lg:flex justify-center items-center relative">
            <div className="relative">
              {/* Phone Mockup Frame */}
              <div 
                className="mockup-frame w-[280px] h-[580px] bg-black relative z-10 mx-auto border-[12px] border-gray-800 rounded-[2.5rem] overflow-hidden"
                onTouchStart={handleTouchStart}
                onTouchEnd={handleTouchEnd}
              >
                <div 
                  className="flex transition-transform duration-500 ease-in-out h-full w-full"
                  style={{ transform: `translateX(-${currentSlide * 100}%)` }}
                >
                  {slides.map((src, index) => (
                    <div key={index} className="min-w-full h-full bg-gray-900 flex items-center justify-center relative">
                       <Image 
                        src={src} 
                        alt={`App slide ${index + 1}`}
                        fill
                        className="object-cover"
                        priority={index === 0}
                      />
                    </div>
                  ))}
                </div>

                {/* Indicators */}
                <div className="absolute bottom-5 left-1/2 transform -translate-x-1/2 flex gap-2 z-20">
                  {[...Array(totalSlides)].map((_, index) => (
                    <div 
                      key={index}
                      onClick={() => { setCurrentSlide(index); resetAutoPlay(); }}
                      className={`h-2 rounded-full cursor-pointer transition-all duration-300 ${index === currentSlide ? 'bg-white w-5' : 'bg-white/40 w-2'}`}
                    />
                  ))}
                </div>
              </div>
            </div>
          </div>
        </div>

        {/* Wave Divider */}
        <div className="absolute bottom-0 left-0 w-full overflow-hidden leading-[0]">
            <svg className="relative block w-[calc(100%+1.3px)] h-[60px]" data-name="Layer 1" xmlns="http://www.w3.org/2000/svg" viewBox="0 0 1200 120" preserveAspectRatio="none">
                <path d="M321.39,56.44c58-10.79,114.16-30.13,172-41.86,82.39-16.72,168.19-17.73,250.45-.39C823.78,31,906.67,72,985.66,92.83c70.05,18.48,146.53,26.09,214.34,3V0H0V27.35A600.21,600.21,0,0,0,321.39,56.44Z" className="fill-gray-50"></path>
            </svg>
        </div>
      </section>

      {/* Features Section */}
      <section id="features" className="py-16 md:py-24 bg-gray-50">
        <div className="max-w-screen-xl mx-auto px-4">
            <div className="text-center mb-16">
                <h2 className="text-3xl font-bold text-gray-900 mb-4">Et komplet system til din forening</h2>
                <p className="text-gray-600 max-w-2xl mx-auto">Liguster er designet til at gøre bestyrelsesarbejdet nemmere og naboskabet stærkere.</p>
            </div>

            <div className="grid md:grid-cols-3 gap-8">
                <div className="bg-white p-8 rounded-2xl shadow-sm border border-gray-100">
                    <div className="w-14 h-14 bg-blue-100 rounded-xl flex items-center justify-center text-blue-600 mb-6 text-2xl">
                        <i className="fa-solid fa-mobile-screen"></i>
                    </div>
                    <h3 className="text-xl font-bold mb-3 text-gray-900">Native Apps</h3>
                    <p className="text-gray-600">Lynhurtig adgang på både iOS og Android. Altid ved hånden.</p>
                </div>
                <div className="bg-white p-8 rounded-2xl shadow-sm border border-gray-100">
                    <div className="w-14 h-14 bg-indigo-100 rounded-xl flex items-center justify-center text-indigo-600 mb-6 text-2xl">
                        <i className="fa-solid fa-tablet-screen-button"></i>
                    </div>
                    <h3 className="text-xl font-bold mb-3 text-gray-900">Optimeret til Tablet</h3>
                    <p className="text-gray-600">Få det store overblik på iPad eller Android tablets.</p>
                </div>
                <div className="bg-white p-8 rounded-2xl shadow-sm border border-gray-100">
                    <div className="w-14 h-14 bg-sky-100 rounded-xl flex items-center justify-center text-sky-600 mb-6 text-2xl">
                        <i className="fa-solid fa-users"></i>
                    </div>
                    <h3 className="text-xl font-bold mb-3 text-gray-900">Stærkt Fællesskab</h3>
                    <p className="text-gray-600">Del referater, planlæg arbejdsdage og styrk naboskabet.</p>
                </div>
            </div>
        </div>
      </section>

      {/* AI Demo Section */}
      <section className="py-16 bg-gradient-to-br from-blue-50 to-white border-y border-blue-100 relative">
        <div className="max-w-screen-xl mx-auto px-4 relative z-10">
          <div className="text-center mb-12">
            <span className="text-blue-600 font-bold tracking-wider text-sm uppercase">Nyhed</span>
            <h2 className="text-3xl md:text-4xl font-bold text-gray-900 mt-2 mb-4">Liguster AI ✨</h2>
            <p className="text-gray-600 max-w-2xl mx-auto">
              Prøv vores nye AI assistent. Få hjælp til nabokommunikation eller planlægning.
            </p>
          </div>

          <div className="max-w-4xl mx-auto bg-white rounded-2xl shadow-xl overflow-hidden border border-gray-100">
            {/* Tabs */}
            <div className="flex border-b border-gray-200">
              <button 
                onClick={() => setActiveTab('neighbor')}
                className={`flex-1 py-4 px-6 font-semibold flex items-center justify-center gap-2 transition-colors ${activeTab === 'neighbor' ? 'text-blue-800 border-b-2 border-blue-600 bg-blue-50' : 'text-gray-500 hover:bg-gray-50'}`}
              >
                <i className="fa-solid fa-hand-holding-heart"></i> Mægleren
              </button>
              <button 
                onClick={() => setActiveTab('event')}
                className={`flex-1 py-4 px-6 font-semibold flex items-center justify-center gap-2 transition-colors ${activeTab === 'event' ? 'text-blue-800 border-b-2 border-blue-600 bg-blue-50' : 'text-gray-500 hover:bg-gray-50'}`}
              >
                <i className="fa-solid fa-champagne-glasses"></i> Festen
              </button>
            </div>

            {/* AI Content */}
            <div className="p-6 md:p-8">
              <div className="grid md:grid-cols-2 gap-8">
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-2">
                    {activeTab === 'neighbor' ? 'Hvad er problemet?' : 'Hvad skal fejres?'}
                  </label>
                  <textarea 
                    className="w-full p-3 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 h-32 resize-none text-gray-900" 
                    placeholder={activeTab === 'neighbor' ? "F.eks.: Min nabos hæk er vokset ind over mit skur..." : "F.eks.: Sommerfest, budget 2000kr..."}
                    value={activeTab === 'neighbor' ? neighborInput : eventInput}
                    onChange={(e) => activeTab === 'neighbor' ? setNeighborInput(e.target.value) : setEventInput(e.target.value)}
                  ></textarea>
                  <button 
                    onClick={activeTab === 'neighbor' ? handleNeighborGenerate : handleEventGenerate}
                    disabled={loading}
                    className="mt-4 w-full bg-liguster hover:bg-gray-900 text-white font-bold py-3 px-4 rounded-lg shadow transition-colors flex items-center justify-center gap-2"
                  >
                    {loading ? <div className="loader"></div> : <span>Generer svar ✨</span>}
                  </button>
                </div>
                <div className="bg-gray-50 rounded-xl p-6 border border-gray-100 relative min-h-[200px] whitespace-pre-wrap text-gray-800">
                  {activeTab === 'neighbor' ? neighborOutput : eventOutput}
                </div>
              </div>
            </div>
          </div>
        </div>
      </section>

      {/* Footer */}
      <footer className="bg-gray-950 text-gray-400 py-12 border-t border-gray-800 text-center mt-12">
        <div className="max-w-screen-xl mx-auto px-4">
             <div className="flex justify-center mb-6">
                <div className="relative h-8 w-32 opacity-80">
                    <Image src="/Liguster-logo-NEG.png" alt="Logo" fill className="object-contain" />
                </div>
             </div>
            <p className="text-sm">&copy; 2025 Liguster Systemer ApS. Alle rettigheder forbeholdes.</p>
        </div>
      </footer>

      {/* Login Modal */}
      {isLoginOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-gray-900/80 backdrop-blur-sm p-4">
          <div className="bg-white rounded-2xl w-full max-w-md p-6 relative shadow-2xl">
            <button onClick={() => setIsLoginOpen(false)} className="absolute top-4 right-4 text-gray-400 hover:text-gray-600">
              <i className="fa-solid fa-xmark text-xl"></i>
            </button>
            <h3 className="text-2xl font-bold text-gray-900 mb-2 text-center">Log ind</h3>
            <p className="text-center text-gray-500 mb-6">Dette er en demo. Appen er klar til download.</p>
            <div className="space-y-3">
                 <button onClick={() => setIsLoginOpen(false)} className="w-full bg-liguster hover:bg-gray-900 text-white py-3 rounded-lg font-bold transition-colors">
                    Luk
                 </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}