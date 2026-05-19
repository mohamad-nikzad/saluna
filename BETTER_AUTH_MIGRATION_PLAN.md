# Migrate to Better Auth (username + organization plugins)

## Context

`@repo/auth` is a hand-rolled JWT + bcrypt stack: phone+password login, custom `requireTenant` middleware, role checks (`manager`/`staff`), and a one-salon-per-user model where `users.salonId` is a NOT NULL FK. Every domain table (23 of them) carries `salonId`. There is no real production data yet, so we can change the schema freely.

We want to:
1. Replace the in-house auth with Better Auth, configured for **phone-as-username + password** (synthetic email under the hood).
2. Replace the in-house tenant/role plumbing with Better Auth's **organization plugin** (salon ↔ organization, members with `owner`/`admin`/`member` roles).
3. Keep **both** Next.js API route and Hono compatibility during the transition — Better Auth is mounted at both entrypoints.
4. Self-signup creates a salon + owner. Staff are created by the manager only (no email invite flow — direct `addMember` after server-side user creation).

Outcome: one canonical session/cookie produced by Better Auth, served identically through Next.js (`/api/auth/*`) and Hono (`/api/v1/auth/*`), with the active salon tracked on the session by the organization plugin.

---

## Decisions locked in

| Decision | Choice |
|---|---|
| Credential shape | Phone-as-username (e.g. `09121234567`), synthesized email `${phone}@aravira.local` |
| Role mapping | Built-in `owner` (signup creator) / `admin` (future) / `member` (= staff) |
| Compatibility | Better Auth handler mounted in **both** Next.js and Hono |
| Tenant model | Drop `users.salonId` FK; rely on `organization` + `member` tables and `session.activeOrganizationId` |
| Data | No backfill — wipe DB, regenerate Drizzle baseline migration |

---

## Architecture

```
@repo/auth (new)
 ├─ src/server.ts   → exports `auth` (betterAuth instance)
 ├─ src/client.ts   → exports `authClient` (createAuthClient + plugins)
 ├─ src/permissions.ts → tenant context helpers (replaces tenant.ts)
 └─ src/index.ts    → re-exports

apps/api (Hono)
 └─ app.ts → app.on(["GET","POST"], "/api/v1/auth/*", c => auth.handler(c.req.raw))
 └─ middleware/auth.ts → requireTenant() now wraps auth.api.getSession()

apps/app (Next.js)
 └─ app/api/auth/[...all]/route.ts → export { GET, POST } from toNextJsHandler(auth)
 └─ components/auth-provider.tsx → uses authClient.useSession()
```

Both Better Auth mounts share the same `auth` instance from `@repo/auth/server`, the same Postgres, and the same cookie domain — so a login through either entrypoint is recognized by both.

---

## Better Auth config (`packages/auth/src/server.ts`)

```ts
import { betterAuth } from "better-auth";
import { drizzleAdapter } from "better-auth/adapters/drizzle";
import { username } from "better-auth/plugins/username";
import { organization } from "better-auth/plugins/organization";
import { db } from "@repo/database";

export const auth = betterAuth({
  database: drizzleAdapter(db, { provider: "pg" }),
  basePath: "/api/v1/auth", // Hono path; Next.js handler maps /api/auth/* → same routes
  emailAndPassword: { enabled: true },
  plugins: [
    username({ minUsernameLength: 10, maxUsernameLength: 15 }), // phone-shaped
    organization({
      allowUserToCreateOrganization: false, // only our signup-salon wrapper creates orgs
    }),
  ],
  trustedOrigins: [process.env.APP_URL!],
});
```

`BETTER_AUTH_SECRET` (32+ chars) and `BETTER_AUTH_URL` go in `.env.local`. Remove `JWT_SECRET`.

> Note on dual mounts: Better Auth derives request paths from the incoming URL, not `basePath`. The Next.js catch-all handler (`/api/auth/[...all]`) and the Hono `/api/v1/auth/*` mount both invoke `auth.handler(req)`. Set the client `baseURL` to whichever is canonical (we'll use `/api/v1/auth` to match the existing Hono migration), and the Next handler stays available as a fallback.

---

## Schema changes (`packages/database/src/schema.ts`)

1. Run `npx @better-auth/cli@latest generate --config packages/auth/src/server.ts` to emit Drizzle definitions for: `user`, `session` (with `activeOrganizationId`), `account`, `verification`, `organization`, `member`, `invitation`. Add the `username`/`displayUsername` columns from the plugin.
2. Repurpose our existing `users` table → drop it and introduce **`salon_member`** with the salon-specific profile fields:
   ```
   salon_member { id, userId (FK better_auth.user.id), organizationId (FK organization.id),
                  displayName, color, active, createdAt }
   ```
   `role` lives on Better Auth's `member` row, not here. `salon_member` is a 1:1 sidecar to `member` for our domain attributes (color, active).
3. Map `salons` → `organization`:
   - Keep our domain fields (`timezone`, `locale`, `status`, `phone`, `address`) by either (a) writing them to `organization.metadata` JSON, or (b) creating a sidecar `salon_profile { organizationId PK, timezone, locale, status, ... }`. **Pick (b)** for typed access from queries.
4. Update all 23 FKs that currently reference `salons.id` → reference `organization.id` (column renamed `organizationId` everywhere).
5. Wipe `packages/database/drizzle/*` migrations, then `pnpm db:generate` + `pnpm db:push` to produce a single clean baseline.

---

## Middleware (`apps/api/src/middleware/auth.ts`)

Replace JWT verify with:
```ts
export const requireTenant = (perm?: TenantPermission) =>
  createMiddleware(async (c, next) => {
    const session = await auth.api.getSession({ headers: c.req.raw.headers });
    if (!session?.user) return c.json({ error: "unauthorized" }, 401);
    const orgId = session.session.activeOrganizationId;
    if (!orgId) return c.json({ error: "no active salon" }, 403);

    const member = await auth.api.getActiveMember({ headers: c.req.raw.headers });
    if (perm && !hasPermission(member.role, perm)) return c.json({ error: "forbidden" }, 403);

    c.set("tenant", {
      userId: session.user.id,
      salonId: orgId,
      role: member.role, // 'owner' | 'admin' | 'member'
      name: session.user.name,
      phone: session.user.username,
    });
    await next();
  });
```
`hasPermission` lives in `packages/auth/src/permissions.ts` and maps `owner`/`admin` → manager-tier perms, `member` → staff-tier.

All 17 Hono routes keep using `c.var.tenant.salonId` — they don't need to change because the field is preserved.

---

## Signup flow (`apps/api/src/routes/auth.ts` — wrapper kept)

Better Auth's stock signup only creates a `user`. Wrap it with one Hono route `POST /api/v1/auth/signup-salon` that, in a transaction:

1. `auth.api.signUpEmail({ body: { email: `${phone}@aravira.local`, username: phone, name, password } })`
2. `auth.api.createOrganization({ body: { name: salonName, slug, userId } })` (uses the `allowUserToCreateOrganization: false` server-API bypass — server-side calls are always allowed)
3. Insert `salon_profile` (timezone, locale, status, phone, address)
4. `auth.api.setActiveOrganization({ headers, body: { organizationId } })`

The signup user automatically becomes `owner` of the org.

## Add-staff flow (`apps/api/src/routes/staff.ts` — already exists)

`POST /api/v1/staff` (manager-only) replaces direct DB insert with:
1. `auth.api.signUpEmail({ body: { email: `${phone}@aravira.local`, username: phone, name, password } })` — server-side, no session impact for the caller.
2. `auth.api.addMember({ body: { userId, role: "member", organizationId: c.var.tenant.salonId } })`
3. Insert `salon_member` sidecar row (color, active).

No email invite is sent — direct provisioning, matching today's UX.

---

## Client (`apps/app`)

`packages/auth/src/client.ts`:
```ts
import { createAuthClient } from "better-auth/react";
import { usernameClient } from "better-auth/client/plugins";
import { organizationClient } from "better-auth/client/plugins";
export const authClient = createAuthClient({
  baseURL: "/api/v1/auth",
  plugins: [usernameClient(), organizationClient()],
});
```

- `apps/app/app/login/page.tsx` → `authClient.signIn.username({ username: phone, password })`
- `apps/app/app/signup/page.tsx` → POST to `/api/v1/auth/signup-salon` (our wrapper)
- `apps/app/components/auth-provider.tsx` → drop the custom `refresh()`/cookie reader, use `authClient.useSession()` and `authClient.useActiveOrganization()`.
- `apps/app/components/staff/staff-drawer.tsx` → no change (still POSTs to `/api/staff`).
- `apps/app/app/api/auth/[...all]/route.ts` (new) → `export const { GET, POST } = toNextJsHandler(auth)` so Next.js direct calls still work.

---

## Files to modify / create

**Create**
- `packages/auth/src/server.ts` (Better Auth instance)
- `packages/auth/src/client.ts` (React client)
- `packages/auth/src/permissions.ts` (role → permission map)
- `apps/app/app/api/auth/[...all]/route.ts` (Next.js mount)

**Modify**
- `packages/auth/package.json` — add `better-auth`, drop `bcryptjs`/`jose`
- `packages/auth/src/index.ts` — re-export `auth`, `authClient`, types
- `packages/database/src/schema.ts` — add Better Auth tables, rename `salons`→sidecar, drop `users`, add `salon_member`, rename `salonId`→`organizationId` across FKs
- `apps/api/src/app.ts` — mount `auth.handler` on `/api/v1/auth/*`
- `apps/api/src/middleware/auth.ts` — `requireTenant` uses `auth.api.getSession`
- `apps/api/src/routes/auth.ts` — keep only `signup-salon` wrapper; delete login/logout/me (Better Auth provides them)
- `apps/api/src/routes/staff.ts` — use `signUpEmail` + `addMember`
- `apps/app/components/auth-provider.tsx` — `authClient.useSession()`
- `apps/app/app/login/page.tsx`, `app/signup/page.tsx` — call new endpoints

**Delete**
- `apps/app/app/api/auth/login/route.ts`, `logout/route.ts`, `me/route.ts`, `signup/route.ts` (replaced by `[...all]` catch-all)
- `packages/auth/src/auth.ts`, `signup.ts`, `tenant.ts` (replaced)
- `packages/database/drizzle/*.sql` (regenerate clean baseline — DB will be wiped)

**Env**
- Add `BETTER_AUTH_SECRET`, `BETTER_AUTH_URL` to `.env.local` and `.env.example`
- Remove `JWT_SECRET`

---

## Verification

1. `pnpm db:push` succeeds with clean schema.
2. `GET /api/v1/auth/ok` → `{ status: "ok" }` (via Hono).
3. `GET /api/auth/ok` → same (via Next.js mount).
4. Signup flow: `POST /api/v1/auth/signup-salon` with `{ salonName, slug, name, phone, password }` → returns session cookie, `useSession()` returns user, `useActiveOrganization()` returns the new salon.
5. Login flow: `authClient.signIn.username({ username: phone, password })` → cookie set, redirect to `/`.
6. Manager adds staff: `POST /api/v1/staff` → new user created, appears in `listMembers`, can log in with their own phone+password.
7. Staff sign-in → `c.var.tenant.role === "member"`; calling `/api/v1/settings` (manager-only) returns 403.
8. Existing tenant-isolation test (`apps/api/__tests__/tenant-isolation.test.ts`) still passes — salons cannot see each other's data.
9. `pnpm typecheck && pnpm test` green across the workspace.
