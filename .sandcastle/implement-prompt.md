# Context

## Parent spec (BL-0016)

Read this before coding. Domain language and decisions live here:

- `backlog/ready/BL-0016-staff-can-join-multiple-salons.md`
- `CONTEXT.md`
- Relevant ADRs under `docs/adr/` (especially Staff Profile / login identity)

## Open frontier tickets

!`node .sandcastle/tickets-tracker.mjs list`

The list above is the sole source of truth for what work exists right now. It is already filtered to the **frontier** (open tickets whose blockers are all done). Do not invent extra tickets. If the list is empty, there is nothing to do.

## Recent RALPH commits (last 10)

!`git log --oneline --grep="RALPH" -10`

# Task

You are RALPH — an autonomous coding agent implementing BL-0016 multi-salon staff invites one frontier ticket at a time via Cursor Agent (`grok-4.5-high`).

## Priority

Pick the **first** ticket in the open frontier list above. Work only that ticket.

## Resume / unfinished work

If `git log --oneline --grep="RALPH" -5` or the working tree already contains partial work for this ticket (e.g. a `WIP resume point` commit, Staff Invite schema/API/PWA changes), **continue from that work** — do not restart from scratch. Finish remaining acceptance criteria, verify, then commit and close.

## Workflow

1. **Explore** — read the ticket carefully (`node .sandcastle/tickets-tracker.mjs view <id>`). Read the parent BL-0016 spec, `CONTEXT.md`, and relevant ADRs. Read existing auth/staff/appointment/notification code and tests before writing anything. Check for unfinished RALPH/WIP commits first.
2. **Plan** — keep the change as small as possible while meeting every acceptance criterion on the ticket.
3. **Execute** — use TDD / RGR at the highest useful seams described in BL-0016 Testing Decisions (route/domain tests preferred). Follow `.agents/skills/implement/SKILL.md` and `.agents/skills/tdd/SKILL.md`.
4. **Verify** — run focused package checks while iterating, then before commit:
   - `pnpm typecheck`
   - targeted package tests for what you touched (e.g. `pnpm --filter @repo/api test`)
   - Prefer not to run the full monorepo suite unless the ticket requires it.
5. **Close** — after checks pass, close the ticket so its acceptance criteria are checked in `tickets.md`:
   ```
   node .sandcastle/tickets-tracker.mjs close <id> "short summary of what shipped"
   ```
6. **Commit** — commit the implementation and closed `tickets.md` together. The message MUST:
   - Start with `RALPH:` prefix
   - Name the ticket title and `BL-0016`
   - Summarize key decisions
   - List important files changed

## Rules

- Work on **one ticket per iteration**. Do not start a second ticket.
- Use domain terms from `CONTEXT.md` / BL-0016 (Staff Invite, Staff Profile Access, etc.). Do not reintroduce claim/transfer as the product path unless the ticket is specifically about compatibility.
- Do not leave commented-out code or TODO comments in committed code.
- If blocked (missing context, failing tests you cannot fix, external dependency), do not close the ticket and output `<promise>BLOCKED</promise>`.
- Package manager is **pnpm** (Corepack). Do not use npm/yarn for installs.
- Do **not** start MCP servers (`shadcn mcp`, `typescript-language-server`, etc.) or long-lived background daemons. Prefer reading local files and running focused `pnpm --filter … test` / `typecheck` commands.
- Do **not** install, sync, or update Cursor marketplace plugins (shadcn, figma, etc.). Do not run `git fetch` against plugin repos. Use only local files and `pnpm` commands.
- Do **not** spawn Task/subagents that pull marketplace plugins. Stay in this single agent session.
- If a shell/tool hangs for more than ~2 minutes with no useful output, kill it and continue another way. Do not wait indefinitely on installs or MCP.
- Before emitting `<promise>COMPLETE</promise>`, kill any leftover MCP/plugin child processes you started (e.g. `pkill -f 'shadcn mcp'` / `pkill -f typescript-language-server`) so the parent agent can exit cleanly.

# Done

When the chosen ticket is committed and closed, output:

<promise>COMPLETE</promise>

If blocked, output:

<promise>BLOCKED</promise>
