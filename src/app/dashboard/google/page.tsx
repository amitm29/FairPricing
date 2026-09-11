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
    activePlans: number;
  };
}

export default function GoogleDashboardPage() {
  const packageName = useAuthStore((state) => state.packageName);

  const { data: stats, isLoading, refetch, isRefetching } = useQuery<StatsResponse>({
    queryKey: ['stats', 'google'],
    queryFn: async () => {
      const [productsRes, subscriptionsRes] = await Promise.all([
        fetch('/api/products'),
        fetch('/api/subscriptions'),
      ]);

      const products = productsRes.ok ? await productsRes.json() : { products: [] };
      const subscriptions = subscriptionsRes.ok
        ? await subscriptionsRes.json()
        : { subscriptions: [] };

      const activeProducts = products.products?.filter(
        (p: { status: string }) => p.status === 'active'
      ).length || 0;

      const activePlans = subscriptions.subscriptions?.reduce(
        (acc: number, sub: { basePlans?: { state: string }[] }) =>
          acc + (sub.basePlans?.filter((bp) => bp.state?.toLowerCase() === 'active').length || 0),
        0
      ) || 0;

      return {
        products: {
          total: products.products?.length || 0,
          active: activeProducts,
        },
        subscriptions: {
          total: subscriptions.subscriptions?.length || 0,
          activePlans,
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
          eyebrow="Google Play"
          title="Overview"
          description={
            <>
              Products and subscriptions for <span className="font-mono text-foreground">{packageName}</span>.
            </>
          }
        />

        <div className="grid gap-4 md:grid-cols-2">
          <StatCard
            label="In-app products"
            value={stats?.products.total ?? 0}
            detail={`${stats?.products.active ?? 0} active`}
            icon={Package}
            href="/dashboard/google/products"
            isLoading={isLoading}
          />
          <StatCard
            label="Subscriptions"
            value={stats?.subscriptions.total ?? 0}
            detail={`${stats?.subscriptions.activePlans ?? 0} active base plans`}
            icon={CreditCard}
            href="/dashboard/google/subscriptions"
            isLoading={isLoading}
          />
        </div>
      </div>
    </div>
  );
}
