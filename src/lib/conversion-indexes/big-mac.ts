// The Economist Big Mac Index, 2026-07-01. CC BY 4.0.
// Source: https://github.com/TheEconomist/big-mac-data
// Modified: dollar prices normalized to the US. Missing countries use an explicit estimate.
export const BIG_MAC_INDEX: Record<string, number> = {
  "AE": 0.831687,
  "AR": 0.949577,
  "AU": 0.956523,
  "AZ": 0.685644,
  "BH": 0.767508,
  "BR": 0.756483,
  "CA": 0.934779,
  "CH": 1.453686,
  "CL": 0.869446,
  "CN": 0.629239,
  "CO": 1.286658,
  "CR": 1.124702,
  "CZ": 0.873656,
  "DK": 1.131398,
  "EG": 0.461348,
  "GB": 1.189746,
  "GT": 0.717363,
  "HK": 0.522988,
  "HN": 0.834788,
  "HU": 0.851697,
  "ID": 0.382684,
  "IN": 0.394565,
  "IL": 1.232871,
  "JO": 0.566896,
  "JP": 0.495796,
  "KR": 0.61673,
  "KW": 0.727239,
  "LB": 0.861758,
  "MD": 0.732862,
  "MX": 1.007944,
  "MY": 0.573621,
  "NI": 0.820884,
  "NO": 1.294719,
  "NZ": 0.825743,
  "OM": 0.638828,
  "PK": 0.624749,
  "PE": 0.802505,
  "PH": 0.44047,
  "PL": 0.999731,
  "QA": 0.794807,
  "RO": 0.643908,
  "SA": 0.813492,
  "SG": 0.928452,
  "SE": 1.151355,
  "TH": 0.645573,
  "TR": 1.111069,
  "TW": 0.389598,
  "UA": 0.536263,
  "UY": 1.436998,
  "US": 1.0,
  "VE": 0.724631,
  "VN": 0.465375,
  "ZA": 0.560362
};

// Default multiplier for countries not in the index
export const DEFAULT_BIG_MAC_MULTIPLIER = 0.70;

// Get Big Mac Index multiplier for a region
export function getBigMacMultiplier(regionCode: string): number {
  return BIG_MAC_INDEX[regionCode] ?? DEFAULT_BIG_MAC_MULTIPLIER;
}

// Get all Big Mac Index data
export function getAllBigMacData(): Record<string, { multiplier: number; source: 'big-mac-index' | 'default' }> {
  const result: Record<string, { multiplier: number; source: 'big-mac-index' | 'default' }> = {};

  // Add all known countries
  for (const [regionCode, multiplier] of Object.entries(BIG_MAC_INDEX)) {
    result[regionCode] = { multiplier, source: 'big-mac-index' };
  }

  return result;
}
