import { OpenAPIHono, type RouteHandler } from '@hono/zod-openapi'
import {
  createClientFollowUpRoute,
  createClientRoute,
  getClientRoute,
  getClientSummaryRoute,
  listClientsRoute,
  updateClientRoute,
} from './routes/clients'

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

export const openApiDocumentConfig = {
  openapi: '3.0.0' as const,
  info: {
    title: 'Saluna API',
    version: '0.7.0',
    description:
      'Tenant-facing Saluna API. Generated from Hono OpenAPI route definitions. ' +
      'This contract is expanded incrementally; the clients route group is the first pass.',
  },
  servers: [{ url: '', description: 'Saluna API (paths include /api/v1 prefix)' }],
  tags: [{ name: 'Clients', description: 'Salon client CRUD and follow-ups' }],
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
