'use client';

import { useState } from 'react';
import { useQuery } from '@tanstack/react-query';
import { toast } from 'sonner';
import { Header, PageHeader } from '@/components/layout';
import { SubscriptionsTable } from '@/components/subscriptions/subscriptions-table';
import { BulkUpdateModal } from '@/components/pricing/bulk-update-modal';
import { Button } from '@/components/ui/button';
import { useSelectionStore } from '@/store/selection-store';
import type { SubscriptionsListResponse } from '@/types/api';

export default function GoogleSubscriptionsPage() {
  const [searchQuery, setSearchQuery] = useState('');
  const [bulkModalOpen, setBulkModalOpen] = useState(false);

  const { data, isLoading, refetch, isRefetching, error } = useQuery<SubscriptionsListResponse>({
    queryKey: ['subscriptions', 'google'],
    queryFn: async () => {
      const response = await fetch('/api/subscriptions');
      if (!response.ok) {
        if (response.status === 401) {
          throw new Error('401: Unauthorized');
        }
        const error = await response.json();
        throw new Error(error.error || 'Failed to fetch subscriptions');
      }
      return response.json();
    },
  });

  const { selectedSubscriptionIds, setSelectedSubscriptions } = useSelectionStore();

  if (error) {
    toast.error(error.message);
  }

  const subscriptions = data?.subscriptions || [];

  return (
    <div className="flex flex-col h-full">
      <Header
        onRefresh={() => refetch()}
        isRefreshing={isRefetching}
        searchValue={searchQuery}
        onSearchChange={setSearchQuery}
      />

      <div className="flex-1 space-y-6 p-6">
        <PageHeader eyebrow="Google Play" title="Subscriptions" description="Manage subscription base plans and regional pricing" />

        {selectedSubscriptionIds.length > 0 && (
          <div className="flex flex-wrap items-center gap-3 rounded-xl border border-primary/30 bg-primary/5 px-4 py-3">
            <span className="text-sm font-medium">{selectedSubscriptionIds.length} selected</span>
            <div className="ml-auto flex items-center gap-2">
              <Button variant="outline" size="sm" onClick={() => setSelectedSubscriptions([])}>
                Clear
              </Button>
              <Button size="sm" onClick={() => setBulkModalOpen(true)}>
                Bulk update prices
              </Button>
            </div>
          </div>
        )}

        <SubscriptionsTable
          subscriptions={subscriptions}
          isLoading={isLoading}
          selectedIds={selectedSubscriptionIds}
          onSelectionChange={setSelectedSubscriptions}
          searchQuery={searchQuery}
          platform="google"
        />
      </div>

      <BulkUpdateModal
        open={bulkModalOpen}
        onOpenChange={setBulkModalOpen}
        type="subscription"
        selectedIds={selectedSubscriptionIds}
        onSuccess={() => {
          setSelectedSubscriptions([]);
          refetch();
        }}
      />
    </div>
  );
}
