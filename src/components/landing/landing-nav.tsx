'use client';
import { ThemeToggle } from '@/components/theme-toggle';

import Link from 'next/link';
import Image from 'next/image';
import { useAuthStore } from '@/store/auth-store';
import { Button } from '@/components/ui/button';

export function LandingNav() {
  const isAuthenticated = useAuthStore((state) => state.isAuthenticated);

  return (
    <header className="sticky top-0 z-50 border-b bg-background/95 backdrop-blur supports-[backdrop-filter]:bg-background/60">
      <div className="container mx-auto flex h-14 items-center justify-between px-4">
        <Link href="/" className="flex items-center gap-2 text-lg font-bold">
          <Image src="/fairpricing.svg" alt="" width={30} height={30}/>FairPricing
        </Link>

        <nav className="flex items-center gap-4"><ThemeToggle/>
          <Link
            href="/#faq"
            className="text-sm text-muted-foreground hover:text-foreground transition-colors"
          >
            FAQ
          </Link>
          {isAuthenticated && (
            <Button variant="outline" size="sm" asChild>
              <Link href="/dashboard">Dashboard</Link>
            </Button>
          )}
          <Button size="sm" asChild>
            <Link href="/setup">Connect store</Link>
          </Button>
        </nav>
      </div>
    </header>
  );
}
