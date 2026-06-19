import { OpenAPIHono, type RouteHandler } from '@hono/zod-openapi'
import {
  bulkCreateClientsRoute,
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
  completePlaceholderClientRoute,
  createAppointmentRoute,
  deleteAppointmentRoute,
  getAppointmentAvailabilityRoute,
  getAppointmentRoute,
  listAppointmentsRoute,
  updateAppointmentRoute,
} from './routes/appointments'
import {
  approveAppointmentRequestRoute,
  listAppointmentRequestsRoute,
  rejectAppointmentRequestRoute,
} from './routes/appointment-requests'
import {
  getBusinessSettingsRoute,
  updateBusinessSettingsRoute,
} from './routes/settings'
import {
  getSalonPresenceRoute,
  updateSalonPresenceRoute,
} from './routes/salon-profile'
import {
  getSalonPublicSettingsRoute,
  updateSalonPublicSettingsRoute,
  updateSalonSlugRoute,
} from './routes/salon-public-settings'
import { getOnboardingRoute, updateOnboardingRoute } from './routes/onboarding'
import { getDashboardRoute } from './routes/dashboard'
import { getTodayRoute } from './routes/today'
import {
  listRetentionRoute,
  sendRetentionBaleMessageRoute,
  updateRetentionRoute,
} from './routes/retention'
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
import {
  createMessagingLinkRoute,
  deleteMessagingAccountRoute,
  listMessagingAccountsRoute,
  patchMessagingAccountRoute,
} from './routes/messaging'
import {
  createNotificationTestRoute,
  listNotificationsRoute,
  markAllNotificationsReadRoute,
  markNotificationReadRoute,
} from './routes/notifications'
import {
  getNotificationPreferencesRoute,
  updateNotificationPreferencesRoute,
} from './routes/notification-preferences'
import {
  cancelPublicAppointmentRequestRoute,
  createPublicAppointmentRequestRoute,
  getPublicAppointmentRequestRoute,
  getPublicAvailabilityRoute,
  getPublicSalonRoute,
} from './routes/public'
import {
  createAdminCatalogPresetRoute,
  createAdminSalonNoteRoute,
  createAdminUserNoteRoute,
  createPlatformAdminRoute,
  getAdminMeRoute,
  getAdminMessagingHealthRoute,
  getAdminOverviewRoute,
  getAdminRuntimeRoute,
  getAdminSalonRoute,
  getAdminUserRoute,
  listAdminAuditLogRoute,
  listAdminCatalogPresetsRoute,
  listAdminNotificationDeliveriesRoute,
  listAdminSalonAppointmentRequestsRoute,
  listAdminSalonAppointmentsRoute,
  listAdminSalonClientsRoute,
  listAdminSalonNotesRoute,
  listAdminSalonServicesRoute,
  listAdminSalonStaffRoute,
  listAdminSalonsRoute,
  listAdminSupportAppointmentRequestsRoute,
  listAdminSupportAppointmentsRoute,
  listAdminUserNotesRoute,
  listAdminUsersRoute,
  listPlatformAdminsRoute,
  updateAdminCatalogPresetRoute,
  updateAdminSalonStatusRoute,
  updatePlatformAdminRoute,
} from './routes/admin'

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

const listClientsStub: RouteHandler<typeof listClientsRoute> = (c) =>
  c.json({ clients: [] }, 200)

const createClientStub: RouteHandler<typeof createClientRoute> = (c) =>
  c.json({ client: stubClient }, 200)

const bulkCreateClientsStub: RouteHandler<typeof bulkCreateClientsRoute> = (
  c,
) => c.json({ created: [stubClient], skipped: [] }, 200)

const getClientStub: RouteHandler<typeof getClientRoute> = (c) =>
  c.json({ client: stubClient }, 200)

const updateClientStub: RouteHandler<typeof updateClientRoute> = (c) =>
  c.json({ client: stubClient }, 200)

const getClientSummaryStub: RouteHandler<typeof getClientSummaryRoute> = (c) =>
  c.json(stubSummary, 200)

const createClientFollowUpStub: RouteHandler<
  typeof createClientFollowUpRoute
> = (c) => c.json({ followUp: stubFollowUp }, 200)

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

const updateStaffPasswordStub: RouteHandler<typeof updateStaffPasswordRoute> = (
  c,
) => c.json({ success: true as const }, 200)

const deleteStaffStub: RouteHandler<typeof deleteStaffRoute> = (c) =>
  c.json({ success: true as const }, 200)

const getStaffBookingAvailabilityStub: RouteHandler<
  typeof getStaffBookingAvailabilityRoute
> = (c) => c.json({ staff: [] }, 200)

const getStaffScheduleStub: RouteHandler<typeof getStaffScheduleRoute> = (c) =>
  c.json({ schedule: [], businessHours: stubBusinessHours }, 200)

const updateStaffScheduleStub: RouteHandler<typeof updateStaffScheduleRoute> = (
  c,
) => c.json({ schedule: [] }, 200)

const updateStaffServicesStub: RouteHandler<typeof updateStaffServicesRoute> = (
  c,
) => c.json({ staff: stubStaffUser }, 200)

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
> = (c) => c.json({ categories: [], families: [], services: [] }, 200)

const getServiceStub: RouteHandler<typeof getServiceRoute> = (c) =>
  c.json({ service: stubService }, 200)

const updateServiceStub: RouteHandler<typeof updateServiceRoute> = (c) =>
  c.json({ service: stubService }, 200)

const getServiceAddonsStub: RouteHandler<typeof getServiceAddonsRoute> = (c) =>
  c.json({ addons: [] }, 200)

const getComboComponentsStub: RouteHandler<typeof getComboComponentsRoute> = (
  c,
) => c.json({ combo: stubComboComponents }, 200)

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

const listServiceFamiliesStub: RouteHandler<typeof listServiceFamiliesRoute> = (
  c,
) => c.json({ families: [] }, 200)

const createServiceFamilyStub: RouteHandler<typeof createServiceFamilyRoute> = (
  c,
) => c.json({ family: stubServiceFamily }, 200)

const updateServiceFamilyStub: RouteHandler<typeof updateServiceFamilyRoute> = (
  c,
) => c.json({ family: stubServiceFamily }, 200)

const listServiceAddonsStub: RouteHandler<typeof listServiceAddonsRoute> = (
  c,
) => c.json({ addons: [] }, 200)

const createServiceAddonStub: RouteHandler<typeof createServiceAddonRoute> = (
  c,
) => c.json({ addon: stubServiceAddon }, 200)

const updateServiceAddonStub: RouteHandler<typeof updateServiceAddonRoute> = (
  c,
) => c.json({ addon: stubServiceAddon }, 200)

const listCatalogPresetsStub: RouteHandler<typeof listCatalogPresetsRoute> = (
  c,
) => c.json({ presets: [stubCatalogPreset] }, 200)

const applyCatalogPresetStub: RouteHandler<typeof applyCatalogPresetRoute> = (
  c,
) => c.json({ importedCategoryIds: [], importedVariantIds: [] }, 200)

const adminListStub = {
  items: [],
  pagination: { page: 1, pageSize: 25, total: 0 },
}

const stubPlatformAdmin = {
  id: 'stub',
  userId: '00000000-0000-0000-0000-000000000000',
  role: 'platform_owner' as const,
  active: true,
  createdAt: new Date().toISOString(),
  updatedAt: new Date().toISOString(),
}

const getAdminMeStub: RouteHandler<typeof getAdminMeRoute> = (c) =>
  c.json(
    {
      user: {
        userId: '00000000-0000-0000-0000-000000000000',
        name: 'stub',
        email: 'stub@example.com',
        phoneNumber: null,
        username: null,
        role: 'platform_owner',
        active: true,
      },
      runtime: { dataSource: 'local' },
    },
    200,
  )

const getAdminRuntimeStub: RouteHandler<typeof getAdminRuntimeRoute> = (c) =>
  c.json({ dataSource: 'local' }, 200)

const getAdminOverviewStub: RouteHandler<typeof getAdminOverviewRoute> = (c) =>
  c.json(
    {
      salonsByStatus: { active: 0, suspended: 0, archived: 0 },
      failedDeliveries: 0,
      messagingAccounts: [],
      recentAuditEvents: [],
    },
    200,
  )

const listAdminSalonsStub: RouteHandler<typeof listAdminSalonsRoute> = (c) =>
  c.json(adminListStub, 200)

const getAdminSalonStub: RouteHandler<typeof getAdminSalonRoute> = (c) =>
  c.json({ salon: {}, members: [], stats: {} }, 200)

const listAdminSalonClientsStub: RouteHandler<
  typeof listAdminSalonClientsRoute
> = (c) => c.json(adminListStub, 200)

const listAdminSalonAppointmentsStub: RouteHandler<
  typeof listAdminSalonAppointmentsRoute
> = (c) => c.json(adminListStub, 200)

const listAdminSalonAppointmentRequestsStub: RouteHandler<
  typeof listAdminSalonAppointmentRequestsRoute
> = (c) => c.json(adminListStub, 200)

const listAdminSalonStaffStub: RouteHandler<typeof listAdminSalonStaffRoute> = (
  c,
) => c.json(adminListStub, 200)

const listAdminSalonServicesStub: RouteHandler<
  typeof listAdminSalonServicesRoute
> = (c) => c.json(adminListStub, 200)

const updateAdminSalonStatusStub: RouteHandler<
  typeof updateAdminSalonStatusRoute
> = (c) => c.json({ salon: { salonId: 'stub', status: 'active' } }, 200)

const listAdminSalonNotesStub: RouteHandler<typeof listAdminSalonNotesRoute> = (
  c,
) => c.json({ notes: [] }, 200)

const createAdminSalonNoteStub: RouteHandler<
  typeof createAdminSalonNoteRoute
> = (c) => c.json({ note: {} }, 201)

const listAdminUsersStub: RouteHandler<typeof listAdminUsersRoute> = (c) =>
  c.json(adminListStub, 200)

const getAdminUserStub: RouteHandler<typeof getAdminUserRoute> = (c) =>
  c.json({ user: {}, memberships: [], messagingAccounts: [] }, 200)

const listAdminUserNotesStub: RouteHandler<typeof listAdminUserNotesRoute> = (
  c,
) => c.json({ notes: [] }, 200)

const createAdminUserNoteStub: RouteHandler<typeof createAdminUserNoteRoute> = (
  c,
) => c.json({ note: {} }, 201)

const listAdminCatalogPresetsStub: RouteHandler<
  typeof listAdminCatalogPresetsRoute
> = (c) => c.json(adminListStub, 200)

const createAdminCatalogPresetStub: RouteHandler<
  typeof createAdminCatalogPresetRoute
> = (c) => c.json({ preset: stubCatalogPreset }, 201)

const updateAdminCatalogPresetStub: RouteHandler<
  typeof updateAdminCatalogPresetRoute
> = (c) => c.json({ preset: stubCatalogPreset }, 200)

const getAdminMessagingHealthStub: RouteHandler<
  typeof getAdminMessagingHealthRoute
> = (c) =>
  c.json({ accounts: [], failedNotifications: [], failedFollowUps: [] }, 200)

const listAdminNotificationDeliveriesStub: RouteHandler<
  typeof listAdminNotificationDeliveriesRoute
> = (c) => c.json(adminListStub, 200)

const listAdminSupportAppointmentsStub: RouteHandler<
  typeof listAdminSupportAppointmentsRoute
> = (c) => c.json(adminListStub, 200)

const listAdminSupportAppointmentRequestsStub: RouteHandler<
  typeof listAdminSupportAppointmentRequestsRoute
> = (c) => c.json(adminListStub, 200)

const listAdminAuditLogStub: RouteHandler<typeof listAdminAuditLogRoute> = (
  c,
) => c.json(adminListStub, 200)

const listPlatformAdminsStub: RouteHandler<typeof listPlatformAdminsRoute> = (
  c,
) => c.json(adminListStub, 200)

const createPlatformAdminStub: RouteHandler<typeof createPlatformAdminRoute> = (
  c,
) => c.json({ admin: stubPlatformAdmin }, 201)

const updatePlatformAdminStub: RouteHandler<typeof updatePlatformAdminRoute> = (
  c,
) => c.json({ admin: stubPlatformAdmin }, 200)

const stubAppointment = {
  id: 'stub',
  clientId: 'stub',
  staffId: 'stub',
  serviceId: 'stub',
  bookedServiceName: 'stub',
  bookedServiceDuration: 45,
  bookedServicePrice: 0,
  bookedTotalDuration: 45,
  bookedTotalPrice: 0,
  bookedAddonCount: 0,
  date: '2026-06-07',
  startTime: '10:00',
  endTime: '10:45',
  status: 'scheduled' as const,
  createdAt: new Date().toISOString(),
  updatedAt: new Date().toISOString(),
  client: stubClient,
  staff: stubStaffUser,
  service: stubService,
}

const listAppointmentsStub: RouteHandler<typeof listAppointmentsRoute> = (c) =>
  c.json({ appointments: [] }, 200)

const createAppointmentStub: RouteHandler<typeof createAppointmentRoute> = (
  c,
) => c.json({ appointment: stubAppointment }, 200)

const getAppointmentAvailabilityStub: RouteHandler<
  typeof getAppointmentAvailabilityRoute
> = (c) => c.json({ mode: 'day' as const, slots: [] }, 200)

const getAppointmentStub: RouteHandler<typeof getAppointmentRoute> = (c) =>
  c.json({ appointment: stubAppointment }, 200)

const updateAppointmentStub: RouteHandler<typeof updateAppointmentRoute> = (
  c,
) => c.json({ appointment: stubAppointment }, 200)

const deleteAppointmentStub: RouteHandler<typeof deleteAppointmentRoute> = (
  c,
) => c.json({ success: true as const }, 200)

const completePlaceholderClientStub: RouteHandler<
  typeof completePlaceholderClientRoute
> = (c) =>
  c.json(
    {
      appointment: stubAppointment,
      outcome: 'created-client' as const,
    },
    200,
  )

const stubAppointmentRequest = {
  id: 'stub',
  salonId: 'stub',
  serviceId: 'stub',
  staffId: null,
  requestedDate: '2026-06-07',
  requestedStartTime: '10:00',
  requestedEndTime: '11:00',
  customerName: 'stub',
  customerPhone: '09120000000',
  notes: null,
  bookedServiceName: 'stub',
  bookedServiceDuration: 45,
  bookedServicePrice: 0,
  status: 'pending' as const,
  paymentStatus: 'none' as const,
  depositAmount: null,
  confirmationToken: 'stub',
  reviewedByUserId: null,
  reviewedAt: null,
  rejectionReason: null,
  appointmentId: null,
  createdAt: new Date().toISOString(),
  updatedAt: new Date().toISOString(),
  existingClient: null,
}

const listAppointmentRequestsStub: RouteHandler<
  typeof listAppointmentRequestsRoute
> = (c) => c.json({ requests: [] }, 200)

const approveAppointmentRequestStub: RouteHandler<
  typeof approveAppointmentRequestRoute
> = (c) =>
  c.json({ appointmentId: stubAppointment.id, clientId: stubClient.id }, 200)

const rejectAppointmentRequestStub: RouteHandler<
  typeof rejectAppointmentRequestRoute
> = (c) => c.json({ ok: true as const }, 200)

const stubSalonPresence = {
  address: null,
  mapGoogle: null,
  mapNeshan: null,
  mapBalad: null,
  socialInstagram: null,
  socialTelegram: null,
  socialWhatsapp: null,
  website: null,
}

const stubManagerPublicSettings = {
  slug: 'stub-salon',
  salonName: 'stub',
  settings: {
    enabled: false,
    bioText: null,
    themeId: 'rose',
    layoutId: 'agenda',
    appointmentRequestsEnabled: true,
  },
  services: [] as Array<{ service: typeof stubService; visible: boolean }>,
}

const getBusinessSettingsStub: RouteHandler<typeof getBusinessSettingsRoute> = (
  c,
) => c.json({ settings: stubBusinessHours }, 200)

const updateBusinessSettingsStub: RouteHandler<
  typeof updateBusinessSettingsRoute
> = (c) => c.json({ settings: stubBusinessHours }, 200)

const getSalonPresenceStub: RouteHandler<typeof getSalonPresenceRoute> = (c) =>
  c.json({ presence: stubSalonPresence }, 200)

const updateSalonPresenceStub: RouteHandler<typeof updateSalonPresenceRoute> = (
  c,
) => c.json({ presence: stubSalonPresence }, 200)

const getSalonPublicSettingsStub: RouteHandler<
  typeof getSalonPublicSettingsRoute
> = (c) => c.json(stubManagerPublicSettings, 200)

const updateSalonPublicSettingsStub: RouteHandler<
  typeof updateSalonPublicSettingsRoute
> = (c) => c.json(stubManagerPublicSettings, 200)

const updateSalonSlugStub: RouteHandler<typeof updateSalonSlugRoute> = (c) =>
  c.json(stubManagerPublicSettings, 200)

const stubOnboardingStatus = {
  salon: {
    id: 'stub',
    name: 'stub',
    slug: 'stub-salon',
    phone: null,
    address: null,
  },
  steps: {
    businessHoursSet: false,
    servicesAdded: false,
    staffAdded: false,
    presenceSet: false,
    publicPageConfigured: false,
    notificationsConfigured: false,
  },
  completedAt: null,
  skippedAt: null,
}

const getOnboardingStub: RouteHandler<typeof getOnboardingRoute> = (c) =>
  c.json({ onboarding: stubOnboardingStatus }, 200)

const updateOnboardingStub: RouteHandler<typeof updateOnboardingRoute> = (c) =>
  c.json({ onboarding: stubOnboardingStatus }, 200)

const stubDashboardData = {
  totalClients: 0,
  totalStaff: 0,
  todayAppointments: 0,
  weekAppointments: 0,
  monthAppointments: 0,
  todayStatusBreakdown: [] as Array<{
    status: 'scheduled' | 'confirmed' | 'completed' | 'cancelled' | 'no-show'
    count: number
  }>,
  monthStatusBreakdown: [] as Array<{
    status: 'scheduled' | 'confirmed' | 'completed' | 'cancelled' | 'no-show'
    count: number
  }>,
  popularServices: [] as Array<{ name: string; count: number }>,
  staffLoad: [] as Array<{ name: string; color: string; count: number }>,
  monthRevenue: 0,
  newClientsThisMonth: 0,
}

const getDashboardStub: RouteHandler<typeof getDashboardRoute> = (c) =>
  c.json(stubDashboardData, 200)

const stubTodayData = {
  date: '2026-06-07',
  counts: {
    scheduled: 0,
    confirmed: 0,
    completed: 0,
    cancelled: 0,
    'no-show': 0,
  },
  appointments: [],
  attentionItems: [],
  staffLoad: [],
  openSlots: [],
}

const getTodayStub: RouteHandler<typeof getTodayRoute> = (c) =>
  c.json(stubTodayData, 200)

const listRetentionStub: RouteHandler<typeof listRetentionRoute> = (c) =>
  c.json({ items: [] }, 200)

const updateRetentionStub: RouteHandler<typeof updateRetentionRoute> = (c) =>
  c.json({ followUp: stubFollowUp }, 200)

const sendRetentionBaleMessageStub: RouteHandler<
  typeof sendRetentionBaleMessageRoute
> = (c) =>
  c.json(
    {
      delivery: {
        id: 'stub',
        provider: 'bale_safir' as const,
        status: 'sent' as const,
        providerMessageId: null,
        error: null,
      },
      result: {
        status: 'sent' as const,
        providerMessageId: null,
        error: null,
        phone: null,
      },
    },
    200,
  )

const stubMessagingAccount = {
  id: 'stub',
  provider: 'telegram' as const,
  displayName: null,
  enabled: true,
  linkedAt: new Date().toISOString(),
}

const listMessagingAccountsStub: RouteHandler<
  typeof listMessagingAccountsRoute
> = (c) =>
  c.json(
    {
      providers: [{ id: 'telegram' as const, displayName: 'Telegram' }],
      accounts: [],
    },
    200,
  )

const createMessagingLinkStub: RouteHandler<typeof createMessagingLinkRoute> = (
  c,
) =>
  c.json(
    {
      deepLink: 'https://t.me/saluna_bot?start=stub',
      expiresAt: new Date().toISOString(),
    },
    201,
  )

const patchMessagingAccountStub: RouteHandler<
  typeof patchMessagingAccountRoute
> = (c) => c.json({ account: stubMessagingAccount }, 200)

const deleteMessagingAccountStub: RouteHandler<
  typeof deleteMessagingAccountRoute
> = (c) => c.json({ ok: true as const }, 200)

const stubAppNotification = {
  id: 'stub',
  salonId: 'stub',
  userId: 'stub',
  type: 'appointment_created' as const,
  title: 'stub',
  body: 'stub',
  route: '/notifications',
  data: {},
  readAt: null,
  createdAt: new Date().toISOString(),
}

const listNotificationsStub: RouteHandler<typeof listNotificationsRoute> = (
  c,
) => c.json({ notifications: [] }, 200)

const markAllNotificationsReadStub: RouteHandler<
  typeof markAllNotificationsReadRoute
> = (c) => c.json({ success: true as const, updatedCount: 0 }, 200)

const createNotificationTestStub: RouteHandler<
  typeof createNotificationTestRoute
> = (c) => c.json({ notification: stubAppNotification }, 200)

const markNotificationReadStub: RouteHandler<
  typeof markNotificationReadRoute
> = (c) => c.json({ notification: stubAppNotification }, 200)

const stubNotificationPreferences = {
  salonId: 'stub',
  userId: 'stub',
  appointmentAlertsEnabled: true,
  localAlertsEnabled: true,
  smsAlertsEnabled: false,
  createdAt: new Date().toISOString(),
  updatedAt: new Date().toISOString(),
}

const getNotificationPreferencesStub: RouteHandler<
  typeof getNotificationPreferencesRoute
> = (c) => c.json({ preferences: stubNotificationPreferences }, 200)

const updateNotificationPreferencesStub: RouteHandler<
  typeof updateNotificationPreferencesRoute
> = (c) => c.json({ preferences: stubNotificationPreferences }, 200)

const stubPublicSalonView = {
  salon: {
    id: 'stub',
    slug: 'stub-salon',
    name: 'stub',
    phone: null,
    timezone: 'Asia/Tehran',
    locale: 'fa-IR',
  },
  publicSettings: {
    enabled: true,
    bioText: null,
    themeId: 'rose',
    layoutId: 'agenda',
    appointmentRequestsEnabled: true,
  },
  presence: stubSalonPresence,
  services: [] as Array<typeof stubService>,
}

const stubPublicAppointmentRequestStatus = {
  id: 'stub',
  status: 'pending' as const,
  bookedServiceName: 'stub',
  bookedServiceDuration: 45,
  bookedServicePrice: 0,
  requestedDate: '2026-06-07',
  requestedStartTime: '10:00',
  requestedEndTime: '11:00',
  salon: { name: 'stub', phone: null },
  createdAt: new Date().toISOString(),
  reviewedAt: null,
  rejectionReason: null,
}

const getPublicSalonStub: RouteHandler<typeof getPublicSalonRoute> = (c) =>
  c.json(stubPublicSalonView, 200)

const getPublicAvailabilityStub: RouteHandler<
  typeof getPublicAvailabilityRoute
> = (c) => c.json({ mode: 'day' as const, slots: [] }, 200)

const createPublicAppointmentRequestStub: RouteHandler<
  typeof createPublicAppointmentRequestRoute
> = (c) => c.json({ token: 'stub' }, 201)

const getPublicAppointmentRequestStub: RouteHandler<
  typeof getPublicAppointmentRequestRoute
> = (c) => c.json(stubPublicAppointmentRequestStatus, 200)

const cancelPublicAppointmentRequestStub: RouteHandler<
  typeof cancelPublicAppointmentRequestRoute
> = (c) => c.json({ ok: true as const }, 200)

/**
 * Minimal OpenAPI app used only for contract generation.
 * Stub handlers avoid loading auth/database modules at generate time.
 */
export const contractApp = new OpenAPIHono()
  .route(
    '/api/v1/admin',
    new OpenAPIHono()
      .openapi(getAdminMeRoute, getAdminMeStub)
      .openapi(getAdminRuntimeRoute, getAdminRuntimeStub)
      .openapi(getAdminOverviewRoute, getAdminOverviewStub)
      .openapi(listAdminSalonsRoute, listAdminSalonsStub)
      .openapi(getAdminSalonRoute, getAdminSalonStub)
      .openapi(listAdminSalonClientsRoute, listAdminSalonClientsStub)
      .openapi(listAdminSalonAppointmentsRoute, listAdminSalonAppointmentsStub)
      .openapi(
        listAdminSalonAppointmentRequestsRoute,
        listAdminSalonAppointmentRequestsStub,
      )
      .openapi(listAdminSalonStaffRoute, listAdminSalonStaffStub)
      .openapi(listAdminSalonServicesRoute, listAdminSalonServicesStub)
      .openapi(updateAdminSalonStatusRoute, updateAdminSalonStatusStub)
      .openapi(listAdminSalonNotesRoute, listAdminSalonNotesStub)
      .openapi(createAdminSalonNoteRoute, createAdminSalonNoteStub)
      .openapi(listAdminUsersRoute, listAdminUsersStub)
      .openapi(getAdminUserRoute, getAdminUserStub)
      .openapi(listAdminUserNotesRoute, listAdminUserNotesStub)
      .openapi(createAdminUserNoteRoute, createAdminUserNoteStub)
      .openapi(listAdminCatalogPresetsRoute, listAdminCatalogPresetsStub)
      .openapi(createAdminCatalogPresetRoute, createAdminCatalogPresetStub)
      .openapi(updateAdminCatalogPresetRoute, updateAdminCatalogPresetStub)
      .openapi(getAdminMessagingHealthRoute, getAdminMessagingHealthStub)
      .openapi(
        listAdminNotificationDeliveriesRoute,
        listAdminNotificationDeliveriesStub,
      )
      .openapi(
        listAdminSupportAppointmentsRoute,
        listAdminSupportAppointmentsStub,
      )
      .openapi(
        listAdminSupportAppointmentRequestsRoute,
        listAdminSupportAppointmentRequestsStub,
      )
      .openapi(listAdminAuditLogRoute, listAdminAuditLogStub)
      .openapi(listPlatformAdminsRoute, listPlatformAdminsStub)
      .openapi(createPlatformAdminRoute, createPlatformAdminStub)
      .openapi(updatePlatformAdminRoute, updatePlatformAdminStub),
  )
  .route(
    '/api/v1/clients',
    new OpenAPIHono()
      .openapi(listClientsRoute, listClientsStub)
      .openapi(createClientRoute, createClientStub)
      .openapi(bulkCreateClientsRoute, bulkCreateClientsStub)
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
      .openapi(
        getStaffBookingAvailabilityRoute,
        getStaffBookingAvailabilityStub,
      )
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
  .route(
    '/api/v1/appointments',
    new OpenAPIHono()
      .openapi(listAppointmentsRoute, listAppointmentsStub)
      .openapi(createAppointmentRoute, createAppointmentStub)
      .openapi(getAppointmentAvailabilityRoute, getAppointmentAvailabilityStub)
      .openapi(getAppointmentRoute, getAppointmentStub)
      .openapi(updateAppointmentRoute, updateAppointmentStub)
      .openapi(deleteAppointmentRoute, deleteAppointmentStub)
      .openapi(completePlaceholderClientRoute, completePlaceholderClientStub),
  )
  .route(
    '/api/v1/appointment-requests',
    new OpenAPIHono()
      .openapi(listAppointmentRequestsRoute, listAppointmentRequestsStub)
      .openapi(approveAppointmentRequestRoute, approveAppointmentRequestStub)
      .openapi(rejectAppointmentRequestRoute, rejectAppointmentRequestStub),
  )
  .route(
    '/api/v1/settings',
    new OpenAPIHono()
      .openapi(getBusinessSettingsRoute, getBusinessSettingsStub)
      .openapi(updateBusinessSettingsRoute, updateBusinessSettingsStub),
  )
  .route(
    '/api/v1/salon-profile',
    new OpenAPIHono()
      .openapi(getSalonPresenceRoute, getSalonPresenceStub)
      .openapi(updateSalonPresenceRoute, updateSalonPresenceStub),
  )
  .route(
    '/api/v1/salon-public-settings',
    new OpenAPIHono()
      .openapi(getSalonPublicSettingsRoute, getSalonPublicSettingsStub)
      .openapi(updateSalonPublicSettingsRoute, updateSalonPublicSettingsStub)
      .openapi(updateSalonSlugRoute, updateSalonSlugStub),
  )
  .route(
    '/api/v1/onboarding',
    new OpenAPIHono()
      .openapi(getOnboardingRoute, getOnboardingStub)
      .openapi(updateOnboardingRoute, updateOnboardingStub),
  )
  .route(
    '/api/v1/dashboard',
    new OpenAPIHono().openapi(getDashboardRoute, getDashboardStub),
  )
  .route(
    '/api/v1/today',
    new OpenAPIHono().openapi(getTodayRoute, getTodayStub),
  )
  .route(
    '/api/v1/retention',
    new OpenAPIHono()
      .openapi(listRetentionRoute, listRetentionStub)
      .openapi(updateRetentionRoute, updateRetentionStub)
      .openapi(sendRetentionBaleMessageRoute, sendRetentionBaleMessageStub),
  )
  .route(
    '/api/v1/messaging',
    new OpenAPIHono()
      .openapi(listMessagingAccountsRoute, listMessagingAccountsStub)
      .openapi(createMessagingLinkRoute, createMessagingLinkStub)
      .openapi(patchMessagingAccountRoute, patchMessagingAccountStub)
      .openapi(deleteMessagingAccountRoute, deleteMessagingAccountStub),
  )
  .route(
    '/api/v1/notifications',
    new OpenAPIHono()
      .openapi(listNotificationsRoute, listNotificationsStub)
      .openapi(markAllNotificationsReadRoute, markAllNotificationsReadStub)
      .openapi(createNotificationTestRoute, createNotificationTestStub)
      .openapi(markNotificationReadRoute, markNotificationReadStub),
  )
  .route(
    '/api/v1/notification-preferences',
    new OpenAPIHono()
      .openapi(getNotificationPreferencesRoute, getNotificationPreferencesStub)
      .openapi(
        updateNotificationPreferencesRoute,
        updateNotificationPreferencesStub,
      ),
  )
  .route(
    '/api/v1/public',
    new OpenAPIHono()
      .openapi(getPublicSalonRoute, getPublicSalonStub)
      .openapi(getPublicAvailabilityRoute, getPublicAvailabilityStub)
      .openapi(
        createPublicAppointmentRequestRoute,
        createPublicAppointmentRequestStub,
      )
      .openapi(
        getPublicAppointmentRequestRoute,
        getPublicAppointmentRequestStub,
      )
      .openapi(
        cancelPublicAppointmentRequestRoute,
        cancelPublicAppointmentRequestStub,
      ),
  )

export const openApiDocumentConfig = {
  openapi: '3.0.0' as const,
  info: {
    title: 'Saluna API',
    version: '0.8.0',
    description:
      'Tenant-facing Saluna API. Generated from Hono OpenAPI route definitions. ' +
      'This contract is expanded incrementally; admin, clients, staff, services catalog, appointments, appointment-requests, settings, salon-profile, salon-public-settings, onboarding, dashboard, today, retention, messaging, notifications, notification-preferences, and public booking route groups are documented.',
  },
  servers: [
    { url: '', description: 'Saluna API (paths include /api/v1 prefix)' },
  ],
  tags: [
    { name: 'Clients', description: 'Salon client CRUD and follow-ups' },
    {
      name: 'Staff',
      description: 'Staff roster, schedules, and service assignments',
    },
    {
      name: 'Services',
      description: 'Salon services, combo packages, and starter imports',
    },
    {
      name: 'Service categories',
      description: 'Top-level service catalog sections',
    },
    {
      name: 'Service families',
      description: 'Grouped services within a category',
    },
    { name: 'Service addons', description: 'Optional booking add-ons' },
    { name: 'Catalog presets', description: 'Starter catalog templates' },
    {
      name: 'Appointments',
      description: 'Calendar appointments and availability',
    },
    {
      name: 'Appointment requests',
      description: 'Public booking request inbox (approve / reject)',
    },
    { name: 'Settings', description: 'Salon business hours and slot duration' },
    {
      name: 'Salon profile',
      description: 'Salon presence (address, maps, social links)',
    },
    {
      name: 'Salon public settings',
      description: 'Public booking page settings and slug',
    },
    {
      name: 'Onboarding',
      description: 'Manager onboarding wizard status and step actions',
    },
    {
      name: 'Dashboard',
      description: 'Manager dashboard aggregates and metrics',
    },
    {
      name: 'Today',
      description: 'Manager and staff today views',
    },
    {
      name: 'Retention',
      description: 'Client follow-up retention queue',
    },
    {
      name: 'Messaging',
      description: 'Messaging provider account linking (Telegram, Bale, etc.)',
    },
    {
      name: 'Notifications',
      description: 'In-app notification inbox',
    },
    {
      name: 'Notification preferences',
      description: 'Per-user notification channel preferences',
    },
    {
      name: 'Public booking',
      description:
        'Unauthenticated public salon page and appointment request flows',
    },
    {
      name: 'Admin',
      description: 'Internal Saluna platform admin APIs',
    },
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
        description:
          'Better Auth session cookie (PWA uses credentials: include)',
      },
    },
  },
}
