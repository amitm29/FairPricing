# Third-party notices

FairPricing is a modified version of [PricingKit](https://github.com/andyshephard/PricingKit), Copyright (C) 2026 Andy Shephard, imported at commit 116ad31fd760809373b33d877a2e5e1bed42a01c. Distributed under GNU GPL version 3; see LICENSE. FairPricing modifications (2026-09-10) include branding, landing calculator, GDP and blend strategies, rounding, country overrides, navigation, session configuration, and deployment changes. The original copyright notice is retained.

## Data (separate from the software license)

- **The Economist Big Mac Index**, July 1, 2026 observations, [source](https://github.com/TheEconomist/big-mac-data), [CC BY 4.0](https://creativecommons.org/licenses/by/4.0/). Modified by normalizing dollar prices to the United States and mapping ISO country codes. Missing countries use a labeled 0.70 estimate, not an Economist observation. Replaces the inherited World Population Review table.
- **Netflix Prices Per Country**, original creation by [Thomas / thomas.io](https://www.thomas.io/), [tompec/netflix-prices](https://github.com/tompec/netflix-prices), commit a46477c39bc95049bca452b4476d0ed1ac64d1ea, [CC BY 4.0](https://creativecommons.org/licenses/by/4.0/). Modified by selecting Standard ad-free prices, normalizing to US prices, and adding explicitly marked inferred entries.
- **World Bank, World Development Indicators**, indicators PA.NUS.PPP and NY.GDP.PCAP.CD, [data license and additional terms](https://datacatalog.worldbank.org/public-licenses), CC BY 4.0. PPP estimates are inherited PricingKit calculations dated February 2026; GDP uses 2024 observations retrieved September 10, 2026. Values are transformed into relative pricing multipliers. These calculations are not endorsed by the World Bank.
- **Fawaz Ahmed, exchange-api**, February 1, 2026 USD snapshot, [source](https://github.com/fawazahmed0/exchange-api), [CC0-1.0](https://creativecommons.org/publicdomain/zero/1.0/). Modified by uppercasing three-letter codes. Replaces the bundled Open Exchange Rates snapshot; optional live Open Exchange Rates usage remains subject to the user's provider terms.
- **Apple currency price tiers and territory mappings**: reference snapshot inherited from PricingKit, February 2, 2026. Preview references only; connected publishing resolves store-supported price points. Apple API usage remains subject to your developer agreements.

## Dependencies and assets

Dependencies retain their own licenses in their npm packages. Inter is licensed under SIL Open Font License 1.1; Lucide icons use ISC. React/Next.js/Tailwind and the principal application libraries use their included permissive licenses. The FairPricing mark is newly created. No Baseprice branding is used. Unused upstream promotional images and favicons are excluded from release.

FairPricing is independent of PricingKit, Baseprice, The Economist, Netflix, Apple, Google, and the World Bank. Names identify compatibility or data sources and do not imply endorsement.

## Imported local refinements

Smart-ending functions and map rendering were adapted, at the owner's request, from the owner's parallel FairPricing implementation on 2026-09-10. Natural Earth 110m map geometry is public domain: https://www.naturalearthdata.com/about/terms-of-use/. SVG paths were precomputed from Natural Earth admin-0 country geometry. Local ending rules are optional heuristics, not universally applicable store requirements.
