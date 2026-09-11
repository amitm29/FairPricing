import { describe, expect, it } from 'vitest';
import { partitionResolved, type ResolvedPriceRow } from '../resolved-prices-review';

const row = (code: string, previewed: number, resolved: number): ResolvedPriceRow =>
  ({ code, name: code, currency: 'USD', current: null, previewed, resolved });

describe('partitionResolved', () => {
  it('treats anything beyond half a cent as a difference', () => {
    const { differing, matching } = partitionResolved([row('A', 9.99, 9.99), row('B', 9.99, 9.994), row('C', 9.99, 10.49)]);
    expect(matching.map(r => r.code)).toEqual(['A', 'B']);
    expect(differing.map(r => r.code)).toEqual(['C']);
  });
  it('lists the largest deviation first', () => {
    const { differing } = partitionResolved([row('small', 100, 101), row('big', 10, 14.99), row('mid', 50, 55)]);
    expect(differing.map(r => r.code)).toEqual(['big', 'mid', 'small']);
  });
  it('handles an all-matching set', () => {
    const { differing, matching } = partitionResolved([row('A', 1, 1), row('B', 2.5, 2.5)]);
    expect(differing).toHaveLength(0);
    expect(matching).toHaveLength(2);
  });
});
