import http from 'k6/http'
import { check, fail } from 'k6'

const BASE_URL = __ENV.BASE_URL || 'http://localhost:3000'
const API_PREFIX = __ENV.API_PREFIX || '/api'
const PHONE = __ENV.BENCH_PHONE || '09120000000'
const PASSWORD = __ENV.BENCH_PASSWORD || 'admin123'

export function loginAndGetCookie() {
  const res = http.post(
    `${BASE_URL}${API_PREFIX}/auth/login`,
    JSON.stringify({ phone: PHONE, password: PASSWORD }),
    {
      headers: { 'Content-Type': 'application/json' },
      tags: { name: 'login' },
    },
  )
  const ok = check(res, { 'login 200': (r) => r.status === 200 })
  if (!ok) fail(`Login failed: ${res.status} ${res.body}`)
  const setCookie = res.headers['Set-Cookie'] || ''
  const match = setCookie.match(/session=([^;]+)/)
  if (!match) fail('No session cookie returned')
  return match[1]
}

export function authHeaders(sessionCookie) {
  return {
    Cookie: `session=${sessionCookie}`,
    'Content-Type': 'application/json',
  }
}

export { BASE_URL, API_PREFIX }
