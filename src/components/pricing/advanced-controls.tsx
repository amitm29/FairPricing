'use client';

import { useState } from 'react';
import { Pencil, X } from 'lucide-react';
import { calculateBulkPrices, DEFAULT_BLEND, type PricingOptions, type PricingStrategy, type RoundingMode } from '@/lib/google-play/currency';
import { parseMoney } from '@/lib/google-play/types';
import { currencyDigits } from '@/lib/pricing/rounding';

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

export function AdvancedPricingControls({ strategy, rounding, setRounding, options, setOptions, apple = false }: {
  strategy: PricingStrategy;
  rounding: RoundingMode; setRounding: (value: RoundingMode) => void;
  options: PricingOptions; setOptions: (value: PricingOptions) => void; apple?: boolean;
}) {
  const error = pricingOptionsError(strategy, options);
  const field = 'mt-1.5 block h-9 w-full rounded-md border bg-background px-3 text-sm';
  return (
    <div className="space-y-4 rounded-xl border bg-muted/20 p-4">
      <p className="text-xs font-medium tracking-wide text-muted-foreground uppercase">Fine-tune</p>
      <div className="grid gap-3 sm:grid-cols-3">
        <label className="text-sm font-medium">
          Price ending
          <select className={field} value={rounding} onChange={e => setRounding(e.target.value as RoundingMode)}>
            <option value="none">Off</option>
            <option value="nearest-99">.99</option>
            <option value="nearest-95">.95</option>
            <option value="whole">.00 / whole unit</option>
            <option value="nearest-x9">.x9</option>
            <option value="nearest-x5">.x5</option>
            <option value="round-up">Round up to .99</option>
            {apple && <option value="nearest-tier">Closest Apple tier</option>}
          </select>
        </label>
        <label className="text-sm font-medium">
          Minimum · share of FX
          <input className={`${field} tabular-nums`} type="number" min="0.001" step="0.05" value={options.minRatio} onChange={e => setOptions({ ...options, minRatio: Number(e.target.value) })} />
        </label>
        <label className="text-sm font-medium">
          Maximum · share of FX
          <input className={`${field} tabular-nums`} type="number" min="0.001" step="0.05" value={options.maxRatio} onChange={e => setOptions({ ...options, maxRatio: Number(e.target.value) })} />
        </label>
      </div>
      {strategy === 'blend' && (
        <fieldset className="rounded-lg border bg-background p-3">
          <legend className="px-1 text-xs font-medium text-muted-foreground">Index weights · must total 100%</legend>
          <div className="grid grid-cols-2 gap-2 sm:grid-cols-5">
            {(['direct', 'ppp', 'bigmac', 'netflix', 'gdp'] as const).map(key => (
              <label key={key} className="text-xs text-muted-foreground">
                {({ direct: 'FX', ppp: 'PPP', bigmac: 'Big Mac', netflix: 'Netflix', gdp: 'GDP' })[key]} %
                <input className="mt-1 block h-8 w-full rounded-md border bg-background px-2 text-sm tabular-nums text-foreground" type="number" min="0" max="100" value={options.weights?.[key] ?? 0} onChange={e => setOptions({ ...options, weights: { ...options.weights, [key]: Number(e.target.value) } })} />
              </label>
            ))}
          </div>
        </fieldset>
      )}
      <div className="grid gap-2 sm:grid-cols-2">
        <label className="flex items-start gap-2 text-sm">
          <input type="checkbox" className="mt-0.5" checked={options.capAtBase ?? false} onChange={e => setOptions({ ...options, capAtBase: e.target.checked })} />
          <span>Never price above the base country</span>
        </label>
        <label className="flex items-start gap-2 text-sm">
          <input type="checkbox" className="mt-0.5" checked={options.smartLocalEndings ?? false} onChange={e => setOptions({ ...options, smartLocalEndings: e.target.checked })} />
          <span>
            Smart local endings
            <span className="block text-xs text-muted-foreground">Market conventions such as ₹199 or whole yen. Bounds and store tiers still apply.</span>
          </span>
        </label>
      </div>
      <p className="text-xs leading-relaxed text-muted-foreground">
        GDP uses nominal GDP per capita relative to the base country; missing observations use PPP estimates. Index snapshots and fallback estimates are not live observations.
        {apple && ' Price endings are applied before Apple tier snapping; Apple resolves product-specific tiers when you apply, which can change the ending.'}
      </p>
      {error && <p role="alert" className="text-sm text-destructive">{error}</p>}
    </div>
  );
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

/**
 * A manual price for one region. Overriding is the exception, so the resting
 * state is just a quiet pencil beside the computed price; clicking swaps in a
 * small input, and a set override shows as a "Manual" chip with an × to clear.
 */
export function RegionalOverride({ region, value, computed, onChange }: {
  region: string;
  value?: number;
  /** The price currently shown for the region, used to prefill the input. */
  computed?: number;
  onChange: (region: string, value?: number) => void;
}) {
  const [editing, setEditing] = useState(false);
  const [draft, setDraft] = useState('');

  const start = () => {
    const seed = value ?? computed;
    setDraft(seed === undefined ? '' : String(Number(seed.toFixed(2))));
    setEditing(true);
  };
  const commit = () => {
    setEditing(false);
    const next = Number(draft);
    if (draft.trim() === '' || !Number.isFinite(next) || next <= 0) return;
    // Re-entering the computed price is not an override; leave the region alone.
    if (value === undefined && computed !== undefined && Math.abs(next - computed) < 1e-9) return;
    if (next !== value) onChange(region, next);
  };

  if (editing) {
    return (
      <input
        autoFocus
        aria-label={`Manual price for ${region}`}
        className="ml-2 inline-block h-7 w-24 rounded-md border bg-background px-2 align-middle text-xs font-normal tabular-nums"
        type="number"
        min="0.001"
        step="any"
        value={draft}
        onChange={(e) => setDraft(e.target.value)}
        onFocus={(e) => e.target.select()}
        onBlur={commit}
        onKeyDown={(e) => {
          if (e.key === 'Enter') { e.preventDefault(); commit(); }
          if (e.key === 'Escape') { e.preventDefault(); setEditing(false); }
        }}
      />
    );
  }

  if (value !== undefined) {
    return (
      <span className="ml-2 inline-flex items-center gap-0.5 align-middle">
        <button
          type="button"
          onClick={start}
          title="Edit manual price"
          className="rounded-full bg-primary/10 px-1.5 py-0.5 text-[10px] font-medium tracking-wide text-primary uppercase transition-colors hover:bg-primary/15"
        >
          Manual
        </button>
        <button
          type="button"
          onClick={() => onChange(region, undefined)}
          aria-label={`Clear manual price for ${region}`}
          title="Back to calculated price"
          className="rounded p-0.5 text-muted-foreground transition-colors hover:bg-muted hover:text-foreground"
        >
          <X className="h-3 w-3" />
        </button>
      </span>
    );
  }

  return (
    <button
      type="button"
      onClick={start}
      aria-label={`Set manual price for ${region}`}
      title="Set a manual price"
      className="ml-1.5 inline-flex h-6 w-6 items-center justify-center rounded align-middle text-muted-foreground/50 transition-colors hover:bg-muted hover:text-foreground"
    >
      <Pencil className="h-3 w-3" />
    </button>
  );
}

export function calculateConnectedPrices(overrides: Record<string, number>, ...args: Parameters<typeof calculateBulkPrices>) {
  const [, , , , , , , , , , getTiers, options] = args;
  return calculateBulkPrices(...args).map(item => {
    const override = overrides[item.regionCode];
    if (override === undefined) return item;

    // A manual price is the user's decision and is applied exactly as typed:
    // no strategy, no charm ending, and none of the bounds — min/max share of
    // FX, cap-at-base and the bundled regional minimum all exist to keep
    // *calculated* prices sensible. What remains is only what the store itself
    // enforces: the currency's decimal places, and Apple's price tiers.
    const scale = 10 ** currencyDigits(item.currencyCode);
    let price = Math.round(override * scale) / scale;
    const tiers = options?.snapToTiers ? getTiers?.(item.currencyCode) : undefined;
    if (tiers?.length) {
      price = tiers.reduce((best, tier) => Math.abs(tier.price - price) < Math.abs(best.price - price) ? tier : best).price;
    }

    // Keep the derived fields coherent so "vs FX" columns read correctly:
    // multiplier is price / FX, and adjustedUsdPrice / multiplier * rate is FX.
    const fxPrice = item.adjustedUsdPrice / item.multiplier * item.exchangeRate;
    const multiplier = Number.isFinite(fxPrice) && fxPrice > 0 ? price / fxPrice : item.multiplier;
    return {
      ...item,
      price: parseMoney(price, item.currencyCode),
      rawPrice: price,
      multiplier,
      multiplierSource: 'custom' as const,
      adjustedUsdPrice: price / item.exchangeRate,
    };
  });
}
