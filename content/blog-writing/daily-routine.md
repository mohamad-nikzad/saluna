# Saluna daily draft routine

Run through the active local Codex automation. Use the account-private Saluna
Writing skill and the configured Mac-local drafting command. The schedule is
12:00 Asia/Tehran. Keep the user's existing execution and automatic-review
settings. Do not change permissions, routing, credentials or other Bots. Never
use Grok Bot, publish, or schedule publication.

Capture the scheduled occurrence's calendar date in Asia/Tehran from the
automation trigger context once, before any work. If no occurrence date is
provided, use the current Tehran date only when the local time is 12:00–12:30;
otherwise stop and report that the original date is unknown. An explicit retry
uses its already recorded original date, including after midnight. Do not infer
a date from a delayed wake outside that window.

1. Run `daily-status YYYY-MM-DD`. A missing or corrupt journal is an operator
   handoff; never reset it or create a replacement. If the date already exists,
   run `daily YYYY-MM-DD` without new input. That retries its frozen article.
2. For a new date only, run `inventory`, inspect overlapping drafts and published
   articles, and run `sources SUBJECT`. Read overlapping articles by saved ID
   when needed. Choose one distinct useful Persian article from the supported
   subjects, using current code and ADRs. Earlier unreviewed drafts do not block
   the new date.
3. Write one exchange JSON file with `subject` and complete revisioned article
   `data`: title, summary, Portable Text body, seo_title, seo_description, and
   search_excluded false. Use default Team credit and a contextual real signup
   link. The runner reserves `saluna-daily-YYYY-MM-DD`; do not supply another
   slug. This is an unpublished retry identity; the publishing operator must
   replace it with a descriptive Persian slug before first publication, following
   `docs/agents/public-content.md`. Optional `media` contains an exchange `image` filename and truthful
   Persian alt/caption. A cover-free article uses the branded social fallback.
   Follow `docs/agents/public-content.md`: visible titles have a 50-character
   limit and a two-line mobile target. Keep supporting details in the summary.
   The runner rejects an overlong title before freezing the new date's payload.
4. Run `daily YYYY-MM-DD INPUT.json` once. The runner freezes payload, media and
   current source hashes, persists native receipts, checks saved ownership,
   locale and plain-draft state, and verifies the signed preview with a real
   native Author session. It checks anonymous detail/index/sitemap exclusion.
   Only `status: verified` means that this article and preview were verified.
5. Return a concise run report in the Codex automation output.
   Include original date/run ID, saved article ID/current slug if known, status,
   creation saved/absent/unknown, error code and retry/handoff instruction. For
   verified delivery, extract only the intended preview URL and expiry from
   the protected report file, and include that link with its native-session
   requirement. Never read or transfer OAuth credentials or passkey files.
6. Do not run `daily-ack`: Codex automation output is not a saved-message receipt
   from the former Studio conversation. Leave the local report pending unless a
   supported real receipt is available. A receipt proves saved delivery, not
   human review. A renewed preview creates a new pending event.

Report failures in the Codex run output; do not silently retry an ambiguous write. A later explicit
retry uses the original date and frozen record. Never use manual `create`,
`revise`, `upload`, deletion, lock overrides or a different slug to bypass the
daily journal. `daily-revise YYYY-MM-DD PATCH.json` is available only for a
specific authorized correction with presentation `data`; it uses the same ID,
fresh native revision and lost-response reconciliation. Any human revision,
rename, publication, schedule, or removal causes a handoff with no replacement.

Mac execution can fail when the Mac sleeps, Docker/CMS is stopped, browser
verification is unavailable, OAuth is revoked, or automatic review rejects an
action. Report the original run context and observed failure, including known
saved ID when available. Do not claim success or alter security settings to
work around the failure. Do not initialize journals or run other-person,
operational-Salon or production commands.
