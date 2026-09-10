'use client';
import { useMemo, useRef, useState } from 'react';
import Link from 'next/link';
import Image from 'next/image';
import { useRouter, useSearchParams } from 'next/navigation';
import { ArrowDownToLine, ArrowRight, BookOpen, Check, CircleHelp, FileDown, Globe2, Layers3, LayoutGrid, Link2, Plus, RotateCcw, Upload } from 'lucide-react';
import { Dialog, DialogContent, DialogTitle, DialogDescription } from '@/components/ui/dialog';
import { toast } from 'sonner';
import { StrategyPanel } from './strategy-panel';
import { CountryTable } from './country-table';
import { STRATEGIES, ROUNDINGS, createProduct, calculateRows, baseCurrency, formatPrice, flag, updateOverride, exportCsv, parseWorkspace, serializeWorkspace, type ProductDraft, type PriceRow } from '@/lib/fairpricing/workspace';
import type { RoundingMode } from '@/lib/google-play/currency';
import './workspace.css';

const STORAGE_KEY = 'fairpricing-workspace-v1';
function initialDrafts() {
  try { const saved = localStorage.getItem(STORAGE_KEY); if (saved) return {products: parseWorkspace(saved), error: ''}; }
  catch { return {products: [createProduct('Studio Pro', 'monthly')], error: 'Saved drafts could not be read. Export a backup before replacing saved data.'}; }
  return {products: [createProduct('Studio Pro', 'monthly')], error: ''};
}
function download(content: string, filename: string, type: string) {
  const url = URL.createObjectURL(new Blob([content], {type}));
  const a = document.createElement('a'); a.href = url; a.download = filename; a.click();
  setTimeout(() => URL.revokeObjectURL(url), 1000);
}
export default function Workspace({comparison = false}: {comparison?: boolean}) {
  const [initial] = useState(initialDrafts);
  const [products, setProducts] = useState(initial.products);
  const [activeId, setActiveId] = useState(initial.products[0].id);
  const router = useRouter();
  const searchParams = useSearchParams();
  const view = searchParams.get('view');
  const tab = view === 'products' || view === 'compare' || view === 'sources' || view === 'pricing' ? view : comparison ? 'compare' : 'pricing';
  function setTab(next: string) { router.push(`/workspace?view=${next}`, {scroll: false}); }
  const [saveError, setSaveError] = useState(initial.error);
  const [selected, setSelected] = useState<string[]>([]);
  const [editRow, setEditRow] = useState<PriceRow | null>(null);
  const [overrideAmount, setOverrideAmount] = useState('');
  const [overrideRounding, setOverrideRounding] = useState('inherit');
  const [createOpen, setCreateOpen] = useState(false);
  const [reviewOpen, setReviewOpen] = useState(false);
  const [productName, setProductName] = useState('');
  const [productKind, setProductKind] = useState<ProductDraft['kind']>('monthly');
  const [compareSearch, setCompareSearch] = useState('');
  const fileInput = useRef<HTMLInputElement>(null);
  const product = products.find(p => p.id === activeId) ?? products[0];
  const rows = useMemo(() => calculateRows(product), [product]);
  const currency = baseCurrency(product);
  const errors = rows.filter(r => r.error);
  const overrideCount = Object.keys(product.overrides).length;
  const strategyName = STRATEGIES.find(s => s.id === product.strategy)?.name;
  function persist(next: ProductDraft[]) {
    let serialized: string;
    try {serialized = serializeWorkspace(next);} catch {toast.error('Check price bounds and product details. A workspace supports up to 100 products.'); return false;}
    setProducts(next);
    try { localStorage.setItem(STORAGE_KEY, serialized); setSaveError(''); }
    catch { setSaveError('Browser storage is unavailable or full. Export a backup to keep your work.'); }
    return true;
  }
  function update(patch: Partial<ProductDraft>) { persist(products.map(p => p.id === product.id ? {...p, ...patch, updatedAt: new Date().toISOString()} : p)); }
  function applyProduct(next: ProductDraft) { persist(products.map(p => p.id === next.id ? next : p)); }
  function edit(row: PriceRow) { setEditRow(row); setOverrideAmount(product.overrides[row.code]?.price?.toString() ?? ''); setOverrideRounding(product.overrides[row.code]?.rounding ?? 'inherit'); }
  function saveOverride() {
    if (!editRow) return;
    const amount = overrideAmount.trim() === '' ? undefined : Number(overrideAmount);
    if (amount !== undefined && (!Number.isFinite(amount) || amount <= 0)) {toast.error('Enter a positive price, or leave the amount empty.'); return;}
    const next = updateOverride(product, editRow.code, amount === undefined && overrideRounding === 'inherit' ? undefined : {price: amount, rounding: overrideRounding === 'inherit' ? undefined : overrideRounding as RoundingMode});
    const result = calculateRows(next).find(r => r.code === editRow.code);
    if (result?.error) {toast.error(result.error); return;}
    applyProduct(next); setEditRow(null); toast.success('Country preference saved');
  }
  function exportPrices() {
    if (errors.length) {toast.error(`Resolve ${errors.length} markets needing attention before exporting.`); return;}
    download(exportCsv(product, selected.length ? rows.filter(r => selected.includes(r.code)) : rows), `fairpricing-${product.name.replace(/[^a-z0-9]/gi, '-').toLowerCase()}.csv`, 'text/csv;charset=utf-8');
    toast.success('Price CSV exported');
  }
  const comparisonRows = useMemo(() => STRATEGIES.map(s => ({strategy: s, rows: calculateRows({...product, strategy: s.id as ProductDraft['strategy'], overrides: {}})})), [product]);
  const comparisonMarkets = rows.filter(r => `${r.name} ${r.currency}`.toLowerCase().includes(compareSearch.toLowerCase())).slice(0, 40);
  return <div className="fair-app">
    <a className="fair-skip" href="#fair-main">Skip to content</a>
    <aside className="fair-sidebar"><Link href="/workspace" className="fair-brand"><Image src="/fairpricing.svg" alt="" width={32} height={32}/>FairPricing</Link><nav aria-label="Workspace navigation">{([{id: 'pricing', label: 'Localized pricing', icon: Globe2}, {id: 'products', label: 'Products', icon: Layers3}, {id: 'compare', label: 'Compare indexes', icon: LayoutGrid}, {id: 'sources', label: 'Data & methodology', icon: BookOpen}] as const).map(item => <Link key={item.id} href={`/workspace?view=${item.id}`} scroll={false} aria-current={tab === item.id ? 'page' : undefined} className={tab === item.id ? 'active' : ''}><item.icon size={17}/>{item.label}{item.id === 'products' && <span>{products.length}</span>}</Link>)}</nav><div className="fair-sidebar-bottom"><Link href="/setup"><Link2 size={16}/> Connect a store <ArrowRight size={14}/></Link><Link href="/setup-guide"><CircleHelp size={16}/> Setup guide</Link></div></aside>
    <div className="fair-body"><main id="fair-main" className="fair-main"><div className="fair-page-heading"><div><h1>{tab === 'pricing' ? 'Localized pricing' : tab === 'compare' ? 'Compare indexes' : tab === 'products' ? 'Products' : 'Data & methodology'}</h1><p>{tab === 'pricing' ? 'Enter a base price to calculate country prices.' : tab === 'compare' ? 'Compare all six strategies using the same base price and rounding.' : tab === 'products' ? 'Create a product and build its regional pricing plan.' : 'Sources, snapshot dates, and calculation methods.'}</p></div><button className="fair-button fair-secondary" onClick={() => {setProductName(''); setCreateOpen(true);}}><Plus size={15}/> New product</button></div>
        {saveError && <div className="fair-alert" role="alert">{saveError}</div>}
        <div className="fair-product-bar"><span className="fair-product-icon"><Layers3 size={22}/></span><label><small>PRICING FOR</small><select aria-label="Active product" value={product.id} onChange={e => {setActiveId(e.target.value); setSelected([]);}}>{products.map(p => <option value={p.id} key={p.id}>{p.name}</option>)}</select></label><span className="fair-pill">{product.kind === 'monthly' ? 'Monthly subscription' : product.kind === 'yearly' ? 'Yearly subscription' : 'One-time purchase'}</span><span className="fair-save">{saveError ? 'Unsaved changes' : 'Saved on this device'}</span><button className="fair-button" onClick={() => setReviewOpen(true)}><ArrowDownToLine size={15}/> Review & export</button></div>
        {(tab === 'pricing' || tab === 'compare') && <><StrategyPanel product={product} update={update}/>{errors.length > 0 && <div className="fair-alert" role="alert">{errors.length} markets need attention. {errors[0].name}: {errors[0].error} Review bounds or country overrides before exporting.</div>}
          {tab === 'pricing' ? <CountryTable rows={rows} currency={currency} onEdit={edit} selected={selected} setSelected={setSelected} onReset={() => {let next = product; selected.forEach(code => {next = updateOverride(next, code);}); applyProduct(next); setSelected([]); toast.success('Selected country preferences reset');}}/> : <section className="fair-panel fair-comparison"><div className="fair-table-heading"><div><h2>Strategy comparison</h2><p>Before country overrides. Bounds and rounding apply to every column.</p></div><input aria-label="Find comparison market" placeholder="Find a market…" value={compareSearch} onChange={e => setCompareSearch(e.target.value)}/></div><div className="fair-table-scroll"><table className="fair-country-table"><thead><tr><th>Market</th>{STRATEGIES.map(s => <th key={s.id}>{s.short}</th>)}</tr></thead><tbody>{comparisonMarkets.map(r => <tr key={r.code}><td><strong>{flag(r.code)} {r.name}</strong><small className="fair-block">{r.currency}</small></td>{comparisonRows.map(c => {const value = c.rows.find(row => row.code === r.code); return <td key={c.strategy.id} title={value?.error ?? value?.source}>{value && !value.error ? formatPrice(value.price, value.currency) : 'Unavailable'}</td>;})}</tr>)}</tbody></table></div><div className="fair-table-footer">Showing up to 40 matching markets. Search to explore a specific country.</div></section>}</>}
        {tab === 'products' && <section className="fair-products-grid">{products.map(p => <article className="fair-panel" key={p.id}><div className="fair-row-between"><span className="fair-product-icon"><Layers3 size={24}/></span><span className="fair-pill">Draft</span></div><h2>{p.name}</h2><p>{formatPrice(p.basePrice, baseCurrency(p))} · {p.kind}</p><p>{STRATEGIES.find(s => s.id === p.strategy)?.name} · {Object.keys(p.overrides).length} country preferences</p><button className="fair-button fair-secondary" onClick={() => {setActiveId(p.id); setTab('pricing');setSelected([]);}}>Open pricing <ArrowRight size={14}/></button></article>)}<button className="fair-add-product" onClick={() => {setProductName('');setCreateOpen(true);}}><Plus size={24}/><strong>Add a product</strong><span>Start a new regional pricing plan</span></button></section>}
        {tab === 'sources' && <section className="fair-panel fair-methodology"><h2>Reference data, with context.</h2><p>FairPricing extends <a href="https://github.com/andyshephard/PricingKit" target="_blank" rel="noreferrer">PricingKit</a>. This public workspace uses bundled snapshots so you can explore without credentials. These are pricing references, not promises of revenue or live store validation.</p><dl><dt>Exchange rates</dt><dd>CC0 exchange-api USD-based snapshot, dated February 1, 2026. Connected workflows can use Open Exchange Rates. Missing rates block calculation.</dd><dt>World Bank PPP</dt><dd>PricingKit’s February 2026 snapshot of purchasing-power factors, normalized to your base country. The upstream table includes regional estimates. <a href="https://data.worldbank.org/indicator/PA.NUS.PPP" target="_blank" rel="noreferrer">World Bank indicator →</a></dd><dt>Big Mac Index</dt><dd>The Economist’s July 2026 snapshot. Countries without a direct observation use its 0.70 fallback factor; the table identifies this. <a href="https://github.com/TheEconomist/big-mac-data" target="_blank" rel="noreferrer">The Economist’s data →</a></dd><dt>Netflix Index</dt><dd>PricingKit’s snapshot of Standard ad-free pricing, including inferred values where marked. Source: <a href="https://github.com/tompec/netflix-prices" target="_blank" rel="noreferrer">tompec/netflix-prices</a>, CC-BY-4.0, commit a46477c. Multipliers are relative to the base country.</dd><dt>GDP-adjusted</dt><dd>World Bank nominal GDP per capita, 2024 observations retrieved September 10, 2026. Price = FX price × target GDP ÷ base GDP. Missing observations use relative PPP. <a href="https://data.worldbank.org/indicator/NY.GDP.PCAP.CD" target="_blank" rel="noreferrer">World Bank indicator →</a></dd><dt>Custom blend</dt><dd>A weighted arithmetic mean of relative index factors. Weights must total 100%. Each component retains its snapshot and fallback limitations.</dd><dt>Rounding & tiers</dt><dd>Nearest positive ending; ties round upward. Zero-decimal currencies use whole-unit increments that grow with the amount. Bounds may change an ending. App Store previews use PricingKit’s February 2, 2026 currency-tier snapshot; connected publishing resolves valid product-specific tiers. Google previews use currency precision, not a fixed tier ladder.</dd><dt>Your drafts</dt><dd>Products, settings, and country overrides stay in this browser. Export a JSON backup to move them to another device. CSV files are review documents, not a store API upload format.</dd></dl><div className="fair-backup-actions"><button className="fair-button fair-secondary" onClick={() => download(JSON.stringify(products, null, 2), 'fairpricing-backup.json', 'application/json')}><FileDown size={15}/> Export backup</button><button className="fair-button fair-secondary" onClick={() => fileInput.current?.click()}><Upload size={15}/> Import backup</button></div></section>}
        </main><footer className="fair-footer"><span>FairPricing <span>·</span> Prices use bundled data snapshots.</span><Link href="/setup-guide">Setup guide <ArrowRight size={12}/></Link></footer>
    </div>
    <input ref={fileInput} hidden type="file" accept=".json,application/json" onChange={async e => {const file = e.target.files?.[0]; if (!file) return; try {if(file.size > 2000000) throw new Error('Backup exceeds 2 MB.'); const incoming = parseWorkspace(await file.text()); const merged = [...products]; for(const p of incoming) {merged.push(products.some(x => x.id === p.id) ? {...p, id: crypto.randomUUID(), name: `${p.name.slice(0, 69)} (imported)`} : p);} if(persist(merged)) toast.success('Backup imported');} catch {toast.error('Invalid backup. Choose a FairPricing JSON export under 2 MB.');} e.target.value = '';}}/>
    <Dialog open={createOpen} onOpenChange={setCreateOpen}><DialogContent className="fair-dialog"><DialogTitle>New product</DialogTitle><DialogDescription>Create a local draft. You can change its pricing before exporting.</DialogDescription><form onSubmit={e => {e.preventDefault(); if (!productName.trim()) return; const next = createProduct(productName.trim(), productKind); if(productKind === 'yearly') next.basePrice = 99.99; if(!persist([...products, next])) return; setActiveId(next.id);setTab('pricing');setSelected([]);setCreateOpen(false);}}><label>Product name<input autoFocus required maxLength={80} placeholder="e.g. Studio Pro" value={productName} onChange={e => setProductName(e.target.value)}/></label><label>Product type<select value={productKind} onChange={e => setProductKind(e.target.value as ProductDraft['kind'])}><option value="monthly">Monthly subscription</option><option value="yearly">Yearly subscription</option><option value="one-time">One-time purchase</option></select></label><button className="fair-button" type="submit">Create product <ArrowRight size={15}/></button></form></DialogContent></Dialog>
    <Dialog open={!!editRow} onOpenChange={open => {if(!open)setEditRow(null);}}><DialogContent className="fair-dialog"><DialogTitle>{editRow && flag(editRow.code)} {editRow?.name}</DialogTitle><DialogDescription>Keep your own price or choose a regional ending. Preferences survive recalculation.</DialogDescription>{editRow && <form onSubmit={e => {e.preventDefault();saveOverride();}}><div className="fair-override-baseline">Calculated price <strong>{formatPrice(editRow.calculated, editRow.currency)}</strong></div><label>Manual price ({editRow.currency})<input autoFocus type="number" step="any" min="0" placeholder="Leave empty to use calculated price" value={overrideAmount} onChange={e => setOverrideAmount(e.target.value)}/></label><label>Regional price ending<select value={overrideRounding} onChange={e => setOverrideRounding(e.target.value)}><option value="inherit">Use product setting</option>{ROUNDINGS.map(r => <option key={r.id} value={r.id}>{r.label}</option>)}</select></label><p className="fair-dialog-note">A manual amount is used exactly as entered. For App Store previews it must match a snapshot tier. {editRow.source}.</p><div className="fair-row-between"><button className="fair-button fair-secondary" type="button" onClick={() => {applyProduct(updateOverride(product, editRow.code));setEditRow(null);}}><RotateCcw size={14}/> Reset</button><button className="fair-button" type="submit">Save preference <Check size={14}/></button></div></form>}</DialogContent></Dialog>
    <Dialog open={reviewOpen} onOpenChange={setReviewOpen}><DialogContent className="fair-dialog"><DialogTitle>Export prices</DialogTitle><DialogDescription>Review your pricing plan before exporting. This does not publish prices to a store.</DialogDescription><div className="fair-review"><div><span>Product</span><strong>{product.name}</strong></div><div><span>Base price</span><strong>{formatPrice(product.basePrice, currency)}</strong></div><div><span>Strategy</span><strong>{strategyName}</strong></div><div><span>Markets to export</span><strong>{selected.length || rows.length}</strong></div><div><span>Country preferences</span><strong>{overrideCount}</strong></div><div><span>Needs attention</span><strong>{errors.length}</strong></div></div><p className="fair-dialog-note">CSV contains final calculated prices and manual overrides. Store publishing requires a separate connection and review.</p><button className="fair-button" disabled={errors.length > 0} onClick={exportPrices}><ArrowDownToLine size={16}/> Export prices as CSV</button><button className="fair-text-button" onClick={() => download(JSON.stringify(products, null, 2), 'fairpricing-backup.json', 'application/json')}>Export full workspace backup</button><Link className="fair-text-button" href="/setup">Ready for manual store testing? Connect store <ArrowRight size={13}/></Link></DialogContent></Dialog>
  </div>;
}
