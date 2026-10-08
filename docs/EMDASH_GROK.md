# Grok Studio draft connection

Saluna Content Studio uses the existing dedicated native Author connection
through a narrow Mac-local command. The CMS stays loopback-only, credentials stay
on the Mac, and the account's current local-execution and automatic review
settings apply.
This is separate from the intended editor's physical CMS trial.

The [daily runner](EMDASH_DAILY.md) adds durable original-date delivery,
concurrency/crash recovery and separate Studio report acknowledgement.

The writing contract is [.agents/skills/saluna-writing/SKILL.md](../.agents/skills/saluna-writing/SKILL.md).
Register its Markdown instructions through Grok's built-in skill tool in the
authorized account's private library. Do not publish it to a public registry.
The current source map is [content/blog-writing/sources.json](../content/blog-writing/sources.json).
It names product code and ADRs, not a frozen set of promises; reread them every
run. The supported [native agent interface](EMDASH_AGENT.md) remains core/auth
1.1.0 MCP plus the native preview REST adjunct.

## Local command

`scripts/grok-draft-cli.mjs CONNECTION ACTION INPUT` reads a protected local
connection file with `credentials`, `repository`, `exchange` and `results`
absolute paths. The credential file is the existing Author's OAuth response,
with exactly the four native content/media scopes from the agent guide.
Connection/credential/results files stay outside Git with mode 0600, directories 0700. A local executable wrapper supplies those paths so Studio never reads,
prints or transfers credentials. Execute one command at a time.

The command offers these operations:

| Action      | Input                         | Result                                                                              |
| ----------- | ----------------------------- | ----------------------------------------------------------------------------------- |
| `inventory` | None                          | Current native tools and cursor-paginated published/draft IDs, titles and summaries |
| `sources`   | A subject from the source map | Current glossary/model/signup and subject sources, commit and hashes                |
| `read`      | Saved article ID              | Native saved fields and current `_rev`                                              |
| `create`    | Exchange JSON filename        | Complete explicitly unpublished article and saved ID                                |
| `revise`    | Exchange JSON filename        | Same owned plain draft updated with fresh `_rev`, then reread                       |
| `upload`    | Exchange JSON filename        | Native uploaded/read image record and upload-returned URL                           |
| `media`     | Saved media ID                | Native saved media record                                                           |
| `preview`   | Saved article ID              | Expiry and protected preview file path, with no signed URL in stdout                |

`create` takes the slug and complete article `data` shown in the agent guide.
`revise` takes saved `id`, current `_rev` and intended `data` patch. The wrapper
accepts revisioned article presentation fields, rejects publication controls and
never changes a slug through a revision. The native client checks ownership,
plain unscheduled draft state, effective locale and live revision before writes.
No mutation is automatically retried after an ambiguous response.

Input filenames must be regular files inside the configured exchange directory;
absolute paths, traversal and symlinks are rejected. `upload` takes `image`, a
filename in that directory, plus truthful Persian `alt` and optional `caption`.
The manual proof can use an existing Saluna-branded illustration, identified as
an illustration rather than a product screenshot. Retain its returned URL for
Portable Text `asset.url`, along with `asset._ref`. Optional media does not
require an image-generation vendor.

The native preview file contains the signed URL. Only the intended draft link
is delivered to the existing private Studio conversation, never OAuth or passkey
state. Opening it also requires an active native CMS session; a copied URL or
Bearer token alone remains denied. Private browser verification consumes the
actual Studio-created and revised records without creating replacement content:

```sh
node deploy/cms/grok-drafting.browser.mjs /absolute/private/cms-directory
CMS_GROK_CONFIG=/absolute/private/connection.json node --test deploy/cms/grok-client.test.mjs
```

## Approval and delivery boundaries

The local proof began with `Ask every time`. The user personally approved the
inventory in Grok; a later read-only settings observation showed this Mac set to
`Always allow`, automatic review still on, other-computer access denied and
traffic routing off. The implementation agent never clicked an approval button
or changed a security setting. This observed user choice permits the authorized
task commands; it does not demonstrate a special narrow automatic approval rule
or successful unattended schedule.

Keep the exact pending command visible for user approval when Grok requests it.
Do not click global Always allow, reduce approval rules, enable traffic routing,
expose localhost, install server software on the cloud VM, or give the Bot
operational Salon credentials. A successful manually approved command does not
prove unattended scheduling. Actual due-run, retry identity and failure reporting
are BL-0103 work; this ticket creates no schedule.

## Manual Studio result

On 2026-10-08, the authorized Studio saved the account-private **Saluna Writing**
skill using Grok's built-in skill tool. Its private-library detail and listing
were visibly checked. Studio then ran the native inventory, checked both drafts
and published content for overlap, and read the current scheduling source bundle
at integration `d06838bb` before writing.

Studio created draft `01M4D50D3J7W063DGAFEZ9R2YH`, slug
`salon-hours-staff-schedule-closures`, and revised that same ID. It uploaded/read
media `01M4D515KEQF2A0XY82P88WHW7`, a 1200×630 branded illustration, and attached
it as cover and inline media with truthful Persian alt/caption. The complete
Persian article distinguishes staff recurring hours, Salon Working Days and
Salon Closures, with worked service-end examples and a relevant signup action.
It does not claim production rollout, automatic shift optimization, attendance,
payroll or cancellation of existing Appointments.

Native verification opened the returned link through the dedicated Author's
real CMS passkey session: 200 with private no-store and noindex, Persian title,
revisioned metadata, default Team credit and both images. Uploaded image URLs
also decoded anonymously. Copied links and Bearer-only requests returned 403;
ordinary detail returned 404 and the draft was absent from index and sitemap.
The technical Editor reopened the exact saved ID, inspected title/image/SEO,
and reloaded it. All three original launch drafts remained unpublished.

Current native checks confirmed Author 30, the exact four content/media scopes,
and denied profile/admin requests. The real Saluna API/Better Auth implementation
against a disposable migrated database rejected the current CMS Bearer token
with 401 for Clients, Appointments and business settings, before operational
reads. No operational Salon data was accessed. The temporary database was
removed. Native Author can publish its own content; this connection deliberately
requests only draft operations rather than adding a custom publication engine.

The retained local image's shared signup action targets its configured manager
fixture at `http://127.0.0.1:3304/signup`; the contextual article link targets
`https://app.saluna.ir/signup`. The browser proof checks both destinations and
does not mistake local build configuration for a production origin.

The original preview expired during a usage interruption. Studio's first
renewal safely failed at a read because the retained Docker CMS was stopped; no
write was sent. The existing stack resumed without replacing data. Studio was
asked to correct one ambiguous recurring-schedule access sentence on the same
ID and renew its preview. Studio reread the expanded 13-file source bundle,
removed only that sentence, saved version 3 and returned a renewed private link.
Images and unscheduled draft state were preserved.

Safe saved IDs/source records belong in `content/blog-writing/delivery.json`.
Signed preview files, OAuth, passkeys and native technical browser screenshots
remain in protected external storage. Renew previews by this saved ID rather
than creating replacement articles. The intended editor's physical trial is
still pending at the end of the parent task. This manual run enables no daily
schedule and does not establish unattended due-run behavior.
