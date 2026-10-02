---
id: BL-0089
title: Classify internal Salon pages before excluding them from search
status: done
type: improvement
triage: ready-for-agent
priority: medium
size: small
created: 2026-10-02
updated: 2026-10-02
---

## Problem

The [SEO audit](../../docs/audits/seo-2026-10-02/README.md) found published Salon names that may represent internal tests. Names and Unlimited Access do not establish whether a page should be excluded from search. Real public Salons must retain owner-controlled publication and Read-Only Access behavior.

## Smallest useful version

The owner confirmed three internal Salons on 2026-10-02. Their public links remain available, with noindex metadata and exclusion from the runtime Salon sitemap. The shared policy in `apps/web/src/lib/seo.ts` uses these exact slugs:

- `salon-a027zt`, تستاسترون کده
- `salon-vubbcn`, تستاسترون لند
- `salon-gzwp7u`, سالن ممد

Update the policy if these slugs change. It does not classify other Salons by name or entitlement.

## Acceptance criteria

- [x] Owner identifies internal/demo Salon records and confirms their intended public access.
- [x] Confirmed excluded pages emit noindex and do not appear in the runtime Salon sitemap.
- [x] Genuine published Salons remain indexable, including those with Read-Only Access.
- [x] Classification does not infer intent from names, missing information or Unlimited Access.
- [x] Verify rendered metadata and sitemap behavior for both classifications.

## Notes

Implemented in the working tree, with deployment pending. No operational data or publication settings changed. Tests check rendered metadata and the sitemap response. HTTP checks against a production build and an isolated fixture API exercise all six audited slugs, both layouts and a real Salon with intake disabled. All return 200; only the three confirmed test pages emit noindex and disappear from the sitemap. The fixture does not modify the local or production API. Google/Search Console follow-up remains a deployment activity.
