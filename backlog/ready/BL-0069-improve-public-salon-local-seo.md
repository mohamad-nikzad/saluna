---
id: BL-0069
title: Improve public Salon pages for local organic search
status: ready
type: improvement
triage: ready-for-agent
priority: high
size: large
created: 2026-07-26
updated: 2026-07-26
---

## Problem Statement

Managers can publish a public Salon page, but Google cannot reliably discover
every published page and the page does not describe the Salon's location or
working hours precisely enough for local organic searches such as “سالن زیبایی
در سعادت‌آباد” or “کاشت ناخن در شیراز”.

Salon Presence currently stores one free-form address. This is useful to a
customer but cannot reliably distinguish province, city, neighborhood, and
street address for visible page copy or `BeautySalon` structured data. Published
Salon URLs are also absent from the generated sitemap.

The manager can currently copy the public URL only from inside the slug editor.
Sharing the published page is therefore easy to miss, and the UI does not help
the manager send it through the phone's share sheet or copy the bare URL for an
Instagram bio or social channel.

## Solution

Let managers add structured province, city, and neighborhood fields alongside
the existing street address. Use those fields, existing Salon Working Days,
working hours, Salon Presence, and visible services to render a locally relevant
public page and complete its `BeautySalon` JSON-LD. Include every active,
published Salon page in a runtime sitemap so Google can discover new Salons
without an application rebuild.

The manager edits normal Salon data, not a separate set of SEO fields. Saluna
derives titles, descriptions, canonical URLs, visible location text, and
structured data from that source of truth.

Once the public page is saved as enabled, give the manager a prominent way to
open it, share it through the device's native share sheet, or copy its canonical
URL for a social bio or channel.

## User Stories

1. As a manager, I want to record my Salon's province, so that search engines and customers know its broad location.
2. As a manager, I want to record my Salon's city, so that my public page can match city-level service searches.
3. As a manager, I want to optionally record my Salon's neighborhood, so that my page can answer more specific local searches.
4. As a manager, I want to keep the existing free-form address for street and landmark directions, so that customers still receive practical directions.
5. As a manager, I want location fields to be editable with the rest of Salon Presence, so that I do not maintain duplicate business information.
6. As a manager, I want existing Salon pages to keep working when the new location fields are empty, so that this change does not unpublish or break them.
7. As a manager, I want a simple indication of missing SEO-relevant Salon data, so that I know which useful details to complete before sharing my page.
8. As a customer, I want to see the Salon's city, neighborhood, address, and working hours on its public page, so that I can decide whether it is relevant and open.
9. As a customer searching Google, I want the result title and description to identify the Salon and its location accurately, so that I can choose the right result.
10. As a customer searching for a service in an area, I want the public page to contain the Salon's real visible services and location, so that the result matches my intent.
11. As Google, I want every active, published Salon URL listed in a sitemap, so that pages do not depend only on external links for discovery.
12. As Google, I want one stable canonical URL for each Salon page, so that query parameters do not create duplicate canonical URLs.
13. As Google, I want `BeautySalon` structured data with a `PostalAddress`, telephone, URL, opening hours, social profiles, and visible service offers, so that the page describes the same business information customers can see.
14. As Saluna, I want disabled, setup, suspended, and archived Salons excluded from the sitemap and public SEO output, so that private or unavailable Salon pages are not advertised for indexing.
15. As Saluna, I want SEO metadata derived from trusted Salon fields, so that managers do not need keyword, title, or schema editors.
16. As a newly published Salon, I want my public URL to enter the sitemap automatically, so that daily Salon creation does not require a deployment or scheduled job.
17. As a manager who disables a public page, I want its URL removed from the sitemap automatically, so that the sitemap reflects current publication state.
18. As a manager, I want the published public-page URL visible without opening the slug editor, so that I can find it quickly.
19. As a manager on a phone, I want to use the native share sheet, so that I can send my public Salon page through any installed social or messaging app.
20. As a manager, I want to copy only the canonical URL, so that I can paste it into my Instagram bio or social-channel profile.
21. As a manager, I want to open the public page from the manager app, so that I can verify what customers will see before sharing it.
22. As a manager, I want clear confirmation when the link is copied and a useful error when sharing or copying fails, so that I know whether the action worked.
23. As a manager whose public page is disabled or not yet saved as enabled, I want the sharing controls to explain that I must publish first, so that I do not share a URL that returns 404.
24. As a manager on a browser without native sharing support, I want Share to fall back to copying the URL, so that the main action still works.

## Implementation Decisions

- Extend Salon Presence with nullable `province`, `city`, and `neighborhood`
  fields. Keep `address` as the street address/directions field and keep
  `addressCountry` fixed to `IR`; do not add a country selector.
- Add the three fields to the existing manager and Assisted Salon Setup
  Presence forms, validation, persistence, API schemas, and generated client.
- Treat the fields as optional during migration and publishing. Do not break
  existing public pages. The manager UI should show a compact completeness hint
  when a published Salon is missing province, city, address, phone, bio, or
  visible services.
- Expose structured location and existing Salon Working Days and working hours
  through the public Salon read model. Do not create separate SEO-owned copies.
- Render province, city, neighborhood, street address, and working hours as
  ordinary visible public-page content.
- Derive the page title from Salon name and city, adding neighborhood when
  available. Derive the description from the manager's bio when present and
  otherwise from Salon name, visible services, and locality. Do not add editable
  SEO title, SEO description, or keyword fields.
- Build the canonical URL from the public origin and Salon slug only. Strip
  query strings and fragments.
- Emit `BeautySalon` JSON-LD with `PostalAddress`: existing `address` maps to
  `streetAddress`, city to `addressLocality`, province to `addressRegion`, and
  `IR` to `addressCountry`. Include `openingHoursSpecification` from Salon
  Working Days and working hours, plus the existing telephone, URL, social
  profiles, and visible service offers.
- Omit optional JSON-LD properties when their source data is absent. Do not
  invent locality, coordinates, ratings, or opening hours.
- Add one unauthenticated read that returns only the slugs of Salons where the
  Salon status is `active` and public-page `enabled` is true.
- Serve `/salons-sitemap.xml` as a runtime server route rather than a build
  artifact. On each cache miss, it reads the current eligible slugs and returns
  an XML sitemap containing their absolute canonical `/salons/{slug}` URLs.
- Return
  `Cache-Control: public, s-maxage=86400, stale-while-revalidate=3600` from the
  runtime sitemap. Publishing or disabling a Salon may therefore take about one
  day to appear in the sitemap; no instant cache purge is required.
- Keep the existing generated sitemap for static marketing pages. Add both the
  existing sitemap index and `/salons-sitemap.xml` as separate `Sitemap` entries
  in `robots.txt`; do not modify Astro's generated sitemap index.
- Do not persist sitemap rows or introduce a cron job, queue, publish hook, or
  application rebuild. The database publication state remains the source of
  truth.
- A Salon becomes eligible for the Salon sitemap when it is active and its
  public page is enabled; incomplete optional SEO fields do not exclude it.
- Keep the public Salon explorer in BL-0020 separate. This work makes pages
  discoverable without requiring a directory or filters.
- Add `noindex, nofollow` metadata to token-bearing AppointmentRequest status
  pages. Only public Salon landing pages belong in search results.
- Add a prominent public-page sharing card near the publication status. Show
  the canonical URL and actions to share, copy the URL, and open the public page;
  do not hide these actions inside the slug editor.
- Make Share call the browser's native Web Share API with the Salon name, a
  short Persian invitation to view services and submit an AppointmentRequest,
  and the canonical public URL. Treat the manager cancelling the native share
  sheet as neither success nor error.
- When native sharing is unavailable, make Share copy the canonical URL and
  show the same successful-copy feedback as the dedicated Copy link action.
- Copy link must copy the bare canonical URL, not promotional text, so it can be
  pasted directly into an Instagram bio or social-channel profile.
- Open public page must open the canonical URL in a new browser context without
  changing the manager app's current state.
- Enable sharing actions only when the last saved public-page state is enabled.
  If the manager has toggled the page on but not saved it, explain that it must
  be published first.
- Reuse the existing public URL builder and clipboard behavior. Do not add a
  share library or provider-specific SDK.

## Testing Decisions

- Use the existing public-web smoke script as the highest test seam. Given one
  active Salon with an enabled public page and complete Salon Presence, verify:
  the Salon sitemap contains its canonical URL; the rendered page contains its
  locality and working hours; its canonical URL has no query string; and its
  `BeautySalon` JSON-LD contains `PostalAddress` and
  `openingHoursSpecification`.
- In the same smoke path, verify a disabled or inactive Salon is absent from the
  Salon sitemap and remains unavailable publicly. Verify that enabling a Salon
  makes it appear on the next uncached sitemap response without rebuilding the
  web application.
- Verify the runtime sitemap response is valid XML and carries the specified
  cache policy, and that `robots.txt` references both static and Salon
  sitemaps.
- Extend the existing public database/API tests to verify that structured
  location and Salon hours are returned only through the public Salon read
  model and that sitemap candidates enforce the active-and-enabled gate.
- Extend existing Salon Presence validation tests for trimming, nullable
  values, and reasonable length limits on province, city, and neighborhood.
- Verify token-bearing AppointmentRequest status pages emit robots `noindex`
  and `nofollow` directives.
- Add one authenticated browser test for the manager sharing card. Verify a
  saved enabled page exposes its canonical URL, invokes native sharing with the
  expected title, text, and URL, copies the bare URL, and opens the public page.
- In the same browser test, verify a disabled or not-yet-published page cannot
  be shared, native-share cancellation stays quiet, and lack of native sharing
  falls back to copying with visible confirmation.
- Test externally visible HTML, HTTP responses, and API contracts rather than
  internal helper call sequences. Do not add an SEO-specific test framework.

## Out of Scope

- Google Business Profile or Google Maps management.
- Ranking guarantees, paid search, or automatic Search Console submission.
- Reviews, ratings, testimonials, or review structured data.
- Salon photos, galleries, logos, video, or image sitemaps.
- Separate landing pages for every service, city, or neighborhood.
- Manager-entered keywords, SEO titles, schema markup, or arbitrary metadata.
- A public Salon directory, search, or filters; that remains BL-0020.
- Latitude/longitude extraction from third-party map links.
- Multiple Salon locations under one Salon.
- Cron-based sitemap generation, sitemap persistence, publish-time queues, or
  web application rebuilds.
- Splitting the Salon sitemap before the published Salon count approaches the
  50,000-URL sitemap limit.
- Direct integrations with Instagram, Telegram, WhatsApp, or other social
  providers; the native share sheet already covers installed apps.
- QR codes, downloadable promotional images, link shorteners, UTM campaign
  builders, click analytics, or per-channel share tracking.

## Further Notes

- This targets organic Google Search. Google Maps and Google Business Profile
  are explicitly unrelated to the outcome.
- Google treats `address` and `name` as required Local Business structured-data
  properties and recommends complete location and opening-hours information.
- A sitemap helps discovery but does not guarantee crawling, indexing, or
  ranking.
- If the number of published Salons approaches 50,000, replace the single
  runtime sitemap with a paginated sitemap index. Do not build that complexity
  before the limit is relevant.
- Useful validation tools after deployment are Google Search Console URL
  Inspection and the Rich Results Test.

## Subtasks

- [BL-0070 Capture structured Salon Presence location](../done/BL-0070-capture-structured-salon-location.md) — done
- [BL-0071 Publish local Salon details and structured data](../done/BL-0071-publish-local-salon-details-and-structured-data.md) — done
- [BL-0072 Discover published Salons through a runtime sitemap](BL-0072-discover-published-salons-through-runtime-sitemap.md) — blocked by none
- [BL-0073 Keep AppointmentRequest status pages out of search](BL-0073-keep-appointment-request-status-pages-out-of-search.md) — blocked by none
- [BL-0074 Help managers complete and share their public page](BL-0074-help-managers-complete-and-share-public-page.md) — blocked by BL-0070
- [BL-0075 Prove the complete local-search journey](BL-0075-prove-complete-local-search-journey.md) — blocked by BL-0071, BL-0072, BL-0073, and BL-0074
