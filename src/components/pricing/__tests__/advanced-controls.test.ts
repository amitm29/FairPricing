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
  it('applies a manual price exactly as typed, above the maximum', () => {
    const [price] = calculateConnectedPrices({ US: 100 }, 10, ['US'], 'direct', 'none', undefined, undefined, undefined, undefined, 'USD', 'US', undefined, { minRatio: 0.5, maxRatio: 2 });
    expect(moneyToNumber(price.price)).toBe(100);
    expect(price.rawPrice).toBe(100);
  });
  it('applies a manual price exactly as typed, below the minimum and the cap', () => {
    const [price] = calculateConnectedPrices({ US: 1.5 }, 10, ['US'], 'direct', 'nearest-99', undefined, undefined, undefined, undefined, 'USD', 'US', undefined, { minRatio: 0.5, maxRatio: 2, capAtBase: true });
    expect(moneyToNumber(price.price)).toBe(1.5);
  });
  it('does not lift a manual price to the static regional minimum', () => {
    // Mexico carries a 10 MXN minimum in the bundled index; a typed 5 stays 5.
    const [price] = calculateConnectedPrices({ MX: 5 }, 10, ['MX'], 'ppp', 'nearest-99', undefined, undefined, undefined, undefined, 'USD', 'US', undefined, { minRatio: 0.1, maxRatio: 2 });
    expect(price.currencyCode).toBe('MXN');
    expect(moneyToNumber(price.price)).toBe(5);
  });
  it('does not re-round a manual price to a charm ending', () => {
    const [price] = calculateConnectedPrices({ US: 7.4 }, 10, ['US'], 'ppp', 'nearest-99', undefined, undefined, undefined, undefined, 'USD', 'US', undefined, { minRatio: 0.1, maxRatio: 2, smartLocalEndings: true });
    expect(moneyToNumber(price.price)).toBe(7.4);
  });
  it('keeps a manual price representable in its currency', () => {
    const [usd] = calculateConnectedPrices({ US: 4.256 }, 10, ['US'], 'direct', 'none', undefined, undefined, undefined, undefined, 'USD', 'US');
    expect(moneyToNumber(usd.price)).toBe(4.26);
    const [jpy] = calculateConnectedPrices({ JP: 1234.5 }, 10, ['JP'], 'direct', 'none', undefined, undefined, undefined, undefined, 'USD', 'US');
    expect(jpy.currencyCode).toBe('JPY');
    expect(Number.isInteger(moneyToNumber(jpy.price))).toBe(true);
  });
  it('still snaps a manual price to the nearest Apple tier, without bounds', () => {
    // 13 sits nearer 14.99 than 9.99; the 1.2 maximum no longer forces the lower tier.
    const [price] = calculateConnectedPrices({ US: 13 }, 10, ['US'], 'direct', 'nearest-99', undefined, undefined, undefined, undefined, 'USD', 'US', () => [{ price: 4.99 }, { price: 9.99 }, { price: 14.99 }], { minRatio: 0.5, maxRatio: 1.2, snapToTiers: true });
    expect(moneyToNumber(price.price)).toBe(14.99);
  });
  it('reports a manual price against straight conversion consistently', () => {
    const [price] = calculateConnectedPrices({ US: 5 }, 10, ['US'], 'direct', 'none', undefined, undefined, undefined, undefined, 'USD', 'US');
    // multiplier is price / FX, and adjustedUsdPrice / multiplier * rate recovers FX.
    expect(price.multiplier).toBeCloseTo(0.5, 9);
    expect(price.adjustedUsdPrice / price.multiplier * price.exchangeRate).toBeCloseTo(10, 9);
  });
  it('leaves regions without a manual price untouched', () => {
    const [withOverride, plain] = calculateConnectedPrices({ US: 5 }, 10, ['US', 'GB'], 'ppp', 'nearest-99', undefined, undefined, undefined, undefined, 'USD', 'US');
    const [, reference] = calculateConnectedPrices({}, 10, ['US', 'GB'], 'ppp', 'nearest-99', undefined, undefined, undefined, undefined, 'USD', 'US');
    expect(withOverride.regionCode).toBe('US');
    expect(plain).toEqual(reference);
  });
  it('rejects invalid blend weights before submitting', () => {
    expect(pricingOptionsError('blend', { weights: { ppp: 30, direct: 40 }, minRatio: 0.1, maxRatio: 2 })).toMatch('100%');
  });
});
