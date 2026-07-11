import bcrypt from 'bcryptjs'
import { eq } from 'drizzle-orm'
import { getDb } from '@repo/database/client'
import { businessSettings, salons, users } from '@repo/database/schema'
import { normalizePhone } from '@repo/salon-core/phone'
import { normalizeCalendarColorId } from '@repo/salon-core/calendar-colors'
import type { User } from '@repo/salon-core/types'
import { STAFF_COLORS } from '@repo/salon-core/types'

const SLUG_PATTERN = /^[a-z0-9]+(?:-[a-z0-9]+)*$/

export type SignupInput = {
  salonName: string
  slug: string
  managerName: string
  managerPhone: string
  password: string
}

export type SignupResult = {
  salon: {
    id: string
    name: string
    slug: string
  }
  user: User
}

export class SignupValidationError extends Error {
  constructor(message: string) {
    super(message)
    this.name = 'SignupValidationError'
  }
}

export class SignupConflictError extends Error {
  constructor(message: string) {
    super(message)
    this.name = 'SignupConflictError'
  }
}

export function normalizeSignupSlug(input: string): string {
  return input
    .trim()
    .toLowerCase()
    .replace(/[_\s]+/g, '-')
    .replace(/[^a-z0-9-]/g, '')
    .replace(/-+/g, '-')
    .replace(/^-|-$/g, '')
}

export function normalizeSignupPhone(input: string): string {
  const normalized = normalizePhone(input)
  if (/^989\d{9}$/.test(normalized)) return `0${normalized.slice(2)}`
  if (/^9\d{9}$/.test(normalized)) return `0${normalized}`
  return normalized
}

function validatePassword(password: string): boolean {
  return password.length >= 8 && /\p{L}/u.test(password) && /\d/.test(password)
}

function rowToSignupUser(row: typeof users.$inferSelect): User {
  return {
    id: row.id,
    salonId: row.salonId,
    name: row.name,
    phone: row.phone,
    role: row.role,
    color: row.color,
    createdAt: row.createdAt,
  }
}

function uniqueConstraintName(error: unknown): string | undefined {
  if (!error || typeof error !== 'object') return undefined
  const maybe = error as {
    code?: unknown
    constraint_name?: unknown
    constraint?: unknown
  }
  if (maybe.code !== '23505') return undefined
  if (typeof maybe.constraint_name === 'string') return maybe.constraint_name
  if (typeof maybe.constraint === 'string') return maybe.constraint
  return ''
}

export function validateSignupInput(
  input: SignupInput,
): SignupInput & { normalizedPhone: string } {
  const salonName = input.salonName.trim()
  const managerName = input.managerName.trim()
  const slug = normalizeSignupSlug(input.slug)
  const normalizedPhone = normalizeSignupPhone(input.managerPhone)

  if (!salonName) {
    throw new SignupValidationError('نام سالن الزامی است')
  }
  if (!managerName) {
    throw new SignupValidationError('نام مدیر الزامی است')
  }
  if (!SLUG_PATTERN.test(slug) || slug.length < 3 || slug.length > 48) {
    throw new SignupValidationError(
      'آدرس سالن باید ۳ تا ۴۸ کاراکتر انگلیسی، عدد یا خط تیره باشد',
    )
  }
  if (!/^09\d{9}$/.test(normalizedPhone)) {
    throw new SignupValidationError('شماره موبایل مدیر معتبر نیست')
  }
  if (!validatePassword(input.password)) {
    throw new SignupValidationError(
      'رمز عبور باید حداقل ۸ کاراکتر و شامل حرف و عدد باشد',
    )
  }

  return {
    ...input,
    salonName,
    managerName,
    slug,
    managerPhone: normalizedPhone,
    normalizedPhone,
  }
}

export async function createSalonWorkspace(
  input: SignupInput,
): Promise<SignupResult> {
  const parsed = validateSignupInput(input)
  const db = getDb()

  const existingSalon = await db
    .select({ id: salons.id })
    .from(salons)
    .where(eq(salons.slug, parsed.slug))
    .limit(1)
  if (existingSalon[0]) {
    throw new SignupConflictError('این آدرس سالن قبلاً ثبت شده است')
  }

  const existingUser = await db
    .select({ id: users.id })
    .from(users)
    .where(eq(users.phone, parsed.normalizedPhone))
    .limit(1)
  if (existingUser[0]) {
    throw new SignupConflictError('این شماره موبایل قبلاً ثبت شده است')
  }

  const passwordHash = await bcrypt.hash(parsed.password, 10)

  try {
    return await db.transaction(async (tx) => {
      const [salon] = await tx
        .insert(salons)
        .values({
          name: parsed.salonName,
          slug: parsed.slug,
        })
        .returning({
          id: salons.id,
          name: salons.name,
          slug: salons.slug,
        })

      const [user] = await tx
        .insert(users)
        .values({
          salonId: salon.id,
          name: parsed.managerName,
          phone: parsed.normalizedPhone,
          passwordHash,
          role: 'manager',
          color: normalizeCalendarColorId(STAFF_COLORS[0]),
          active: true,
        })
        .returning()

      await tx.insert(businessSettings).values({
        salonId: salon.id,
        workingStart: '09:00',
        workingEnd: '19:00',
        slotDurationMinutes: 30,
      })

      return {
        salon,
        user: rowToSignupUser(user),
      }
    })
  } catch (error) {
    const constraint = uniqueConstraintName(error)
    if (constraint?.includes('salons_slug')) {
      throw new SignupConflictError('این آدرس سالن قبلاً ثبت شده است')
    }
    if (constraint?.includes('users_phone')) {
      throw new SignupConflictError('این شماره موبایل قبلاً ثبت شده است')
    }
    throw error
  }
}
