'use client';
import {useState} from 'react';
import paths from '@/lib/utils/world-paths.json';
import {formatPrice} from '@/lib/fairpricing/workspace';
export interface MapPrice {code:string;name?:string;currency:string;price:number;ratio:number;}
const colors=['#b4e4df','#7bc8c1','#45aaa2','#188b81','#00665e'];
export function WorldMap({rows}:{rows:MapPrice[]}) {
 const [selected,setSelected]=useState<string|null>(null);
 const indexed=new Map(rows.filter(r=>Number.isFinite(r.price)&&r.price>0).map(r=>[r.code,r]));
 const active=selected?indexed.get(selected):undefined;
 return <div className="rounded-lg border bg-card p-3"><svg viewBox={`0 0 ${paths.width} ${paths.height*.82}`} className="w-full" aria-label="World price map"><g transform={`translate(0,${-paths.height*.04})`}>{Object.entries(paths.paths).map(([code,d])=>{const row=indexed.get(code);const label=row?`${row.name??code}: ${formatPrice(row.price,row.currency)}`:code;return <path key={code} d={d} fill={row?colors[row.ratio<.35?0:row.ratio<.55?1:row.ratio<.75?2:row.ratio<.9?3:4]:'var(--muted)'} stroke="var(--background)" strokeWidth={selected===code?1.5:.5} tabIndex={row?0:undefined} role={row?'button':undefined} aria-label={label} onFocus={()=>row&&setSelected(code)} onMouseEnter={()=>row&&setSelected(code)} onClick={()=>row&&setSelected(code)} onKeyDown={e=>{if(row&&(e.key==='Enter'||e.key===' ')){e.preventDefault();setSelected(code);}}}><title>{label}</title></path>})}</g></svg><div className="flex flex-wrap justify-between gap-3 border-t pt-3 text-xs"><span className="flex items-center gap-1">Lower {colors.map(c=><span key={c} style={{background:c}} className="inline-block h-3 w-4"/>)} Higher · relative to FX</span><span aria-live="polite">{active?`${active.name??active.code} · ${formatPrice(active.price,active.currency)} · ${active.ratio.toFixed(2)}×`:'Hover, focus, or tap a country. Unpriced countries are gray.'}</span></div></div>;
}
export function PriceMapPreview({rows}:{rows:MapPrice[]}) {
 return <details className="rounded-lg border p-3"><summary className="text-sm font-medium">Map of calculated prices</summary><div className="mt-3"><WorldMap rows={rows}/></div></details>;
}
