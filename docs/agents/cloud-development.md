# Cloud development and review

The 2026-10-12 trial ran the real manager PWA, Hono API, Better Auth password
login, and PostgreSQL in the current cloud workspace. No requests or application
responses were mocked in the browser journeys. BL-0106 passed at 320px and
1280px widths, including persisted selection after reload, filtered bulk actions,
empty-selection validation, discard, and unrestricted mode.

This verifies the affected manager workflow, not every screen or external
provider. SMS, Telegram, Bale, and Safir delivery remain disabled. Public web,
platform admin, and the CMS were not part of this trial.

## Reusable startup

Provision the worker once with Node, repository dependencies, pnpm 9.15.9,
local PostgreSQL, and Chromium. `.env.local` must describe a local development
PostgreSQL server with permission to create a separate database. Do not supply
production configuration. The current worker already had these prerequisites.
It needed only Playwright's small FFmpeg download for its configured failure
videos.

From the repository root:

```sh
node scripts/cloud-dev.mjs prepare
node scripts/cloud-dev.mjs start
```

Keep `start` running in a retained terminal. In another terminal:

```sh
# One-time installation if Playwright reports that its video recorder is absent:
node scripts/cloud-dev.mjs exec playwright install ffmpeg

# Real browser regression for the changed staff-services flow:
node scripts/cloud-dev.mjs test

# Select another appropriate E2E file when the task changes:
node scripts/cloud-dev.mjs test e2e/critical-flows.spec.ts
```

`prepare` creates `saluna_cloud_dev`, applies checked-in migrations, and seeds
demo data on first initialization. Subsequent preparation preserves the demo
state and applies new migrations. `seed` explicitly refreshes the existing demo
fixtures. Secrets and configuration stay under ignored `.codex/cloud-dev/`.
The original development database and `.env.local` are preserved. Stop the
owned development server with Ctrl+C when the session is finished.

The helper uses the worker's installed pnpm 9.15.9 when available; otherwise set
`SALUNA_CLOUD_PNPM_BIN` to that version's binary. Set
`PLAYWRIGHT_CHROMIUM_EXECUTABLE_PATH` when Chromium is elsewhere. The database
name can be selected with `SALUNA_CLOUD_DEV_DB` before initial preparation;
reuse that setting for subsequent commands in the same checkout.

The PWA serves on `http://localhost:3000`, with same-origin API requests proxied
to the real API on port 3002. Demo manager `09120000000` and staff
`09120000001`–`09120000004` use the local demo password `admin123`.
The `test` command targets localhost and defaults to the staff-services
regression. Tests restore the Staff Profile service selection they changed.

Turbo starts with `--env-mode=loose` so the generated test configuration reaches
the API. Its ordinary strict environment filtering would otherwise omit these
overrides and allow application loaders to fall back to the root configuration.

In the prepared worker, repeated `prepare` took 2.17 seconds. Both full browser
journeys took about one minute. These measurements exclude dependency installation
and initial infrastructure provisioning. First use also uncovered and fixed a
stale login-helper heading selector.

## Human review link

The current toolset has no remote port-sharing operation or configured inbound
route for the worker's development server. A localhost or container-network URL
is not accessible from the user's device. No live full-app review URL was
produced by this trial.

The separately hosted ChatGPT Site remains a demo with browser-local storage;
it does not connect to this PostgreSQL database or running API.

For the intended workflow, add either authenticated remote port sharing or a
branch preview deployment using an isolated test backend/database. Configure
Better Auth's base URL and trusted PWA origin for that actual preview URL before
review. Test it through the shared origin, including login and cookie sessions.

The repository already describes an existing private staging workflow in
`deploy/qa/README.md`. Its access configuration was absent from this worker, so
this trial did not update or wake staging. A staging review must identify the
exact branch or working-tree revision under test; an older deployed revision
cannot verify the current change.

Until that access step is configured, cloud agents can run the full manager app,
perform real browser checks, and provide screenshots or Playwright reports.
Interactive human review remains a separate setup gap. Deploying a new static
ChatGPT Site for each task is unnecessary and does not resolve that gap.
