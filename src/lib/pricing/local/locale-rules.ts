// Market-by-market pricing conventions, expressed as data.
//
// Every rule here is a table entry rather than a branch in the charm algorithm,
// so adding a market is a one-line change.

import type { CharmEnding } from './types';

export interface LocaleCharmRule {
  /** Currency has no minor unit — decimal endings are invalid. */
  zeroDecimal?: boolean;
  /** Store requires prices to be a multiple of this amount. */
  multipleOf?: number;
  /** Digits to avoid in the leading or trailing position. */
  avoidDigits?: number[];
  /** Digits to favour when a candidate is within PREFER_DIGIT_WINDOW. */
  preferDigits?: number[];
  /** Market-idiomatic ending, used when smartLocaleDefaults is on. */
  defaultEnding?: CharmEnding;
}

export const ZERO_DECIMAL_CURRENCIES = [
  'JPY', 'KRW', 'VND', 'IDR', 'CLP', 'PYG', 'HUF', 'COP',
  'UGX', 'TZS', 'KZT', 'MNT', 'IQD', 'XOF', 'XAF', 'RWF',
  'BIF', 'DJF', 'GNF', 'KMF', 'VUV',
] as const;

const zeroDecimalDefaults: Record<string, LocaleCharmRule> = Object.fromEntries(
  ZERO_DECIMAL_CURRENCIES.map((c) => [
    c,
    { zeroDecimal: true, defaultEnding: 'nine' as CharmEnding },
  ])
);

export const CURRENCY_CHARM_RULES: Record<string, LocaleCharmRule> = {
  ...zeroDecimalDefaults,

  // Google Play requires CFA franc prices to be multiples of 100.
  XOF: { zeroDecimal: true, multipleOf: 100, defaultEnding: '.00' },
  XAF: { zeroDecimal: true, multipleOf: 100, defaultEnding: '.00' },

  // Round yen and won are the norm; charm endings read as foreign there.
  JPY: { zeroDecimal: true, defaultEnding: '.00' },
  KRW: { zeroDecimal: true, defaultEnding: '.00' },

  // Rupee software prices overwhelmingly end in 9 (99, 149, 199, 299).
  INR: { defaultEnding: 'nine' },

  // Nordic and Swiss retail favours whole units over charm endings.
  CHF: { defaultEnding: '.00' },
  SEK: { defaultEnding: '.00' },
  NOK: { defaultEnding: '.00' },
  DKK: { defaultEnding: '.00' },
};

export const LOCALE_CHARM_RULES: Record<string, LocaleCharmRule> = {
  // Tetraphobia: 4 is a homophone for "death" across Sinospheric languages.
  JP: { avoidDigits: [4] },
  KR: { avoidDigits: [4] },
  SG: { avoidDigits: [4] },

  // 8 is auspicious in Chinese-speaking markets; 4 is not.
  CN: { avoidDigits: [4], preferDigits: [8] },
  TW: { avoidDigits: [4], preferDigits: [8] },
  HK: { avoidDigits: [4], preferDigits: [8] },

  IN: { defaultEnding: 'nine' },
};

const EMPTY: LocaleCharmRule = {};

/** Currency rule first, region rule layered on top. */
export function resolveLocaleRule(
  regionCode: string,
  currencyCode: string
): LocaleCharmRule {
  const byCurrency = CURRENCY_CHARM_RULES[currencyCode] ?? EMPTY;
  const byRegion = LOCALE_CHARM_RULES[regionCode] ?? EMPTY;
  return { ...byCurrency, ...byRegion };
}
