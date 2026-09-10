import Link from 'next/link';
import { PsychologicalPricing } from '@/components/landing/psychological-pricing';
import { LandingNav } from '@/components/landing/landing-nav';
import { LandingFooter } from '@/components/landing/landing-footer';
import { ConversionTableDemo } from '@/components/landing/conversion-table-demo';

export default function Home() {
  return <div className="min-h-screen bg-background">
    <LandingNav />
    <main>
      <section className="mx-auto max-w-7xl px-5 py-12 md:py-20">
        <div className="grid items-start gap-12 lg:grid-cols-2">
          <div className="space-y-8 lg:pt-6">
            <div className="space-y-5"><h1 className="text-4xl font-semibold tracking-tight md:text-5xl leading-tight">Regional pricing for the App Store and Google Play</h1><p className="max-w-lg text-lg leading-relaxed text-muted-foreground">Compare currency conversion with purchasing power, Big Mac, Netflix, and GDP indexes. Choose a strategy, review local prices, and apply them to your store products.</p></div>
            <ol className="space-y-5">{[['Connect your store','Connect Google Play or App Store Connect, then choose your app. Each store has its own connection.'],['Review regional prices','Your products and subscriptions load from the selected app. Choose an index, rounding, and countries to update.'],['Apply your changes','Review the proposed prices and confirm before sending changes to the store.']].map(([title,text],i)=><li key={title} className="flex gap-3"><span className="flex h-7 w-7 shrink-0 items-center justify-center rounded-full bg-muted text-sm">{i+1}</span><div><h2 className="font-medium">{title}</h2><p className="mt-1 text-sm leading-relaxed text-muted-foreground">{text}</p></div></li>)}</ol>
            <Link href="/setup" className="inline-flex h-11 items-center rounded-md bg-primary px-6 font-medium text-primary-foreground">Connect your store</Link>
            <p className="text-sm text-muted-foreground">Free to use. Try the calculator without connecting an account.</p>
          </div>
          <ConversionTableDemo />
        </div>
      </section>
      <section className="border-y bg-muted/20"><div className="mx-auto max-w-5xl px-5 py-14"><h2 className="text-2xl font-semibold tracking-tight">Choose how to calculate your regional prices</h2><div className="mt-8 grid gap-x-10 gap-y-7 sm:grid-cols-2 lg:grid-cols-3">{[['World Bank PPP','Adjust prices using relative purchasing power.'],['Big Mac Index','Compare the local cost of an everyday purchase.'],['Netflix Index','Use regional digital subscription prices as a reference.'],['GDP-adjusted','Scale prices using nominal GDP per person.'],['Exchange rate','Convert the base price without an affordability adjustment.'],['Custom blend','Combine indexes with your own percentage weights.']].map(([title,text])=><div key={title}><h3 className="font-medium">{title}</h3><p className="mt-2 text-sm leading-relaxed text-muted-foreground">{text}</p></div>)}</div><p className="mt-8 text-sm text-muted-foreground">Reference data includes dated snapshots and estimates where observations are missing. Results are pricing suggestions, not guaranteed revenue improvements.</p></div></section>
      <PsychologicalPricing/><section id="faq" className="mx-auto max-w-3xl px-5 py-14 scroll-mt-16"><h2 className="mb-7 text-2xl font-semibold">Frequently asked questions</h2>{[
        ['Is the calculator showing my products?','No. It is a public example with no sample product or account. Connect a store to open the dashboard and load your real products.'],
        ['Can I connect both stores?','Yes. Connect each platform separately. The dashboard loads products and subscriptions for the selected app, and you can switch platforms. Products are not merged between stores.'],
        ['How are prices sent to the store?','After you review and confirm changes, FairPricing’s server authenticates with Google Play or App Store Connect and sends the requested price updates through their APIs. The public calculator does not publish prices.'],
        ['How are my credentials handled?','Your API credentials are processed by the FairPricing server to authenticate with the stores. Session credentials are encrypted in HTTP-only cookies. They are not confined to your browser.'],
        ['Will this change existing subscriptions?','The effect depends on the store and subscription settings. Review the subscriber and price-preservation options in the connected editor before applying changes.']
      ].map(([title,text])=><details key={title} className="border-b py-4"><summary className="cursor-pointer font-medium">{title}</summary><p className="pt-3 text-sm leading-relaxed text-muted-foreground">{text}</p></details>)}</section>
    </main><LandingFooter />
  </div>;
}
