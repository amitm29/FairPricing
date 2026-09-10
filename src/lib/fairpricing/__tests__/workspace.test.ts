import { describe, expect, it } from 'vitest';
import { createProduct, calculateRows, updateOverride, exportCsv, parseWorkspace } from '../workspace';

describe('workspace drafts', () => {
  it('preserves a manual regional price across strategy changes', () => {
    const draft = updateOverride(createProduct('Test', 'monthly'), 'IN', {price: 299});
    expect(calculateRows({...draft, strategy: 'gdp'}).find(r => r.code === 'IN')?.price).toBe(299);
    expect(draft.overrides.IN.price).toBe(299);
  });
  it('supports regional rounding without overriding the amount', () => {
    const draft = updateOverride(createProduct('Test', 'monthly'), 'US', {rounding: 'whole'});
    expect(calculateRows(draft).find(r => r.code === 'US')?.price).toBe(10);
  });
  it('roundtrips valid saved drafts and rejects negative overrides', () => {
    const product = createProduct('Test', 'monthly');
    expect(parseWorkspace(JSON.stringify([product]))[0].name).toBe('Test');
    expect(() => parseWorkspace(JSON.stringify([{...product, overrides: {IN: {price: -2}}}]))).toThrow();
    expect(() => parseWorkspace('not json')).toThrow();
  });
  it('exports actual override prices and quotes CSV cells', () => {
    const product = updateOverride(createProduct('A, product', 'monthly'), 'IN', {price: 299});
    const csv = exportCsv(product, calculateRows(product).filter(r => r.code === 'IN'));
    expect(csv).toContain('"A, product"');
    expect(csv).toContain('299');
    expect(csv).toContain('manual');
  });
});

import { serializeWorkspace } from '../workspace';
it('rejects invalid updates before serializing saved drafts', () => {
  const drafts = [createProduct('Keep me', 'monthly')];
  expect(() => serializeWorkspace([{...drafts[0], minRatio: 3, maxRatio: 2}])).toThrow();
  expect(parseWorkspace(serializeWorkspace(drafts))[0].name).toBe('Keep me');
  expect(() => serializeWorkspace(Array.from({length: 101}, () => createProduct('P', 'monthly')))).toThrow();
});
it('neutralizes spreadsheet formulas in product names', () => {
  const p = createProduct('=1+1', 'monthly');
  expect(exportCsv(p, calculateRows(p).slice(0, 1))).toContain('"\'=1+1"');
});
it('calculates every supported market at the default base price across strategies', () => {
  const product = createProduct('Sample', 'monthly');
  for (const platform of ['google', 'apple'] as const) {
    for (const strategy of ['direct', 'ppp', 'bigmac', 'netflix', 'gdp', 'blend'] as const) {
      expect(calculateRows({...product, strategy, platform}).filter(row => row.error).map(row => `${platform}/${strategy}/${row.name}: ${row.error}`)).toEqual([]);
    }
  }
});
