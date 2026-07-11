---
id: BL-0031
title: Assisted Salon Setup and handoff
status: done
type: feature
priority: high
size: large
created: 2026-06-23
updated: 2026-07-11
---

## Problem Statement

Saluna's small marketing and operations team may reach salon owners in person who want to join but do not want to configure the product themselves before they can use it. Today, a salon workspace is created through owner signup and then configured through the manager onboarding flow. Platform admins can inspect salons and perform governance actions, but they cannot create a non-public salon, prepare its operating data, and hand ownership to the intended owner.

This makes joining slower for salon owners and turns a useful high-touch sales service into manual work outside the product. The team needs one short, safe path from an in-person agreement to a usable salon without creating passwords for owners or staff, impersonating tenant users, or exposing a salon publicly before handoff.

## Solution

Add Assisted Salon Setup to the existing admin app. An authorized platform owner or platform admin creates a non-public `Setup Salon` with the salon name and intended owner's phone, then prepares its working hours, service catalog, unclaimed `Staff Profile`s and schedules, `Salon Presence`, social links, and `Client` records.

When preparation is finished, the admin sends or copies a one-time handoff link. The intended `Salon Owner` opens the link, verifies the recorded phone through OTP, and establishes their password when they do not already have a Saluna identity. A successful `Salon Handoff` atomically connects the verified owner to the salon, activates it, and ends ordinary assisted-setup editing. The owner can immediately use the normal manager app and change any prepared information.

The public salon page remains disabled unless the admin explicitly enables it at handoff. A `Platform Owner` retains audited override access to active salons without receiving authentication secrets or impersonating salon users.

## User Stories

1. As a platform admin, I want to create a Setup Salon from the admin app, so that I can prepare a salon before its owner uses Saluna.
2. As a platform admin, I want to enter the intended owner's phone when creating a Setup Salon, so that the eventual handoff is tied to the expected person.
3. As a platform admin, I want owner phones normalized consistently, so that Persian digits and alternate Iranian phone formats do not create duplicate identities.
4. As a platform admin, I want to see when the intended owner's phone is already associated with a salon, so that I do not accidentally create a duplicate salon.
5. As a platform admin, I want a Setup Salon to remain non-public, so that incomplete information is not exposed to customers.
6. As a platform admin, I want Setup Salons clearly distinguished from active, suspended, and archived salons, so that I understand their ownership state.
7. As a platform viewer or platform support user, I want setup controls hidden and forbidden, so that only authorized platform staff can prepare or hand off salons.
8. As a platform admin, I want to configure Salon Working Days and business hours, so that the salon starts with useful availability.
9. As a platform admin, I want to apply a CatalogPreset or create and edit ServiceVariants, so that the salon starts with its real service menu and prices.
10. As a platform admin, I want to create Staff Profiles without passwords or verified login identities, so that staff can appear in schedules safely before first login.
11. As a platform admin, I want to configure Staff Profile schedules and ServiceVariant capabilities, so that the prepared calendar and availability are useful at handoff.
12. As a platform admin, I want to see that a staff phone belongs to another salon, including that salon's name and status, so that I can resolve identity conflicts deliberately.
13. As a staff member, I want to enter my phone on first login and verify it through OTP, so that I can claim my Staff Profile without an admin choosing my password.
14. As a staff member without an existing Saluna identity, I want to set my password after OTP verification, so that only I know my credentials.
15. As an existing Saluna user, I want my verified identity reused when I claim a Staff Profile, so that duplicate users are not created.
16. As a staff member moving salons, I want OTP verification to move my login access while the previous salon retains its Staff Profile and operational history, so that identity ownership and salon records remain separate.
17. As a platform admin, I want to configure Salon Presence, including address, map links, and social links, so that the owner does not need to re-enter public contact information.
18. As a platform admin, I want to add Clients individually, so that a small customer list can be prepared without a file.
19. As a platform admin, I want to preview a VCF or CSV Client Import, so that I can see valid, duplicate, and rejected rows before committing.
20. As a platform admin, I want Client Import to create only the rows I explicitly confirm, so that preview is the clear commit boundary.
21. As a platform admin, I want imported Client phone numbers deduplicated against the salon and within the file, so that setup does not create obvious duplicate records.
22. As a salon owner, I want Saluna not to retain my source Client file after import, so that the file does not become an unmanaged second copy of customer data.
23. As a platform admin, I want to edit the intended owner phone before handoff, so that I can correct data-entry mistakes.
24. As a platform admin, I want to generate a one-time handoff link, so that I can send it to the owner or let them open it during an in-person visit.
25. As the intended salon owner, I want the handoff flow to verify the phone recorded on the Setup Salon, so that another person cannot claim it.
26. As the intended salon owner, I want to set a password only after successful OTP verification, so that platform staff never knows my credentials.
27. As an existing Saluna user without another salon, I want handoff to reuse my identity, so that I do not receive a duplicate account.
28. As a salon owner, I want successful handoff to take me directly into the normal manager app, so that I can begin using and editing the prepared salon immediately.
29. As a platform admin, I want handoff to be safe to retry, so that repeated taps or interrupted requests cannot create duplicate owners or salons.
30. As a platform admin, I want ordinary setup editing to stop automatically after handoff, so that the active salon is controlled by its owner.
31. As a platform admin, I want public-page publication to be an explicit handoff choice that defaults off, so that handoff does not accidentally publish unfinished information.
32. As a Platform Owner, I want audited override access to active salon data, so that the small operations team can resolve exceptional support needs.
33. As a salon owner, I want Platform Owner Override never to expose passwords, OTPs, sessions, or messaging secrets, so that operational support cannot become impersonation.
34. As a platform owner, I want Setup Salon creation, assisted writes, handoff, and overrides attributed to the real platform actor, so that operational actions remain accountable.
35. As a platform admin, I want clear validation and conflict messages throughout setup and handoff, so that I can fix problems without database intervention.
36. As a salon owner, I want all assisted data to remain editable in the manager app after handoff, so that the initial setup never locks my business into Saluna's choices.

## Implementation Decisions

- Introduce `setup` as a salon lifecycle status alongside `active`, `suspended`, and `archived`. A Setup Salon has an intended-owner phone and no owner membership until handoff.
- Setup Salon creation also creates the ordinary salon sidecars required by the existing domain: Salon Presence/profile data, business settings, public settings, and onboarding state. It does not create a placeholder owner user.
- Normalize the intended-owner phone with the existing canonical salon-phone rules and check existing user/membership associations before creation and handoff.
- Add a dedicated `manage_assisted_setup` platform permission. Initially grant it only to `platform_owner` and `platform_admin`; do not introduce another platform role.
- Keep admin and tenant authorization separate. Admin setup endpoints call shared domain operations with an explicit salon scope; they do not create a tenant session or impersonate a manager.
- Build a deep Setup Salon lifecycle module that owns creation, lifecycle validation, handoff eligibility, atomic owner attachment, activation, and retry/idempotency behavior behind a small interface.
- Build a deep assisted-setup authorization module that answers whether a platform actor may mutate a salon based on permission and salon lifecycle. Ordinary assisted writes are allowed only while the salon is `setup`.
- Reuse existing business-setting, service-catalog, Staff Profile, schedule, Salon Presence, and Client domain operations rather than implementing admin-only variants of their business rules.
- Add an admin Setup Salon editor within the existing salon area. Keep the experience task-oriented and small: identity, hours, services, staff, Presence, Clients, and handoff.
- Keep the public page disabled throughout setup. Handoff has an explicit enable-public-page option that defaults to false.
- Separate salon-owned Staff Profiles from login identities. Assisted setup creates unclaimed Staff Profiles and never creates passwords or marks phones verified.
- Build a deep Staff Account Claim module that verifies phone ownership, reuses an existing identity when present, establishes a password only for an identity without credentials, and preserves the previous salon's Staff Profile during a verified transfer.
- Multi-salon staff membership remains unsupported. One staff identity may claim one salon at a time.
- Extend Client Import with CSV input while retaining VCF and the existing phone normalization, duplicate detection, preview, and bulk-create behavior.
- CSV and VCF assisted imports initially map Client name and phone only. Notes and tags remain available through individual editing.
- Treat Client Import confirmation as the commit boundary. Do not add import-batch rollback. Corrections after confirmation use normal Client editing.
- Do not persist source VCF/CSV files. Audit import authorization and aggregate counts, not Client names, phones, or file contents.
- Handoff uses the intended-owner phone stored on the Setup Salon. OTP verification is mandatory; platform staff never chooses the owner's password.
- Handoff is atomic and idempotent: it creates or reuses the verified user, establishes the owner membership and salon sidecar, activates the salon, and cannot duplicate those records on retry.
- A handoff phone already owning another salon is a conflict in this version; multi-salon ownership is not introduced by this feature.
- After handoff, the owner uses the existing manager app and may edit every prepared field through existing screens.
- Platform Owner Override remains available after handoff with a required reason, live-data confirmation, and audit event. It excludes credentials, OTP values, session takeover, impersonation, and messaging secrets.
- Audit Setup Salon creation, intended-owner changes, major assisted mutations, Client Import aggregate results, handoff, and Platform Owner Override under the real platform actor.

## Testing Decisions

- Tests assert externally observable domain and API behavior rather than internal helper calls, SQL shape, or component implementation details.
- Test the Setup Salon lifecycle module in isolation for creation, default non-public state, duplicate-owner detection, invalid lifecycle transitions, atomic handoff, retry safety, existing-user reuse, and conflicting ownership.
- Test assisted-setup authorization for every platform role, `setup` versus active salon state, and the Platform Owner Override boundary.
- Test Staff Account Claim for unclaimed profiles, OTP enforcement, new-password establishment, existing-user reuse, cross-salon transfer, preserved old Staff Profile data, and rejected unverified claims.
- Test Client Import parsing and preview in isolation for VCF and CSV, Persian/Latin phone forms, missing fields, duplicates, invalid rows, and confirmed selection.
- Add API integration tests proving setup endpoints remain platform-authenticated, tenant endpoints remain tenant-authenticated, and neither path can be substituted for the other.
- Add admin UI behavior tests for creating a Setup Salon, editing each supported setup area, previewing Client Import, handling conflicts, and initiating handoff.
- Add owner-flow tests for OTP handoff, password setup, successful activation, retry behavior, and redirect into the existing manager app.
- Add regression tests proving Setup Salons never appear on public salon routes and cannot receive public AppointmentRequests before activation.
- Follow existing test prior art in admin route tests, admin feature tests, auth/OTP route tests, onboarding route tests, salon-profile/public-settings tests, Staff Profile tests, and Client Import unit tests.

## Out of Scope

- A Setup Case, assignee queue, setup project, owner review step, setup-progress notifications, or separate cancellation workflow.
- Requiring the Salon Owner to create the workspace before platform staff begins preparation.
- Tenant impersonation, session takeover, password visibility, OTP visibility, or admin-created owner/staff passwords.
- Multiple owners or one owner managing multiple salons.
- Concurrent staff membership in multiple salons; tracked separately by BL-0016.
- Appointment history migration, future appointment migration, payment data migration, memberships, packages, accounting data, or messaging-account setup.
- Automatic publication of the salon's public page.
- Client Import rollback, persistent source-file storage, or importing fields beyond name and phone in the first version.
- A new marketing or onboarding-specialist platform role.
- Automated SMS delivery of the handoff link; the admin may copy and send the link through the team's existing communication channel. OTP delivery continues to use the existing authentication provider behavior.
- Formal training, onboarding appointments, or customer-success project management inside Saluna.

## Child Implementation Slices

1. [BL-0032 Create and recognize a Setup Salon](BL-0032-create-and-recognize-setup-salon.md)
2. [BL-0033 Configure Setup Salon hours and Presence](BL-0033-configure-setup-salon-hours-and-presence.md)
3. [BL-0034 Configure the Setup Salon service catalog](BL-0034-configure-setup-salon-service-catalog.md)
4. [BL-0035 Create and claim unclaimed Staff Profiles](BL-0035-create-and-claim-unclaimed-staff-profiles.md)
5. [BL-0036 Transfer verified staff access between salons](BL-0036-transfer-verified-staff-access-between-salons.md)
6. [BL-0037 Add and import Setup Salon Clients](BL-0037-add-and-import-setup-salon-clients.md)
7. [BL-0038 Hand a Setup Salon to a new owner](BL-0038-hand-off-setup-salon-to-new-owner.md)
8. [BL-0039 Harden Salon Handoff for existing identities and retries](BL-0039-harden-salon-handoff-existing-identities-and-retries.md)
9. [BL-0040 Add audited Platform Owner Override](BL-0040-add-audited-platform-owner-override.md)

## Further Notes

- This feature deliberately serves a small, high-touch team. The product object is the Setup Salon itself; there is no parallel setup-workflow aggregate.
- The existing admin app, platform RBAC, admin audit log, salon onboarding operations, CatalogPreset support, OTP signup, and Client Import behavior provide substantial prior art.
- Assisted onboarding in comparable salon products commonly combines configuration, migration, and handoff to the business; Saluna's first version keeps only the parts needed by its current team.
- Domain language and architectural boundaries are recorded in `CONTEXT.md` and ADRs 0006–0008.
- Closed 2026-07-11: all child slices BL-0032 through BL-0040 are done. Parent tracker closed after verifying no open children remain.
