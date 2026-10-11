# Daily production Blog Article drafts

The active Codex automation, `Saluna daily unpublished blog draft`, targets
the real CMS at `https://saluna.ir`, at 12:00 Asia/Tehran. The user requested this
switch on 2026-10-11 after the first scheduled run failed against the retired local
CMS. The former Grok routine remains paused. Publication is a later editorial
action; daily runs create only unpublished, unscheduled drafts.

## Production connection

The protected configuration is
`/Users/mohamad/.codex/private/saluna-cms-bl0087/production-mcp/daily-connection.json`.
It contains paths, `target: production`, and `scheduledTime: 12:00`. Credentials
remain in the existing mode-0600 production MCP credential file. The runner uses
the same `draftMcpOperations` boundary as `saluna_emdash_prod`, rather than
unrestricted native tools. All creates, revisions, and media writes pass through
that boundary. Native Author permissions are unchanged.

Production has its own mode-0700 journal and exchange/results directories under
the same protected production-mcp directory. The former local journal remains
intact as historical evidence. Never point production at that old journal or
change the endpoint of an existing registered run. A local payload can be
explicitly transferred only after confirming no create was started and no ID
was saved, checking production overlap, assigning a descriptive Persian slug,
and correcting local links. An ambiguous or saved local create needs operator
reconciliation instead.

Use the existing CLI, whose historical filename does not imply Grok execution:

```sh
node scripts/grok-draft-cli.mjs /absolute/private/daily-connection.json daily-instructions
node scripts/grok-draft-cli.mjs /absolute/private/daily-connection.json daily-status YYYY-MM-DD
node scripts/grok-draft-cli.mjs /absolute/private/daily-connection.json inventory
node scripts/grok-draft-cli.mjs /absolute/private/daily-connection.json sources client-records
node scripts/grok-draft-cli.mjs /absolute/private/daily-connection.json daily YYYY-MM-DD REQUEST.json
# Retry the original frozen article, without new input:
node scripts/grok-draft-cli.mjs /absolute/private/daily-connection.json daily YYYY-MM-DD
```

The [routine contract](../content/blog-writing/daily-routine.md) defines the date,
topic, source, article, privacy, and reporting checks. The manual run date is
explicit; scheduled runs use the occurrence date or the 12:00–12:30 Tehran fallback.

## Editorial overlap review

The daily writer now considers 14 source subjects and both salon-owner and
customer audiences. Follow `content/blog-writing/editorial-plan.md` for topic
selection and the documented future audience categories and topic tags. Those
taxonomy fields are editorial metadata only until a later CMS/site change.
For each new date, compare at least three questions across different families,
including a customer candidate. Prefer uncovered subjects to expanding existing
posts. Customer articles use an appropriate next step, not a manager signup pitch.

Read access already includes past published articles, pending drafts, and
scheduled entries. Before selecting a new daily topic, the automation must use
production EmDash MCP to read the full body of every current entry and record
its covered reader questions, outcomes, and sections. The detailed novelty rule
is in [public content rules](agents/public-content.md#topic-overlap).

New wording, extra examples, or expanding one already-covered section does not
justify another article. A distinct new reader task or decision is required.
If corpus reads fail, stop before creation. If no supported distinct topic can
be found, report `skipped_no_distinct_topic` without registering delivery.
Save the coverage and novelty decision in the private exchange as
`novelty-YYYY-MM-DD.json` and reference it in the run report. This is an editorial
check; the runner's technical `verified` status alone does not establish novelty.

The 2026-10-11 acquisition-source draft technically passed delivery checks but
overlaps advice in the published Client records article. The user identified
this overlap after the manual run. It stays unpublished; future topic selection
must treat this advice as already covered. Its saved delivery journal remains
intact, and retries must not create a replacement article.

## Delivery and retry guarantees

The date identity remains `blog-daily/Asia-Tehran/YYYY-MM-DD` within its production
journal. Initial input includes `subject`, a descriptive Persian `slug`, and
complete revisioned article `data`. The runner freezes payload, sources, hashes,
and endpoint. Use `https://app.saluna.ir/signup`, never localhost. The English
date-based slug convention belongs only to the former local rehearsal.

Process locks serialize each attempt and shared credential operations. Atomic
mode-0600 writes sync the file and parent directory. The runner saves a native
create ID before a follow-on read can fail. Retries retain that ID. A lost create
response is adopted only after slug, ownership, locale, and frozen fields match;
otherwise the run stays ambiguous. A retry never creates a replacement after
creation started. Human edits, renames, publication, scheduling, or removal cause
handoff rather than overwriting content.

`creation_failed` with `creation: absent` means no create was sent.
`saved_needs_read` and `saved_needs_preview` retain the saved ID.
`create_unknown` requires operator handoff.
`verified` means native saved draft and anonymous privacy checks passed.
Production verification checks signed-preview denial, public detail 404, and
index/sitemap exclusion. It does not use a local test passkey.
`verification.authenticatedPreview: false` explicitly records that an
authenticated visual preview has not been checked. Opening the signed link
requires a real permitted CMS session. Mobile layout remains a separate
editorial check, never a claimed unattended result.

Protected reports hold the signed URL and expiry. Stdout contains safe run
context, status, IDs, error code/failure stage, and report-file path. Codex run
output is not a Studio saved-message receipt, so do not call `daily-ack`.
Pending reports and earlier unreviewed drafts do not block a later daily draft.

The Mac must be awake, Node and Python installed, production reachable, and the
PAT valid. Docker, a local CMS, and local test passkeys are unnecessary. PAT
renewal follows [the production connection guide](EMDASH_AGENT.md).

## Verification

Focused tests cover production origin and Persian slugs, receipt persistence
before failed reads, privacy-check retries, collision refusal, editor handoff,
and stable IDs across retries through the real adapter policy:

```sh
node --test deploy/cms/production-daily.test.mjs deploy/cms/drafts-mcp.test.mjs deploy/cms/draft-title.test.mjs
```

These are offline behavior checks. Only a successful real production run proves
delivery. The former local scheduled run on 2026-10-11 saved no article; its
original journal/report remains protected. Earlier Grok rehearsal evidence is
in [the archived task](../backlog/archive/BL-0103-enable-daily-grok-drafting.md).

On 2026-10-11 a manual production recovery used the connected
`saluna_emdash_prod` tools directly. The journal recorded create intent before
`draft_create` and saved its native receipt immediately afterward. `draft_get`
confirmed draft state with no live revision or schedule, and `draft_preview`
returned a private signed link. The daily runner then reconciled that same ID
and passed its anonymous privacy checks. Authenticated/mobile preview was not
checked. The original local record and the earlier failed production connection
attempt remain preserved; neither created an article.
