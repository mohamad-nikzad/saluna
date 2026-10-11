# Public content writing

Visible Blog Article titles must contain at most 50 Unicode characters after
trimming surrounding whitespace and NFC normalization. Spaces and Persian
half-spaces count. This is Saluna's editorial limit, not a search-engine limit.

Aim for 4–8 words about one clear subject. Put supporting details, examples and
secondary questions in the summary or body. Avoid appending filler such as
`با مثال` to a title by default. For example, use
`محاسبه کمیسیون پرسنل سالن`.

Check the actual article and list at a 390px viewport. Aim for at most two title
lines and let the reader reach the opening paragraph in the first screen.
Character count cannot guarantee wrapping. Shorten a title that wraps too much;
keep the full title readable rather than clipping it or shrinking the font.
Apply the same writing and preview guidance to Product Guide titles.

Use an explicit Persian slug for every Blog Article and Product Guide. Choose
a short phrase describing the subject or task, such as
`محاسبه-کمیسیون-پرسنل-سالن` or `افزودن-مشتری-در-سالونا`. Keep the `/blog/`
and `/guides/` route prefixes. Use Persian `ی` and `ک`, NFC normalization, and
single ASCII hyphens between words. Replace spaces and half-spaces with hyphens;
omit punctuation, diacritics, leading/trailing hyphens and repeated hyphens.
Do not transliterate into English or store percent-encoded text in the CMS slug.
Encode the slug only when constructing a URL, and check for collisions before
creating or renaming an entry.

Keep an existing slug stable when revising its title or body. Renaming a
published entry requires explicit authorization, a native EmDash draft save and
publication, and verification of its new page, canonical URL, sitemap and the
old URL's permanent redirect. Never change only the database slug or disable
the automatic redirect. Draft-only writing agents must leave publication and
published URL changes to an authorized operator. Production daily drafts also
use descriptive Persian slugs. The former local rehearsal's reserved
`saluna-daily-YYYY-MM-DD` slug was a temporary retry identity; it does not apply
to production submissions.

Write one concise summary sentence that adds information beyond the title.
Use the separate `seo_title` field for search wording when useful. It does not
need to repeat the visible title exactly and is outside the visible-title limit.

The shared draft client rejects new titles and title revisions above the limit
with `CMS DRAFT_TITLE_TOO_LONG`. Manual and daily agent submissions use this
guard; the daily runner validates before freezing a new payload or recording a
pending title revision. Existing long titles can still receive edits to other
fields. Human CMS editing does not use this agent guard, so preview checks remain
part of the writing workflow.

When the user requests production drafts, use the configured
`saluna_emdash_prod` MCP connection described in
[the agent drafting guide](../EMDASH_AGENT.md#production-mcp-connection).
Create and revise only this connection's own plain, unscheduled drafts. List
existing content before choosing a subject or slug, read the saved ID before
editing, and pass its fresh `_rev`. Leave publication, scheduling, deletion,
and published URL changes to an authorized operator. Do not bypass this
connection with a raw token or unrestricted native HTTP tools. Keep new article
bodies and submission payloads out of the repository. Save articles as production
CMS drafts; temporary submissions, source receipts, and failed-delivery records
belong in the configured protected exchange directory. Editorial rules, source
maps, research, and delivery tooling may remain in Git. This production
workflow overrides a writing skill's local-only delivery template when the user
explicitly requests production work. The active daily Codex automation also
targets production, as requested on 2026-10-11. Follow
[the daily routine](../../content/blog-writing/daily-routine.md) and
[its production setup](../EMDASH_DAILY.md); the former local Grok routine is retired.

## Topic overlap

Choose from the broader subject families and audiences in
[the editorial plan](../../content/blog-writing/editorial-plan.md). The daily
scheduler should build breadth before expanding existing sections. Audience
categories and topic tags are documented for a later CMS and website change;
record them privately for now and do not invent unsupported CMS fields.

Before choosing a new Blog Article, use production EmDash MCP `drafts_list` to
inventory all existing Blog Articles, including pending drafts and scheduled
entries. Then use `draft_get` to read each entry's full current `body`, not only
its title and summary. Build a coverage map of the reader question, practical
outcome, and topics already answered in its sections. Keep IDs and `_rev` values
with that map. If any required read fails or the complete corpus cannot be
reviewed within the run, report the incomplete review and stop before creation.

Compare proposed reader questions and outlines against that map. A different
title, audience label, more examples, or a narrower treatment of an existing
section is not enough to justify another post. The proposed article must help
a reader make
a materially different decision or complete a different task that the existing
articles do not already address. For the daily scheduler, choose an uncovered
subject rather than expanding a section of an existing post. Reject a candidate
whose main advice is
already covered, even when its wording and slug are new. Check the completed
outline and body again before submitting the draft.

For example, the published `پرونده-مشتری-سالن` article already covers consistent
recording of the Client's acquisition source. A separate post explaining that
same field with more referral/Instagram examples does not meet this novelty
rule. That applies to the unpublished `ثبت-منبع-آشنایی-مشتری` draft created on
2026-10-11. It remains a draft and should not be treated as a distinct coverage
gap. This rule does not authorize editing, publishing, or deleting either entry.

Try another source-supported topic when a candidate overlaps. If no sufficiently
distinct topic is available, report `skipped_no_distinct_topic` instead of
producing a near-duplicate to meet the daily target. Do not register a delivery
or claim a saved draft for that skip. A pending draft blocks overlapping topics,
not unrelated new topics. Never rewrite an existing published article as part
of this check.

Before a new daily submission, save a mode-0600
`novelty-YYYY-MM-DD.json` file in the configured private exchange directory.
Record the full inventory's reviewed IDs/revisions and coverage, at least three
candidate questions across different families, selected audience and proposed
topic tags, the selected reader question and outline, closest existing articles,
overlapping advice,
the materially new reader outcome, rejected candidates, and the final
`distinct` or `skipped_no_distinct_topic` decision. Include its path and a brief
novelty explanation in the automation report. This is an editorial assessment,
not an automated guarantee that two articles are semantically different.
