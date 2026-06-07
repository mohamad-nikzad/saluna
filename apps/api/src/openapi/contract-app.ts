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
  applyCatalogPresetRoute,
  listCatalogPresetsRoute,
} from './routes/catalog-presets'
import {
  createServiceCategoryRoute,
  listServiceCategoriesRoute,
  updateServiceCategoryRoute,
} from './routes/service-categories'
import {
  createServiceFamilyRoute,
  listServiceFamiliesRoute,
  updateServiceFamilyRoute,
} from './routes/service-families'
import {
  createServiceAddonRoute,
  listServiceAddonsRoute,
  updateServiceAddonRoute,
} from './routes/service-addons'
import {
  createServiceRoute,
  getComboComponentsRoute,
  getServiceAddonsRoute,
  getServiceRoute,
  importStarterTemplatesRoute,
  listServicesRoute,
  updateComboComponentsRoute,
  updateServiceRoute,
} from './routes/services'
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

const stubService = {
  id: 'stub',
  name: 'stub',
  category: 'hair' as const,
  categoryId: 'stub',
  familyId: null,
  duration: 45,
  price: 0,
  color: 'plum',
  active: true,
}

const stubServiceCategory = {
  id: 'stub',
  name: 'stub',
  active: true,
  createdAt: new Date().toISOString(),
  updatedAt: new Date().toISOString(),
}

const stubServiceFamily = {
  id: 'stub',
  categoryId: 'stub',
  name: 'stub',
  active: true,
  createdAt: new Date().toISOString(),
  updatedAt: new Date().toISOString(),
}

const stubServiceAddon = {
  id: 'stub',
  salonId: 'stub',
  name: 'stub',
  priceDelta: 0,
  durationDelta: 0,
  active: true,
  sortOrder: 0,
  scopes: [],
  createdAt: new Date().toISOString(),
  updatedAt: new Date().toISOString(),
}

const stubComboComponents = {
  comboServiceId: 'stub',
  components: [],
  totalDuration: 0,
  totalPrice: 0,
}

const stubCatalogPreset = {
  id: 'stub',
  slug: 'stub',
  name: 'stub',
  description: null,
  tree: [
    {
      name: 'stub',
      families: [
        {
          name: 'stub',
          variants: [
            {
              name: 'stub',
              duration: 45,
              price: 0,
              color: 'plum',
            },
          ],
        },
      ],
    },
  ],
  sortOrder: 0,
  disabled: false,
  disabledReason: null,
}

const listServicesStub: RouteHandler<typeof listServicesRoute> = (c) =>
  c.json({ services: [] }, 200)

const createServiceStub: RouteHandler<typeof createServiceRoute> = (c) =>
  c.json({ service: stubService }, 200)

const importStarterTemplatesStub: RouteHandler<
  typeof importStarterTemplatesRoute
> = (c) =>
  c.json({ categories: [], families: [], services: [] }, 200)

const getServiceStub: RouteHandler<typeof getServiceRoute> = (c) =>
  c.json({ service: stubService }, 200)

const updateServiceStub: RouteHandler<typeof updateServiceRoute> = (c) =>
  c.json({ service: stubService }, 200)

const getServiceAddonsStub: RouteHandler<typeof getServiceAddonsRoute> = (c) =>
  c.json({ addons: [] }, 200)

const getComboComponentsStub: RouteHandler<typeof getComboComponentsRoute> = (c) =>
  c.json({ combo: stubComboComponents }, 200)

const updateComboComponentsStub: RouteHandler<
  typeof updateComboComponentsRoute
> = (c) => c.json({ combo: stubComboComponents }, 200)

const listServiceCategoriesStub: RouteHandler<
  typeof listServiceCategoriesRoute
> = (c) => c.json({ categories: [] }, 200)

const createServiceCategoryStub: RouteHandler<
  typeof createServiceCategoryRoute
> = (c) => c.json({ category: stubServiceCategory }, 200)

const updateServiceCategoryStub: RouteHandler<
  typeof updateServiceCategoryRoute
> = (c) => c.json({ category: stubServiceCategory }, 200)

const listServiceFamiliesStub: RouteHandler<typeof listServiceFamiliesRoute> = (c) =>
  c.json({ families: [] }, 200)

const createServiceFamilyStub: RouteHandler<typeof createServiceFamilyRoute> = (c) =>
  c.json({ family: stubServiceFamily }, 200)

const updateServiceFamilyStub: RouteHandler<typeof updateServiceFamilyRoute> = (c) =>
  c.json({ family: stubServiceFamily }, 200)

const listServiceAddonsStub: RouteHandler<typeof listServiceAddonsRoute> = (c) =>
  c.json({ addons: [] }, 200)

const createServiceAddonStub: RouteHandler<typeof createServiceAddonRoute> = (c) =>
  c.json({ addon: stubServiceAddon }, 200)

const updateServiceAddonStub: RouteHandler<typeof updateServiceAddonRoute> = (c) =>
  c.json({ addon: stubServiceAddon }, 200)

const listCatalogPresetsStub: RouteHandler<typeof listCatalogPresetsRoute> = (c) =>
  c.json({ presets: [stubCatalogPreset] }, 200)

const applyCatalogPresetStub: RouteHandler<typeof applyCatalogPresetRoute> = (c) =>
  c.json({ importedCategoryIds: [], importedVariantIds: [] }, 200)

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
  .route(
    '/api/v1/services',
    new OpenAPIHono()
      .openapi(listServicesRoute, listServicesStub)
      .openapi(createServiceRoute, createServiceStub)
      .openapi(importStarterTemplatesRoute, importStarterTemplatesStub)
      .openapi(getServiceRoute, getServiceStub)
      .openapi(updateServiceRoute, updateServiceStub)
      .openapi(getServiceAddonsRoute, getServiceAddonsStub)
      .openapi(getComboComponentsRoute, getComboComponentsStub)
      .openapi(updateComboComponentsRoute, updateComboComponentsStub),
  )
  .route(
    '/api/v1/service-categories',
    new OpenAPIHono()
      .openapi(listServiceCategoriesRoute, listServiceCategoriesStub)
      .openapi(createServiceCategoryRoute, createServiceCategoryStub)
      .openapi(updateServiceCategoryRoute, updateServiceCategoryStub),
  )
  .route(
    '/api/v1/service-families',
    new OpenAPIHono()
      .openapi(listServiceFamiliesRoute, listServiceFamiliesStub)
      .openapi(createServiceFamilyRoute, createServiceFamilyStub)
      .openapi(updateServiceFamilyRoute, updateServiceFamilyStub),
  )
  .route(
    '/api/v1/service-addons',
    new OpenAPIHono()
      .openapi(listServiceAddonsRoute, listServiceAddonsStub)
      .openapi(createServiceAddonRoute, createServiceAddonStub)
      .openapi(updateServiceAddonRoute, updateServiceAddonStub),
  )
  .route(
    '/api/v1/catalog-presets',
    new OpenAPIHono()
      .openapi(listCatalogPresetsRoute, listCatalogPresetsStub)
      .openapi(applyCatalogPresetRoute, applyCatalogPresetStub),
  )

export const openApiDocumentConfig = {
  openapi: '3.0.0' as const,
  info: {
    title: 'Saluna API',
    version: '0.7.0',
    description:
      'Tenant-facing Saluna API. Generated from Hono OpenAPI route definitions. ' +
      'This contract is expanded incrementally; clients, staff, and services catalog route groups are documented.',
  },
  servers: [{ url: '', description: 'Saluna API (paths include /api/v1 prefix)' }],
  tags: [
    { name: 'Clients', description: 'Salon client CRUD and follow-ups' },
    { name: 'Staff', description: 'Staff roster, schedules, and service assignments' },
    { name: 'Services', description: 'Salon services, combo packages, and starter imports' },
    {
      name: 'Service categories',
      description: 'Top-level service catalog sections',
    },
    { name: 'Service families', description: 'Grouped services within a category' },
    { name: 'Service addons', description: 'Optional booking add-ons' },
    { name: 'Catalog presets', description: 'Starter catalog templates' },
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
