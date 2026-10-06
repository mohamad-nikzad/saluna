---
id: BL-0090
title: Make first-time staff login clear
status: done
type: task
triage: ready-for-agent
priority: high
size: medium
blocked_by: []
created: 2026-10-05
updated: 2026-10-06
---

## Problem

Invited staff use the same entry page as Salon Owners, but the page treats an existing login identity as proof that the person has a password. A staff member with no password can therefore be asked to log in with one and must discover "Forgot password" to create their first password. The page also fails to explain the difference between joining a salon and creating a salon.

The October 5 آراویرا incident showed the practical cost. Staff trying to enter an existing salon saw salon setup after password recovery because login preserved an old onboarding redirect. The redirect bug is now fixed, but the first-time staff journey still needs clearer routing and copy.

## Smallest Useful Version

Keep one login entry page. After the person enters their phone number, choose the next step using whether their login identity has a password, their Staff Invites, and their existing Staff Profile Access. Do not ask them to choose "owner or staff."

For staff without a password, offer first-time SMS verification followed by "Create your password." After verification, show the inviting salon by name and let the person explicitly accept or decline its Staff Invite. Staff who already have accepted access proceed into their salon after establishing their password.

First-time verification remains available when repeat SMS login is disabled. An expired invitation explains how to renew access. Creating a salon is an explicit "Create my salon" action rather than an automatic fallback when staff access cannot be resolved.

## Acceptance Criteria

- [x] A person whose login identity has a password sees password login and password recovery after entering their number.
- [x] A staff member without a password receives an explicit first-time verification and password-creation flow, including when their login identity already exists.
- [x] First-time SMS verification works with `AUTH_OTP_LOGIN_ENABLED=false`; completed users still follow the configured restriction on repeat SMS login.
- [x] Verification updates or creates the person's own login identity without creating duplicates, replacing their Staff Profile, or having the manager choose their password.
- [x] A pending Staff Invite names its salon and Staff Profile and offers explicit accept and decline actions. Phone matching and verified-phone checks remain required, and pending invitations grant no salon access.
- [x] Staff with accepted Staff Profile Access and no password can verify their phone, create their password, and enter their salon without using "Forgot password" or accepting the same invitation again.
- [x] An expired Staff Invite remains visible with a clear message to ask the manager to resend it. After renewal, the person can accept it without restarting account setup.
- [x] Staff with one accepted salon enter it directly; staff with multiple accepted salons retain salon selection.
- [x] Staff login, password recovery, and reopening an old link never send staff into salon registration or onboarding. Preserve the existing onboarding route guard and access-denied handling.
- [x] Salon creation requires an explicit "Create my salon" action. A missing or unresolved staff access state does not automatically start salon creation.
- [x] Persian copy distinguishes signing in, creating a password, joining a named salon, and creating a salon. It does not ask first-time staff to recover a password they never created.
- [x] Regression coverage exercises a new invited identity, an existing identity without a password, accepted access without a password, an expired and renewed invite, normal password recovery, and an old onboarding redirect. Cover first-time verification with repeat SMS login disabled and retain Salon Owner login behavior.

## Notes

- Approved direction from the October 5 staff login investigation and follow-up discussion.
- The immediate redirect fix shipped in PWA `0.14.2`, commit `bad1de4881bb9cdfa3ddc6cb4ba77e5aa0d88eec`. This task improves the remaining login journey.
- Follow [ADR-0006](../../docs/adr/0006-separate-staff-profiles-from-login-identities.md): Staff Profiles belong to salons; verified login identities belong to staff; Staff Invites require explicit acceptance.
- Related completed work: [BL-0016](../done/BL-0016-staff-can-join-multiple-salons.md), [BL-0004](../done/BL-0004-login-and-register-with-otp.md), and [BL-0005](../done/BL-0005-forgot-password-flow.md).
- Relevant implementation: `apps/pwa/src/routes/auth.tsx`, `apps/pwa/src/routes/signup.tsx`, `apps/pwa/src/routes/staff-invites.tsx`, `apps/api/src/routes/auth.ts`, and the auth API contract/client.

## Completion notes

- Phone entry uses credential password state. Passwordless Staff Invites and accepted Staff Profile Access lead to SMS verification and personal password creation, even with repeat SMS login disabled.
- Invitation review names the salon and Staff Profile. Expired invitations remain visible, and renewal does not repeat password setup. Declining the last invitation leaves access guidance on screen.
- Salon creation requires the explicit «ساخت سالن خودم» action. Auth entry, home, authenticated routes, salon selection, and old signup links send unresolved access to guidance. Staff login ignores saved signup and onboarding destinations.
- The mobile browser review found and fixed clipped SMS code boxes at 320px. Password forms identify the phone for password managers and explain the password requirements.
- Validation passed: 26 PWA route tests, 64 API auth/invite-link tests, 7 auth client tests, 32 Staff Invite acceptance/access tests, and four real Better Auth journeys in a disposable local PostgreSQL database. Those journeys cover new identities, existing passwordless identities, accepted access, expired/renewed invitations, and password recovery. PWA/API/client typechecks, PWA lint, and the PWA production build passed.
- Existing new-salon E2E helpers now select salon creation explicitly. Browser checks used mocked API responses for mobile phone entry, verification, password creation, invitation review, expiry, and unresolved access. No production deployment was performed.
- Review follow-up: verified identities with accepted Staff Profile Access skip the legacy single-profile claim during SMS verification. Staff with multiple accepted salons reach salon selection directly, and invitation review lets staff continue to accepted salons despite pending or expired invitations.
- First-time password creation now completes an empty credential in place or creates one transactionally. Concurrent setup leaves one credential and preserves the established password. The shared operation retains Better Auth's configured hashing, password limits, and database-backed session checks; staff and signup callers return explicit validation or authentication errors.
- Follow-up validation passed: 30 PWA route tests, 71 API auth/invite-link/handoff tests, 29 auth-package tests, 7 auth-client tests, and 13 real Better Auth journeys in disposable PostgreSQL databases. Regression coverage includes two accepted salons, outstanding invitations alongside accepted access, empty credentials followed by logout and password login, concurrent password setup, password limits, and revoked cached sessions. PWA/API/auth typechecks, targeted API/auth lint, PWA lint, and the PWA production build passed. Independent review found no remaining actionable issues in these fixes.

- UI follow-up: invitation and access screens use a shared layout, clearer action hierarchy, and short Persian descriptions. The existing login, signup, and salon-selection layouts were preserved. Mobile browser checks covered invitation details, expired invitations, and access guidance at 320px and 390px with mocked API responses.
