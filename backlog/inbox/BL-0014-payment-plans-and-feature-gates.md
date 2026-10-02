---
id: BL-0014
title: Payment plans and feature gates
status: inbox
type: feature
priority: medium
size: large
created: 2026-06-13
updated: 2026-09-07
---

## Problem

The product may need paid plans and gated features as it moves toward monetization.

## Smallest Useful Version

Define plan tiers and gate one non-critical feature behind a server-side entitlement check.

## Acceptance Criteria

- [x] Plan model is documented.
- [ ] Feature gate enforcement lives on the server.
- [ ] UI can explain locked features without breaking workflows.

## Notes

- Original note: "Add payment plans and feature gates".

- Status reviewed on 2026-09-07. `CONTEXT.md` and ADR-0021 through ADR-0037 document the subscription and monetization model. Server entitlement enforcement and locked-feature UI are still outstanding, so this item remains open.
