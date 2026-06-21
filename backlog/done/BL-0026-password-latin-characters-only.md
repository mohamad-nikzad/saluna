---
id: BL-0026
title: Enforce Latin-only characters in password fields
status: done
type: feature
priority: medium
size: small
created: 2026-06-21
updated: 2026-06-21
---

## Problem

Users can enter Persian or other non-Latin characters in password fields. Passwords with Persian characters are hard to type consistently across devices and keyboards, and they create support friction when users forget which script they used.

## Smallest Useful Version

Validate password inputs client- and server-side so only Latin letters, digits, and an agreed set of symbols are accepted. Show a clear Persian error when the input contains disallowed characters.

## Acceptance Criteria

- [x] Password fields reject Persian and other non-Latin characters with a clear validation message.
- [x] Allowed character set is documented in the schema (e.g. ASCII printable characters).
- [x] Validation applies everywhere a new password is set: signup account step, password reset, and any other create-password flows.
- [x] Existing passwords are not invalidated retroactively; enforcement applies on new input only.

## Notes

- Reported on 2026-06-21.
- Shared schemas live in `packages/salon-core/src/forms/auth.ts` (`loginSchema`, `signupSchema`, `preWorkspaceAccountSchema`).
- UI touchpoints include `apps/pwa/src/routes/signup.tsx`, `apps/pwa/src/routes/auth.tsx` (recovery password), and `PasswordInput`.
- Consider reusing or extending `packages/salon-core/src/forms/messages.ts` for the error copy.
- Fixed by adding `newPasswordSchema` with ASCII printable character validation, reusing it across signup, password reset, staff create, and staff password update flows. Login remains unchanged so existing passwords are not invalidated retroactively.
