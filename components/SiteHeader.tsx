'use client';

import Link from 'next/link';
import Image from 'next/image';
import { usePathname } from 'next/navigation';

export default function SiteHeader() {
  const pathname = usePathname();

  const menuItems = [
    { name: 'Opslag', href: '/opslag', icon: 'fa-layer-group' },
    { name: 'Forening', href: '/forening', icon: 'fa-people-roof' },
    { name: 'Beskeder', href: '/beskeder', icon: 'fa-comments' },
    { name: 'Mine opslag', href: '/mine-opslag', icon: 'fa-box-open' },
    { name: 'Mig', href: '/mig', icon: 'fa-user' },
  ];

  return (
    <nav className="bg-[#131921] text-white sticky top-0 z-[100] shadow-md border-b border-gray-800">
      {/* Hent FontAwesome til ikoner */}
      <link rel="stylesheet" href="https://cdnjs.cloudflare.com/ajax/libs/font-awesome/6.4.0/css/all.min.css" />

      <div className="max-w-6xl mx-auto px-4">
        <div className="flex justify-between h-16">
          
          {/* Logo (Venstre) */}
          <div className="flex-shrink-0 flex items-center">
            <Link href="/opslag" className="relative h-8 w-32 opacity-90 hover:opacity-100 transition-opacity">
               <Image 
                 src="/Liguster-logo-NEG.png" 
                 alt="Liguster" 
                 fill 
                 className="object-contain object-left"
               />
            </Link>
          </div>

          {/* Menu (Højre) */}
          <div className="flex space-x-1 md:space-x-4">
            {menuItems.map((item) => {
              const isActive = pathname === item.href;
              return (
                <Link
                  key={item.name}
                  href={item.href}
                  className={`inline-flex flex-col items-center justify-center px-3 md:px-4 py-2 text-xs md:text-sm font-medium transition-colors duration-200 border-b-2 
                    ${isActive 
                      ? 'border-white text-white' 
                      : 'border-transparent text-gray-400 hover:text-gray-200 hover:border-gray-600'
                    }`}
                >
                  <i className={`fa-solid ${item.icon} mb-1 text-sm md:text-lg`}></i>
                  <span className="hidden md:inline">{item.name}</span>
                </Link>
              );
            })}
          </div>

        </div>
      </div>
    </nav>
  );
}