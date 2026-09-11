'use client';
import { PriceMapPreview } from '@/components/pricing/world-map';

import { pricingDraftKey } from '@/components/pricing/draft-key';

import { StrategyPicker } from '@/components/pricing/strategy-picker';
import { RegionFilterBar } from '@/components/pricing/region-filter-bar';
import { AdvancedPricingControls, usePricingOptions, pricingOptionsError, useRegionalOverrides, RegionalOverride, calculateConnectedPrices, useSavedPricingSetting } from '@/components/pricing/advanced-controls';

import { useState, useMemo, useEffect, useCallback } from 'react';
import { Calculator, Loader2, ArrowUpDown, ChevronUp, ChevronDown } from 'lucide-react';
import { toast } from 'sonner';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Checkbox } from '@/components/ui/checkbox';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table';
import { ScrollArea } from '@/components/ui/scroll-area';
import { Badge } from '@/components/ui/badge';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import { getCurrencySymbol } from '@/lib/utils/currency';
import {
  Tooltip,
  TooltipContent,
  TooltipProvider,
  TooltipTrigger,
} from '@/components/ui/tooltip';
import type { Money, Subscription, BasePlan } from '@/lib/google-play/types';
import {
  GOOGLE_PLAY_REGIONS,
  formatMoney,
  moneyToNumber,
} from '@/lib/google-play/types';
import {
  calculatePriceChange,
  formatPriceChange,
  type PricingStrategy,
  type RoundingMode,
  type DynamicPPPData,
  type DynamicExchangeRates,
} from '@/lib/google-play/currency';
import { useUpdateBasePlanPrices } from '@/hooks/use-subscriptions';

interface PPPApiResponse {
  success: boolean;
  data: DynamicPPPData;
  metadata: {
    baseYear: number | null;
    fetchedAt: string;
    worldBankRegions: number;
    totalRegions: number;
    fallback?: boolean;
    error?: string;
  };
}

interface ExchangeRatesApiResponse {
  success: boolean;
  noApiKey?: boolean;
  error?: string;
  data: {
    base: string;
    rates: Record<string, number>;
    timestamp: number;
    fetchedAt: string;
  };
  metadata: {
    currencyCount: number;
    cacheAge: number;
  };
}

interface SubscriptionBulkPricingModalProps {
  subscription: Subscription;
  basePlan: BasePlan;
  open: boolean;
  onOpenChange: (open: boolean) => void;
}

export function SubscriptionBulkPricingModal({
  subscription,
  basePlan,
  open,
  onOpenChange,
}: SubscriptionBulkPricingModalProps) {
  const [basePrice, setBasePrice] = useState<string>('');
  const [baseRegion, setBaseRegion] = useState<string>('US');
  const draftKey = pricingDraftKey('google', subscription.packageName, 'subscription', subscription.productId, basePlan.basePlanId);
  const { values: overrides, update: updateOverride } = useRegionalOverrides(draftKey);
  const [pricingOptions, setPricingOptions] = usePricingOptions(draftKey);
  const [strategy, setStrategy] = useSavedPricingSetting<PricingStrategy>(draftKey, 'strategy', 'ppp');
  const [rounding, setRounding] = useSavedPricingSetting<RoundingMode>(draftKey, 'rounding', 'nearest-99');
  const [selectedRegions, setSelectedRegions] = useState<Set<string>>(new Set());

  // PPP data from World Bank API
  const [pppData, setPppData] = useState<DynamicPPPData | null>(null);
  const [pppMetadata, setPppMetadata] = useState<PPPApiResponse['metadata'] | null>(null);
  const [pppLoading, setPppLoading] = useState(false);

  // Exchange rates from Open Exchange Rates API
  const [exchangeRates, setExchangeRates] = useState<DynamicExchangeRates | null>(null);
  const [exchangeRatesLoading, setExchangeRatesLoading] = useState(false);

  const updateMutation = useUpdateBasePlanPrices('google');
  const [isApplying, setIsApplying] = useState(false);
  const [showConfirmDialog, setShowConfirmDialog] = useState(false);
  const [hasInitializedSelection, setHasInitializedSelection] = useState(false);
  const [pppFetched, setPppFetched] = useState(false);
  const [exchangeRatesFetched, setExchangeRatesFetched] = useState(false);
  const [updateSummary, setUpdateSummary] = useState<{
    changing: Array<{ name: string; old: string; new: string; regionCode: string }>;
    staying: Array<{ name: string; price: string; regionCode: string }>;
  } | null>(null);
  const [sortConfig, setSortConfig] = useState<{
    key: string;
    direction: 'asc' | 'desc' | null;
  }>({ key: 'name', direction: 'asc' });

  const basePriceNum = parseFloat(basePrice) || 0;

  // Normalize prices from subscription data (handles both Google and Apple formats)
  // Must be calculated before allRegions so we can include territories with existing pricing
  const normalizedPrices = useMemo(() => {
    const prices: Record<string, Money> = {};
    if (basePlan.regionalConfigs) {
      for (const config of basePlan.regionalConfigs) {
        if (config.price) {
          prices[config.regionCode] = config.price;
        }
      }
    }
    return prices;
  }, [basePlan.regionalConfigs]);

  // Get Google Play regions sorted by country name
  const allRegions = useMemo(() => {
    return [...GOOGLE_PLAY_REGIONS].sort((a, b) => a.name.localeCompare(b.name));
  }, []);

  // Fetch PPP data and exchange rates when modal opens
  // Only depend on `open` to prevent infinite retry loops on fetch failure
  useEffect(() => {
    if (open) {
      if (!pppData && !pppLoading) {
        fetchPPPData();
      }
      if (!exchangeRates && !exchangeRatesLoading) {
        fetchExchangeRates();
      }
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [open]);

  const fetchPPPData = async (forceRefresh = false) => {
    setPppLoading(true);
    try {
      const url = forceRefresh ? '/api/ppp?refresh=true' : '/api/ppp';
      const response = await fetch(url);
      const data: PPPApiResponse = await response.json();

      if (data.success) {
        setPppData(data.data);
        setPppMetadata(data.metadata);
      }
    } catch (error) {
      console.error('Failed to fetch PPP data:', error);
      toast.error('Failed to fetch PPP data, using static values');
    } finally {
      setPppLoading(false);
      setPppFetched(true);
    }
  };

  const fetchExchangeRates = async (forceRefresh = false) => {
    setExchangeRatesLoading(true);
    try {
      const url = forceRefresh ? '/api/exchange-rates?refresh=true' : '/api/exchange-rates';
      const response = await fetch(url);
      const data: ExchangeRatesApiResponse = await response.json();

      if (data.success) {
        setExchangeRates({
          base: data.data.base,
          rates: data.data.rates,
          fetchedAt: data.data.fetchedAt,
        });
      } else if (data.noApiKey) {
        toast.info('Add an Open Exchange Rates API key in Settings for live exchange rates.');
      }
    } catch (error) {
      console.error('Failed to fetch exchange rates:', error);
      // Don't show error toast - we'll fall back to static rates
    } finally {
      setExchangeRatesLoading(false);
      setExchangeRatesFetched(true);
    }
  };

  // Get regions to apply pricing to
  const targetRegions = useMemo(() => {
    // We calculate preview for ALL regions so user can pick from the table
    return allRegions.map((r) => r.code);
  }, [allRegions]);

  // Extract actual currencies from normalized prices
  const actualCurrencies = useMemo(() => {
    const currencies: Record<string, string> = {};
    for (const [regionCode, money] of Object.entries(normalizedPrices)) {
      if (money.currencyCode) {
        currencies[regionCode] = money.currencyCode;
      }
    }
    return currencies;
  }, [normalizedPrices]);

  // Currency derived from selected base region.
  const baseCurrency = useMemo(() => {
    return GOOGLE_PLAY_REGIONS.find((r) => r.code === baseRegion)?.currency || 'USD';
  }, [baseRegion]);

  // When the base region changes, prefill basePrice from the base plan's existing
  // price for that region, if it has one.
  useEffect(() => {
    const config = basePlan.regionalConfigs?.find((rc) => rc.regionCode === baseRegion);
    if (config?.price) {
      setBasePrice(moneyToNumber(config.price).toString());
    }
  }, [baseRegion, basePlan.regionalConfigs]);

  // Calculate preview prices
  const { prices: previewPrices, error: previewError } = useMemo(() => {
    try {
      const calculatePreview = () => {
    if (basePriceNum <= 0) return [];
    const error = pricingOptionsError(strategy, pricingOptions);
    if (error) throw new Error(error);

    return calculateConnectedPrices(
      overrides,
      basePriceNum,
      targetRegions,
      strategy,
      rounding,
      undefined, // customMultipliers
      pppData ?? undefined, // dynamicPPPData
      actualCurrencies, // Use actual currencies from Google Play
      exchangeRates ?? undefined, // Dynamic exchange rates from API
      baseCurrency,
      baseRegion,
      undefined,
      pricingOptions
    );

      };
      return { prices: calculatePreview(), error: null };
    } catch (error) {
      return { prices: [], error: error instanceof Error ? error.message : 'Unable to calculate regional prices.' };
    }
  }, [basePriceNum, targetRegions, strategy, rounding, pricingOptions, overrides, pppData, actualCurrencies, exchangeRates, baseCurrency, baseRegion]);

  // Get current price for a region
  const getCurrentPrice = useCallback((regionCode: string): Money | null => {
    return normalizedPrices[regionCode] || null;
  }, [normalizedPrices]);

  const sortedPreviewPrices = useMemo(() => {
    const items = [...previewPrices].map(item => {
      const region = allRegions.find(r => r.code === item.regionCode);
      const currentPrice = getCurrentPrice(item.regionCode);
      const currentPriceNum = currentPrice ? moneyToNumber(currentPrice) : 0;
      const targetPriceNum = moneyToNumber(item.price);
      const change = calculatePriceChange(currentPriceNum, targetPriceNum);

      return {
        ...item,
        countryName: region?.name || item.regionCode,
        currentPriceNum,
        change,
        newPriceNum: targetPriceNum,
        // New region, or a price that moves by at least half a percent.
        isModified: !currentPrice || Math.abs(change) >= 0.5,
      };
    });

    if (sortConfig.key && sortConfig.direction) {
      items.sort((a, b) => {
        let aValue: string | number;
        let bValue: string | number;

        switch (sortConfig.key) {
          case 'region':
            aValue = a.regionCode;
            bValue = b.regionCode;
            break;
          case 'name':
            aValue = a.countryName;
            bValue = b.countryName;
            break;
          case 'currency':
            aValue = a.currencyCode;
            bValue = b.currencyCode;
            break;
          case 'multiplier':
            aValue = a.multiplier;
            bValue = b.multiplier;
            break;
          case 'current':
            aValue = a.currentPriceNum;
            bValue = b.currentPriceNum;
            break;
          case 'new':
            aValue = a.newPriceNum;
            bValue = b.newPriceNum;
            break;
          case 'change':
            aValue = a.change;
            bValue = b.change;
            break;
          default:
            return 0;
        }

        if (aValue < bValue) {
          return sortConfig.direction === 'asc' ? -1 : 1;
        }
        if (aValue > bValue) {
          return sortConfig.direction === 'asc' ? 1 : -1;
        }
        return 0;
      });
    }

    return items;
  }, [previewPrices, sortConfig, allRegions, getCurrentPrice]);

  // View filters for the region table. They narrow what is shown, not what is selected.
  const [regionQuery, setRegionQuery] = useState('');
  const [showOnlyModified, setShowOnlyModified] = useState(false);
  const visiblePreviewPrices = useMemo(() => {
    const needle = regionQuery.trim().toLowerCase();
    return sortedPreviewPrices.filter((item) => {
      if (showOnlyModified && !item.isModified) return false;
      if (!needle) return true;
      return (
        item.regionCode.toLowerCase().includes(needle) ||
        item.countryName.toLowerCase().includes(needle) ||
        item.currencyCode.toLowerCase().includes(needle)
      );
    });
  }, [sortedPreviewPrices, regionQuery, showOnlyModified]);
  const modifiedCount = useMemo(() => sortedPreviewPrices.filter((item) => item.isModified).length, [sortedPreviewPrices]);

  // Auto-select regions where the target price deviates from current price
  useEffect(() => {
    // Only run if modal is open, we haven't initialized yet, and data fetching is COMPLETE
    // This prevents initializing selection with stale/default prices before PPP data loads
    const isFetchingComplete = pppFetched && exchangeRatesFetched;

    if (open && !hasInitializedSelection && previewPrices.length > 0 && isFetchingComplete) {
      // Safety check: ensure previewPrices first item matches a region we expect
      const firstPreview = previewPrices[0];
      const belongsToCurrentSubscription = allRegions.some(r => r.code === firstPreview.regionCode);

      if (!belongsToCurrentSubscription) return;

      const newSelected = new Set<string>();

      previewPrices.forEach((calculated) => {
        const current = getCurrentPrice(calculated.regionCode);
        const target = calculated.price;

        const currentNum = current ? moneyToNumber(current) : 0;
        const targetNum = moneyToNumber(target);

        // Calculate the same change percentage as the "Change" column
        const change = calculatePriceChange(currentNum, targetNum);

        // MATCH UI DISPLAY: Only pre-select if rounded change is non-zero
        // Using abs() >= 0.5 to match toFixed(0) rounding behavior seen in the table
        const isDifferent = !current || Math.abs(change) >= 0.5;

        if (isDifferent) {
          newSelected.add(calculated.regionCode);
        }
      });

      setSelectedRegions(newSelected);
      setHasInitializedSelection(true);
    }
  }, [open, previewPrices, hasInitializedSelection, allRegions, pppFetched, exchangeRatesFetched, getCurrentPrice]);

  // Handle sorting
  const requestSort = (key: string) => {
    let direction: 'asc' | 'desc' | null = 'asc';
    if (sortConfig.key === key && sortConfig.direction === 'asc') {
      direction = 'desc';
    } else if (sortConfig.key === key && sortConfig.direction === 'desc') {
      direction = null;
    }
    setSortConfig({ key, direction });
  };

  const getSortIcon = (key: string) => {
    if (sortConfig.key !== key || !sortConfig.direction) {
      return <ArrowUpDown className="ml-2 h-3 w-3" />;
    }
    return sortConfig.direction === 'asc' ? (
      <ChevronUp className="ml-2 h-3 w-3" />
    ) : (
      <ChevronDown className="ml-2 h-3 w-3" />
    );
  };

  // Handle region selection
  const toggleRegion = (regionCode: string) => {
    const newSelected = new Set(selectedRegions);
    if (newSelected.has(regionCode)) {
      newSelected.delete(regionCode);
    } else {
      newSelected.add(regionCode);
    }
    setSelectedRegions(newSelected);
  };

  // Select/deselect all regions
  const toggleAllRegions = () => {
    if (selectedRegions.size === allRegions.length) {
      setSelectedRegions(new Set());
    } else {
      setSelectedRegions(new Set(allRegions.map((r) => r.code)));
    }
  };

  // Apply bulk pricing
  const handleApplyClick = () => {
    if (selectedRegions.size === 0) {
      toast.error('Please select at least one region');
      return;
    }

    if (previewPrices.length === 0) {
      toast.error('Please enter a valid base price');
      return;
    }

    const changing: Array<{
      name: string;
      regionCode: string;
      old: string;
      new: string;
    }> = [];
    const staying: Array<{
      name: string;
      regionCode: string;
      price: string;
    }> = [];

    allRegions.forEach(region => {
      const previewItem = previewPrices.find(p => p.regionCode === region.code);
      const isSelected = selectedRegions.has(region.code);
      const currentPrice = getCurrentPrice(region.code);
      // A region the plan has never priced stays out of the plan unless it is selected.
      const currentPriceFormatted = currentPrice ? formatMoney(currentPrice) : 'Not in plan';

      if (isSelected && previewItem) {
        changing.push({
          name: region.name,
          regionCode: region.code,
          old: currentPriceFormatted,
          new: formatMoney(previewItem.price)
        });
      } else {
        staying.push({
          name: region.name,
          regionCode: region.code,
          price: currentPriceFormatted
        });
      }
    });

    setUpdateSummary({ changing, staying });
    setShowConfirmDialog(true);
  };

  const executeApply = async () => {
    const regionalConfigs = previewPrices
      .filter((calculated) => selectedRegions.has(calculated.regionCode))
      .map((calculated) => ({
        regionCode: calculated.regionCode,
        price: calculated.price,
      }));

    if (regionalConfigs.length === 0) {
      toast.error('No regions selected to update');
      return;
    }

    setIsApplying(true);
    setShowConfirmDialog(false);
    try {
      await updateMutation.mutateAsync({
        productId: subscription.productId,
        basePlanId: basePlan.basePlanId,
        regionalConfigs,
      });
      toast.success(`Updated prices for ${regionalConfigs.length} regions`);
      onOpenChange(false);
    } catch (error) {
      toast.error(
        error instanceof Error ? error.message : 'Failed to update prices'
      );
    } finally {
      setIsApplying(false);
    }
  };

  // Reset form when modal opens
  const handleOpenChange = (newOpen: boolean) => {
    if (newOpen) {
      // Initialize base price from existing US price or first available price
      const usConfig = basePlan.regionalConfigs?.find(rc => rc.regionCode === 'US');
      const firstConfig = basePlan.regionalConfigs?.[0];
      const initialPrice = usConfig?.price
        ? moneyToNumber(usConfig.price).toString()
        : (firstConfig?.price ? moneyToNumber(firstConfig.price).toString() : '');

      setBasePrice(initialPrice);
      setHasInitializedSelection(false);
    }
    onOpenChange(newOpen);
  };

  return (
    <Dialog open={open} onOpenChange={handleOpenChange}>
      <DialogContent className="sm:max-w-7xl max-h-[90vh] flex flex-col overflow-hidden">
        <DialogHeader className="flex-shrink-0">
          <DialogTitle className="flex items-center gap-3">
            <span className="flex h-9 w-9 items-center justify-center rounded-lg bg-primary/10">
              <Calculator className="h-5 w-5 text-primary" />
            </span>
            Bulk Edit Regional Prices
          </DialogTitle>
          <DialogDescription>
            Set a base USD price for <strong>{basePlan.basePlanId}</strong> and automatically calculate regional prices.
          </DialogDescription>
        </DialogHeader>

        <div className="flex-1 min-h-0 overflow-y-auto pr-4">
        <div className="space-y-6 py-4">
          {/* Base Region + Price */}
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div className="space-y-2">
              <Label htmlFor="base-region">Base Country / Region</Label>
              <Select value={baseRegion} onValueChange={setBaseRegion}>
                <SelectTrigger id="base-region" className="w-full md:w-72">
                  <SelectValue placeholder="Select region" />
                </SelectTrigger>
                <SelectContent className="max-h-64">
                  {[...GOOGLE_PLAY_REGIONS]
                    .sort((a, b) => a.name.localeCompare(b.name))
                    .map((r) => (
                      <SelectItem key={r.code} value={r.code}>
                        {r.code} — {r.name} ({r.currency})
                      </SelectItem>
                    ))}
                </SelectContent>
              </Select>
            </div>

            <div className="space-y-2">
              <Label htmlFor="base-price">
                Base Price ({baseCurrency} — {baseRegion})
              </Label>
              <div className="relative">
                <span className="absolute left-3 top-1/2 -translate-y-1/2 text-sm text-muted-foreground">
                  {getCurrencySymbol(baseCurrency)}
                </span>
                <Input
                  id="base-price"
                  type="number"
                  step="0.01"
                  min="0"
                  placeholder="9.99"
                  value={basePrice}
                  onChange={(e) => setBasePrice(e.target.value)}
                  className="pl-9 w-48"
                />
              </div>
            </div>
          </div>

          <StrategyPicker
            strategy={strategy}
            onChange={setStrategy}
            loading={pppLoading || exchangeRatesLoading}
            sourceOverrides={{ ppp: pppMetadata && pppMetadata.worldBankRegions > 0 ? `World Bank (${pppMetadata.baseYear}) · ${pppMetadata.worldBankRegions} regions` : undefined }}
          />

          <p className="text-xs text-muted-foreground">Strategy settings and manual country overrides are saved on this device and remain until you select Reset.</p>
          <AdvancedPricingControls strategy={strategy} rounding={rounding} setRounding={setRounding} options={pricingOptions} setOptions={setPricingOptions} apple={false} /><PriceMapPreview rows={previewPrices.map(r=>({code:r.regionCode,currency:r.currencyCode,price:r.rawPrice,ratio:r.rawPrice/(r.adjustedUsdPrice/r.multiplier*r.exchangeRate)}))}/>

          {/* Preserve Existing Subscriber Prices */}
          <div className="space-y-3">
            <label className="flex items-center gap-2 cursor-pointer">
              <Checkbox checked disabled />
              <span className="text-sm font-medium text-muted-foreground">Preserve existing subscriber prices</span>
            </label>
            <p className="text-xs text-muted-foreground ml-6">
              Google Play always preserves prices for existing subscribers. Price updates only apply to new subscribers.
            </p>
          </div>

          {previewError && <p role="alert" className="text-sm text-destructive">{previewError} Adjust your settings or reset conflicting overrides before applying.</p>}
          {/* Preview Table */}
          {previewPrices.length > 0 && (
            <div className="space-y-2">
              <div className="flex flex-wrap items-center justify-between gap-2">
                <Label>Regions & Preview ({selectedRegions.size} selected)</Label>
                <div className="flex items-center gap-2">
                  <Button
                    variant="outline"
                    size="sm"
                    onClick={() => setSelectedRegions(new Set())}
                    disabled={selectedRegions.size === 0}
                  >
                    Deselect All
                  </Button>
                  <Button
                    variant="outline"
                    size="sm"
                    onClick={() => {
                      const next = new Set<string>();
                      sortedPreviewPrices.forEach((item) => {
                        if (item.isModified) next.add(item.regionCode);
                      });
                      setSelectedRegions(next);
                    }}
                    disabled={previewPrices.length === 0}
                  >
                    Select only modified
                  </Button>
                  <Button
                    variant="outline"
                    size="sm"
                    onClick={() => setSelectedRegions(new Set(allRegions.map(r => r.code)))}
                    disabled={selectedRegions.size === allRegions.length}
                  >
                    Select All
                  </Button>
                </div>
              </div>
              <RegionFilterBar
                query={regionQuery}
                onQueryChange={setRegionQuery}
                onlyModified={showOnlyModified}
                onOnlyModifiedChange={setShowOnlyModified}
                shown={visiblePreviewPrices.length}
                total={sortedPreviewPrices.length}
                modified={modifiedCount}
              />
              <div className="border rounded-lg">
                <div>
                  <TooltipProvider delayDuration={100}>
                  <Table containerClassName="overflow-visible" className="[&_td]:px-2 [&_th]:px-2">
                    <TableHeader className="sticky top-0 z-10 bg-background shadow-[inset_0_-1px_0_var(--border)]">
                      <TableRow>
                        <TableHead className="w-12">
                          <Checkbox
                            checked={selectedRegions.size === allRegions.length}
                            onCheckedChange={toggleAllRegions}
                            aria-label="Select all"
                          />
                        </TableHead>
                        <TableHead className="w-20 cursor-pointer hover:bg-muted/50 transition-colors" onClick={() => requestSort('region')}>
                          <div className="flex items-center">
                            Region {getSortIcon('region')}
                          </div>
                        </TableHead>
                        <TableHead className="cursor-pointer hover:bg-muted/50 transition-colors" onClick={() => requestSort('name')}>
                          <div className="flex items-center">
                            Country {getSortIcon('name')}
                          </div>
                        </TableHead>
                        <TableHead className="cursor-pointer hover:bg-muted/50 transition-colors" onClick={() => requestSort('currency')}>
                          <div className="flex items-center">
                            Currency {getSortIcon('currency')}
                          </div>
                        </TableHead>
                        <TableHead className="text-right cursor-pointer hover:bg-muted/50 transition-colors" onClick={() => requestSort('multiplier')}>
                          <div className="flex items-center justify-end">
                            Multiplier {getSortIcon('multiplier')}
                          </div>
                        </TableHead>
                        <TableHead className="text-right cursor-pointer hover:bg-muted/50 transition-colors" onClick={() => requestSort('current')}>
                          <div className="flex items-center justify-end">
                            Current {getSortIcon('current')}
                          </div>
                        </TableHead>
                        <TableHead className="text-right cursor-pointer hover:bg-muted/50 transition-colors" onClick={() => requestSort('new')}>
                          <div className="flex items-center justify-end">
                            New {getSortIcon('new')}
                          </div>
                        </TableHead>
                        <TableHead className="text-right cursor-pointer hover:bg-muted/50 transition-colors" onClick={() => requestSort('change')}>
                          <div className="flex items-center justify-end">
                            Change {getSortIcon('change')}
                          </div>
                        </TableHead>
                      </TableRow>
                    </TableHeader>
                    <TableBody>
                      {visiblePreviewPrices.length === 0 && (
                        <TableRow>
                          <TableCell colSpan={99} className="py-10 text-center text-sm text-muted-foreground">
                            {showOnlyModified && !regionQuery ? 'No regions would change with these settings.' : 'No regions match.'}
                          </TableCell>
                        </TableRow>
                      )}
                      {visiblePreviewPrices.map((calculated) => {
                        const currentPrice = getCurrentPrice(
                          calculated.regionCode
                        );
                        const isSelected = selectedRegions.has(calculated.regionCode);

                        return (
                          <TableRow
                            key={calculated.regionCode}
                            className={!isSelected ? 'opacity-50' : ''}
                          >
                            <TableCell>
                              <Checkbox
                                checked={isSelected}
                                onCheckedChange={() => toggleRegion(calculated.regionCode)}
                                aria-label={`Select ${calculated.regionCode}`}
                              />
                            </TableCell>
                            <TableCell>
                              <Badge variant="outline">
                                {calculated.regionCode}
                              </Badge>
                            </TableCell>
                            <TableCell className="text-sm">
                              {calculated.countryName}
                            </TableCell>
                            <TableCell className="text-sm text-muted-foreground">
                              {calculated.currencyCode}
                            </TableCell>
                            <TableCell className="text-right text-sm">
                              <Tooltip>
                                <TooltipTrigger asChild>
                                  <span className="cursor-help tabular-nums">{calculated.multiplier < 0.995 ? <span aria-hidden="true" className="mr-1.5 inline-block h-1.5 w-1.5 rounded-full align-middle fp-swatch-down" /> : calculated.multiplier > 1.005 ? <span aria-hidden="true" className="mr-1.5 inline-block h-1.5 w-1.5 rounded-full align-middle fp-swatch-up" /> : null}{calculated.multiplier.toFixed(2)}×</span>
                                </TooltipTrigger>
                                <TooltipContent side="top">
                                  <p className="text-xs">
                                    {calculated.multiplierSource === 'world-bank' && 'World Bank PPP data'}
                                    {calculated.multiplierSource === 'big-mac' && 'Big Mac Index'}
                                    {calculated.multiplierSource === 'netflix' && 'Netflix Price Index'}
                                    {calculated.multiplierSource === 'static' && 'Static fallback data'}
                                    {calculated.multiplierSource === 'custom' && 'Custom multiplier'}
                                  {calculated.multiplierSource === 'gdp' && 'GDP per capita (PPP estimate when unavailable)'}
                                  {calculated.multiplierSource === 'blend' && 'Weighted index blend'}
                                    {calculated.multiplierSource === 'direct' && 'Direct conversion (1:1)'}
                                  </p>
                                  <p className="text-xs text-muted-foreground">
                                    Relative to US: {calculated.multiplier.toFixed(2)}×
                                  </p>
                                </TooltipContent>
                              </Tooltip>
                            </TableCell>
                            <TableCell className="text-right text-sm text-muted-foreground">
                              {currentPrice
                                ? formatMoney(currentPrice)
                                : '-'}
                            </TableCell>
                            <TableCell className="text-right font-medium">
                              <Tooltip>
                                <TooltipTrigger asChild>
                                  <span className="cursor-help">
                                    {formatMoney(calculated.price)}
                                  </span>
                                </TooltipTrigger>
                                <TooltipContent side="top" className="max-w-xs">
                                  <p className="text-xs font-medium mb-1">
                                    {baseCurrency} → {calculated.currencyCode} Calculation
                                  </p>
                                  <div className="text-xs text-muted-foreground space-y-0.5">
                                    <p>1. Base price: {basePriceNum.toFixed(2)} {baseCurrency} ({baseRegion})</p>
                                    <p>2. Relative Adjustment: {calculated.multiplier.toFixed(2)}×</p>
                                    <p>3. Adjusted Price: {(basePriceNum * calculated.multiplier).toFixed(2)} {baseCurrency}</p>
                                    {baseCurrency !== calculated.currencyCode && (
                                      <p>4. Exchange Rate ({baseCurrency}→{calculated.currencyCode}): {(calculated.rawPrice / (basePriceNum * calculated.multiplier)).toFixed(4)}</p>
                                    )}
                                    <p>{baseCurrency !== calculated.currencyCode ? '5' : '4'}. Target Price: {calculated.rawPrice.toFixed(2)} {calculated.currencyCode}</p>
                                  </div>
                                </TooltipContent>
                              </Tooltip>
                              <RegionalOverride region={calculated.regionCode} value={overrides[calculated.regionCode]} computed={calculated.rawPrice} onChange={updateOverride} />
                            </TableCell>
                            <TableCell className="text-right">
                              {currentPrice ? (
                                <span className="tabular-nums">{calculated.change > 0.5 ? <span aria-hidden="true" className="mr-1.5 inline-block h-1.5 w-1.5 rounded-full align-middle fp-swatch-up" /> : calculated.change < -0.5 ? <span aria-hidden="true" className="mr-1.5 inline-block h-1.5 w-1.5 rounded-full align-middle fp-swatch-down" /> : null}{formatPriceChange(calculated.change)}</span>
                              ) : (
                                <span className="rounded-full bg-primary/10 px-2 py-0.5 text-xs font-medium text-primary">New</span>
                              )}
                            </TableCell>
                          </TableRow>
                        );
                      })}
                    </TableBody>
                  </Table>
                  </TooltipProvider>
                </div>
              </div>
            </div>
          )}
        </div>
        </div>

        <DialogFooter className="flex-shrink-0 border-t pt-4 gap-2 sm:gap-2">
          <Button variant="outline" onClick={() => onOpenChange(false)}>
            Cancel
          </Button>
          <Button
            onClick={handleApplyClick}
            disabled={previewPrices.length === 0 || selectedRegions.size === 0 || isApplying}
          >
            {isApplying ? (
              <>
                <Loader2 className="h-4 w-4 animate-spin" />
                Applying prices...
              </>
            ) : (
              `Apply to ${selectedRegions.size} Regions`
            )}
          </Button>
        </DialogFooter>

        {/* Confirmation Dialog */}
        <Dialog open={showConfirmDialog} onOpenChange={setShowConfirmDialog}>
          <DialogContent className="sm:max-w-2xl max-h-[80vh] flex flex-col overflow-hidden">
            <DialogHeader className="flex-shrink-0 text-left">
              <DialogTitle>Confirm Price Changes</DialogTitle>
              <DialogDescription asChild>
                <div className="text-sm text-muted-foreground">
                  Review the updates before applying them to {selectedRegions.size} regions.
                </div>
              </DialogDescription>
            </DialogHeader>

            <div className="flex-1 min-h-[300px] py-4 overflow-hidden border-y my-2">
              <ScrollArea className="h-[50vh] pr-4">
                <div className="space-y-6">
                  {/* Section: Changing */}
                  <div>
                    <h4 className="font-semibold text-sm mb-2 text-primary flex items-center gap-2 sticky top-0 bg-background py-1 z-10">
                      <span className="h-2 w-2 rounded-full bg-primary" />
                      Updating ({updateSummary?.changing.length})
                    </h4>
                    <div className="grid grid-cols-1 gap-1 pl-4">
                      {updateSummary?.changing.map(item => (
                        <div key={item.regionCode} className="text-xs flex justify-between border-b border-muted/30 py-1">
                          <span className="font-medium">{item.name} ({item.regionCode})</span>
                          <span className="font-mono">
                            <span className="text-muted-foreground line-through">{item.old}</span>
                            <span className="mx-2 text-muted-foreground">→</span>
                            <span className="font-semibold text-primary">{item.new}</span>
                          </span>
                        </div>
                      ))}
                    </div>
                  </div>

                  {/* Section: Staying */}
                  <div>
                    <h4 className="font-semibold text-sm mb-2 text-muted-foreground flex items-center gap-2 sticky top-0 bg-background py-1 z-10">
                      <span className="h-2 w-2 rounded-full bg-muted-foreground/40" />
                      No Change ({updateSummary?.staying.length})
                    </h4>
                    <div className="grid grid-cols-1 gap-1 pl-4 opacity-70 text-muted-foreground">
                      {updateSummary?.staying.map(item => (
                        <div key={item.regionCode} className="text-xs flex justify-between py-1 border-b border-muted/10">
                          <span>{item.name} ({item.regionCode})</span>
                          <span className="font-mono">{item.price}</span>
                        </div>
                      ))}
                    </div>
                  </div>
                </div>
              </ScrollArea>
            </div>

            <DialogFooter className="flex-shrink-0 gap-2 sm:gap-0">
              <Button variant="outline" onClick={() => setShowConfirmDialog(false)}>
                Cancel
              </Button>
              <Button onClick={executeApply}>
                Confirm and Apply
              </Button>
            </DialogFooter>
          </DialogContent>
        </Dialog>
      </DialogContent>
    </Dialog>
  );
}
