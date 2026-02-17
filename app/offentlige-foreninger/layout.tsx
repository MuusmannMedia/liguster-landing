import type { Metadata } from 'next';

export const metadata: Metadata = {
  title: 'Offentlige foreninger',
  description: 'Find offentlige foreninger og fællesskaber i dit lokalområde på Liguster.',
  alternates: {
    canonical: '/offentlige-foreninger',
  },
};

export default function OffentligeForeningerLayout({ children }: { children: React.ReactNode }) {
  return children;
}
