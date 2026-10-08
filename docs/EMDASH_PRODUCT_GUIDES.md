# Product Guide editing and maintenance

Product Guides live in native EmDash `product_guides`, separate from Blog
Articles. They share the site's public reader, rich-text rendering, metadata,
media providers and publication policy. `/guides` and `/guides/{slug}` are
anonymous Persian RTL pages. Site navigation links to the guide index.

## Configure and edit

Apply `apps/web/cms/seed.json` to a new or initialized CMS with the existing
`scripts/configure-cms-blog.mjs` administrator procedure in
[the editor guide](EMDASH_EDITOR.md). The command also creates the guide model,
preserves existing articles/profiles/guides, and never promotes a staged draft.
The one-time local configuration used a temporary native admin token and revoked
it afterward. The deployed web entrypoint remains `apps/web/server.mjs`.

An Editor opens **راهنماهای محصول → New**. Enter a Persian title and short
summary. Write instructions in **مراحل و تصویرهای راهنما** using **Numbered
List**. Insert screenshots through **Insert Image**, upload/select a native media
item, and enter descriptive alternative text. The native editor supports
continuing numbered instructions across screenshots; authors do not type JSON.
An optional **تصویر روی جلد** supplies the social image. Without a cover the
site uses its existing branded fallback.

Fill **تاریخ آخرین بازبینی** and/or **مسئول بازبینی**. Product staff own guide
accuracy after the corresponding manager UI changes: repeat the task on the
current UI, check field requirements and error messages, replace outdated
screenshots, and update the review information before publishing the revision.
Use demonstrative data for screenshots, never real Client records.

**Save** retains an unpublished draft. Reopen it and use **Preview** to review
in the public design. A signed preview also requires a native content-user
session; forwarding the URL does not grant anonymous access. Preview responses,
including failures and obsolete URLs, carry noindex and private/no-store policy.
The dashboard's native English actions remain a question for the intended
editor's end-of-work usability trial.

Use **Publish now** after checking the steps and images. Subsequent **Save**
keeps title/body/URL/search/review changes separate from the live revision;
**Publish changes** promotes them. **Unpublish** removes the guide from public
pages and discovery on the next request. Unknown, withdrawn and deleted current
and former URLs return direct 404. Published slug changes redirect former URLs
straight to the current canonical address, preserving an ordinary query string.
Publication and withdrawal require no rebuild or Saluna deployment.

## Video, transcripts and related guides

**پیوند ویدئوی بیرونی** accepts an HTTPS URL. YouTube watch/short/embed links
render through its privacy-enhanced player; external MP4/WebM URLs render a
controlled video element. Other HTTPS hosts remain external links. Videos have
no autoplay. Arbitrary application frames and non-HTTPS/credential-bearing links
are not rendered. Videos stay at their external host, outside CMS/web storage.

Put useful written support in **متن همراه ویدئو** and retain complete task steps
in the body. Readers can use the guide when the external player is unavailable.
The player's origin-only referrer excludes signed-preview query parameters.
[YouTube's embedding documentation](https://support.google.com/youtube/answer/171780)
explains the privacy-enhanced domain and referrer requirement. The automated
video example is a labeled technical playback sample, not a Saluna tutorial.

Use native **Add reference** under **راهنماهای مرتبط** to select other guides.
Public links use the target's published revision, including in an anchor draft's
preview. An unpublished target is omitted; its staged title or slug is never
leaked through a related link.

Search fields **عنوان برای جستجو**, **توضیح برای جستجو** and **نمایش ندادن در
موتورهای جستجو** are revisioned with the guide. Native legacy SEO and Bylines
panels are not the public presentation source. The shared head emits one
canonical and TechArticle structured data, plus matching social metadata.
`/guides-sitemap.xml` reads current published/search-visible guides, with native
promoted-revision dates. Robots advertises it alongside the static, Salon and
Blog Article sitemaps. A CMS outage returns an error instead of empty success.

## Delivered local example and verification

[افزودن مشتری در سالونا](http://localhost:3301/guides/create-client) is published
on the retained Mac CMS. [Its stable record](../content/product-guides/delivery.json)
contains the original ID. [The source](../content/product-guides/create-client.json)
records five ordered steps, review information and checked product paths. Manual
creation requires name and phone; its duplicate-phone 409 does not invoke the
contact-import picker. The guide tells readers to close/search/open the existing
record after that error. Three original launch articles remain drafts.

The manager Clients screen links to this guide through **راهنمای افزودن مشتری**
in its header. The link opens a new tab using the PWA's configured public web
origin, so the manager can keep the Client form and search on the original
screen. Guide reading requires no product or CMS login. The current screen's
name/phone form, manual duplicate-phone error and create/search behavior were
checked against the guide on 2026-10-08. Product staff must check this link,
written steps and screenshots whenever the Clients screen changes; the content
editor maintains the published guide through native revisions.

The three checked-in screenshots show the actual current manager components
with browser-network demo responses at a dedicated 3306 origin, not an operational
Salon database. `scripts/capture-client-guide.mjs` starts an isolated PWA on 3304,
creates/searches the demo Client, captures a valid enabled form and saved list,
follows the manager guide link to the published Mac guide on 3301 without a login,
omits the development debug trigger, and closes browser/server on exit. It
refuses PWA env files and unexpected API origins/routes. Run in a checkout with
no PWA `.env*` files; never reuse the unrelated service on 3000:

```sh
node scripts/capture-client-guide.mjs /absolute/new/capture-directory
```

`PLAYWRIGHT_CHROMIUM_EXECUTABLE_PATH` may select the installed compatible browser.
Refresh screenshots only after source review; the live CMS remains the editing
source after delivery. Do not overwrite editorial changes from checked-in JSON.

The retained technical Editor can verify the original guide without republishing:

```sh
node deploy/cms/client-guide.browser.mjs verify /absolute/private/cms-directory
```

Its private native passkeys are distinct from the user's unconsumed invitation.
`configure` is a native model update; `publish` is the explicit initial local
example delivery and does not replace an already published guide. The tool
stores the original guide/media IDs, protected preview and evidence outside Git.
No preview token or credential belongs in this document.

The real production browser suite exercises native numbered steps, image upload,
video/transcript and related selection, Save/reopen/private preview, publish,
revise, republish, rename, withdraw/delete and runtime discovery, retaining the
Blog Article regressions and static/Salon canonical policy. Public smoke checks
now cover guide discovery and each published guide's metadata/social image too:

```sh
pnpm test:e2e:cms:production
BASE_URL=http://localhost:3301 node scripts/smoke-web.mjs
```

The full smoke command also requires its configured Salon API. Focused retained
CMS checks use exported `checkGuideDiscovery` and `checkProductGuide` from
`scripts/smoke-blog.mjs`. The manager-screen link and automated technical journey
are complete. BL-0101's intended user's actual guide editing trial remains
pending at the end. It must cover Persian writing, screenshot upload/placement,
external video/transcript, preview, publication, revision and withdrawal. Record
the user's observations and resolve unacceptable English UI, RTL, screenshot
or video-placement behavior before guide rollout; automated tests do not stand
in for that trial.
