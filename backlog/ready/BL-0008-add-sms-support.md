---
id: BL-0008
title: Add SMS support
status: ready
type: feature
priority: high
size: medium
created: 2026-06-13
updated: 2026-06-13
---

## Problem

OTP, reminders, and customer notifications need an SMS delivery channel in addition to existing messaging channels.

## Smallest Useful Version

Add one SMS provider behind a small messaging abstraction that can send OTP messages and be reused later for notifications.

## Acceptance Criteria

- [ ] SMS provider configuration is environment-based.
- [ ] Server can send a basic SMS message.
- [ ] Delivery errors are handled and logged without leaking secrets.
- [ ] OTP-related flows can call the SMS sender.

## Notes

- Original note: "add SMS support".
- Related: BL-0004, BL-0006.
