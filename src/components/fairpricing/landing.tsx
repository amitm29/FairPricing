import Image from 'next/image';
import Link from 'next/link';
import { ArrowRight, ArrowUpRight, Check, Globe2, SlidersHorizontal, LockKeyhole, MoveHorizontal, Landmark, Sandwich, Play, ChartNoAxesCombined, Blend } from 'lucide-react';
import './landing.css';

const strategies = [
  { icon: MoveHorizontal, name: 'Exchange rate', text: 'A straightforward currency conversion. Your baseline for every comparison.', tag: 'THE BASELINE' },
  { icon: Landmark, name: 'World Bank PPP', text: 'Adjust for local purchasing power using World Bank price-level data.', tag: 'PURCHASING POWER' },
  { icon: Sandwich, name: 'Big Mac Index', text: 'Explore purchasing power through the price of a familiar everyday item.', tag: 'EVERYDAY ECONOMICS' },
  { icon: Play, name: 'Netflix Index', text: 'Use regional subscription prices as a reference for digital products.', tag: 'DIGITAL SUBSCRIPTIONS' },
  { icon: ChartNoAxesCombined, name: 'GDP-adjusted', text: 'Factor in relative GDP per capita, with bounds you control.', tag: 'INCOME CONTEXT' },
  { icon: Blend, name: 'Custom blend', text: 'Combine normalized strategies with your own weights, totaling 100%.', tag: 'YOUR PERSPECTIVE' },
];
const rows = [
  ['US', 'United States', 'USD', '$9.99', '$9.99', 'Base price'],
  ['GB', 'United Kingdom', 'GBP', '£7.49', '$9.60', 'Adjusted'],
  ['IN', 'India', 'INR', '₹299.00', '$3.57', 'Adjusted'],
  ['BR', 'Brazil', 'BRL', 'R$24.99', '$4.99', 'Adjusted'],
];

export function FairPricingLanding() {
  return <div className="fp-landing">
    <a href="#main" className="fp-skip">Skip to content</a>
    <header className="fp-nav fp-container">
      <Link href="/" className="fp-brand"><Image src="/fairpricing.svg" width={34} height={34} alt="" />FairPricing<span className="fp-free">FREE</span></Link>
      <nav aria-label="Main navigation"><Link href="/index-checker" className="fp-nav-compare">Compare indices</Link><Link href="/setup">Connect store <ArrowUpRight size={14} aria-hidden="true" /></Link><Link href="/workspace" className="fp-button fp-small">Open workspace <ArrowRight size={15} aria-hidden="true" /></Link></nav>
    </header>
    <main id="main">
      <section className="fp-hero fp-container">
        <div className="fp-hero-copy"><div className="fp-eyebrow"><span /> ONE PRODUCT. A WORLD OF POSSIBILITIES.</div><h1>A fair price.<br />In every <span>market.</span></h1><p className="fp-lead">Your product travels across borders.<br className="fp-desktop-break" /> Your pricing should understand them.</p><p className="fp-description">Find thoughtful regional prices for your apps and subscriptions. Compare local purchasing power, fine-tune the details, and stay in control.</p><div className="fp-actions"><Link href="/workspace" className="fp-button">Explore the workspace <ArrowRight size={18} aria-hidden="true" /></Link><Link href="/index-checker" className="fp-text-link">Compare indices <ArrowUpRight size={16} aria-hidden="true" /></Link></div><div className="fp-reassurance"><span><Check size={14} /> Free & open source</span><span><Check size={14} /> No account needed for demo</span></div></div>
        <div className="fp-preview-wrap"><div className="fp-preview"><div className="fp-preview-heading"><div className="fp-product-icon"><Globe2 size={22} aria-hidden="true" /></div><div><strong>Your next great app</strong><span>Monthly subscription · Sample preview</span></div><span className="fp-draft">DRAFT</span></div><div className="fp-preview-controls"><div><span>BASE PRICE</span><strong>$9.99 <small>USD / month</small></strong></div><div><span>STRATEGY</span><strong><Landmark size={14} aria-hidden="true" /> World Bank PPP</strong></div></div><div className="fp-table-scroll"><table><caption className="sr-only">Illustrative regional pricing example, not live calculations</caption><thead><tr><th>Market</th><th>Local price</th><th>In USD</th></tr></thead><tbody>{rows.map(([code, country, currency, price, equivalent, state]) => <tr key={code}><td><span className="fp-country-code">{code}</span><span className="fp-country-name">{country}<small>{currency} · {state}</small></span></td><td>{price}</td><td>{equivalent}</td></tr>)}</tbody></table></div><div className="fp-preview-bottom"><span><span className="fp-status-dot" /> Illustrative prices</span><Link href="/workspace">Make it yours <ArrowRight size={14} aria-hidden="true" /></Link></div></div><div className="fp-preview-note"><SlidersHorizontal size={16} aria-hidden="true" /><span>Your strategy. Your rounding. Your final say.</span></div></div>
      </section>
      <section className="fp-principles fp-container" aria-label="Designed for careful pricing"><div><Globe2 aria-hidden="true" /><span>Built for regional differences</span></div><div><SlidersHorizontal aria-hidden="true" /><span>Every price is yours to adjust</span></div><div><LockKeyhole aria-hidden="true" /><span>Demo drafts stay on this device</span></div></section>
      <section className="fp-strategies fp-container" id="strategies"><div className="fp-section-heading"><div><p className="fp-eyebrow">MORE CONTEXT. BETTER DECISIONS.</p><h2>One price doesn’t fit the world.</h2></div><p>Start with a strategy that fits your product.<br />Then give every market a closer look.</p></div><div className="fp-strategy-grid">{strategies.map(({ icon: Icon, name, text, tag }, i) => <article className="fp-strategy" key={name}><div className="fp-card-top"><Icon size={22} strokeWidth={1.6} aria-hidden="true" /><span>0{i + 1}</span></div><h3>{name}</h3><p>{text}</p><span className="fp-strategy-tag">{tag}</span></article>)}</div><p className="fp-data-note">Indices are reference points, not guarantees. Review snapshot dates, available observations, and fallback estimates in the workspace.</p></section>
      <section className="fp-workflow fp-container"><div><p className="fp-eyebrow">FROM IDEA TO REVIEWED PRICES</p><h2>Explore first.<br />Publish when you’re ready.</h2><p>Try a sample product without store credentials. Export your work for a closer look, or connect your store for an explicit review before publishing.</p><Link href="/workspace" className="fp-button">Start with a demo <ArrowRight size={17} aria-hidden="true" /></Link></div><ol>{[['Set your starting point', 'Choose a product, base country, currency, and price.'], ['Find your regional fit', 'Compare strategies, choose price endings, and override individual markets.'], ['Review, then take the next step', 'Export a CSV, or connect your store to review and publish.']].map(([title, text], i) => <li key={title}><span>0{i + 1}</span><div><h3>{title}</h3><p>{text}</p></div></li>)}</ol></section>
    </main>
    <footer className="fp-footer fp-container"><div><Link href="/" className="fp-brand"><Image src="/fairpricing.svg" width={28} height={28} alt="" />FairPricing</Link><p>Thoughtful pricing, everywhere.</p></div><div><Link href="/setup-guide">Store setup guide <ArrowUpRight size={13} aria-hidden="true" /></Link><a href="https://github.com/andyshephard/PricingKit" target="_blank" rel="noopener noreferrer">Built on PricingKit · GPL-3.0 <ArrowUpRight size={13} aria-hidden="true" /></a></div></footer>
  </div>;
}
