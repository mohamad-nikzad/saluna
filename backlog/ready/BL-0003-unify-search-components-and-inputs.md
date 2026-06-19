---
id: BL-0003
title: Unify search components and inputs
status: ready
type: improvement
priority: high
size: small
created: 2026-06-13
updated: 2026-06-13
---

## Problem

Search inputs and text inputs may be implemented inconsistently across the app, which creates UI drift and extra maintenance.

## Smallest Useful Version

Create or standardize one shared input/search pattern using the existing design system and shadcn-style grouped input where appropriate.

## Acceptance Criteria

- [ ] Identify duplicated search/input implementations.
- [ ] Choose one reusable component or composition pattern.
- [ ] Replace the highest-traffic duplicated cases.
- [ ] Preserve keyboard behavior, labels, and accessibility.

## Notes

- Original note: "unify search components and inputs, use shadcn group input".
