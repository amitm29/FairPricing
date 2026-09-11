'use client';

import { useQuery } from '@tanstack/react-query';
import { Package, CreditCard } from 'lucide-react';
import { Header, PageHeader, StatCard } from '@/components/layout';
import { useAuthStore } from '@/store/auth-store';

interface StatsResponse {
  products: {
    total: number;
    active: number;
  };
  subscriptions: {
    total: number;
    active: number;
  };
}

export default function AppleDashboardPage() {
  const bundleId = useAuthStore((state) => state.bundleId);

  const { data: stats, isLoading, refetch, isRefetching } = useQuery<StatsResponse>({
    queryKey: ['stats', 'apple'],
    queryFn: async () => {
      const [productsRes, subscriptionsRes] = await Promise.all([
        fetch('/api/apple/products'),
        fetch('/api/apple/subscriptions'),
      ]);

      const products = productsRes.ok ? await productsRes.json() : { products: [] };
      const subscriptions = subscriptionsRes.ok
        ? await subscriptionsRes.json()
        : { subscriptions: [] };

      // Apple uses different status names
      const activeProducts = products.products?.filter(
        (p: { state: string }) => p.state === 'APPROVED' || p.state === 'READY_TO_SUBMIT'
      ).length || 0;

      const activeSubscriptions = subscriptions.subscriptions?.filter(
        (sub: { state: string }) => sub.state === 'APPROVED' || sub.state === 'READY_TO_SUBMIT'
      ).length || 0;

      return {
        products: {
          total: products.products?.length || 0,
          active: activeProducts,
        },
        subscriptions: {
          total: subscriptions.subscriptions?.length || 0,
          active: activeSubscriptions,
        },
      };
    },
  });

  return (
    <div className="flex flex-col h-full">
      <Header
        onRefresh={() => refetch()}
        isRefreshing={isRefetching}
        showSearch={false}
      />

      <div className="flex-1 space-y-8 p-6">
        <PageHeader
          eyebrow="App Store"
          title="Overview"
          description={
            <>
              Products and subscriptions for <span className="font-mono text-foreground">{bundleId}</span>.
            </>
          }
        />

        <div className="grid gap-4 md:grid-cols-2">
          <StatCard
            label="In-app products"
            value={stats?.products.total ?? 0}
            detail={`${stats?.products.active ?? 0} approved`}
            icon={Package}
            href="/dashboard/apple/products"
            isLoading={isLoading}
          />
          <StatCard
            label="Subscriptions"
            value={stats?.subscriptions.total ?? 0}
            detail={`${stats?.subscriptions.active ?? 0} approved`}
            icon={CreditCard}
            href="/dashboard/apple/subscriptions"
            isLoading={isLoading}
          />
        </div>
      </div>
    </div>
  );
}
