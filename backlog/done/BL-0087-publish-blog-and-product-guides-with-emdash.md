---
id: BL-0087
title: Publish Blog Articles and Product Guides with EmDash
status: done
type: feature
triage: ready-for-agent
priority: medium
size: large
created: 2026-09-29
updated: 2026-10-11
---

## Problem Statement

Saluna has no self-service publishing path for a nontechnical content editor. Prospective Salon Owners need useful answers to salon-management questions before choosing software. Managers need public Product Guides that explain Saluna tasks with written steps, screenshots, and optional video, without requiring product login to read the instructions.

## Solution

Integrate EmDash into the existing Astro public site on `saluna.ir`, following [ADR-0040](../../docs/adr/0040-emdash-for-public-content.md). Start with Persian Blog Articles at `/blog`, using Saluna's RTL design. Editors can save private drafts and publish their own or another editor's content without a code change or deployment. A different reviewer is not required. Public credit defaults to `تیم سالونا`, with named authors supported independently of the writing account. Articles support optional cover and inline images, a branded social-preview fallback, and a relevant signup link.

Prepare three first-batch drafts on Staff Commission calculations, organizing AppointmentRequests, and useful Client records. This content milestone is complete when all three exist as drafts and have preview links. Publication is an optional later action by an authorized editor and is not a prerequisite for completing this batch. Product Guides at `/guides` and links from relevant manager PWA screens are included. Agent drafting includes the launch batch, a verified manual Grok run, and reusable writing instructions. Recurring drafting and additional human editor trials were removed from completion scope on 2026-10-11.

## User Stories

1. As a prospective Salon Owner, I want useful Persian Blog Articles about salon-management problems, so that I can understand those problems and decide whether to start a Saluna Trial.
2. As a nontechnical writer, I want to draft, revise, preview, and illustrate an article before publishing it, so that I can prepare content without developer help.
3. As an authorized content editor, I want to publish, revise, and unpublish my own or another editor's article without CMS administration or Salon operational access, so that I can control what visitors read.
4. As a visitor, I want readable RTL articles with a clear byline and working links, so that I can read and share them on the public site.
5. As an operator, I want persistent CMS content and media with a rehearsed recovery procedure, so that container replacement and upgrades do not lose the publishing work.
6. As a salon manager, I want public Product Guides linked from relevant product screens, so that I can follow accurate steps for a Saluna task.
7. As the person responsible for content, I want an agent to prepare private Persian drafts from current product sources, so that I can choose when to publish them.

## Implementation Decisions

- EmDash admin, content runtime, and public templates share the existing Astro/Node web deployment on the VPS. The manager PWA stays at `app.saluna.ir`. CMS access does not confer product authentication or Salon operational access.
- CMS persistence uses a dedicated Postgres database or schema and a separate database role. Media lives in durable storage outside the container's replaceable filesystem. Backups include content, media, and required encryption keys. Document provisioning, migrations, runtime secrets, upgrade, restore, and CMS health checks within the existing deployment process.
- Select and pin an EmDash release, then check its runtime and Astro requirements. The current web image and declared engine minimum use Node 22.12.0. The current [existing-project guide](https://docs.emdashcms.com/existing-project/) requires Node 22.16 or later and Astro 6 or later. Raise the web runtime and relevant declarations to satisfy the selected release and test the production image, rather than treating development startup as deployment proof.
- Enable revisions so saving changes stages a draft separately from the live revision. Public templates read published revisions at request time. Authenticated previews read the draft, carry a noindex policy, and do not share cached responses with anonymous visitors. Publishing and withdrawal must affect the next public request, including list and sitemap discovery.
- Use EmDash's supported content roles for authorized editors. The same editor may draft and publish an article; no separate reviewer identity or approval is required. The [role guide](https://docs.emdashcms.com/guides/authentication/) permits Authors to publish their own content and Editors to manage other users' content. Grant only the access needed for the editor's work and keep CMS administration and Salon operational access separate.
- The agent connection uses the installed release's supported MCP or remote CLI with a dedicated identity and the minimum supported content/media access needed to complete drafting. Explicitly keep create/update operations as drafts. Agent drafting operations do not publish or schedule publication. The [MCP reference](https://docs.emdashcms.com/reference/mcp-server/) checks scopes and roles separately; verify successful draft creation, revision, preview, and required image operations with the chosen identity. No mandatory approval workflow or custom publication-denial layer is required.
- Blog Articles have a title, stable slug, summary, rich text body, reusable public byline, optional cover and inline images, and page-specific SEO fields. Default credit is `تیم سالونا`. The editor's login does not automatically determine public authorship.
- Extend the existing public layouts, navigation, and shared metadata rendering for article output. Use one canonical and metadata path, article structured data, and a branded social image when no cover exists. Discover published CMS URLs through a runtime sitemap advertised to crawlers, while preserving existing static and public Salon sitemaps. Follow the site's existing canonical convention without a trailing slash; slash variants permanently redirect to the canonical URL.
- Ordinary title or body edits preserve the slug. An explicitly published slug change permanently redirects the former URL to the new canonical URL. Unknown, unpublished, and deleted content returns 404, including access through former URLs. Draft slug changes do not change live routing before publication. Sitemaps list only current published canonical URLs.
- An agent prepares the three agreed launch articles from current product behavior and glossary terms. The Staff Commission article includes worked examples consistent with Eligible Commission Basis and Commission Agreement behavior. Deliver all three as drafts with preview links. An authorized editor may later publish them, including their own drafts; batch completion does not depend on review or publication. Signup links are included, while article-to-signup attribution remains separate work.
- Product Guides are a later, separate content type and template within the same CMS. They contain ordered steps, screenshots, an optional externally hosted video and transcript, related guides, and a last-reviewed date or reviewer. Product staff own accuracy after UI changes. The guide phase includes at least one relevant manager PWA link. Additional human editor trials are outside the revised completion scope.
- Agent drafting uses a Saluna writing skill specifying prospective Salon Owners as the audience, allowed salon-management subjects, current product sources, required article fields, public credit, optional images, and draft-only delivery. Check overlap with existing content without waiting for review. A manual Grok drafting run is verified; recurring execution is outside the revised completion scope.

## Testing Decisions

- Test what users and visitors can do and read. Assert visible editor actions, supported agent responses, rendered HTML, status codes, and discovery output. Avoid tests of internal CMS tables, private helpers, or calls made between modules.
- Use one primary end-to-end publishing journey against the real Astro/EmDash application and CMS persistence. A writer creates a Persian draft, uploads an image, previews it, and revises it. The same authorized editor can publish it, anonymous visitors read it, a subsequent draft edit leaves live content unchanged, and republishing then unpublishing changes public output without a build or deployment.
- Verify that an authorized editor can publish their own draft and that an editor with the appropriate content role can publish another user's draft. Check successful draft creation, revision, preview, and required image operations through the supported agent interface. Verify that first-batch and manual agent drafting operations leave their output as drafts and never request publication or schedule it. Content editor accounts do not gain CMS administration or Salon operational access.
- Extend the existing public-web HTTP smoke checks for the Blog Article index, detail pages, metadata, structured data, social image responses, sitemap discovery, preview privacy, canonical redirects, renamed URLs, and 404 after withdrawal. Use real publication state changes for the lifecycle checks. Keep the existing landing page and public Salon checks as regression coverage.
- Reuse the existing web Vitest/Astro rendered-layout and sitemap response tests for focused metadata cases, missing optional images, default and named bylines, and published-only discovery. Prior art is the shared Head rendering tests, public Salon SEO tests, runtime Salon sitemap tests, and the complete local-search journey in BL-0075.
- Reuse Playwright's role-based user interactions and failure artifacts for the editor journey. Its current startup targets the manager PWA, so provide a CMS/web test target with an isolated CMS fixture rather than assuming the existing server setup runs EmDash. The later guide phase also verifies a manager-screen link to the correct public guide.
- Rehearse media survival across container replacement, upgrade, and a content/media/key restore on staging. Production smoke checks must detect unavailable CMS content and editing dependencies. Additional human trials and scheduled-drafting proof are no longer completion requirements.

## Acceptance Criteria

### First Blog Article release

- [x] An authorized editor can create, preview, revise, and publish their own article without a separate reviewer. An editor with the appropriate role can also publish another editor's article. Verify content operations through the admin and draft creation, revision, preview access, and required image operations through the supported agent interface, without granting CMS administration or Salon operational access.
- [x] Blog Articles support a title, stable slug, summary, rich text body, public byline, optional cover image and inline images, and page-specific SEO metadata. Public credit defaults to `تیم سالونا` and can be changed to a named author independently of the writing account.
- [x] The public `/blog/` index and individual pages use Saluna's Persian RTL design and are reachable through site navigation. Articles include a relevant signup link. An article without a cover image uses a Saluna-branded social preview.
- [x] Published articles return crawlable HTML with one canonical URL, page-specific title/description, article structured data, and inclusion in a discoverable public sitemap. Anonymous requests cannot read draft or preview content. Preview responses are not indexable and cannot enter a shared public cache. Drafts and unpublished pages are not publicly listed or indexed; existing public Salon sitemap behavior remains intact. Use one metadata path, extending the shared helper where necessary for article metadata.
- [x] Publishing, republishing, or unpublishing takes effect on the next public request without rebuilding or replacing the web image. Ordinary edits preserve the slug. An explicitly renamed published URL permanently redirects to its replacement; unpublished, deleted, and unknown pages return 404, including requests through any old redirect.
- [x] CMS data uses a dedicated Postgres database or schema and role; media persists across container replacement. Runtime secrets, migrations, backups, and recovery are documented. Staging rehearsals cover container replacement, an EmDash upgrade, and restoring content, media, and required encryption keys from backup.
- [x] The web runtime uses an EmDash-supported Node version. Production smoke checks exercise CMS content and editing dependencies, not only the static landing page.
- [x] An agent prepares three Blog Article drafts on Staff Commission calculations, organizing AppointmentRequests, and useful Client records, and delivers their preview links. All three remain unpublished on delivery. This first-batch milestone is complete with the three drafts; neither review by another person or agent nor publication is required.

### Product Guides

- [x] Product Guides have their own content type and public template, with ordered steps, screenshots, an optional externally hosted video and transcript, related guides, and a last-reviewed date or reviewer.
- [x] Public `/guides/` index and individual pages use Saluna's Persian RTL design, appear in navigation and discoverable sitemaps, and have appropriate metadata. At least one manager PWA screen links to its relevant Product Guide.

### Agent drafting

- [x] A Saluna writing skill records the audience, allowed subject areas, current product sources, article fields, default byline, optional-image behavior, and the draft-only deliverable. Writers check existing content for overlap but do not wait for earlier drafts to be reviewed or published.

- [x] A manual Grok run creates, revises, illustrates, and returns an authenticated preview of a private Persian Blog Article using the dedicated native Author connection, as verified in BL-0102.

## Out of Scope

- Additional human Blog Article and Product Guide editor trials, and recurring drafting execution/reporting proof. The user removed these requirements and the three remaining tasks on 2026-10-11. Existing technical work and automation configuration are retained.
- Automatic publication of the first batch or daily drafts, mandatory approval by a different person or agent, review criteria, subject-specific approval policies, and a reviewer queue or publication cadence.
- Article-to-signup conversion attribution, which is a separate follow-up rather than a launch prerequisite.
- A mandatory cover image, mandatory image-generation service, or large video hosting in the CMS/web container.
- A separate blog deployment or domain, Cloudflare Workers migration, a second CMS, or access to Salon operational data through CMS credentials.
- Creating executable subtasks or implementing the feature during this spec-writing step.

## Subtasks

The user approved the original breakdown on 2026-10-06. The nine retained tasks are complete. BL-0097, BL-0101, and BL-0103 were removed from completion scope on 2026-10-11 and archived with their technical evidence.

| Task                                                                                                                              | Blocked by |
| --------------------------------------------------------------------------------------------------------------------------------- | ---------- |
| [BL-0092 Run EmDash with persistent storage](../done/BL-0092-run-emdash-with-persistent-storage.md)                               | None       |
| [BL-0093 Configure Blog Article drafting and editor access](../done/BL-0093-configure-blog-article-drafting-and-editor-access.md) | BL-0092    |
| [BL-0094 Render blog pages and private previews](../done/BL-0094-render-blog-pages-and-private-previews.md)                       | BL-0093    |
| [BL-0095 Complete blog publishing and URL lifecycle](../done/BL-0095-complete-blog-publishing-and-url-lifecycle.md)               | BL-0094    |
| [BL-0096 Add Blog Article SEO and discovery](../done/BL-0096-add-blog-article-seo-and-discovery.md)                               | BL-0095    |
| [BL-0098 Enable agent Blog Article drafting](../done/BL-0098-enable-agent-blog-article-drafting.md)                               | BL-0094    |
| [BL-0099 Deliver three initial Blog Article drafts](../done/BL-0099-deliver-three-initial-blog-article-drafts.md)                 | BL-0098    |
| [BL-0100 Publish Product Guides](../done/BL-0100-publish-product-guides.md)                                                       | BL-0096    |
| [BL-0102 Prove one Grok drafting run](../done/BL-0102-prove-one-grok-drafting-run.md)                                             | BL-0098    |

BL-0092 through BL-0096 establish the publishing release. BL-0098 and BL-0099 complete the launch drafts, BL-0100 delivers Product Guides, and BL-0102 proves manual agent drafting. Recovery rehearsals and the manager guide link from the archived tasks remain implemented and verified.

Removed tasks, with historical evidence preserved:

- [BL-0097 Verify CMS recovery and editor usability](../archive/BL-0097-verify-cms-recovery-and-editor-usability.md)
- [BL-0101 Connect manager screens to Product Guides](../archive/BL-0101-connect-manager-screens-to-product-guides.md)
- [BL-0103 Enable daily Grok drafting](../archive/BL-0103-enable-daily-grok-drafting.md)

## Completion, 2026-10-11

The user removed the three remaining tasks and their outstanding requirements. The full human editor trials and actual scheduled draft/report delivery are no longer prerequisites; they are not recorded as completed. The nine retained subtasks and revised acceptance criteria are satisfied. Production publishing, Persian URLs, discovery, recovery snapshots, and the production draft-only MCP connection are verified. BL-0087 is done under this revised scope.

The current local Codex automation uses 12:00 `Asia/Tehran`; the former Grok routine is paused. Actual scheduled delivery and Studio receipt reporting remain unverified and outside this completed feature. Removing backlog tasks does not disable existing automation or remove implemented CMS, recovery, manager links, or drafting code. Email and Google provider setup remain separate pending operational work.

Final verification for the scoped completion passed 31 web tests, 12 draft permission/title checks, all 18 production CMS browser journeys, web lint/typecheck, formatting, helper syntax, and moved-ticket link/status checks. The two-axis review found no unresolved standards or spec findings. Unrelated skill refresh and staff tickets are excluded from the completion commit.

The dated notes below preserve the original rollout and superseded requirements.

## Further Notes

- On 2026-10-11, the user reported reviewing the Blog Articles and Product Guides and finding the rendered pages acceptable. This records content/layout review, not a claim that they completed every admin editing and publishing trial step. They authorized production preparation using the existing ArvanCloud key. Three CDN cache exclusions and an initial-setup/OAuth guard are active, and the origin gateway denies direct setup/OAuth requests outside Arvan's networks. The VPS has a fresh isolated CMS database and private runtime secrets. Provisioning is repeatable, with protected credential and empty-database backups off the VPS. The production CMS image has not been deployed; no first production administrator or content has been created. The user chose email and Google login but has no provider account or OAuth application yet. Provider configuration and the pinned Node OAuth credential-loading issue remain pending before activation. See `docs/EMDASH_DEPLOYMENT.md` for the preparation and bootstrap procedure.

- On 2026-10-08, BL-0102 was independently verified at merge `b1c00c805c8a8b4c37ee4d8e0a7f4732dafedb32`. The actual logged-in Saluna Content Studio registered the private writing skill and created, revised, illustrated and returned an authenticated preview of one distinct Persian staff-scheduling draft. Native Author/four-scope permissions, real operational denials, saved source accuracy and anonymous exclusion passed. The original three drafts are preserved. The user's personally selected Grok Mac execution setting is Always allow; agents left security settings unchanged. No daily routine exists yet; BL-0103 is next.

- On 2026-10-08, BL-0101 technical manager linking was independently verified at merge `65519f4d3516281111be1d8e28f63fe1c476dbec`, with complete lazy-image capture verification in `fe897b3ef04eacfdb13b7ca7ec81fb7bace4b26e`. The Clients screen opens the correct anonymous guide while creation and search remain usable. BL-0101 remains ready-for-human for the user's end-of-work guide trial; Grok implementation continues.

- On 2026-10-08, BL-0100 was independently verified at merge `a4a17a45957e8ca3f74577ac3eeb8fcfe4a152ae`, with the Blog Article field-label correction `83f82960c9cab61a93099e8dfaac477988561908`. Separate native Product Guides, shared public rendering/privacy/metadata/discovery, and the published local Client guide passed. Its five ordered steps and three current-PWA demo screenshots match the source. Product staff maintenance is documented. Manager links and the user's guide trial remain BL-0101 work.

- On 2026-10-08, BL-0099 was independently verified at integration merge `947a191bb74bac376106bb10b3cc7b07ba38a516`. All three original Persian first-batch drafts are saved and unpublished on the Mac copy, with current-product sources, readable commission examples and authenticated previews. Native saved records match their editorial sources; renewal preserves IDs and editor content. Private links will be renewed at the final human handoff. Product Guides and Grok continue separately.

- On 2026-10-07, BL-0098 was independently verified at integration merge `e3c5300458c16b73781af61d771229e831c45760`. The dedicated native Author/four-scope OAuth connection completed draft creation, revision, media and session-backed preview, with CMS administration and actual Salon operational authentication denials. Credentials and private preview results remain outside Git. The three launch drafts and actual Grok connection follow separately.

- On 2026-10-07, BL-0097 technical recovery and health work was independently verified at integration merge `817c485131b9005e49f0b609cac0fb327cc2240b`. Actual replacement, aligned 1.2.0 upgrade and fresh 1.1.0 restore passed. The retained Mac copy is `http://localhost:3301`. BL-0097 remains ready-for-human for the user's end-of-work physical passkey registration and Persian trial; private drafting and the remaining tickets continue.

- On 2026-10-07, the user identified themselves as the intended editor, chose a test copy on this Mac, and requested the hands-on trial at the end after implementation. Prepare the full local test environment and keep actual trial criteria pending until they participate. Automated checks and coding continue first.

- Implementation resumed on 2026-10-07 on the existing integration branch `codex/bl-0087-emdash-blog-and-guides`. The fixed review base for the remaining tasks is `4dd5a8ecb882593f949fa19587230136decd1b7f`, the verified BL-0092 completion. Implementer worktrees were used for the remaining tickets.

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

## Continuation, 2026-10-09

BL-0103 technical implementation is merged and independently verified. The actual Grok schedule is enabled for 09:00 `Asia/Tehran`, but scheduled draft creation and actual Studio reporting still need confirmation, so its completion criteria remain open. Final two-axis review found one URL lifecycle defect and two small duplication findings; all three were fixed and independently verified in merge `581ac545`. Production CMS checks passed 8/8, sitemap checks 4/4, and all three retained launch-draft browser journeys passed. The final local image is healthy, preview links are renewed, and a matching content/media/key/authentication/daily-journal backup is saved outside Git. The intended editor's Blog Article and Product Guide trials are now ready, as requested, after implementation and review.

## Deployment attempt, 2026-10-11

The user authorized production deployment after reviewing the blog and guide
presentation. The production image and sanitized content transfer are prepared
and passed an isolated production-origin rehearsal. The transfer preserves four
blog drafts and one published guide, without local authentication accounts or
test content. The user disabled the VPN, restoring VPS access, and the web release was then
applied. Live Arvan checks passed for public content/media, editor setup assets,
draft privacy and cache bypass; API and manager health passed. A protected
off-VPS database/media/key/image snapshot is saved. First-admin passkey
enrollment under the IP-restricted setup guard and actual Blog Article
publication remain human steps. Email and Google provider setup remain pending.
See `docs/EMDASH_DEPLOYMENT.md` for the deployment evidence and handoff.

## Administrator and publication confirmation, 2026-10-11

The intended operator completed physical-passkey enrollment and published all
four Blog Articles. Production setup is complete, the articles return 200, and
the temporary bootstrap guard is released. A new off-VPS recovery point includes
the human account and publication revisions. The operator then disabled search
exclusion and republished all four articles. Live pages omit `noindex`, and the
blog sitemap includes all four canonical URLs. A fresh off-VPS recovery point
captures these revisions. Email and Google provider setup and any remaining
editor/scheduled-writing trials remain open.

The user also authorized descriptive Persian slugs for all four live Blog
Articles and the Product Guide. Native draft saves and publication preserved
their content and publication dates. The English URLs redirect with 301; the
Persian pages, canonical metadata, indexes and sitemaps passed live checks.
The rehearsal found missing redirect singleton rows in the sanitized transfer;
restoring the pinned migration defaults fixed native URL publication. A new
off-VPS recovery point includes the rename revisions and redirect state. Future
writer rules, including normalization, stable slugs, daily draft retry identity
and publication permissions, are documented in `docs/agents/public-content.md`.

The user requested production MCP access and chose create/edit drafts only.
The project now registers `saluna_emdash_prod`, a local stdio adapter backed by
a separate native production Author and four-scope PAT. The adapter enforces
draft-only edits; native Author policy still permits own publication. Live
create/revise tests passed in Blog Articles and Product Guides, with stale
revisions, public entries and forbidden operations refused. Anonymous drafts
and previews remained private. Temporary test entries were moved to Trash,
12 relevant unit checks passed, and a fresh off-VPS recovery point includes
the new authentication state. Access, renewal and writer guidance are in
`docs/EMDASH_AGENT.md`. The production connection is separate from the local drafting automation.
