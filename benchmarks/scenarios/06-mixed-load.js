import http from 'k6/http'
import { check, group } from 'k6'
import {
  loginAndGetCookie,
  authHeaders,
  BASE_URL,
  API_PREFIX,
} from '../lib/auth.js'
import { buildSummary } from '../lib/report.js'

export const options = {
  scenarios: {
    mixed: {
      executor: 'ramping-vus',
      startVUs: 0,
      stages: [
        { duration: '15s', target: 5 },
        { duration: '30s', target: 20 },
        { duration: '30s', target: 20 },
        { duration: '15s', target: 0 },
      ],
    },
  },
  setupTimeout: '120s',
  thresholds: {
    http_req_failed: ['rate<0.02'],
    http_req_duration: ['p(95)<1500', 'p(99)<3000'],
  },
}

export function setup() {
  return { cookie: loginAndGetCookie() }
}

const _today = new Date()
const startDate = _today.toISOString().slice(0, 10)
const endDate = new Date(_today.getTime() + 7 * 86400_000)
  .toISOString()
  .slice(0, 10)

export default function (data) {
  const headers = authHeaders(data.cookie)
  group('reads', () => {
    const requests = {
      services: {
        method: 'GET',
        url: `${BASE_URL}${API_PREFIX}/services`,
        params: { headers, tags: { name: 'GET /api/services' } },
      },
      appointments: {
        method: 'GET',
        url: `${BASE_URL}${API_PREFIX}/appointments?startDate=${startDate}&endDate=${endDate}`,
        params: { headers, tags: { name: 'GET /api/appointments' } },
      },
      today: {
        method: 'GET',
        url: `${BASE_URL}${API_PREFIX}/today`,
        params: { headers, tags: { name: 'GET /api/today' } },
      },
      dashboard: {
        method: 'GET',
        url: `${BASE_URL}${API_PREFIX}/dashboard`,
        params: { headers, tags: { name: 'GET /api/dashboard' } },
      },
      me: {
        method: 'GET',
        url: `${BASE_URL}${API_PREFIX}/auth/me`,
        params: { headers, tags: { name: 'GET /api/auth/me' } },
      },
      staff: {
        method: 'GET',
        url: `${BASE_URL}${API_PREFIX}/staff`,
        params: { headers, tags: { name: 'GET /api/staff' } },
      },
      clients: {
        method: 'GET',
        url: `${BASE_URL}${API_PREFIX}/clients`,
        params: { headers, tags: { name: 'GET /api/clients' } },
      },
    }
    const responses = http.batch(Object.values(requests))
    responses.forEach((r) =>
      check(r, { '2xx': (r) => r.status >= 200 && r.status < 300 }),
    )
  })
}

export function handleSummary(data) {
  return buildSummary('06-mixed-load', data)
}
