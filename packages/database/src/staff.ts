export {
  getAllStaff,
  countManagers,
  deactivateStaffMember,
  getStaffBookingAvailabilityForSlot,
  getStaffScheduleForDay,
  getStaffScheduleForDayAnyStatus,
  getStaffSchedules,
  getUserWithServiceIds,
  setStaffSchedules,
  setStaffServiceIds,
  staffMayPerformService,
  findSoleCapableStaffUserId,
  listCapableStaffForService,
  updateStaffMember,
  updateStaffPassword,
} from './internal/staff-queries'

export { getUserById } from './internal/user-queries'
export { getBusinessSettings } from './internal/settings-queries'
export { validateActiveServiceIds } from './internal/service-queries'
export {
  claimStaffProfile,
  createSetupStaffProfile,
  getStaffProfileForUser,
  getClaimedStaffAccessForPhone,
  listSetupStaffProfiles,
} from './setup-staff'
export {
  createManagerStaffInvite,
  evaluateManagerStaffInvite,
  getPendingStaffInviteForProfile,
  listPendingStaffInvitesForSalon,
  STAFF_INVITE_TTL_MS,
  type CreateManagerStaffInviteInput,
  type CreateManagerStaffInviteResult,
  type ManagerStaffInviteDecision,
  type ManagerStaffInviteRejectionReason,
} from './staff-invites'
export {
  acceptStaffInvite,
  declineStaffInvite,
  evaluateStaffInviteAcceptance,
  evaluateStaffInviteDecline,
  listPendingStaffInvitesForUser,
  type AcceptStaffInviteResult,
  type DeclineStaffInviteResult,
  type PendingStaffInviteView,
  type StaffInviteAcceptanceRejectionReason,
  type StaffInviteDeclineRejectionReason,
} from './staff-invite-acceptance'
export {
  evaluateStaffTenantAccess,
  listActiveStaffProfileAccessesForUser,
  resolveStaffTenantContext,
  type ActiveStaffProfileAccessSnapshot,
  type ResolveStaffTenantContextResult,
  type StaffTenantAccessDecision,
  type StaffTenantAccessRejectionReason,
} from './staff-profile-access'
export {
  deactivateStaffProfileWithAccessRevocation,
  evaluateStaffAccessRevocation,
  leaveStaffProfileAccess,
  reactivateStaffProfile,
  revokeStaffProfileAccess,
  type ReactivateStaffProfileResult,
  type RevokeStaffProfileAccessResult,
  type StaffAccessRevocationMode,
  type StaffAccessRevocationRejectionReason,
} from './staff-access-revocation'
