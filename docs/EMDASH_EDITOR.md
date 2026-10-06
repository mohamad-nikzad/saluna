# Blog Article editor

EmDash 1.1.0 stores Blog Articles in `blog_articles`. Saluna's model is in
`apps/web/cms/seed.json`. Its built-in slug, drafts, revisions, and SEO sit
alongside the title, summary, Portable Text body, and optional cover image.
The public URL pattern is `/blog/{slug}`. Saving a title change preserves the
existing slug. Published articles appear at `/blog` and `/blog/{slug}`.

## Configure a new or existing CMS

Complete the operator's passkey setup at `/_emdash/admin`. The empty-site
option creates the collection without articles. Then create a temporary
Administrator API token with the `admin` scope in the CMS and run:

```sh
node scripts/configure-cms-blog.mjs
```

Provide `EMDASH_URL` and `EMDASH_API_TOKEN` through the private environment.
The command applies the checked-in model through the real CMS API, creates
missing fields and the reusable `تیم سالونا` profile, and keeps existing
articles and profiles. Repeating it keeps saved content. Field type changes
require a separate migration. Revoke the temporary token afterward.

The seed is for initial setup. EmDash 1.1.0 does not reapply it to initialized
sites, and its local `emdash seed` CLI targets SQLite, so use this command on
Saluna's Postgres deployment. Full-text search is SQLite-only in this release;
the Blog Article collection does not enable it.

## Invite content editors

An Administrator opens Users and invites the intended writer. Use Editor for
someone who must select public author profiles, publish their own articles,
or revise and publish other accounts' content. Author is narrower and can
write and publish their own articles, but cannot manage public profiles or
another account's content. The invitee registers their own passkey.

Neither role can invite users, change collection schemas, install or enable
plugins, or change site settings. CMS accounts and database credentials are
separate from Salon accounts and operational data, as described in
[EmDash deployment](EMDASH_DEPLOYMENT.md). Review by a different person is not
required. Draft-only automation is a separate scoped connection in BL-0098.

## Write and revise an article

1. Open `مقاله‌های وبلاگ` and select New. Enter a Persian title, summary, and
   body. The rich text toolbar supports formatting and Insert Image.
2. Use Select image under `تصویر روی جلد` for an optional cover. In the media
   dialog, upload a file or select an existing image. Insert Image in the
   body uses the same reusable media library. Add descriptive alternative
   text in the image settings.
3. Select Save. This creates a draft. Reopen the article to revise it. Save
   keeps draft changes separate from the published revision.
4. Once saved, Bylines in the settings panel selects reusable public author
   profiles. Select a named profile without changing Ownership or your login.
   With no explicitly selected profile, Saluna uses `تیم سالونا`. The public
   reader must use `blogArticleBylines` and ignore EmDash's inferred
   account-linked credits.
5. Set the article's SEO Title, Meta Description, and optional social image
   in its SEO panel. The panel saves these article settings automatically.
6. Publish now explicitly promotes the saved draft. Publishing your own
   article is allowed. An Editor can also take over another writer's edit
   lock and publish their changes.

Persian field labels and text saving are verified locally. The editor's
complete Persian RTL usability trial with the intended writer belongs to
BL-0097. The test journey uses the English admin interface to avoid depending
on incomplete translations in this release.

## Preview an unpublished article

Use View on site after saving an article. EmDash generates a signed,
time-limited preview link to the article's Saluna design. The link requires
an active CMS session with draft-read permission. Contributor, Author,
Editor, and Administrator accounts have this native permission. A copied
link cannot expose the draft to an anonymous visitor or a Subscriber account.

The preview shows `پیش‌نمایش پیش‌نویس` and has a noindex policy and private,
no-store cache headers. Invalid, expired, and mismatched tokens return 404
for authorized sessions. Ordinary public URLs always show the published
revision, even when an editor has visual editing enabled. The public index
lists all published articles and omits drafts. CMS read failures return 500
instead of an empty successful article list.

## Browser checks

```sh
pnpm test:e2e:cms
```

Docker with `postgres:16-alpine` and a Playwright Chromium browser are required.
The target starts a fresh Postgres container on a random loopback port and a
web server at `http://localhost:3303`, then removes the database and temporary
media. It does not load root env files. It creates real operator, Author, and
Editor accounts through passkeys and invitations. Its assertions use the CMS
admin and HTTP API, without querying database internals.

For an existing browser binary, set `PLAYWRIGHT_CHROMIUM_EXECUTABLE_PATH`, or
set `PLAYWRIGHT_SYSTEM_BROWSER=chrome`. Failure traces, screenshots,
and video are under `test-results/cms`; the report is under
`playwright-report/cms`. These local artifacts can contain disposable CMS
sessions, so keep them private. `pnpm test:e2e` still runs the manager PWA
suite and excludes the CMS directory.

[Upstream authentication](https://docs.emdashcms.com/guides/authentication/)
and [seed format](https://docs.emdashcms.com/themes/seed-files/) describe the
native workflow. The installed 1.1.0 source remains the version-specific
reference for roles, seed behavior, and public credit inference.
