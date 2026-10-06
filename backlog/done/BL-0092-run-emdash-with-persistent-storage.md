---
id: BL-0092
title: Run EmDash with persistent storage
status: done
type: task
triage: ready-for-agent
priority: medium
size: medium
parent: BL-0087
blocked_by: []
created: 2026-10-06
updated: 2026-10-06
---

## Problem

The public web deployment has no CMS runtime or durable content storage. Editor work must survive replacement of the web container.

## Smallest Useful Version

Run a pinned EmDash release inside the existing Astro/Node deployment, with separate CMS Postgres access and durable media. Prove that the production image can serve authenticated CMS administration and retain a saved content fixture and uploaded image across container replacement.

## Acceptance Criteria

- [x] Select and pin an EmDash release after checking its supported Node and Astro versions. Update the web runtime and relevant engine declarations to meet those requirements.
- [x] The built production image starts and serves the CMS editing area in the existing public web deployment. Existing landing-page and public Salon checks still pass.
- [x] CMS content uses a dedicated Postgres database or schema and a separate database role. CMS credentials do not grant access to Salon operational data.
- [x] An authenticated operator saves a content fixture and uploads an image. Both remain readable after replacing the web container, with media stored outside its replaceable filesystem.
- [x] Provisioning, migrations, durable media configuration, runtime secrets, and required encryption keys have repeatable deployment instructions. Secrets are not included in public output or committed configuration.
- [x] Verify startup and persistence against the production image and real CMS storage, rather than relying only on the development server.

## Notes

- Parent scope and deployment boundary are defined in [BL-0087](../now/BL-0087-publish-blog-and-product-guides-with-emdash.md) and [ADR-0040](../../docs/adr/0040-emdash-for-public-content.md).
- This task proves CMS operation and container replacement. Blog Article fields and editor roles follow in BL-0093; upgrade and backup restoration rehearsals follow in BL-0097.
- The manager PWA remains at `app.saluna.ir`.

## Implementation and verification

Completed on 2026-10-06. EmDash 1.1.0 is pinned in the web workspace. The web
image and shared build defaults use Node 22.16.0; Astro 6.4.2 meets the selected
release's peer requirement. CMS credentials resolve at runtime and cannot use
the operational database or login.

[The deployment runbook](../../docs/EMDASH_DEPLOYMENT.md) covers provisioning,
locked automatic core migrations, the durable media volume, secrets, encryption
key retention, and the repeatable production-image rehearsal. The non-root image
prepares writable media and Astro session directories. Login sessions can expire
on replacement; the passkey and content remain persistent.

Verified with the Linux amd64 production image, Postgres 16, and a browser virtual
passkey through real production authentication. The same draft, media metadata,
and exact uploaded PNG bytes survived replacement with a different container
using the same image. The authenticated operator reopened the saved draft in the
CMS. CMS access to operational databases was denied, anonymous content access
returned 401, and the client/server build output contained no runtime CMS secrets.
All 25 web tests, typecheck, lint, and existing landing/public Salon smoke checks
passed. The smoke checks used a separate seeded API database and also passed
after container replacement.

Live deployment was not performed. Operators must supply private credentials,
provision the CMS database, and register their initial passkey using the runbook.
The parent remains open; Blog Article fields and editor access follow in BL-0093.
