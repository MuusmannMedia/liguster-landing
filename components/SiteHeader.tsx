'use client';

import { useCallback, useEffect, useMemo, useState } from 'react';
import Link from 'next/link';
import Image from 'next/image';
import { usePathname, useRouter } from 'next/navigation';
import { supabase } from '../lib/supabaseClient';

export default function SiteHeader() {
  const pathname = usePathname();
  const router = useRouter();

  const [unreadMsgCount, setUnreadMsgCount] = useState(0);
  const [foreningBadgeCount, setForeningBadgeCount] = useState(0);

  const fetchBadges = useCallback(async (uid: string) => {
    try {
      const { count: msgCount } = await supabase
        .from('messages')
        .select('*', { count: 'exact', head: true })
        .eq('receiver_id', uid)
        .eq('is_read', false);

      setUnreadMsgCount(msgCount || 0);

      const { data: adminRoles } = await supabase
        .from('foreningsmedlemmer')
        .select('forening_id')
        .eq('user_id', uid)
        .eq('rolle', 'admin');

      const myForeningIds = adminRoles?.map((role) => role.forening_id) ?? [];

      if (myForeningIds.length === 0) {
        setForeningBadgeCount(0);
        return;
      }

      const { count: pendingCount } = await supabase
        .from('foreningsmedlemmer')
        .select('*', { count: 'exact', head: true })
        .in('forening_id', myForeningIds)
        .eq('status', 'pending');

      setForeningBadgeCount(pendingCount || 0);
    } catch (error) {
      console.error('Error fetching badges:', error);
    }
  }, []);

  useEffect(() => {
    let isCancelled = false;
    let channel: ReturnType<typeof supabase.channel> | null = null;

    const init = async () => {
      const {
        data: { session },
      } = await supabase.auth.getSession();

      if (!session) {
        setUnreadMsgCount(0);
        setForeningBadgeCount(0);
        return;
      }

      const uid = session.user.id;
      if (isCancelled) return;

      await fetchBadges(uid);
      if (isCancelled) return;

      channel = supabase
        .channel(`header-badges-${uid}`)
        .on(
          'postgres_changes',
          {
            event: '*',
            schema: 'public',
            table: 'messages',
            filter: `receiver_id=eq.${uid}`,
          },
          () => {
            void fetchBadges(uid);
          }
        )
        .on(
          'postgres_changes',
          {
            event: '*',
            schema: 'public',
            table: 'foreningsmedlemmer',
            filter: 'status=eq.pending',
          },
          () => {
            void fetchBadges(uid);
          }
        )
        .subscribe();
    };

    void init();

    return () => {
      isCancelled = true;
      if (channel) {
        void supabase.removeChannel(channel);
      }
    };
  }, [fetchBadges]);

  const menuItems = useMemo(
    () => [
      { name: 'Opslag', href: '/opslag', icon: 'fa-layer-group', badge: 0 },
      { name: 'Forening', href: '/forening', icon: 'fa-people-roof', badge: foreningBadgeCount },
      { name: 'Beskeder', href: '/beskeder', icon: 'fa-comments', badge: unreadMsgCount },
      { name: 'Mine opslag', href: '/mine-opslag', icon: 'fa-box-open', badge: 0 },
      { name: 'Mine naboer', href: '/mine-naboer', icon: 'fa-users', badge: 0 },
      { name: 'Mig', href: '/mig', icon: 'fa-user', badge: 0 },
    ],
    [foreningBadgeCount, unreadMsgCount]
  );

  const handleLogout = async () => {
    await supabase.auth.signOut();
    router.replace('/');
  };

  return (
    <nav className="bg-[#131921] text-white sticky top-0 z-[100] shadow-md border-b border-gray-800">
      <div className="max-w-6xl mx-auto px-4">
        <div className="flex justify-between h-16">
          <div className="flex-shrink-0 flex items-center">
            <Link href="/opslag" className="relative h-8 w-32 opacity-90 hover:opacity-100 transition-opacity">
              <Image
                src="/Liguster-logo-NEG.png"
                alt="Liguster"
                fill
                className="object-contain object-left"
                sizes="128px"
                quality={85}
              />
            </Link>
          </div>

          <div className="flex space-x-1 md:space-x-4">
            {menuItems.map((item) => {
              const isActive = pathname === item.href || pathname?.startsWith(item.href + '/');

              return (
                <Link
                  key={item.name}
                  href={item.href}
                  className={`relative inline-flex flex-col items-center justify-center px-3 md:px-4 py-2 text-xs md:text-sm font-medium transition-colors duration-200 border-b-2
                    ${
                      isActive
                        ? 'border-white text-white'
                        : 'border-transparent text-gray-400 hover:text-gray-200 hover:border-gray-600'
                    }`}
                >
                  <div className="relative">
                    <i className={`fa-solid ${item.icon} mb-1 text-sm md:text-lg`} aria-hidden="true"></i>

                    {item.badge > 0 && (
                      <span className="absolute -top-1.5 -right-2 flex h-3 w-3">
                        <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-red-400 opacity-75"></span>
                        <span className="relative inline-flex rounded-full h-3 w-3 bg-red-600 border-2 border-[#131921]"></span>
                      </span>
                    )}
                  </div>

                  <span className="hidden md:inline">{item.name}</span>
                </Link>
              );
            })}

            <button
              onClick={handleLogout}
              className="inline-flex flex-col items-center justify-center px-3 md:px-4 py-2 text-xs md:text-sm font-medium transition-colors duration-200 border-b-2 border-transparent text-gray-400 hover:text-red-400 hover:border-red-400"
              title="Log ud"
            >
              <i className="fa-solid fa-right-from-bracket mb-1 text-sm md:text-lg" aria-hidden="true"></i>
              <span className="hidden md:inline">Log ud</span>
            </button>
          </div>
        </div>
      </div>
    </nav>
  );
}
