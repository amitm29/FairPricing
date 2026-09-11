import { applyCharm } from '../pricing/local/psychological';
import type { CharmEnding } from '../pricing/local/types';
// Currency conversion utilities for bulk pricing
import { getGdpMultiplier } from '../conversion-indexes/gdp';
import { charmPrice, currencyDigits } from '../pricing/rounding';
import type { Money } from './types';
import { GOOGLE_PLAY_REGIONS, parseMoney } from './types';
import { getPricingIndexEntry, LOCAL_CURRENCIES } from '../conversion-indexes/ppp';
import { getBigMacMultiplier } from '../conversion-indexes/big-mac';
import { getNetflixMultiplier } from '../conversion-indexes/netflix';
import { FALLBACK_EXCHANGE_RATES } from '../conversion-indexes/exchange-rates';
import { alpha3ToAlpha2 } from '../apple-connect/territories';

export type PricingStrategy = 'direct' | 'ppp' | 'bigmac' | 'netflix' | 'custom' | 'gdp' | 'blend';
export type RoundingMode = 'nearest-tier' | 'nearest-99' | 'round-up' | 'none' | 'nearest-95' | 'nearest-x9' | 'nearest-x5' | 'whole';

export type BlendWeights = Partial<Record<'direct' | 'ppp' | 'bigmac' | 'netflix' | 'gdp', number>>;
export interface PricingOptions {
  capAtBase?: boolean;
  smartLocalEndings?: boolean;
  weights?: BlendWeights;
  minRatio?: number;
  maxRatio?: number;
  snapToTiers?: boolean;
}
export const DEFAULT_BLEND: BlendWeights = { ppp: 60, direct: 40 };


export interface RoundingTier {
  price: number;
}

export type GetTiersForCurrency = (
  currency: string
) => readonly RoundingTier[] | undefined;

// Dynamic exchange rates from API (passed to calculation functions)
export interface DynamicExchangeRates {
  rates: Record<string, number>;
  base: string;
  fetchedAt: string;
}


// Convert a region code to alpha-2 format (handles both alpha-2 and alpha-3)
function toAlpha2(regionCode: string): string {
  // If it's 3 characters, try to convert from alpha-3 to alpha-2
  if (regionCode.length === 3) {
    const alpha2 = alpha3ToAlpha2(regionCode);
    return alpha2 || regionCode;
  }
  return regionCode;
}

// Get the currency for a region
// If actualCurrencies is provided (from API), use that; otherwise fall back to static data
function getCurrencyForRegion(regionCode: string, actualCurrencies?: Record<string, string>): string {
  // Prefer actual currency from API if available (supports both alpha-2 and alpha-3)
  if (actualCurrencies?.[regionCode]) {
    return actualCurrencies[regionCode];
  }
  // Fall back to our static mapping (using alpha-2)
  const alpha2Code = toAlpha2(regionCode);
  const region = GOOGLE_PLAY_REGIONS.find((r) => r.code === alpha2Code);
  return region?.currency || 'USD';
}

// Get exchange rate for a currency (USD to local)
// Prefers dynamic rates from API, falls back to static rates
function getExchangeRate(
  currencyCode: string,
  dynamicRates?: DynamicExchangeRates
): number {
  // Prefer dynamic rates from API
  if (dynamicRates?.rates[currencyCode] !== undefined) {
    const rate = dynamicRates.rates[currencyCode];
    if (!Number.isFinite(rate) || rate <= 0) throw new Error(`Invalid exchange rate for ${currencyCode}.`);
    return rate;
  }
  // Fall back to static rates
  const fallbackRate = FALLBACK_EXCHANGE_RATES[currencyCode];
  if (fallbackRate === undefined) {
    throw new Error(`No exchange rate available for ${currencyCode}.`);
  }
  return fallbackRate;
}


// Get the actual local currency for a region (what World Bank PPP is based on)
function getLocalCurrencyForRegion(regionCode: string): string {
  return LOCAL_CURRENCIES[regionCode] || 'USD';
}

// Apply rounding based on mode. `tiers` (optional) is the list of allowed
// price points for the target currency (used by 'nearest-tier' mode when
// the platform exposes a tier ladder, e.g. Apple App Store Connect).
function applyRounding(
  price: number,
  mode: RoundingMode,
  currencyCode: string,
  tiers?: readonly RoundingTier[]
): number {
  if (mode === 'nearest-tier' && tiers?.length) {
    return tiers.reduce((best, tier) => Math.abs(tier.price - price) < Math.abs(best.price - price) ? tier : best).price;
  }
  return charmPrice(price, mode === 'nearest-tier' ? 'nearest-99' : mode, currencyCode);
}

/**
 * Keep a rounded price inside [floor, ceiling] without losing its ending.
 *
 * A bare clamp would return the floor itself — 2717.16 for Kenya at a 0.35
 * minimum — which is exactly the unrounded number the ending was meant to
 * hide. Instead, when a bound wins, look for the nearest rung of the same
 * rounding that sits on the inside of that bound (2799, not 2699). Only if the
 * bounds are tighter than one rounding step does the bare bound come back.
 */
function boundWithEnding(price: number, floor: number, ceiling: number, round: (value: number) => number): number {
  const EPS = 1e-9;
  const inside = (value: number) => value >= floor - EPS && value <= ceiling + EPS;
  if (inside(price)) return price;
  // Probe from the bound toward the interior at geometrically growing offsets,
  // so cent-level rungs (2717.99) and magnitude rungs (2799) are both found
  // at their nearest. The first probe whose nearest rung lands inside wins.
  const from = price < floor ? floor : ceiling;
  const direction = price < floor ? 1 : -1;
  for (const offset of [0, 1e-4, 2e-4, 5e-4, 1e-3, 2e-3, 5e-3, 1e-2, 2e-2, 5e-2, 0.1, 0.2]) {
    const candidate = round(from * (1 + direction * offset));
    if (inside(candidate)) return candidate;
  }
  return Math.min(ceiling, Math.max(price, floor));
}

export interface CalculatedPrice {
  regionCode: string;
  currencyCode: string;
  price: Money;
  rawPrice: number;
  /** The multiplier applied to the base price (before exchange rate) */
  multiplier: number;
  /** Source of the multiplier data */
  multiplierSource?: 'world-bank' | 'big-mac' | 'netflix' | 'static' | 'custom' | 'direct' | 'gdp' | 'blend';
  /** The exchange rate from USD to local currency */
  exchangeRate: number;
  /** The PPP-adjusted price in USD (before currency conversion) */
  adjustedUsdPrice: number;
}

// Dynamic PPP data from World Bank API
export interface DynamicPPPData {
  [regionCode: string]: {
    pppMultiplier: number;
    pppConversionFactor?: number;
    /**
     * Snapshot of the local-currency market exchange rate captured by /api/ppp
     * at the same moment as `pppConversionFactor`. Used as the divisor when
     * computing the real PPP multiplier so the numerator (PPP factor) and
     * denominator come from a single API snapshot. Falls back to live OER rates.
     */
    marketExchangeRate?: number;
    bigMacMultiplier?: number;
    netflixMultiplier?: number;
    minPrice: number;
    suggestedRounding: number;
    source: 'world-bank' | 'static';
  };
}

// Calculate regional price based on strategy
export function calculateRegionalPrice(
  basePrice: number,
  regionCode: string,
  strategy: PricingStrategy,
  rounding: RoundingMode = 'nearest-tier',
  customMultiplier?: number,
  dynamicPPPData?: DynamicPPPData,
  actualCurrencies?: Record<string, string>, // Currencies from API
  dynamicExchangeRates?: DynamicExchangeRates, // Exchange rates from API
  baseCurrency: string = 'USD', // The currency of the basePrice
  baseRegion: string = 'US', // The region the basePrice is defined for
  getTiersForCurrency?: GetTiersForCurrency, // Optional tier ladder per currency (Apple)
  options: PricingOptions = {}
): CalculatedPrice {
  if (!Number.isFinite(basePrice) || basePrice < 0) throw new Error('Base price must be finite and nonnegative.');
  if (options.minRatio !== undefined && (!Number.isFinite(options.minRatio) || options.minRatio < 0)) throw new Error('Invalid minimum ratio.');
  if (options.maxRatio !== undefined && (!Number.isFinite(options.maxRatio) || options.maxRatio <= 0 || options.maxRatio < (options.minRatio ?? 0))) throw new Error('Invalid maximum ratio.');
  // Convert to alpha-2 for lookups (handles both alpha-2 and alpha-3 inputs)
  const alpha2Code = toAlpha2(regionCode);
  const alpha2BaseRegion = toAlpha2(baseRegion);

  // Use actual currency from API if available, otherwise fall back to static data
  const currencyCode = getCurrencyForRegion(regionCode, actualCurrencies);
  const exchangeRate = getExchangeRate(currencyCode, dynamicExchangeRates);

  // Normalize basePrice to USD if it's in a different currency
  let baseUsdPrice = basePrice;
  if (baseCurrency !== 'USD') {
    const baseExchangeRate = getExchangeRate(baseCurrency, dynamicExchangeRates);
    if (baseExchangeRate && baseExchangeRate !== 0) {
      baseUsdPrice = basePrice / baseExchangeRate;
    }
  }

  // Free (0) base price: skip all calculations and return 0 for every region
  if (basePrice === 0) {
    return {
      regionCode,
      currencyCode,
      price: parseMoney(0, currencyCode),
      rawPrice: 0,
      multiplier: 1.0,
      multiplierSource: 'direct',
      exchangeRate,
      adjustedUsdPrice: 0,
    };
  }

  // Use dynamic PPP data if available (try both original and alpha-2 codes), otherwise fall back to static
  const dynamicEntry = dynamicPPPData?.[regionCode] ?? dynamicPPPData?.[alpha2Code];
  const staticEntry = getPricingIndexEntry(alpha2Code);
  const pppConversionFactor = dynamicEntry?.pppConversionFactor;
  const pppMultiplier = dynamicEntry?.pppMultiplier ?? staticEntry.pppMultiplier;
  const minPrice = dynamicEntry?.minPrice ?? staticEntry.minPrice;

  // Get base region PPP data for relative normalization
  const baseDynamicEntry = dynamicPPPData?.[baseRegion] ?? dynamicPPPData?.[alpha2BaseRegion];
  const baseStaticEntry = getPricingIndexEntry(alpha2BaseRegion);
  const basePppMultiplier = baseDynamicEntry?.pppMultiplier ?? baseStaticEntry.pppMultiplier;

  let calculatedPrice: number;
  let effectiveMultiplier: number = 1.0;
  let multiplierSource: CalculatedPrice['multiplierSource'] = 'direct';

  // Get Big Mac multiplier (from dynamic data or static, using alpha-2 for lookup)
  const bigMacMultiplier = dynamicEntry?.bigMacMultiplier ?? getBigMacMultiplier(alpha2Code);
  const baseBigMacMultiplier = baseDynamicEntry?.bigMacMultiplier ?? getBigMacMultiplier(alpha2BaseRegion);
  const netflixMultiplier = dynamicEntry?.netflixMultiplier ?? getNetflixMultiplier(alpha2Code);
  const baseNetflixMultiplier = baseDynamicEntry?.netflixMultiplier ?? getNetflixMultiplier(alpha2BaseRegion);

  switch (strategy) {
    case 'direct':
      // Same USD value everywhere - just convert currency using market exchange rate
      calculatedPrice = baseUsdPrice * exchangeRate;
      effectiveMultiplier = 1.0;
      multiplierSource = 'direct';
      break;
    case 'ppp':
      // PPP strategy: adjust prices based on purchasing power parity
      //
      // The World Bank PPP conversion factor is in LOCAL CURRENCY units per international $.
      // For example, Ukraine PPP factor ~9.34 means 9.34 UAH = 1 international $.
      //
      // If billing currency matches local currency:
      //   price = baseUsdPrice × pppFactor
      //
      // If billing currency differs (e.g., Apple bills Ukraine in USD, not UAH):
      //   1. Calculate PPP price in local currency: baseUsdPrice × pppFactor = price in UAH
      //   2. Convert to billing currency: price in UAH / localExchangeRate = price in USD
      //   Formula: price = baseUsdPrice × pppFactor / localExchangeRate × billingExchangeRate

      // Get the World Bank's expected local currency for this region. Prefer the
      // snapshot rate from /api/ppp (paired with the PPP factor) so the multiplier's
      // numerator and denominator come from one API call; fall back to live OER.
      const localCurrency = getLocalCurrencyForRegion(alpha2Code);
      const localExchangeRate = dynamicEntry?.marketExchangeRate
        ?? getExchangeRate(localCurrency, dynamicExchangeRates);

      if (pppConversionFactor !== undefined) {
        // If we have dynamic PPP data, we use the real multiplier (PPP_Factor / Market_Rate)
        // BUT we must normalize it relative to the base region's multiplier
        const baseLocalCurrency = getLocalCurrencyForRegion(alpha2BaseRegion);
        const baseLocalExchangeRate = baseDynamicEntry?.marketExchangeRate
          ?? getExchangeRate(baseLocalCurrency, dynamicExchangeRates);
        const basePppConversionFactor = baseDynamicEntry?.pppConversionFactor;

        let baseRealMultiplier = basePppMultiplier;
        if (baseLocalExchangeRate && basePppConversionFactor) {
          baseRealMultiplier = basePppConversionFactor / baseLocalExchangeRate;
        }

        if (currencyCode === localCurrency) {
          // Billing currency matches local currency. Use the snapshot rate for the
          // multiplier denominator; keep the live OER rate for the final output
          // conversion so the displayed price tracks today's market.
          const rawRealMultiplier = pppConversionFactor / localExchangeRate;
          effectiveMultiplier = rawRealMultiplier / baseRealMultiplier;
          calculatedPrice = baseUsdPrice * effectiveMultiplier * exchangeRate;
          multiplierSource = dynamicEntry?.source ?? 'world-bank';
        } else {
          // Billing currency differs from local currency
          const hasExchangeRate = (dynamicExchangeRates?.rates[localCurrency] !== undefined) ||
            (FALLBACK_EXCHANGE_RATES[localCurrency] !== undefined);

          if (localCurrency !== 'USD' && !hasExchangeRate) {
            effectiveMultiplier = pppMultiplier / basePppMultiplier;
            calculatedPrice = baseUsdPrice * effectiveMultiplier * exchangeRate;
            multiplierSource = 'static';
          } else {
            const pppPriceInLocal = baseUsdPrice * pppConversionFactor;
            const pppPriceInUsd = pppPriceInLocal / localExchangeRate;
            const rawRealMultiplier = pppPriceInUsd / baseUsdPrice;

            effectiveMultiplier = rawRealMultiplier / baseRealMultiplier;

            // For hyperinflation countries where PPP produces HIGHER prices than base,
            // use a low default multiplier to make apps affordable.
            if (effectiveMultiplier > 1.0 && rawRealMultiplier > 1.0) {
              const affordabilityMultiplier = 0.25;
              effectiveMultiplier = affordabilityMultiplier;
              calculatedPrice = baseUsdPrice * effectiveMultiplier * exchangeRate;
              multiplierSource = 'static';
            } else {
              calculatedPrice = baseUsdPrice * effectiveMultiplier * exchangeRate;
              multiplierSource = dynamicEntry?.source ?? 'world-bank';
            }
          }
        }
      } else {
        // No PPP conversion factor available - use static multiplier normalized to base region
        effectiveMultiplier = pppMultiplier / basePppMultiplier;
        calculatedPrice = baseUsdPrice * effectiveMultiplier * exchangeRate;
        multiplierSource = 'static';
      }
      break;
    case 'bigmac':
      // Big Mac Index strategy: use multiplier normalized to base region
      effectiveMultiplier = bigMacMultiplier / baseBigMacMultiplier;
      calculatedPrice = baseUsdPrice * effectiveMultiplier * exchangeRate;
      multiplierSource = 'big-mac';
      break;
    case 'netflix':
      // Netflix Price Index strategy: use multiplier normalized to base region
      effectiveMultiplier = netflixMultiplier / baseNetflixMultiplier;
      calculatedPrice = baseUsdPrice * effectiveMultiplier * exchangeRate;
      multiplierSource = 'netflix';
      break;
    case 'gdp': {
      const gdp = getGdpMultiplier(alpha2Code, alpha2BaseRegion);
      effectiveMultiplier = gdp.multiplier;
      calculatedPrice = baseUsdPrice * exchangeRate * effectiveMultiplier;
      multiplierSource = gdp.fallback ? 'static' : 'gdp';
      break;
    }
    case 'blend': {
      const weights = options.weights ?? DEFAULT_BLEND;
      const entries = Object.entries(weights) as [Exclude<PricingStrategy, 'blend' | 'custom'>, number][];
      if (entries.some(([key, value]) => !['direct', 'ppp', 'bigmac', 'netflix', 'gdp'].includes(key) || !Number.isFinite(value) || value < 0) || Math.abs(entries.reduce((sum, [, value]) => sum + value, 0) - 100) > 0.001) {
        throw new Error('Blend weights must be nonnegative and total 100%.');
      }
      effectiveMultiplier = entries.reduce((sum, [component, weight]) => weight === 0 ? sum : sum + calculateRegionalPrice(basePrice, regionCode, component, 'none', undefined, dynamicPPPData, actualCurrencies, dynamicExchangeRates, baseCurrency, baseRegion).multiplier * weight / 100, 0);
      calculatedPrice = baseUsdPrice * exchangeRate * effectiveMultiplier;
      multiplierSource = 'blend';
      break;
    }
    case 'custom':
      // Use provided custom multiplier with exchange rate
      calculatedPrice = baseUsdPrice * (customMultiplier ?? 1.0) * exchangeRate;
      effectiveMultiplier = customMultiplier ?? 1.0;
      multiplierSource = 'custom';
      break;
    default:
      calculatedPrice = baseUsdPrice * exchangeRate;
      effectiveMultiplier = 1.0;
      multiplierSource = 'direct';
  }

  // Apply rounding (with optional tier ladder for nearest-tier mode)
  const tiersForCurrency = getTiersForCurrency?.(currencyCode);
  const smartEndings: Partial<Record<RoundingMode, CharmEnding>> = {'nearest-99':'.99','nearest-95':'.95','whole':'.00','nearest-x9':'nine','round-up':'.99'};
  const smartEnding = smartEndings[rounding];
  const roundToEnding = (value: number) => options.smartLocalEndings && smartEnding
    ? applyCharm(value, alpha2Code, currencyCode, {ending: smartEnding, smartLocaleDefaults: true}).price
    : applyRounding(value, rounding, currencyCode, tiersForCurrency);
  calculatedPrice = roundToEnding(calculatedPrice);

  // Enforce minimum price (minPrice is in local currency, convert if billing currency differs)
  // Get the local currency to check if minPrice needs conversion
  const minPriceLocalCurrency = getLocalCurrencyForRegion(alpha2Code);
  let adjustedMinPrice = minPrice;

  if (currencyCode !== minPriceLocalCurrency) {
    // Convert minPrice from local currency to billing currency
    const minPriceLocalRate = getExchangeRate(minPriceLocalCurrency, dynamicExchangeRates);
    // minPrice in local / local rate = minPrice in USD, then * billing rate
    adjustedMinPrice = (minPrice / minPriceLocalRate) * exchangeRate;
  }

  const floor = Math.max(adjustedMinPrice, baseUsdPrice * exchangeRate * (options.minRatio ?? 0));
  const ceiling = baseUsdPrice * exchangeRate * Math.min(options.maxRatio ?? Infinity, options.capAtBase ? 1 : Infinity);
  if (floor > ceiling) throw new Error('Price bounds conflict with the regional minimum.');
  calculatedPrice = boundWithEnding(calculatedPrice, floor, ceiling, roundToEnding);
  const shouldSnap = options.snapToTiers || rounding === 'nearest-tier';
  if (shouldSnap && tiersForCurrency?.length) {
    const valid = tiersForCurrency.filter(t => t.price >= floor && t.price <= ceiling && t.price > 0);
    if (!valid.length) throw new Error('No Apple price tier satisfies these bounds.');
    calculatedPrice = valid.reduce((best, tier) => Math.abs(tier.price - calculatedPrice) < Math.abs(best.price - calculatedPrice) ? tier : best).price;
  } else {
    const scale = 10 ** currencyDigits(currencyCode);
    const rounded = Math.round(calculatedPrice * scale) / scale;
    calculatedPrice = Math.max(Math.ceil(floor * scale - 1e-9) / scale, Math.min(Math.floor(ceiling * scale + 1e-9) / scale, rounded));
    if (Math.ceil(floor * scale - 1e-9) > Math.floor(ceiling * scale + 1e-9)) throw new Error('No currency price satisfies these bounds.');
  }

  // The PPP-adjusted USD price before currency conversion
  const adjustedUsdPrice = baseUsdPrice * effectiveMultiplier;

  return {
    regionCode,
    currencyCode,
    price: parseMoney(calculatedPrice, currencyCode),
    rawPrice: calculatedPrice,
    multiplier: effectiveMultiplier,
    multiplierSource,
    exchangeRate,
    adjustedUsdPrice,
  };
}

// Calculate prices for multiple regions
export function calculateBulkPrices(
  basePrice: number,
  regionCodes: string[],
  strategy: PricingStrategy,
  rounding: RoundingMode = 'nearest-tier',
  customMultipliers?: Record<string, number>,
  dynamicPPPData?: DynamicPPPData,
  actualCurrencies?: Record<string, string>, // Currencies from Google Play API
  dynamicExchangeRates?: DynamicExchangeRates, // Exchange rates from API
  baseCurrency: string = 'USD', // The currency of the basePrice
  baseRegion: string = 'US', // The region the basePrice is defined for
  getTiersForCurrency?: GetTiersForCurrency, // Optional tier ladder per currency (Apple)
  options: PricingOptions = {}
): CalculatedPrice[] {
  return regionCodes.map((regionCode) => {
    const customMultiplier = customMultipliers?.[regionCode];
    return calculateRegionalPrice(
      basePrice,
      regionCode,
      strategy,
      rounding,
      customMultiplier,
      dynamicPPPData,
      actualCurrencies,
      dynamicExchangeRates,
      baseCurrency,
      baseRegion,
      getTiersForCurrency,
      options
    );
  });
}

// Get all available region codes
export function getAllRegionCodes(): string[] {
  return GOOGLE_PLAY_REGIONS.map((r) => r.code);
}

// Calculate percentage change between two prices
export function calculatePriceChange(oldPrice: number, newPrice: number): number {
  if (oldPrice === 0) return newPrice > 0 ? 100 : 0;
  return ((newPrice - oldPrice) / oldPrice) * 100;
}

// Format price change as string
export function formatPriceChange(change: number): string {
  const sign = change >= 0 ? '+' : '';
  return `${sign}${change.toFixed(0)}%`;
}
