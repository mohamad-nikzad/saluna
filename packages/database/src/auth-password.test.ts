import { describe, expect, it } from 'vitest'
import {
  hashCredentialPassword,
  verifyCredentialPassword,
} from './auth-password'

describe('credential password hashing', () => {
  it('verifies passwords hashed for Better Auth credential accounts', async () => {
    const hash = await hashCredentialPassword('secret123')

    expect(hash).toMatch(/^[a-f0-9]{32}:[a-f0-9]{128}$/)
    await expect(verifyCredentialPassword(hash, 'secret123')).resolves.toBe(
      true,
    )
    await expect(verifyCredentialPassword(hash, 'wrong-pass')).resolves.toBe(
      false,
    )
  })
})
