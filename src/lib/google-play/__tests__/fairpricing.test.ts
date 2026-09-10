import { describe, expect, it } from 'vitest';
import { calculateRegionalPrice } from '../currency';
import { charmPrice } from '../../pricing/rounding';
import { getGdpMultiplier } from '../../conversion-indexes/gdp';

describe('FairPricing strategies', () => {
  it('normalizes GDP to the chosen base country', () => {
    expect(getGdpMultiplier('DE', 'DE').multiplier).toBe(1);
    expect(getGdpMultiplier('IN', 'US').multiplier).toBeLessThan(0.1);
    expect(getGdpMultiplier('XX', 'US').fallback).toBe(true);
  });
  it('uses GDP rather than exchange rate conversion', () => {
    const gdp = calculateRegionalPrice(100, 'IN', 'gdp', 'none');
    const fx = calculateRegionalPrice(100, 'IN', 'direct', 'none');
    expect(gdp.rawPrice).toBeLessThan(fx.rawPrice / 10);
    expect(gdp.multiplierSource).toBe('gdp');
  });
  it('blends normalized factors and rejects invalid weights', () => {
    const calc = (strategy: 'blend' | 'ppp' | 'direct', weights?: {ppp: number; direct: number}) => calculateRegionalPrice(100, 'IN', strategy, 'none', undefined, undefined, undefined, undefined, 'USD', 'US', undefined, {weights});
    expect(calc('blend', {ppp: 60, direct: 40}).rawPrice).toBeCloseTo(calc('ppp').rawPrice * 0.6 + calc('direct').rawPrice * 0.4, 1);
    expect(() => calc('blend', {ppp: 60, direct: 60})).toThrow(/100/);
    expect(() => calc('blend', {ppp: -20, direct: 120})).toThrow();
  });
  it('rejects unknown FX rather than inventing parity', () => {
    expect(() => calculateRegionalPrice(10, 'US', 'direct', 'none', undefined, undefined, {US: 'ZZZ'})).toThrow(/exchange rate/i);
  });
  it('rejects invalid base prices', () => {
    expect(() => calculateRegionalPrice(-1, 'US', 'ppp')).toThrow();
    expect(() => calculateRegionalPrice(NaN, 'US', 'ppp')).toThrow();
  });
});

describe('psychological rounding', () => {
  it.each([[4.16, 'nearest-99', 3.99], [4.51, 'nearest-99', 4.99], [4.16, 'nearest-95', 3.95], [4.16, 'nearest-x9', 4.19], [4.72, 'nearest-x9', 4.69], [4.16, 'nearest-x5', 4.15], [4.72, 'whole', 5]] as const)('rounds %s using %s', (price, mode, expected) => {
    expect(charmPrice(price, mode, 'USD')).toBe(expected);
  });
  it('respects currency precision and never makes a paid price free', () => {
    expect(charmPrice(416.23, 'none', 'JPY')).toBe(416);
    expect(charmPrice(4.1234, 'none', 'KWD')).toBe(4.123);
    expect(charmPrice(0.01, 'whole', 'USD')).toBeGreaterThan(0);
    expect(Number.isInteger(charmPrice(416, 'nearest-99', 'JPY'))).toBe(true);
  });
  it('applies charm before snapping to a supplied Apple tier ladder', () => {
    const result = calculateRegionalPrice(4.16, 'US', 'direct', 'nearest-99', undefined, undefined, undefined, undefined, 'USD', 'US', () => [{price: 3.99}, {price: 4.49}], {snapToTiers: true});
    expect(result.rawPrice).toBe(3.99);
  });
  it('keeps the final tier within configured price bounds', () => {
    const result = calculateRegionalPrice(4.16, 'US', 'direct', 'nearest-99', undefined, undefined, undefined, undefined, 'USD', 'US', () => [{price: 3.99}, {price: 4.49}], {snapToTiers: true, minRatio: 1, maxRatio: 1.1});
    expect(result.rawPrice).toBe(4.49);
  });
});

it.each([0, -1, NaN, Infinity])('rejects invalid dynamic FX %s', rate => {
  expect(() => calculateRegionalPrice(10, 'US', 'direct', 'none', undefined, undefined, undefined, {base: 'USD', fetchedAt: '2026-09-10', rates: {USD: rate}})).toThrow(/exchange rate/i);
});
