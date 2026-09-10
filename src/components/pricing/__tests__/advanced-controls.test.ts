import { describe, expect, it } from 'vitest';
import { calculateConnectedPrices, pricingOptionsError } from '../advanced-controls';
import { moneyToNumber } from '@/lib/google-play/types';

describe('connected pricing previews', () => {
  it('keeps overrides across strategy and ending changes', () => {
    for (const strategy of ['direct', 'ppp', 'gdp', 'blend'] as const) {
      const [price] = calculateConnectedPrices({ US: 4.25 }, 10, ['US'], strategy, 'nearest-99');
      expect(moneyToNumber(price.price)).toBe(4.25);
    }
  });
  it('applies bounds to manual overrides', () => {
    const [price] = calculateConnectedPrices({ US: 100 }, 10, ['US'], 'direct', 'none', undefined, undefined, undefined, undefined, 'USD', 'US', undefined, { minRatio: 0.5, maxRatio: 2 });
    expect(moneyToNumber(price.price)).toBe(20);
  });
  it('snaps overrides to valid Apple tiers inside bounds', () => {
    const [price] = calculateConnectedPrices({ US: 13 }, 10, ['US'], 'direct', 'nearest-99', undefined, undefined, undefined, undefined, 'USD', 'US', () => [{ price: 4.99 }, { price: 9.99 }, { price: 14.99 }], { minRatio: 0.5, maxRatio: 1.2, snapToTiers: true });
    expect(moneyToNumber(price.price)).toBe(9.99);
  });
  it('rejects invalid blend weights before submitting', () => {
    expect(pricingOptionsError('blend', { weights: { ppp: 30, direct: 40 }, minRatio: 0.1, maxRatio: 2 })).toMatch('100%');
  });
});
