'use client';
import { SlidersHorizontal } from 'lucide-react';
import { STRATEGIES, ROUNDINGS, baseCurrency, type ProductDraft } from '@/lib/fairpricing/workspace';
import { GOOGLE_PLAY_REGIONS } from '@/lib/google-play/types';

export function StrategyPanel({product, update}: {product: ProductDraft; update: (patch: Partial<ProductDraft>) => void}) {
  const total = Object.values(product.weights).reduce((a, b) => a + b, 0);
  return <div className="fair-controls">
    <section className="fair-panel fair-base"><div className="fair-base-fields">
      <label>Base country<select value={product.baseRegion} onChange={e => update({baseRegion: e.target.value})}>{GOOGLE_PLAY_REGIONS.map(r => <option key={r.code} value={r.code}>{r.name}</option>)}</select></label>
      <label>Base price<div className="fair-price-input"><span>{baseCurrency(product)}</span><input aria-label="Base price" type="number" min="0.01" max="1000000" step="0.01" key={`${product.id}-${product.basePrice}`} defaultValue={product.basePrice} onBlur={e => { const value = Number(e.target.value); if (Number.isFinite(value) && value > 0 && value <= 1000000) update({basePrice: value}); else e.target.value = String(product.basePrice); }} onKeyDown={e => {if (e.key === 'Enter') e.currentTarget.blur();}} /></div></label>
      <label>Store preview<select value={product.platform} onChange={e => update({platform: e.target.value as ProductDraft['platform']})}><option value="google">Google Play</option><option value="apple">App Store</option></select></label>
    </div></section>
    <section className="fair-panel fair-strategy-settings"><div className="fair-compact-settings"><label>Pricing strategy<select aria-label="Pricing strategy" value={product.strategy} onChange={e => update({strategy: e.target.value as ProductDraft['strategy']})}>{STRATEGIES.map(s => <option key={s.id} value={s.id}>{s.name}</option>)}</select></label><label>Price ending<select aria-label="Price ending" value={product.rounding} onChange={e => update({rounding: e.target.value as ProductDraft['rounding']})}>{ROUNDINGS.map(r => <option key={r.id} value={r.id}>{r.label}</option>)}</select></label></div><p className="fair-strategy-description">{STRATEGIES.find(s => s.id === product.strategy)?.description}</p>
      {product.strategy === 'blend' && <div className="fair-blend"><div className="fair-row-between"><strong><SlidersHorizontal size={14} /> Your blend</strong><span className={Math.abs(total - 100) > .001 ? 'fair-error-text' : 'fair-green'}>{total}% of 100%</span></div><div className="fair-weight-grid">{STRATEGIES.filter(s => s.id !== 'blend').map(s => <label key={s.id}>{s.short}<div className="fair-weight"><input aria-label={`${s.short} weight`} type="number" min="0" max="100" value={product.weights[s.id] ?? 0} onChange={e => update({weights: {...product.weights, [s.id]: Math.max(0, Math.min(100, Number(e.target.value)))}})} /><span>%</span></div></label>)}</div><p>Weights must total 100%. Prices use the weighted average of the selected index factors.</p></div>}
    </section>
    <details className="fair-guardrails"><summary><SlidersHorizontal size={14} /> Price bounds <span>{Math.round(product.minRatio * 100)}%–{Math.round(product.maxRatio * 100)}% of FX price</span></summary><div><label>Minimum %<input type="number" min="0" max="1000" value={Math.round(product.minRatio * 100)} onChange={e => update({minRatio: Math.max(0, Number(e.target.value)) / 100})}/></label><label>Maximum %<input type="number" min="1" max="10000" value={Math.round(product.maxRatio * 100)} onChange={e => update({maxRatio: Math.max(1, Number(e.target.value)) / 100})}/></label><p>Bounds limit the final price, including overrides. A price with conflicting bounds cannot be exported.</p></div></details>
  </div>;
}
