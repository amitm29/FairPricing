import { describe, expect, it } from 'vitest';
import { mergeRegionalConfigs, removeRegionalConfig } from '../subscriptions';
import type { RegionalBasePlanConfig } from '../types';

const money = (units: string) => ({ currencyCode: 'USD', units, nanos: 0 });
const plan: RegionalBasePlanConfig[] = [
  { regionCode: 'US', price: money('59'), newSubscriberAvailability: true },
  { regionCode: 'CH', price: money('48'), newSubscriberAvailability: false },
  { regionCode: 'BE', price: money('59'), newSubscriberAvailability: true },
];

describe('mergeRegionalConfigs', () => {
  it('sets the regions being priced and marks them available to new subscribers', () => {
    const merged = mergeRegionalConfigs(plan, [{ regionCode: 'BE', price: money('50') }]);
    expect(merged.find(c => c.regionCode === 'BE')).toEqual({ regionCode: 'BE', price: money('50'), newSubscriberAvailability: true });
  });
  it('leaves regions that were not priced exactly as they were', () => {
    const merged = mergeRegionalConfigs(plan, [{ regionCode: 'BE', price: money('50') }]);
    // Switzerland was deliberately closed to new subscribers; a bulk update elsewhere must not reopen it.
    expect(merged.find(c => c.regionCode === 'CH')).toEqual(plan[1]);
    expect(merged.find(c => c.regionCode === 'US')).toEqual(plan[0]);
  });
  it('does not add regions the plan never had', () => {
    // India is not part of this plan and was not selected; it stays out.
    const merged = mergeRegionalConfigs(plan, [{ regionCode: 'BE', price: money('50') }]);
    expect(merged.map(c => c.regionCode)).toEqual(['US', 'CH', 'BE']);
  });
  it('adds a region only when it is explicitly priced', () => {
    const merged = mergeRegionalConfigs(plan, [{ regionCode: 'IN', price: { currencyCode: 'INR', units: '1599', nanos: 0 } }]);
    expect(merged.map(c => c.regionCode)).toEqual(['US', 'CH', 'BE', 'IN']);
    expect(merged.at(-1)?.newSubscriberAvailability).toBe(true);
  });
  it('works for a plan with no US price', () => {
    const indiaOnly: RegionalBasePlanConfig[] = [{ regionCode: 'IN', price: { currencyCode: 'INR', units: '249', nanos: 0 } }];
    const merged = mergeRegionalConfigs(indiaOnly, [{ regionCode: 'IN', price: { currencyCode: 'INR', units: '299', nanos: 0 } }]);
    expect(merged).toHaveLength(1);
    expect(merged[0].price.units).toBe('299');
  });
  it('does not mutate its inputs', () => {
    const before = JSON.stringify(plan);
    mergeRegionalConfigs(plan, [{ regionCode: 'US', price: money('69') }]);
    expect(JSON.stringify(plan)).toBe(before);
  });
});

describe('removeRegionalConfig', () => {
  it('removes exactly that region and adds nothing in its place', () => {
    const removed = removeRegionalConfig(plan, 'CH');
    expect(removed.map(c => c.regionCode)).toEqual(['US', 'BE']);
    expect(removed.find(c => c.regionCode === 'US')).toEqual(plan[0]);
  });
  it('is a no-op for a region that is not in the plan', () => {
    expect(removeRegionalConfig(plan, 'IN')).toEqual(plan);
  });
});
