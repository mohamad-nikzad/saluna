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

## Parent Features and Subtasks

Large features may be split into independently executable subtasks. Every parent and subtask remains a separate backlog file; do not create a shared `tickets.md`.

- A subtask declares `parent: BL-NNNN` in frontmatter.
- A subtask declares `blocked_by: []` or a list of blocking backlog IDs.
- A ready subtask uses `type: task` and `triage: ready-for-agent` when an agent can implement it without more context.
- The parent links its children under a `## Subtasks` section.
- `backlog/INDEX.md` nests subtask links beneath the parent instead of listing them as unrelated top-level work.
- A subtask may start when every ID in `blocked_by` is `done`. Work the unblocked frontier one ticket at a time.

## Item Template

```md
---
id: BL-0000
title: Short title
status: inbox
type: feature
triage: needs-triage
priority: medium
size: medium
parent: BL-0000
blocked_by: []
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

Omit `parent` for top-level items. For subtasks, replace the placeholder with the real parent ID and use `type: task`.
