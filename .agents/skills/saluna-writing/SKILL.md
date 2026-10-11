---
name: saluna-writing
description: Write and revise unpublished Persian Saluna Blog Articles for Salon Owners and customers using current sources and a full content overlap review.
---

# Saluna writing

Write useful Persian articles for Salon Owners and customers. Choose one primary
audience and help that reader solve a concrete problem. Use
concrete examples, readable RTL paragraphs and descriptive headings. Avoid hype,
invented customer stories, unsupported promises, and developer terminology.

Choose across the subject families in
`content/blog-writing/editorial-plan.md`, including services, salon presence,
marketing, customer experience, visit planning, follow-ups, reporting, team
onboarding, and salon setup. The original commission, AppointmentRequest,
Client-record, and staff-scheduling subjects remain available. A Blog Article
is editorial advice; a Product Guide is maintained instructions for one task.
Use the canonical domain terms from the repository's root GLOSSARY.md.

## Check sources and overlap

Before choosing a topic, use production EmDash MCP `drafts_list` and `draft_get`
to read every Blog Article's full body, including published, draft, and scheduled
entries. Build the coverage map required by `docs/agents/public-content.md`.
For a new daily run, compare at least three candidate questions across different
families, including a customer candidate. Choose an uncovered reader task or
decision. Read access already exists; titles and summaries alone are not enough.
Extra examples, a new title, or expansion of an existing section do not qualify.
Incomplete corpus reads stop creation. Pending drafts block overlapping advice,
not unrelated new articles. Record the review before submission; skip if no
distinct supported candidate is available.

Run `sources SUBJECT` before writing. Supported keys are listed in
`content/blog-writing/sources.json` and the editorial plan. This returns
current checked-in glossary, public signup/pricing copy, article model and the
subject's UI/domain/ADR sources, with source commit and hashes. The path map is
`content/blog-writing/sources.json`. Re-read current source content each run,
record the paths/commit consulted, and validate every product claim. General
editorial advice need not be a feature tutorial. For claims beyond repository
evidence, consult current primary sources and record supported claims, URLs, and
access dates in the private novelty record. Historical
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

Read [the public content writing rules](../../../docs/agents/public-content.md).
Keep the visible title within 50 Unicode characters and aim for two lines at a
390px viewport. The summary should add one concise sentence beyond the title.
The manual and daily draft commands reject overlong title submissions with
`CMS DRAFT_TITLE_TOO_LONG`; shorten the title before submitting again.

Prepare a complete Persian title, stable explicit slug, useful summary and full
Portable Text `body` with headings and paragraphs. Keep article bodies and
submission payloads in the protected exchange, outside Git. Save the article
itself as a production CMS draft. Fill revisioned `seo_title` and
`seo_description`; leave `search_excluded` false. Do not write native legacy
SEO or native account-linked Bylines. An empty public-author selection defaults
to `تیم سالونا`, independently of the writing account. Named public profiles
are an explicit later editorial choice.

For an owner article, include a relevant signup invitation using the public
site's `/signup` destination on the configured manager origin. The public template already has
the shared signup action; a contextual body link may use the same destination.
Do not invent attribution tags or an authentication query mode. Customer articles
should use an audience-appropriate next step rather than a manager signup pitch.
Audience categories and topic tags are documented for later CMS/site work; keep
them in the private editorial record until the content model supports them.

Cover and inline images are optional. A cover-free article uses the existing
Saluna-branded social image. For media proof or a useful illustration, upload an
existing approved image with truthful Persian alt/caption and read it back.
Do not call a branded illustration an actual product screenshot. Preserve the
native upload-returned URL, not a guessed bare media-ID route. Inline images use
Portable Text `asset._ref` and `asset.url`; a cover uses its native provider/id.
No mandatory image generator or external vendor is required.

## Draft-only native delivery

Use the production `saluna_emdash_prod` draft-only MCP connection described in
`docs/EMDASH_AGENT.md`. The active daily runner uses the same adapter through
the protected production connection. The local CMS is retired. Credentials stay
in protected Mac files; never read, print, copy, paste or send tokens/passkeys to chat or cloud.
The dedicated identity is native Author 30 with exactly `content:read`,
`content:write`, `media:read`, `media:write`. Do not add profile/admin scopes,
access Salon operational data, alter Grok security settings, expose localhost,
contact another Bot/person, or configure a schedule during a manual run.
Run mutation commands sequentially. Follow the production guide for the protected
PAT and its expiry; the historical local OAuth flow does not renew this PAT.

For a manual draft, use `draft_create` with explicit slug and article data. Read
the saved ID and fields; any `draft_revise` must use that ID and a fresh `_rev`.
The adapter sends explicit `status: draft` and the site's effective locale `en`
for Persian text.
Revision must still be this identity's own plain unscheduled draft with no live
revision. Never publish, schedule, withdraw, override locks or overwrite an
editor's changes. After an ambiguous write, reconcile its saved ID rather than
creating another article. Daily retry identity is owned by the daily runner.

For a manual connection proof, create one complete distinct draft, read the
saved ID, obtain its private preview, and verify the native saved draft and
anonymous detail/index/sitemap exclusion. Revision and media proof are only
needed when requested. A signed preview additionally requires a real native
CMS session with draft-read
permission; a copied URL or Bearer token alone is denied. Preview failures do
not justify creating a replacement article. Renew by the stable saved ID.

Deliver the saved ID, current slug, consulted source record, media result if used,
and preview expiry in the requesting Codex conversation or automation output.
Return only the intended signed preview link, from its protected output,
never credentials. State explicitly that the article is unpublished and
unscheduled. No separate reviewer, publication or waiting for earlier drafts is
required. Report actual failure stage/code and saved/unknown state honestly.

## Scheduled daily delivery

Use `content/blog-writing/daily-routine.md` through `daily-instructions`. The
configured daily wrapper owns the original Asia/Tehran date, frozen payload and
media, native saved ID, source hashes, private preview verification and separate
report acknowledgement. Inspect `daily-status DATE` before writing. Retry an
existing date with `daily DATE` and no regenerated input. Never use manual
creation to replace it. Deliver the actual result into the Codex automation
output. Do not run `daily-ack`; Codex output is not a saved Studio message receipt.
Missing/corrupt storage, human changes or ambiguous creation require operator
handoff. Routine success cannot imply publication or human review.
