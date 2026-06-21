import { describe, expect, it, vi } from 'vitest'

import { createApiClient } from './client'
import { createAuthApi } from './auth'
import { endpoints } from './endpoints'

describe('legacy auth API wrapper', () => {
  it('uses Better Auth phone-number password sign-in for password login', async () => {
    const fetchMock = vi
      .fn<typeof fetch>()
      .mockResolvedValueOnce(
        new Response(JSON.stringify({ user: { id: 'u1' } }), {
          status: 200,
          headers: { 'Content-Type': 'application/json' },
        }),
      )
      .mockResolvedValueOnce(
        new Response(
          JSON.stringify({
            status: 'ready',
            user: {
              id: 'u1',
              salonId: 's1',
              name: 'Ali',
              role: 'manager',
              phone: '09121234567',
              createdAt: '2026-01-01T00:00:00.000Z',
              serviceIds: null,
            },
          }),
          {
            status: 200,
            headers: { 'Content-Type': 'application/json' },
          },
        ),
      )

    const auth = createAuthApi(
      createApiClient({
        baseUrl: 'https://api.example.test',
        credentials: 'include',
        fetchImpl: fetchMock,
      }),
    )

    const response = await auth.login({
      phone: '09121234567',
      password: 'secret123',
    })

    expect(response.user.id).toBe('u1')
    expect(fetchMock).toHaveBeenNthCalledWith(
      1,
      'https://api.example.test/api/v1/auth/sign-in/phone-number',
      expect.objectContaining({
        method: 'POST',
        credentials: 'include',
        body: JSON.stringify({
          phoneNumber: '09121234567',
          password: 'secret123',
        }),
      }),
    )
    expect(fetchMock).toHaveBeenNthCalledWith(
      2,
      'https://api.example.test/api/v1/auth/me',
      expect.objectContaining({
        method: 'GET',
        credentials: 'include',
      }),
    )
  })

  it('keeps the rollout username/password endpoint defined for rollback callers', () => {
    expect(endpoints.auth.signIn).toBe('/api/v1/auth/sign-in/username')
  })

  it('maps phone OTP send and verify calls to Better Auth phone-number endpoints', async () => {
    const fetchMock = vi
      .fn<typeof fetch>()
      .mockResolvedValueOnce(
        new Response(JSON.stringify({ message: 'OTP sent' }), {
          status: 200,
          headers: { 'Content-Type': 'application/json' },
        }),
      )
      .mockResolvedValueOnce(
        new Response(
          JSON.stringify({
            status: true,
            user: {
              id: 'u1',
              phoneNumber: '09121234567',
              phoneNumberVerified: true,
            },
          }),
          {
            status: 200,
            headers: { 'Content-Type': 'application/json' },
          },
        ),
      )

    const auth = createAuthApi(
      createApiClient({
        baseUrl: 'https://api.example.test',
        credentials: 'include',
        fetchImpl: fetchMock,
      }),
    )

    await auth.sendPhoneOtp({ phone: '09121234567' })
    const response = await auth.verifyPhoneOtp({
      phone: '09121234567',
      code: '123456',
    })

    expect(response.user?.phoneNumberVerified).toBe(true)
    expect(fetchMock).toHaveBeenNthCalledWith(
      1,
      'https://api.example.test/api/v1/auth/phone-number/send-otp',
      expect.objectContaining({
        method: 'POST',
        credentials: 'include',
        body: JSON.stringify({ phoneNumber: '09121234567' }),
      }),
    )
    expect(fetchMock).toHaveBeenNthCalledWith(
      2,
      'https://api.example.test/api/v1/auth/phone-number/verify',
      expect.objectContaining({
        method: 'POST',
        credentials: 'include',
        body: JSON.stringify({
          phoneNumber: '09121234567',
          code: '123456',
        }),
      }),
    )
  })

  it('maps phone status to the app-owned auth helper endpoint', async () => {
    const fetchMock = vi.fn<typeof fetch>().mockResolvedValueOnce(
      new Response(
        JSON.stringify({ registered: true, otpLoginEnabled: false }),
        {
          status: 200,
          headers: { 'Content-Type': 'application/json' },
        },
      ),
    )

    const auth = createAuthApi(
      createApiClient({
        baseUrl: 'https://api.example.test',
        credentials: 'include',
        fetchImpl: fetchMock,
      }),
    )

    const response = await auth.getPhoneStatus({ phone: '09121234567' })

    expect(response.registered).toBe(true)
    expect(response.otpLoginEnabled).toBe(false)
    expect(fetchMock).toHaveBeenCalledWith(
      'https://api.example.test/api/v1/auth/phone-status',
      expect.objectContaining({
        method: 'POST',
        credentials: 'include',
        body: JSON.stringify({ phone: '09121234567' }),
      }),
    )
  })

  it('maps the three password recovery calls without exposing a session', async () => {
    const fetchMock = vi
      .fn<typeof fetch>()
      .mockResolvedValueOnce(
        new Response(JSON.stringify({ status: true }), { status: 200 }),
      )
      .mockResolvedValueOnce(
        new Response(JSON.stringify({ token: 'reset-token' }), { status: 200 }),
      )
      .mockResolvedValueOnce(
        new Response(JSON.stringify({ status: true }), { status: 200 }),
      )
    const auth = createAuthApi(
      createApiClient({
        baseUrl: 'https://api.example.test',
        credentials: 'include',
        fetchImpl: fetchMock,
      }),
    )

    await auth.requestPasswordReset({ phone: '09121234567' })
    const { token } = await auth.verifyPasswordResetOtp({
      phone: '09121234567',
      code: '123456',
    })
    await auth.resetPassword({ token, newPassword: 'new-secret' })

    expect(fetchMock).toHaveBeenNthCalledWith(
      2,
      'https://api.example.test/api/v1/auth/phone-number/verify-password-reset-otp',
      expect.objectContaining({
        body: JSON.stringify({
          phoneNumber: '09121234567',
          otp: '123456',
        }),
      }),
    )
    expect(fetchMock).toHaveBeenNthCalledWith(
      3,
      'https://api.example.test/api/v1/auth/reset-password',
      expect.objectContaining({
        body: JSON.stringify({
          token: 'reset-token',
          newPassword: 'new-secret',
        }),
      }),
    )
  })

  it('maps pre-workspace account and workspace calls to the signup continuation endpoints', async () => {
    const fetchMock = vi
      .fn<typeof fetch>()
      .mockResolvedValueOnce(
        new Response(
          JSON.stringify({
            user: { id: 'u1', name: 'Ali Manager', phone: '09121234567' },
          }),
          {
            status: 200,
            headers: { 'Content-Type': 'application/json' },
          },
        ),
      )
      .mockResolvedValueOnce(
        new Response(
          JSON.stringify({
            user: { id: 'u1', name: 'Ali Manager', phone: '09121234567' },
            salon: { id: 's1', name: 'Salon One', slug: 'salon-one' },
            redirectTo: '/onboarding/welcome',
          }),
          {
            status: 200,
            headers: { 'Content-Type': 'application/json' },
          },
        ),
      )

    const auth = createAuthApi(
      createApiClient({
        baseUrl: 'https://api.example.test',
        credentials: 'include',
        fetchImpl: fetchMock,
      }),
    )

    await auth.completeSignupAccount({
      managerName: 'Ali Manager',
      password: 'secret123',
    })
    const response = await auth.createSignupWorkspace({
      salonName: 'Salon One',
    })

    expect(response.salon.slug).toBe('salon-one')
    expect(fetchMock).toHaveBeenNthCalledWith(
      1,
      'https://api.example.test/api/v1/auth/signup/account',
      expect.objectContaining({
        method: 'POST',
        credentials: 'include',
        body: JSON.stringify({
          managerName: 'Ali Manager',
          password: 'secret123',
        }),
      }),
    )
    expect(fetchMock).toHaveBeenNthCalledWith(
      2,
      'https://api.example.test/api/v1/auth/signup/workspace',
      expect.objectContaining({
        method: 'POST',
        credentials: 'include',
        body: JSON.stringify({ salonName: 'Salon One' }),
      }),
    )
  })

  it('can complete pre-workspace account setup with only a manager name', async () => {
    const fetchMock = vi.fn<typeof fetch>().mockResolvedValue(
      new Response(
        JSON.stringify({
          user: { id: 'u1', name: 'Ali Manager', phone: '09121234567' },
        }),
        {
          status: 200,
          headers: { 'Content-Type': 'application/json' },
        },
      ),
    )

    const auth = createAuthApi(
      createApiClient({
        baseUrl: 'https://api.example.test',
        credentials: 'include',
        fetchImpl: fetchMock,
      }),
    )

    await auth.completeSignupAccount({ managerName: 'Ali Manager' })

    expect(fetchMock).toHaveBeenCalledWith(
      'https://api.example.test/api/v1/auth/signup/account',
      expect.objectContaining({
        method: 'POST',
        credentials: 'include',
        body: JSON.stringify({ managerName: 'Ali Manager' }),
      }),
    )
  })
})
