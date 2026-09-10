// Stage 4 of the pricing pipeline: psychological (charm) price endings.
//
// Three things make this more than a rounding function:
//   1. it works at the magnitude a shopper reads (1299, not 1247.99),
//   2. it respects each market's own conventions (whole yen, CFA multiples of
//      100, unlucky digits), and
//   3. it refuses to overrule the pricing strategy — an adjustment beyond
//      CHARM_SAFETY_RAIL is rejected in favour of conventional rounding.

import { magnitudeFor } from './magnitude';
import { resolveLocaleRule, type LocaleCharmRule } from './locale-rules';
import {
  CHARM_SAFETY_RAIL,
  PREFER_DIGIT_WINDOW,
  type CharmConfig,
  type CharmEnding,
} from './types';

export interface CharmResult {
  price: number;
  applied: CharmEnding;
  /** True when the safety rail fired; `price` is conventionally rounded. */
  rejected: boolean;
}

/** Explicit per-region ending > locale default (when enabled) > product ending. */
export function resolveEnding(
  regionCode: string,
  currencyCode: string,
  config: CharmConfig
): CharmEnding {
  const explicit = config.perRegion?.[regionCode];
  if (explicit) return explicit;
  if (config.smartLocaleDefaults) {
    const rule = resolveLocaleRule(regionCode, currencyCode);
    if (rule.defaultEnding) return rule.defaultEnding;
  }
  return config.ending;
}

/**
 * Fixed sub-unit endings only exist at cent granularity in a minor-unit
 * currency. Everywhere else they degrade to the magnitude delta, which is how
 * `.99` becomes 1299 on a four-digit price and 12900 on a six-digit one.
 */
function deltaForEnding(
  ending: CharmEnding,
  step: number,
  zeroDecimal: boolean
): number | null {
  const canUseCents = step === 1 && !zeroDecimal;
  switch (ending) {
    case '.00':
      return 0;
    case '.95':
      return canUseCents ? 0.05 : null;
    case '.90':
      return canUseCents ? 0.1 : null;
    case '.50':
      return canUseCents ? 0.5 : null;
    default:
      // '.99' and 'nine' both use the magnitude delta.
      return null;
  }
}

function round2(n: number): number {
  return Math.round(n * 100) / 100;
}

function digitsOf(n: number): string {
  return String(Math.round(Math.abs(n)));
}

function violatesAvoid(value: number, rule: LocaleCharmRule): boolean {
  if (!rule.avoidDigits?.length) return false;
  const s = digitsOf(value);
  const first = Number(s[0]);
  const last = Number(s[s.length - 1]);
  return rule.avoidDigits.includes(first) || rule.avoidDigits.includes(last);
}

function hasPreferred(value: number, rule: LocaleCharmRule): boolean {
  if (!rule.preferDigits?.length) return false;
  const s = digitsOf(value);
  return rule.preferDigits.some((d) => s.includes(String(d)));
}

export function applyCharm(
  rawPrice: number,
  regionCode: string,
  currencyCode: string,
  config: CharmConfig
): CharmResult {
  const ending = resolveEnding(regionCode, currencyCode, config);
  const rule = resolveLocaleRule(regionCode, currencyCode);
  const zeroDecimal = rule.zeroDecimal === true;
  const smallestUnit = zeroDecimal ? 1 : 0.01;

  const conventionalRaw = zeroDecimal ? Math.round(rawPrice) : round2(rawPrice);
  const conventional = Math.max(
    rule.multipleOf
      ? Math.round(conventionalRaw / rule.multipleOf) * rule.multipleOf
      : conventionalRaw,
    rule.multipleOf ?? smallestUnit
  );

  if (ending === 'none' || rawPrice <= 0) {
    return { price: conventional, applied: ending, rejected: false };
  }

  const { step, delta: magnitudeDelta } = magnitudeFor(rawPrice, zeroDecimal);
  const delta = deltaForEnding(ending, step, zeroDecimal) ?? magnitudeDelta;

  // Five candidate rungs around the raw price. Two on each side gives the
  // locale filters somewhere to go when the nearest rung is unlucky.
  const base = Math.round(rawPrice / step) * step;
  let candidates = [-2, -1, 0, 1, 2]
    .map((k) => base + k * step - delta)
    .map((v) => (zeroDecimal ? Math.round(v) : round2(v)))
    .filter((v) => v > 0);

  if (rule.multipleOf) {
    const m = rule.multipleOf;
    candidates = candidates.map((v) => Math.round(v / m) * m).filter((v) => v > 0);
  }

  candidates = Array.from(new Set(candidates));
  if (candidates.length === 0) {
    return { price: conventional, applied: ending, rejected: true };
  }

  const allowed = candidates.filter((v) => !violatesAvoid(v, rule));
  const pool = allowed.length > 0 ? allowed : candidates;

  const nearest = (list: number[]) =>
    list.reduce((best, v) =>
      Math.abs(v - rawPrice) < Math.abs(best - rawPrice) ? v : best
    );

  // A lucky digit is worth a small detour, but only a small one.
  const preferred = pool.filter(
    (v) =>
      hasPreferred(v, rule) &&
      Math.abs(v - rawPrice) / rawPrice <= PREFER_DIGIT_WINDOW
  );
  const chosen = preferred.length > 0 ? nearest(preferred) : nearest(pool);

  // The safety rail: charm must never overrule the strategy.
  //
  // A flat percentage cannot express this, because a charm step is a different
  // fraction of the price at every magnitude — one step is 21% of $4.62 but
  // 0.8% of $12,870. A pure percentage rail would reject $4.62 -> $4.99, which
  // is precisely the adjustment the feature exists to make.
  //
  // So the allowance is the larger of two things: 8% of the price, and a little
  // over half a step. The second term guarantees that snapping to the *nearest*
  // rung is always permitted; the first lets larger prices absorb the extra
  // distance a locale filter may add when it rejects the nearest rung. What the
  // rail actually catches is a locale rule dragging the price to a distant rung.
  const allowance = Math.max(CHARM_SAFETY_RAIL * rawPrice, step * 0.75 + delta);
  if (Math.abs(chosen - rawPrice) > allowance) {
    return { price: conventional, applied: ending, rejected: true };
  }

  return { price: chosen, applied: ending, rejected: false };
}
