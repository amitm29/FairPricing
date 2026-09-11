'use client';

import { useMemo } from 'react';
import { AlertTriangle, Loader2, RefreshCw } from 'lucide-react';
import { describeLadderAge } from '@/lib/apple-connect/tier-ladder';
import { Button } from '@/components/ui/button';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import { formatPrice } from '@/lib/fairpricing/workspace';

export interface ResolvedPriceRow {
  code: string;
  name: string;
  currency: string;
  /** What the store charges today, if the territory is already priced. */
  current: number | null;
  /** What the modal showed, from the bundled tier snapshot. */
  previewed: number;
  /** What App Store Connect actually resolved. */
  resolved: number;
}

/**
 * Split resolved rows into those Apple priced differently from the preview and
 * those it matched. Anything beyond half a cent counts as different; the
 * differing rows come back largest deviation first so the worst surprise is
 * the first line read.
 */
export function partitionResolved(rows: ResolvedPriceRow[]): { differing: ResolvedPriceRow[]; matching: ResolvedPriceRow[] } {
  const differing: ResolvedPriceRow[] = [];
  const matching: ResolvedPriceRow[] = [];
  for (const row of rows) (Math.abs(row.resolved - row.previewed) > 0.005 ? differing : matching).push(row);
  differing.sort((a, b) => Math.abs(b.resolved / b.previewed - 1) - Math.abs(a.resolved / a.previewed - 1));
  return { differing, matching };
}

/**
 * The last thing a developer sees before Apple prices are written: what App
 * Store Connect actually resolved, with any territory that landed somewhere
 * other than the preview called out first. Nothing is written until Confirm.
 */
export function ResolvedPricesReview({
  open,
  onOpenChange,
  rows,
  skipped,
  unchangedCount,
  isApplying,
  applyProgress,
  onConfirm,
  ladder,
  onRefresh,
  isRefreshing = false,
}: {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  rows: ResolvedPriceRow[];
  skipped: { code: string; name: string }[];
  unchangedCount: number;
  isApplying: boolean;
  applyProgress?: string | null;
  onConfirm: () => void;
  /** How the tiers were obtained; null when resolved territory by territory. */
  ladder?: { fetchedAt: string; source: 'cache' | 'live' } | null;
  /** Re-fetch the tier ladder from App Store Connect and resolve again. */
  onRefresh?: () => void;
  isRefreshing?: boolean;
}) {
  const { differing, matching } = useMemo(() => partitionResolved(rows), [rows]);

  const delta = (row: ResolvedPriceRow) => {
    const pct = (row.resolved / row.previewed - 1) * 100;
    return `${pct > 0 ? '+' : ''}${pct.toFixed(1)}%`;
  };

  return (
    <Dialog open={open} onOpenChange={(next) => { if (!isApplying) onOpenChange(next); }}>
      <DialogContent className="flex max-h-[85vh] flex-col overflow-hidden sm:max-w-2xl">
        <DialogHeader className="shrink-0">
          <DialogTitle>Review what App Store Connect resolved</DialogTitle>
          <DialogDescription>
            These are the prices Apple will actually charge, resolved against App Store Connect&rsquo;s own price points
            rather than the bundled snapshot the preview uses.
          </DialogDescription>
        </DialogHeader>

        <div className="flex shrink-0 flex-wrap items-center gap-x-3 gap-y-1 rounded-lg border bg-muted/20 px-3 py-2 text-xs text-muted-foreground">
          {ladder ? (
            <>
              <span>
                Tiers from App Store Connect, fetched{' '}
                <span className="font-medium text-foreground">
                  {ladder.source === 'live' ? 'just now' : describeLadderAge({ kind: 'iap', fetchedAt: ladder.fetchedAt, fetchedVia: '', territories: {} })}
                </span>
                {ladder.source === 'cache' && ' and checked against a live sample'}.
              </span>
              {onRefresh && ladder.source === 'cache' && (
                <button
                  type="button"
                  onClick={onRefresh}
                  disabled={isApplying || isRefreshing}
                  className="ml-auto inline-flex items-center gap-1 rounded px-1.5 py-0.5 font-medium text-foreground transition-colors hover:bg-muted disabled:opacity-50"
                >
                  <RefreshCw className={`h-3 w-3 ${isRefreshing ? 'animate-spin' : ''}`} />
                  {isRefreshing ? 'Refreshing…' : 'Refresh from App Store'}
                </button>
              )}
            </>
          ) : (
            <span>Resolved territory by territory against App Store Connect.</span>
          )}
        </div>

        <div className="grid shrink-0 grid-cols-2 gap-3 sm:grid-cols-4">
          <Stat label="Will be written" value={rows.length} />
          <Stat label="Differ from preview" value={differing.length} emphasis={differing.length > 0 ? 'warning' : undefined} />
          <Stat label="Skipped" value={skipped.length} emphasis={skipped.length > 0 ? 'warning' : undefined} />
          <Stat label="Unchanged" value={unchangedCount} />
        </div>

        {/* A plain scroller: a Radix ScrollArea viewport is height:100%, which
            cannot resolve inside a max-h dialog and grows to the full list. */}
        <div className="min-h-0 flex-1 overflow-y-auto rounded-lg border">
          <div className="divide-y">
            {differing.length > 0 && (
              <section>
                <h4 className="sticky top-0 z-10 flex items-center gap-2 bg-background px-4 py-2 text-xs font-medium tracking-wide text-muted-foreground uppercase">
                  <AlertTriangle className="h-3.5 w-3.5 text-warning" />
                  Resolved differently from the preview ({differing.length})
                </h4>
                {differing.map((row) => (
                  <div key={row.code} className="flex items-center gap-3 border-t bg-warning/5 px-4 py-2.5 text-sm">
                    <span className="w-10 shrink-0 font-mono text-xs text-muted-foreground">{row.code}</span>
                    <span className="min-w-0 flex-1 truncate">{row.name}</span>
                    <span className="text-muted-foreground tabular-nums line-through">{formatPrice(row.previewed, row.currency)}</span>
                    <span aria-hidden="true" className="text-muted-foreground">→</span>
                    <span className="font-medium tabular-nums">{formatPrice(row.resolved, row.currency)}</span>
                    <span className="w-14 text-right text-xs text-muted-foreground tabular-nums">{delta(row)}</span>
                  </div>
                ))}
              </section>
            )}

            {skipped.length > 0 && (
              <section>
                <h4 className="sticky top-0 z-10 flex items-center gap-2 bg-background px-4 py-2 text-xs font-medium tracking-wide text-muted-foreground uppercase">
                  <AlertTriangle className="h-3.5 w-3.5 text-warning" />
                  No price point found — will be skipped ({skipped.length})
                </h4>
                <p className="border-t px-4 py-2.5 text-sm text-muted-foreground">
                  {skipped.map((s) => `${s.name} (${s.code})`).join(', ')}
                </p>
              </section>
            )}

            {matching.length > 0 && (
              <details className="group" open={differing.length === 0}>
                <summary className="flex cursor-pointer list-none items-center justify-between px-4 py-2 text-xs font-medium tracking-wide text-muted-foreground uppercase [&::-webkit-details-marker]:hidden">
                  As previewed ({matching.length})
                  <span aria-hidden="true" className="text-base transition-transform group-open:rotate-45">+</span>
                </summary>
                {matching.map((row) => (
                  <div key={row.code} className="flex items-center gap-3 border-t px-4 py-2 text-sm">
                    <span className="w-10 shrink-0 font-mono text-xs text-muted-foreground">{row.code}</span>
                    <span className="min-w-0 flex-1 truncate">{row.name}</span>
                    {row.current !== null && Math.abs(row.current - row.resolved) > 0.005 && (
                      <span className="text-muted-foreground tabular-nums line-through">{formatPrice(row.current, row.currency)}</span>
                    )}
                    <span className="font-medium tabular-nums">{formatPrice(row.resolved, row.currency)}</span>
                  </div>
                ))}
              </details>
            )}
          </div>
        </div>

        <DialogFooter className="shrink-0 gap-2">
          <Button variant="outline" onClick={() => onOpenChange(false)} disabled={isApplying}>
            Cancel
          </Button>
          <Button onClick={onConfirm} disabled={isApplying || rows.length === 0}>
            {isApplying ? (
              <>
                <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                {applyProgress ?? 'Applying…'}
              </>
            ) : (
              `Apply ${rows.length} ${rows.length === 1 ? 'price' : 'prices'}`
            )}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

function Stat({ label, value, emphasis }: { label: string; value: number; emphasis?: 'warning' }) {
  return (
    <div className={`rounded-lg border px-3 py-2 ${emphasis === 'warning' ? 'border-warning/30 bg-warning/10' : 'bg-muted/20'}`}>
      <p className="text-[10px] font-medium tracking-wide text-muted-foreground uppercase">{label}</p>
      <p className="mt-0.5 text-lg font-semibold tabular-nums">{value}</p>
    </div>
  );
}
