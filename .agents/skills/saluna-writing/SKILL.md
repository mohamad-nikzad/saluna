---
name: saluna-writing
description: Write and revise unpublished Persian Saluna Blog Articles from current product sources for prospective Salon Owners.
---

# Saluna writing

Write useful Persian articles for prospective Salon Owners. Help readers solve a
salon-management problem and understand whether Saluna fits their work. Use
concrete examples, readable RTL paragraphs and descriptive headings. Avoid hype,
invented customer stories, unsupported promises, and developer terminology.

Allowed subjects are Staff Commission calculations, organizing
AppointmentRequests, useful Client records, and staff scheduling. A Blog Article
is editorial advice; a Product Guide is maintained instructions for one task.
Use the canonical domain terms from the repository's root GLOSSARY.md.

## Check sources and overlap

Before choosing a topic, run the configured local Studio command `inventory`.
It reads native EmDash MCP with cursor pagination and includes published articles
and drafts. Read an overlapping article by ID when its title/summary is not
enough. Choose a distinct useful angle; existing unreviewed or unpublished drafts
do not block a new distinct draft.

Run `sources SUBJECT` before writing. Supported subjects are `staff-commission`,
`appointment-requests`, `client-records`, and `staff-scheduling`. This returns
current checked-in glossary, public signup/pricing copy, article model and the
subject's UI/domain/ADR sources, with source commit and hashes. The path map is
`content/blog-writing/sources.json`. Re-read current source content each run,
record the paths/commit consulted, and validate every product claim. Historical
notes and prior drafts are not substitutes for current behavior.

For scheduling, distinguish recurring Staff Profile availability, Salon Working
Days and date-specific Salon Closures. Appointments must fit the applicable
start/end hours. Staff schedules do not optimize shifts, record attendance,
calculate payroll or automatically move existing Appointments. For commissions,
separate Work Allocation from Commission Agreement percentages and collected
Client Payments. Give worked amounts in integer tomans, consistent with current
booked-price and rounding behavior. Never promise automatic birthday messages,
imported birth dates, arbitrary flexible-request windows or a fixed free Trial
duration without a current source that proves it.

## Article contract

Prepare a complete Persian title, stable explicit slug, useful summary and full
Portable Text `body` with headings and paragraphs. Fill revisioned `seo_title`
and `seo_description`; leave `search_excluded` false. Do not write native legacy
SEO or native account-linked Bylines. An empty public-author selection defaults
to `تیم سالونا`, independently of the writing account. Named public profiles
are an explicit later editorial choice.

Include a relevant signup invitation using the current public site's `/signup`
destination on the configured manager origin. The public template already has
the shared signup action; a contextual body link may use the same destination.
Do not invent attribution tags or an authentication query mode.

Cover and inline images are optional. A cover-free article uses the existing
Saluna-branded social image. For media proof or a useful illustration, upload an
existing approved image with truthful Persian alt/caption and read it back.
Do not call a branded illustration an actual product screenshot. Preserve the
native upload-returned URL, not a guessed bare media-ID route. Inline images use
Portable Text `asset._ref` and `asset.url`; a cover uses its native provider/id.
No mandatory image generator or external vendor is required.

## Draft-only native delivery

Use only the configured Mac-local Studio wrapper around native EmDash 1.1.0 MCP
and its native preview REST adjunct. Credentials stay in protected Mac files;
never read, print, copy, paste or send OAuth tokens/passkeys to chat or cloud.
The dedicated identity is native Author 30 with exactly `content:read`,
`content:write`, `media:read`, `media:write`. Do not add profile/admin scopes,
access Salon operational data, alter Grok security settings, expose localhost,
contact another Bot/person, or configure a schedule during a manual run.
Run local commands sequentially. The shared client lock coordinates native
OAuth refresh and persisted rotation across manual and daily processes.

Use `create` with explicit slug and article data. Read the saved ID and fields,
then `revise` that same ID using the freshly returned `_rev`. The wrapper sends
explicit `status: draft` and the site's effective locale `en` for Persian text.
Revision must still be this identity's own plain unscheduled draft with no live
revision. Never publish, schedule, withdraw, override locks or overwrite an
editor's changes. After an ambiguous write, reconcile its saved ID rather than
creating another article. Daily retry identity is owned by the daily runner.

For the manual connection proof, create one complete distinct draft, revise the
same saved ID, upload/read/attach a media item, obtain `preview ID`, and verify
the native saved draft and anonymous detail/index/sitemap exclusion. A signed
preview additionally requires a real native CMS session with draft-read
permission; a copied URL or Bearer token alone is denied. Preview failures do
not justify creating a replacement article. Renew by the stable saved ID.

Deliver the saved ID, current slug, consulted source record, media result and
preview expiry in the existing private Saluna Content Studio conversation.
Return only the intended signed preview link there, from its protected output,
never credentials. State explicitly that the article is unpublished and
unscheduled. No separate reviewer, publication or waiting for earlier drafts is
required. Report actual failure stage/code and saved/unknown state honestly.

## Scheduled daily delivery

Use `content/blog-writing/daily-routine.md` through `daily-instructions`. The
configured daily wrapper owns the original Asia/Tehran date, frozen payload and
media, native saved ID, source hashes, private preview verification and separate
report acknowledgement. Inspect `daily-status DATE` before writing. Retry an
existing date with `daily DATE` and no regenerated input. Never use manual
creation to replace it. Deliver the actual result into this Studio conversation,
then acknowledge its event only with the message tool's returned saved ID.
Missing/corrupt storage, human changes or ambiguous creation require operator
handoff. Routine success cannot imply publication or human review.
