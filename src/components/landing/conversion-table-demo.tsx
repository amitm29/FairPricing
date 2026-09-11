'use client';

import { useMemo, useState } from 'react';
import Link from 'next/link';
import { WorldMap } from '@/components/pricing/world-map';
import { STRATEGIES, ROUNDINGS, calculateRows, flag, formatPrice, type ProductDraft } from '@/lib/fairpricing/workspace';
import { DEFAULT_BLEND } from '@/lib/google-play/currency';

const MARKETS = ['US', 'IN', 'BR', 'TR', 'DE', 'CH', 'GB'];
export function ConversionTableDemo() {
  const [capAtBase,setCapAtBase]=useState(false);
  const [smartLocalEndings,setSmartLocalEndings]=useState(false);
  const [view,setView]=useState('table');
  const [amount, setAmount] = useState('9.99');
  const [strategy, setStrategy] = useState<ProductDraft['strategy']>('ppp');
  const [rounding, setRounding] = useState<ProductDraft['rounding']>('nearest-99');
  const [weights, setWeights] = useState<ProductDraft['weights']>({...DEFAULT_BLEND});
  const price = Number(amount);
  const valid = amount.trim() !== '' && Number.isFinite(price) && price > 0 && price <= 1000000;
  const total = Object.values(weights).reduce((a, b) => a + b, 0);
  const rows = useMemo(() => valid ? calculateRows({id:'preview', name:'', kind:'monthly', basePrice:price, baseRegion:'US', platform:'google', strategy, rounding, weights, capAtBase, smartLocalEndings, minRatio:0.1, maxRatio:2, overrides:{}, updatedAt:''}) : [], [valid, price, strategy, rounding, weights, capAtBase, smartLocalEndings]);
  return <div id="calculator" className="rounded-xl border bg-card overflow-hidden scroll-mt-20">
    <div className="grid grid-cols-2 gap-4 border-b p-5">
      <label className="text-sm font-medium">Base price (USD)<input aria-label="Base price (USD)" type="number" min="0.01" max="1000000" step="0.01" value={amount} onChange={e=>setAmount(e.target.value)} className="mt-2 h-10 w-full rounded-md border bg-background px-3" /></label>
      <label className="text-sm font-medium">Price ending<select aria-label="Price ending" value={rounding} onChange={e=>setRounding(e.target.value as ProductDraft['rounding'])} className="mt-2 h-10 w-full rounded-md border bg-background px-3">{ROUNDINGS.map(r=><option value={r.id} key={r.id}>{r.label}</option>)}</select></label>
      <label className="col-span-2 text-sm font-medium">Pricing index<select aria-label="Pricing index" value={strategy} onChange={e=>setStrategy(e.target.value as ProductDraft['strategy'])} className="mt-2 h-10 w-full rounded-md border bg-background px-3">{STRATEGIES.map(s=><option value={s.id} key={s.id}>{s.short}</option>)}</select></label>
      <label className="col-span-2 flex items-center gap-2 text-sm"><input type="checkbox" checked={capAtBase} onChange={e=>setCapAtBase(e.target.checked)}/>Never price above United States</label><label className="col-span-2 flex items-center gap-2 text-sm"><input type="checkbox" checked={smartLocalEndings} onChange={e=>setSmartLocalEndings(e.target.checked)}/>Smart local endings</label>
      {strategy === 'blend' && <fieldset className="col-span-2 grid grid-cols-2 gap-3"><legend className="mb-3 text-sm">Index weights · {total}% / 100%</legend>{STRATEGIES.filter(s=>s.id !== 'blend').map(s=><label className="text-xs" key={s.id}>{s.short} (%)<input aria-label={`${s.short} weight`} type="number" min="0" max="100" value={weights[s.id] ?? 0} onChange={e=>setWeights({...weights,[s.id]:Math.max(0,Math.min(100,Number(e.target.value)))})} className="mt-1 h-9 w-full rounded border bg-background px-2"/></label>)}</fieldset>}
    </div>
    {!valid && <p role="alert" className="p-4 text-sm text-destructive">Enter a price greater than 0 and no more than 1,000,000.</p>}
    {strategy === 'blend' && Math.abs(total-100) > .001 && <p role="alert" className="p-4 text-sm text-destructive">Index weights must total 100%.</p>}
    <div className="flex gap-2 border-b p-3" role="group" aria-label="Price view"><button aria-pressed={view==='table'} className="rounded border px-3 py-1 text-sm aria-pressed:bg-primary aria-pressed:text-primary-foreground" onClick={()=>setView('table')}>Table</button><button aria-pressed={view==='map'} className="rounded border px-3 py-1 text-sm aria-pressed:bg-primary aria-pressed:text-primary-foreground" onClick={()=>setView('map')}>Map</button></div>
    {view==='map'?<WorldMap rows={rows.filter(r=>!r.error).map(r=>({code:r.code,name:r.name,currency:r.currency,price:r.price,ratio:r.price/r.fxPrice}))}/>:<div className="overflow-x-auto"><table className="w-full text-sm tabular-nums"><caption className="sr-only">Example regional prices based on bundled data, not connected store prices</caption><thead className="border-b bg-muted/30"><tr><th className="p-4 text-left font-medium">Country</th><th className="p-4 text-right font-medium">FX price</th><th className="p-4 text-right font-medium">FairPricing</th></tr></thead><tbody>{MARKETS.map(code=>{const r=rows.find(row=>row.code===code);return <tr key={code} className="border-b last:border-0"><td className="px-4 py-3 whitespace-nowrap">{flag(code)} {r?.name ?? code}<span className="ml-2 text-xs text-muted-foreground">{r?.currency}</span></td><td className="px-4 py-3 text-right text-muted-foreground whitespace-nowrap">{r ? <s>{formatPrice(r.fxPrice,r.currency)}</s> : '—'}</td><td className="px-4 py-3 text-right font-medium whitespace-nowrap" title={r?.error ?? r?.source}>{r && !r.error ? formatPrice(r.price,r.currency) : '—'}</td></tr>})}</tbody></table></div>}
    <div className="border-t p-4 space-y-3"><p className="text-xs leading-relaxed text-muted-foreground">Example prices using bundled data snapshots and Google Play currencies. Bounds: 10%–{capAtBase?'100':'200'}% of FX. Smart endings are optional market conventions. No store is connected to this calculator.</p><Link className="inline-flex h-10 items-center rounded-md bg-primary px-4 text-sm font-medium text-primary-foreground" href="/setup">Connect store to price your products</Link></div>
  </div>;
}
