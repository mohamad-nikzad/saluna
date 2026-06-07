import { OpenAPIHono, type RouteHandler } from '@hono/zod-openapi'
import {
  createClientFollowUpRoute,
  createClientRoute,
  getClientRoute,
  getClientSummaryRoute,
  listClientsRoute,
  updateClientRoute,
} from './routes/clients'
import {
  createStaffRoute,
  deleteStaffRoute,
  getStaffBookingAvailabilityRoute,
  getStaffScheduleRoute,
  listStaffRoute,
  updateStaffPasswordRoute,
  updateStaffRoute,
  updateStaffScheduleRoute,
  updateStaffServicesRoute,
} from './routes/staff'

const stubClient = {
  id: 'stub',
  name: 'stub',
  phone: null,
  isPlaceholder: false,
  createdAt: new Date().toISOString(),
}

const stubFollowUp = {
  id: 'stub',
  salonId: 'stub',
  clientId: 'stub',
  reason: 'manual' as const,
  status: 'open' as const,
  dueDate: '2026-01-01',
  createdAt: new Date().toISOString(),
  updatedAt: new Date().toISOString(),
  reviewedAt: null,
}

const stubSummary = {
  client: stubClient,
  tags: [],
  upcomingAppointment: null,
  history: [],
  stats: {
    completedCount: 0,
    cancelledCount: 0,
    noShowCount: 0,
    estimatedSpend: 0,
    lastVisitDate: null,
    favoriteServiceName: null,
    lastStaffName: null,
    totalCompletedVisits: 0,
  },
  openFollowUps: [],
}

const listClientsStub: RouteHandler<typeof listClientsRoute> = (c) => c.json({ clients: [] }, 200)

const createClientStub: RouteHandler<typeof createClientRoute> = (c) =>
  c.json({ client: stubClient }, 200)

const getClientStub: RouteHandler<typeof getClientRoute> = (c) => c.json({ client: stubClient }, 200)

const updateClientStub: RouteHandler<typeof updateClientRoute> = (c) =>
  c.json({ client: stubClient }, 200)

const getClientSummaryStub: RouteHandler<typeof getClientSummaryRoute> = (c) =>
  c.json(stubSummary, 200)

const createClientFollowUpStub: RouteHandler<typeof createClientFollowUpRoute> = (c) =>
  c.json({ followUp: stubFollowUp }, 200)

const stubStaffUser = {
  id: 'stub',
  salonId: 'stub',
  name: 'stub',
  fullName: 'stub',
  nickname: null,
  role: 'staff' as const,
  color: 'plum',
  phone: '09120000000',
  createdAt: new Date().toISOString(),
  serviceIds: null,
}

const stubBusinessHours = {
  workingStart: '09:00',
  workingEnd: '19:00',
  slotDurationMinutes: 30,
  workingDays: 127,
}

const listStaffStub: RouteHandler<typeof listStaffRoute> = (c) =>
  c.json({ staff: [] }, 200)

const createStaffStub: RouteHandler<typeof createStaffRoute> = (c) =>
  c.json({ user: stubStaffUser }, 200)

const updateStaffStub: RouteHandler<typeof updateStaffRoute> = (c) =>
  c.json({ staff: stubStaffUser }, 200)

const updateStaffPasswordStub: RouteHandler<typeof updateStaffPasswordRoute> = (c) =>
  c.json({ success: true as const }, 200)

const deleteStaffStub: RouteHandler<typeof deleteStaffRoute> = (c) =>
  c.json({ success: true as const }, 200)

const getStaffBookingAvailabilityStub: RouteHandler<
  typeof getStaffBookingAvailabilityRoute
> = (c) => c.json({ staff: [] }, 200)

const getStaffScheduleStub: RouteHandler<typeof getStaffScheduleRoute> = (c) =>
  c.json({ schedule: [], businessHours: stubBusinessHours }, 200)

const updateStaffScheduleStub: RouteHandler<typeof updateStaffScheduleRoute> = (c) =>
  c.json({ schedule: [] }, 200)

const updateStaffServicesStub: RouteHandler<typeof updateStaffServicesRoute> = (c) =>
  c.json({ staff: stubStaffUser }, 200)

/**
 * Minimal OpenAPI app used only for contract generation.
 * Stub handlers avoid loading auth/database modules at generate time.
 */
export const contractApp = new OpenAPIHono()
  .route(
    '/api/v1/clients',
    new OpenAPIHono()
      .openapi(listClientsRoute, listClientsStub)
      .openapi(createClientRoute, createClientStub)
      .openapi(getClientRoute, getClientStub)
      .openapi(updateClientRoute, updateClientStub)
      .openapi(getClientSummaryRoute, getClientSummaryStub)
      .openapi(createClientFollowUpRoute, createClientFollowUpStub),
  )
  .route(
    '/api/v1/staff',
    new OpenAPIHono()
      .openapi(listStaffRoute, listStaffStub)
      .openapi(createStaffRoute, createStaffStub)
      .openapi(getStaffBookingAvailabilityRoute, getStaffBookingAvailabilityStub)
      .openapi(updateStaffRoute, updateStaffStub)
      .openapi(updateStaffPasswordRoute, updateStaffPasswordStub)
      .openapi(deleteStaffRoute, deleteStaffStub)
      .openapi(getStaffScheduleRoute, getStaffScheduleStub)
      .openapi(updateStaffScheduleRoute, updateStaffScheduleStub)
      .openapi(updateStaffServicesRoute, updateStaffServicesStub),
  )

export const openApiDocumentConfig = {
  openapi: '3.0.0' as const,
  info: {
    title: 'Saluna API',
    version: '0.7.0',
    description:
      'Tenant-facing Saluna API. Generated from Hono OpenAPI route definitions. ' +
      'This contract is expanded incrementally; clients and staff route groups are documented.',
  },
  servers: [{ url: '', description: 'Saluna API (paths include /api/v1 prefix)' }],
  tags: [
    { name: 'Clients', description: 'Salon client CRUD and follow-ups' },
    { name: 'Staff', description: 'Staff roster, schedules, and service assignments' },
  ],
  components: {
    securitySchemes: {
      bearerAuth: {
        type: 'http' as const,
        scheme: 'bearer',
        description: 'Better Auth session token via Authorization header',
      },
      sessionCookie: {
        type: 'apiKey' as const,
        in: 'cookie' as const,
        name: 'better-auth.session_token',
        description: 'Better Auth session cookie (PWA uses credentials: include)',
      },
    },
  },
}
