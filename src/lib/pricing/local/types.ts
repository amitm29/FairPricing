// Shared types for the FairPricing pricing pipeline.
//
// This module is the ROOT of the pricing import graph. It must not import from
// lib/google-play/currency.ts — that module re-exports from here.

/** Exchange rates fetched from the Open Exchange Rates API. */
export interface DynamicExchangeRates {
  rates: Record<string, number>;
  base: string;
  fetchedAt: string;
}

/** One rung on a store's price ladder. */
export interface RoundingTier {
  price: number;
}

/** Looks up the tier ladder for a currency. Apple has one; Google Play does not. */
export type GetTiersForCurrency = (
  currency: string
) => readonly RoundingTier[] | undefined;

/** Per-region index data, served by /api/ppp. */
export interface DynamicPPPData {
  [regionCode: string]: {
    pppMultiplier: number;
    pppConversionFactor?: number;
    /**
     * Market exchange rate captured by /api/ppp at the same moment as
     * pppConversionFactor, so a multiplier's numerator and denominator come
     * from one snapshot.
     */
    marketExchangeRate?: number;
    bigMacMultiplier?: number;
    netflixMultiplier?: number;
    gdpMultiplier?: number;
    gdpPerCapita?: number;
    minPrice: number;
    suggestedRounding: number;
    source: 'world-bank' | 'static';
  };
}

/** Strategies a user can pick. 'blend' is a weighted mix of the concrete ones. */
export type StrategyKey = 'direct' | 'ppp' | 'bigmac' | 'netflix' | 'gdp' | 'blend';
export type ConcreteStrategy = Exclude<StrategyKey, 'blend'>;

export const CONCRETE_STRATEGIES: readonly ConcreteStrategy[] = [
  'direct',
  'ppp',
  'bigmac',
  'netflix',
  'gdp',
] as const;

export const ALL_STRATEGIES: readonly StrategyKey[] = [
  ...CONCRETE_STRATEGIES,
  'blend',
] as const;

export type CharmEnding = '.99' | '.95' | '.90' | '.50' | '.00' | 'nine' | 'none';

export const ALL_CHARM_ENDINGS: readonly CharmEnding[] = [
  '.99',
  '.95',
  '.90',
  '.50',
  '.00',
  'nine',
  'none',
] as const;

export interface CharmConfig {
  ending: CharmEnding;
  /** When true, per-market rules in locale-rules.ts override `ending`. */
  smartLocaleDefaults: boolean;
  /** Explicit per-region ending; wins over both `ending` and locale defaults. */
  perRegion?: Record<string, CharmEnding>;
}

export type BlendWeights = Partial<Record<ConcreteStrategy, number>>;

export interface PricingPlan {
  basePrice: number;
  baseCurrency: string;
  baseRegion: string;
  strategy: StrategyKey;
  blendWeights?: BlendWeights;
  gdpElasticity?: number;
  /**
   * Never price a market above the base region. PPP and Big Mac figures for a
   * handful of low-income and conflict economies come out above 1.0 — imported
   * goods are genuinely dear there — but charging more than the US price for a
   * digital product in Somalia is indefensible. On by default.
   */
  capAtBase?: boolean;
  charm: CharmConfig;
  overrides?: Record<string, number>;
  regions: string[];
}

export interface MarketData {
  exchangeRates?: DynamicExchangeRates;
  pppData?: DynamicPPPData;
  /** regionCode -> billing currency, from the store API when available. */
  currencies?: Record<string, string>;
  /** Apple tier ladder lookup; omit for Google Play. */
  getTiersForCurrency?: GetTiersForCurrency;
}

export type MultiplierSource = ConcreteStrategy | 'blend' | 'static' | 'override';

export interface RegionalPrice {
  regionCode: string;
  currencyCode: string;
  multiplier: number;
  multiplierSource: MultiplierSource;
  exchangeRate: number;
  /** After stage 2 — base-normalized, still in USD. */
  adjustedUsdPrice: number;
  /** After stage 3 — converted to local currency, before charm. */
  rawPrice: number;
  /** After stage 4. */
  charmedPrice: number;
  /** After stages 5-7. The number to publish. */
  finalPrice: number;
  appliedEnding: CharmEnding;
  /** True when the charm safety rail rejected the adjustment. */
  charmRejected: boolean;
  isOverridden: boolean;
  /** True when the store minimum, not the strategy, set the price. */
  isFloored: boolean;
  /** True when the cap-at-base rule pulled the multiplier down to 1.0. */
  isCapped: boolean;
  /** % difference vs a plain FX conversion of the base price. */
  deltaVsDirect: number;
}

export const DEFAULT_GDP_ELASTICITY = 0.5;
export const DEFAULT_CAP_AT_BASE = true;
/** Charm must never overrule the strategy by more than this fraction. */
export const CHARM_SAFETY_RAIL = 0.08;
/** How far a tier may sit from the charmed price and still win on ending match. */
export const TIER_ENDING_WINDOW = 0.05;
/** How far a lucky-digit candidate may sit from the raw price and still win. */
export const PREFER_DIGIT_WINDOW = 0.03;
export const MULTIPLIER_MIN = 0.1;
export const MULTIPLIER_MAX = 2.0;

export function clampMultiplier(m: number): number {
  if (!Number.isFinite(m)) return 1.0;
  return Math.min(MULTIPLIER_MAX, Math.max(MULTIPLIER_MIN, m));
}
