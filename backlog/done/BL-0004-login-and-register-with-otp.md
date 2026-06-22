---
id: BL-0004
title: Login and register with OTP
status: done
type: feature
priority: high
size: large
created: 2026-06-13
updated: 2026-06-22
---

## Problem

Phone-first users may prefer login and registration through OTP instead of password-based authentication.

## Smallest Useful Version

Add phone OTP authentication for salon users while preserving existing authentication until the new flow is proven.

## Acceptance Criteria

- [x] User can request an OTP for a phone number.
- [x] User can verify OTP and receive an authenticated session.
- [x] OTPs expire and cannot be reused.
- [x] Rate limits or abuse controls exist for OTP requests.

## Notes

- Original note: "Add support for login/register with OTP".
- Related: BL-0008 SMS support, BL-0006 request appointment via OTP.
