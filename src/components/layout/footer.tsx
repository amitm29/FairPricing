import Link from 'next/link';
import { Github } from 'lucide-react';
import { Button } from '@/components/ui/button';

export function Footer() {
  return (
    <footer className="border-t bg-background">
      <div className="mx-auto flex max-w-7xl flex-wrap items-center justify-between gap-4 px-6 py-6 text-sm text-muted-foreground">
        <span>&copy; {new Date().getFullYear()} FairPricing</span>
        <div className="flex flex-wrap items-center gap-4">
          <Link href="/about" className="transition-colors hover:text-foreground">
            Source, data &amp; privacy
          </Link>
          <Button variant="outline" size="sm" asChild>
            <Link href="/compare">Compare indexes</Link>
          </Button>
          <a
            href="https://github.com/andyshephard/PricingKit"
            target="_blank"
            rel="noopener noreferrer"
            className="flex items-center gap-1.5 hover:text-foreground transition-colors"
          >
            <Github className="h-4 w-4" />
            <span>Built on PricingKit · GPL-3.0</span>
          </a>
        </div>
      </div>
    </footer>
  );
}
