'use client';

import Link from 'next/link';
import Image from 'next/image';
import { usePathname } from 'next/navigation';
import {
  Package,
  CreditCard,
  LayoutDashboard,
  Settings,
  DollarSign,
  Scale,
} from 'lucide-react';
import { useEffect } from 'react';
import { cn } from '@/lib/utils';
import { ScrollArea } from '@/components/ui/scroll-area';
import { useAuthStore } from '@/store/auth-store';
import { PlatformSelector } from './platform-selector';
import { AppSwitcher } from './app-switcher';
import { getPlatformFromPath, type Platform } from '@/lib/utils/platform-routes';

export function Sidebar() {
  const pathname = usePathname();
  const storedPlatform = useAuthStore((state) => state.platform);
  const setPlatform = useAuthStore((state) => state.setPlatform);
  const isGoogleAuthenticated = useAuthStore((state) => state.isGoogleAuthenticated);
  const isAppleAuthenticated = useAuthStore((state) => state.isAppleAuthenticated);

  // The URL is the source of truth on platform routes. Off-route pages such as
  // Settings fall back to the store's active platform, so the nav keeps
  // pointing at the connected store instead of greying out.
  const routePlatform = getPlatformFromPath(pathname);
  const authenticatedFor = (platform: Platform | null) =>
    (platform === 'google' && isGoogleAuthenticated) || (platform === 'apple' && isAppleAuthenticated);
  const currentPlatform: Platform | null =
    routePlatform ??
    (authenticatedFor(storedPlatform) ? storedPlatform : isGoogleAuthenticated ? 'google' : isAppleAuthenticated ? 'apple' : null);

  useEffect(() => {
    if (routePlatform && routePlatform !== storedPlatform) setPlatform(routePlatform);
  }, [routePlatform, storedPlatform, setPlatform]);

  // Build platform-specific navigation links
  const getNavigation = (platform: Platform | null) => {
    if (!platform) {
      return [
        { name: 'Overview', href: '/dashboard', icon: LayoutDashboard, disabled: false },
        { name: 'Products', href: '/dashboard/products', icon: Package, disabled: true },
        { name: 'Subscriptions', href: '/dashboard/subscriptions', icon: CreditCard, disabled: true },
        { name: 'Settings', href: '/dashboard/settings', icon: Settings, disabled: false },
      ];
    }

    const basePath = `/dashboard/${platform}`;
    const items = [
      { name: 'Overview', href: basePath, icon: LayoutDashboard, disabled: false },
      { name: 'Products', href: `${basePath}/products`, icon: Package, disabled: false },
      { name: 'Subscriptions', href: `${basePath}/subscriptions`, icon: CreditCard, disabled: false },
      { name: 'Settings', href: '/dashboard/settings', icon: Settings, disabled: false },
    ];

    if (platform === 'apple') {
      // Insert "App Price" before Settings
      items.splice(-1, 0, {
        name: 'App Price',
        href: `${basePath}/app-price`,
        icon: DollarSign,
        disabled: false,
      });
    }

    return items;
  };

  const navigation = getNavigation(currentPlatform);

  return (
    <div className="bg-sidebar flex h-full w-64 flex-col border-r">
      <div className="flex h-16 items-center border-b px-4">
        <Link href="/dashboard" className="flex items-center gap-2 text-lg font-bold">
          <Image src="/fairpricing.svg" alt="" width={26} height={26} />
          FairPricing
        </Link>
      </div>

      {/* Platform Selector */}
      <div className="space-y-2 border-b px-3 py-3">
        <PlatformSelector currentPlatform={currentPlatform} />
        <AppSwitcher />
      </div>

      <ScrollArea className="flex-1 px-3 py-4">
        <p className="mb-2 px-3 text-xs font-medium tracking-wide text-muted-foreground uppercase">Manage</p>
        <nav className="flex flex-col gap-1">
          {navigation.map((item) => {
            // Determine if this item is active
            const isActive = currentPlatform
              ? item.href === `/dashboard/${currentPlatform}`
                ? pathname === `/dashboard/${currentPlatform}`
                : pathname.startsWith(item.href)
              : item.href === '/dashboard'
                ? pathname === '/dashboard'
                : pathname.startsWith(item.href);

            if (item.disabled) {
              return (
                <span
                  key={item.name}
                  className="flex cursor-not-allowed items-center gap-3 rounded-lg py-2 pr-3 pl-4 text-sm text-muted-foreground/50"
                >
                  <item.icon className="h-4 w-4" />
                  {item.name}
                </span>
              );
            }

            return (
              <Link
                key={item.name}
                href={item.href}
                className={cn(
                  'relative flex items-center gap-3 rounded-lg py-2 pr-3 pl-4 text-sm transition-colors',
                  'before:absolute before:top-1.5 before:bottom-1.5 before:left-0 before:w-0.5 before:rounded-full before:transition-colors',
                  isActive
                    ? 'bg-primary/10 font-medium text-foreground before:bg-primary'
                    : 'text-muted-foreground before:bg-transparent hover:bg-muted hover:text-foreground'
                )}
              >
                <item.icon className={cn('h-4 w-4', isActive && 'text-primary')} />
                {item.name}
              </Link>
            );
          })}
        </nav>
      </ScrollArea>

      <div className="border-t p-3">
        <Link
          href="/compare"
          className="flex items-center gap-3 rounded-lg px-3 py-2 text-sm text-muted-foreground transition-colors hover:bg-muted hover:text-foreground"
        >
          <Scale className="h-4 w-4" />
          Compare indexes
        </Link>
      </div>
    </div>
  );
}
