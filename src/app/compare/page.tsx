import type { Metadata } from 'next';
import { LandingNav } from '@/components/landing/landing-nav';
import { LandingFooter } from '@/components/landing/landing-footer';
import { CompareIndexes } from '@/components/compare/compare-indexes';

export const metadata: Metadata = {
  title: 'Compare indexes — FairPricing',
  description:
    'See what World Bank PPP, the Big Mac Index, the Netflix Index, GDP-adjusted pricing and straight currency conversion would each charge in every Google Play market, side by side.',
};

export default function ComparePage() {
  return (
    <div className="landing-page min-h-screen bg-background">
      <LandingNav />
      <CompareIndexes />
      <LandingFooter />
    </div>
  );
}
