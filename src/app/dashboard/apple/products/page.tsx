'use client';

import { useState } from 'react';
import { useQuery } from '@tanstack/react-query';
import { toast } from 'sonner';
import { Header, PageHeader } from '@/components/layout';
import { ProductsTable } from '@/components/products/products-table';
import { BulkUpdateModal } from '@/components/pricing/bulk-update-modal';
import { Button } from '@/components/ui/button';
import { useSelectionStore } from '@/store/selection-store';
import { parseMoney } from '@/lib/google-play/types';
import type { RawAppleProduct, ProductsListResponse } from '@/types/api';

export default function AppleProductsPage() {
  const [searchQuery, setSearchQuery] = useState('');
  const [bulkModalOpen, setBulkModalOpen] = useState(false);

  const { data, isLoading, refetch, isRefetching, error } = useQuery<ProductsListResponse>({
    queryKey: ['products', 'apple'],
    queryFn: async () => {
      const response = await fetch('/api/apple/products');
      if (!response.ok) {
        if (response.status === 401) {
          throw new Error('401: Unauthorized');
        }
        const error = await response.json();
        throw new Error(error.error || 'Failed to fetch products');
      }
      const data = await response.json();

      // Normalize Apple products for the table
      if (data.products) {
        data.products = data.products.map((p: RawAppleProduct) => {
          const baseTerritoryCode = p.baseTerritory || 'USA';
          const basePrice = p.prices?.[baseTerritoryCode] || Object.values(p.prices || {})[0] || null;

          const defaultPrice = basePrice
            ? parseMoney(parseFloat(basePrice.customerPrice), basePrice.currency || 'USD')
            : null;

          return {
            sku: p.productId,
            status: p.state === 'APPROVED' ? 'active' : 'inactive',
            purchaseType: p.type,
            listings: { 'en-US': { title: p.name } },
            defaultPrice,
            prices: p.prices || {},
            _appleProduct: p,
          };
        });
      }

      return data;
    },
  });

  const { selectedProductSkus, setSelectedProducts } = useSelectionStore();

  if (error) {
    toast.error(error.message);
  }

  const products = data?.products || [];

  return (
    <div className="flex flex-col h-full">
      <Header
        onRefresh={() => refetch()}
        isRefreshing={isRefetching}
        searchValue={searchQuery}
        onSearchChange={setSearchQuery}
      />

      <div className="flex-1 space-y-6 p-6">
        <PageHeader eyebrow="App Store" title="In-App Products" description="Manage pricing for one-time purchase products" />

        {selectedProductSkus.length > 0 && (
          <div className="flex flex-wrap items-center gap-3 rounded-xl border border-primary/30 bg-primary/5 px-4 py-3">
            <span className="text-sm font-medium">{selectedProductSkus.length} selected</span>
            <div className="ml-auto flex items-center gap-2">
              <Button variant="outline" size="sm" onClick={() => setSelectedProducts([])}>
                Clear
              </Button>
              <Button size="sm" onClick={() => setBulkModalOpen(true)}>
                Bulk update prices
              </Button>
            </div>
          </div>
        )}

        <ProductsTable
          products={products}
          isLoading={isLoading}
          selectedSkus={selectedProductSkus}
          onSelectionChange={setSelectedProducts}
          searchQuery={searchQuery}
          platform="apple"
        />
      </div>

      <BulkUpdateModal
        open={bulkModalOpen}
        onOpenChange={setBulkModalOpen}
        type="product"
        selectedIds={selectedProductSkus}
        onSuccess={() => {
          setSelectedProducts([]);
          refetch();
        }}
      />
    </div>
  );
}
