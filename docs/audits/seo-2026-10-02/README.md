# Saluna SEO and reachability audit

Audited on 2 October 2026 against the deployed site, Google search UI, repository sources, and current Google documentation. This is an audit and implementation proposal. No production changes were made.

The [implementation record](./implementation.md) describes the fixes made after this audit, their verification, and outstanding deployment and owner checks. The production snapshots below retain the original observations.

## Assessment

Saluna is reachable and the inspected homepage is indexed. The main opportunity is to give Google and prospective salon owners more useful pages about the actual product. A homepage, a brief services page, and legal/company pages leave many relevant searches without a focused answer.

The age of the domain does not establish eligibility for a particular ranking. Indexing means a page can compete in search. It does not establish that it is the strongest answer to a service query. Your Search Console screenshot confirms indexing for the inspected URL. Its processing message concerns report availability and does not contradict that status. See [URL Inspection](https://support.google.com/webmasters/answer/9012289?hl=en) and [Search Console property setup](https://support.google.com/webmasters/answer/9008080?hl=en).

I would spend the next development cycle on three focused product pages, links to those pages, and the small technical repairs below. I would not buy an indexing service or spend the cycle adding more schema types.

## Evidence and limits

The reproducible [check script](./check_live.py) checked 23 URLs, including all 12 URLs advertised by the sitemaps, domain variants, application robots/indexing metadata, and missing routes. [Live evidence](./evidence.json) includes HTTP results, redirects, canonical URLs, page text, links, and structured data. [Asset evidence](./asset-evidence.json) records asset status and transfer size. [Initial evidence](./initial-evidence.json) retains first-run failures rather than hiding them.

Run from the repository root with Python and curl installed:

```powershell
python docs/audits/seo-2026-10-02/check_live.py
```

The script performs public GET requests and overwrites its evidence snapshot. It does not sign in, request Google indexing, or modify the website. A successful run records observations; it is not a declaration that every endpoint passed.

Independent Check-host probes returned the following homepage responses. [Public probe report](https://check-host.net/check-report/4e98b37ckab1), [saved results](./regional-results.json), and [API documentation](https://check-host.net/about/api).

| Probe location | Status | Probe response time |
| --- | --- | --- |
| Tehran, Iran | 200 | 0.23 seconds |
| Nuremberg, Germany | 200 | 0.46 seconds |
| Los Angeles, United States | 200 | 1.25 seconds |

These are successful observations at one time, not an uptime history or browser loading measurements. Some initial local DNS attempts failed and later retries succeeded. Failure through one research tool does not demonstrate a global outage.

The Google UI showed no Saluna result on the first page for `نرم افزار مدیریت سالن زیبایی` in this session. Results included product pages from Sisno and Maxel and several software comparison/accounting articles. This is one search observation, not a universal rank or a keyword-volume estimate. Your observation that `سالونا` appears second establishes useful brand discovery in your session. Earlier `site:saluna.ir` testing also returned the homepage with a generic globe. A site query is not an exhaustive indexing inventory.

I did not access your authenticated Search Console reports, origin/CDN logs, a historical uptime dataset, or a backlink index. The PageSpeed API returned 403 to the audit client, so this report does not claim a Lighthouse score or measured Core Web Vitals. Googlebot user-agent checks succeeded, but spoofing that string does not verify access from actual Google IP addresses.

## What already works

- All 12 sitemap-listed pages returned 200 and supplied readable HTML without a public-page `noindex` directive.
- The homepage has a relevant Persian title and description, HTTPS, `lang="fa"`, RTL direction, and a canonical URL. Its title already names salon management software.
- Public salon pages provide server-rendered services, prices, location data when supplied, canonical URLs, and `BeautySalon` metadata.
- Main-site robots and sitemap endpoints work. The application sign-in page has `noindex,nofollow`, which is appropriate for a page with no public search value.
- Tested nonexistent routes return real 404 responses. They do not return a misleading successful homepage.
- Fonts and sampled homepage images/styles load successfully. Fonts are self-hosted; static compiled resources have long cache lifetimes.

The tested crawl prerequisites are sound. Further investigation should use Search Console's actual crawl/index reports rather than assume that adding metadata resolves a crawl block. See [Google's technical requirements](https://developers.google.com/search/docs/essentials/technical).

## Work in priority order

The order considers search growth, user value, and repair cost. It does not imply that every finding currently causes a ranking loss.

| Order | Finding | Practical change | Completion evidence |
| --- | --- | --- | --- |
| 1 | One broad landing page covers several different buyer needs | Publish the first three product pages in the query map below, with real screenshots and accurate workflows | Each page answers its target need, returns readable HTML, has a unique title/canonical, receives homepage links, and appears in the sitemap |
| 2 | Homepage has no links to other main-site content pages | Add a small footer for services, about, contact, terms, privacy, and product pages; add contextual links from feature sections | Follow ordinary HTML links from the homepage to every important public page |
| 3 | Homepage sharing image repeatedly returns 500 | Fix `/og/landing.png`; prefer a static generated image or bundle its font as the working salon image endpoint does | Public GET returns 200 and a valid image after a production build; inspect an actual sharing preview |
| 4 | Brand result uses a generic globe despite reachable icon files | Use a stable, explicit primary icon larger than 48 pixels, reusing the existing square 180-pixel image if suitable; verify real crawler access | Rendered homepage declares the intended icon; URL returns a valid image; request homepage recrawl once and observe later results |
| 5 | Salon structured data has a currency mismatch | Normalize the price unit at the schema boundary | A visible 550,000 تومان price becomes 5,500,000 IRR in JSON-LD after confirming the storage unit |
| 6 | Small header mark transfers 648,352 bytes | Serve an appropriately sized compressed asset or existing vector, with explicit dimensions | Inspect mobile network transfer and layout; aim for under 10 KB for this particular small mark |
| 7 | Domain/slash variants remain separately accessible | Redirect www to apex; align each route's links, canonical, redirects, and sitemap slash policy | Each alternate URL redirects to the chosen URL and preserves path/query |
| 8 | FAQ metadata describes old copy; salon HTML duplicates hidden and visible headings | Remove obsolete FAQ schema or derive it from the visible FAQ; consolidate salon HTML into one semantic structure | Compare deployed JSON-LD with visible copy; inspect salon accessibility and heading structure |
| 9 | Some published salon names look like internal test data | Review ownership and purpose; exclude confirmed internal/demo pages from indexing and sitemaps | Owner confirms classification; actual public salons retain their intended publication behavior |

### Content and navigation

The homepage H1 is `هماهنگی کمتر؛ مدیریت منظم‌تر`. Keep the slogan if it works for visitors, but put the product category prominently in the visible heading or adjacent introductory text. A proposed H1 is `نرم‌افزار مدیریت سالن زیبایی و نوبت‌دهی سالونا`. This clarifies the offer; changing an H1 alone is not a ranking guarantee.

The current `/services/` page has only about 159 space-separated words including navigation. Its issue is limited explanation, not failure to meet a word-count threshold. Explain the workflows a buyer needs to evaluate, show the product, and link to the relevant detailed pages. Update any older service-group terminology to the current domain model while revising the copy.

Use descriptive links such as `مدیریت درخواست نوبت آنلاین` from the relevant homepage section. Add visible breadcrumbs or a modest product attribution link on public salon pages where it helps visitors. Existing breadcrumb schema does not create a usable navigation link. See [crawlable link guidance](https://developers.google.com/search/docs/crawling-indexing/links-crawlable).

### Brand, icon, and schema

The declared 32-pixel PNG, existing 180-pixel apple-touch icon, and ICO are reachable. There is no proven broken-icon download. Google's current minimum is a square 8-pixel image, with a recommendation to use an image larger than 48 pixels. The 32-pixel icon is therefore not automatically invalid. A larger primary declaration is a practical improvement. Keep its URL stable, allow Googlebot and Googlebot-Image, request a homepage recrawl after changes, and allow time. Google does not guarantee display. See [favicon requirements](https://developers.google.com/search/docs/appearance/favicon-in-search).

Add homepage `WebSite` markup with `name: سالونا`, genuine alternative names such as `Saluna`, and the canonical homepage URL. Expand the existing company metadata with a genuine logo and official profile URLs, using a consistent identity. These help Google interpret the site/company; they do not replace the favicon declaration. See [site names](https://developers.google.com/search/docs/appearance/site-names) and [Organization guidance](https://developers.google.com/search/docs/appearance/structured-data/organization).

The homepage's FAQ schema comes from `src/content/landing.ts`, while visible questions come from `LandingPrototype.astro`. Four of five schema questions are absent from the body and none of the five answer strings match exactly. They are separate datasets, not simply different formatting. Fix the drift, but do not prioritize FAQ markup as a rich-result tactic. Google discontinued FAQ rich results starting 7 May 2026. See [the official documentation changelog](https://developers.google.com/search/updates).

Existing `SoftwareApplication` markup omits offer price and review/rating information required for Google's software rich result. It can still describe the application. Only add fields grounded in real, visible facts; do not invent reviews or a permanent zero price. See [software app requirements](https://developers.google.com/search/docs/appearance/structured-data/software-app) and [structured-data policies](https://developers.google.com/search/docs/appearance/structured-data/sd-policies).

### Confirmed bugs and implementation clues

`/og/landing.png` failed repeatedly with 500. `/og/mehrnanail.png` returned 200. The homepage endpoint reads a font through a runtime filesystem path; the salon endpoint bundles its font with an inline import. The runtime Docker image copies the built distribution. This makes a missing bundled font a plausible cause, but production logs or a container reproduction must establish the cause. A static homepage preview avoids this runtime dependency. The sharing image is separate from the small search-result icon.

On Mehrna's page, `ترمیم ژلیکس` visibly costs 550,000 تومان, while JSON-LD says `price: 550000` and `priceCurrency: IRR`. `seo.ts` emits the same raw value that `format.ts` displays as تومان. Confirm the authoritative storage unit, then convert tomans to rials for IRR metadata. Do not multiply the stored product price itself.

The www homepage returns 200 with an apex canonical, rather than redirecting to apex. `/about` and `/about/` both return 200, canonical points to `/about`, and the sitemap lists `/about/`. Existing canonical tags already help consolidate these variants. Aligning redirects, links, and sitemaps removes ambiguity; it is not evidence of a duplicate-content penalty. See [canonical consolidation guidance](https://developers.google.com/search/docs/crawling-indexing/consolidate-duplicate-urls).

The Mehrna HTML contains two H1s and duplicate service text because a hidden `SalonShell` accompanies the server-rendered visible component. Consolidate it for semantic clarity and accessibility. Multiple H1s alone are not a demonstrated penalty, and duplicated matching content is not proof of cloaking.

### Performance and reachability

The header mark is roughly 633 KiB despite being displayed around 40 to 44 CSS pixels. This is the clearest measured asset saving. The under-10-KB target above is an engineering budget, not a Google eligibility threshold.

The homepage preloads six font files totaling 165,216 bytes. Check which weights/subsets the initial view needs before reducing preloads. Calendar, today, and dashboard screenshots are all eager. Keep above-the-fold/LCP content eager and defer genuinely offscreen screenshots. Desktop and mobile hero assets use separate image elements; confirm in the browser waterfall whether both download, then use responsive image selection if needed. See [LCP optimization](https://web.dev/articles/optimize-lcp) and [browser image lazy loading](https://web.dev/articles/browser-level-image-lazy-loading).

Measure mobile loading before and after changes. Google's good field thresholds at the 75th percentile are LCP at most 2.5 seconds, INP at most 200 ms, and CLS at most 0.1. These are targets, not this site's measured results. See [Core Web Vitals guidance](https://developers.google.com/search/docs/appearance/core-web-vitals).

For ongoing reachability, monitor the homepage from an Iranian and an international location, plus robots, sitemap, and the OG endpoint. Review CDN/origin 403, 429, and 5xx responses for verified Google crawlers. Verify IP ownership through Google's documented DNS or IP-range methods; a user-agent string is not authentication. See [verifying Google requests](https://developers.google.com/crawling/docs/crawlers-fetchers/verify-google-requests).

## Pages that can bring relevant visitors

These are suggested query families based on product fit and observed search intent. Search volume and difficulty have not been measured. Avoid creating several pages for spelling variants of the same need. Write natural Persian and cover related wording in one useful page.

| Publish order | Suggested page | Persian query family | What makes it useful |
| --- | --- | --- | --- |
| First | `/features/online-appointment-requests/` | نوبت دهی آنلاین سالن زیبایی، رزرو آنلاین آرایشگاه | Show the public salon page, customer request, manager review, staff selection, and confirmed appointment. Explain that a request needs manager approval |
| First | `/features/salon-clients/` | نرم افزار مدیریت مشتریان سالن زیبایی، پیگیری مشتریان سالن | Show client notes, tags, appointment history, and actual follow-up workflows. Separate shipped behavior from planned automation |
| First | `/features/staff-commission/` | محاسبه پورسانت پرسنل سالن زیبایی، نرم افزار پورسانت آرایشگاه | Explain agreements, service overrides, completed work, and reporting with an example. Do not call retained appointment value collected cash or profit |
| Next | `/features/staff-scheduling/` | برنامه ریزی پرسنل سالن زیبایی، تقویم نوبت دهی آرایشگاه | Demonstrate working hours, staff capabilities, conflicts, personal schedules, and Jalali operation |
| Next | `/guides/approve-appointment-request/` | آموزش ثبت و تایید نوبت سالن، مدیریت نوبت در بله | Maintain actual steps, screenshots, an optional short video and transcript, and a last-reviewed date |
| Next | `/blog/calculate-salon-staff-commission/` | نحوه محاسبه پورسانت آرایشگاه، درصد پورسانت پرسنل سالن | Answer the business question with worked examples and link naturally to the product page |
| Later | `/solutions/nail-salons/` | نرم افزار مدیریت سالن ناخن | Publish only if there are distinct nail-salon workflows, examples, and evidence beyond swapping the industry name |

Homepage category focus should remain salon management software. The query I checked also brought up full accounting software. Saluna's appointment and commission reporting should be described accurately, rather than marketed as full accounting/POS functionality to chase that adjacent traffic.

Each first-wave page should include the problem, who it serves, a real screenshot, the actual sequence of work, limitations, a realistic example, visible FAQs, a relevant guide link, and a clear trial/demo action. One complete page is preferable to many generic AI-written articles. Google's [helpful-content guidance](https://developers.google.com/search/docs/fundamentals/creating-helpful-content) supports original information and answering users' needs; it does not set a required word count.

Editorial content already has an agreed implementation in [ADR-0040](../../adr/0040-emdash-for-public-content.md), tracked by [BL-0087](../../../backlog/inbox/BL-0087-publish-blog-and-product-guides-with-emdash.md). Use EmDash within the existing Astro site for Blog Articles and Product Guides. Both live indexes currently return 404 because that work has not shipped. A few maintained product pages can use existing Astro routes while editorial publishing is built, without introducing a second CMS or blog domain.

Keep commercial copy consistent with the offer actually available to visitors. The live landing currently says free testing with plans coming later; domain documents describe a future subscription/trial model. Confirm launch status before adding a pricing page or promising a specific trial duration. A transparent current offer is useful; an invented future price is not.

## Practical discovery tactics

1. Publish one detailed case study with a participating salon's permission. Show an actual workflow before and after adopting Saluna. Use measured numbers only when available, and keep client/private operational data out of the example.
2. Publish short Persian demonstrations of approval in Bale, staff scheduling, and commission reporting. Put the matching product-page link in the public description and put a readable explanation on your own page. Videos can support discovery and product understanding even if no video rich result appears.
3. Work with relevant salon educators and genuine industry publications on useful examples or training material. Seek editorial mentions from people who have actually used the product. A link that reaches salon owners has business value independently of a ranking effect.
4. Let real salons complete their own public information: name, location, hours, phone where appropriate, service descriptions, and actual images. Preserve the owner-controlled page model. This can help those salons answer their local customers' queries and introduces Saluna through the product, without turning it into a consumer marketplace.
5. Once Search Console has data, improve existing pages getting relevant impressions before generating another batch of articles. Queries around average positions 8 to 30 can be a useful editorial shortlist, not a promise that every such query is easy to win.

The sitemap currently includes names such as `تستاسترون کده`, `تستاسترون لند`, and `سالن ممد`. Names alone cannot establish that these are disposable test salons. Review them with the owner. If confirmed internal/demo, keep their access as needed but remove them from indexing/sitemaps through an explicit classification. Do not blanket-exclude real salons with sparse data, and preserve read-only public pages required by the existing subscription policy.

Several common shortcuts do not fit this project:

- Google Business Profile currently does not support businesses in Iran. Standard advice to create one cannot be the foundation of this plan. See [Google's supported countries](https://support.google.com/business/answer/6270107?hl=en-CA).
- The Indexing API is limited to qualifying job posting and livestream pages. It is not a faster indexing API for ordinary Saluna pages. See [official API scope](https://developers.google.com/search/apis/indexing-api/v3/quickstart).
- Paid ranking links, fabricated ratings, compulsory keyword backlinks, and dozens of cloned city pages are poor substitutes for useful pages and genuine references. Google documents the relevant restrictions in its [spam policies](https://developers.google.com/search/docs/essentials/spam-policies).
- Repeated indexing requests, changing dates without material updates, or adding an `llms.txt` file do not solve this content gap. Sitemap `lastmod` should reflect meaningful changes. See [sitemap guidance](https://developers.google.com/search/docs/crawling-indexing/sitemaps/build-sitemap) and Google's June 2026 clarification on `llms.txt` in its [documentation updates](https://developers.google.com/search/updates).

## Delivery and measurement plan

| Period | Deliverable | Measure |
| --- | --- | --- |
| Days 1 to 7 | Repair OG and price schema, reduce header image, declare larger stable icon, connect existing public pages, decide redirect policy | Live response/image checks, deployed schema comparison, navigation crawl, browser transfer size |
| Days 8 to 21 | Publish the three first-wave product pages, clarify visible homepage category, record one accurate product demo | Crawlable/indexable pages, sitemap inclusion, useful content review, successful signup/demo path |
| Days 22 to 45 | Publish first reviewed guide/article using the agreed content workflow, add a real case study or relevant editorial mention | Relevant non-brand impressions, clicks, landing pages, signup/demo conversions |
| After enough data accumulates | Compare equivalent 28-day periods and improve pages with meaningful query impressions | Separate branded/non-branded performance; assess Iran traffic and mobile traffic separately |

In Search Console, submit the sitemap index once, inspect the homepage and each new important page, and review Google's chosen canonical and rendered content. Request indexing after publication or substantial repairs, then use the reports to diagnose actual exclusions. A submitted sitemap is a discovery aid, not a ranking instruction. See [Search Console workflow](https://developers.google.com/search/docs/monitor-debug/search-console-start).

Use a brand filter covering `سالونا`, `saluna`, and `saluna.ir`, and compare its complement for non-brand queries. Keep a small weekly table of query family, landing page, impressions, clicks, CTR, and average position. Position varies with query, location, device, and result layout; treat trends as evidence rather than a universal rank. Measure successful signups or demo requests as well, without sending client names, phone numbers, or appointment details to analytics.

Do not judge the work solely by favicon appearance or a broad keyword's first-page position. Early success is that the new pages are discovered and indexed, relevant non-brand impressions grow, and visitors complete a useful product action. Ranking improvement timing remains unproven until those reports accumulate.

## Source locations for implementation

| Concern | Repository files |
| --- | --- |
| Visible landing/navigation/FAQ/image markup | `apps/web/src/components/landing/prototype/LandingPrototype.astro` |
| Homepage metadata and old FAQ dataset | `apps/web/src/pages/index.astro`, `apps/web/src/content/landing.ts` |
| Icon declarations and font preloads | `apps/web/src/layouts/Base.astro` |
| Homepage OG runtime font dependency | `apps/web/src/pages/og/landing.png.ts`, `apps/web/Dockerfile` |
| Working bundled-font example | `apps/web/src/pages/og/[slug].png.ts` |
| Currency serialization and visible formatting | `apps/web/src/lib/seo.ts`, `apps/web/src/lib/format.ts` |
| Duplicate salon shell | `apps/web/src/components/SalonShell.astro`, `apps/web/src/pages/salons/[slug]/index.astro` |
| Sitemap/slash/domain behavior | `apps/web/astro.config.mjs`, `apps/web/src/pages/salons-sitemap.xml.ts`, `deploy/nginx/templates/saluna.conf.template` |
| Product/commercial boundaries | `CONTEXT.md`, `docs/adr/0019-salon-funded-saas.md`, `docs/adr/0035-read-only-salons-keep-public-presence-without-intake.md`, `docs/adr/0040-emdash-for-public-content.md` |

Production behavior and its saved evidence take precedence over assumptions from source files.
