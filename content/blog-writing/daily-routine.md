# Saluna daily production draft routine

The active Codex automation aims to create one distinct unpublished Persian Blog Article in
the real CMS at `https://saluna.ir`. It runs at 12:00 Asia/Tehran. The local CMS
is retired. Never use Grok Bot, publish, schedule publication, change security
settings, or bypass the production draft-only adapter with a raw token.

Read AGENTS.md, docs/agents/public-content.md, docs/EMDASH_AGENT.md,
docs/EMDASH_DAILY.md, content/blog-writing/editorial-plan.md, and the
saluna-writing skill.

Use `node scripts/grok-draft-cli.mjs` with the protected production connection
at `/Users/mohamad/.codex/private/saluna-cms-bl0087/production-mcp/daily-connection.json`.
Despite the historical filename, this is a local CLI calling the same draft-only
adapter as `saluna_emdash_prod`; it does not contact Grok or localhost.

Capture the scheduled occurrence date in Asia/Tehran once. If the trigger does
not supply a date, use the current Tehran date only between 12:00 and 12:30;
otherwise report that the original date is unknown. An explicit manual run or
retry may use its explicitly supplied date, even outside that window.

1. Run `daily-status YYYY-MM-DD`. If the date exists, run `daily YYYY-MM-DD`
   without new input to retry its frozen article. Missing or corrupt registered
   storage requires operator handoff. Never reset it or create a replacement.
2. For a new date, use production EmDash MCP `drafts_list`, then `draft_get`
   for every published article, pending draft, and scheduled entry. Read full
   bodies and build the coverage map required by the Topic overlap section of
   `docs/agents/public-content.md`. Titles and summaries alone are insufficient.
   Propose at least three questions across different subject families from the
   editorial plan, including a customer candidate. Compare their reader
   questions and outlines with the existing advice. Reject rewrites, extra
   examples, and expansions of an already covered section. Prefer uncovered
   subjects. Run
   `sources SUBJECT` and consult current sources for a distinct candidate.
   Save `novelty-YYYY-MM-DD.json` in the private exchange, recording reviewed
   IDs/revisions, coverage, nearest articles, new reader outcome, audience,
   proposed topic tags, external sources if used, and rejected candidates.
   Categories/tags are documented for later CMS/site work; do not send unsupported
   CMS fields. Recheck the finished body against that map. Incomplete corpus
   reads stop creation. If no distinct supported topic exists, report
   `skipped_no_distinct_topic` and do not submit or register a delivery.
3. Save one mode-0600 JSON request in the configured private exchange directory.
   Include `subject`, a descriptive Persian `slug`, and complete `data` with
   title, summary, Portable Text body, seo_title, seo_description, and
   search_excluded false. Use a title of at most 50 Unicode characters,
   default Team credit, and an audience-appropriate next step. Owner signup links
   use the real `https://app.saluna.ir/signup` destination.
   Check slug collisions in production. No localhost links or temporary English
   slugs. Images are optional and require truthful alt text and an approved
   local file.
4. Run `daily YYYY-MM-DD REQUEST.json`. The runner freezes the payload and
   sources in the production journal, records native receipts before later
   reads, and verifies saved ownership, revision, locale, and plain draft state.
   It obtains a private preview and checks anonymous preview denial and absence
   from public detail, index, and sitemap. A signed preview requires an
   authenticated CMS session to view.
5. Report the actual result in the Codex automation output with date/run ID,
   production origin, status, creation state, saved article ID/slug, safe error
   code and failure stage, retry/handoff instruction, and protected report path.
   Only `status: verified` proves saved delivery and anonymous privacy.
   `verification.authenticatedPreview: false` means visual preview and mobile
   layout have not been checked. Never claim those checks passed. Where an
   existing authenticated CMS browser is available, inspect at 390px and report
   that separate result. Extract an intended preview URL only from the protected
   report, never from credential files.
   For a new article, include the novelty record path, number of full entries
   reviewed, nearest existing articles, and the materially new reader outcome.
6. Do not run `daily-ack`. Codex output is not a saved Studio message receipt.
   Pending reporting events do not prevent later daily drafts.

After an uncertain create, reconcile the saved ID or the frozen slug and payload.
Never generate replacement input. Human edits, ownership changes, publication,
scheduling, or removal require handoff. A missing unknown create stays ambiguous.
The runner cannot publish, delete, or overwrite an editor's revision.

The Mac must be awake, Node/Python available, the production site reachable,
and the production PAT valid. Docker and local CMS test passkeys are unnecessary.
Report real connection failures or expired credentials without changing network,
permissions, or security settings to work around them.
