'use client';

import React, { useCallback, useEffect, useRef, useState } from 'react';
import Image from 'next/image';
import Link from 'next/link';

const slides = [
  '/landing/app-01.jpg',
  '/landing/app-02.jpg',
  '/landing/app-03.jpg',
  '/landing/app-04.jpg',
  '/landing/app-05.jpg',
  '/landing/app-06.jpg',
  '/landing/app-07.jpg',
  '/landing/app-08.jpg',
  '/landing/app-09.jpg',
  '/landing/app-10.jpg',
] as const;

const totalSlides = slides.length;

export default function LigusterLandingPage() {
  const [currentSlide, setCurrentSlide] = useState(0);
  const [shareFeedback, setShareFeedback] = useState('');

  const autoPlayRef = useRef<NodeJS.Timeout | null>(null);
  const feedbackTimeoutRef = useRef<NodeJS.Timeout | null>(null);
  const touchStartXRef = useRef<number | null>(null);

  const clearAutoPlay = useCallback(() => {
    if (autoPlayRef.current) {
      clearInterval(autoPlayRef.current);
      autoPlayRef.current = null;
    }
  }, []);

  const nextSlide = useCallback(() => {
    setCurrentSlide((prev) => (prev + 1) % totalSlides);
  }, []);

  const prevSlide = useCallback(() => {
    setCurrentSlide((prev) => (prev === 0 ? totalSlides - 1 : prev - 1));
  }, []);

  const resetAutoPlay = useCallback(() => {
    clearAutoPlay();
    autoPlayRef.current = setInterval(nextSlide, 3500);
  }, [clearAutoPlay, nextSlide]);

  const setTemporaryFeedback = useCallback((message: string) => {
    setShareFeedback(message);

    if (feedbackTimeoutRef.current) {
      clearTimeout(feedbackTimeoutRef.current);
    }

    feedbackTimeoutRef.current = setTimeout(() => {
      setShareFeedback('');
    }, 3000);
  }, []);

  useEffect(() => {
    resetAutoPlay();

    return () => {
      clearAutoPlay();
      if (feedbackTimeoutRef.current) {
        clearTimeout(feedbackTimeoutRef.current);
      }
    };
  }, [clearAutoPlay, resetAutoPlay]);

  const handleShare = useCallback(async () => {
    const shareData = {
      title: 'Liguster',
      text: 'Hej! Jeg har fundet den her nye app til nabolaget. Skal vi ikke prøve den?',
      url: window.location.href,
    };

    if (navigator.share) {
      try {
        await navigator.share(shareData);
        setTemporaryFeedback('Tak fordi du deler!');
      } catch {
        // Brugeren annullerede deling
      }
      return;
    }

    try {
      await navigator.clipboard.writeText(window.location.href);
      setTemporaryFeedback('Link kopieret! Indsæt det i en besked.');
    } catch {
      setTemporaryFeedback('Kunne ikke kopiere linket');
    }
  }, [setTemporaryFeedback]);

  const handleTouchStart = useCallback((e: React.TouchEvent) => {
    touchStartXRef.current = e.targetTouches[0].clientX;
    clearAutoPlay();
  }, [clearAutoPlay]);

  const handleTouchEnd = useCallback((e: React.TouchEvent) => {
    if (touchStartXRef.current === null) {
      resetAutoPlay();
      return;
    }

    const touchEndX = e.changedTouches[0].clientX;
    const delta = touchStartXRef.current - touchEndX;

    if (delta > 50) {
      nextSlide();
    } else if (delta < -50) {
      prevSlide();
    }

    touchStartXRef.current = null;
    resetAutoPlay();
  }, [nextSlide, prevSlide, resetAutoPlay]);

  const previousSlideIndex = (currentSlide - 1 + totalSlides) % totalSlides;
  const nextSlideIndex = (currentSlide + 1) % totalSlides;

  return (
    <div className="font-sans text-gray-800 bg-gray-50 min-h-screen pb-0">
      <style jsx global>{`
        .bg-liguster-gradient {
          background: linear-gradient(135deg, #071a2f 0%, #0b2b52 100%);
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

      <nav className="absolute inset-x-0 top-0 z-20 border-b border-white/10 bg-[#071a2f]/35 backdrop-blur-sm">
        <div className="max-w-screen-xl mx-auto px-3 py-3 md:p-4">
          <div className="flex items-center justify-between gap-3">
            <Link href="/" className="relative h-12 w-28 md:h-16 md:w-56 shrink-0">
              <Image
                src="/Liguster-logo-NEG.png"
                alt="Liguster Logo"
                fill
                className="object-contain object-left"
                priority
                sizes="(min-width: 768px) 224px, 112px"
                quality={85}
              />
            </Link>

            <div className="flex items-center gap-2">
              <Link
                href="/offentlige-opslag"
                className="hidden sm:inline-flex text-white hover:text-white/80 font-bold text-sm px-3 py-2 transition-all items-center"
              >
                Opslag
              </Link>

              <Link
                href="/offentlige-foreninger"
                className="hidden sm:inline-flex text-white hover:text-white/80 font-bold text-sm px-3 py-2 transition-all items-center"
              >
                Foreninger
              </Link>

              <Link
                href="/login"
                className="text-white bg-white/20 hover:bg-white/30 font-medium rounded-lg text-sm px-4 py-2 md:px-5 md:py-2.5 transition-all border border-white/40 inline-flex items-center"
              >
                <i className="fa-solid fa-right-to-bracket mr-2" aria-hidden="true"></i> Log ind
              </Link>
            </div>
          </div>

          <div className="mt-2 grid grid-cols-2 gap-2 sm:hidden">
            <Link
              href="/offentlige-opslag"
              className="text-white/95 font-bold text-sm px-3 py-2 rounded-lg border border-white/25 text-center hover:bg-white/10 transition-colors"
            >
              Opslag
            </Link>
            <Link
              href="/offentlige-foreninger"
              className="text-white/95 font-bold text-sm px-3 py-2 rounded-lg border border-white/25 text-center hover:bg-white/10 transition-colors"
            >
              Foreninger
            </Link>
          </div>
        </div>
      </nav>

      <section className="bg-liguster-gradient relative min-h-[95vh] flex items-center overflow-hidden">
        <div className="grid max-w-screen-xl px-4 py-8 mx-auto lg:gap-8 xl:gap-0 lg:py-16 lg:grid-cols-12 relative z-10 pt-44 sm:pt-36 md:pt-0">
          <div className="mr-auto place-self-center lg:col-span-7 fade-in-up">
            <span className="bg-white/10 text-white text-xs font-medium px-2.5 py-0.5 rounded-full mb-4 inline-block border border-white/20">
              Aktiv Beta: Prøv appen nu
            </span>

            <h1 className="max-w-2xl mb-4 text-4xl font-extrabold tracking-tight leading-none md:text-5xl xl:text-6xl text-white">
              Del, lån og hjælp lokalt
            </h1>

            <p className="max-w-2xl mb-6 font-light text-gray-200 lg:mb-8 md:text-lg lg:text-xl">
              Liguster gør det nemt at give ting videre, låne værktøj og tilbyde hjælp i nabolaget - med fokus på tryghed,
              enkelhed og en grønnere hverdag.
            </p>

            <div className="max-w-xl mb-8 p-6 bg-white/5 border border-white/10 rounded-2xl backdrop-blur-sm">
              <h3 className="text-white font-bold mb-2 flex items-center gap-2">
                <i className="fa-brands fa-apple text-xl" aria-hidden="true"></i>
                Prøv beta-versionen på iPhone
              </h3>
              <p className="text-gray-300 text-sm mb-4">
                Vi tester i øjeblikket appen via Apples <strong>TestFlight</strong>. Som beta-tester får du direkte adgang til de nyeste funktioner før alle andre.
              </p>
              <div className="flex flex-wrap gap-4 items-center">
                <a
                  href="https://testflight.apple.com/join/YVUVvbZp"
                  target="_blank"
                  rel="noopener noreferrer"
                  className="inline-flex items-center justify-center px-5 py-3 text-sm font-bold text-center text-[#0b2b52] bg-white rounded-lg hover:bg-blue-50 transition-all shadow-lg hover:scale-[1.02]"
                >
                  <i className="fa-solid fa-download mr-2" aria-hidden="true"></i>
                  Hent via TestFlight
                </a>
                <div className="flex items-center text-gray-400 text-xs italic">
                  <i className="fa-brands fa-android mr-2 text-base" aria-hidden="true"></i>
                  Android version lander snart!
                </div>
              </div>
            </div>

            <div className="flex flex-col md:flex-row gap-4 items-start md:items-center">
              <a
                href="#features"
                className="inline-flex items-center justify-center px-5 py-3 text-base font-medium text-center text-white border border-white/30 rounded-lg hover:bg-white/10 transition-colors backdrop-blur-sm"
              >
                Se hvordan det virker
              </a>

              <button
                onClick={handleShare}
                className="inline-flex items-center justify-center px-5 py-3 text-base font-medium text-center text-white border border-white/30 rounded-lg hover:bg-white/10 transition-colors backdrop-blur-sm group"
              >
                <i className="fa-solid fa-share-nodes mr-2 group-hover:scale-110 transition-transform" aria-hidden="true"></i>
                Tip en nabo
              </button>
            </div>

            {shareFeedback && (
              <div className="mt-3 text-green-300 font-bold text-sm animate-pulse">
                <i className="fa-solid fa-check mr-2" aria-hidden="true"></i>
                {shareFeedback}
              </div>
            )}
          </div>

          <div className="hidden lg:mt-0 lg:col-span-5 lg:flex justify-center items-center relative">
            <div className="relative">
              <div
                className="mockup-frame w-[340px] h-[700px] bg-black relative z-10 mx-auto border-[14px] border-gray-800 rounded-[3rem] overflow-hidden"
                onTouchStart={handleTouchStart}
                onTouchEnd={handleTouchEnd}
              >
                <div
                  className="flex transition-transform duration-500 ease-in-out h-full w-full"
                  style={{ transform: `translateX(-${currentSlide * 100}%)` }}
                >
                  {slides.map((src, index) => {
                    const shouldRender =
                      index === currentSlide || index === previousSlideIndex || index === nextSlideIndex;

                    return (
                      <div
                        key={src}
                        className="min-w-full h-full bg-gray-900 flex items-center justify-center relative"
                      >
                        {shouldRender ? (
                          <Image
                            src={src}
                            alt={`App slide ${index + 1}`}
                            fill
                            className="object-cover"
                            priority={index === 0}
                            quality={70}
                            sizes="340px"
                          />
                        ) : null}
                      </div>
                    );
                  })}
                </div>

                <div className="absolute bottom-5 left-1/2 transform -translate-x-1/2 flex gap-2 z-20">
                  {Array.from({ length: totalSlides }).map((_, index) => (
                    <button
                      key={index}
                      type="button"
                      aria-label={`Gå til slide ${index + 1}`}
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

      <section className="py-16 md:py-24 bg-white border-b border-gray-100">
        <div className="max-w-5xl mx-auto px-4">
          <div className="bg-liguster-gradient rounded-[2.5rem] p-10 md:p-16 text-center relative overflow-hidden shadow-2xl">
            <div className="relative z-10 flex flex-col items-center">
              <div className="relative w-[500px] h-[165px] mb-10 max-w-full">
                <Image
                  src="/Liguster-logo-NEG.png"
                  fill
                  className="object-contain"
                  alt="Liguster"
                  sizes="(min-width: 768px) 500px, 80vw"
                  quality={85}
                />
              </div>

              <h2 className="text-3xl md:text-5xl font-black text-white mb-6 tracking-tight">
                Klar til at gøre en forskel lokalt?
              </h2>

              <p className="text-blue-100 text-lg md:text-xl max-w-2xl mx-auto mb-10 leading-relaxed">
                Opret en bruger i dag og vær med til at skabe mere liv, tryghed og fællesskab på din vej.
                Det er gratis, enkelt og tager kun et øjeblik.
              </p>

              <Link
                href="/opret"
                className="bg-white text-[#0b2b52] font-black text-lg px-10 py-4 rounded-full shadow-lg hover:bg-blue-50 hover:scale-105 transition-all duration-300 inline-flex items-center gap-2"
              >
                <i className="fa-solid fa-user-plus" aria-hidden="true"></i>
                Opret bruger nu
              </Link>
            </div>
          </div>
        </div>
      </section>

      <section id="features" className="py-16 md:py-24 bg-gray-100">
        <div className="max-w-screen-xl mx-auto px-4">
          <div className="text-center mb-16">
            <h2 className="text-3xl font-bold text-gray-900 mb-4">
              Hvad kan du bruge Liguster til?
            </h2>
            <p className="text-gray-600 max-w-3xl mx-auto">
              Liguster er et lokalt samlingspunkt, hvor du kan dele, låne, hjælpe og organisere fællesskaber - uden støj og med fokus på tryghed.
            </p>
          </div>

          <div className="grid md:grid-cols-2 lg:grid-cols-3 gap-8">
            <div className="bg-white p-8 rounded-2xl shadow-sm border border-gray-200">
              <div className="w-14 h-14 bg-blue-100 rounded-xl flex items-center justify-center text-blue-600 mb-6 text-2xl">
                <i className="fa-solid fa-pen-to-square" aria-hidden="true"></i>
              </div>
              <h3 className="text-xl font-bold mb-3 text-gray-900">1. Opret opslag</h3>
              <p className="text-gray-600">
                Slå noget op til dit lokalområde eller din gruppe: &quot;Gives væk&quot;, &quot;Søges&quot;, &quot;Lån&quot;, &quot;Hjælp&quot; eller &quot;Event&quot;.
              </p>
            </div>

            <div className="bg-white p-8 rounded-2xl shadow-sm border border-gray-200">
              <div className="w-14 h-14 bg-indigo-100 rounded-xl flex items-center justify-center text-indigo-600 mb-6 text-2xl">
                <i className="fa-solid fa-people-group" aria-hidden="true"></i>
              </div>
              <h3 className="text-xl font-bold mb-3 text-gray-900">2. Opret din egen forening</h3>
              <p className="text-gray-600">
                Lav et fællesskab på få minutter. Fra grundejerforeninger til små hobbyklubber og løbehold.
              </p>
            </div>

            <div className="bg-white p-8 rounded-2xl shadow-sm border border-gray-200">
              <div className="w-14 h-14 bg-sky-100 rounded-xl flex items-center justify-center text-sky-600 mb-6 text-2xl">
                <i className="fa-solid fa-screwdriver-wrench" aria-hidden="true"></i>
              </div>
              <h3 className="text-xl font-bold mb-3 text-gray-900">3. Lån og udlån</h3>
              <p className="text-gray-600">
                Lån værktøj og hverdagsting i nærheden. Spar penge og plads ved at dele med naboerne.
              </p>
            </div>

            <div className="bg-white p-8 rounded-2xl shadow-sm border border-gray-200">
              <div className="w-14 h-14 bg-emerald-100 rounded-xl flex items-center justify-center text-emerald-600 mb-6 text-2xl">
                <i className="fa-solid fa-handshake-angle" aria-hidden="true"></i>
              </div>
              <h3 className="text-xl font-bold mb-3 text-gray-900">4. Tilbyd og få hjælp</h3>
              <p className="text-gray-600">
                Vand planter i ferien eller få hjælp til at bære en sofa. Små ting, der styrker fællesskabet.
              </p>
            </div>

            <div className="bg-white p-8 rounded-2xl shadow-sm border border-gray-200">
              <div className="w-14 h-14 bg-amber-100 rounded-xl flex items-center justify-center text-amber-600 mb-6 text-2xl">
                <i className="fa-solid fa-calendar-check" aria-hidden="true"></i>
              </div>
              <h3 className="text-xl font-bold mb-3 text-gray-900">5. Saml folk om aktiviteter</h3>
              <p className="text-gray-600">
                Arranger arbejdsdage, fællesspisning eller byttedage. Nemt og overskueligt for alle deltagere.
              </p>
            </div>

            <div className="bg-white p-8 rounded-2xl shadow-sm border border-gray-200">
              <div className="w-14 h-14 bg-rose-100 rounded-xl flex items-center justify-center text-rose-600 mb-6 text-2xl">
                <i className="fa-solid fa-shield-halved" aria-hidden="true"></i>
              </div>
              <h3 className="text-xl font-bold mb-3 text-gray-900">6. Hold det trygt</h3>
              <p className="text-gray-600">
                Ingen offentlige kommentarspor. Dialog foregår privat, så vi undgår støj og misforståelser.
              </p>
            </div>
          </div>
        </div>
      </section>

      <footer className="bg-gray-950 text-gray-400 py-12 border-t border-gray-800 text-center mt-auto">
        <div className="max-w-screen-xl mx-auto px-4">
          <div className="flex justify-center mb-6">
            <div className="relative h-10 w-40 opacity-80">
              <Image
                src="/Liguster-logo-NEG.png"
                alt="Logo"
                fill
                className="object-contain"
                sizes="160px"
                quality={85}
              />
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
