# Sandcastle — BL-0016 multi-salon staff invites

Orchestrates Cursor Agent (`grok-4.5-high`) to implement frontier tickets from repo-root `tickets.md`, with a review pass after each ticket.

## Prerequisites

- Docker running
- Cursor Agent CLI logged in (`cursor-agent status`) **or** a `CURSOR_API_KEY`
- Repo dependencies installed (`pnpm install`)
- Host Cursor plugin cache at `~/.cursor/plugins/cache` (avoids agent startup hang on marketplace fetch)

## One-time setup

```bash
# 1. Auth for the sandbox (Keychain session → .sandcastle/cursor-auth/auth.json)
pnpm sandcastle:sync-cursor-auth
# or set a real dashboard CURSOR_API_KEY in .sandcastle/.env (not a Keychain JWT)

# 2. Build the sandbox image
pnpm sandcastle:build
```

## Hang / OOM notes

- Cursor Agent auto-syncs marketplace plugins (e.g. shadcn) on first start. Without a warm
  cache that can hang forever on `git fetch` of `github.com/shadcn-ui/ui`. Sandcastle mounts
  the host `~/.cursor/plugins/cache` into the sandbox to prevent that.
- An empty `~/.cursor/mcp.json` is mounted so the agent does not auto-start shadcn MCP
  (MCP + language servers previously OOM-killed the container on ~8GiB Docker Desktop).
- The cached shadcn plugin manifest is overlaid without its MCP declaration, and
  Cursor auto-update is disabled inside ephemeral containers.
- Only one `pnpm sandcastle` at a time (`.sandcastle/sandcastle.lock`). Concurrent runs
  fight over Docker memory and get SIGKILL'd (exit 137).
- `.sandcastle/corepack-cache` persists the repo's pinned pnpm binary and
  `.sandcastle/pnpm-store` persists downloaded packages. `.sandcastle/npm-cache`
  keeps Cursor helper downloads. Each sandbox installs offline first and contacts
  npm only for cache misses.

## Run

```bash
pnpm sandcastle
```

Each iteration:

1. Lists the **frontier** from `tickets.md` (open tickets whose blockers are done)
2. Implements the first frontier ticket with Cursor Agent + `grok-4.5-high`
3. Reviews the branch
4. Closes the ticket by checking off its acceptance criteria in `tickets.md`

## Tracker commands

```bash
node .sandcastle/tickets-tracker.mjs list
node .sandcastle/tickets-tracker.mjs view create-manager-staff-invites
node .sandcastle/tickets-tracker.mjs close create-manager-staff-invites "summary"
```

## Spec

- Parent: `backlog/ready/BL-0016-staff-can-join-multiple-salons.md`
- Tickets: `tickets.md`
