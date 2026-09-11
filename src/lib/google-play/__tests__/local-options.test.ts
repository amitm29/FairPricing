import { describe, it, expect } from 'vitest';
import { calculateRegionalPrice } from '../currency';
import { applyCharm } from '../../pricing/local/psychological';
describe('local pricing controls',()=>{
 it('caps final prices after rounding',()=>{
  const result=calculateRegionalPrice(9.50,'US','custom','nearest-99',2,undefined,undefined,undefined,'USD','US',undefined,{capAtBase:true});
  expect(result.rawPrice).toBeLessThanOrEqual(9.50);
 });
 it('caps tier selection',()=>{
  const result=calculateRegionalPrice(9.5,'US','custom','nearest-99',2,undefined,undefined,undefined,'USD','US',()=>[{price:8.99},{price:9.99}],{capAtBase:true,snapToTiers:true});
  expect(result.rawPrice).toBe(8.99);
 });
 it('uses whole-rupee smart endings',()=>{
  const result=applyCharm(200.69,'IN','INR',{ending:'.99',smartLocaleDefaults:true});
  expect(result.price).toBe(199);
 });
});

import { findClosestPricePoint } from '../../apple-connect/products';
describe('Apple publish ceiling',()=>{
 it('does not resolve to a price point above the approved ceiling',()=>{
  expect(findClosestPricePoint(9.5,[{id:'low',customerPrice:'8.99'},{id:'high',customerPrice:'9.99'}],9.5)?.id).toBe('low');
 });
 it('returns no match when every price point violates the ceiling',()=>{
  expect(findClosestPricePoint(9.5,[{id:'high',customerPrice:'9.99'}],9.5)).toBeNull();
 });
});

describe('price bounds keep their endings', () => {
  // Kenya from a US $59.99 base with PPP: the index asks for ~0.27x, a 0.35
  // minimum lifts it to the floor, and the floor must still end like a price.
  const kenya = () => calculateRegionalPrice(59.99, 'KE', 'ppp', 'nearest-99', undefined, undefined, undefined, undefined, 'USD', 'US', undefined, { smartLocalEndings: true, minRatio: 0.35, maxRatio: 2 });

  // A price "has its ending" when rounding it again changes nothing.
  const isCharmed = (price: number, region: string, currency: string) =>
    applyCharm(price, region, currency, { ending: '.99', smartLocaleDefaults: true }).price === price;

  it('rounds a floor-clamped price to the next ending at or above the floor', () => {
    const result = kenya();
    const fx = 59.99 * result.exchangeRate;
    expect(result.rawPrice).toBeGreaterThanOrEqual(fx * 0.35 - 1e-6);
    expect(isCharmed(result.rawPrice, 'KE', 'KES')).toBe(true);
    // And it is the nearest such rung, not one further up.
    expect(result.rawPrice - fx * 0.35).toBeLessThan(100);
  });

  it('rounds a ceiling-clamped price to the ending at or below the ceiling', () => {
    // Switzerland prices above FX under Netflix; a 1.2 maximum pulls it down.
    const result = calculateRegionalPrice(59.99, 'CH', 'netflix', 'nearest-99', undefined, undefined, undefined, undefined, 'USD', 'US', undefined, { smartLocalEndings: true, minRatio: 0.1, maxRatio: 1.2 });
    const fx = 59.99 * result.exchangeRate;
    expect(result.rawPrice).toBeLessThanOrEqual(fx * 1.2 + 1e-6);
    expect(isCharmed(result.rawPrice, 'CH', 'CHF')).toBe(true);
    expect(fx * 1.2 - result.rawPrice).toBeLessThan(2);
  });

  it('leaves an in-bounds price exactly as rounded', () => {
    const loose = calculateRegionalPrice(59.99, 'KE', 'ppp', 'nearest-99', undefined, undefined, undefined, undefined, 'USD', 'US', undefined, { smartLocalEndings: true, minRatio: 0.1, maxRatio: 2 });
    const tight = calculateRegionalPrice(59.99, 'KE', 'ppp', 'nearest-99', undefined, undefined, undefined, undefined, 'USD', 'US', undefined, { smartLocalEndings: true, minRatio: 0.1, maxRatio: 2 });
    expect(tight.rawPrice).toBe(loose.rawPrice);
  });

  it('applies the same treatment with smart endings off', () => {
    const result = calculateRegionalPrice(59.99, 'KE', 'ppp', 'nearest-99', undefined, undefined, undefined, undefined, 'USD', 'US', undefined, { smartLocalEndings: false, minRatio: 0.35, maxRatio: 2 });
    const fx = 59.99 * result.exchangeRate;
    expect(result.rawPrice).toBeGreaterThanOrEqual(fx * 0.35 - 1e-6);
    // Plain .99 rounding works at cent granularity, so the nearest rung is within a unit.
    expect(Math.round((result.rawPrice % 1) * 100)).toBe(99);
    expect(result.rawPrice - fx * 0.35).toBeLessThan(1);
  });
});
