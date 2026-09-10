import { z } from 'zod';
import { GOOGLE_PLAY_REGIONS } from '../google-play/types';
import { calculateRegionalPrice, DEFAULT_BLEND, type PricingStrategy, type RoundingMode, type BlendWeights } from '../google-play/currency';
import { BIG_MAC_INDEX } from '../conversion-indexes/big-mac';
import { NETFLIX_PRICE_INDEX } from '../conversion-indexes/netflix';
import { GDP_DATA } from '../conversion-indexes/gdp';
import { FALLBACK_EXCHANGE_RATES } from '../conversion-indexes/exchange-rates';
import { CURRENCY_PRICE_TIERS } from '../apple-connect/price-tier-data';
import { APPLE_TERRITORIES, UNSUPPORTED_IAP_TERRITORIES } from '../apple-connect/territories';
import { currencyDigits } from '../pricing/rounding';

export const STRATEGIES: {id: PricingStrategy; name: string; short: string; description: string; symbol: string}[] = [
  {id: 'ppp', name: 'Purchasing power', short: 'World Bank PPP', description: 'Match local purchasing power with World Bank data.', symbol: '◎'},
  {id: 'bigmac', name: 'Big Mac Index', short: 'Big Mac', description: 'Use an everyday purchase as an affordability benchmark.', symbol: '≋'},
  {id: 'netflix', name: 'Netflix Index', short: 'Netflix', description: 'Follow how a global digital subscription is priced.', symbol: '▻'},
  {id: 'gdp', name: 'GDP-adjusted', short: 'GDP', description: 'Scale your price by nominal GDP per person.', symbol: '▥'},
  {id: 'direct', name: 'Exchange rate', short: 'Exchange rate', description: 'Keep the same value with currency conversion.', symbol: '⇄'},
  {id: 'blend', name: 'Custom blend', short: 'Blend', description: 'Find your balance by weighting multiple indexes.', symbol: '◈'},
];
export const ROUNDINGS: {id: RoundingMode; label: string}[] = [
  {id: 'none', label: 'Off'}, {id: 'nearest-99', label: '.99'}, {id: 'nearest-95', label: '.95'},
  {id: 'whole', label: '.00'}, {id: 'nearest-x9', label: '.x9'}, {id: 'nearest-x5', label: '.x5'},
];
const roundingSchema = z.enum(['none', 'nearest-99', 'nearest-95', 'whole', 'nearest-x9', 'nearest-x5', 'nearest-tier', 'round-up']);
const overrideSchema = z.object({price: z.number().positive().finite().optional(), rounding: roundingSchema.optional()});
const productSchema = z.object({
  id: z.string().min(1), name: z.string().trim().min(1).max(80), kind: z.enum(['monthly', 'yearly', 'one-time']),
  basePrice: z.number().positive().finite().max(1000000), baseRegion: z.string().refine(v => GOOGLE_PLAY_REGIONS.some(r => r.code === v)),
  strategy: z.enum(['direct', 'ppp', 'bigmac', 'netflix', 'gdp', 'blend']), rounding: roundingSchema,
  platform: z.enum(['google', 'apple']), capAtBase: z.boolean().optional(), smartLocalEndings: z.boolean().optional(), weights: z.record(z.string(), z.number().nonnegative().finite()),
  minRatio: z.number().min(0).max(10), maxRatio: z.number().positive().max(100),
  overrides: z.record(z.string(), overrideSchema), updatedAt: z.string(),
}).refine(v => v.minRatio <= v.maxRatio, 'Minimum must not exceed maximum.');
export type ProductDraft = z.infer<typeof productSchema>;
export type CountryOverride = z.infer<typeof overrideSchema>;
export interface PriceRow { code: string; name: string; currency: string; price: number; calculated: number; fxPrice: number; baseEquivalent: number; change: number; source: string; isOverride: boolean; rounding: RoundingMode; error?: string; }

export function createProduct(name: string, kind: ProductDraft['kind']): ProductDraft {
  return {id: crypto.randomUUID(), name, kind, basePrice: 9.99, baseRegion: 'US', strategy: 'ppp', rounding: 'nearest-99', platform: 'google', weights: {...DEFAULT_BLEND}, minRatio: 0.1, maxRatio: 2, overrides: {}, updatedAt: new Date().toISOString()};
}
export function updateOverride(product: ProductDraft, code: string, value?: CountryOverride): ProductDraft {
  const overrides = {...product.overrides};
  if (value) overrides[code] = overrideSchema.parse(value); else delete overrides[code];
  return {...product, overrides, updatedAt: new Date().toISOString()};
}
const workspaceSchema = z.array(productSchema).min(1).max(100);
export function parseWorkspace(raw: string): ProductDraft[] {
  return workspaceSchema.parse(JSON.parse(raw));
}
export function serializeWorkspace(products: ProductDraft[]): string {
  return JSON.stringify(workspaceSchema.parse(products));
}
export function baseCurrency(product: ProductDraft): string {
  if (product.platform === 'apple') return APPLE_TERRITORIES.find(r => r.alpha2 === product.baseRegion)?.currency ?? 'USD';
  return GOOGLE_PLAY_REGIONS.find(r => r.code === product.baseRegion)?.currency ?? 'USD';
}
export function sourceLabel(strategy: PricingStrategy, code: string, base: string): string {
  if (strategy === 'bigmac') return BIG_MAC_INDEX[code] && BIG_MAC_INDEX[base] ? 'Big Mac · Jul 2026' : 'Big Mac · fallback estimate';
  if (strategy === 'netflix') return NETFLIX_PRICE_INDEX[code]?.source === 'tompec-netflix-prices' && NETFLIX_PRICE_INDEX[base]?.source === 'tompec-netflix-prices' ? 'Netflix · snapshot' : 'Netflix · inferred estimate';
  if (strategy === 'gdp') return GDP_DATA[code] && GDP_DATA[base] ? 'World Bank GDP · 2024' : 'GDP missing · PPP fallback';
  if (strategy === 'blend') return 'Weighted blend · snapshots';
  if (strategy === 'direct') return 'FX snapshot · Feb 2026';
  return 'PPP estimate · Feb 2026';
}
export function calculateRows(product: ProductDraft): PriceRow[] {
  const base = baseCurrency(product);
  const baseRate = FALLBACK_EXCHANGE_RATES[base];
  const regions = product.platform === 'apple' ? APPLE_TERRITORIES.filter(r => !UNSUPPORTED_IAP_TERRITORIES.includes(r.alpha3)).map(r => ({code: r.alpha2, name: r.name, currency: r.currency})) : GOOGLE_PLAY_REGIONS;
  return regions.map(region => {
    const override = product.overrides[region.code];
    const rounding = override?.rounding ?? product.rounding;
    const fxPrice = product.basePrice / baseRate * FALLBACK_EXCHANGE_RATES[region.currency];
    const row: PriceRow = {...region, rounding, price: 0, calculated: 0, fxPrice, baseEquivalent: 0, change: 0, source: sourceLabel(product.strategy, region.code, product.baseRegion), isOverride: override?.price !== undefined};
    try {
      const calculated = calculateRegionalPrice(product.basePrice, region.code, product.strategy, rounding, undefined, undefined, {[region.code]: region.currency}, undefined, base, product.baseRegion, product.platform === 'apple' ? currency => CURRENCY_PRICE_TIERS[currency] : undefined, {capAtBase: product.capAtBase, smartLocalEndings: product.smartLocalEndings, weights: product.weights as BlendWeights, minRatio: product.minRatio, maxRatio: product.maxRatio, snapToTiers: product.platform === 'apple'});
      row.calculated = calculated.rawPrice;
      row.price = override?.price ?? row.calculated;
      if (override?.price !== undefined) {
        const digits = currencyDigits(region.currency);
        if (Math.abs(row.price - Number(row.price.toFixed(digits))) > 1e-8) throw new Error(`Use at most ${digits} decimal places for ${region.currency}.`);
        if (row.price < fxPrice * product.minRatio - 1e-8 || row.price > fxPrice * Math.min(product.maxRatio, product.capAtBase ? 1 : Infinity) + 1e-8) throw new Error('Manual price is outside the configured bounds.');
        if (product.platform === 'apple' && !CURRENCY_PRICE_TIERS[region.currency]?.some(t => Math.abs(t.price - row.price) < 1e-8)) throw new Error('Manual price is not in the Apple tier snapshot.');
      }
      row.baseEquivalent = row.price / calculated.exchangeRate * baseRate;
      row.change = (row.price / fxPrice - 1) * 100;
      return row;
    } catch (error) {
      return {...row, error: error instanceof Error ? error.message : 'Cannot calculate this price.'};
    }
  });
}
export function formatPrice(amount: number, currency: string) {
  return new Intl.NumberFormat('en', {style: 'currency', currency, maximumFractionDigits: currencyDigits(currency)}).format(amount);
}
export function flag(code: string) { return code.replace(/./g, c => String.fromCodePoint(127397 + c.charCodeAt(0))); }
export function exportCsv(product: ProductDraft, rows: PriceRow[]): string {
  const escape = (v: unknown) => {
    const safe = typeof v === 'string' && /^[\s]*[=+@\-\t\r]/.test(v) ? "'" + v : String(v);
    return `"${safe.replace(/"/g, '""')}"`;
  };
  const cells = [['Product', 'Country', 'Country code', 'Currency', 'Price', 'FX price', 'Strategy', 'Source', 'Override', 'Rounding', 'Platform'], ...rows.filter(r => !r.error).map(r => [product.name, r.name, r.code, r.currency, r.price, r.fxPrice.toFixed(currencyDigits(r.currency)), product.strategy, r.source, r.isOverride ? 'manual' : 'calculated', r.rounding, product.platform])];
  return '\uFEFF' + cells.map(row => row.map(escape).join(',')).join('\r\n');
}
