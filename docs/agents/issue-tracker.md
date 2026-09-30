# Issue tracker

Work lives in Markdown under `backlog/`. Follow the
[backlog workflow](../../backlog/README.md).

GitHub Issues on `origin` is secondary. Create or mirror a remote issue only
when the user asks.

## Local conventions

- Keep one `BL-NNNN-<slug>.md` file per item and preserve its ID.
- Match the `status` frontmatter to its folder, moving the file when status changes.
- Update `backlog/INDEX.md` when adding or moving an item.
- Use domain terms from `CONTEXT.md`.
- Give subtasks their own files with `parent` and `blocked_by` IDs.

## Publishing work from a skill

Use the template in `backlog/README.md` and the next unused ID. Put new work in
`inbox`, or `ready` if it is specified.

When splitting a feature, retain its parent item. Create each approved task
with `type: task`, `parent`, `blocked_by`, and the appropriate triage label.
Use `ready-for-agent` for tasks ready for agent implementation. Link the tasks
in the parent's `Subtasks` section and nest them in the index.

## Fetching work

Read the referenced backlog file directly. Keep task breakdowns in the backlog
rather than a shared root task document.
