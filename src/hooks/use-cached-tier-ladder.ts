'use client';

import { useCallback, useEffect, useState } from 'react';
import { isLadderFresh, type LadderKind, type TierLadder } from '@/lib/apple-connect/tier-ladder';
import { loadLadder } from '@/lib/apple-connect/tier-ladder-store';

/**
 * The fresh cached ladder for a kind, or null. Lets the preview table match
 * tiers against Apple's real price points instead of the bundled snapshot.
 * Call `reload()` after a resolution stores a new ladder.
 */
export function useCachedTierLadder(kind: LadderKind, enabled = true) {
  const [ladder, setLadder] = useState<TierLadder | null>(null);
  const [version, setVersion] = useState(0);
  const reload = useCallback(() => setVersion((v) => v + 1), []);

  useEffect(() => {
    if (!enabled) return;
    let cancelled = false;
    loadLadder(kind).then((stored) => {
      if (!cancelled) setLadder(stored && isLadderFresh(stored) ? stored : null);
    });
    return () => {
      cancelled = true;
    };
  }, [kind, enabled, version]);

  return { ladder, reload };
}
