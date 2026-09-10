'use client';

import { useState } from 'react';
import { calculateBulkPrices, calculateRegionalPrice, DEFAULT_BLEND, type PricingOptions, type PricingStrategy, type RoundingMode } from '@/lib/google-play/currency';

export function useSavedPricingSetting<T>(key: string, field: string, initial: T): [T, (value: T) => void] {
  const storageKey = `fairpricing:config:${key}:${field}`;
  const read = (): T => {
    try { return JSON.parse(localStorage.getItem(storageKey) ?? 'null') ?? initial; } catch { return initial; }
  };
  const [draft, setDraft] = useState(() => ({ key: storageKey, value: read() }));
  // Switching scope only reads. Persist exclusively in the event setter below,
  // so an old app draft cannot be written into the new app during restoration.
  if (draft.key !== storageKey) setDraft({ key: storageKey, value: read() });
  return [draft.key === storageKey ? draft.value : initial, value => {
    setDraft({ key: storageKey, value });
    try { localStorage.setItem(storageKey, JSON.stringify(value)); } catch { /* Keep the in-memory draft. */ }
  }];
}

export function usePricingOptions(key: string) {
  return useSavedPricingSetting<PricingOptions>(key, 'options', { weights: DEFAULT_BLEND, minRatio: 0.1, maxRatio: 2 });
}

export function pricingOptionsError(strategy: PricingStrategy, options: PricingOptions) {
  const values = Object.values(options.weights ?? DEFAULT_BLEND);
  if (strategy === 'blend' && (values.some(v => !Number.isFinite(v) || v < 0) || Math.abs(values.reduce((a, b) => a + b, 0) - 100) > 0.001)) return 'Blend weights must be nonnegative and total 100%.';
  if (!Number.isFinite(options.minRatio) || !Number.isFinite(options.maxRatio) || options.minRatio! <= 0 || options.maxRatio! < options.minRatio!) return 'Enter positive bounds with maximum at least minimum.';
  return null;
}

export function AdvancedPricingControls({ strategy, setStrategy, rounding, setRounding, options, setOptions, apple = false }: {
  strategy: PricingStrategy; setStrategy: (value: PricingStrategy) => void;
  rounding: RoundingMode; setRounding: (value: RoundingMode) => void;
  options: PricingOptions; setOptions: (value: PricingOptions) => void; apple?: boolean;
}) {
  const error = pricingOptionsError(strategy, options);
  return <div className="space-y-3 rounded-lg border p-4">
    <div className="grid gap-3 sm:grid-cols-2">
      <label className="space-y-1 text-sm">Strategy<select className="block w-full rounded border bg-background p-2" value={strategy} onChange={e => setStrategy(e.target.value as PricingStrategy)}>
        <option value="direct">Exchange rate</option><option value="ppp">World Bank PPP</option><option value="bigmac">Big Mac</option><option value="netflix">Netflix</option><option value="gdp">GDP-adjusted</option><option value="blend">Weighted blend</option><option value="custom" disabled>Custom multiplier (coming soon)</option>
      </select></label>
      <label className="space-y-1 text-sm">Price ending<select className="block w-full rounded border bg-background p-2" value={rounding} onChange={e => setRounding(e.target.value as RoundingMode)}>
        <option value="none">Off</option><option value="nearest-99">.99</option><option value="nearest-95">.95</option><option value="whole">.00 / whole unit</option><option value="nearest-x9">.x9</option><option value="nearest-x5">.x5</option><option value="round-up">Round up to .99</option>{apple && <option value="nearest-tier">Closest Apple tier</option>}
      </select></label>
    </div>
    {strategy === 'blend' && <fieldset className="grid grid-cols-2 gap-2 sm:grid-cols-5"><legend className="mb-2 text-sm">Index weights (total 100%)</legend>{(['direct', 'ppp', 'bigmac', 'netflix', 'gdp'] as const).map(key => <label key={key} className="text-xs">{({ direct: 'FX', ppp: 'PPP', bigmac: 'Big Mac', netflix: 'Netflix', gdp: 'GDP' })[key]} %<input className="mt-1 w-full rounded border bg-background p-2" type="number" min="0" max="100" value={options.weights?.[key] ?? 0} onChange={e => setOptions({ ...options, weights: { ...options.weights, [key]: Number(e.target.value) } })} /></label>)}</fieldset>}
    <div className="flex flex-wrap gap-3">{(['minRatio', 'maxRatio'] as const).map(key => <label key={key} className="text-xs">{key === 'minRatio' ? 'Minimum' : 'Maximum'} price / FX ratio<input className="ml-2 w-20 rounded border bg-background p-2" type="number" min="0.001" step="0.05" value={options[key]} onChange={e => setOptions({ ...options, [key]: Number(e.target.value) })} /></label>)}</div>
    <div className="space-y-2"><label className="flex items-center gap-2 text-sm"><input type="checkbox" checked={options.capAtBase ?? false} onChange={e=>setOptions({...options,capAtBase:e.target.checked})}/>Never price above the base country</label><label className="flex items-center gap-2 text-sm"><input type="checkbox" checked={options.smartLocalEndings ?? false} onChange={e=>setOptions({...options,smartLocalEndings:e.target.checked})}/>Smart local endings</label><p className="text-xs text-muted-foreground">Suggested market conventions, such as ₹199 or whole yen. Final prices still respect bounds and store tiers. Off keeps your selected ending.</p></div>
    <p className="text-xs text-muted-foreground">GDP uses nominal GDP per capita relative to the base country; missing observations use PPP estimates. Index snapshots and fallback estimates are not live observations.</p>
    {apple && <p className="text-xs text-muted-foreground">Price endings are applied before Apple tier snapping. This preview uses the bundled tier snapshot; Apple resolves product-specific tiers when you explicitly apply prices, which can change the ending.</p>}
    {error && <p role="alert" className="text-sm text-destructive">{error}</p>}
  </div>;
}

export function useRegionalOverrides(key: string) {
  const [draft, setDraft] = useState<{ key: string; values: Record<string, number> }>(() => {
    try {
      const parsed = JSON.parse(localStorage.getItem(`fairpricing:overrides:${key}`) ?? '{}');
      return { key, values: Object.fromEntries(Object.entries(parsed).filter(([, v]) => typeof v === 'number' && Number.isFinite(v) && v > 0)) as Record<string, number> };
    } catch { return { key, values: {} }; }
  });
  if (draft.key !== key) {
    let saved: Record<string, number> = {};
    try { saved = JSON.parse(localStorage.getItem(`fairpricing:overrides:${key}`) ?? '{}'); } catch { /* Empty draft. */ }
    setDraft({ key, values: saved });
  }
  const values = draft.key === key ? draft.values : {};
  const update = (region: string, value?: number) => {
    const next = { ...values };
    if (value === undefined) delete next[region]; else next[region] = value;
    setDraft({ key, values: next });
    try { localStorage.setItem(`fairpricing:overrides:${key}`, JSON.stringify(next)); } catch { /* In-memory draft remains usable. */ }
  };
  return { values, update };
}

export function RegionalOverride({ region, value, onChange }: { region: string; value?: number; onChange: (region: string, value?: number) => void }) {
  return <div className="mt-1 flex items-center justify-end gap-1"><input aria-label={`Manual price for ${region}`} placeholder="Override" className="w-24 rounded border bg-background p-1 text-xs" type="number" min="0.001" step="any" value={value ?? ''} onChange={e => { const number = Number(e.target.value); if (e.target.value && Number.isFinite(number) && number > 0) onChange(region, number); }} />{value !== undefined && <button type="button" className="text-xs underline" onClick={() => onChange(region, undefined)}>Reset</button>}</div>;
}

export function calculateConnectedPrices(overrides: Record<string, number>, ...args: Parameters<typeof calculateBulkPrices>) {
  return calculateBulkPrices(...args).map(item => {
    const override = overrides[item.regionCode];
    if (override === undefined) return item;
    const fxPrice = item.adjustedUsdPrice / item.multiplier * item.exchangeRate;
    const [base, , , , , ppp, currencies, rates, baseCurrency, baseRegion, tiers, options] = args;
    return calculateRegionalPrice(base, item.regionCode, 'custom', 'none', override / fxPrice, ppp, currencies, rates, baseCurrency, baseRegion, tiers, options);
  });
}
