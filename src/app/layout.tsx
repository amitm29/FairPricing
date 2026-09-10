import type { Metadata } from 'next';
import type { CSSProperties } from 'react';
import '@fontsource-variable/inter';
import './globals.css';
import { Providers } from './providers';

const description = 'Thoughtful regional pricing for the App Store and Google Play. Compare six pricing strategies, refine local prices, and export a draft before connecting your store.';
const socialTitle = 'FairPricing — Local prices. Global potential.';
const socialDescription = 'Price your app for each market. Compare six regional pricing strategies, review local prices, and apply updates to the App Store and Google Play. Free and open source.';

export const metadata: Metadata = {
  title: 'FairPricing — Thoughtful pricing, everywhere',
  description,
  openGraph: { type: 'website', siteName: 'FairPricing', title: socialTitle, description: socialDescription },
  twitter: { card: 'summary_large_image', title: socialTitle, description: socialDescription },
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
