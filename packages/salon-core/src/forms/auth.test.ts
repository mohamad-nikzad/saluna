import { describe, expect, it } from 'vitest'

import {
  PASSWORD_ALLOWED_CHARACTERS,
  loginSchema,
  newPasswordSchema,
  preWorkspaceAccountSchema,
  resetPasswordSchema,
  signupSchema,
} from './auth'
import { formMessages } from './messages'

describe('newPasswordSchema', () => {
  it('documents and accepts ASCII printable characters', () => {
    expect(PASSWORD_ALLOWED_CHARACTERS).toBe('ASCII printable characters')
    expect(newPasswordSchema.parse('Az09!@# -_~')).toBe('Az09!@# -_~')
  })

  it('rejects Persian and other non-Latin characters', () => {
    for (const password of ['secret۱۲۳', 'رمزsecret123', 'secreté123']) {
      const result = newPasswordSchema.safeParse(password)
      expect(result.success).toBe(false)
      if (!result.success) {
        expect(result.error.issues[0]?.message).toBe(
          formMessages.passwordLatinOnly,
        )
      }
    }
  })
})

describe('loginSchema', () => {
  it('normalizes Persian-digit phone in output', () => {
    const result = loginSchema.parse({
      phone: '۰۹۱۲۳۴۵۶۷۸۹',
      password: 'secret',
    })
    expect(result.phone).toBe('09123456789')
    expect(result.password).toBe('secret')
  })

  it('rejects too-short phone', () => {
    const result = loginSchema.safeParse({ phone: '0912', password: 'x' })
    expect(result.success).toBe(false)
  })

  it('rejects empty password', () => {
    const result = loginSchema.safeParse({ phone: '09123456789', password: '' })
    expect(result.success).toBe(false)
  })
})

describe('signupSchema', () => {
  it('accepts a valid payload', () => {
    const result = signupSchema.parse({
      salonName: 'سالن رز',
      slug: 'rose-salon',
      managerName: 'علی',
      managerPhone: '09123456789',
      password: 'secret123',
    })
    expect(result.managerPhone).toBe('09123456789')
  })

  it('accepts a payload without a slug', () => {
    const result = signupSchema.safeParse({
      salonName: 'سالن رز',
      managerName: 'علی',
      managerPhone: '09123456789',
      password: 'secret123',
    })
    expect(result.success).toBe(true)
  })

  it('rejects short password', () => {
    const result = signupSchema.safeParse({
      salonName: 'a',
      slug: 'x',
      managerName: 'a',
      managerPhone: '09123456789',
      password: '12',
    })
    expect(result.success).toBe(false)
  })

  it('rejects non-Latin password characters', () => {
    const result = signupSchema.safeParse({
      salonName: 'a',
      slug: 'rose-salon',
      managerName: 'a',
      managerPhone: '09123456789',
      password: 'secret۱۲۳',
    })
    expect(result.success).toBe(false)
    if (!result.success) {
      expect(result.error.issues[0]?.message).toBe(
        formMessages.passwordLatinOnly,
      )
    }
  })

  it('rejects invalid slug', () => {
    const result = signupSchema.safeParse({
      salonName: 'a',
      slug: 'Invalid Slug!',
      managerName: 'a',
      managerPhone: '09123456789',
      password: 'secret123',
    })
    expect(result.success).toBe(false)
  })
})

describe('preWorkspaceAccountSchema', () => {
  it('accepts manager-name-only completion for accounts with an existing password', () => {
    const result = preWorkspaceAccountSchema.safeParse({
      managerName: 'علی',
    })
    expect(result.success).toBe(true)
  })

  it('rejects a provided short password', () => {
    const result = preWorkspaceAccountSchema.safeParse({
      managerName: 'علی',
      password: '12',
    })
    expect(result.success).toBe(false)
  })

  it('rejects non-Latin password characters when a password is provided', () => {
    const result = preWorkspaceAccountSchema.safeParse({
      managerName: 'علی',
      password: 'secret۱۲۳',
    })
    expect(result.success).toBe(false)
    if (!result.success) {
      expect(result.error.issues[0]?.message).toBe(
        formMessages.passwordLatinOnly,
      )
    }
  })
})

describe('resetPasswordSchema', () => {
  it('rejects non-Latin new passwords', () => {
    const result = resetPasswordSchema.safeParse({
      token: 'token',
      newPassword: 'secret۱۲۳',
    })
    expect(result.success).toBe(false)
    if (!result.success) {
      expect(result.error.issues[0]?.message).toBe(
        formMessages.passwordLatinOnly,
      )
    }
  })
})
