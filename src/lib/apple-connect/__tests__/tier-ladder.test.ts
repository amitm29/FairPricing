import { describe, expect, it } from 'vitest';
import { decodePricePointId } from '../price-point-id';
import { closestRung, describeLadderAge, isLadderFresh, ladderAgreesWith, resolveWithLadder, type TierLadder } from '../tier-ladder';

const ladder: TierLadder = {
  kind: 'iap',
  fetchedAt: new Date('2026-09-10T00:00:00Z').toISOString(),
  fetchedVia: 'em_7199',
  territories: {
    USA: [{ price: 0.99, ref: '10001' }, { price: 27.99, ref: '10200' }, { price: 28.99, ref: '10222' }, { price: 29.99, ref: '10240' }],
    IND: [{ price: 99, ref: '10010' }, { price: 1599, ref: '10300' }, { price: 1699, ref: '10310' }],
  },
};

describe('closestRung', () => {
  it('picks the nearest rung', () => {
    expect(closestRung(ladder.territories.USA, 28.7)?.ref).toBe('10222');
  });
  it('respects a cap by taking the nearest rung under it', () => {
    expect(closestRung(ladder.territories.USA, 28.7, 28)?.ref).toBe('10200');
  });
  it('returns null for an unknown territory or when nothing fits under the cap', () => {
    expect(closestRung(undefined, 5)).toBeNull();
    expect(closestRung(ladder.territories.USA, 5, 0.5)).toBeNull();
  });
});

describe('resolveWithLadder', () => {
  it('synthesises a product-specific id from the shared tier ref', () => {
    const { resolved, skipped } = resolveWithLadder(ladder, '6781299315', { USA: { targetPrice: 28.7 }, IND: { targetPrice: 1550 }, XYZ: { targetPrice: 1 } });
    expect(skipped).toEqual(['XYZ']);
    expect(resolved.USA.tierPrice).toBe(28.99);
    expect(decodePricePointId(resolved.USA.pricePointId)).toEqual({ sourceId: '6781299315', territoryCode: 'USA', tierRef: '10222' });
    expect(decodePricePointId(resolved.IND.pricePointId)?.tierRef).toBe('10300');
  });
});

describe('freshness', () => {
  const day = 24 * 60 * 60 * 1000;
  const fetched = Date.parse(ladder.fetchedAt);
  it('is fresh inside seven days and stale after', () => {
    expect(isLadderFresh(ladder, fetched + 6 * day)).toBe(true);
    expect(isLadderFresh(ladder, fetched + 8 * day)).toBe(false);
  });
  it('describes its age in the reader\'s units', () => {
    expect(describeLadderAge(ladder, fetched + 30_000)).toBe('just now');
    expect(describeLadderAge(ladder, fetched + 5 * 60_000)).toBe('5 minutes ago');
    expect(describeLadderAge(ladder, fetched + 3 * 3_600_000)).toBe('3 hours ago');
    expect(describeLadderAge(ladder, fetched + 2 * day)).toBe('2 days ago');
  });
});

describe('ladderAgreesWith', () => {
  it('accepts a live sample that matches the cached rung', () => {
    expect(ladderAgreesWith(ladder, { territoryCode: 'USA', tierRef: '10222', price: 28.99 })).toBe(true);
  });
  it('rejects a moved price or an unknown tier — the cue to refetch', () => {
    expect(ladderAgreesWith(ladder, { territoryCode: 'USA', tierRef: '10222', price: 29.49 })).toBe(false);
    expect(ladderAgreesWith(ladder, { territoryCode: 'USA', tierRef: '99999', price: 1 })).toBe(false);
  });
});
