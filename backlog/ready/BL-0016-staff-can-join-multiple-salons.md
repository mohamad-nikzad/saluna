---
id: BL-0016
title: Staff can join multiple salons through invites
status: ready
type: feature
priority: medium
size: large
created: 2026-06-13
updated: 2026-07-09
---

## Problem Statement

Staff commonly work at more than one salon. The current model allows a verified staff identity to access only one salon's Staff Profile at a time, so joining a new workplace can detach access from the previous one.

That model does not match the real world. A staff member needs one verified identity that can accept access to multiple salon-owned Staff Profiles, while each salon keeps ownership of its own schedule, ServiceVariant capabilities, appointments, and operational history.

## Solution

Replace the user-facing "claim or transfer staff access" model with an invite-based model:

- Managers invite staff to a salon-owned Staff Profile.
- Staff register or log in themselves, verify the invited phone, and explicitly accept or decline each invite.
- Accepted invites create Staff Profile Access links between the staff identity and salon-owned Staff Profiles.
- One staff identity can have active Staff Profile Access in many salons, but only one active Staff Profile Access per salon.
- Staff choose an active salon context after login and can switch salons inside the app.
- Staff appointment views and API calls stay scoped to the current salon context and show only appointments for that staff member's linked Staff Profile.
- Manager removal or staff self-leave revokes access only. The Staff Profile, schedule, capabilities, future appointments, and history remain salon-owned.

## User Stories

1. As a salon manager, I want to invite a staff member by name and phone, so that they can connect their own verified login to my salon.
2. As a salon manager, I want inviting staff to create a salon-owned Staff Profile, so that the person can appear in my staff list immediately.
3. As a salon manager, I want invited staff to show as pending before acceptance, so that I understand they do not yet have login access.
4. As a salon manager, I want pending invited staff to remain configurable, so that I can set schedule and ServiceVariant capabilities before they log in.
5. As a salon manager, I want staff invites to require only name and phone, so that inviting someone is quick.
6. As a salon manager, I want schedule and ServiceVariant capabilities to remain editable after invite creation, so that operational setup can happen later.
7. As a salon manager, I want to resend a pending invite, so that I can help staff who missed the first link.
8. As a salon manager, I want to cancel a pending invite without deleting the Staff Profile, so that I can correct mistakes without losing operational setup.
9. As a salon manager, I want to revoke a staff member's access to my salon, so that they can no longer log in to this salon.
10. As a salon manager, I want access revocation to preserve the Staff Profile and appointment history, so that salon records remain intact.
11. As a salon manager, I want access revocation to leave future appointments assigned, so that I can decide whether to reassign them manually.
12. As a salon manager, I want revoking access to be separate from deactivating the Staff Profile, so that operational status and login access are not confused.
13. As a salon manager, I want deactivating a Staff Profile to remove login access for that salon, so that inactive staff cannot enter the salon context.
14. As a salon manager, I want inactive Staff Profiles to be blocked from new invites until reactivated, so that inactive continues to mean not usable.
15. As a salon manager, I want one Staff Profile to have at most one accepted staff identity, so that one operational person is not shared by multiple logins.
16. As a salon manager, I do not want to see whether an invited phone works at another salon, so that other salons' staffing remains private.
17. As a staff member, I want to register or log in myself before accepting access, so that managers cannot create credentials for me.
18. As a staff member, I want invite acceptance to require OTP verification for the invited phone, so that only the phone owner can accept.
19. As a staff member, I want to explicitly accept each invite, so that I am never silently added to a salon.
20. As a staff member, I want to decline an invite, so that I can reject access I do not want.
21. As a staff member, I want pending invites to appear after login before salon context selection, so that I can handle them from my account entry screen.
22. As a staff member, I want to accept invites from multiple salons, so that my one identity can represent my real working life.
23. As a staff member, I want accepting a new salon invite to keep my existing salon access, so that joining Salon B does not remove me from Salon A.
24. As a staff member, I want a salon picker after login when I belong to multiple salons, so that I choose the workplace I am entering.
25. As a staff member, I want single-salon login to skip the picker, so that the common case stays fast.
26. As a staff member, I want an in-app salon switcher, so that I can change salon context without logging out.
27. As a staff member, I want the current salon context to be visible, so that I do not manage the wrong salon's appointments.
28. As a staff member, I want to see only my appointments in the current salon, so that client and salon data does not leak across workplaces.
29. As a staff member, I want status changes to apply only to appointments in the current salon context, so that I do not accidentally update another salon.
30. As a staff member, I want notifications from all salons where I have accepted access, so that I do not miss work while viewing another salon.
31. As a staff member, I want notifications to include the salon name, so that I understand which workplace needs attention.
32. As a staff member, I want to leave a salon myself, so that I can end my access without manager action.
33. As a staff member, I want leaving a salon to remove only my access, so that the salon's Staff Profile and appointments stay with the salon.
34. As a staff member, I want invite links to take me to login or registration, so that accepting an invite is easy.
35. As a staff member, I want invite links to remain phone-bound, so that the link alone cannot grant access.
36. As a logged-in user with the wrong phone, I want an invite link to tell me the invite belongs to another account, so that I can switch accounts safely.
37. As the product, I want invite records to keep accepted, declined, revoked, and expired timestamps, so that support can understand what happened.
38. As the product, I want accepted invite history to remain after Staff Profile Access is created, so that the grant path is traceable.
39. As the product, I want old Staff Account Claim and Staff Access Transfer language retired from user-facing flows, so that the domain reflects invite-based multi-salon access.
40. As the product, I want manager/owner multi-salon support excluded from this feature, so that staff multi-salon access can ship independently.

## Implementation Decisions

- Staff Profiles remain salon-owned records. A person working at two salons has two Staff Profiles, one under each salon.
- Add Staff Profile Access as the active permission link between a verified staff identity and a salon-owned Staff Profile.
- Replace the current unique-one-user Staff Profile relationship with a model that permits one identity to have active Staff Profile Access in many salons.
- Enforce one active Staff Profile Access per identity per salon.
- Enforce one active accepted identity per Staff Profile.
- Add Staff Invite as a phone-bound, salon-scoped invitation tied to a Staff Profile.
- Invite acceptance requires a verified identity whose phone matches the invite phone.
- Pending invites grant no salon membership, no appointment access, no notifications, and no API access.
- Invite rows keep status timestamps for accepted, declined, revoked, and expired states. Do not add a full event log in v1.
- Accepted invite rows remain as history after Staff Profile Access is created.
- Invite expiry exists in v1. Resend refreshes delivery metadata and expiry instead of creating duplicate Staff Profiles.
- Invite links may exist now as pointers into login or registration. They do not bypass OTP or verified-phone checks.
- Real SMS delivery is out of scope for v1, but the invite model should leave a delivery hook so SMS can be enabled later.
- Manager add/invite staff requires name and phone only. Schedule and ServiceVariant capabilities can be added later.
- Staff Profile phone cannot be edited directly while accepted access exists. Changing the person requires revoking access and inviting the intended phone.
- Manager access revocation removes only Staff Profile Access for that salon. It does not delete or deactivate the Staff Profile.
- Staff self-leave uses the same access-revocation model with the staff identity as actor.
- Future appointments remain assigned to the Staff Profile after access revocation. Managers can reassign manually.
- Staff Profile deactivation revokes access for that salon. Reactivation does not automatically restore old access; a fresh invite is required.
- Staff choose active salon context after login if they have multiple accepted salons. Staff with one accepted salon enter directly.
- The PWA persists selected salon ID locally. If it is no longer valid, show the salon picker.
- Tenant-scoped staff API requests send the active salon context as a header, such as `X-Saluna-Salon-Id`.
- Tenant middleware must verify the session identity has active Staff Profile Access for the requested salon before setting tenant context.
- Existing manager/owner single-salon behavior should stay unchanged for this feature.
- Staff appointment views continue to show only appointments for the linked Staff Profile in the current salon.
- Cross-salon appointment conflict detection is not enforced in v1.
- Notifications can fan out for all accepted staff salon accesses and must include salon context.
- Update the domain glossary and ADR-0006 to replace the single-salon Staff Account Claim and Staff Access Transfer rule with Staff Invite, Staff Invite Acceptance, Staff Profile Access, and Staff Access Revocation.
- Keep old claim/transfer internals only as temporary compatibility if needed. Do not keep transfer as the user-facing product path.

## Testing Decisions

- Test external behavior at the highest useful seams: API/domain flows for invite creation, acceptance, revocation, tenant context resolution, and appointment visibility.
- Prefer route-level tests around auth, staff, appointments, notifications, and tenant middleware behavior over low-level implementation tests where possible.
- Add focused domain tests for the invite/access state transitions where route tests would be too expensive or ambiguous.
- PWA tests should cover visible behavior only: post-login salon picker, current salon switcher, pending invite accept/decline, and scoped staff appointment views.
- Notification tests should verify recipients are resolved from all active Staff Profile Access links and that salon context is present.
- Security tests must prove pending invites grant no access, wrong-phone invite acceptance fails, revoked access cannot use a salon context, and staff cannot see appointments outside their active salon context.
- Compatibility tests should cover one-salon staff login so the common current flow does not regress.
- Existing prior art includes auth route tests, staff route tests, notification route tests, appointment route tests, staff profile claim/transfer tests, and PWA query/view tests.

## Out of Scope

- Staff self-request to join a salon.
- Manager-created staff credentials or manager-controlled identity transfer.
- Manager or owner multi-salon switching.
- Cross-salon appointment conflict blocking.
- Merged cross-salon staff calendar.
- Staff editing their own Staff Profile fields.
- Real SMS provider integration for invite delivery.
- Full audit event log for every invite/access transition.
- Automatic reassignment or cancellation of future appointments when access is revoked.
- Revealing whether invited staff work at other salons.

## Further Notes

- Original note: "Add support for staffs be able to join multiple salons".
- This spec supersedes the old one-identity-one-salon assumption in ADR-0006.
- BL-0016 is the shaped parent spec. Split implementation into smaller ready tickets before assigning build work.
