---
id: BL-0087
title: Publish Blog Articles and Product Guides with EmDash
status: now
type: feature
triage: ready-for-agent
priority: medium
size: large
created: 2026-09-29
updated: 2026-10-07
---

## Problem Statement

Saluna has no self-service publishing path for a nontechnical content editor. Prospective Salon Owners need useful answers to salon-management questions before choosing software. Managers need public Product Guides that explain Saluna tasks with written steps, screenshots, and optional video, without requiring product login to read the instructions.

## Solution

Integrate EmDash into the existing Astro public site on `saluna.ir`, following [ADR-0040](../../docs/adr/0040-emdash-for-public-content.md). Start with Persian Blog Articles at `/blog`, using Saluna's RTL design. Editors can save private drafts and publish their own or another editor's content without a code change or deployment. A different reviewer is not required. Public credit defaults to `تیم سالونا`, with named authors supported independently of the writing account. Articles support optional cover and inline images, a branded social-preview fallback, and a relevant signup link.

Prepare three first-batch drafts on Staff Commission calculations, organizing AppointmentRequests, and useful Client records. This content milestone is complete when all three exist as drafts and have preview links. Publication is an optional later action by an authorized editor and is not a prerequisite for completing this batch. Product Guides at `/guides` and links from relevant manager PWA screens follow later. Daily Grok drafting is another later phase and does not wait for Product Guides or earlier drafts to be published.

## User Stories

1. As a prospective Salon Owner, I want useful Persian Blog Articles about salon-management problems, so that I can understand those problems and decide whether to start a Saluna Trial.
2. As a nontechnical writer, I want to draft, revise, preview, and illustrate an article before publishing it, so that I can prepare content without developer help.
3. As an authorized content editor, I want to publish, revise, and unpublish my own or another editor's article without CMS administration or Salon operational access, so that I can control what visitors read.
4. As a visitor, I want readable RTL articles with a clear byline and working links, so that I can read and share them on the public site.
5. As an operator, I want persistent CMS content and media with a rehearsed recovery procedure, so that container replacement and upgrades do not lose the publishing work.
6. As a salon manager, I want public Product Guides linked from relevant product screens, so that I can follow accurate steps for a Saluna task.
7. As the person responsible for content, I want a later Grok routine to create one new draft each day without publishing it or waiting for earlier drafts, so that I have a continuing supply of articles to use when ready.

## Implementation Decisions

- EmDash admin, content runtime, and public templates share the existing Astro/Node web deployment on the VPS. The manager PWA stays at `app.saluna.ir`. CMS access does not confer product authentication or Salon operational access.
- CMS persistence uses a dedicated Postgres database or schema and a separate database role. Media lives in durable storage outside the container's replaceable filesystem. Backups include content, media, and required encryption keys. Document provisioning, migrations, runtime secrets, upgrade, restore, and CMS health checks within the existing deployment process.
- Select and pin an EmDash release, then check its runtime and Astro requirements. The current web image and declared engine minimum use Node 22.12.0. The current [existing-project guide](https://docs.emdashcms.com/existing-project/) requires Node 22.16 or later and Astro 6 or later. Raise the web runtime and relevant declarations to satisfy the selected release and test the production image, rather than treating development startup as deployment proof.
- Enable revisions so saving changes stages a draft separately from the live revision. Public templates read published revisions at request time. Authenticated previews read the draft, carry a noindex policy, and do not share cached responses with anonymous visitors. Publishing and withdrawal must affect the next public request, including list and sitemap discovery.
- Use EmDash's supported content roles for authorized editors. The same editor may draft and publish an article; no separate reviewer identity or approval is required. The [role guide](https://docs.emdashcms.com/guides/authentication/) permits Authors to publish their own content and Editors to manage other users' content. Grant only the access needed for the editor's work and keep CMS administration and Salon operational access separate.
- The agent connection uses the installed release's supported MCP or remote CLI with a dedicated identity and the minimum supported content/media access needed to complete drafting. Explicitly keep create/update operations as drafts. The first-batch drafting job and daily Grok routine do not publish or schedule publication. The [MCP reference](https://docs.emdashcms.com/reference/mcp-server/) checks scopes and roles separately; verify successful draft creation, revision, preview, and required image operations with the chosen identity. No mandatory approval workflow or custom publication-denial layer is required.
- Blog Articles have a title, stable slug, summary, rich text body, reusable public byline, optional cover and inline images, and page-specific SEO fields. Default credit is `تیم سالونا`. The editor's login does not automatically determine public authorship.
- Extend the existing public layouts, navigation, and shared metadata rendering for article output. Use one canonical and metadata path, article structured data, and a branded social image when no cover exists. Discover published CMS URLs through a runtime sitemap advertised to crawlers, while preserving existing static and public Salon sitemaps. Follow the site's existing canonical convention without a trailing slash; slash variants permanently redirect to the canonical URL.
- Ordinary title or body edits preserve the slug. An explicitly published slug change permanently redirects the former URL to the new canonical URL. Unknown, unpublished, and deleted content returns 404, including access through former URLs. Draft slug changes do not change live routing before publication. Sitemaps list only current published canonical URLs.
- An agent prepares the three agreed launch articles from current product behavior and glossary terms. The Staff Commission article includes worked examples consistent with Eligible Commission Basis and Commission Agreement behavior. Deliver all three as drafts with preview links. An authorized editor may later publish them, including their own drafts; batch completion does not depend on review or publication. Signup links are included, while article-to-signup attribution remains separate work.
- Product Guides are a later, separate content type and template within the same CMS. They contain ordered steps, screenshots, an optional externally hosted video and transcript, related guides, and a last-reviewed date or reviewer. Product staff own accuracy after UI changes. The guide phase includes at least one relevant manager PWA link and its own real-editor trial.
- Later Grok drafting uses a Saluna writing skill specifying prospective Salon Owners as the audience, allowed salon-management subjects, current product sources, required article fields, public credit, optional images, and draft-only delivery. Subjects include Staff Commission, AppointmentRequest handling, Client records, and staff scheduling. Check overlap with existing content without waiting for review. Key retries to the same daily run to avoid duplicate drafts, report failed creation, and choose the `Asia/Tehran` run time when enabling the routine. Publishing is a later explicit action outside the drafting routine, with no mandatory second reviewer.

## Testing Decisions

- Test what users and visitors can do and read. Assert visible editor actions, supported agent responses, rendered HTML, status codes, and discovery output. Avoid tests of internal CMS tables, private helpers, or calls made between modules.
- Use one primary end-to-end publishing journey against the real Astro/EmDash application and CMS persistence. A writer creates a Persian draft, uploads an image, previews it, and revises it. The same authorized editor can publish it, anonymous visitors read it, a subsequent draft edit leaves live content unchanged, and republishing then unpublishing changes public output without a build or deployment.
- Verify that an authorized editor can publish their own draft and that an editor with the appropriate content role can publish another user's draft. Check successful draft creation, revision, preview, and required image operations through the supported agent interface. Verify that first-batch and daily drafting jobs leave their output as drafts and never request publication or schedule it. Content editor accounts do not gain CMS administration or Salon operational access.
- Extend the existing public-web HTTP smoke checks for the Blog Article index, detail pages, metadata, structured data, social image responses, sitemap discovery, preview privacy, canonical redirects, renamed URLs, and 404 after withdrawal. Use real publication state changes for the lifecycle checks. Keep the existing landing page and public Salon checks as regression coverage.
- Reuse the existing web Vitest/Astro rendered-layout and sitemap response tests for focused metadata cases, missing optional images, default and named bylines, and published-only discovery. Prior art is the shared Head rendering tests, public Salon SEO tests, runtime Salon sitemap tests, and the complete local-search journey in BL-0075.
- Reuse Playwright's role-based user interactions and failure artifacts for the editor journey. Its current startup targets the manager PWA, so provide a CMS/web test target with an isolated CMS fixture rather than assuming the existing server setup runs EmDash. The later guide phase also verifies a manager-screen link to the correct public guide.
- Automated checks do not replace the intended editor's staging trial. Have that editor write Persian text, upload an image, preview, publish, revise, and unpublish with the appropriate accounts. Record and resolve unacceptable untranslated UI or RTL formatting. Separately rehearse media survival across container replacement, upgrade, and a content/media/key restore on staging. Production smoke checks must detect unavailable CMS content and editing dependencies.
- When enabled later, test Grok draft creation, repeated execution of the same daily run without duplicates, independent progress despite unreviewed drafts, and failure reporting. Verify the selected connection's permissions again at that point.

## Acceptance Criteria

### First Blog Article release

- [ ] An authorized nontechnical editor can draft, preview, publish, revise, and unpublish a Persian Blog Article without a code change or Saluna deployment. Draft changes to an existing article remain separate from its live version.
- [ ] An authorized editor can create, preview, revise, and publish their own article without a separate reviewer. An editor with the appropriate role can also publish another editor's article. Verify content operations through the admin and draft creation, revision, preview access, and required image operations through the supported agent interface, without granting CMS administration or Salon operational access.
- [x] Blog Articles support a title, stable slug, summary, rich text body, public byline, optional cover image and inline images, and page-specific SEO metadata. Public credit defaults to `تیم سالونا` and can be changed to a named author independently of the writing account.
- [x] The public `/blog/` index and individual pages use Saluna's Persian RTL design and are reachable through site navigation. Articles include a relevant signup link. An article without a cover image uses a Saluna-branded social preview.
- [x] Published articles return crawlable HTML with one canonical URL, page-specific title/description, article structured data, and inclusion in a discoverable public sitemap. Anonymous requests cannot read draft or preview content. Preview responses are not indexable and cannot enter a shared public cache. Drafts and unpublished pages are not publicly listed or indexed; existing public Salon sitemap behavior remains intact. Use one metadata path, extending the shared helper where necessary for article metadata.
- [x] Publishing, republishing, or unpublishing takes effect on the next public request without rebuilding or replacing the web image. Ordinary edits preserve the slug. An explicitly renamed published URL permanently redirects to its replacement; unpublished, deleted, and unknown pages return 404, including requests through any old redirect.
- [x] CMS data uses a dedicated Postgres database or schema and role; media persists across container replacement. Runtime secrets, migrations, backups, and recovery are documented. Staging rehearsals cover container replacement, an EmDash upgrade, and restoring content, media, and required encryption keys from backup.
- [x] The web runtime uses an EmDash-supported Node version. Production smoke checks exercise CMS content and editing dependencies, not only the static landing page.
- [ ] The intended editor completes an end-to-end Persian RTL trial, including image upload and preview; any unacceptable untranslated UI or formatting behavior is resolved before launch.
- [ ] An agent prepares three Blog Article drafts on Staff Commission calculations, organizing AppointmentRequests, and useful Client records, and delivers their preview links. All three remain unpublished on delivery. This first-batch milestone is complete with the three drafts; neither review by another person or agent nor publication is required.

### Later Product Guides

- [ ] Product Guides have their own content type and public template, with ordered steps, screenshots, an optional externally hosted video and transcript, related guides, and a last-reviewed date or reviewer.
- [ ] An authorized nontechnical editor can draft, preview, publish, revise, and unpublish a Persian Product Guide without a code change or Saluna deployment, including a real-editor trial of screenshot upload and video placement.
- [ ] Public `/guides/` index and individual pages use Saluna's Persian RTL design, appear in navigation and discoverable sitemaps, and have appropriate metadata. At least one manager PWA screen links to its relevant Product Guide.

### Later Grok drafting workflow

- [ ] A separately enabled Grok routine creates one new Persian Blog Article draft per day within the agreed salon-management subjects, independently of earlier drafts' review or publication status.
- [ ] The writing bot uses a dedicated identity with the minimum supported access needed to create and revise drafts and perform required media operations. Use the installed EmDash release's MCP or remote CLI after testing authentication and permissions. Create/update operations explicitly keep content as draft; the routine does not publish or schedule publication.
- [ ] A Saluna writing skill records the audience, allowed subject areas, current product sources, article fields, default byline, optional-image behavior, and the draft-only deliverable. Writers check existing content for overlap but do not wait for earlier drafts to be reviewed or published.
- [ ] Routine retries avoid duplicate drafts for the same daily run, and failed draft creation is reported. Choose the run time in `Asia/Tehran` when enabling the routine. Review is optional, and publication is a later explicit action outside the drafting routine.

## Out of Scope

- Product Guides and daily Grok drafting in the first Blog Article release. Both remain later phases of this parent feature.
- Automatic publication of the first batch or daily drafts, mandatory approval by a different person or agent, review criteria, subject-specific approval policies, and a reviewer queue or publication cadence.
- Article-to-signup conversion attribution, which is a separate follow-up rather than a launch prerequisite.
- A mandatory cover image, mandatory image-generation service, or large video hosting in the CMS/web container.
- A separate blog deployment or domain, Cloudflare Workers migration, a second CMS, or access to Salon operational data through CMS credentials.
- Creating executable subtasks or implementing the feature during this spec-writing step.

## Subtasks

The user approved this smaller breakdown on 2026-10-06. Each task owns checks for the behavior it delivers. The tasks are listed in dependency order; only BL-0092 is initially unblocked.

| Task                                                                                                                              | Blocked by |
| --------------------------------------------------------------------------------------------------------------------------------- | ---------- |
| [BL-0092 Run EmDash with persistent storage](../done/BL-0092-run-emdash-with-persistent-storage.md)                               | None       |
| [BL-0093 Configure Blog Article drafting and editor access](../done/BL-0093-configure-blog-article-drafting-and-editor-access.md) | BL-0092    |
| [BL-0094 Render blog pages and private previews](../done/BL-0094-render-blog-pages-and-private-previews.md)                       | BL-0093    |
| [BL-0095 Complete blog publishing and URL lifecycle](../done/BL-0095-complete-blog-publishing-and-url-lifecycle.md)               | BL-0094    |
| [BL-0096 Add Blog Article SEO and discovery](../done/BL-0096-add-blog-article-seo-and-discovery.md)                               | BL-0095    |
| [BL-0097 Verify CMS recovery and editor usability](../ready/BL-0097-verify-cms-recovery-and-editor-usability.md)                  | BL-0096    |
| [BL-0098 Enable agent Blog Article drafting](../ready/BL-0098-enable-agent-blog-article-drafting.md)                              | BL-0094    |
| [BL-0099 Deliver three initial Blog Article drafts](../ready/BL-0099-deliver-three-initial-blog-article-drafts.md)                | BL-0098    |
| [BL-0100 Publish Product Guides](../ready/BL-0100-publish-product-guides.md)                                                      | BL-0096    |
| [BL-0101 Connect manager screens to Product Guides](../ready/BL-0101-connect-manager-screens-to-product-guides.md)                | BL-0100    |
| [BL-0102 Prove one Grok drafting run](../ready/BL-0102-prove-one-grok-drafting-run.md)                                            | BL-0098    |
| [BL-0103 Enable daily Grok drafting](../ready/BL-0103-enable-daily-grok-drafting.md)                                              | BL-0102    |

BL-0092 through BL-0097 establish and verify the publishing release. BL-0098 and BL-0099 complete the first-batch draft delivery. Production publishing requires the staging checks in BL-0097; private drafting can proceed once its own blockers are done. Product Guides and Grok drafting remain later phases. Neither depends on the initial articles being reviewed or published, and Grok does not depend on Product Guides. The parent retains its full scope and remains open until all acceptance criteria, including the later phases, are satisfied.

## Further Notes

- On 2026-10-07, BL-0097 technical recovery and health work was independently verified at integration merge `817c485131b9005e49f0b609cac0fb327cc2240b`. Actual replacement, aligned 1.2.0 upgrade and fresh 1.1.0 restore passed. The retained Mac copy is `http://localhost:3301`. BL-0097 remains ready-for-human for the user's end-of-work physical passkey registration and Persian trial; private drafting and the remaining tickets continue.

- On 2026-10-07, the user identified themselves as the intended editor, chose a test copy on this Mac, and requested the hands-on trial at the end after implementation. Prepare the full local test environment and keep actual trial criteria pending until they participate. Automated checks and coding continue first.

- Implementation resumed on 2026-10-07 on the existing integration branch `codex/bl-0087-emdash-blog-and-guides`. The fixed review base for the remaining tasks is `4dd5a8ecb882593f949fa19587230136decd1b7f`, the verified BL-0092 completion. Work proceeds one ticket at a time in separate implementer worktrees.

- On 2026-10-07, the user authorized using their currently logged-in Grok account and delegated the daily run-time choice. Selected 09:00 `Asia/Tehran`. The local Grok Bot application has an existing Saluna Content Studio bot; its connection and actual CMS access still require BL-0102 verification before BL-0103 enables a routine. No daily blog routine has been enabled.

- On 2026-10-07 after the user enabled their VPN, the existing Saluna Content Studio bot responded to a read-only connection check and reported HTTP 200 from `https://saluna.ir`. This confirms conversation and public-network connectivity; dedicated CMS access and actual drafting remain BL-0102 work.

- The parent remains open until its later Product Guide and Grok criteria are satisfied. Foundation, Blog Article pages, launch drafts, Product Guides, and daily drafting can be delivered separately; the initial blog launch does not mark the entire parent done.
- Before enabling production publishing, identify the intended editor and complete the staging checks. Before enabling Grok, choose its run time and confirm version-specific connection details. These are rollout inputs, not invented defaults in this spec.
- The redirect-on-rename policy is the recommended default proposed during specification. The publishing tests cover draft privacy, an editor publishing their own article, draft-only agent deliveries, and real-editor usability.
- The user clarified on 2026-10-06 that a different reviewer is not required. The first batch consists of three drafts, and the daily bot delivers drafts. This clarification supersedes the historical separate-review requirement and three-published-article milestone below. The earlier interview and sequence are retained as history. Subtask creation is a subsequent planning step.
- Related implementation evidence is in the [public content CMS research note](../../docs/research/2026-09-29-public-content-cms.md). Recheck upstream runtime, role, media, and translation behavior against the installed release.

### Delivery sequence

1. Establish the CMS foundation, content editor access, persistent storage, staging recovery checks, and Persian editor trial.
2. Build Blog Article pages, previews, metadata, navigation, sitemaps, and explicit publishing controls.
3. Prepare the three agreed articles and deliver them as drafts with preview links. The first-batch work ends there; publication can happen later.
4. Deliver Product Guides and daily Grok drafting as later phases. Daily drafting progresses regardless of the state of earlier drafts.

### Earlier notes

- Decision: use EmDash on the existing Node/VPS deployment, not Cloudflare Workers. Keep `app.saluna.ir` separate.
- Host large videos outside the CMS and web container. Store video references and supporting text with Product Guides.
- EmDash is new relative to Sanity. Keep the first content model narrow and rehearse an upgrade and restore before production.
- Product staff own accuracy of Product Guides after UI changes; the content editor owns drafting and publication.
- Split this large feature into independently deployable tasks during triage, beginning with infrastructure/editor trial, then Blog Articles, then Product Guides and in-app links.

## Publishing plan interview (2026-10-06)

Historical interview record. Its separate-review requirement and three-published-article milestone were superseded by the user's clarification on 2026-10-06, recorded in Further Notes above. The current delivery sequence and acceptance criteria govern implementation.

- The primary goal of Blog Articles is to attract prospective Salon Owners with useful answers to salon-management problems. Evaluate relevant visits and resulting Trial signups.
- Establish the EmDash publishing path first. Enable the recurring Grok writing workflow later; it is not required for the initial publishing release.
- The first release focuses on Blog Articles. Product Guides remain in this feature but ship in a later phase.
- A writer, including Grok, creates Blog Articles as drafts. A separate reviewer may be the owner, another person, or another agent. Review precedes publication; the writing agent must not publish its own draft.
- Writers may propose topics within salon-management areas: Staff Commission, AppointmentRequest handling, Client records, and staff scheduling. Check existing articles for overlap; product claims must match current Saluna behavior. The first candidate is Staff Commission calculations with worked examples.
- Launch with three published Blog Articles covering different salon-management problems.
- The later Grok workflow produces one new Blog Article draft per day, regardless of whether earlier drafts have been reviewed or published. Publication cadence and any publication queue belong to the reviewer, not to the writing bot. This clarifies the earlier daily-publication wording.
- Detailed review criteria and subject-specific approval policies belong to the reviewer and are outside this planning session's scope.
- Public credit defaults to `تیم سالونا`, with support for selecting a named author. The reviewer is not automatically credited as the author.
- Cover images are optional; articles can contain inline images and use a Saluna-branded social-preview fallback when no cover is supplied.
- Initial content preparation belongs to this plan: an agent drafts the first three articles on Staff Commission calculations, organizing AppointmentRequests, and useful Client records. Separate review and publication follow.
- The first release includes relevant signup links but does not add article-to-signup attribution. Conversion attribution follows as separate work; it is not a launch prerequisite.

## Historical proposed implementation sequence

1. **CMS foundation and editor trial.** Add EmDash to the existing Astro/Node application on a supported runtime. Provision separate CMS data, durable media, keys, migrations, and recovery procedures. Establish writer/reviewer permissions and prove the Persian editing journey on staging. Use the official `building-emdash-site` and `emdash-cli` skills, checking them against the installed release. This phase does not require a Grok routine or a custom plugin.
2. **Blog Articles and public pages.** Add the article content model and `/blog/` routes using existing public layouts and navigation. Implement bylines, optional images and fallback social previews, shared article metadata, published-only reads, sitemaps, and signup links. Verify that publication and revision do not require deployment, that drafts stay private, and that URL changes and unpublishing have intentional behavior. Depends on the CMS foundation.
3. **Launch drafts and reviewer handoff.** Prepare the three agreed articles as EmDash drafts and return preview links to the designated reviewer. Prove the writing account cannot publish and the reviewer can publish a draft from another writer. Rehearse content/media recovery and production smoke checks before launch. The reviewer owns actual review and publication; three public articles complete the launch content milestone. Depends on the Blog Article pages.
4. **Later work, independently scheduled.** Product Guides depend on the CMS foundation. Daily Grok draft generation depends on the Blog Article model and a working agent connection, and does not depend on Product Guides or any prior article's publication. Article-to-signup attribution is a separate follow-up. Reconfirm version-specific Grok connection details and choose the routine's run time when enabling it.

Daily automated publication, reviewer-policy enforcement, a mandatory cover-image generation service, and a separate blog deployment are outside this plan. No implementation has started from this interview. Split the agreed sequence into backlog subtasks after the final shared-understanding confirmation, preserving this parent feature and its deferred Product Guide scope.
