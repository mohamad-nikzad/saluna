# Platform admin production

The platform admin is served at `https://admin.saluna.ir`. Its static image is
`saluna-admin`, and its `/api/` requests are proxied by the gateway to the
existing API. Admin sessions use the `saluna-admin` cookie namespace.

## First deployment

1. Create a proxied Arvan A record named `admin` pointing to the VPS origin IP.
2. Ensure Arvan's public certificate covers `admin.saluna.ir`.
3. Install the admin origin certificate and private key at
   `/opt/saluna/deploy/nginx/certs/admin-origin.crt` and `admin-origin.key`.
   The current origin uses self-signed certificates behind Arvan. The private
   key must have mode `0600` and the certificate must cover `admin.saluna.ir`.
4. Set `ADMIN_DOMAIN=admin.saluna.ir`,
   `ADMIN_ORIGIN=https://admin.saluna.ir`, and `ADMIN_DATA_SOURCE=live` in the VPS
   env file. Add the admin origin to the existing `CORS_ORIGINS` list.
5. If no active platform owner exists, set
   `PLATFORM_ADMIN_BOOTSTRAP_PHONES` to the chosen existing account's phone.
   That account must already have a password. Its first admin login creates
   platform-owner access. Clear the bootstrap setting after that login.
6. Build and deploy `admin` using the GitHub production workflows. Deploy it
   before other apps when introducing its gateway route. Restart the existing
   API container to load the new env settings.

## Verification

Check `/login` and a direct SPA route such as `/overview`, then verify that
`/api/v1/admin/auth/me` returns `401` without a session. A valid login must
return a Secure, HttpOnly admin session cookie. The public HTML must include
the admin CSP and `X-Frame-Options: DENY` headers. API responses must use
`Cache-Control: no-store`.

The admin image has its own version and tag. It can be released independently
through GitHub, the HamGit fallback, or `scripts/build-push-registry-app.sh` and
`scripts/deploy-registry-app.sh`.

The first production owner was provisioned on 2026-09-30 with an audit event.
The temporary bootstrap phone allowlist was then cleared. Successful owner
login and healthy admin, API, and gateway containers were verified.

The admin origin certificate expires on 2029-01-02. Renew it before that date.
Arvan's API is reachable from the VPS network; the setup used the key through
SSH stdin without saving it on the VPS.
