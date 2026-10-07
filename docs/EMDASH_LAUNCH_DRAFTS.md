# First Blog Article batch

BL-0099 delivered three Persian articles to the retained Mac CMS on
`http://localhost:3301` on 2026-10-07. All are unscheduled, unpublished drafts
owned by the dedicated Author connection. They use the default `تیم سالونا`
credit, rich text headings and lists, revisioned search titles/descriptions,
and a relevant body signup link alongside the shared article signup action.
No cover image is needed; all three use the existing branded social fallback.

| Subject                        | Native CMS ID                | Stable slug                           |
| ------------------------------ | ---------------------------- | ------------------------------------- |
| Staff Commission calculations  | `01M4C0D1WG6EG71VPJJ3VWE6XQ` | `salon-staff-commission-calculation`  |
| Organizing AppointmentRequests | `01M4C0D1YXHAFADZRGKNYENZDX` | `organize-salon-appointment-requests` |
| Useful Client records          | `01M4C0D2127FPRX3PNX2A2CE0D` | `useful-salon-client-records`         |

[The article manifest](../content/blog-launch/articles.json) records titles,
summaries, search fields, body files, and claim sources. The Markdown files
are the delivered editorial source; native MCP converted their bodies to
Portable Text. [The delivery record](../content/blog-launch/delivery.json)
preserves the original CMS identities independently of expiring preview links.
The current native CMS draft is what an editor should reopen and edit.

## Source review

Claims were checked against integration revision
`b0dcee33f739e67e88ec51bfa4085e4d58dcf562`. Before creation, the supported
connection read all four existing articles: three technical proof drafts and
one published recovery article. Their title, summary, and body did not overlap
the three launch subjects. The first batch adds exactly three entries; those
technical proof entries do not belong to this batch.

The commission article uses `GLOSSARY.md`, current commission arithmetic,
completion queries, and package-basis queries. Its independent examples give
400,000 commission and 600,000 retained for a single provider; 240,000 and
120,000 commission with 640,000 retained for a 60/40 work split; 300,000 when
a 50% service override replaces 40% on a 600,000 basis; and 320,000 on the
800,000 allocated first task of a 1,200,000 package. All amounts are tomans.
It distinguishes booked amounts from collected Client Payments and net profit,
and explains retained earned percentages and the absence of automatic backfill.

The request article follows ADR-0001, ADR-0014, current request timing rules,
and the requests screen. Proposals remain off-calendar without reserving
availability. Approval validates current conditions again. Flexible requests
use the existing fixed start-time bands and inclusive 90-day horizon, rather
than arbitrary time windows. Its scenario is an illustrative example.

The client article follows the required name/phone form, current drawer and
profile, import preview and duplicate-contact flow, retention UI and birthday
calculation. The profile source confirms favorite-service, cancellation and
no-show summaries. The birthday source confirms complete optional Jalali
dates, 29 Esfand recurrence in non-leap years, and the seven-day action window
on either side. Imports do not bring birth dates into this release. The article
does not promise automatic messages.

Signup uses the established `https://app.saluna.ir/signup` destination from
`apps/web/src/content/landing.ts`. The current PWA signup route redirects
unauthenticated visitors to phone authentication at `/auth`. The preview checks
verify both body and shared signup links. A separate live-host request timed
out during this local delivery; it did not change the source-confirmed route.

## Private delivery and renewal

The protected operator directory contains `launch-batch.json`, with one signed
preview URL and expiry for each of the IDs above. `launch-preview-links.md`
delivers the three clickable links with Persian titles. Signed URLs and credentials
are excluded from Git and console output. The three links were opened through
a real native Editor session and displayed the saved articles in Saluna's
design. A copied anonymous link returns 403. Ordinary details return 404;
the public index and runtime blog sitemap omit all three drafts.

From the integration checkout, renew delivery with the same dedicated Author:

```sh
node scripts/deliver-launch-drafts.mjs /absolute/private/operator-directory
PLAYWRIGHT_CHROMIUM_EXECUTABLE_PATH=/absolute/path/to/chromium node deploy/cms/launch-drafts.browser.mjs /absolute/private/operator-directory
```

The command reconciles the recorded IDs, checks ownership and unpublished state,
and saves fresh private preview links. It cannot create replacement articles,
overwrite saved editor changes, publish, schedule, or withdraw content. If the
private ledger is absent, the checked-in delivery IDs restore the link mapping.
A missing, renamed, published, scheduled, or reassigned entry requires an
explicit operator decision; it is never silently replaced. Run one process at
a time against this original retained CMS copy.

The browser proof checks saved rich text, the worked examples and key product
distinctions, native Editor reopening, search metadata, default credit, body
and shared signup actions, branded social response, preview privacy, and public
absence. Its screenshots and failure screenshot remain in the private directory.
No content publication, second-person approval, or routine is needed for this
delivery. The intended writer's physical passkey and end-of-work trial remain
pending. Renew the three expiring links immediately before that final handoff.
