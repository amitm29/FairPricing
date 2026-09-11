import type { AppleConnectCredentials } from './types';
import { decodePricePointId, roundTrips } from './price-point-id';
import { getSupportedAppleTerritories, UNSUPPORTED_IAP_TERRITORIES } from './territories';
import { executeWithRateLimit } from '@/lib/utils/rate-limit';
import type { LadderKind, LadderRung, TierLadder } from './tier-ladder';

type PricePoint = { id: string; customerPrice: string };

/** The same pacing the per-territory resolve routes use against App Store Connect. */
export const APPLE_RATE_LIMITS = { concurrency: 3, delayBetweenBatches: 300, maxRetries: 3, retryDelay: 2000 };
export type PointsFetcher = (credentials: AppleConnectCredentials, territoryAlpha3: string) => Promise<PricePoint[]>;

export interface SourceProbe {
  /** The `s` in this product's price point ids, or null if the scheme did not verify. */
  sourceId: string | null;
  /** True only when a real id decoded to {s,t,p} and re-encoded to itself. */
  schemeOk: boolean;
  /** One live price point, for checking a cached ladder without refetching it. */
  sample: { territoryCode: string; tierRef: string; price: number } | null;
}

/**
 * One API call: fetch a single territory's points and learn, from a real id,
 * what this product's source id is and whether ids can be synthesised at all.
 */
export async function probeSource(
  credentials: AppleConnectCredentials,
  fetchPoints: PointsFetcher,
  territoryCode = 'USA'
): Promise<SourceProbe> {
  const points = await fetchPoints(credentials, territoryCode);
  const first = points[0];
  if (!first) return { sourceId: null, schemeOk: false, sample: null };
  const parts = decodePricePointId(first.id);
  const schemeOk = parts !== null && roundTrips(first.id) && parts.territoryCode === territoryCode;
  return {
    sourceId: schemeOk ? parts!.sourceId : null,
    schemeOk,
    sample: parts ? { territoryCode: parts.territoryCode, tierRef: parts.tierRef, price: parseFloat(first.customerPrice) } : null,
  };
}

export interface LadderFetchResult {
  ladder: TierLadder;
  sourceId: string | null;
  /** False if any id failed to round-trip; the ladder is then informational only. */
  schemeOk: boolean;
  /** Territories Apple returned nothing for. */
  empty: string[];
}

/**
 * Every territory's price points, decoded into rungs. Rate-limited exactly
 * like the per-territory resolve, with progress reported per territory.
 */
export async function fetchLadder(
  credentials: AppleConnectCredentials,
  fetchPoints: PointsFetcher,
  kind: LadderKind,
  fetchedVia: string,
  onProgress?: (completed: number, total: number) => void,
  limits: { concurrency: number; delayBetweenBatches: number; maxRetries: number; retryDelay: number } = APPLE_RATE_LIMITS
): Promise<LadderFetchResult> {
  const territories = getSupportedAppleTerritories()
    .map((t) => t.alpha3)
    .filter((alpha3) => kind !== 'iap' || !UNSUPPORTED_IAP_TERRITORIES.includes(alpha3));

  const tasks = territories.map((territoryCode) => async () => ({
    territoryCode,
    points: await fetchPoints(credentials, territoryCode),
  }));
  const results = await executeWithRateLimit(tasks, { ...limits, onProgress });

  let schemeOk = true;
  let sourceId: string | null = null;
  const empty: string[] = [];
  const ladderTerritories: Record<string, LadderRung[]> = {};

  for (const { territoryCode, points } of results) {
    if (points.length === 0) {
      empty.push(territoryCode);
      continue;
    }
    const seen = new Set<string>();
    const rungs: LadderRung[] = [];
    for (const point of points) {
      const parts = decodePricePointId(point.id);
      if (!parts || !roundTrips(point.id) || parts.territoryCode !== territoryCode) {
        schemeOk = false;
        continue;
      }
      sourceId ??= parts.sourceId;
      if (seen.has(parts.tierRef)) continue;
      seen.add(parts.tierRef);
      rungs.push({ price: parseFloat(point.customerPrice), ref: parts.tierRef });
    }
    rungs.sort((a, b) => a.price - b.price);
    ladderTerritories[territoryCode] = rungs;
  }

  return {
    ladder: { kind, fetchedAt: new Date().toISOString(), fetchedVia, territories: ladderTerritories },
    sourceId: schemeOk ? sourceId : null,
    schemeOk,
    empty,
  };
}
