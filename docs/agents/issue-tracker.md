# Issue tracker

Saluna uses local Markdown in `backlog/` for all engineering specs and tickets.
Read [the backlog workflow and template](../../backlog/README.md).

This configuration overrides skill defaults. A GitHub remote is for source
control, not tracker selection. Create remote issues or PRs only when the
user explicitly requests them. Skill setup must preserve this tracker and
must not create a `.scratch/` tracker, shared `tickets.md`, or remote labels.

## Read and write

- Fetch an item by its path, or locate its `BL-NNNN` ID in `backlog/INDEX.md`.
- Keep one `BL-NNNN-<slug>.md` file per item. Use the next unused ID for new
  work; preserve IDs when editing or moving items.
- Match `status` to the folder. New unshaped work goes in `inbox`; specified
  work goes in `ready` with `triage: ready-for-agent`.
- Update `updated` when status, priority, size, or acceptance criteria change.
- Use `GLOSSARY.md` terms and the labels in [triage-labels.md](triage-labels.md).
- Update `backlog/INDEX.md` when adding or moving work.

## Skill operations

- `to-spec`: save the spec as a parent backlog item with backlog frontmatter,
  the skill's spec sections, and observable acceptance criteria.
- `to-tickets`: save each approved task as its own file with `type: task`,
  `parent`, and `blocked_by` IDs. Link tasks under the parent's `Subtasks`
  section and nest them in the index. Preserve the parent's scope and status.
- `implement-spec`: read the parent and tasks, work tasks whose blockers are
  `done`, and mark each verified completion `done`. Move completed files to
  `backlog/done/` and update all affected index and parent links. Complete the
  parent only when its full acceptance criteria are met.
- `code-review`: resolve `BL-NNNN` references in commit messages to local
  backlog files; read their specs and acceptance criteria directly.

Keep at most one item in `now` unless the user authorizes more. Preserve
historical notes when recording progress or completion.
