import type { User } from '@repo/salon-core/types'
import type {
  LoginFormPayload,
  PreWorkspaceAccountPayload,
  PreWorkspacePayload,
  SignupFormPayload,
} from '@repo/salon-core/forms/auth'
import type { ApiClient } from './client'
import { endpoints } from './endpoints'

export type LoginInput = LoginFormPayload

export type MeResponse =
  | { status?: 'ready'; user: User }
  | {
      status: 'needs_workspace'
      user: PreWorkspaceUser
    }
  | {
      status: 'needs_staff_password'
      user: PreWorkspaceUser & { salonId: string }
    }
  | {
      status: 'needs_salon_selection'
      user: PreWorkspaceUser
      salons: StaffSalonOption[]
    }

export type StaffSalonOption = {
  salonId: string
  salonName: string
  staffProfileId: string
}

export type PendingStaffInvite = {
  id: string
  salonId: string
  salonName: string
  staffProfileId: string
  staffName: string
  phone: string
  expiresAt: string
  createdAt: string
}

export type LoginResponse = { user: User }

export type SignupInput = SignupFormPayload

export type SignupResponse = {
  user: User
  salon: { id: string; name: string; slug: string }
  redirectTo?: string
}

export type PreWorkspaceUser = {
  id: string
  name: string
  phone: string
  hasPassword?: boolean
}

export type VerifyPhoneOtpResponse = {
  status: boolean
  token?: string | null
  user?: {
    id: string
    phoneNumber: string
    phoneNumberVerified: boolean
  } | null
}

export type PreWorkspaceAccountResponse = { user: PreWorkspaceUser }

export type PhoneStatusResponse = {
  registered: boolean
  otpLoginEnabled: boolean
}

export type SalonHandoffStatusResponse = {
  phone: string
  expiresAt: string
  requiresPassword: boolean
}

export type StaffInviteLinkRouting =
  | { action: 'login' }
  | { action: 'register' }
  | { action: 'switch_account' }
  | { action: 'continue' }
  | { action: 'unavailable'; reason: 'expired' | 'not_pending' }

export type StaffInviteLinkResponse = {
  invite: {
    id: string
    salonId: string
    salonName: string
    staffProfileId: string
    staffName: string
    phone: string
    expiresAt: string
    status: 'pending' | 'expired' | 'revoked' | 'accepted' | 'declined'
  }
  phoneRegistered: boolean
  phonesMatch: boolean | null
  routing: StaffInviteLinkRouting
}

export type PreWorkspaceResponse = {
  user: PreWorkspaceUser
  salon: { id: string; name: string; slug: string }
  redirectTo?: string
}

export function createAuthApi(client: ApiClient) {
  function me(
    opts: {
      signal?: AbortSignal
      salonId?: string | null
    } = {},
  ) {
    const headers: Record<string, string> = {}
    if (opts.salonId) {
      headers['X-Saluna-Salon-Id'] = opts.salonId
    }
    return client.request<MeResponse>(endpoints.auth.me, {
      signal: opts.signal,
      headers: Object.keys(headers).length > 0 ? headers : undefined,
    })
  }

  return {
    me,
    listStaffSalons(opts: { signal?: AbortSignal } = {}) {
      return client.request<{ salons: StaffSalonOption[] }>(
        endpoints.auth.staffSalons,
        { signal: opts.signal },
      )
    },
    listStaffInvites(opts: { signal?: AbortSignal } = {}) {
      return client.request<{ invites: PendingStaffInvite[] }>(
        endpoints.auth.staffInvites,
        { signal: opts.signal },
      )
    },
    acceptStaffInvite(inviteId: string) {
      return client.request(
        `${endpoints.auth.staffInvites}/${encodeURIComponent(inviteId)}/accept`,
        { method: 'POST', body: {} },
      )
    },
    declineStaffInvite(inviteId: string) {
      return client.request(
        `${endpoints.auth.staffInvites}/${encodeURIComponent(inviteId)}/decline`,
        { method: 'POST', body: {} },
      )
    },
    leaveStaffSalon(salonId: string) {
      return client.request<{ success: boolean }>(
        `${endpoints.auth.staffAccess}/leave`,
        { method: 'POST', body: { salonId } },
      )
    },
    // Better Auth phone sign-in sets the session cookie; we then resolve the
    // full legacy session via the `/me` shim (ready, salon picker, etc.).
    async login(
      input: LoginInput,
      opts: { salonId?: string | null } = {},
    ): Promise<MeResponse> {
      await client.request(endpoints.auth.signInPhoneNumber, {
        method: 'POST',
        body: { phoneNumber: input.phone, password: input.password },
      })
      return me({ salonId: opts.salonId })
    },
    sendPhoneOtp(input: { phone: string }) {
      return client.request<{ message: string }>(endpoints.auth.sendPhoneOtp, {
        method: 'POST',
        body: { phoneNumber: input.phone },
      })
    },
    getPhoneStatus(input: { phone: string }) {
      return client.request<PhoneStatusResponse>(endpoints.auth.phoneStatus, {
        method: 'POST',
        body: { phone: input.phone },
      })
    },
    verifyPhoneOtp(input: { phone: string; code: string }) {
      return client.request<VerifyPhoneOtpResponse>(
        endpoints.auth.verifyPhoneOtp,
        {
          method: 'POST',
          body: { phoneNumber: input.phone, code: input.code },
        },
      )
    },
    completeStaffClaim(input: { password: string }) {
      return client.request<{ success: boolean }>(
        endpoints.auth.completeStaffClaim,
        { method: 'POST', body: input },
      )
    },
    requestPasswordReset(input: { phone: string }) {
      return client.request<{ status: boolean }>(
        endpoints.auth.requestPasswordReset,
        {
          method: 'POST',
          body: { phoneNumber: input.phone },
        },
      )
    },
    verifyPasswordResetOtp(input: { phone: string; code: string }) {
      return client.request<{ token: string }>(
        endpoints.auth.verifyPasswordResetOtp,
        {
          method: 'POST',
          body: { phoneNumber: input.phone, otp: input.code },
        },
      )
    },
    resetPassword(input: { token: string; newPassword: string }) {
      return client.request<{ status: boolean }>(endpoints.auth.resetPassword, {
        method: 'POST',
        body: input,
      })
    },
    completeSignupAccount(input: PreWorkspaceAccountPayload) {
      return client.request<PreWorkspaceAccountResponse>(
        endpoints.auth.signupAccount,
        {
          method: 'POST',
          body: input,
        },
      )
    },
    createSignupWorkspace(input: PreWorkspacePayload) {
      return client.request<PreWorkspaceResponse>(
        endpoints.auth.signupWorkspace,
        {
          method: 'POST',
          body: input,
        },
      )
    },
    getSalonHandoff(token: string, opts: { signal?: AbortSignal } = {}) {
      return client.request<SalonHandoffStatusResponse>(
        `${endpoints.salonHandoff}/${encodeURIComponent(token)}`,
        { signal: opts.signal },
      )
    },
    getStaffInviteLink(token: string, opts: { signal?: AbortSignal } = {}) {
      return client.request<StaffInviteLinkResponse>(
        `${endpoints.staffInvites}/${encodeURIComponent(token)}`,
        { signal: opts.signal },
      )
    },
    sendSalonHandoffOtp(token: string) {
      return client.request<{ status?: boolean }>(
        `${endpoints.salonHandoff}/${encodeURIComponent(token)}/send-otp`,
        { method: 'POST', body: {} },
      )
    },
    verifySalonHandoffOtp(token: string, code: string) {
      return client.request<{ status?: boolean }>(
        `${endpoints.salonHandoff}/${encodeURIComponent(token)}/verify-otp`,
        { method: 'POST', body: { code } },
      )
    },
    completeSalonHandoff(
      token: string,
      input: { displayName: string; password?: string },
    ) {
      return client.request<{
        salonId: string
        redirectTo: string
        publicEnabled: boolean
      }>(`${endpoints.salonHandoff}/${encodeURIComponent(token)}/complete`, {
        method: 'POST',
        body: input,
      })
    },
    // The signup wrapper creates the org + sidecars and sets the session cookie;
    // `/me` then yields the full `User` (role/salonId resolved server-side).
    async signup(input: SignupInput): Promise<SignupResponse> {
      const created = await client.request<{
        salon: { id: string; name: string; slug: string }
        redirectTo?: string
      }>(endpoints.auth.signup, { method: 'POST', body: input })
      const response = await me()
      if (
        response.status === 'needs_workspace' ||
        response.status === 'needs_staff_password' ||
        response.status === 'needs_salon_selection'
      ) {
        throw new Error('signup did not create a workspace')
      }
      const { user } = response
      return { user, salon: created.salon, redirectTo: created.redirectTo }
    },
    logout() {
      // Better Auth's /sign-out requires a JSON content-type; the client only
      // sets it when a body is present, so send an empty object.
      return client.request<{ success: boolean }>(endpoints.auth.signOut, {
        method: 'POST',
        body: {},
      })
    },
  }
}

export type AuthApi = ReturnType<typeof createAuthApi>
