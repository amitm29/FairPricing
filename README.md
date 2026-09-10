# FairPricing

A free regional pricing web app built on [PricingKit](https://github.com/andyshephard/PricingKit), with a redesigned workspace, six pricing strategies, weighted blends, psychological price endings, persistent country overrides, and CSV exports. No billing or subscription payments for using FairPricing.

## Run locally

Requires Node.js 22+ and npm. No environment variables or store credentials are needed for the demo.

```bash
npm ci
npm run dev
```

Open [FairPricing](http://localhost:3000), [the pricing workspace](http://localhost:3000/workspace), or [index comparison](http://localhost:3000/index-checker).

## Pricing workflow

The landing page has a public price calculator with a USD base price, six pricing strategies, custom blend weights, and psychological price endings. It uses bundled snapshots and does not create a sample product or send store requests.

Connect a store at `/setup` to enter the real product dashboard. Google Play and App Store Connect are connected separately; products and subscriptions load for the selected app. `/workspace` routes to this authenticated dashboard, and `/index-checker` routes to the public calculator. No Studio Pro sample is shown in this flow. Any older local draft data remains in browser storage and is not imported into a connected account.

## Store workflows for manual testing

PricingKit's Google Play and App Store Connect adapters, setup guides, products, subscriptions, and review/apply flows are retained. Connected bulk editors include the new strategies, blends, rounding, bounds, and app-scoped local overrides.

When you decide to test a real store, configure `ENCRYPTION_KEY` on the server first (use a long randomly generated secret). Then visit `/setup` and follow the in-app guides to upload the appropriate service-account JSON or Apple .p8 key and identifiers. These credentials are processed by server API routes to authenticate with the store; they are not limited to the browser. Sessions use encrypted HTTP-only cookies. FairPricing development/testing did not connect any Google Play or App Store account.

Manual validation checklist:

- Choose a test product or subscription and a small set of countries.
- Compare the source store prices with the loaded prices.
- Try each strategy and rounding option, then review the calculated changes.
- Set a country override, change strategy, and confirm that the override remains.
- For Apple, review the resolved product-specific tiers; the offline currency-tier snapshot can differ.
- Explicitly apply only the changes you intend, then verify in the store console.

`OPEN_EXCHANGE_RATES_APP_ID` is optional for current FX in connected workflows. The public demo always uses clearly identified snapshots.

## Data and calculation

- **FX:** CC0 exchange-api snapshot, February 1, 2026. Missing FX raises an error, never parity.
- **PPP:** PricingKit's February 2026 World Bank-based factor table, including regional estimates. Ratios normalize to the selected base country.
- **Big Mac:** The Economist's July 2026 index snapshot. Missing countries use the upstream 0.70 factor and are labeled as estimates.
- **Netflix:** PricingKit's `tompec/netflix-prices` snapshot, commit `a46477c39bc95049bca452b4476d0ed1ac64d1ea`, CC-BY-4.0. Inferred entries are labeled.
- **GDP:** World Bank `NY.GDP.PCAP.CD`, nominal GDP per capita, 2024 observations retrieved September 10, 2026. `FX price × target GDP / base GDP`; missing observations use relative PPP. Source URL and vintage are in `src/lib/conversion-indexes/gdp-data.json`.
- **Blend:** Weighted arithmetic mean of normalized factors. Component snapshots and fallback limitations still apply.
- **Psychological endings:** Nearest positive ending, ties upward; ISO currency precision; magnitude-dependent whole-unit rounding for zero-decimal currencies.
- **Bounds:** Apply to the final price. Currency rounding or bounds may change the chosen ending. Incompatible bounds block the result.
- **Apple:** Preview tiers use upstream data dated February 2, 2026. Connected publishing resolves product-specific tiers through Apple's API. No claims of live validity are made for offline previews.

Coverage follows PricingKit's supported billing territories: 173 Google Play regions and the supported Apple territory list. An index's observed coverage may be smaller than platform coverage. These models are reference tools, not guarantees of revenue or willingness to pay.

## Tests and production

```bash
npm test
npm run lint
npx tsc --noEmit
npm run build
npm start
```

Deploy as a standard Next.js Node application on a host supporting Node 22+, with build command `npm ci && npm run build` and start command `npm start`. Configure HTTPS and `ENCRYPTION_KEY` before using store credentials. The public demo does not require a database. No public deployment, external account, or paid hosting was created. The upstream optional Cloudflare adapter was removed in favor of the standard Next.js runtime.

## Attribution

FairPricing derives from PricingKit by Andy Shephard, imported at commit `116ad31fd760809373b33d877a2e5e1bed42a01c`. The upstream GPL license is preserved in `LICENSE`; package license is `GPL-3.0-or-later`. Netflix data retains its source attribution and CC-BY-4.0 notice. FairPricing branding is original; no Baseprice logos or proprietary assets are used.

## Self-hosted use

See [third-party notices](THIRD_PARTY_NOTICES.md) for licenses, source attribution, and modifications. Configure ENCRYPTION_KEY even for local store connections; plaintext sessions are not supported. The host processes credentials in memory and stores encrypted session cookies. This does not eliminate trust in your hosting provider. No store credentials belong in Git or Vercel environment variables.

## Pricing refinements

The calculator and connected bulk editors offer an optional base-country ceiling and smart local endings. The ceiling also limits Apple price-point resolution; territories with no compatible price point are skipped. Optional local conventions are suggestions, not promises of conversion or universally required store rules. The landing calculator has Table/Map views; connected editors include an expandable map. Theme choice follows the system initially and can be changed in the navigation.
