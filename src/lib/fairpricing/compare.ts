import { GOOGLE_PLAY_REGIONS } from '../google-play/types';
import { DEFAULT_BLEND, type RoundingMode } from '../google-play/currency';
import { calculateRows, type PriceRow, type ProductDraft } from './workspace';

/**
 * Indexes shown side by side on /compare. `direct` leads because every other
 * column is read as a deviation from it.
 */
export const COMPARE_INDEXES = [
  { id: 'direct', name: 'Exchange rate', short: 'FX', blurb: 'Straight currency conversion. The baseline every other column is measured against.' },
  { id: 'ppp', name: 'World Bank PPP', short: 'PPP', blurb: 'Relative purchasing power from World Bank price-level data.' },
  { id: 'bigmac', name: 'Big Mac Index', short: 'Big Mac', blurb: 'Affordability read through the price of an everyday purchase.' },
  { id: 'netflix', name: 'Netflix Index', short: 'Netflix', blurb: 'How a global digital subscription is priced locally.' },
  { id: 'gdp', name: 'GDP-adjusted', short: 'GDP', blurb: 'Scaled by nominal GDP per person.' },
] as const satisfies readonly { id: ProductDraft['strategy']; name: string; short: string; blurb: string }[];

export type CompareIndexId = (typeof COMPARE_INDEXES)[number]['id'];

/** The affordability indexes. `direct` is excluded: it is the reference, not a competing opinion. */
export const AFFORDABILITY_INDEXES: readonly CompareIndexId[] = ['ppp', 'bigmac', 'netflix', 'gdp'];

export interface CompareCell {
  price: number;
  /**
   * Set when the index's own multiplier fell outside the price bounds, so the
   * shown price is the bound rather than the index's answer. GDP-adjusted hits
   * the floor in roughly half of all markets, which would otherwise read as a
   * confident $1.00 recommendation.
   */
  bounded?: 'floor' | 'ceiling';
  /** Percentage difference from the straight FX conversion. */
  change: number;
  /** price / fxPrice — comparable across currencies, unlike price itself. */
  multiplier: number;
  /** The price expressed back in the base region's currency. */
  baseEquivalent: number;
  source: string;
  error?: string;
}

export interface CompareSpread {
  low: number;
  high: number;
  lowIndex: CompareIndexId;
  highIndex: CompareIndexId;
  /** How much pricier the most expensive index is than the cheapest, as a percentage. */
  pct: number;
}

export interface CompareRow {
  code: string;
  name: string;
  currency: string;
  fxPrice: number;
  cells: Partial<Record<CompareIndexId, CompareCell>>;
  /** Absent when fewer than two affordability indexes produced a price. */
  spread?: CompareSpread;
}

export interface CompareOptions {
  basePrice: number;
  baseRegion: string;
  rounding: RoundingMode;
}

/** Price bounds every index is held to, as a share of straight FX conversion. */
export const MIN_RATIO = 0.1;
export const MAX_RATIO = 2;

function draftFor(strategy: ProductDraft['strategy'], { basePrice, baseRegion, rounding }: CompareOptions): ProductDraft {
  return {
    id: 'compare',
    name: 'Comparison',
    kind: 'monthly',
    basePrice,
    baseRegion,
    platform: 'google',
    strategy,
    rounding,
    weights: { ...DEFAULT_BLEND },
    capAtBase: false,
    smartLocalEndings: false,
    minRatio: MIN_RATIO,
    maxRatio: MAX_RATIO,
    overrides: {},
    updatedAt: '',
  };
}

/**
 * Spread across the affordability indexes: the gap between the cheapest and the
 * priciest opinion for one country. A wide spread means the choice of index
 * matters a lot in that market.
 */
function spreadOf(cells: Partial<Record<CompareIndexId, CompareCell>>): CompareSpread | undefined {
  const priced = AFFORDABILITY_INDEXES
    .map((id) => ({ id, cell: cells[id] }))
    .filter((entry): entry is { id: CompareIndexId; cell: CompareCell } => !!entry.cell && !entry.cell.error);
  if (priced.length < 2) return undefined;

  let low = priced[0];
  let high = priced[0];
  for (const entry of priced) {
    if (entry.cell.price < low.cell.price) low = entry;
    if (entry.cell.price > high.cell.price) high = entry;
  }
  if (low.cell.price <= 0) return undefined;

  return {
    low: low.cell.price,
    high: high.cell.price,
    lowIndex: low.id,
    highIndex: high.id,
    pct: (high.cell.price / low.cell.price - 1) * 100,
  };
}

function toCell(row: PriceRow): CompareCell {
  if (row.error) {
    return { price: 0, change: 0, multiplier: 0, baseEquivalent: 0, source: row.source, error: row.error };
  }
  return {
    price: row.price,
    change: row.change,
    multiplier: row.fxPrice > 0 ? row.price / row.fxPrice : 0,
    baseEquivalent: row.baseEquivalent,
    source: row.source,
    // Two shapes of the same fact: PPP, Big Mac and Netflix clamp themselves to
    // [0.1, 2.0] and so arrive sitting exactly on a bound, while GDP-adjusted
    // returns its raw ratio and overshoots. Landing precisely on a bound is not
    // something a continuous ratio does by chance, so treat both as bounded.
    bounded:
      row.multiplier <= MIN_RATIO * 1.0001
        ? 'floor'
        : row.multiplier >= MAX_RATIO * 0.9999
          ? 'ceiling'
          : undefined,
  };
}

/** How many markets have at least one index pinned to a bound. */
export function boundedMarketCount(rows: CompareRow[]): number {
  return rows.filter((row) => AFFORDABILITY_INDEXES.some((id) => row.cells[id]?.bounded)).length;
}

/**
 * Runs every index over every Google Play region once and joins the results by
 * country code, so a single row shows what each index would charge.
 */
export function buildComparison(options: CompareOptions): CompareRow[] {
  const byIndex = new Map<CompareIndexId, Map<string, PriceRow>>();
  for (const index of COMPARE_INDEXES) {
    const rows = calculateRows(draftFor(index.id, options));
    byIndex.set(index.id, new Map(rows.map((row) => [row.code, row])));
  }

  const reference = byIndex.get('direct');

  return GOOGLE_PLAY_REGIONS.map((region) => {
    const cells: Partial<Record<CompareIndexId, CompareCell>> = {};
    for (const index of COMPARE_INDEXES) {
      const row = byIndex.get(index.id)?.get(region.code);
      if (row) cells[index.id] = toCell(row);
    }
    return {
      code: region.code,
      name: region.name,
      currency: region.currency,
      fxPrice: reference?.get(region.code)?.fxPrice ?? 0,
      cells,
      spread: spreadOf(cells),
    };
  });
}

/** CSV with one row per country and one column per index. */
export function exportComparisonCsv(rows: CompareRow[], options: CompareOptions): string {
  const escape = (value: unknown) => {
    const safe = typeof value === 'string' && /^[\s]*[=+@\-\t\r]/.test(value) ? "'" + value : String(value);
    return `"${safe.replace(/"/g, '""')}"`;
  };
  const header = [
    'Country', 'Country code', 'Currency', 'FX price',
    ...COMPARE_INDEXES.filter((index) => index.id !== 'direct').flatMap((index) => [index.name, `${index.name} vs FX %`]),
    'Spread %', 'Base price', 'Base region', 'Price ending',
  ];
  const body = rows.map((row) => [
    row.name, row.code, row.currency, row.fxPrice.toFixed(2),
    ...COMPARE_INDEXES.filter((index) => index.id !== 'direct').flatMap((index) => {
      const cell = row.cells[index.id];
      return cell && !cell.error ? [cell.price, cell.change.toFixed(1)] : ['', ''];
    }),
    row.spread ? row.spread.pct.toFixed(1) : '',
    options.basePrice, options.baseRegion, options.rounding,
  ]);
  return '﻿' + [header, ...body].map((row) => row.map(escape).join(',')).join('\r\n');
}
