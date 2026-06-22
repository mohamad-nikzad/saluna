---
id: BL-0023
title: Support ticket system
status: done
type: feature
priority: medium
size: large
created: 2026-06-20
updated: 2026-06-22
---

## Problem

Salon managers need a dependable way to ask questions, report problems, and suggest features without leaving Saluna. Platform support needs one operational inbox in the admin app where those conversations can be answered and resolved.

## Smallest Useful Version

Add manager-only, salon-scoped Support Tickets to the manager PWA and a shared ticket inbox to the admin app. Each ticket is a two-way conversation between the salon's managers and Saluna platform support.

Managers create a ticket with a required category, short subject, and first message. The salon, submitting manager, and creation time are captured automatically. Categories are `problem`, `question`, `feature_request`, and `other`.

Ticket lifecycle is automatic:

- A new ticket or manager message sets `open`.
- A platform-support reply sets `waiting_for_manager`.
- Platform support may reply and resolve in one action.
- Only platform support may set `resolved`.
- Any later message on a resolved ticket sets it back to `open`.

Resolving a feature-request ticket completes the support conversation only; it does not accept, schedule, or deliver the feature.

## Access and Identity

- Authenticated salon managers may submit tickets and view every ticket belonging to their salon.
- Salon staff have no Support Ticket access in v1.
- Platform owners, admins, and support users may view, reply, change status, and resolve.
- Platform viewers have read-only access.
- Use explicit ticket permissions rather than inferring access from platform-role rank.
- Manager messages show the individual manager's display name.
- Manager-facing platform messages show `پشتیبانی سالونا`; the actual platform author remains recorded for internal accountability and audit.
- Platform replies and ticket status changes are recorded in the existing admin audit log with the real platform actor.

## Manager Experience

- Add `پشتیبانی` to the manager PWA's More/settings hub, not the primary bottom navigation.
- Provide salon ticket list, ticket detail/conversation, and create-ticket flows.
- Show unread support activity on the Support row and the More entry.
- Unread state is shared by the salon: once any manager reads new support activity, it is read for all managers.
- Notify managers in-app when platform support replies.

## Admin Experience

- Show a ticket icon with the unresolved count in the admin header; it opens the ticket inbox.
- Default the inbox to unresolved tickets ordered by newest activity.
- Filter by status, category, and salon.
- Search by ticket subject and salon name.
- Keep resolved tickets accessible through filtering.
- Show new/unread activity in the inbox.

## Acceptance Criteria

- [x] A manager can create a ticket with category, subject, and first message.
- [x] Every manager in that salon can view and reply to the salon's tickets; staff cannot access them.
- [x] Authorized platform users can view the admin inbox and ticket conversations according to their ticket permissions.
- [x] Manager and platform messages retain their real author internally and show the agreed manager-facing identities.
- [x] Platform replies and status changes appear in the admin audit log with their real actor.
- [x] Messages are immutable; corrections are sent as new messages.
- [x] Message authorship automatically applies the agreed lifecycle transitions.
- [x] Only authorized platform users can resolve a ticket.
- [x] A message on a resolved ticket reopens it.
- [x] Manager in-app unread indicators use salon-shared read state.
- [x] Admin header and inbox expose unresolved and new ticket activity.
- [x] Admin filtering, ordering, and search work as described.
- [x] Resolving a feature request does not create or change product-backlog work.

## Out of Scope for V1

- Staff submission or visibility
- Manager-selected priority or urgency
- Attachments
- Ticket assignment or claiming
- Private ticket-specific internal notes
- Editing or deleting messages
- Permanently locked or separately closed tickets
- SMS, email, or push notifications
- Automatic engineering issue or product-backlog creation

## Notes

- Use the existing platform roles: `platform_owner`, `platform_admin`, `platform_support`, and `platform_viewer`.
- Existing salon/user internal notes remain available when platform staff need private operational context.
- Implementation plan: [`../../docs/superpowers/plans/2026-06-20-support-ticket-system-plan.md`](../../docs/superpowers/plans/2026-06-20-support-ticket-system-plan.md)
