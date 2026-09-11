import { describe, expect, it } from 'vitest';
import { fetchLadder, probeSource, type PointsFetcher } from '../ladder-server';
import { encodePricePointId } from '../price-point-id';
import type { AppleConnectCredentials } from '../types';

const credentials = {} as AppleConnectCredentials;
const fast = { concurrency: 20, delayBetweenBatches: 0, maxRetries: 0, retryDelay: 0 };
const SOURCE = '6797491358';

// A fake App Store: three rungs per territory, ids in Apple's real (unpadded) shape.
const fakeFetcher: PointsFetcher = async (_c, territory) =>
  [['10001', '0.99'], ['10222', '28.99'], ['10222', '28.99'], ['10240', '29.99']].map(([ref, price]) => ({
    id: encodePricePointId({ sourceId: SOURCE, territoryCode: territory, tierRef: ref }),
    customerPrice: price,
  }));

describe('probeSource', () => {
  it('learns the source id and verifies the scheme from one real id', async () => {
    const probe = await probeSource(credentials, fakeFetcher, 'USA');
    expect(probe.schemeOk).toBe(true);
    expect(probe.sourceId).toBe(SOURCE);
    expect(probe.sample).toEqual({ territoryCode: 'USA', tierRef: '10001', price: 0.99 });
  });
  it('refuses to trust ids that do not round-trip', async () => {
    const odd: PointsFetcher = async () => [{ id: 'opaque-not-json', customerPrice: '0.99' }];
    const probe = await probeSource(credentials, odd, 'USA');
    expect(probe.schemeOk).toBe(false);
    expect(probe.sourceId).toBeNull();
  });
});

describe('fetchLadder', () => {
  it('builds a per-territory ladder, deduplicated and sorted, and reports progress', async () => {
    const seen: number[] = [];
    const result = await fetchLadder(credentials, fakeFetcher, 'subscription', 'sub-1', (done, total) => seen.push(done / total), fast);
    expect(result.schemeOk).toBe(true);
    expect(result.sourceId).toBe(SOURCE);
    expect(result.ladder.kind).toBe('subscription');
    expect(result.ladder.territories.USA).toEqual([{ price: 0.99, ref: '10001' }, { price: 28.99, ref: '10222' }, { price: 29.99, ref: '10240' }]);
    expect(Object.keys(result.ladder.territories).length).toBeGreaterThan(100);
    expect(seen.at(-1)).toBe(1);
  });
  it('marks the ladder untrusted if any id fails to round-trip', async () => {
    const flaky: PointsFetcher = async (_c, territory) =>
      territory === 'DEU' ? [{ id: 'garbage', customerPrice: '1.99' }] : fakeFetcher(_c, territory);
    const result = await fetchLadder(credentials, flaky, 'iap', 'sku', undefined, fast);
    expect(result.schemeOk).toBe(false);
    expect(result.sourceId).toBeNull();
  });
  it('records territories Apple returned nothing for', async () => {
    const sparse: PointsFetcher = async (_c, territory) => (territory === 'DEU' ? [] : fakeFetcher(_c, territory));
    const result = await fetchLadder(credentials, sparse, 'iap', 'sku', undefined, fast);
    expect(result.empty).toContain('DEU');
    expect(result.ladder.territories.DEU).toBeUndefined();
  });
});
