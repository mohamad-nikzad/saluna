---
id: BL-0103
title: Enable daily Grok drafting
status: ready
type: task
triage: ready-for-agent
priority: medium
size: medium
parent: BL-0087
blocked_by: [BL-0102]
created: 2026-10-06
updated: 2026-10-09
---

## Problem

The verified manual Grok workflow needs daily execution that cannot create duplicate drafts on retries or silently fail.

## Smallest Useful Version

Enable one daily Persian Blog Article drafting run using the Saluna writing skill and tested CMS identity, with durable run tracking, retry behavior, and failure reporting.

## Acceptance Criteria

- [x] Choose the run time with the person responsible for content before enabling the routine, record it in `Asia/Tehran`, and verify that the configured schedule follows that timezone.
- [ ] A daily run creates one new Persian Blog Article draft using the writing skill, current product sources, overlap checks, required fields, and default byline.
- [x] Tie retries to the same durable daily run identity. Repeated execution, overlapping attempts, and retries after a draft was saved but the completion response was lost do not create duplicate drafts.
- [ ] Report failed draft creation through the selected operational reporting mechanism, with enough run context to diagnose and retry it. A failed creation cannot be recorded as a successful daily delivery.
- [ ] Successful runs record the created draft and its authenticated preview link. Verify saved state rather than assuming a successful model response means the CMS draft exists.
- [x] New daily runs progress despite earlier drafts remaining unreviewed or unpublished. The routine never publishes articles or schedules publication, including during retries and updates.
- [ ] Verify actual scheduled execution and meaningful checks for same-run retries, duplicate avoidance, independent progress, failure reporting, and draft-only output. Reconfirm the connection's current authentication and content/media permissions before enabling it.

## Notes

- On 2026-10-07, the user delegated the run-time choice and requested their currently logged-in Grok account. The selected time is 09:00 `Asia/Tehran`; the routine was enabled after BL-0102 passed. The native schedule is explicitly `Asia/Tehran`; actual scheduled execution still needs confirmation.

- This completes the recurring drafting criteria in [BL-0087](../now/BL-0087-publish-blog-and-product-guides-with-emdash.md). It is not required for the first blog release.
- Selecting the schedule is an implementation-time rollout input. Do not invent a run time while writing tickets.
- Review is optional. Publication remains a later explicit action outside this routine; a reviewer queue, publication cadence, and conversion attribution remain outside scope.

## Technical verification, 2026-10-09

Implementation `53837203` was independently merged and verified as `2d0cfad6`. The durable original-date journal, saved native receipts, process locking, shared OAuth rotation, draft-only writes, authenticated preview checks and separate reporting acknowledgements passed 14 real CMS daily checks, 5 client checks and 3 wrapper checks. Tests cover concurrent retries, lost mutation responses, crash recovery, human edits, renamed/deleted/published drafts, preview expiry, damaged journals and independent progress on later dates. Fixture reporting receipts are test evidence, not actual Grok Studio delivery.

One native Grok routine is enabled for 09:00 `Asia/Tehran` using the existing Saluna Content Studio account and writing skill. Its actual scheduled creation and Studio success/failure reporting remain unverified. The October 8 rehearsal has a native failed status without a diagnostic; the October 9 02:10 retry slot was overdue without an observed new run or journal record. No manual draft substitutes for scheduled proof. Keep this ticket open until the remaining criteria are observed.

The stable private wrapper now uses the integration checkout. Original articles, guide, accounts, credentials, media and invitation were preserved; only owned test fixtures were removed. Detailed protected evidence is in `bl0103-merger-verification.md` under the local continuation notes.
