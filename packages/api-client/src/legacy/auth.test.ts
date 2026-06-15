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
})
