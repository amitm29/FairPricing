'use client';

import { useState } from 'react';
import { useQuery } from '@tanstack/react-query';
import { toast } from 'sonner';
import { Header, PageHeader } from '@/components/layout';
import { ProductsTable } from '@/components/products/products-table';
import { BulkUpdateModal } from '@/components/pricing/bulk-update-modal';
import { Button } from '@/components/ui/button';
import { useSelectionStore } from '@/store/selection-store';
import type { ProductsListResponse } from '@/types/api';

export default function GoogleProductsPage() {
  const [searchQuery, setSearchQuery] = useState('');
  const [bulkModalOpen, setBulkModalOpen] = useState(false);

  const { data, isLoading, refetch, isRefetching, error } = useQuery<ProductsListResponse>({
    queryKey: ['products', 'google'],
    queryFn: async () => {
      const response = await fetch('/api/products');
      if (!response.ok) {
        if (response.status === 401) {
          throw new Error('401: Unauthorized');
        }
        const error = await response.json();
        throw new Error(error.error || 'Failed to fetch products');
      }
      return response.json();
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
        <PageHeader eyebrow="Google Play" title="In-App Products" description="Manage pricing for one-time purchase products" />

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
          platform="google"
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
