import snapshot from './gdp-data.json';
import { getPricingIndexEntry } from './ppp';

export const GDP_DATA = snapshot.data as Record<string, { value: number; year: number }>;
export const GDP_SOURCE = { name: snapshot.source, url: snapshot.url, retrievedAt: snapshot.retrievedAt };

/** Nominal GDP per capita ratio. Missing observations use the relative PPP estimate. */
export function getGdpMultiplier(region: string, baseRegion = 'US') {
  const target = GDP_DATA[region];
  const base = GDP_DATA[baseRegion];
  if (!target || !base) return {
    multiplier: getPricingIndexEntry(region).pppMultiplier / getPricingIndexEntry(baseRegion).pppMultiplier,
    fallback: true,
  };
  return { multiplier: target.value / base.value, fallback: false };
}
