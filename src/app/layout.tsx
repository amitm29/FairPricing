import type { Metadata } from 'next';
import type { CSSProperties } from 'react';
import '@fontsource-variable/inter';
import './globals.css';
import { Providers } from './providers';

const description = 'Thoughtful regional pricing for the App Store and Google Play. Compare six pricing strategies, refine local prices, and export a draft before connecting your store.';

export const metadata: Metadata = {
  title: 'FairPricing — Thoughtful pricing, everywhere',
  description,
  openGraph: { title: 'FairPricing — Thoughtful pricing, everywhere', description },
  twitter: { card: 'summary', title: 'FairPricing', description },
  icons: { icon: { url: '/fairpricing.svg', type: 'image/svg+xml' } },
};

export default function RootLayout({ children }: Readonly<{ children: React.ReactNode }>) {
  return (
    <html lang="en" suppressHydrationWarning>
      <body className="antialiased" style={{
        '--font-geist-sans': '"Inter Variable", sans-serif',
        '--font-geist-mono': 'ui-monospace, SFMono-Regular, Menlo, monospace',
        fontFamily: '"Inter Variable", sans-serif',
      } as CSSProperties}>
        <Providers>{children}</Providers>
      </body>
    </html>
  );
}
