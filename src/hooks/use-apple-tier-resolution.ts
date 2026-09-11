'use client';

import { useCallback, useState } from 'react';
import { useStreamingMutation, type StreamProgress } from './use-streaming-mutation';
import { isLadderFresh, ladderAgreesWith, resolveWithLadder, type LadderKind, type TierLadder } from '@/lib/apple-connect/tier-ladder';
import { clearLadder, loadLadder, saveLadder } from '@/lib/apple-connect/tier-ladder-store';
import type { SourceProbe, LadderFetchResult } from '@/lib/apple-connect/ladder-server';

export interface TierResolutionRequest {
  /** Route id: the product sku or the subscription id. */
  id: string;
  /** Keyed by the caller's own code. `territory` is the Apple alpha-3; defaults to the key. */
  territories: Record<string, { targetPrice: number; currency: string; maxPrice?: number; territory?: string }>;
  /** Ignore any cached ladder and fetch a fresh one. */
  refresh?: boolean;
}

export interface TierResolutionResult {
  resolved: Record<string, { pricePointId: string; tierPrice: number }>;
  skipped: string[];
  /** How the tiers were obtained. Null means the per-territory live resolve was used (no cache involved). */
  ladder: { fetchedAt: string; source: 'cache' | 'live' } | null;
}

type BatchResult = { resolved: Record<string, { pricePointId: string; tierPrice: number }>; skipped: string[] };

const base = (kind: LadderKind, id: string) =>
  `/api/apple/${kind === 'iap' ? 'products' : 'subscriptions'}/${encodeURIComponent(id)}/price-points`;

/**
 * Resolve Apple price points for a set of territories, using a cached tier
 * ladder when one is fresh and still agrees with a live sample, and the full
 * per-territory fetch otherwise. Every run re-verifies the id scheme against a
 * real id from this product before synthesising anything.
 */
export function useAppleTierResolution(kind: LadderKind) {
  const ladderFetch = useStreamingMutation<LadderFetchResult>();
  const batch = useStreamingMutation<BatchResult>();
  const [phase, setPhase] = useState<'probe' | 'ladder' | 'resolve' | null>(null);

  const mutateAsync = useCallback(
    async ({ id, territories, refresh = false }: TierResolutionRequest): Promise<TierResolutionResult> => {
      const url = base(kind, id);
      try {
        setPhase('probe');
        const probeResponse = await fetch(`${url}/ladder`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ mode: 'probe' }),
        });
        const probe: SourceProbe | null = probeResponse.ok ? await probeResponse.json() : null;

        if (probe?.schemeOk && probe.sourceId) {
          let ladder: TierLadder | null = refresh ? null : await loadLadder(kind);
          let source: 'cache' | 'live' = 'cache';
          if (ladder && !(isLadderFresh(ladder) && probe.sample && ladderAgreesWith(ladder, probe.sample))) ladder = null;

          if (!ladder) {
            setPhase('ladder');
            const fetched = await ladderFetch.mutateAsync(`${url}/ladder`, {
              method: 'POST',
              headers: { 'Content-Type': 'application/json' },
              body: JSON.stringify({ mode: 'full' }),
            });
            if (fetched.schemeOk) {
              ladder = fetched.ladder;
              source = 'live';
              await saveLadder(ladder);
            }
          }

          if (ladder) {
            const byTerritory: Record<string, { targetPrice: number; maxPrice?: number }> = {};
            const keyFor: Record<string, string> = {};
            for (const [key, t] of Object.entries(territories)) {
              const alpha3 = t.territory ?? key;
              byTerritory[alpha3] = { targetPrice: t.targetPrice, maxPrice: t.maxPrice };
              keyFor[alpha3] = key;
            }
            const local = resolveWithLadder(ladder, probe.sourceId, byTerritory);
            return {
              resolved: Object.fromEntries(Object.entries(local.resolved).map(([alpha3, r]) => [keyFor[alpha3], r])),
              skipped: local.skipped.map((alpha3) => keyFor[alpha3]),
              ladder: { fetchedAt: ladder.fetchedAt, source },
            };
          }
        }

        // The scheme did not verify, or the ladder could not be built: ask
        // Apple for every territory directly, exactly as before.
        setPhase('resolve');
        const live = await batch.mutateAsync(`${url}/batch`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            territories: Object.fromEntries(
              Object.entries(territories).map(([key, t]) => [key, { targetPrice: t.targetPrice, currency: t.currency, maxPrice: t.maxPrice }])
            ),
          }),
        });
        return { ...live, ladder: null };
      } finally {
        setPhase(null);
      }
    },
    [kind, ladderFetch, batch]
  );

  /** Forget the cached ladder — call after a write rejects a price point. */
  const invalidate = useCallback(() => clearLadder(kind), [kind]);

  const progress: StreamProgress | null = phase === 'ladder' ? ladderFetch.progress : phase === 'resolve' ? batch.progress : null;
  const label =
    phase === 'probe'
      ? 'Checking App Store tiers…'
      : phase === 'ladder'
        ? progress ? `Fetching App Store tiers ${progress.completed} of ${progress.total}…` : 'Fetching App Store tiers…'
        : phase === 'resolve'
          ? progress ? `Resolving price points ${progress.completed} of ${progress.total}…` : 'Resolving price points…'
          : null;

  return { mutateAsync, invalidate, isPending: phase !== null, phase, progress, label };
}
