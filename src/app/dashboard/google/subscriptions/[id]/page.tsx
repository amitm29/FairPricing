'use client';

import { use } from 'react';
import Link from 'next/link';
import { ArrowLeft } from 'lucide-react';
import { useQuery } from '@tanstack/react-query';
import { toast } from 'sonner';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Skeleton } from '@/components/ui/skeleton';
import { Header } from '@/components/layout';
import { BasePlanEditor } from '@/components/subscriptions/base-plan-editor';
import { formatMoney } from '@/lib/google-play/types';
import type { SubscriptionResponse } from '@/types/api';

export default function GoogleSubscriptionDetailPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = use(params);
  const decodedId = decodeURIComponent(id);

  const { data, isLoading, error, refetch, isRefetching } = useQuery<SubscriptionResponse>({
    queryKey: ['subscriptions', 'google', decodedId],
    queryFn: async () => {
      const response = await fetch(`/api/subscriptions/${encodeURIComponent(decodedId)}`);
      if (!response.ok) {
        if (response.status === 401) {
          throw new Error('401: Unauthorized');
        }
        const error = await response.json();
        throw new Error(error.error || 'Failed to fetch subscription');
      }
      return response.json();
    },
    enabled: !!decodedId,
  });

  if (error) {
    toast.error(error.message);
  }

  const subscription = data?.subscription;

  const getSubscriptionTitle = () => {
    if (!subscription) return decodedId;
    const listing =
      subscription.listings?.find((l) => l.languageCode === 'en-US') ||
      subscription.listings?.[0];
    return listing?.title || subscription.productId;
  };

  const getTotalRegions = () => {
    const regions = new Set<string>();
    subscription?.basePlans?.forEach((bp) => {
      bp.regionalConfigs?.forEach((rc) => regions.add(rc.regionCode));
    });
    return regions.size;
  };

  const getBasePrice = () => {
    // Get US price from first base plan as the base price
    const firstBasePlan = subscription?.basePlans?.[0];
    const usConfig = firstBasePlan?.regionalConfigs?.find(
      (rc) => rc.regionCode === 'US'
    );
    if (usConfig?.price) {
      return formatMoney(usConfig.price);
    }
    return 'Not set';
  };

  return (
    <div className="flex flex-col h-full">
      <Header
        onRefresh={() => refetch()}
        isRefreshing={isRefetching}
        showSearch={false}
      />

      <div className="flex-1 p-6 space-y-6">
        <div>
          <Link
            href="/dashboard/google/subscriptions"
            className="inline-flex items-center gap-1.5 text-sm text-muted-foreground transition-colors hover:text-foreground"
          >
            <ArrowLeft className="h-4 w-4" />
            Subscriptions
          </Link>
          {isLoading ? (
            <Skeleton className="mt-4 h-8 w-64" />
          ) : (
            <div className="mt-4">
              <p className="mb-2 text-sm font-medium text-primary">Google Play · Subscription</p>
              <h1 className="text-2xl font-semibold tracking-tight">{getSubscriptionTitle()}</h1>
              <p className="mt-1 font-mono text-sm text-muted-foreground">{decodedId}</p>
            </div>
          )}
        </div>

        {isLoading ? (
          <div className="space-y-4">
            <Skeleton className="h-32 w-full" />
            <Skeleton className="h-64 w-full" />
          </div>
        ) : subscription ? (
          <>
            <Card>
              <CardHeader>
                <CardTitle className="text-xs font-medium tracking-wide text-muted-foreground uppercase">Subscription Details</CardTitle>
              </CardHeader>
              <CardContent>
                <div className="grid md:grid-cols-2 lg:grid-cols-4 gap-4">
                  <div>
                    <p className="text-xs font-medium tracking-wide text-muted-foreground uppercase">Status</p>
                    <Badge
                      variant={subscription.archived ? 'secondary' : 'tint'}
                      className="mt-1"
                    >
                      {subscription.archived ? 'Archived' : 'Active'}
                    </Badge>
                  </div>
                  <div>
                    <p className="text-xs font-medium tracking-wide text-muted-foreground uppercase">Base Plans</p>
                    <p className="mt-1 text-lg font-semibold tabular-nums">
                      {subscription.basePlans?.length || 0} total
                    </p>
                  </div>
                  <div>
                    <p className="text-xs font-medium tracking-wide text-muted-foreground uppercase">Base Price</p>
                    <p className="mt-1 text-lg font-semibold tabular-nums">{getBasePrice()}</p>
                  </div>
                  <div>
                    <p className="text-xs font-medium tracking-wide text-muted-foreground uppercase">Regions</p>
                    <p className="mt-1 text-lg font-semibold tabular-nums">{getTotalRegions()}</p>
                  </div>
                </div>

                {subscription.listings?.[0]?.description && (
                  <div className="mt-4 pt-4 border-t">
                    <p className="text-sm text-muted-foreground">Description</p>
                    <p className="mt-1">{subscription.listings[0].description}</p>
                  </div>
                )}
              </CardContent>
            </Card>

            <div>
              <h2 className="mb-4 text-xs font-medium tracking-wide text-muted-foreground uppercase">Base Plans</h2>
              <BasePlanEditor subscription={subscription} />
            </div>
          </>
        ) : (
          <Card>
            <CardContent className="py-12 text-center">
              <p className="text-muted-foreground">Subscription not found</p>
              <Button variant="outline" className="mt-4" asChild>
                <Link href="/dashboard/google/subscriptions">Back to Subscriptions</Link>
              </Button>
            </CardContent>
          </Card>
        )}
      </div>
    </div>
  );
}
