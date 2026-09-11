import { encodePricePointId } from './price-point-id';

/**
 * A "ladder" is App Store Connect's list of price points for one territory:
 * every customer price Apple allows there, each with the tier reference that
 * identifies it. The ladder is the same for every product in the app — only
 * the product's source id differs in the final price point id — which is what
 * makes it worth caching: fetch it once, resolve every product against it.
 */
export type LadderKind = 'iap' | 'subscription';

export interface LadderRung {
  price: number;
  ref: string;
}

export interface TierLadder {
  kind: LadderKind;
  /** ISO timestamp of the fetch. */
  fetchedAt: string;
  /** The product or subscription the ladder was fetched through (for the record only). */
  fetchedVia: string;
  /** Alpha-3 territory → rungs, ascending by price. */
  territories: Record<string, LadderRung[]>;
}

/** Apple changes price points rarely and announces it; a week keeps refetches rare without going stale for long. */
export const LADDER_TTL_MS = 7 * 24 * 60 * 60 * 1000;

export function ladderAgeMs(ladder: TierLadder, now = Date.now()): number {
  return Math.max(0, now - Date.parse(ladder.fetchedAt));
}

export function isLadderFresh(ladder: TierLadder, now = Date.now()): boolean {
  const age = ladderAgeMs(ladder, now);
  return Number.isFinite(age) && age < LADDER_TTL_MS;
}

/** "just now", "3 hours ago", "2 days ago" — for the freshness line. */
export function describeLadderAge(ladder: TierLadder, now = Date.now()): string {
  const ms = ladderAgeMs(ladder, now);
  const minutes = Math.floor(ms / 60_000);
  if (minutes < 1) return 'just now';
  if (minutes < 60) return `${minutes} minute${minutes === 1 ? '' : 's'} ago`;
  const hours = Math.floor(minutes / 60);
  if (hours < 24) return `${hours} hour${hours === 1 ? '' : 's'} ago`;
  const days = Math.floor(hours / 24);
  return `${days} day${days === 1 ? '' : 's'} ago`;
}

/** The rung nearest `target`, optionally capped, or null when the territory has no rungs under the cap. */
export function closestRung(rungs: LadderRung[] | undefined, target: number, maxPrice?: number): LadderRung | null {
  if (!rungs?.length) return null;
  let best: LadderRung | null = null;
  for (const rung of rungs) {
    if (maxPrice !== undefined && rung.price > maxPrice) continue;
    if (!best || Math.abs(rung.price - target) < Math.abs(best.price - target)) best = rung;
  }
  return best;
}

export interface LadderResolution {
  resolved: Record<string, { pricePointId: string; tierPrice: number }>;
  skipped: string[];
}

/**
 * Resolve target prices against a cached ladder, synthesising each price point
 * id from the product's source id. Callers must have verified the id scheme
 * with `roundTrips()` on a real id from this product before trusting this.
 */
export function resolveWithLadder(
  ladder: TierLadder,
  sourceId: string,
  territories: Record<string, { targetPrice: number; maxPrice?: number }>
): LadderResolution {
  const resolved: LadderResolution['resolved'] = {};
  const skipped: string[] = [];
  for (const [territoryCode, { targetPrice, maxPrice }] of Object.entries(territories)) {
    const rung = closestRung(ladder.territories[territoryCode], targetPrice, maxPrice);
    if (!rung) {
      skipped.push(territoryCode);
      continue;
    }
    resolved[territoryCode] = {
      pricePointId: encodePricePointId({ sourceId, territoryCode, tierRef: rung.ref }),
      tierPrice: rung.price,
    };
  }
  return { resolved, skipped };
}

/**
 * A one-call staleness probe: given one real price point fetched just now,
 * does the cached ladder still agree on what that tier costs there? If Apple
 * has moved prices since the fetch, this catches it without refetching all
 * 175 territories.
 */
export function ladderAgreesWith(ladder: TierLadder, sample: { territoryCode: string; tierRef: string; price: number }): boolean {
  const rung = ladder.territories[sample.territoryCode]?.find((r) => r.ref === sample.tierRef);
  return rung !== undefined && Math.abs(rung.price - sample.price) < 0.005;
}
