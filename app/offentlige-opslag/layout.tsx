import type { Metadata } from 'next';

export const metadata: Metadata = {
  title: 'Offentlige opslag',
  description: 'Se offentlige opslag fra nabolaget: køb, salg, hjælp, events og udlån.',
  alternates: {
    canonical: '/offentlige-opslag',
  },
};

export default function OffentligeOpslagLayout({ children }: { children: React.ReactNode }) {
  return children;
}
