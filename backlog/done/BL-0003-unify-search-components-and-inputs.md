---
id: BL-0003
title: Unify search components and inputs
status: done
type: improvement
priority: high
size: small
created: 2026-06-13
updated: 2026-07-14
---

## Problem

Search inputs and text inputs may be implemented inconsistently across the app, which creates UI drift and extra maintenance.

## Smallest Useful Version

Create or standardize one shared input/search pattern using the existing design system and shadcn-style grouped input where appropriate.

## Acceptance Criteria

- [x] Identify duplicated search/input implementations.
- [x] Choose one reusable component or composition pattern.
- [x] Replace the highest-traffic duplicated cases.
- [x] Preserve keyboard behavior, labels, and accessibility.

## Notes

- Original note: "unify search components and inputs, use shadcn group input".
- Shared pattern: `@repo/ui/search-input` composed from `InputGroup` (search icon + `type="search"` + optional clear, off by default).
- Replaced PWA call sites: clients list, clients skeleton, service catalog, service addons, public-page services (clearable), client import preview, client import guides.
- Left alone for now: `CommandInput` (cmdk), drawer-chrome search bars (client/staff pickers, calendar filters), admin table toolbar (admin is isolated from `@repo/ui`).
