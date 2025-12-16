'use client';

import Image from 'next/image';

export default function SiteFooter() {
  return (
    <footer className="bg-gray-950 text-gray-400 py-12 border-t border-gray-800 text-center mt-auto">
      <div className="max-w-screen-xl mx-auto px-4">
        <div className="flex justify-center mb-6">
          <div className="relative h-8 w-32 opacity-80">
            <Image src="/Liguster-logo-NEG.png" alt="Logo" fill className="object-contain" />
          </div>
        </div>
        <p className="text-sm">&copy; 2025 Liguster Systemer ApS. Alle rettigheder forbeholdes.</p>
      </div>
    </footer>
  );
}