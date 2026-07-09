# Tickets: Multi-salon staff invites

Build invite-based Staff Profile Access so one verified staff identity can work in multiple salons. Source spec: `backlog/ready/BL-0016-staff-can-join-multiple-salons.md`.

Work the **frontier**: any ticket whose blockers are all done.

## Create manager Staff Invites

**What to build:** Managers can add/invite staff with name and phone. The action creates a salon-owned Staff Profile and a pending Staff Invite for that phone. Pending invited staff appear in the manager staff list, can be configured operationally, and have no login access yet.

**Blocked by:** None — can start immediately.

- [x] Manager can create a Staff Invite with only staff name and phone.
- [x] Creating the invite creates or uses one salon-owned Staff Profile for that salon.
- [x] Pending invited staff appear in the manager staff list with a clear pending state.
- [x] Pending invited staff can have schedule and ServiceVariant capabilities configured.
- [x] Pending invites grant no staff tenant access, appointment access, notification fanout, or API access.
- [x] Managers cannot invite inactive Staff Profiles until they reactivate them.
- [x] The same salon cannot create duplicate pending invites or duplicate active Staff Profiles for the same intended staff phone.


> Closed by Sandcastle: Manager Staff Invite create path: name+phone → Staff Profile + pending invite; list pending; schedule/services config; no login access; inactive/duplicate guards
## Accept and decline phone-bound Staff Invites

**What to build:** Staff register or log in themselves, verify the invited phone through OTP, and see pending invites for that phone. They can explicitly accept or decline each invite. Acceptance creates Staff Profile Access for that salon without removing access to any other salon.

**Blocked by:** Create manager Staff Invites.

- [x] Staff can see pending invites for their verified phone after login.
- [x] Staff cannot see or accept invites for a different phone.
- [x] Staff can explicitly accept one invite and gain Staff Profile Access to that salon.
- [x] Staff can explicitly decline one invite and gain no access.
- [x] Accepting a new invite preserves existing Staff Profile Access in other salons.
- [x] One staff identity cannot have more than one active Staff Profile Access in the same salon.
- [x] One Staff Profile cannot have more than one active accepted identity.
- [x] Accepted and declined invite history is retained for support visibility.


> Closed by Sandcastle: Staff list/accept/decline phone-bound invites; accept creates Staff Profile Access and preserves other salon access; history retained
## Authorize staff through Staff Profile Access

**What to build:** Staff authorization uses Staff Profile Access instead of a single claimed Staff Profile. Tenant-scoped staff API behavior resolves the active staff profile for the salon and keeps staff appointment access limited to that Staff Profile.

**Blocked by:** Accept and decline phone-bound Staff Invites.

- [x] Staff tenant access is granted only through active Staff Profile Access.
- [x] Revoked, declined, expired, and pending invites do not authorize tenant requests.
- [x] Staff appointment reads return only appointments for the linked Staff Profile in the requested salon.
- [x] Staff appointment status changes apply only to appointments for the linked Staff Profile in the requested salon.
- [x] Existing one-salon staff login continues to work.
- [x] Existing manager and owner single-salon behavior remains unchanged.
- [x] API and domain tests cover wrong-salon, pending-invite, and revoked-access rejection.


> Closed by Sandcastle: Staff tenant auth via Staff Profile Access + salon header; appointment scoping to linked profile; wrong-salon/pending/revoked rejection tests
## Add staff salon picker and active salon context

**What to build:** Staff with multiple accepted salons choose the salon they are entering after login. The PWA remembers the selected salon, sends that active salon context on tenant API calls, and exposes an in-app salon switcher.

**Blocked by:** Authorize staff through Staff Profile Access.

- [ ] Staff with one accepted salon enter the app without a picker.
- [ ] Staff with multiple accepted salons see a salon picker after login.
- [ ] Staff can switch salons inside the app without logging out.
- [ ] The current salon context is visible in staff-facing screens.
- [ ] The PWA persists selected salon ID locally and falls back to the picker if it is no longer valid.
- [ ] Tenant-scoped staff API calls include the selected salon context.
- [ ] The API verifies the selected salon context against active Staff Profile Access before serving tenant data.

## Revoke and leave Staff Profile Access

**What to build:** Managers can revoke staff access to their salon, and staff can leave a salon themselves. Both actions remove Staff Profile Access only. The Staff Profile, schedule, ServiceVariant capabilities, future appointments, and operational history remain salon-owned.

**Blocked by:** Authorize staff through Staff Profile Access.

- [ ] Manager can revoke a staff member's Staff Profile Access for their salon.
- [ ] Staff can leave a salon and revoke only their own Staff Profile Access.
- [ ] Revocation prevents future tenant access for that salon.
- [ ] Revocation does not delete or deactivate the Staff Profile.
- [ ] Revocation does not remove schedule, ServiceVariant capabilities, appointments, or history.
- [ ] Future appointments remain assigned to the Staff Profile after access is revoked.
- [ ] Deactivating a Staff Profile revokes access for that salon.
- [ ] Reactivating a Staff Profile does not automatically restore old access.

## Handle invite lifecycle and invite links

**What to build:** Managers can cancel and resend pending invites. Invites expire. Invite links route staff into login or registration but never grant access by themselves. SMS delivery remains a future hook rather than a real integration.

**Blocked by:** Accept and decline phone-bound Staff Invites.

- [ ] Manager can cancel a pending invite without deleting the Staff Profile.
- [ ] Manager can resend a pending invite without creating duplicate Staff Profiles.
- [ ] Resending refreshes invite delivery metadata and expiry.
- [ ] Expired invites cannot be accepted.
- [ ] Invite links can route users to login or registration.
- [ ] Invite links still require the logged-in identity to verify the invited phone.
- [ ] Opening an invite link while logged in as a different phone shows a safe switch-account path.
- [ ] The invite model exposes a future delivery hook without requiring real SMS delivery in this ticket.

## Send staff notifications across accepted salons

**What to build:** Staff receive notifications for every salon where they have active Staff Profile Access, regardless of the salon currently selected in the app. Notifications include enough salon context for the staff member to know which workplace needs attention.

**Blocked by:** Authorize staff through Staff Profile Access.

- [ ] Notification recipient resolution uses active Staff Profile Access.
- [ ] Staff receive eligible notifications from all accepted salons.
- [ ] Staff do not receive notifications for pending, declined, expired, or revoked access.
- [ ] Notification content or metadata includes salon context.
- [ ] Current salon selection does not suppress notifications from other accepted salons.
- [ ] Notification tests cover multi-salon staff fanout and revoked-access exclusion.

## Retire claim/transfer language and harden compatibility

**What to build:** Domain language and docs move from Staff Account Claim and Staff Access Transfer to Staff Invite, Staff Invite Acceptance, Staff Profile Access, and Staff Access Revocation. Old claim/transfer paths are removed or kept only as temporary compatibility where necessary.

**Blocked by:** Add staff salon picker and active salon context; Revoke and leave Staff Profile Access; Handle invite lifecycle and invite links; Send staff notifications across accepted salons.

- [ ] Domain glossary describes Staff Invite, Staff Invite Acceptance, Staff Profile Access, and Staff Access Revocation.
- [ ] The ADR for Staff Profiles and login identities is updated to allow one identity across many salon Staff Profiles.
- [ ] User-facing copy no longer presents staff movement as claim or transfer.
- [ ] Legacy claim/transfer internals are removed where safe or documented as compatibility-only.
- [ ] The parent BL-0016 spec links to the implementation tickets or notes the final ticket sequence.
- [ ] Final verification covers invite creation, acceptance, salon switching, revocation, notification fanout, and single-salon compatibility.
