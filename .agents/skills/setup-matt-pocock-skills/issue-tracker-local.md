# Issue tracker: Local Markdown (`backlog/`)

Work for this repo lives as plain Markdown under `backlog/`. See `backlog/README.md` for the full workflow.

## Conventions

- **Folders by stage**: `backlog/inbox`, `backlog/ready`, `backlog/now`, `backlog/done`, `backlog/archive`
- **One item per file**: `BL-NNNN-<slug>.md` (preserve `id` once created)
- **Status**: YAML frontmatter `status` field (`inbox` | `ready` | `now` | `done` | `archive`) — move the file when status changes
- **Index**: `backlog/INDEX.md` lists items; update when adding or moving items
- **Language**: use terms from `CONTEXT.md` (`Appointment`, `AppointmentRequest`, `Client`, etc.)

## When a skill says "publish to the issue tracker"

Create a new file under `backlog/inbox/` (or `backlog/ready/` if already shaped), using the template in `backlog/README.md`. Assign the next `BL-NNNN` id.

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
