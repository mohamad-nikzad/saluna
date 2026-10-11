# Persian search demand for Saluna

Investigated on 11 October 2026. Audience assumed to be Persian-speaking Salon Owners in Iran, based on the current product and website. This research proposes changes. It does not change the landing page, publish content, or establish a complete ranking of search demand.

The first priority is the existing appointment-request page. Google Trends showed more detectable interest for `نوبت دهی آرایشگاه` than for the two management-software terms compared with it. Its related searches also surfaced appointment apps and announcement templates. Keep the homepage focused on salon management, then use the appointment page and useful owner content to address these more specific searches.

## Evidence and its limits

Used Google Trends Classic Explore, Iran, Web Search, all categories, search terms rather than topics. Compared three terms over the past 12 months and five years, then added two terms to the five-year comparison. Used ordinary spaces in these inputs. Other spellings and half-space variants remain untested. These five phrases do not represent every relevant search in the market.

The initial direct comparison returned a page error. Searching through the Classic Explore interface subsequently loaded charts and allowed CSV exports. The newer Explore interface requested sign-in. Subregion maps returned `Requested map does not exist`, so there is no basis for choosing target cities from this session.

Google Trends reports sampled, normalized interest, not monthly search counts. A zero can reflect insufficient volume. Google also cautions that isolated spikes at low volume can reflect statistical noise. We cannot responsibly conclude that a term has no demand, estimate market size, infer a seasonal peak, or quote a precise demand ratio from these exports. See [Google's explanation of Trends data](https://support.google.com/trends/answer/4365533?hl=en).

| Exact search term            | Nonzero weekly observations, 12 months | Nonzero weekly observations, expanded five-year comparison | Interpretation                                                        |
| ---------------------------- | -------------------------------------- | ---------------------------------------------------------- | --------------------------------------------------------------------- |
| نرم افزار آرایشگاه           | 2 of 54                                | 3 of 262                                                   | Relevant owner wording, sparse signal                                 |
| نرم افزار مدیریت سالن زیبایی | 2 of 54                                | 2 of 262                                                   | Strong product fit despite sparse signal                              |
| نوبت دهی آرایشگاه            | 3 of 54                                | 8 of 262                                                   | Most detectable interest among the tested phrases, mixed intent       |
| اپلیکیشن نوبت دهی آرایشگاه   | Not in this export                     | 2 of 262                                                   | App wording also appears in related searches                          |
| نرم افزار حسابداری آرایشگاه  | Not in this export                     | 1 of 262                                                   | Adjacent category with expectations beyond Saluna's current reporting |

Counts describe the downloaded samples, including the latest week. They are not counts of searches or users. The sparse data is too weak for a reliable market-wide popularity ranking. The five-year and 12-month scales differ and should not be combined.

The five-year related-query export for `نوبت دهی آرایشگاه` returned:

| Related query                  | Top relative score | Rising change shown by Trends | Useful implication                                               |
| ------------------------------ | ------------------ | ----------------------------- | ---------------------------------------------------------------- |
| اپلیکیشن نوبت دهی آرایشگاه     | 100                | Not listed as rising          | Explain browser and mobile use on the appointment page           |
| متن نوبت دهی آرایشگاه برای عید | 62                 | +150%                         | Candidate content with usable appointment-announcement templates |
| متن نوبت دهی آرایشگاه زنانه    | 46                 | +50%                          | Candidate content about announcing available appointments        |

These are related queries for one seed, geography and period. The scores are not market shares. The growth figures are Google's displayed comparisons for this selected window, not annual growth or proof of a stable trend. [Google explains top and rising related queries here](https://support.google.com/trends/answer/4355000?hl=en).

Native exports and derived descriptive statistics:

- [Core comparison, 12 months](./trends-core-12-months.csv)
- [Core comparison, five years](./trends-core-5-years.csv)
- [Expanded comparison, five years](./trends-expanded-5-years.csv)
- [Appointment related queries, five years](./trends-appointment-related-5-years.csv)
- [Summary calculated from the exported weekly rows](./trends-summary.json)

Open the comparisons again with [these three terms over 12 months](https://trends.google.com/trends/explore?geo=IR&date=today%2012-m&q=نرم%20افزار%20آرایشگاه,نرم%20افزار%20مدیریت%20سالن%20زیبایی,نوبت%20دهی%20آرایشگاه) or [these five terms over five years](https://trends.google.com/trends/explore?geo=IR&date=today%205-y&q=نرم%20افزار%20آرایشگاه,نرم%20افزار%20مدیریت%20سالن%20زیبایی,نوبت%20دهی%20آرایشگاه,اپلیکیشن%20نوبت%20دهی%20آرایشگاه,نرم%20افزار%20حسابداری%20آرایشگاه). These links use rolling periods. The saved exports retain this session's evidence.

## Search results and product fit

Current web searches covered management software, appointment apps, accounting software, commission calculation, and customer management. Results supplied candidate language and competing page types, not search-volume estimates or a controlled Google Iran ranking study.

- [Nobyta's salon page](https://www.nobyta.ir/for/beauty-salon) combines online appointments, customer records and loyalty tools. It is evidence of competing positioning, not independent evidence of its performance or user demand.
- [Reserve System's use cases](https://www.reservesystem.ir/use-cases) give salons a focused booking workflow and a separate salon page. This supports inspecting a task-specific page rather than putting every phrase into Saluna's homepage.
- [Gisoon's app page](https://gisoonapp.ir/app) uses appointment-app wording. Its visible release history includes old releases; current popularity is unverified.
- [Parmis's salon accounting page](https://www.parmisit.com/products/acconting-software/small-bussiness-solution/hairdressers) addresses accounting needs. Saluna's appointment totals and staff commission do not establish cash collection, expense accounting, or net profit. Broad accounting positioning would create the wrong expectations.

The repository already has a suitable homepage title and three focused feature pages. The hero says `نرم‌افزار مدیریت سالن زیبایی`, and the title also includes `آرایشگاه`. The appointment page explains manager approval, the customer page explains records and follow-up, and the commission page explains percentage agreements and reporting. The work should improve these existing pages before creating competing pages for synonyms.

Sources inspected include `apps/web/src/pages/index.astro`, `apps/web/src/components/landing/prototype/LandingPrototype.astro`, `apps/web/src/content/landing.ts`, `apps/web/src/content/features.ts`, `apps/web/src/pages/services.astro`, and the 2 October SEO audit and implementation record. Direct access to saluna.ir failed through the research fetcher and timed out through a local HTTPS request. Current deployment and published article inventory were therefore not verified. Source observations refer to this checkout.

## Keyword-to-page plan

Priority below reflects evidence, audience fit and existing coverage. It is not a search-volume ranking. Only the exact phrases in the evidence tables above were measured in Trends; the other phrases are candidates to validate.

| Priority     | Search family and candidate wording                                           | Intended page                                                         | Recommended change                                                                                                                                          |
| ------------ | ----------------------------------------------------------------------------- | --------------------------------------------------------------------- | ----------------------------------------------------------------------------------------------------------------------------------------------------------- |
| First        | نوبت دهی آرایشگاه، اپلیکیشن نوبت دهی آرایشگاه، نرم افزار نوبت دهی سالن زیبایی | `/features/online-appointment-requests`                               | Add an owner-focused introduction using salon and barbershop wording, browser/mobile explanation, an example public page, and the manager-approval workflow |
| First        | نرم افزار مدیریت سالن زیبایی، نرم افزار آرایشگاه، برنامه مدیریت سالن زیبایی   | `/`                                                                   | Preserve the existing category title and hero; make the appointment-page link and product demonstration easy to find                                        |
| Next         | محاسبه پورسانت پرسنل سالن، محاسبه درصد آرایشگاه                               | `/features/staff-commission`                                          | Keep the existing worked example; add a question using everyday درصد wording if Search Console supports it                                                  |
| Next         | مدیریت مشتریان سالن زیبایی، پرونده مشتریان آرایشگاه                           | `/features/salon-clients`                                             | Explain moving an existing customer list, finding prior services and choosing follow-up actions                                                             |
| Next         | متن نوبت دهی آرایشگاه زنانه، متن نوبت دهی آرایشگاه برای عید                   | Existing relevant Blog Article or a new reviewed draft                | Give copyable templates with a slot for the salon's public link; explain that an online request needs confirmation                                          |
| Validate     | قیمت نرم افزار مدیریت سالن زیبایی، نرم افزار آرایشگاه رایگان                  | Existing cost FAQ, later pricing page when pricing is defined         | Explain the current trial accurately; do not promise permanent free use or invent plans                                                                     |
| Deprioritize | نرم افزار حسابداری آرایشگاه، حسابداری سالن زیبایی                             | Existing reporting explanation or a clearly scoped comparison article | Explain the limits of appointment and commission reports; avoid presenting Saluna as full accounting software                                               |

Owner and consumer intent overlap in appointment queries. Keep manager language and signup actions on software pages. Searches for booking a particular salon or finding a salon in a city belong to real public Salon pages. Do not create empty city pages to chase that traffic.

## Concrete landing-page and appointment-page brief

The homepage's existing title can stay:

> نرم‌افزار مدیریت سالن زیبایی و آرایشگاه | سالونا

Its hero already covers the category. A candidate revision to the supporting sentence is:

> نوبت‌دهی سالن زیبایی و آرایشگاه، پرونده مشتریان و برنامه پرسنل را یک‌جا مدیریت کنید. مشتری از لینک سالن درخواست نوبت می‌فرستد و شما پس از بررسی زمان و پرسنل آن را تأیید می‌کنید.

Keep the commission explanation in its existing section. Keep the primary action `شروع رایگان نسخه آزمایشی` and its current trial conditions. Add a descriptive link to the existing appointment page near the appointment explanation, for example `نوبت‌دهی آنلاین سالن و آرایشگاه`.

For the appointment page, a candidate title and H1 are:

> نوبت‌دهی آنلاین سالن زیبایی و آرایشگاه | سالونا

> نوبت‌دهی سالن و آرایشگاه با تأیید مدیر

Suggested description:

> با سالونا از لینک سالن درخواست نوبت آنلاین بگیرید. مشتری بدون نصب برنامه درخواست می‌فرستد و مدیر پس از بررسی زمان و پرسنل آن را تأیید می‌کند.

Add a useful question incorporating the observed app phrase naturally:

> برای نوبت‌دهی آرایشگاه باید اپلیکیشن نصب کنیم؟

Answer it with current product behavior: managers use Saluna through the browser on mobile and computer; customers submit requests through the public Salon link. Avoid claiming native app-store availability. Show a reviewed demo using sample data, including the request and approval steps. Do not imply that an unapproved request holds a time slot.

These are proposed copy changes, not rendered or approved production revisions. When implementing, check at 390px and desktop widths, keep one H1, preserve current canonical URLs, and ensure visible FAQs agree with their schema.

## Content opportunities

The strongest new editorial opportunity from this session is appointment-announcement templates. A candidate visible title is `متن نوبت‌دهی برای سالن زیبایی`, with a Persian slug such as `متن-نوبت-دهی-سالن-زیبایی`. Include templates for announcing availability, sharing the online request link, and coordinating another time. Answer the task in the article itself before linking to the product.

An Eid-focused section or later article can address `متن نوبت دهی آرایشگاه برای عید`. The related-query evidence justifies testing that subject, but does not establish when demand peaks. Inspect any existing article first and avoid duplicate content. Future Blog Article drafting must use the saluna-writing skill and public-content rules, including the 50-character visible-title limit, Persian slugs and mobile previews. Production drafts must use the configured draft-only EmDash connection.

Commission calculation and moving a customer list are additional product-relevant subjects. Their demand was not established by Trends in this session. Validate them before making them the bulk of the content schedule.

Google recommends useful, original content for the intended audience. A template people can use, a worked example, or a product demonstration is a better contribution than many near-identical keyword pages. See [Google's content guidance](https://developers.google.com/search/docs/fundamentals/creating-helpful-content).

## Measure the result

1. Establish the deployed page inventory and indexing first. Inspect the existing feature pages, canonical URLs and sitemaps. Check whether the October SEO changes are already live.
2. Export Search Console performance for Iran, Web Search, the latest complete 90 days, by query and page. Separate branded queries from owner software, appointment, commission, customer-management and accounting queries. This report was not accessed in this session.
3. Save impressions, clicks, CTR and average position for each existing target page. Search Console shows demand where Saluna appeared, not the whole market, and omits some queries. Use it to refine wording and page assignments. [Performance report documentation](https://support.google.com/webmasters/answer/7576553?hl=en).
4. Check what conversion measurement exists across saluna.ir and the manager app. Track signup starts, completed signups and an agreed activation event such as creating the first Appointment. Verify source attribution before claiming organic conversions. Search Console alone cannot measure signups, and query-level signup attribution should not be invented.
5. Record publication dates for each change. Review after about six weeks and again after twelve, allowing for low volume and seasonal effects. Compare qualified visits and activated Salons as well as clicks. These are review windows, not ranking guarantees.

The immediate recommendation is to improve the existing appointment page and its homepage link, then prepare one useful announcement-template article after checking existing content. Keep broader page expansion dependent on Search Console evidence and demonstrated product fit.
