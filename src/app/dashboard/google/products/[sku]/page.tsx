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
import { PricingEditor } from '@/components/products/pricing-editor';
import { formatMoney } from '@/lib/google-play/types';
import type { ProductResponse } from '@/types/api';

export default function GoogleProductDetailPage({
  params,
}: {
  params: Promise<{ sku: string }>;
}) {
  const { sku } = use(params);
  const decodedSku = decodeURIComponent(sku);

  const { data, isLoading, error, refetch, isRefetching } = useQuery<ProductResponse>({
    queryKey: ['products', 'google', decodedSku],
    queryFn: async () => {
      const response = await fetch(`/api/products/${encodeURIComponent(decodedSku)}`);
      if (!response.ok) {
        if (response.status === 401) {
          throw new Error('401: Unauthorized');
        }
        const error = await response.json();
        throw new Error(error.error || 'Failed to fetch product');
      }
      return response.json();
    },
    enabled: !!decodedSku,
  });

  if (error) {
    toast.error(error.message);
  }

  const product = data?.product;

  const getProductTitle = () => {
    if (!product) return decodedSku;
    const listing = product.listings?.[product.defaultLanguage];
    return listing?.title || product.sku;
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
            href="/dashboard/google/products"
            className="inline-flex items-center gap-1.5 text-sm text-muted-foreground transition-colors hover:text-foreground"
          >
            <ArrowLeft className="h-4 w-4" />
            Products
          </Link>
          {isLoading ? (
            <Skeleton className="mt-4 h-8 w-64" />
          ) : (
            <div className="mt-4">
              <p className="mb-2 text-sm font-medium text-primary">Google Play · Product</p>
              <h1 className="text-2xl font-semibold tracking-tight">{getProductTitle()}</h1>
              <p className="mt-1 font-mono text-sm text-muted-foreground">{decodedSku}</p>
            </div>
          )}
        </div>

        {isLoading ? (
          <div className="space-y-4">
            <Skeleton className="h-32 w-full" />
            <Skeleton className="h-64 w-full" />
          </div>
        ) : product ? (
          <>
            <Card>
              <CardHeader>
                <CardTitle className="text-xs font-medium tracking-wide text-muted-foreground uppercase">Product Details</CardTitle>
              </CardHeader>
              <CardContent>
                <div className="grid md:grid-cols-2 lg:grid-cols-4 gap-4">
                  <div>
                    <p className="text-xs font-medium tracking-wide text-muted-foreground uppercase">Status</p>
                    <Badge
                      variant={product.status === 'active' ? 'tint' : 'secondary'}
                      className="mt-1"
                    >
                      {product.status}
                    </Badge>
                  </div>
                  <div>
                    <p className="text-xs font-medium tracking-wide text-muted-foreground uppercase">Type</p>
                    <p className="mt-1 text-lg font-semibold tabular-nums">
                      {product.purchaseType === 'managedUser'
                        ? 'Managed Product'
                        : product.purchaseType}
                    </p>
                  </div>
                  <div>
                    <p className="text-sm text-muted-foreground">Default Price</p>
                    <p className="font-medium mt-1">
                      {product.defaultPrice
                        ? formatMoney(product.defaultPrice)
                        : 'Not set'}
                    </p>
                  </div>
                  <div>
                    <p className="text-sm text-muted-foreground">Regional Prices</p>
                    <p className="font-medium mt-1">
                      {Object.keys(product.prices || {}).length} regions
                    </p>
                  </div>
                </div>

                {product.listings?.[product.defaultLanguage]?.description && (
                  <div className="mt-4 pt-4 border-t">
                    <p className="text-sm text-muted-foreground">Description</p>
                    <p className="mt-1">
                      {product.listings[product.defaultLanguage].description}
                    </p>
                  </div>
                )}
              </CardContent>
            </Card>

            <PricingEditor product={product} />
          </>
        ) : (
          <Card>
            <CardContent className="py-12 text-center">
              <p className="text-muted-foreground">Product not found</p>
              <Button variant="outline" className="mt-4" asChild>
                <Link href="/dashboard/google/products">Back to Products</Link>
              </Button>
            </CardContent>
          </Card>
        )}
      </div>
    </div>
  );
}
