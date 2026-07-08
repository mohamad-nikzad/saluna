---
id: BL-0025
title: Pre-workspace signup asks for password again after reset; submit returns "رمز عبور قبلاً تنظیم شده است"
status: done
type: bug
priority: high
size: medium
created: 2026-06-21
updated: 2026-06-21
---

## Problem

Users who signed up but never completed the pre-workspace account step (name + password) can get stuck in a broken onboarding state after resetting their password and logging back in. The signup flow still shows the password field, but submitting it fails with:

> رمز عبور قبلاً تنظیم شده است

This blocks completion of account setup and workspace creation.

## Reproduction

1. Sign up with OTP but do not complete the pre-workspace account step (name and password).
2. Log out or lose the session.
3. Use forgot-password to reset the password.
4. Log in successfully with the new password.
5. Land on the pre-workspace signup/account step.
6. Fill in name and password and submit.
7. Observe the `409` error: `رمز عبور قبلاً تنظیم شده است` (`PASSWORD_ALREADY_SET`).

## Smallest Useful Version

Detect when the authenticated user already has a password (for example after password reset) and skip or adapt the account step so submission only updates the missing fields (e.g. manager name) instead of calling `setPassword` again.

## Acceptance Criteria

- [x] A user who reset their password before completing pre-workspace signup can finish account setup without a password error.
- [x] The signup flow does not ask for a new password when one is already set unless the user explicitly chooses to change it.
- [x] Users with only a missing display name can complete onboarding by submitting their name alone.
- [x] Existing happy-path signup (OTP → account → workspace) still works.

## Notes

- Reported on production app on 2026-06-21.
- API returns `PASSWORD_ALREADY_SET` from `POST /signup/account` when `auth.api.setPassword` is called for a user who already has a password (`apps/api/src/routes/auth.ts`).
- Pre-workspace routing likely sends `needs_workspace` users to `/signup` (`apps/pwa/src/routes/signup.tsx`).
- Related: [BL-0005 Forgot password flow](BL-0005-forgot-password-flow.md), [BL-0004 Login and register with OTP](BL-0004-login-and-register-with-otp.md).
- Fixed by exposing `hasPassword` on `/auth/me` for `needs_workspace` users, skipping `setPassword` when a credential password already exists, and adapting the signup account step UI/schema to collect manager name only when `hasPassword` is true.
