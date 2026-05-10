import { cookies } from 'next/headers'
import { SignJWT, jwtVerify } from 'jose'
import bcrypt from 'bcryptjs'
import type { User } from '@repo/salon-core/types'
import { getUserById, getUserWithPasswordByPhone } from '@repo/database/auth-users'
import { getAuthKeys } from './keys'

const DEV_JWT_SECRET = 'development-only-jwt-secret-do-not-use-in-production'

function getJwtSecret(): Uint8Array {
  const { JWT_SECRET, NODE_ENV } = getAuthKeys()
  const secret = JWT_SECRET?.trim()

  if (secret) {
    if (NODE_ENV === 'production' && secret.length < 32) {
      throw new Error('JWT_SECRET must be at least 32 characters in production.')
    }
    return new TextEncoder().encode(secret)
  }

  if (NODE_ENV === 'production') {
    throw new Error('JWT_SECRET is required in production.')
  }

  return new TextEncoder().encode(DEV_JWT_SECRET)
}

export async function createSession(userId: string): Promise<string> {
  const token = await new SignJWT({ userId })
    .setProtectedHeader({ alg: 'HS256' })
    .setExpirationTime('7d')
    .sign(getJwtSecret())

  return token
}

export async function verifySession(token: string): Promise<string | null> {
  try {
    const { payload } = await jwtVerify(token, getJwtSecret())
    return payload.userId as string
  } catch {
    return null
  }
}

export async function getCurrentUser(): Promise<User | null> {
  const cookieStore = await cookies()
  const token = cookieStore.get('session')?.value

  if (!token) return null

  return getUserFromToken(token)
}

export async function getUserFromToken(token: string): Promise<User | null> {
  const userId = await verifySession(token)
  if (!userId) return null

  const user = await getUserById(userId)
  return user || null
}

function extractBearerToken(request: Request): string | null {
  const header = request.headers.get('authorization') ?? request.headers.get('Authorization')
  if (!header) return null
  const match = header.match(/^Bearer\s+(.+)$/i)
  return match ? match[1].trim() : null
}

export async function getCurrentUserFromRequest(request: Request): Promise<User | null> {
  const bearer = extractBearerToken(request)
  if (bearer) {
    const fromBearer = await getUserFromToken(bearer)
    if (fromBearer) return fromBearer
  }
  return getCurrentUser()
}

export async function login(
  phone: string,
  password: string
): Promise<{ user: User; token: string } | null> {
  const row = await getUserWithPasswordByPhone(phone)
  if (!row) return null

  const valid = bcrypt.compareSync(password, row.passwordHash)
  if (!valid) return null

  const token = await createSession(row.id)

  const { passwordHash: _hash, ...user } = row
  return { user, token }
}

export async function logout() {
  const cookieStore = await cookies()
  cookieStore.delete('session')
}
