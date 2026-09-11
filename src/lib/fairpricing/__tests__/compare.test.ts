import { describe, expect, it } from 'vitest';
import { AFFORDABILITY_INDEXES, COMPARE_INDEXES, boundedMarketCount, buildComparison, exportComparisonCsv } from '../compare';

const options = {basePrice: 9.99, baseRegion: 'US', rounding: 'nearest-99'} as const;

describe('index comparison', () => {
  it('joins every index onto one row per country', () => {
    const rows = buildComparison(options);
    const india = rows.find(r => r.code === 'IN');
    expect(india?.currency).toBe('INR');
    for (const index of COMPARE_INDEXES) expect(india?.cells[index.id]).toBeDefined();
  });
  it('measures each index against the same FX baseline', () => {
    const india = buildComparison(options).find(r => r.code === 'IN');
    const ppp = india?.cells.ppp;
    expect(india?.fxPrice).toBeGreaterThan(0);
    // PPP is cheaper than straight conversion in India, so it reads as a discount.
    expect(ppp?.multiplier).toBeLessThan(1);
    expect(ppp?.change).toBeLessThan(0);
    expect(ppp!.multiplier).toBeCloseTo(ppp!.price / india!.fxPrice, 6);
  });
  it('reports the spread between the cheapest and priciest affordability index', () => {
    const india = buildComparison(options).find(r => r.code === 'IN')!;
    const priced = AFFORDABILITY_INDEXES.map(id => india.cells[id]!).filter(c => !c.error);
    expect(india.spread!.low).toBe(Math.min(...priced.map(c => c.price)));
    expect(india.spread!.high).toBe(Math.max(...priced.map(c => c.price)));
    expect(india.spread!.pct).toBeCloseTo((india.spread!.high / india.spread!.low - 1) * 100, 6);
  });
  it('leaves the base region at its own base price', () => {
    const us = buildComparison(options).find(r => r.code === 'US')!;
    expect(us.cells.direct?.price).toBe(9.99);
    expect(us.cells.ppp?.price).toBe(9.99);
    expect(us.spread?.pct).toBe(0);
  });
  it('follows the selected base region', () => {
    const fromIndia = buildComparison({...options, baseRegion: 'IN', basePrice: 299}).find(r => r.code === 'US')!;
    // Pricing up from India inverts the discount: the US costs more than the base.
    expect(fromIndia.cells.ppp!.multiplier).toBeGreaterThan(1);
  });
  it('exports one CSV column pair per affordability index', () => {
    const csv = exportComparisonCsv(buildComparison(options), options);
    expect(csv).toContain('"World Bank PPP"');
    expect(csv).toContain('"World Bank PPP vs FX %"');
    expect(csv).not.toContain('"Exchange rate vs FX %"');
    expect(csv.split('\r\n')).toHaveLength(buildComparison(options).length + 1);
  });
});

describe('price bounds', () => {
  it('marks prices that hit a bound instead of presenting them as the index answer', () => {
    const rows = buildComparison(options);
    // India's GDP per capita is ~3% of the US, far under the 10% floor, so the
    // price shown is the bound rather than what GDP-adjusted actually asked for.
    const india = rows.find(r => r.code === 'IN')!;
    expect(india.cells.gdp?.bounded).toBe('floor');
    expect(india.cells.ppp?.bounded).toBeUndefined();
  });
  it('flags the index overshooting the bound, not a price that rounding landed on it', () => {
    // Albania's GDP multiplier is 0.13 — above the floor — even though .99
    // rounding leaves the final price sitting on it. The index was not clamped.
    const albania = buildComparison(options).find(r => r.code === 'AL')!;
    expect(albania.cells.gdp?.bounded).toBeUndefined();
  });
  it('counts the markets where any index is pinned to a bound', () => {
    const rows = buildComparison(options);
    const counted = rows.filter(r => AFFORDABILITY_INDEXES.some(id => r.cells[id]?.bounded)).length;
    expect(boundedMarketCount(rows)).toBe(counted);
    expect(counted).toBeGreaterThan(0);
  });
  it('leaves the base region unbounded', () => {
    const us = buildComparison(options).find(r => r.code === 'US')!;
    for (const id of AFFORDABILITY_INDEXES) expect(us.cells[id]?.bounded).toBeUndefined();
  });
});

describe('indexes that clamp themselves', () => {
  it('marks an index that arrives sitting exactly on a bound', () => {
    // PPP clamps internally to 2.0 rather than overshooting, so Somalia's PPP
    // price is the ceiling even though the multiplier never exceeds it.
    const somalia = buildComparison(options).find(r => r.code === 'SO')!;
    expect(somalia.cells.ppp?.bounded).toBe('ceiling');
    expect(somalia.cells.gdp?.bounded).toBe('floor');
    // Big Mac and Netflix sit well inside the bounds and stay unmarked.
    expect(somalia.cells.bigmac?.bounded).toBeUndefined();
    expect(somalia.cells.netflix?.bounded).toBeUndefined();
  });
});
