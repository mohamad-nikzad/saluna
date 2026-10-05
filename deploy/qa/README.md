# Saluna QA on the existing VPS

Staging uses its own database, Docker networks, synthetic salons, and random credentials. It never copies production data. SMS, Bale, Safir, and Telegram delivery are disabled. The internal application network has no outbound internet connection. Browser workers run in Grok's cloud, not on the VPS.

The app, API, web, gateway, and database sleep between runs. A small controller stays running to accept authenticated wake requests. A run lasts at most 60 minutes, including startup. Repeating the same run ID does not extend it. Another run cannot overlap. The controller stops QA after a restart, on expiry, or when the host lacks headroom or production becomes unhealthy.

The five QA services together have limits of 1,280 MiB RAM and 0.7 CPU. The controller adds a 128 MiB and 0.1 CPU limit. Wake requires at least 1,700 MiB available host RAM, 5 GiB free disk, load below 70% of the two host CPUs, and healthy production services. The watchdog stops QA after two pressure readings 15 seconds apart. These controls reduce interference; shared CPU, disk, and network still mean production and QA can affect each other.

## Private URLs and controls

- Public salon: https://staging.saluna.ir/salons/saluna/
- Owner and staff app: https://staging-app.saluna.ir
- API: https://staging-api.saluna.ir

All three hosts require HTTP Basic authentication and return `X-Robots-Tag: noindex, nofollow, noarchive`. The wake controller additionally requires `X-Saluna-QA-Key`. Credentials live in the ignored `.codex/qa/qa-access.local.json`, never in this document, Git, Slack, screenshots, or bot reports.

From this checkout:

```sh
python3 deploy/qa/client.py status
python3 deploy/qa/client.py wake --run-id manual-20261005-01
python3 deploy/qa/smoke.py --staff-privacy
python3 deploy/qa/client.py sleep --run-id manual-20261005-01
```

Wake returns `starting`; poll status until `awake` before opening the browser or running the smoke check. The smoke check can include staff privacy, forbidden-write, unassigned-access, completion, and status-history checks with `--staff-privacy`. It respects sign-in cooldowns. It creates one synthetic customer request, approves it as owner, checks assigned staff visibility and second salon isolation, and cancels only its own appointment. A rejected wake must be skipped, not forced. The run deadline remains authoritative even if a bot crashes. Always call sleep in a `finally` block after browser checks.

## Synthetic fixtures

`scripts/qa-seed.ts` validates the QA database, user, password, and disabled delivery before importing the existing seed. `fixtures.sql` also checks the database and user before publishing the two synthetic salon pages. Owner `09120000000`, staff `09120000001` through `09120000004`, and second owner `09130000000` use the random QA password. Public customer request tests can use `09129900999`; delivery remains disabled.

Keep each run's created appointment and request IDs in its report. Use those IDs for subsequent confirmation, staff visibility, cancellation, and cleanup checks. Avoid parallel persona runs and load tests. Do not delete unrelated records or connect to production URLs. Data persists across sleep; waking does not reseed or reset it.

Verify staff identity through `/api/v1/auth/me` before privacy checks. Inspect Client fields separately from Staff contact fields; an unrelated Staff phone in an appointment payload is not a Client privacy failure. Never flip a seeded appointment's status merely to probe a permission.

## Updating staging

Use the updater from the workstation to stage a committed `main` revision, then send the exact Slack command it prints:

```sh
python3 deploy/qa/update.py --source /Users/mohamad/Projects/saluna --ref main --focus "staff appointment status and client privacy"
```

Choose another branch or commit with `--ref`. To include current uncommitted work, use `--working-tree` instead of `--ref`. The updater copies the selected source into an ignored local build directory and does not change the source checkout. It excludes env files and `.codex`, adds the QA integration hooks, and gives the snapshot its own content-based revision. Builds and type checks run locally. It transfers runtime images at a limited rate, obtains a bounded QA lease, applies migrations only to the QA database, verifies readiness, and leaves staging asleep. A busy QA session or insufficient host/disk headroom blocks the update. It never changes production Compose services or runs a production deployment.

If the workstation VPN route cannot reach the VPS, prefix QA commands with `SALUNA_QA_NETWORK_INTERFACE=en0` on macOS to use the existing physical interface. This selects a connection interface without changing network settings or HTTPS certificate validation.

If a session is busy after the build, the updater prints a `--resume <release metadata path>` command. Resume reuses the built images and checksum-matching uploaded archive, rather than rebuilding or transferring it again. Wait until the current session sleeps; do not force it to stop.

Then send in private `#saluna-reviews`:

```text
RUN QA REV <revision printed by the updater> FOCUS staff appointment status and client privacy
```

`RUN QA <focus>` tests the currently deployed staging revision. QA Lead checks the actual controller revision and reports it with the result. An explicit revision mismatch stops the test and requests a staging update. Growth Lead accepts only the configured owner and deduplicates Slack messages. The existing connector polls every 15 minutes, so on-demand dispatch can take up to that long. Directly messaging QA Lead also works. Tests wake staging for their bounded session and sleep it afterward.

Build Linux amd64 images on the workstation, then transfer runtime images. Do not build on the VPS. Initial image tags identify base revision `ec2c4641`, with the QA configuration and private SSR API routing changes in this checkout. Updates are deliberate and do not follow production deploys automatically.

```sh
docker build --platform linux/amd64 --target build -f apps/api/Dockerfile -t saluna-qa-api-build:ec2c4641 .
docker build --platform linux/amd64 -f apps/api/Dockerfile -t saluna-qa-api:ec2c4641 .
docker build --platform linux/amd64 -f deploy/qa/Dockerfile.tools --build-arg QA_BUILD_IMAGE=saluna-qa-api-build:ec2c4641 -t saluna-qa-tools:ec2c4641 .
docker build --platform linux/amd64 -f apps/pwa/Dockerfile --build-arg VITE_API_BASE_URL=https://staging-app.saluna.ir --build-arg VITE_APP_URL=https://staging-app.saluna.ir --build-arg VITE_WEB_URL=https://staging.saluna.ir --build-arg VITE_PWA_ASSET_VERSION=qa-ec2c4641 -t saluna-qa-pwa:ec2c4641 .
docker build --platform linux/amd64 -f apps/web/Dockerfile --build-arg PUBLIC_APP_URL=https://staging.saluna.ir --build-arg PUBLIC_API_URL=https://staging.saluna.ir --build-arg PUBLIC_MANAGER_APP_URL=https://staging-app.saluna.ir -t saluna-qa-web:ec2c4641 .
docker build --platform linux/amd64 -f deploy/qa/Dockerfile.control -t saluna-qa-control:1 .
```

The VPS installation lives in `/opt/saluna/qa`, owned by `deploy`, with mode 700. `.env.qa.local` is mode 600 and contains only QA secrets. The Docker projects are `saluna-qa` and `saluna-qa-control`. Use the absolute Compose path and env file for every server command. Migrate with the tools profile, seed, then apply `fixtures.sql` through QA Postgres. Stop the five QA services before starting the controller.

The production gateway includes only a new `saluna-qa.conf` for the three staging names. Only the QA gateway and controller join its private Docker network, `saluna_saluna`. The other QA services stay on their isolated backend network. Staging publishes no host ports. Install its template and htpasswd file in the existing templates mount, copy the config into the running gateway, run `nginx -t`, and reload only when validation passes. Do not recreate production containers.

## Grok browser routing

Grok browser traffic now uses cloud routing with the owner's approval. In Grok Settings → Computer, “Route traffic through this computer” is off. Leaving it on makes scheduled browser checks depend on this Mac being online and its VPN route reaching staging. A routing change applies to new connections. Keep TLS and staging authentication enabled. An API pass does not count as a browser pass; report transport failures separately. Persona bots use their approved private access files and QA Lead owns the controller lease.

## Recovery

If the controller is unavailable, SSH as `deploy` and stop only QA:

```sh
docker compose --project-name saluna-qa --env-file /opt/saluna/qa/.env.qa.local -f /opt/saluna/qa/compose.yaml stop --timeout 10 gateway pwa web api postgres
```

Disabling the three staging DNS records or removing the QA nginx config does not modify the live domains. Never use global Docker prune or remove production volumes. The QA database volume is `saluna-qa_qa_database`.

## Validation

```sh
python3 deploy/qa/control_test.py
python3 deploy/qa/update_test.py
docker compose --env-file deploy/qa/.env.qa.local -f deploy/qa/compose.yaml config -q
docker compose --env-file deploy/qa/.env.qa.local -f deploy/qa/control.compose.yaml config -q
```

Deployment verification should cover private access, seed account login, the public salon page, same-origin browser API requests, wake/status/sleep, stopped QA containers after sleep, and unchanged healthy production containers. The current main working-tree snapshot, `qa-ec2c4641-0693b69c9af4`, passed the focused API smoke and a cloud browser journey for Customer request, Owner approval/assignment, and Staff no-show and Client privacy. Cleanup cancelled the run's Appointment and staging was independently verified asleep. See `VALIDATION.md` for scope and evidence. Nightly QA is enabled at 02:00 Asia/Tehran; its first unattended run is pending. The existing Slack poll accepts on-demand QA every 15 minutes. The 18:00 build-check routine stays paused because staging updates are manual.
