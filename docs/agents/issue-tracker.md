# Issue tracker: Local Markdown (`backlog/`)

Work for this repo lives as plain Markdown under `backlog/`. See `backlog/README.md` for the full workflow.

GitHub Issues (`origin` → `github.com/mohamad-nikzad/saluna`) is a secondary surface — use it only when the user explicitly asks to mirror or open a remote issue.

## Conventions

- **Folders by stage**: `backlog/inbox`, `backlog/ready`, `backlog/now`, `backlog/done`, `backlog/archive`
- **One item per file**: `BL-NNNN-<slug>.md` (preserve `id` once created)
- **Status**: YAML frontmatter `status` field (`inbox` | `ready` | `now` | `done` | `archive`) — move the file when status changes
- **Index**: `backlog/INDEX.md` lists items; update when adding or moving items
- **Language**: use terms from `CONTEXT.md` (`Appointment`, `AppointmentRequest`, `Client`, etc.)
- **Parent/subtask relationships**: each parent and subtask is its own backlog file; subtasks declare `parent` and `blocked_by` IDs in frontmatter
- **Publishing ticket breakdowns**: create per-ticket backlog files and nest them under their parent in `backlog/INDEX.md`; do not create a shared root `tickets.md`

## When a skill says "publish to the issue tracker"

Create a new file under `backlog/inbox/` (or `backlog/ready/` if already shaped), using the template in `backlog/README.md`. Assign the next `BL-NNNN` id.

When publishing subtasks from a spec, keep the spec as the parent item. Create each approved vertical slice as a separate `type: task` file with `parent: BL-NNNN`, `blocked_by`, and the `ready-for-agent` triage role. Add a `## Subtasks` section to the parent and nest the ticket links beneath it in the index. Do not close or replace the parent.

## When a skill says "fetch the relevant ticket"

Read the file at the referenced path (e.g. `backlog/ready/BL-0041-service-catalog-big-bang-migration.md`).

## Wayfinding operations

Used by `/wayfinder`. The **map** is a parent file with **child** ticket files.

- **Map**: `backlog/<effort>/map.md` — Notes / Decisions-so-far / Fog body
- **Child ticket**: `backlog/<effort>/BL-NNNN-<slug>.md` with the question in the body. Frontmatter records `type` (`research` | `prototype` | `grilling` | `task`) and `status` (`claimed` | `resolved`)
- **Blocking**: a `blocked_by: [BL-NNNN, ...]` frontmatter field (or `## Blocked by` section). A ticket is unblocked when every blocker is `done` or `resolved`
- **Frontier**: scan child tickets for open, unblocked, unclaimed items; lowest id first
- **Claim**: set `status: now` (or a dedicated `claimed` status) before work begins
- **Resolve**: append the answer under `## Answer`, set `status: done`, then gist + link in the map's Decisions-so-far
