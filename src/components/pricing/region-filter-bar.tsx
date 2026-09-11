'use client';

import { Search, X } from 'lucide-react';
import { cn } from '@/lib/utils';

/**
 * View filters for a bulk-pricing region table. These narrow what is shown;
 * they never change what is selected, so "Select all" keeps meaning all.
 */
export function RegionFilterBar({
  query,
  onQueryChange,
  onlyModified,
  onOnlyModifiedChange,
  shown,
  total,
  modified,
}: {
  query: string;
  onQueryChange: (value: string) => void;
  onlyModified: boolean;
  onOnlyModifiedChange: (value: boolean) => void;
  shown: number;
  total: number;
  modified: number;
}) {
  const filtered = shown !== total;
  return (
    <div className="flex flex-wrap items-center gap-2">
      <label className="relative min-w-[200px] flex-1 sm:max-w-xs">
        <span className="sr-only">Search regions</span>
        <Search aria-hidden="true" className="absolute top-1/2 left-2.5 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
        <input
          type="search"
          value={query}
          onChange={(e) => onQueryChange(e.target.value)}
          placeholder="Search country, code or currency"
          className="h-9 w-full rounded-md border bg-background pr-8 pl-8 text-sm outline-none focus-visible:border-ring focus-visible:ring-[3px] focus-visible:ring-ring/50 [&::-webkit-search-cancel-button]:appearance-none"
        />
        {query && (
          <button
            type="button"
            onClick={() => onQueryChange('')}
            aria-label="Clear search"
            className="absolute top-1/2 right-1.5 -translate-y-1/2 rounded p-1 text-muted-foreground hover:bg-muted hover:text-foreground"
          >
            <X className="h-3.5 w-3.5" />
          </button>
        )}
      </label>

      <div className="inline-flex rounded-md border bg-muted/40 p-0.5" role="group" aria-label="Filter regions">
        {([
          ['all', 'All', total],
          ['modified', 'Modified', modified],
        ] as const).map(([value, label, count]) => {
          const active = value === 'modified' ? onlyModified : !onlyModified;
          return (
            <button
              key={value}
              type="button"
              aria-pressed={active}
              onClick={() => onOnlyModifiedChange(value === 'modified')}
              className={cn(
                'rounded px-2.5 py-1 text-xs transition-colors',
                active ? 'bg-background font-medium text-foreground shadow-xs' : 'text-muted-foreground hover:text-foreground'
              )}
            >
              {label}
              <span className="ml-1 tabular-nums text-muted-foreground">{count}</span>
            </button>
          );
        })}
      </div>

      <span className="ml-auto text-xs text-muted-foreground tabular-nums" aria-live="polite">
        {filtered ? `Showing ${shown} of ${total}` : `${total} regions`}
      </span>
    </div>
  );
}
