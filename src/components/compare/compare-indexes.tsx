'use client';

import { useDeferredValue, useMemo, useState } from 'react';
import Link from 'next/link';
import { ArrowRight, ArrowUpDown, ChevronDown, Download, Search } from 'lucide-react';
import { GOOGLE_PLAY_REGIONS } from '@/lib/google-play/types';
import { ROUNDINGS, flag, formatPrice, type ProductDraft } from '@/lib/fairpricing/workspace';
import {
  COMPARE_INDEXES,
  MIN_RATIO,
  boundedMarketCount,
  buildComparison,
  exportComparisonCsv,
  type CompareIndexId,
  type CompareRow,
} from '@/lib/fairpricing/compare';

type SortKey = 'name' | 'spread' | CompareIndexId;

const INDEX_COLUMNS = COMPARE_INDEXES.filter((index) => index.id !== 'direct');

/**
 * Bins the deviation from FX into a stepped diverging tint. Binning rather than
 * a continuous ramp keeps 170 rows scannable — the eye reads four levels, not a
 * gradient.
 */
function deltaTint(change: number): string {
  const magnitude = Math.abs(change);
  if (magnitude < 5) return 'fp-delta-0';
  const step = magnitude < 20 ? 1 : magnitude < 40 ? 2 : 3;
  return change < 0 ? `fp-delta-down-${step}` : `fp-delta-up-${step}`;
}

function formatDelta(change: number): string {
  if (Math.abs(change) < 0.5) return 'same as FX';
  return `${change > 0 ? '+' : ''}${change.toFixed(0)}% vs FX`;
}

function median(values: number[]): number {
  if (!values.length) return 0;
  const sorted = [...values].sort((a, b) => a - b);
  const mid = Math.floor(sorted.length / 2);
  return sorted.length % 2 ? sorted[mid] : (sorted[mid - 1] + sorted[mid]) / 2;
}

function StatTile({ label, value, detail }: { label: string; value: string; detail: string }) {
  return (
    <div className="rounded-xl border bg-card p-5">
      <p className="text-xs font-medium tracking-wide text-muted-foreground uppercase">{label}</p>
      <p className="mt-2 text-3xl font-semibold tracking-tight tabular-nums">{value}</p>
      <p className="mt-1 text-sm leading-relaxed text-muted-foreground">{detail}</p>
    </div>
  );
}

function SortButton({
  label,
  active,
  descending,
  onClick,
}: {
  label: string;
  active: boolean;
  descending: boolean;
  onClick: () => void;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      className="inline-flex items-center gap-1.5 font-medium transition-colors hover:text-foreground"
    >
      {label}
      <ArrowUpDown
        aria-hidden="true"
        className={active ? 'h-3.5 w-3.5 text-primary' : 'h-3.5 w-3.5 text-muted-foreground/50'}
        style={active && descending ? { transform: 'rotate(180deg)' } : undefined}
      />
    </button>
  );
}

export function CompareIndexes() {
  const [baseRegion, setBaseRegion] = useState('US');
  const [amount, setAmount] = useState('9.99');
  const [rounding, setRounding] = useState<ProductDraft['rounding']>('nearest-99');
  const [query, setQuery] = useState('');
  const [sortKey, setSortKey] = useState<SortKey>('name');
  const [descending, setDescending] = useState(false);
  const [expanded, setExpanded] = useState<string | null>(null);

  const deferredQuery = useDeferredValue(query);
  const basePrice = Number(amount);
  const valid = amount.trim() !== '' && Number.isFinite(basePrice) && basePrice > 0 && basePrice <= 1000000;
  const baseCurrency = GOOGLE_PLAY_REGIONS.find((region) => region.code === baseRegion)?.currency ?? 'USD';

  const rows = useMemo(
    () => (valid ? buildComparison({ basePrice, baseRegion, rounding }) : []),
    [valid, basePrice, baseRegion, rounding]
  );

  const stats = useMemo(() => {
    const spreads = rows.map((row) => row.spread).filter((spread): spread is NonNullable<typeof spread> => !!spread);
    const widest = spreads.length
      ? rows.reduce((a, b) => ((b.spread?.pct ?? 0) > (a.spread?.pct ?? 0) ? b : a))
      : undefined;
    return {
      markets: rows.length,
      medianSpread: median(spreads.map((s) => s.pct)),
      widest,
      bounded: boundedMarketCount(rows),
    };
  }, [rows]);

  const visible = useMemo(() => {
    const needle = deferredQuery.trim().toLowerCase();
    const filtered = needle
      ? rows.filter(
          (row) =>
            row.name.toLowerCase().includes(needle) ||
            row.code.toLowerCase().includes(needle) ||
            row.currency.toLowerCase().includes(needle)
        )
      : rows;

    // Index columns sort on the deviation from FX, never on the raw price:
    // ₹829 and $6.49 are not comparable numbers, but −35% and −18% are.
    const value = (row: CompareRow): number | string => {
      if (sortKey === 'name') return row.name;
      if (sortKey === 'spread') return row.spread?.pct ?? -1;
      return row.cells[sortKey]?.change ?? Number.POSITIVE_INFINITY;
    };

    return [...filtered].sort((a, b) => {
      const left = value(a);
      const right = value(b);
      const order = typeof left === 'string' ? left.localeCompare(right as string) : left - (right as number);
      return descending ? -order : order;
    });
  }, [rows, deferredQuery, sortKey, descending]);

  const widestSpread = useMemo(
    () => visible.reduce((max, row) => Math.max(max, row.spread?.pct ?? 0), 0),
    [visible]
  );

  const sortBy = (key: SortKey) => {
    if (key === sortKey) {
      setDescending((previous) => !previous);
      return;
    }
    setSortKey(key);
    // Names read best A–Z; every numeric column is most interesting at the top.
    setDescending(key !== 'name');
  };

  const download = () => {
    const blob = new Blob([exportComparisonCsv(visible, { basePrice, baseRegion, rounding })], {
      type: 'text/csv;charset=utf-8',
    });
    const url = URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.href = url;
    link.download = `fairpricing-index-comparison-${baseRegion}-${basePrice}.csv`;
    link.click();
    URL.revokeObjectURL(url);
  };

  return (
    <main>
      <section className="border-b bg-muted/20">
        <div className="mx-auto max-w-7xl px-5 py-12 md:py-16">
          <p className="mb-3 text-sm font-medium text-primary">Compare indexes</p>
          <h1 className="max-w-3xl text-3xl font-semibold tracking-tight md:text-4xl">
            Five indexes, side by side, for every market
          </h1>
          <p className="mt-4 max-w-2xl leading-relaxed text-muted-foreground">
            Pick a base price and see what each pricing strategy would charge in {GOOGLE_PLAY_REGIONS.length} Google Play
            markets at once. The columns disagree — the spread shows you where that disagreement is worth your attention.
          </p>
        </div>
      </section>

      <section className="mx-auto max-w-7xl px-5 py-10 md:py-14">
        <div className="rounded-xl border bg-card p-5">
          <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
            <label className="text-sm font-medium">
              Base country
              <select
                value={baseRegion}
                onChange={(event) => setBaseRegion(event.target.value)}
                className="mt-2 h-10 w-full rounded-md border bg-background px-3 text-sm font-normal"
              >
                {GOOGLE_PLAY_REGIONS.map((region) => (
                  <option key={region.code} value={region.code}>
                    {region.name} ({region.currency})
                  </option>
                ))}
              </select>
            </label>
            <label className="text-sm font-medium">
              Base price ({baseCurrency})
              <input
                type="number"
                min="0.01"
                max="1000000"
                step="0.01"
                value={amount}
                onChange={(event) => setAmount(event.target.value)}
                className="mt-2 h-10 w-full rounded-md border bg-background px-3 text-sm font-normal tabular-nums"
              />
            </label>
            <label className="text-sm font-medium">
              Price ending
              <select
                value={rounding}
                onChange={(event) => setRounding(event.target.value as ProductDraft['rounding'])}
                className="mt-2 h-10 w-full rounded-md border bg-background px-3 text-sm font-normal"
              >
                {ROUNDINGS.map((option) => (
                  <option key={option.id} value={option.id}>
                    {option.label}
                  </option>
                ))}
              </select>
            </label>
            <label className="text-sm font-medium">
              Find a market
              <span className="relative mt-2 block">
                <Search aria-hidden="true" className="absolute top-3 left-3 h-4 w-4 text-muted-foreground" />
                <input
                  type="search"
                  value={query}
                  onChange={(event) => setQuery(event.target.value)}
                  placeholder="India, BR, EUR…"
                  className="h-10 w-full rounded-md border bg-background pr-3 pl-9 text-sm font-normal"
                />
              </span>
            </label>
          </div>
        </div>

        {!valid && (
          <p role="alert" className="mt-4 text-sm text-destructive">
            Enter a base price greater than 0 and no more than 1,000,000.
          </p>
        )}

        {valid && (
          <>
            <div className="mt-6 grid gap-4 sm:grid-cols-3">
              <StatTile
                label="Markets compared"
                value={String(stats.markets)}
                detail={`Every Google Play market, priced from ${baseRegion}.`}
              />
              <StatTile
                label="Typical spread"
                value={`${(1 + stats.medianSpread / 100).toFixed(2)}×`}
                detail={
                  stats.bounded
                    ? `Median gap between the cheapest and priciest index. ${stats.bounded} markets have an index pinned to a bound.`
                    : 'Median gap between the cheapest and priciest index in a market.'
                }
              />
              <StatTile
                label="Widest disagreement"
                value={stats.widest ? `${(1 + (stats.widest.spread?.pct ?? 0) / 100).toFixed(2)}×` : '—'}
                detail={stats.widest ? `${flag(stats.widest.code)} ${stats.widest.name} — pick this index carefully.` : ''}
              />
            </div>

            <div className="mt-8 flex flex-wrap items-center justify-between gap-4">
              <div className="flex flex-wrap items-center gap-x-5 gap-y-2 text-xs text-muted-foreground">
                <span className="flex items-center gap-2">
                  <span aria-hidden="true" className="fp-swatch-down h-2.5 w-2.5 rounded-full" />
                  Below straight conversion
                </span>
                <span className="flex items-center gap-2">
                  <span aria-hidden="true" className="h-2.5 w-2.5 rounded-full border bg-card" />
                  Within 5% of it
                </span>
                <span className="flex items-center gap-2">
                  <span aria-hidden="true" className="fp-swatch-up h-2.5 w-2.5 rounded-full" />
                  Above it
                </span>
              </div>
              <button
                type="button"
                onClick={download}
                className="inline-flex h-10 items-center gap-2 rounded-md border bg-background px-4 text-sm font-medium transition-colors hover:bg-muted"
              >
                <Download aria-hidden="true" className="h-4 w-4" />
                Export CSV
              </button>
            </div>

            <div className="mt-4 hidden overflow-auto rounded-xl border bg-card md:block" style={{ maxHeight: '70vh' }}>
              <table className="w-full border-separate border-spacing-0 text-sm">
                <caption className="sr-only">
                  Regional prices for a {formatPrice(basePrice, baseCurrency)} base price in {baseRegion}, compared across
                  five pricing indexes. Index columns sort by their percentage difference from straight currency conversion.
                </caption>
                <thead>
                  <tr>
                    <th
                      scope="col"
                      className="sticky top-0 left-0 z-30 border-b bg-secondary p-4 text-left"
                      aria-sort={sortKey === 'name' ? (descending ? 'descending' : 'ascending') : 'none'}
                    >
                      <SortButton
                        label="Market"
                        active={sortKey === 'name'}
                        descending={descending}
                        onClick={() => sortBy('name')}
                      />
                    </th>
                    <th scope="col" className="sticky top-0 z-20 border-b bg-secondary p-4 text-right whitespace-nowrap">
                      <SortButton
                        label="Exchange rate"
                        active={sortKey === 'direct'}
                        descending={descending}
                        onClick={() => sortBy('direct')}
                      />
                    </th>
                    {INDEX_COLUMNS.map((index) => (
                      <th
                        key={index.id}
                        scope="col"
                        className="sticky top-0 z-20 border-b bg-secondary p-4 text-right whitespace-nowrap"
                        aria-sort={sortKey === index.id ? (descending ? 'descending' : 'ascending') : 'none'}
                      >
                        <SortButton
                          label={index.short}
                          active={sortKey === index.id}
                          descending={descending}
                          onClick={() => sortBy(index.id)}
                        />
                      </th>
                    ))}
                    <th
                      scope="col"
                      className="sticky top-0 z-20 border-b bg-secondary p-4 text-right whitespace-nowrap"
                      aria-sort={sortKey === 'spread' ? (descending ? 'descending' : 'ascending') : 'none'}
                      title="Gap between the cheapest and priciest affordability index. Bars are relative to the widest spread on screen."
                    >
                      <SortButton
                        label="Spread"
                        active={sortKey === 'spread'}
                        descending={descending}
                        onClick={() => sortBy('spread')}
                      />
                    </th>
                  </tr>
                </thead>
                <tbody>
                  {visible.map((row) => {
                    const isOpen = expanded === row.code;
                    return (
                      <ExpandableRow
                        key={row.code}
                        row={row}
                        baseCurrency={baseCurrency}
                        widestSpread={widestSpread}
                        isOpen={isOpen}
                        onToggle={() => setExpanded(isOpen ? null : row.code)}
                      />
                    );
                  })}
                </tbody>
              </table>
            </div>

            <div className="mt-4 space-y-3 md:hidden">
              {visible.map((row) => (
                <div key={row.code} className="rounded-xl border bg-card p-4">
                  <div className="flex items-baseline justify-between gap-3">
                    <span className="font-medium">
                      {flag(row.code)} {row.name}
                    </span>
                    <span className="text-xs text-muted-foreground">{row.currency}</span>
                  </div>
                  <p className="mt-1 text-xs text-muted-foreground tabular-nums">
                    Exchange rate {formatPrice(row.cells.direct?.price ?? row.fxPrice, row.currency)}
                  </p>
                  <dl className="mt-3 grid grid-cols-2 gap-2">
                    {INDEX_COLUMNS.map((index) => {
                      const cell = row.cells[index.id];
                      return (
                        <div key={index.id} className={`rounded-lg border p-2.5 ${cell && !cell.error ? deltaTint(cell.change) : ''}`}>
                          <dt className="text-xs text-muted-foreground">{index.short}</dt>
                          <dd className="mt-0.5 font-medium tabular-nums">
                            {cell && !cell.error ? formatPrice(cell.price, row.currency) : '—'}
                          </dd>
                          {cell && !cell.error && (
                            <dd className="text-xs text-muted-foreground tabular-nums">
                              {cell.bounded ? `at ${cell.bounded}` : formatDelta(cell.change)}
                            </dd>
                          )}
                        </div>
                      );
                    })}
                  </dl>
                </div>
              ))}
            </div>

            {!visible.length && (
              <p className="mt-6 rounded-xl border border-dashed p-10 text-center text-sm text-muted-foreground">
                No market matches “{query}”.
              </p>
            )}
          </>
        )}

        <div className="mt-10 grid gap-6 rounded-xl border bg-muted/20 p-6 lg:grid-cols-[1.4fr_1fr]">
          <div>
            <h2 className="font-medium">How to read this table</h2>
            <p className="mt-2 text-sm leading-relaxed text-muted-foreground">
              Every column answers the same question — what should this cost here? — with a different definition of
              &ldquo;fair&rdquo;. Exchange rate is the baseline: it preserves your revenue per sale and ignores whether anyone
              can afford it. The other four adjust for local conditions, so a tinted cell is simply a price that departs from
              straight conversion. Select a row to see each index&rsquo;s multiplier and where its data came from.
            </p>
            <p className="mt-3 text-sm leading-relaxed text-muted-foreground">
              Every index is held between 10% and 200% of straight conversion. A price marked{' '}
              <span className="underline decoration-dotted underline-offset-2">at floor</span> hit that limit, so it shows
              the bound rather than the index&rsquo;s own answer — GDP-adjusted does this across much of the world, which is
              why it widens the spread so often.
            </p>
          </div>
          <div className="space-y-3 text-sm">
            {INDEX_COLUMNS.map((index) => (
              <p key={index.id} className="leading-relaxed text-muted-foreground">
                <span className="font-medium text-foreground">{index.name}</span> — {index.blurb}
              </p>
            ))}
          </div>
        </div>

        <p className="mt-6 text-sm leading-relaxed text-muted-foreground">
          Prices use bundled data snapshots and Google Play currencies, bounded to 10%–200% of straight conversion. These are
          reference models, not predictions of sales or revenue. See{' '}
          <Link href="/about" className="underline underline-offset-4">
            source, data &amp; privacy
          </Link>{' '}
          for snapshot dates.
        </p>

        <Link
          href="/setup"
          className="mt-6 inline-flex h-11 items-center gap-2 rounded-md bg-primary px-6 font-medium text-primary-foreground"
        >
          Apply these prices to your store
          <ArrowRight aria-hidden="true" className="h-4 w-4" />
        </Link>
      </section>
    </main>
  );
}

function ExpandableRow({
  row,
  baseCurrency,
  widestSpread,
  isOpen,
  onToggle,
}: {
  row: CompareRow;
  baseCurrency: string;
  widestSpread: number;
  isOpen: boolean;
  onToggle: () => void;
}) {
  const direct = row.cells.direct;
  return (
    <>
      <tr className="group">
        <th scope="row" className="sticky left-0 z-10 border-b bg-card p-0 text-left font-normal group-hover:bg-muted/60">
          <button
            type="button"
            onClick={onToggle}
            aria-expanded={isOpen}
            className="flex w-full items-center gap-2 px-4 py-3 text-left"
          >
            <ChevronDown
              aria-hidden="true"
              className="h-4 w-4 shrink-0 text-muted-foreground transition-transform"
              style={isOpen ? { transform: 'rotate(180deg)' } : undefined}
            />
            <span className="whitespace-nowrap">
              {flag(row.code)} {row.name}
            </span>
            <span className="ml-auto pl-3 text-xs text-muted-foreground">{row.currency}</span>
          </button>
        </th>
        <td className="border-b p-4 text-right whitespace-nowrap tabular-nums group-hover:bg-muted/30">
          <span className="font-medium">{direct && !direct.error ? formatPrice(direct.price, row.currency) : '—'}</span>
          <span className="mt-0.5 block text-xs text-muted-foreground">baseline</span>
        </td>
        {INDEX_COLUMNS.map((index) => {
          const cell = row.cells[index.id];
          return (
            <td
              key={index.id}
              className={`border-b p-4 text-right whitespace-nowrap tabular-nums ${cell && !cell.error ? deltaTint(cell.change) : ''}`}
            >
              {cell && !cell.error ? (
                <>
                  <span className="font-medium">{formatPrice(cell.price, row.currency)}</span>
                  <span className="mt-0.5 block text-xs text-muted-foreground">
                    {cell.bounded ? (
                      <span
                        className="underline decoration-dotted underline-offset-2"
                        title={`This index would price ${cell.bounded === 'floor' ? 'below' : 'above'} the bounds, so the ${cell.bounded === 'floor' ? `${MIN_RATIO * 100}% floor` : 'ceiling'} is shown instead.`}
                      >
                        at {cell.bounded}
                      </span>
                    ) : (
                      formatDelta(cell.change)
                    )}
                  </span>
                </>
              ) : (
                <span className="text-muted-foreground">—</span>
              )}
            </td>
          );
        })}
        <td className="border-b p-4 text-right whitespace-nowrap tabular-nums group-hover:bg-muted/30">
          {row.spread ? (
            <>
              <span className="font-medium">{(1 + row.spread.pct / 100).toFixed(2)}×</span>
              <span aria-hidden="true" className="mt-1.5 block h-1 rounded-full bg-muted">
                <span
                  className="block h-1 rounded-full bg-primary/70"
                  style={{ width: `${widestSpread > 0 ? Math.max(2, (row.spread.pct / widestSpread) * 100) : 0}%` }}
                />
              </span>
            </>
          ) : (
            <span className="text-muted-foreground">—</span>
          )}
        </td>
      </tr>
      {isOpen && (
        <tr>
          <td colSpan={COMPARE_INDEXES.length + 2} className="border-b bg-muted/30 p-0">
            <div className="grid gap-4 p-5 sm:grid-cols-2 lg:grid-cols-5">
              {COMPARE_INDEXES.map((index) => {
                const cell = row.cells[index.id];
                return (
                  <div key={index.id}>
                    <p className="text-xs font-medium tracking-wide text-muted-foreground uppercase">{index.name}</p>
                    {cell && !cell.error ? (
                      <>
                        <p className="mt-1.5 font-medium tabular-nums">{formatPrice(cell.price, row.currency)}</p>
                        <p className="text-xs text-muted-foreground tabular-nums">
                          {cell.multiplier.toFixed(2)}× FX · {formatPrice(cell.baseEquivalent, baseCurrency)} back home
                        </p>
                        <p className="mt-1 text-xs text-muted-foreground">{cell.source}</p>
                        {cell.bounded && (
                          <p className="mt-1 text-xs text-muted-foreground">
                            Held at the {cell.bounded === 'floor' ? `${MIN_RATIO * 100}% floor` : 'ceiling'} — this index
                            alone would go {cell.bounded === 'floor' ? 'lower' : 'higher'}.
                          </p>
                        )}
                      </>
                    ) : (
                      <p className="mt-1.5 text-xs text-muted-foreground">{cell?.error ?? 'No price available.'}</p>
                    )}
                  </div>
                );
              })}
            </div>
          </td>
        </tr>
      )}
    </>
  );
}
