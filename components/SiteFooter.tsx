'use client';

import Image from 'next/image';
import Link from 'next/link';

export default function SiteFooter() {
  return (
    <footer className="bg-gray-950 text-gray-400 py-12 border-t border-gray-800 text-center mt-auto">
      <div className="max-w-screen-xl mx-auto px-4">
        
        {/* Logo */}
        <div className="flex justify-center mb-6">
          <div className="relative h-8 w-32 opacity-80">
            <Image src="/Liguster-logo-NEG.png" alt="Logo" fill className="object-contain" />
          </div>
        </div>

        {/* Copyright & Links */}
        <div className="flex flex-col items-center gap-3">
          <p className="text-sm">&copy; 2026 Liguster Systemer ApS. Alle rettigheder forbeholdes.</p>
          
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
  );
}