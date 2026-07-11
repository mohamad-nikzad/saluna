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
    dashboard: {
      executor: 'constant-vus',
      vus: 10,
      duration: '30s',
    },
  },
  setupTimeout: '120s',
  thresholds: {
    http_req_failed: ['rate<0.01'],
    http_req_duration: ['p(95)<1500', 'p(99)<3000'],
  },
}

export function setup() {
  return { cookie: loginAndGetCookie() }
}

export default function (data) {
  const headers = authHeaders(data.cookie)
  const r = http.get(`${BASE_URL}${API_PREFIX}/dashboard`, {
    headers,
    tags: { name: 'GET /api/dashboard' },
  })
  check(r, { 200: (r) => r.status === 200 })
}

export function handleSummary(data) {
  return buildSummary('03-dashboard', data)
}
