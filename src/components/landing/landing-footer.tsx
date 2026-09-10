import Link from 'next/link';
import Image from 'next/image';
import { Github } from 'lucide-react';
import { Button } from '@/components/ui/button';

export function LandingFooter() {
  return (
    <footer className="border-t bg-muted/30">
      <div className="container mx-auto px-4 py-10">
        <div className="flex flex-col md:flex-row items-center justify-between gap-6">
          <div className="flex flex-col items-center md:items-start gap-1">
            <Link href="/" className="flex items-center gap-2 text-lg font-bold">
              <Image src="/fairpricing.svg" alt="" width={30} height={30}/>FairPricing
            </Link>
            <p className="text-sm text-muted-foreground">
              Smarter regional pricing for the App Store and Google Play.
            </p>
            <a
              href="https://github.com/andyshephard/PricingKit"
              target="_blank"
              rel="noopener noreferrer"
              className="flex items-center gap-1.5 text-sm text-muted-foreground hover:text-foreground transition-colors mt-1"
            >
              <Github className="h-4 w-4" />
              Built on PricingKit · GPL-3.0
            </a>
          </div>

          <div className="flex flex-col items-center md:items-end gap-2"><Link href="/about" className="text-sm underline">Source, data & privacy</Link>
            <Button variant="outline" size="sm" asChild>
              <Link href="/#calculator">Pricing calculator</Link>
            </Button>
          </div>
        </div>
      </div>
    </footer>
  );
}
