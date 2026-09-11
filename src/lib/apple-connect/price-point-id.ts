/**
 * App Store Connect price point IDs are opaque to the API but have a stable
 * shape: base64 of `{"s": source, "t": territory, "p": tierRef}`. `s` is the
 * product's (or subscription's) source id, `t` the alpha-3 territory, `p` the
 * tier reference shared by every product in the app.
 *
 * Nothing here assumes that shape blindly: callers verify it with
 * `roundTrips()` against a real id before synthesising any.
 */
export interface PricePointParts {
  sourceId: string;
  territoryCode: string;
  tierRef: string;
}

// Apple emits these ids as *unpadded* base64 (no trailing "="). We emit the
// same canonical form, compare padding-insensitively, and pad before decoding
// because the browser's atob() rejects unpadded input.
const stripPadding = (b64: string) => b64.replace(/=+$/, '');
const pad = (b64: string) => b64 + '='.repeat((4 - (b64.length % 4)) % 4);
const toBase64 = (text: string) =>
  stripPadding(typeof Buffer !== 'undefined' ? Buffer.from(text, 'utf-8').toString('base64') : btoa(text));
const fromBase64 = (text: string) =>
  typeof Buffer !== 'undefined' ? Buffer.from(pad(text), 'base64').toString('utf-8') : atob(pad(text));

export function encodePricePointId({ sourceId, territoryCode, tierRef }: PricePointParts): string {
  return toBase64(JSON.stringify({ s: sourceId, t: territoryCode, p: tierRef }));
}

export function decodePricePointId(id: string): PricePointParts | null {
  try {
    const parsed = JSON.parse(fromBase64(id));
    if (typeof parsed?.s !== 'string' || typeof parsed?.t !== 'string' || typeof parsed?.p !== 'string') return null;
    return { sourceId: parsed.s, territoryCode: parsed.t, tierRef: parsed.p };
  } catch {
    return null;
  }
}

/** True when an id decodes to the expected shape and re-encodes to itself byte for byte. */
export function roundTrips(id: string): boolean {
  const parts = decodePricePointId(id);
  return parts !== null && encodePricePointId(parts) === stripPadding(id);
}
