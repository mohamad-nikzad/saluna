---
id: BL-0073
title: Keep AppointmentRequest status pages out of search
status: ready
type: task
triage: ready-for-agent
priority: high
size: small
parent: BL-0069
blocked_by: []
created: 2026-07-26
updated: 2026-07-26
---

## Parent

[BL-0069 Improve public Salon pages for local organic search](BL-0069-improve-public-salon-local-seo.md)

## What to Build

Prevent token-bearing AppointmentRequest status pages from being advertised for
search indexing while leaving the customer status flow usable through its
private link.

## Acceptance Criteria

- [ ] Every token-bearing AppointmentRequest status page emits both `noindex` and `nofollow` robots directives.
- [ ] Public Salon landing pages retain their normal indexable metadata.
- [ ] The status page continues to load, display state, and support its existing customer actions.
- [ ] A rendered HTML test proves the robots directives are present on the private status page.

## Blocked By

None — can start immediately.
