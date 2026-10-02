# Use EmDash for Saluna's public content

Saluna will use EmDash in the existing Astro `apps/web` application to let nontechnical editors publish Blog Articles and Product Guides at `saluna.ir/blog/` and `saluna.ir/guides/`. The public content remains separate from the manager product at `app.saluna.ir`. Run EmDash on Saluna's Node.js/VPS deployment with its own Postgres data and durable media storage; choosing EmDash does not require moving the site to Cloudflare Workers.

## Considered options

- **Sanity.** Its independent content service and established collaborative editor would suit content rendered by several applications. For the current public website, it adds a foreign hosted API dependency to a deployment that explicitly plans for interrupted international connectivity. Live publishing would require runtime access from the VPS; static publishing would require automating the currently manual deployment flow. Revisit Sanity if several independent apps need the same structured content or EmDash's editor fails the actual writer's trial.
- **Markdown in Git or a custom CMS.** Neither gives the nontechnical content editor the publishing workflow they need without developer involvement or ongoing custom CMS maintenance.
- **A separate blog or help app/domain.** The existing Astro public site can serve both sections and link to them from the manager app. Split them only when independent releases, search, versioning, or multiple consuming products make that boundary useful.

## Consequences

- EmDash's admin, public content routes, and content runtime share the web deployment. Keep CMS data separate from Salon operational data, back up the database and media independently, and check CMS health as well as the existing landing-page health check.
- Content model changes, runtime upgrades, and media storage become Saluna operations. The current web Docker image defaults to Node 22.12.0; verify and raise it to EmDash's supported version before integration.
- Preserve Saluna's Persian design and existing canonical, Open Graph, and sitemap behavior when adding CMS pages. The editor's Persian RTL interface must pass a hands-on trial: Persian is enabled upstream, but the translation catalog was incomplete on 2026-09-29.
- Blog Articles and Product Guides are separate content types in one CMS. Guide videos are referenced from a video host/CDN rather than stored as large uploads in the web container. Product staff review guides when the corresponding user flow changes.

Implementation evidence and open checks are in [the public content CMS research note](../research/2026-09-29-public-content-cms.md). The implementation is tracked by [BL-0087](../../backlog/inbox/BL-0087-publish-blog-and-product-guides-with-emdash.md).
