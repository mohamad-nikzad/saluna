---
id: BL-0024
title: Login validation errors persist through OTP flow and back to login
status: done
type: bug
priority: high
size: small
created: 2026-06-21
updated: 2026-06-21
---

## Problem

On the login screen, when a login attempt fails (for example incorrect phone number or password), the validation or error message stays visible after the user moves into the OTP flow or navigates back to login. Stale errors from a previous step make the current screen look broken even when the user has changed path.

## Reproduction

1. Open the manager PWA login screen.
2. Enter credentials that fail validation or login (e.g. wrong password).
3. Observe the error message (e.g. «شماره موبایل یا رمز عبور اشتباه است»).
4. Continue into the OTP flow, or go back to login from OTP.
5. Observe that the previous error message is still shown on the new step.

## Smallest Useful Version

Clear `react-hook-form` errors (`root`, `phone`, `password`) and related local error state (`otpError`, `recoveryError`) whenever auth mode changes in `apps/pwa/src/routes/auth.tsx` — including transitions between `phone`, `password`, `otp`, and recovery modes.

## Acceptance Criteria

- [x] A failed password-login error does not remain visible after switching to OTP.
- [x] OTP or recovery errors do not remain visible after returning to the phone or password login step.
- [x] Each auth mode starts without stale error messages from a previous mode unless a new action on that step produces one.

## Notes

- Reported in production-like flow on 2026-06-21.
- Related: [BL-0004 Login and register with OTP](BL-0004-login-and-register-with-otp.md).
- Fixed by clearing `clearErrors()`, `otpError`, and `recoveryError` in a `useEffect` on `mode` change in `apps/pwa/src/routes/auth.tsx`.
