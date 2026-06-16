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
      user: { id: string; name: string; phone: string }
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

export type PhoneStatusResponse = { registered: boolean }

export type PreWorkspaceResponse = {
  user: PreWorkspaceUser
  salon: { id: string; name: string; slug: string }
  redirectTo?: string
}

export function createAuthApi(client: ApiClient) {
  function me(opts: { signal?: AbortSignal } = {}) {
    return client.request<MeResponse>(endpoints.auth.me, {
      signal: opts.signal,
    })
  }

  return {
    me,
    // Better Auth phone sign-in sets the session cookie; we then resolve the
    // full legacy `User` via the `/me` shim so callers keep the old contract.
    async login(input: LoginInput): Promise<LoginResponse> {
      await client.request(endpoints.auth.signInPhoneNumber, {
        method: 'POST',
        body: { phoneNumber: input.phone, password: input.password },
      })
      const response = await me()
      if (response.status === 'needs_workspace') {
        throw new Error('authenticated user has no workspace')
      }
      return { user: response.user }
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
    // The signup wrapper creates the org + sidecars and sets the session cookie;
    // `/me` then yields the full `User` (role/salonId resolved server-side).
    async signup(input: SignupInput): Promise<SignupResponse> {
      const created = await client.request<{
        salon: { id: string; name: string; slug: string }
        redirectTo?: string
      }>(endpoints.auth.signup, { method: 'POST', body: input })
      const response = await me()
      if (response.status === 'needs_workspace') {
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
