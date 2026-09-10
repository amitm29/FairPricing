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
