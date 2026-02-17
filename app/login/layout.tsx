import type { Metadata } from 'next';

export const metadata: Metadata = {
  title: 'Log ind',
  description: 'Log ind på Liguster og få adgang til opslag, foreninger og beskeder.',
  alternates: {
    canonical: '/login',
  },
};

export default function LoginLayout({ children }: { children: React.ReactNode }) {
  return children;
}
