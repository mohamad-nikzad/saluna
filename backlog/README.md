# Saluna Backlog

This backlog is plain Markdown so humans and AI agents can both read, edit, diff, and review it through git.

## Workflow

- `inbox`: raw or unshaped ideas.
- `ready`: reviewed ideas with a clear problem and a small first version.
- `now`: active work or near-term focus. Keep this very small.
- `done`: shipped or intentionally completed.
- `archive`: stale, rejected, or deferred ideas.

Move an item by changing its `status` frontmatter and moving the file to the matching folder.

## Agent Rules

- Keep one backlog item per file.
- Preserve the `id` once created.
- Update `updated` whenever changing status, priority, size, or acceptance criteria.
- Prefer adding notes over deleting historical context.
- Use project language from `CONTEXT.md`, especially `Appointment`, `AppointmentRequest`, `Client`, `Salon Presence`, and `ServiceVariant`.
- Do not move more than one item into `now` unless the user explicitly asks.

## Item Template

```md
---
id: BL-0000
title: Short title
status: inbox
type: feature
priority: medium
size: medium
created: 2026-06-13
updated: 2026-06-13
---

## Problem

What pain, opportunity, or risk does this address?

## Smallest Useful Version

What is the smallest version worth shipping?

## Acceptance Criteria

- [ ] Clear observable outcome

## Notes

- Original note or supporting context.
```
