import http from 'k6/http'
import { check } from 'k6'
import {
  loginAndGetCookie,
  authHeaders,
  BASE_URL,
  API_PREFIX,
} from '../lib/auth.js'
import { buildSummary } from '../lib/report.js'

export const options = {
  scenarios: {
    auth_me: {
      executor: 'constant-vus',
      vus: 20,
      duration: '30s',
    },
  },
  setupTimeout: '120s',
  thresholds: {
    http_req_failed: ['rate<0.01'],
    http_req_duration: ['p(95)<500', 'p(99)<1500'],
  },
}

export function setup() {
  return { cookie: loginAndGetCookie() }
}

export default function (data) {
  const headers = authHeaders(data.cookie)
  const r = http.get(`${BASE_URL}${API_PREFIX}/auth/me`, {
    headers,
    tags: { name: 'GET /api/auth/me' },
  })
  check(r, { 200: (r) => r.status === 200 })
}

export function handleSummary(data) {
  return buildSummary('05-auth-me', data)
}
