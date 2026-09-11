import { describe, expect, it } from 'vitest';
import { decodePricePointId, encodePricePointId, roundTrips } from '../price-point-id';

describe('price point ids', () => {
  const parts = { sourceId: '6781299315', territoryCode: 'USA', tierRef: '10222' };
  it('round-trips the documented shape in Apple\'s unpadded form', () => {
    const id = encodePricePointId(parts);
    expect(id).toBe(Buffer.from(JSON.stringify({ s: parts.sourceId, t: parts.territoryCode, p: parts.tierRef })).toString('base64').replace(/=+$/, ''));
    expect(decodePricePointId(id)).toEqual(parts);
    expect(roundTrips(id)).toBe(true);
  });
  it('accepts real ids from App Store Connect, padded or not', () => {
    // A real subscription price point id, captured from the API (unpadded).
    const real = 'eyJzIjoiNjc5NzQ5MTM1OCIsInQiOiJBRkciLCJwIjoiMTAxNzIifQ';
    expect(decodePricePointId(real)).toEqual({ sourceId: '6797491358', territoryCode: 'AFG', tierRef: '10172' });
    expect(roundTrips(real)).toBe(true);
    expect(roundTrips(real + '==')).toBe(true);
    expect(encodePricePointId(decodePricePointId(real)!)).toBe(real);
  });
  it('rejects ids that are not that shape', () => {
    expect(decodePricePointId('not base64 json')).toBeNull();
    expect(decodePricePointId(Buffer.from('{"foo":1}').toString('base64'))).toBeNull();
    // Same fields, different key order: decodes, but does not re-encode identically, so it must not be synthesised from.
    expect(roundTrips(Buffer.from('{"t":"USA","s":"1","p":"2"}').toString('base64'))).toBe(false);
  });
});
