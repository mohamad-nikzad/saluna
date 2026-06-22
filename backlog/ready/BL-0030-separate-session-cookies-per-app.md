---
id: BL-0030
title: Separate session cookies per app (PWA vs admin)
status: ready
type: feature
priority: medium
size: medium
created: 2026-06-22
updated: 2026-06-22
---

## Problem

The manager PWA and the platform admin panel share a single Better Auth session cookie. Logging into one app replaces the session for the other:

- In local dev, `localhost` cookies are not port-specific, so `localhost:3000` (PWA) and `localhost:3003` (admin) collide.
- In production, both SPAs authenticate against the same API (`api.saluna.ir`) with `credentials: 'include'`, so one active session applies to both clients.

Symptoms when testing both apps in the same browser:

- Admin login as a platform admin → PWA may redirect to signup (`needs_workspace`) or show the wrong tenant user.
- PWA login as a salon user → admin returns 403 and shows access denied.
- Sign-out in either app clears the shared cookie and logs out both.

## Smallest Useful Version

Give PWA and admin **independent session cookies** while keeping one Better Auth server and one user table. Sign-in sets the cookie namespace based on request origin; API middleware resolves the correct session per route family.

## Proposed Approach

1. **Cookie namespaces** — Use distinct Better Auth `cookiePrefix` values (or equivalent custom cookie names), e.g. `saluna-pwa` and `saluna-admin`, instead of the default shared `better-auth` prefix.
2. **Origin-aware sign-in** — On `/api/v1/auth/sign-in/*`, set cookies for the caller origin (`PWA_ORIGIN` vs `ADMIN_ORIGIN`). Reject or no-op sign-in from untrusted origins (already covered by `trustedOrigins` in `packages/auth/src/server.ts`).
3. **Route-aware session resolution** — When reading a session:
   - `/api/v1/admin/*` → resolve from the admin cookie only.
   - Tenant/PWA routes (`/api/v1/auth/me`, appointments, staff, etc.) → resolve from the PWA cookie only.
   - Shared auth routes (`/api/v1/auth/sign-out`, password reset) → clear only the cookie for the requesting app's origin, or clear both explicitly if product policy requires full logout.
4. **Client behavior** — No change to `credentials: 'include'` in either app; each app continues to proxy or call the API with cookies. Ensure `forwardSetCookie` in `apps/api/src/routes/auth.ts` still forwards all `Set-Cookie` headers individually.
5. **Production** — Verify cookie `Domain` / `crossSubDomainCookies` behavior so PWA and admin cookies remain isolated on `app.saluna.ir` and `admin.saluna.ir` without accidental sharing via `.saluna.ir`.

## Acceptance Criteria

- [ ] Logging into the PWA does not invalidate or replace the admin session, and vice versa, when both apps are open in the same browser.
- [ ] Sign-out from the admin panel does not log out the PWA session (and vice versa), unless an explicit "sign out everywhere" action is added later.
- [ ] `/api/v1/admin/auth/me` continues to require an active platform admin; PWA `/api/v1/auth/me` continues to resolve salon membership independently.
- [ ] Local dev: simultaneous sessions work on `localhost:3000` and `localhost:3003`.
- [ ] Production: simultaneous sessions work on `app.saluna.ir` and `admin.saluna.ir`.
- [ ] Existing auth flows (OTP login, password login, signup, password reset) still work in both apps.
- [ ] Tests cover dual-session behavior and origin/cookie isolation.

## Out of Scope

- Multiple concurrent sessions for the **same** app (Better Auth `multiSession` plugin).
- Separate user accounts or auth providers for admin vs PWA.
- Bearer-token-only admin auth (acceptable alternative if cookie split proves too invasive).

## Notes

- Root cause identified 2026-06-22: one Better Auth instance, one session cookie, two SPAs with different authorization models (`requireTenant` vs `requirePlatformAdmin`).
- Key files: `packages/auth/src/server.ts`, `apps/api/src/middleware/auth.ts`, `apps/api/src/routes/auth.ts`, `apps/pwa/src/lib/api-client.ts`, `apps/admin/src/features/admin-login-page.tsx`.
- Env vars already exist: `PWA_ORIGIN`, `ADMIN_ORIGIN` (see `.env.example`).
- Related: [BL-0015 Admin panel](../inbox/BL-0015-admin-panel.md) — acceptance criterion "Admin access is separated from salon tenant access" is partially addressed by RBAC today; this item completes session isolation at the browser layer.
