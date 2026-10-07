# Agent Blog Article drafting

Saluna uses EmDash 1.1.0's native MCP endpoint, `/_emdash/api/mcp`, for
draft content and media. Signed preview links come from the native REST
`POST /_emdash/api/content/blog_articles/{id}/preview-url` adjunct. MCP has
no preview-link tool in this release. The standalone client uses Node built-ins
and runs on Node 20 or newer; the Saluna server retains its own Node requirement.

## Dedicated connection

An Administrator invites a separate Author account. The invitee registers its
own passkey and approves a native OAuth device request while signed in as that
account. A PAT created by an Administrator belongs to that Administrator and
does not create this restricted connection.

Use exactly these scopes:

```text
content:read content:write media:read media:write
```

The installed release permits Contributor 20 to create drafts and upload media,
but revision requires Author 30 and ownership. Author 30 is therefore the
minimum role for this complete journey. The four scopes independently control
content reads, content writes, media reads, and media writes. Native Author
permissions still allow publication of the account's own articles. This client
only exposes unscheduled draft writes; it does not change the CMS role policy.

Native device setup uses the following requests at the configured CMS origin:

1. `POST /_emdash/api/oauth/device/code` with
   `{"client_id":"saluna-drafts","scope":"content:read content:write media:read media:write"}`.
2. Open the returned verification page and approve its code in the dedicated
   Author's authenticated browser. Verify the approving account's role and ID
   using the browser-session `GET /_emdash/api/auth/me`.
3. Poll `POST /_emdash/api/oauth/device/token` with the returned `device_code`
   and `grant_type: urn:ietf:params:oauth:grant-type:device_code`, following the
   returned polling interval. Require exactly the four granted scopes.
4. Save the native token response's `data` privately, adding `baseURL`, `locale`,
   `userId`, `role: 30`, and `expiresAt` in milliseconds. Compute `expiresAt`
   from the token's `expires_in` and the current time. The retained local site's
   effective locale is `en`, including articles whose text is Persian.

The four-scope Bearer token cannot call `auth/me`; that endpoint returns 403.
Do not add a profile or administration scope just to probe identity. The
approving browser establishes identity, and saved articles must have its
`authorId`. Never treat manually written credential metadata as OAuth
introspection.

Store credentials, request/result JSON, signed preview links, and passkey state
outside Git in a directory with mode 0700. Credential and JSON files must have
mode 0600. Pass file paths to the CLI, rather than tokens or content in shell
arguments. Disable shell tracing and avoid browser traces containing sessions.
Use one process per credential file. The client refreshes access tokens through
the native `oauth/token/refresh` endpoint before expiry and atomically saves the
returned credentials. Native refresh revokes the preceding access token.
Refresh tokens expire after 90 days in this release; a new device approval is
needed after expiry or revocation. Revoke the refresh token with
`POST /_emdash/api/oauth/token/revoke` when retiring the connection.

## Local client

The CLI has no package dependency and uses protected input/output files:

```sh
node scripts/cms-draft-cli.mjs connect /absolute/private/oauth.json /absolute/private/empty.json /absolute/private/tools.json
node scripts/cms-draft-cli.mjs create /absolute/private/oauth.json /absolute/private/create.json /absolute/private/created.json
node scripts/cms-draft-cli.mjs read /absolute/private/oauth.json /absolute/private/read.json /absolute/private/current.json
node scripts/cms-draft-cli.mjs revise /absolute/private/oauth.json /absolute/private/revise.json /absolute/private/revised.json
node scripts/cms-draft-cli.mjs upload /absolute/private/oauth.json /absolute/private/upload.json /absolute/private/media.json
node scripts/cms-draft-cli.mjs preview /absolute/private/oauth.json /absolute/private/read.json /absolute/private/preview.json
```

`empty.json` contains `{}`. `read.json` and the `media` operation take `{"id":"NATIVE_ID"}`.
`list` returns the native saved Blog Article records, including draft state,
ownership, locale, and fields. It follows native content-list cursors.
`create.json` contains the article's slug and revisioned fields:

```json
{
  "slug": "saluna-example-draft",
  "data": {
    "title": "نمونه پیش‌نویس فارسی",
    "summary": "خلاصه مقاله برای خواننده",
    "body": [
      {
        "_type": "block",
        "_key": "intro",
        "style": "normal",
        "markDefs": [],
        "children": [
          { "_type": "span", "_key": "text", "text": "متن مقاله", "marks": [] }
        ]
      }
    ],
    "seo_title": "عنوان برای جستجو",
    "seo_description": "توضیح برای جستجو"
  }
}
```

Both creation and revision explicitly send `status: draft` in the effective
locale. They read the saved native record again before reporting success.
Revision requires `{"id":"NATIVE_ID","_rev":"CURRENT_NATIVE_REV","data":{...}}`
using the revision returned by the preceding read. The client refuses stale
revisions, another account's content, scheduled content, and any article with
a live revision. It never overrides an editor's lock. Passing draft status to
an already published item can unpublish it in native EmDash, so this guard
matters. The client makes no automatic mutation retry. After an interrupted or
ambiguous write, reconcile the saved native record before deciding to retry.

Use the revisioned `seo_title`, `seo_description`, `search_excluded`, and
`public_authors` fields from the checked-in model. Native SEO and native Bylines
write outside article revisions and do not supply Saluna's public metadata.
An empty public-author selection uses `تیم سالونا`. Public author profiles are
reusable content managed through the native editor, as described in
[the editor guide](EMDASH_EDITOR.md).

`upload.json` takes an absolute image `path` plus descriptive `alt` and optional
`caption`. Upload re-reads the saved media record and retains the upload's
returned URL. Native `media_get` omits this URL in 1.1.0. Keep the returned URL
for an inline Portable Text image; do not guess a bare-ID file route:

```json
{
  "cover": { "provider": "local", "id": "MEDIA_ID", "alt": "شرح تصویر" },
  "body": [
    {
      "_type": "image",
      "_key": "illustration",
      "asset": {
        "_type": "reference",
        "_ref": "MEDIA_ID",
        "url": "UPLOAD_RETURNED_URL"
      },
      "alt": "شرح تصویر",
      "width": 640,
      "height": 360
    }
  ]
}
```

Merge image blocks into the complete intended body when revising it. The sample
above replaces the body with one image. Uploaded media is publicly readable
even while its article remains a draft; article text stays private.

`preview.json` contains the signed URL, expiry, and saved draft record. The
client requires the returned URL to stay at its configured origin. Opening it
requires an active native CMS session with draft-read permission. A copied link
or Bearer token alone returns 403. A permitted Editor can open the link and
reopen the saved article in the native dashboard. Generate another link after
expiry. CLI logs contain only action success or a safe error code; private
result files contain the actual content and preview link.

## Verified local journey

The retained production CMS on localhost:3301 has a dedicated technical Author
and a Persian draft with cover and inline images. Native MCP creation, read,
revision, media upload/read, attachment, signed session-backed preview, and
Editor reopening passed. Anonymous requests decode the actual uploaded image,
but the draft detail returns 404 and is absent from `/blog` and
`/blog-sitemap.xml`. Copied and Bearer-only preview requests return 403.

Real native grants proved Subscriber cannot create or read the draft,
Contributor cannot revise, and removing each selected scope denies its
corresponding operation. Administration attempts were denied. The real Saluna
API and Better Auth implementation, using a disposable migrated database,
rejected this CMS Bearer token with 401 for clients, appointments, and business
settings. These checks do not mock authentication or read Salon data.

Run against the retained private technical fixture, never production:

```sh
PLAYWRIGHT_CHROMIUM_EXECUTABLE_PATH=/absolute/path/to/chromium node deploy/cms/agent-drafting.browser.mjs permissions /absolute/private/fixture
CMS_AGENT_TEST_PRIVATE_DIR=/absolute/private/fixture node --test deploy/cms/agent-client.test.mjs
node node_modules/tsx/dist/cli.mjs deploy/cms/agent-operational-denial.mjs /absolute/private/fixture
```

`setup` creates the technical account once; `verify` repeats its saved drafting
journey, and `permissions` also tests temporary negative grants and revokes them.
The fixture saves private screenshots and passkey counters. It deliberately
does not consume the intended human Editor invitation. The user's physical
passkey and Persian usability trial remain pending until the complete local
copy is ready. Grok settings and its routine are unchanged by this connection.

The [official MCP reference](https://docs.emdashcms.com/reference/mcp-server/)
describes native transport and tools. The installed 1.1.0 source supplies the
specific role, scope, device flow, locale, and preview behavior verified here.
