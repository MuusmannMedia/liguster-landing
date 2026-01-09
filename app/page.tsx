'use client';

import React, { useState, useEffect, useRef } from 'react';
import Image from 'next/image';
import Link from 'next/link';

export default function LigusterLandingPage() {
  // --- STATE ---
  
  // Carousel State
  const [currentSlide, setCurrentSlide] = useState(0);
  const totalSlides = 10;
  const autoPlayRef = useRef<NodeJS.Timeout | null>(null);

  // --- CAROUSEL LOGIC ---
  const nextSlide = () => setCurrentSlide((prev) => (prev + 1) % totalSlides);
  const prevSlide = () =>
    setCurrentSlide((prev) => (prev === 0 ? totalSlides - 1 : prev - 1));

  const resetAutoPlay = () => {
    if (autoPlayRef.current) clearInterval(autoPlayRef.current);
    autoPlayRef.current = setInterval(nextSlide, 3500);
  };

  useEffect(() => {
    resetAutoPlay();
    return () => {
      if (autoPlayRef.current) clearInterval(autoPlayRef.current);
    };
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

  // --- BILLEDER ---
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
    <div className="font-sans text-gray-800 bg-gray-50 min-h-screen pb-0">
      {/* FontAwesome */}
      <link
        rel="stylesheet"
        href="https://cdnjs.cloudflare.com/ajax/libs/font-awesome/6.4.0/css/all.min.css"
      />

      <style jsx global>{`
        /* Mørkere blå gradient */
        .bg-liguster-gradient {
          background: linear-gradient(135deg, #071a2f 0%, #0b2b52 100%);
        }
        .text-liguster {
          color: #0b2b52;
        }
        .bg-liguster {
          background-color: #0b2b52;
        }
        .hover-bg-liguster:hover {
          background-color: #071a2f;
        }
        .mockup-frame {
          box-shadow: 0 25px 50px -12px rgba(0, 0, 0, 0.5);
        }
        .fade-in-up {
          animation: fadeInUp 0.8s ease-out;
        }
        @keyframes fadeInUp {
          from {
            opacity: 0;
            transform: translateY(20px);
          }
          to {
            opacity: 1;
            transform: translateY(0);
          }
        }
      `}</style>

      {/* Navigation */}
      <nav className="absolute w-full z-20 top-0 start-0 border-b border-white/10">
        <div className="max-w-screen-xl flex flex-wrap items-center justify-between mx-auto p-4">
          <div className="flex items-center space-x-3">
            {/* Logo */}
            <div className="relative h-14 w-44 md:h-16 md:w-56">
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
            
            {/* ✅ NY KNAP: FORENINGER */}
            <Link
              href="/offentlige-foreninger"
              className="text-white hover:text-white/80 font-bold text-sm px-4 py-2.5 transition-all flex items-center mr-2"
            >
              Foreninger
            </Link>

            {/* LOG IND KNAP */}
            <Link
              href="/login"
              className="text-white bg-white/20 hover:bg-white/30 font-medium rounded-lg text-sm px-5 py-2.5 transition-all backdrop-blur-sm border border-white/40 flex items-center"
            >
              <i className="fa-solid fa-right-to-bracket mr-2"></i> Log ind
            </Link>
          </div>
        </div>
      </nav>

      {/* Hero Section */}
      <section className="bg-liguster-gradient relative min-h-[95vh] flex items-center overflow-hidden">
        
        <div className="grid max-w-screen-xl px-4 py-8 mx-auto lg:gap-8 xl:gap-0 lg:py-16 lg:grid-cols-12 relative z-10 pt-24 md:pt-0">
          <div className="mr-auto place-self-center lg:col-span-7 fade-in-up">
            <span className="bg-white/10 text-white text-xs font-medium px-2.5 py-0.5 rounded-full mb-4 inline-block border border-white/20">
              Nyhed: Demo / Betaversion
            </span>

            <h1 className="max-w-2xl mb-4 text-4xl font-extrabold tracking-tight leading-none md:text-5xl xl:text-6xl text-white">
              Del, lån og hjælp lokalt
            </h1>

            <p className="max-w-2xl mb-6 font-light text-gray-200 lg:mb-8 md:text-lg lg:text-xl">
              Liguster gør det nemt at give ting videre, låne værktøj og tilbyde hjælp i nabolaget – med fokus på tryghed,
              enkelhed og en grønnere hverdag.
              <br className="hidden md:block" />
              <span className="block mt-2 font-normal text-white">
                🚀 Apps til iPhone og Android er på vej og lander snart!
              </span>
            </p>

            <div className="flex flex-col md:flex-row gap-4">
              <a
                href="#features"
                className="inline-flex items-center justify-center px-5 py-3 text-base font-medium text-center text-gray-900 border border-gray-300 rounded-lg bg-white hover:bg-gray-100 transition-colors"
              >
                Se hvordan det virker
              </a>

              <div className="flex items-center gap-4 text-white/80 text-sm mt-2 md:mt-0">
                <div className="flex items-center">
                  <i className="fa-brands fa-apple text-xl mr-2"></i> iOS
                </div>
                <div className="flex items-center">
                  <i className="fa-brands fa-android text-xl mr-2"></i> Android
                </div>
              </div>
            </div>
          </div>

          <div className="hidden lg:mt-0 lg:col-span-5 lg:flex justify-center items-center relative">
            <div className="relative">
              {/* STØRRE TELEFON */}
              <div
                className="mockup-frame w-[340px] h-[700px] bg-black relative z-10 mx-auto border-[14px] border-gray-800 rounded-[3rem] overflow-hidden"
                onTouchStart={handleTouchStart}
                onTouchEnd={handleTouchEnd}
              >
                <div
                  className="flex transition-transform duration-500 ease-in-out h-full w-full"
                  style={{ transform: `translateX(-${currentSlide * 100}%)` }}
                >
                  {slides.map((src, index) => (
                    <div
                      key={index}
                      className="min-w-full h-full bg-gray-900 flex items-center justify-center relative"
                    >
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

                <div className="absolute bottom-5 left-1/2 transform -translate-x-1/2 flex gap-2 z-20">
                  {[...Array(totalSlides)].map((_, index) => (
                    <div
                      key={index}
                      onClick={() => {
                        setCurrentSlide(index);
                        resetAutoPlay();
                      }}
                      className={`h-2 rounded-full cursor-pointer transition-all duration-300 ${
                        index === currentSlide ? 'bg-white w-5' : 'bg-white/40 w-2'
                      }`}
                    />
                  ))}
                </div>
              </div>
            </div>
          </div>
        </div>
      </section>

      {/* --- OPRET BRUGER CTA --- */}
      <section className="py-16 md:py-24 bg-white border-b border-gray-100">
        <div className="max-w-5xl mx-auto px-4">
          <div className="bg-liguster-gradient rounded-[2.5rem] p-10 md:p-16 text-center relative overflow-hidden shadow-2xl">
            
            <div className="relative z-10 flex flex-col items-center">
              {/* Logo i toppen - NU ENDNU STØRRE */}
              <div className="relative w-[500px] h-[165px] mb-10">
                 <Image src="/Liguster-logo-NEG.png" fill className="object-contain" alt="Liguster" />
              </div>
              
              <h2 className="text-3xl md:text-5xl font-black text-white mb-6 tracking-tight">
                Klar til at gøre en forskel lokalt?
              </h2>
              
              <p className="text-blue-100 text-lg md:text-xl max-w-2xl mx-auto mb-10 leading-relaxed">
                Opret en bruger i dag og vær med til at skabe mere liv, tryghed og fællesskab på din vej. 
                Det er gratis, enkelt og tager kun et øjeblik.
              </p>

              {/* RETTET LINK TIL /opret HER */}
              <Link 
                href="/opret" 
                className="bg-white text-[#0b2b52] font-black text-lg px-10 py-4 rounded-full shadow-lg hover:bg-blue-50 hover:scale-105 transition-all duration-300 inline-flex items-center gap-2"
              >
                <i className="fa-solid fa-user-plus"></i>
                Opret bruger nu
              </Link>
            </div>

          </div>
        </div>
      </section>

      {/* Features Section */}
      <section id="features" className="py-16 md:py-24 bg-gray-50">
        <div className="max-w-screen-xl mx-auto px-4">
          <div className="text-center mb-16">
            <h2 className="text-3xl font-bold text-gray-900 mb-4">
              Hvad kan du bruge Liguster til?
            </h2>
            <p className="text-gray-600 max-w-3xl mx-auto">
              Liguster er et lokalt samlingspunkt, hvor du kan dele, låne, hjælpe og organisere fællesskaber – uden støj og med fokus på tryghed.
            </p>
          </div>

          <div className="grid md:grid-cols-2 lg:grid-cols-3 gap-8">
            {/* 1 */}
            <div className="bg-white p-8 rounded-2xl shadow-sm border border-gray-100">
              <div className="w-14 h-14 bg-blue-100 rounded-xl flex items-center justify-center text-blue-600 mb-6 text-2xl">
                <i className="fa-solid fa-pen-to-square"></i>
              </div>
              <h3 className="text-xl font-bold mb-3 text-gray-900">1. Opret opslag</h3>
              <p className="text-gray-600">
                Slå noget op til dit lokalområde eller din gruppe: “Gives væk”, “Søges”, “Lån”, “Hjælp” eller “Event”.
                Det kan være alt fra en stol du vil give videre, til en efterlysning af en stige eller en hjælpende hånd.
              </p>
            </div>

            {/* 2 */}
            <div className="bg-white p-8 rounded-2xl shadow-sm border border-gray-100">
              <div className="w-14 h-14 bg-indigo-100 rounded-xl flex items-center justify-center text-indigo-600 mb-6 text-2xl">
                <i className="fa-solid fa-people-group"></i>
              </div>
              <h3 className="text-xl font-bold mb-3 text-gray-900">2. Opret din egen forening</h3>
              <p className="text-gray-600">
                Lav et fællesskab på få minutter. Det kan være alt fra en grundejerforening og kolonihaveforening
                til en Trivial Pursuit-klub, en løbeklub, en forældregruppe eller en vennegruppe i opgangen.
              </p>
            </div>

            {/* 3 */}
            <div className="bg-white p-8 rounded-2xl shadow-sm border border-gray-100">
              <div className="w-14 h-14 bg-sky-100 rounded-xl flex items-center justify-center text-sky-600 mb-6 text-2xl">
                <i className="fa-solid fa-screwdriver-wrench"></i>
              </div>
              <h3 className="text-xl font-bold mb-3 text-gray-900">3. Lån og udlån</h3>
              <p className="text-gray-600">
                Lån værktøj og hverdagsting i nærheden: boremaskine, trailer, stige, festborde eller en højtryksrenser.
                Når du låner noget ud, kan du tilbyde et “tilgode” – så det bliver nemt at hjælpe hinanden igen senere.
              </p>
            </div>

            {/* 4 */}
            <div className="bg-white p-8 rounded-2xl shadow-sm border border-gray-100">
              <div className="w-14 h-14 bg-emerald-100 rounded-xl flex items-center justify-center text-emerald-600 mb-6 text-2xl">
                <i className="fa-solid fa-handshake-angle"></i>
              </div>
              <h3 className="text-xl font-bold mb-3 text-gray-900">4. Tilbyd og få hjælp</h3>
              <p className="text-gray-600">
                Spørg om hjælp eller tilbyd en hånd: bære en sofa op, vande planter i ferien, passe en kat,
                samle et IKEA-møbel eller hente en pakke. Små ting, der gør hverdagen lettere – lokalt.
              </p>
            </div>

            {/* 5 */}
            <div className="bg-white p-8 rounded-2xl shadow-sm border border-gray-100">
              <div className="w-14 h-14 bg-amber-100 rounded-xl flex items-center justify-center text-amber-600 mb-6 text-2xl">
                <i className="fa-solid fa-calendar-check"></i>
              </div>
              <h3 className="text-xl font-bold mb-3 text-gray-900">5. Saml folk om aktiviteter</h3>
              <p className="text-gray-600">
                Lav opslag til aktiviteter og aftaler: arbejdsdag, fællesspisning, bytte-dag, spilaften,
                julehygge eller en tur i skoven. Nemt at samle folk – uden at det drukner i kommentarer og støj.
              </p>
            </div>

            {/* 6 */}
            <div className="bg-white p-8 rounded-2xl shadow-sm border border-gray-100">
              <div className="w-14 h-14 bg-rose-100 rounded-xl flex items-center justify-center text-rose-600 mb-6 text-2xl">
                <i className="fa-solid fa-shield-halved"></i>
              </div>
              <h3 className="text-xl font-bold mb-3 text-gray-900">6. Hold det trygt og overskueligt</h3>
              <p className="text-gray-600">
                Liguster er bygget til at undgå konflikter: ingen offentlige kommentarspor i opslag.
                Dialog foregår i privatbeskeder. Sikkerhed og god tone er tænkt ind fra start.
              </p>
            </div>
          </div>
        </div>
      </section>

      {/* Footer */}
      <footer className="bg-gray-950 text-gray-400 py-12 border-t border-gray-800 text-center mt-auto">
        <div className="max-w-screen-xl mx-auto px-4">
          
          <div className="flex justify-center mb-6">
            <div className="relative h-10 w-40 opacity-80">
              <Image src="/Liguster-logo-NEG.png" alt="Logo" fill className="object-contain" />
            </div>
          </div>

          <div className="flex flex-col items-center gap-3">
            <p className="text-sm">&copy; 2026 Liguster Systemer. Alle rettigheder forbeholdes.</p>
            
            <div className="flex gap-4 text-xs font-medium">
              <Link href="/privatliv" className="text-gray-500 hover:text-white transition-colors">
                Privatlivspolitik
              </Link>
              <span className="text-gray-700">•</span>
              <Link href="/vilkaar" className="text-gray-500 hover:text-white transition-colors">
                Brugervilkår
              </Link>
            </div>
          </div>

        </div>
      </footer>
    </div>
  );
}