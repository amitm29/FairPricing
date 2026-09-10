// Charm operates at the magnitude a shopper actually reads, not blindly at the
// cent. A raw 1247.30 should become 1299, not 1247.99.

export interface Magnitude {
  /** Round to a multiple of this before subtracting `delta`. */
  step: number;
  /** How far below the round step a charm price sits. */
  delta: number;
}

/**
 *   < 100      step 1     delta 0.01   ->    49.99
 *   100-999    step 10    delta 1      ->   299
 *   1000-9999  step 100   delta 1      ->  1299
 *   >= 10000   step 1000  delta 100    -> 12900
 *
 * Zero-decimal currencies never get a sub-unit delta — there is no such coin.
 */
export function magnitudeFor(price: number, zeroDecimal: boolean): Magnitude {
  const abs = Math.abs(price);
  if (abs < 100) return { step: 1, delta: zeroDecimal ? 1 : 0.01 };
  if (abs < 1000) return { step: 10, delta: 1 };
  if (abs < 10000) return { step: 100, delta: 1 };
  return { step: 1000, delta: 100 };
}
