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
published URL changes to an authorized operator. The daily runner's reserved
`saluna-daily-YYYY-MM-DD` slug is a temporary retry identity for an unpublished
draft; the operator must give it a descriptive Persian slug before publication.

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
connection with a raw token or unrestricted native HTTP tools. This production
workflow overrides a writing skill's local-only delivery template when the user
explicitly requests production work. The daily Grok routine keeps its existing
local delivery configuration.
