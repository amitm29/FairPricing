import { describe, expect, it } from 'vitest';
import { pricingDraftKey } from '../draft-key';

describe('connected pricing draft isolation', () => {
  it('isolates identical SKUs by platform and app', () => {
    const keys = [
      pricingDraftKey('google', 'app.one', 'product', 'premium'),
      pricingDraftKey('google', 'app.two', 'product', 'premium'),
      pricingDraftKey('apple', 'app.one', 'product', 'premium'),
    ];
    expect(new Set(keys).size).toBe(3);
  });
  it('isolates subscription plans and apps', () => {
    expect(pricingDraftKey('google', 'app.one', 'subscription', 'premium', 'annual'))
      .not.toBe(pricingDraftKey('google', 'app.two', 'subscription', 'premium', 'annual'));
    expect(pricingDraftKey('google', 'app.one', 'subscription', 'premium', 'annual'))
      .not.toBe(pricingDraftKey('google', 'app.one', 'subscription', 'premium', 'monthly'));
  });
  it('uses unambiguous tuple boundaries and restores the same key after switching', () => {
    const keyA = pricingDraftKey('google', 'a:b', 'product', 'c');
    const keyB = pricingDraftKey('google', 'a', 'product', 'b:c');
    expect(keyA).not.toBe(keyB);
    const storage = new Map([[keyA, { ppp: 60 }], [keyB, { gdp: 100 }]]);
    expect(storage.get(pricingDraftKey('google', 'a:b', 'product', 'c'))).toEqual({ ppp: 60 });
    expect(storage.get(keyB)).toEqual({ gdp: 100 });
  });
});
