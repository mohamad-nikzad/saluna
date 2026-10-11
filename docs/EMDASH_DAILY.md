# Daily unpublished Studio drafts

BL-0087 was completed under revised scope on 2026-10-11. The user removed the remaining human editor trials and scheduled-drafting proof requirements; these checks are not claimed as completed. The archived tasks preserve their technical evidence. Earlier rollout notes below are historical where they describe these checks as blockers. See [the completion record](../backlog/done/BL-0087-publish-blog-and-product-guides-with-emdash.md).

The active local Codex automation runs the account-private Saluna Writing skill
through the protected native drafting connection. The former Grok Studio routine
is paused.
The intended regular schedule is **12:00 Asia/Tehran**, selected under the user's
delegated time choice. Publication remains an explicit later editorial action.
The native Author role can publish its own content; the narrow runner exposes
only explicit unscheduled draft operations. It adds no custom CMS permission
or publication engine.

The reusable [routine instructions](../content/blog-writing/daily-routine.md)
are available through `daily-instructions`. Actual execution must be proved by
its native CMS record and private journal, not an enabled schedule or a model's
success claim. Codex run output is not a saved Studio message receipt, so report
events remain pending.

## Private setup and commands

Extend the existing protected connection with absolute `journal` and
`sessionState` paths, plus optional `scheduledTime` for a documented rehearsal.
The regular value is `12:00`. `sessionState` holds the retained technical Author
passkey fixture for real session-backed browser verification; it is separate
from the intended editor's physical-passkey invitation. All private files are
0600, directories 0700, outside Git. The local wrapper supplies these paths and
the installed Chromium executable; the model must never read OAuth or passkey
file contents.

An operator initializes a NEW journal once:

```sh
node scripts/daily-draft-cli.mjs /absolute/private/connection.json init
```

Initialization refuses an existing directory. Studio has no reset or initialize
action. Its existing local command adds:

| Action               | Arguments                                             | Meaning                                                        |
| -------------------- | ----------------------------------------------------- | -------------------------------------------------------------- |
| `daily-instructions` | None                                                  | Current checked-in routine contract                            |
| `daily-status`       | Original ISO date                                     | Read registered state; `new` requires initial input            |
| `daily`              | Original date, optional exchange JSON filename        | First delivery or retry of its frozen record                   |
| `daily-revise`       | Original date, exchange patch JSON filename           | Authorized correction to the same owned draft                  |
| `daily-ack`          | Original date, exchange acknowledgement JSON filename | Confirm a particular report after actual saved Studio delivery |

Initial input is `{ "subject": "…", "data": { … } }`, using one subject from
the current source map and complete title, summary, Portable Text body,
revisioned search title/description and `search_excluded: false`. The runner
reserves `saluna-daily-YYYY-MM-DD`, effective locale `en`, and empty public-author
selection for Team credit. Optional `media` has an exchange `image` filename
and truthful Persian alt/caption. Revisions accept only presentation `data`.
Acknowledgements contain `eventId` and the message tool's actual returned
saved-message `receipt`. Paths cannot escape the exchange directory.

## Retry and reporting behavior

The immutable identity is `blog-daily/Asia-Tehran/YYYY-MM-DD`. Capture the
original scheduled date once; a retry after midnight keeps it. The journal
registers that date, freezes payload/media/source commit and hashes, and records
`create_started` before sending a native mutation. Atomic replacements sync
both file and parent directory. Real process locks serialize complete attempts
and coordinate the shared rotating OAuth file across daily/manual commands.
Kernel descriptor cleanup releases a crashed process's lock; lock files are
never removed or stolen by a timer. Node and installed Python 3 are required.

Native create ID/revision and upload ID/URL receipts are saved before follow-on
reads. A known ID is always reread. A genuinely lost create response is adopted
only when original slug, ownership, locale and frozen payload conclusively
match. A renamed/deleted unknown create remains ambiguous and stops. No
replacement is created. Human revision changes, including native UI-staged
slugs hidden by normal content reads, cause a handoff. Published, scheduled,
removed or edited content is never overwritten, withdrawn or unscheduled.
Deletion remains a tombstone. Missing/corrupt registered storage also stops.

`creation_failed` with `creation: absent` is not saved delivery. `create_unknown`
is an operator handoff. `saved_needs_read` and `saved_needs_preview` retain their
ID and retry verification. `verified` requires saved plain-draft state,
authenticated private/no-store/noindex preview, default Team credit, copied-link
denial and anonymous detail/index/sitemap exclusion. Preview renewal uses the
saved ID. Native/public requests are bounded; a stalled check cannot hold the
shared locks indefinitely.

Saving and reporting are separate. The protected report file contains the
intended signed URL; stdout contains only safe state/context and its file path.
Reports remain pending until Studio sends an intermediate result to THIS
conversation, receives the actual saved message ID, then acknowledges that
event. A failed send or interrupted acknowledgement stays pending. Renewal or
a changed verified revision creates a new pending event; unchanged retries keep
their acknowledgement. Message receipts prove saved delivery, not human review.
Later dates continue even while older drafts remain unreviewed or unpublished.

The Mac must be awake, its existing Docker/CMS running, the native OAuth grant
valid, and Chromium available. Automatic review still applies under the user's
existing Mac execution choice. Offline/blocked execution must report observed
failure and original run context; it cannot claim success or change security
settings to work around it.

## Backup and verification

Retain the manifest, date records/tombstones, frozen media and report receipts.
Never delete older records merely because their draft is published or removed.
Take a matching protected backup of journal, rotating OAuth/technical passkey
state, database, media, image version and encryption key. Serialize backup with
the same journal and credential locks, or pause this native Studio routine and
wait for its current attempt to finish before taking the existing CMS backup
and private-file copy. Restore matching state, not a new empty journal. After
an older CMS restore, missing saved IDs require operator reconciliation rather
than automatic replacement.

The focused real-native suite uses the retained isolated CMS on localhost3301:

```sh
CMS_DAILY_TEST_PRIVATE_DIR=/absolute/private/cms-directory \
PLAYWRIGHT_CHROMIUM_EXECUTABLE_PATH=/absolute/installed/chromium \
node --test --test-concurrency=1 deploy/cms/daily-delivery.test.mjs
```

Its faults occur at an external loopback HTTP proxy, forwarding saved mutations
to the real native CMS. It verifies actual IDs, lifecycle, conflicts, receipts,
media, browser privacy and pending reports. Test acknowledgements use an
explicit isolated sink; they are not Studio receipts. Teardown uses the native
Operator API only for owned `daily-fixture-*`/`daily-receipt-*` articles and
their tiny fixture media. Interrupted runs can be cleaned with
`node deploy/cms/daily-fixture-cleanup.mjs /absolute/private/cms-directory`.
Original launch/Studio/guide/recovery content is preserved.

## Scheduled rollout evidence

On October 8 the runner's 14 native tests, 5 native-client checks and 3 Studio
wrapper checks passed. The same account-private Writing skill was updated and
visibly verified. The current native Author role (30), four scopes and
profile/admin denial were confirmed. This Mac's user-selected Always allow,
Auto-review on, empty custom rules, other-computer Never allow and routing off
were observed; no setting changed.

Native routine `saluna-daily-unpublished-article` was saved for an October 8
17:30 Tehran rehearsal. Its native status later showed a failed run at 18:34:07,
without a failure reason; no journal or Studio result existed. The same routine
was updated for October 9 at 02:10, preserving the original October 8 identity.
At 02:14 its native status still had no new run, and no journal or Studio result
had appeared. This second slot was overdue, without an observed failure result.

The native guide explicitly supports the `CRON_TZ=<IANA zone>` prefix, and
status retained `CRON_TZ=Asia/Tehran`; no separate resolved execution timestamp
was exposed. The temporary fault proxy, environment and preload were removed.
The former Grok routine used the 09:00 schedule and is now paused. Its Codex local
automation replacement uses the current contract at 12:00 Asia/Tehran.
Enabled configuration is not execution proof: **actual scheduled draft creation
and failure reporting remain unverified**. Codex runs do not produce the saved
Studio message receipt needed to acknowledge report events.
The local operator evidence records the saved configuration and observed
status. This technical work does not claim the intended editor's physical CMS
trial or a successful daily delivery.
