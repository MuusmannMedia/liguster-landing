import type { Metadata } from 'next';

export const metadata: Metadata = {
  title: 'Opret bruger',
  description: 'Opret en gratis bruger på Liguster og deltag i dit lokale fællesskab.',
  alternates: {
    canonical: '/opret',
  },
};

export default function OpretLayout({ children }: { children: React.ReactNode }) {
  return children;
}
