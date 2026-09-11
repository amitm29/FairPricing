'use client';

import { useEffect } from 'react';
import { ArrowLeftRight, Blend, ChartNoAxesCombined, Hamburger, Landmark, RefreshCw, Tv } from 'lucide-react';
import { Label } from '@/components/ui/label';
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from '@/components/ui/tooltip';
import type { PricingStrategy } from '@/lib/google-play/currency';

/**
 * The one place the six strategies are listed for the connected editors. Order
 * and naming match the landing page and /compare so the product reads as one
 * tool rather than three modals that each grew their own picker.
 */
export const STRATEGY_OPTIONS: {
  id: PricingStrategy;
  name: string;
  short: string;
  icon: React.ComponentType<{ className?: string }>;
  summary: string;
  source?: string;
}[] = [
  { id: 'direct', name: 'Exchange rate', short: 'Exchange rate', icon: ArrowLeftRight, summary: 'Same value everywhere, converted to local currency. The baseline.' },
  { id: 'ppp', name: 'World Bank PPP', short: 'PPP', icon: Landmark, summary: 'Adjusts for local purchasing power using World Bank price-level data.', source: 'World Bank PA.NUS.PPP · CC BY 4.0' },
  { id: 'bigmac', name: 'Big Mac Index', short: 'Big Mac', icon: Hamburger, summary: 'Affordability through the price of an everyday purchase.', source: 'The Economist · CC BY 4.0' },
  { id: 'netflix', name: 'Netflix Index', short: 'Netflix', icon: Tv, summary: 'Follows how a global digital subscription is priced by country.', source: 'tompec/netflix-prices · CC BY 4.0' },
  { id: 'gdp', name: 'GDP-adjusted', short: 'GDP', icon: ChartNoAxesCombined, summary: 'Scales by nominal GDP per person. Hits the price floor in many markets — check the bounds.', source: 'World Bank · CC BY 4.0' },
  { id: 'blend', name: 'Custom blend', short: 'Blend', icon: Blend, summary: 'Weight the indexes yourself. Weights must total 100%.' },
];

export function StrategyPicker({
  strategy,
  onChange,
  loading = false,
  sourceOverrides,
}: {
  strategy: PricingStrategy;
  onChange: (strategy: PricingStrategy) => void;
  loading?: boolean;
  /** Live data attribution that replaces the static source line, e.g. fetched World Bank metadata. */
  sourceOverrides?: Partial<Record<PricingStrategy, string | null | undefined>>;
}) {
  // Drafts are persisted per app in localStorage. A draft saved before the
  // non-functional "custom" option was removed would otherwise render with
  // nothing selected, so fall back to the baseline.
  useEffect(() => {
    if (!STRATEGY_OPTIONS.some((option) => option.id === strategy)) onChange('direct');
  }, [strategy, onChange]);

  return (
    <div className="space-y-3">
      <div className="flex items-center justify-between">
        <Label>Pricing strategy</Label>
        {loading && <RefreshCw className="h-3 w-3 animate-spin text-muted-foreground" />}
      </div>
      <TooltipProvider delayDuration={200}>
        <div className="grid grid-cols-2 gap-2 sm:grid-cols-3 lg:grid-cols-6" role="radiogroup" aria-label="Pricing strategy">
          {STRATEGY_OPTIONS.map(({ id, short, name, icon: Icon, summary, source }) => (
            <Tooltip key={id}>
              <TooltipTrigger asChild>
                <label className="flex cursor-pointer items-center gap-2.5 rounded-xl border p-3 transition-colors hover:bg-muted/50 has-[:checked]:border-primary/50 has-[:checked]:bg-primary/10 has-[:checked]:[&_svg]:text-primary">
                  <input
                    type="radio"
                    name="strategy"
                    value={id}
                    checked={strategy === id}
                    onChange={() => onChange(id)}
                    className="sr-only"
                  />
                  <Icon className="h-4 w-4 shrink-0 text-muted-foreground" />
                  <span className="truncate text-sm font-medium">{short}</span>
                </label>
              </TooltipTrigger>
              <TooltipContent side="bottom" className="max-w-xs">
                <p className="font-medium">{name}</p>
                <p className="text-xs text-muted-foreground">{summary}</p>
                {(sourceOverrides?.[id] ?? source) && (
                  <p className="mt-1 text-xs text-muted-foreground">Data: {sourceOverrides?.[id] ?? source}</p>
                )}
              </TooltipContent>
            </Tooltip>
          ))}
        </div>
      </TooltipProvider>
    </div>
  );
}
