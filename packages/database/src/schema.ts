import {
  pgTable,
  uuid,
  text,
  boolean,
  integer,
  serial,
  smallint,
  timestamp,
  jsonb,
  index,
  uniqueIndex,
  primaryKey,
} from 'drizzle-orm/pg-core'

import type { CatalogPresetTree } from '@repo/salon-core/forms/catalog-preset'

import type { MessagingProviderId } from './messaging-provider-id'

// ─────────────────────────────────────────────────────────────────────────
// Better Auth tables (core + username + organization plugins).
// Property keys match Better Auth field names; columns use snake_case.
// PKs are uuid so the existing uuid salon_id FKs repoint to organization.id.
// ─────────────────────────────────────────────────────────────────────────

export const user = pgTable('user', {
  id: uuid('id').primaryKey().defaultRandom(),
  name: text('name').notNull(),
  email: text('email').notNull().unique(),
  emailVerified: boolean('email_verified').notNull().default(false),
  image: text('image'),
  createdAt: timestamp('created_at', { withTimezone: true }).notNull().defaultNow(),
  updatedAt: timestamp('updated_at', { withTimezone: true }).notNull().defaultNow(),
  // username plugin
  username: text('username').unique(),
  displayUsername: text('display_username'),
})

export const session = pgTable(
  'session',
  {
    id: uuid('id').primaryKey().defaultRandom(),
    expiresAt: timestamp('expires_at', { withTimezone: true }).notNull(),
    token: text('token').notNull().unique(),
    createdAt: timestamp('created_at', { withTimezone: true }).notNull().defaultNow(),
    updatedAt: timestamp('updated_at', { withTimezone: true }).notNull().defaultNow(),
    ipAddress: text('ip_address'),
    userAgent: text('user_agent'),
    userId: uuid('user_id')
      .notNull()
      .references(() => user.id, { onDelete: 'cascade' }),
    // organization plugin
    activeOrganizationId: uuid('active_organization_id'),
  },
  (t) => [index('session_user_id_idx').on(t.userId)]
)

export const account = pgTable(
  'account',
  {
    id: uuid('id').primaryKey().defaultRandom(),
    accountId: text('account_id').notNull(),
    providerId: text('provider_id').notNull(),
    userId: uuid('user_id')
      .notNull()
      .references(() => user.id, { onDelete: 'cascade' }),
    accessToken: text('access_token'),
    refreshToken: text('refresh_token'),
    idToken: text('id_token'),
    accessTokenExpiresAt: timestamp('access_token_expires_at', { withTimezone: true }),
    refreshTokenExpiresAt: timestamp('refresh_token_expires_at', { withTimezone: true }),
    scope: text('scope'),
    password: text('password'),
    createdAt: timestamp('created_at', { withTimezone: true }).notNull().defaultNow(),
    updatedAt: timestamp('updated_at', { withTimezone: true }).notNull().defaultNow(),
  },
  (t) => [index('account_user_id_idx').on(t.userId)]
)

export const verification = pgTable(
  'verification',
  {
    id: uuid('id').primaryKey().defaultRandom(),
    identifier: text('identifier').notNull(),
    value: text('value').notNull(),
    expiresAt: timestamp('expires_at', { withTimezone: true }).notNull(),
    createdAt: timestamp('created_at', { withTimezone: true }).notNull().defaultNow(),
    updatedAt: timestamp('updated_at', { withTimezone: true }).notNull().defaultNow(),
  },
  (t) => [index('verification_identifier_idx').on(t.identifier)]
)

export const organization = pgTable('organization', {
  id: uuid('id').primaryKey().defaultRandom(),
  name: text('name').notNull(),
  slug: text('slug').notNull().unique(),
  logo: text('logo'),
  createdAt: timestamp('created_at', { withTimezone: true }).notNull().defaultNow(),
  metadata: text('metadata'),
})

export const member = pgTable(
  'member',
  {
    id: uuid('id').primaryKey().defaultRandom(),
    organizationId: uuid('organization_id')
      .notNull()
      .references(() => organization.id, { onDelete: 'cascade' }),
    userId: uuid('user_id')
      .notNull()
      .references(() => user.id, { onDelete: 'cascade' }),
    role: text('role').notNull().default('member'),
    createdAt: timestamp('created_at', { withTimezone: true }).notNull().defaultNow(),
  },
  (t) => [
    index('member_organization_id_idx').on(t.organizationId),
    index('member_user_id_idx').on(t.userId),
  ]
)

export const invitation = pgTable(
  'invitation',
  {
    id: uuid('id').primaryKey().defaultRandom(),
    organizationId: uuid('organization_id')
      .notNull()
      .references(() => organization.id, { onDelete: 'cascade' }),
    email: text('email').notNull(),
    role: text('role'),
    status: text('status').notNull().default('pending'),
    expiresAt: timestamp('expires_at', { withTimezone: true }).notNull(),
    createdAt: timestamp('created_at', { withTimezone: true }).notNull().defaultNow(),
    inviterId: uuid('inviter_id')
      .notNull()
      .references(() => user.id, { onDelete: 'cascade' }),
  },
  (t) => [
    index('invitation_organization_id_idx').on(t.organizationId),
    index('invitation_email_idx').on(t.email),
  ]
)

// ─────────────────────────────────────────────────────────────────────────
// Salon sidecars: salon-specific fields hung off organization / membership.
// ─────────────────────────────────────────────────────────────────────────

export const salonProfile = pgTable('salon_profile', {
  organizationId: uuid('organization_id')
    .primaryKey()
    .references(() => organization.id, { onDelete: 'cascade' }),
  timezone: text('timezone').notNull().default('Asia/Tehran'),
  locale: text('locale').notNull().default('fa-IR'),
  status: text('status').notNull().$type<'active' | 'suspended' | 'archived'>().default('active'),
  phone: text('phone'),
  address: text('address'),
  mapGoogle: text('map_google'),
  mapNeshan: text('map_neshan'),
  mapBalad: text('map_balad'),
  socialInstagram: text('social_instagram'),
  socialTelegram: text('social_telegram'),
  socialWhatsapp: text('social_whatsapp'),
  website: text('website'),
})

export const salonMember = pgTable(
  'salon_member',
  {
    id: uuid('id').primaryKey().defaultRandom(),
    userId: uuid('user_id')
      .notNull()
      .references(() => user.id, { onDelete: 'cascade' }),
    organizationId: uuid('organization_id')
      .notNull()
      .references(() => organization.id, { onDelete: 'cascade' }),
    displayName: text('display_name'),
    color: text('color'),
    active: boolean('active').notNull().default(true),
    createdAt: timestamp('created_at', { withTimezone: true }).notNull().defaultNow(),
  },
  (t) => [
    index('salon_member_organization_id_idx').on(t.organizationId),
    uniqueIndex('salon_member_user_id_organization_id_unique').on(t.userId, t.organizationId),
  ]
)

export const locations = pgTable(
  'locations',
  {
    id: uuid('id').primaryKey().defaultRandom(),
    salonId: uuid('salon_id')
      .notNull()
      .references(() => organization.id, { onDelete: 'cascade' }),
    name: text('name').notNull(),
    address: text('address'),
    phone: text('phone'),
    active: boolean('active').notNull().default(true),
    createdAt: timestamp('created_at', { withTimezone: true }).notNull().defaultNow(),
    updatedAt: timestamp('updated_at', { withTimezone: true }).notNull().defaultNow(),
  },
  (t) => [
    index('locations_salon_id_active_idx').on(t.salonId, t.active),
    uniqueIndex('locations_salon_id_name_unique').on(t.salonId, t.name),
  ]
)

export const staffSchedules = pgTable(
  'staff_schedules',
  {
    id: uuid('id').primaryKey().defaultRandom(),
    salonId: uuid('salon_id')
      .notNull()
      .references(() => organization.id, { onDelete: 'cascade' }),
    staffId: uuid('staff_id')
      .notNull()
      .references(() => user.id, { onDelete: 'cascade' }),
    dayOfWeek: integer('day_of_week').notNull(),
    workingStart: text('working_start').notNull(),
    workingEnd: text('working_end').notNull(),
    active: boolean('active').notNull().default(true),
    createdAt: timestamp('created_at', { withTimezone: true }).notNull().defaultNow(),
    updatedAt: timestamp('updated_at', { withTimezone: true }).notNull().defaultNow(),
  },
  (t) => [
    uniqueIndex('staff_schedules_salon_id_staff_id_day_unique').on(
      t.salonId,
      t.staffId,
      t.dayOfWeek
    ),
    index('staff_schedules_salon_id_staff_id_idx').on(t.salonId, t.staffId),
    index('staff_schedules_salon_id_day_active_idx').on(t.salonId, t.dayOfWeek, t.active),
  ]
)

export const serviceCategories = pgTable(
  'service_categories',
  {
    id: uuid('id').primaryKey().defaultRandom(),
    salonId: uuid('salon_id')
      .notNull()
      .references(() => organization.id, { onDelete: 'cascade' }),
    name: text('name').notNull(),
    active: boolean('active').notNull().default(true),
    createdAt: timestamp('created_at', { withTimezone: true }).notNull().defaultNow(),
    updatedAt: timestamp('updated_at', { withTimezone: true }).notNull().defaultNow(),
  },
  (t) => [
    uniqueIndex('service_categories_salon_id_name_unique').on(t.salonId, t.name),
    index('service_categories_salon_id_active_idx').on(t.salonId, t.active),
  ]
)

export const serviceFamilies = pgTable(
  'service_families',
  {
    id: uuid('id').primaryKey().defaultRandom(),
    salonId: uuid('salon_id')
      .notNull()
      .references(() => organization.id, { onDelete: 'cascade' }),
    categoryId: uuid('category_id')
      .notNull()
      .references(() => serviceCategories.id, { onDelete: 'restrict' }),
    name: text('name').notNull(),
    active: boolean('active').notNull().default(true),
    createdAt: timestamp('created_at', { withTimezone: true }).notNull().defaultNow(),
    updatedAt: timestamp('updated_at', { withTimezone: true }).notNull().defaultNow(),
  },
  (t) => [
    uniqueIndex('service_families_salon_id_category_id_name_unique').on(
      t.salonId,
      t.categoryId,
      t.name
    ),
    index('service_families_salon_id_category_id_idx').on(t.salonId, t.categoryId),
    index('service_families_salon_id_active_idx').on(t.salonId, t.active),
  ]
)

export const services = pgTable(
  'services',
  {
    id: uuid('id').primaryKey().defaultRandom(),
    salonId: uuid('salon_id')
      .notNull()
      .references(() => organization.id, { onDelete: 'restrict' }),
    categoryId: uuid('category_id')
      .notNull()
      .references(() => serviceCategories.id, { onDelete: 'restrict' }),
    familyId: uuid('family_id').references(() => serviceFamilies.id, {
      onDelete: 'set null',
    }),
    name: text('name').notNull(),
    duration: integer('duration').notNull(),
    price: integer('price').notNull(),
    color: text('color').notNull(),
    active: boolean('active').notNull().default(true),
    description: text('description'),
    kind: text('kind').notNull().$type<'standard' | 'combo'>().default('standard'),
    createdAt: timestamp('created_at', { withTimezone: true }).notNull().defaultNow(),
  },
  (t) => [
    uniqueIndex('services_salon_id_name_unique').on(t.salonId, t.name),
    index('services_salon_id_category_id_idx').on(t.salonId, t.categoryId),
    index('services_salon_id_family_id_idx').on(t.salonId, t.familyId),
    index('services_salon_id_active_idx').on(t.salonId, t.active),
  ]
)

export const serviceComboComponents = pgTable(
  'service_combo_components',
  {
    id: uuid('id').primaryKey().defaultRandom(),
    salonId: uuid('salon_id')
      .notNull()
      .references(() => organization.id, { onDelete: 'cascade' }),
    comboServiceId: uuid('combo_service_id')
      .notNull()
      .references(() => services.id, { onDelete: 'cascade' }),
    componentServiceId: uuid('component_service_id')
      .notNull()
      .references(() => services.id, { onDelete: 'restrict' }),
    sortOrder: integer('sort_order').notNull().default(0),
    createdAt: timestamp('created_at', { withTimezone: true }).notNull().defaultNow(),
    updatedAt: timestamp('updated_at', { withTimezone: true }).notNull().defaultNow(),
  },
  (t) => [
    uniqueIndex('service_combo_components_combo_component_unique').on(
      t.comboServiceId,
      t.componentServiceId
    ),
    index('service_combo_components_salon_id_combo_idx').on(t.salonId, t.comboServiceId),
    index('service_combo_components_salon_id_component_idx').on(t.salonId, t.componentServiceId),
  ]
)

export const serviceAddons = pgTable(
  'service_addons',
  {
    id: uuid('id').primaryKey().defaultRandom(),
    salonId: uuid('salon_id')
      .notNull()
      .references(() => organization.id, { onDelete: 'cascade' }),
    name: text('name').notNull(),
    priceDelta: integer('price_delta').notNull().default(0),
    durationDelta: integer('duration_delta').notNull().default(0),
    active: boolean('active').notNull().default(true),
    sortOrder: integer('sort_order').notNull().default(0),
    description: text('description'),
    color: text('color'),
    createdAt: timestamp('created_at', { withTimezone: true }).notNull().defaultNow(),
    updatedAt: timestamp('updated_at', { withTimezone: true }).notNull().defaultNow(),
  },
  (t) => [
    index('service_addons_salon_id_active_idx').on(t.salonId, t.active),
    index('service_addons_salon_id_sort_idx').on(t.salonId, t.sortOrder, t.name),
  ]
)

export const serviceAddonCategoryScopes = pgTable(
  'service_addon_category_scopes',
  {
    id: uuid('id').primaryKey().defaultRandom(),
    salonId: uuid('salon_id')
      .notNull()
      .references(() => organization.id, { onDelete: 'cascade' }),
    addonId: uuid('addon_id')
      .notNull()
      .references(() => serviceAddons.id, { onDelete: 'cascade' }),
    scopeId: uuid('scope_id')
      .notNull()
      .references(() => serviceCategories.id, { onDelete: 'cascade' }),
  },
  (t) => [
    uniqueIndex('service_addon_category_scopes_addon_scope_unique').on(t.addonId, t.scopeId),
    index('service_addon_category_scopes_salon_id_addon_idx').on(t.salonId, t.addonId),
    index('service_addon_category_scopes_salon_id_scope_idx').on(t.salonId, t.scopeId),
  ]
)

export const serviceAddonFamilyScopes = pgTable(
  'service_addon_family_scopes',
  {
    id: uuid('id').primaryKey().defaultRandom(),
    salonId: uuid('salon_id')
      .notNull()
      .references(() => organization.id, { onDelete: 'cascade' }),
    addonId: uuid('addon_id')
      .notNull()
      .references(() => serviceAddons.id, { onDelete: 'cascade' }),
    scopeId: uuid('scope_id')
      .notNull()
      .references(() => serviceFamilies.id, { onDelete: 'cascade' }),
  },
  (t) => [
    uniqueIndex('service_addon_family_scopes_addon_scope_unique').on(t.addonId, t.scopeId),
    index('service_addon_family_scopes_salon_id_addon_idx').on(t.salonId, t.addonId),
    index('service_addon_family_scopes_salon_id_scope_idx').on(t.salonId, t.scopeId),
  ]
)

export const serviceAddonServiceScopes = pgTable(
  'service_addon_service_scopes',
  {
    id: uuid('id').primaryKey().defaultRandom(),
    salonId: uuid('salon_id')
      .notNull()
      .references(() => organization.id, { onDelete: 'cascade' }),
    addonId: uuid('addon_id')
      .notNull()
      .references(() => serviceAddons.id, { onDelete: 'cascade' }),
    scopeId: uuid('scope_id')
      .notNull()
      .references(() => services.id, { onDelete: 'cascade' }),
  },
  (t) => [
    uniqueIndex('service_addon_service_scopes_addon_scope_unique').on(t.addonId, t.scopeId),
    index('service_addon_service_scopes_salon_id_addon_idx').on(t.salonId, t.addonId),
    index('service_addon_service_scopes_salon_id_scope_idx').on(t.salonId, t.scopeId),
  ]
)

export const resources = pgTable(
  'resources',
  {
    id: uuid('id').primaryKey().defaultRandom(),
    salonId: uuid('salon_id')
      .notNull()
      .references(() => organization.id, { onDelete: 'cascade' }),
    locationId: uuid('location_id')
      .notNull()
      .references(() => locations.id, { onDelete: 'cascade' }),
    name: text('name').notNull(),
    type: text('type').notNull(),
    active: boolean('active').notNull().default(true),
    createdAt: timestamp('created_at', { withTimezone: true }).notNull().defaultNow(),
    updatedAt: timestamp('updated_at', { withTimezone: true }).notNull().defaultNow(),
  },
  (t) => [
    index('resources_salon_id_active_idx').on(t.salonId, t.active),
    index('resources_salon_id_location_id_idx').on(t.salonId, t.locationId),
    uniqueIndex('resources_salon_id_location_id_name_unique').on(t.salonId, t.locationId, t.name),
  ]
)

/** When a user has no rows here, they may perform every active service. */
export const staffServices = pgTable(
  'staff_services',
  {
    staffUserId: uuid('staff_user_id')
      .notNull()
      .references(() => user.id, { onDelete: 'cascade' }),
    serviceId: uuid('service_id')
      .notNull()
      .references(() => services.id, { onDelete: 'cascade' }),
    salonId: uuid('salon_id')
      .notNull()
      .references(() => organization.id, { onDelete: 'cascade' }),
  },
  (t) => [
    primaryKey({ columns: [t.staffUserId, t.serviceId] }),
    index('staff_services_service_id_idx').on(t.serviceId),
    index('staff_services_salon_id_staff_user_id_idx').on(t.salonId, t.staffUserId),
    index('staff_services_salon_id_service_id_idx').on(t.salonId, t.serviceId),
  ]
)

export const clients = pgTable(
  'clients',
  {
    id: uuid('id').primaryKey().defaultRandom(),
    salonId: uuid('salon_id')
      .notNull()
      .references(() => organization.id, { onDelete: 'restrict' }),
    name: text('name').notNull(),
    phone: text('phone'),
    isPlaceholder: boolean('is_placeholder').notNull().default(false),
    notes: text('notes'),
    createdAt: timestamp('created_at', { withTimezone: true }).notNull().defaultNow(),
  },
  (t) => [
    uniqueIndex('clients_salon_id_phone_unique').on(t.salonId, t.phone),
    index('clients_salon_id_phone_idx').on(t.salonId, t.phone),
  ]
)

export const clientTags = pgTable(
  'client_tags',
  {
    id: uuid('id').primaryKey().defaultRandom(),
    salonId: uuid('salon_id')
      .notNull()
      .references(() => organization.id, { onDelete: 'cascade' }),
    clientId: uuid('client_id')
      .notNull()
      .references(() => clients.id, { onDelete: 'cascade' }),
    label: text('label').notNull(),
    color: text('color').notNull(),
    createdAt: timestamp('created_at', { withTimezone: true }).notNull().defaultNow(),
  },
  (t) => [
    uniqueIndex('client_tags_salon_id_client_id_label_unique').on(t.salonId, t.clientId, t.label),
    index('client_tags_salon_id_client_id_idx').on(t.salonId, t.clientId),
    index('client_tags_salon_id_label_idx').on(t.salonId, t.label),
  ]
)

export const appointments = pgTable(
  'appointments',
  {
    id: uuid('id').primaryKey().defaultRandom(),
    salonId: uuid('salon_id')
      .notNull()
      .references(() => organization.id, { onDelete: 'restrict' }),
    clientId: uuid('client_id')
      .notNull()
      .references(() => clients.id, { onDelete: 'restrict' }),
    staffId: uuid('staff_id')
      .notNull()
      .references(() => user.id, { onDelete: 'restrict' }),
    serviceId: uuid('service_id')
      .notNull()
      .references(() => services.id, { onDelete: 'restrict' }),
    date: text('date').notNull(),
    startTime: text('start_time').notNull(),
    endTime: text('end_time').notNull(),
    bookedServiceName: text('booked_service_name').notNull(),
    bookedServiceDuration: integer('booked_service_duration').notNull(),
    bookedServicePrice: integer('booked_service_price').notNull(),
    bookedTotalDuration: integer('booked_total_duration').notNull(),
    bookedTotalPrice: integer('booked_total_price').notNull(),
    status: text('status')
      .notNull()
      .$type<'scheduled' | 'confirmed' | 'completed' | 'cancelled' | 'no-show'>(),
    notes: text('notes'),
    createdByUserId: uuid('created_by_user_id').references(() => user.id, {
      onDelete: 'set null',
    }),
    createdAt: timestamp('created_at', { withTimezone: true }).notNull().defaultNow(),
    updatedAt: timestamp('updated_at', { withTimezone: true }).notNull().defaultNow(),
  },
  (t) => [
    index('appointments_salon_id_date_idx').on(t.salonId, t.date),
    index('appointments_salon_id_staff_id_date_idx').on(t.salonId, t.staffId, t.date),
    index('appointments_salon_id_client_id_date_idx').on(t.salonId, t.clientId, t.date),
    index('appointments_staff_id_date_idx').on(t.staffId, t.date),
    index('appointments_client_id_date_idx').on(t.clientId, t.date),
  ]
)

export const appointmentAddonLines = pgTable(
  'appointment_addon_lines',
  {
    id: uuid('id').primaryKey().defaultRandom(),
    salonId: uuid('salon_id')
      .notNull()
      .references(() => organization.id, { onDelete: 'cascade' }),
    appointmentId: uuid('appointment_id')
      .notNull()
      .references(() => appointments.id, { onDelete: 'cascade' }),
    serviceAddonId: uuid('service_addon_id')
      .notNull()
      .references(() => serviceAddons.id, { onDelete: 'restrict' }),
    bookedAddonName: text('booked_addon_name').notNull(),
    bookedAddonPriceDelta: integer('booked_addon_price_delta').notNull(),
    bookedAddonDurationDelta: integer('booked_addon_duration_delta').notNull(),
    sortOrder: integer('sort_order').notNull().default(0),
    createdAt: timestamp('created_at', { withTimezone: true }).notNull().defaultNow(),
  },
  (t) => [
    uniqueIndex('appointment_addon_lines_appointment_addon_unique').on(
      t.appointmentId,
      t.serviceAddonId
    ),
    index('appointment_addon_lines_salon_id_appointment_idx').on(t.salonId, t.appointmentId),
    index('appointment_addon_lines_salon_id_addon_idx').on(t.salonId, t.serviceAddonId),
  ]
)

export const clientFollowUps = pgTable(
  'client_follow_ups',
  {
    id: uuid('id').primaryKey().defaultRandom(),
    salonId: uuid('salon_id')
      .notNull()
      .references(() => organization.id, { onDelete: 'cascade' }),
    clientId: uuid('client_id')
      .notNull()
      .references(() => clients.id, { onDelete: 'cascade' }),
    reason: text('reason')
      .notNull()
      .$type<'inactive' | 'no-show' | 'new-client' | 'vip' | 'manual'>(),
    status: text('status').notNull().$type<'open' | 'reviewed' | 'dismissed'>().default('open'),
    dueDate: text('due_date').notNull(),
    createdAt: timestamp('created_at', { withTimezone: true }).notNull().defaultNow(),
    updatedAt: timestamp('updated_at', { withTimezone: true }).notNull().defaultNow(),
    reviewedAt: timestamp('reviewed_at', { withTimezone: true }),
  },
  (t) => [
    uniqueIndex('client_follow_ups_salon_id_client_id_reason_unique').on(
      t.salonId,
      t.clientId,
      t.reason
    ),
    index('client_follow_ups_salon_id_status_due_idx').on(t.salonId, t.status, t.dueDate),
    index('client_follow_ups_salon_id_client_id_idx').on(t.salonId, t.clientId),
  ]
)

export const businessSettings = pgTable(
  'business_settings',
  {
    id: serial('id').primaryKey(),
    salonId: uuid('salon_id')
      .notNull()
      .references(() => organization.id, { onDelete: 'cascade' }),
    workingStart: text('working_start').notNull().default('09:00'),
    workingEnd: text('working_end').notNull().default('19:00'),
    slotDurationMinutes: integer('slot_duration_minutes').notNull().default(30),
    // Bitmask: bit 0 = Saturday … bit 6 = Friday. Default 126 (0b1111110) = Sat–Thu open, Fri closed.
    workingDays: smallint('working_days').notNull().default(126),
  },
  (t) => [uniqueIndex('business_settings_salon_id_unique').on(t.salonId)]
)

export const salonOnboarding = pgTable('salon_onboarding', {
  salonId: uuid('salon_id')
    .primaryKey()
    .references(() => organization.id, { onDelete: 'cascade' }),
  profileConfirmedAt: timestamp('profile_confirmed_at', { withTimezone: true }),
  businessHoursConfirmedAt: timestamp('business_hours_confirmed_at', { withTimezone: true }),
  managerIsStaff: boolean('manager_is_staff').notNull().default(false),
  completedAt: timestamp('completed_at', { withTimezone: true }),
  skippedAt: timestamp('skipped_at', { withTimezone: true }),
  updatedAt: timestamp('updated_at', { withTimezone: true }).notNull().defaultNow(),
})

export const pushSubscriptions = pgTable('push_subscriptions', {
  id: uuid('id').primaryKey().defaultRandom(),
  salonId: uuid('salon_id')
    .notNull()
    .references(() => organization.id, { onDelete: 'cascade' }),
  userId: uuid('user_id')
    .notNull()
    .references(() => user.id, { onDelete: 'cascade' }),
  endpoint: text('endpoint').notNull().unique(),
  p256dh: text('p256dh').notNull(),
  auth: text('auth').notNull(),
  createdAt: timestamp('created_at', { withTimezone: true }).notNull().defaultNow(),
})

export const notifications = pgTable(
  'notifications',
  {
    id: uuid('id').primaryKey().defaultRandom(),
    salonId: uuid('salon_id')
      .notNull()
      .references(() => organization.id, { onDelete: 'cascade' }),
    userId: uuid('user_id')
      .notNull()
      .references(() => user.id, { onDelete: 'cascade' }),
    type: text('type').notNull().$type<
      | 'appointment_created'
      | 'appointment_request_pending'
      | 'appointment_request_approved'
      | 'appointment_request_rejected'
      | 'appointment_reminder'
    >(),
    title: text('title').notNull(),
    body: text('body').notNull(),
    route: text('route').notNull(),
    data: jsonb('data').notNull().$type<Record<string, unknown>>().default({}),
    readAt: timestamp('read_at', { withTimezone: true }),
    createdAt: timestamp('created_at', { withTimezone: true }).notNull().defaultNow(),
  },
  (t) => [
    index('notifications_salon_id_user_id_created_at_idx').on(t.salonId, t.userId, t.createdAt),
    index('notifications_salon_id_user_id_read_at_idx').on(t.salonId, t.userId, t.readAt),
  ]
)

export const notificationDeliveries = pgTable(
  'notification_deliveries',
  {
    id: uuid('id').primaryKey().defaultRandom(),
    notificationId: uuid('notification_id')
      .notNull()
      .references(() => notifications.id, { onDelete: 'cascade' }),
    channel: text('channel')
      .notNull()
      .$type<
        | 'in_app'
        | 'local_sync'
        | 'sms'
        | 'android_regional_push'
        | 'telegram'
        | 'bale'
        | 'rubika'
        | 'whatsapp'
      >(),
    status: text('status').notNull().$type<'pending' | 'sent' | 'failed' | 'skipped'>(),
    provider: text('provider'),
    providerMessageId: text('provider_message_id'),
    error: text('error'),
    createdAt: timestamp('created_at', { withTimezone: true }).notNull().defaultNow(),
    sentAt: timestamp('sent_at', { withTimezone: true }),
  },
  (t) => [
    index('notification_deliveries_notification_id_idx').on(t.notificationId),
    index('notification_deliveries_channel_status_idx').on(t.channel, t.status),
  ]
)

export const salonPublicSettings = pgTable('salon_public_settings', {
  salonId: uuid('salon_id')
    .primaryKey()
    .references(() => organization.id, { onDelete: 'cascade' }),
  enabled: boolean('enabled').notNull().default(false),
  bioText: text('bio_text'),
  themeId: text('theme_id').notNull().default('rose'),
  layoutId: text('layout_id').notNull().default('agenda'),
  appointmentRequestsEnabled: boolean('appointment_requests_enabled').notNull().default(true),
  /** Placeholder for future deposit feature. See ADR-0002. */
  depositPolicy: jsonb('deposit_policy').$type<
    { type: 'none' } | { type: 'fixed' | 'percent'; value: number }
  >(),
  enabledMessagingProviders: text('enabled_messaging_providers')
    .array()
    .notNull()
    .default([])
    .$type<Array<MessagingProviderId>>(),
  updatedAt: timestamp('updated_at', { withTimezone: true }).notNull().defaultNow(),
})

export const servicePublicVisibility = pgTable(
  'service_public_visibility',
  {
    salonId: uuid('salon_id')
      .notNull()
      .references(() => organization.id, { onDelete: 'cascade' }),
    serviceId: uuid('service_id')
      .notNull()
      .references(() => services.id, { onDelete: 'cascade' }),
    visible: boolean('visible').notNull().default(true),
    updatedAt: timestamp('updated_at', { withTimezone: true }).notNull().defaultNow(),
  },
  (t) => [primaryKey({ columns: [t.salonId, t.serviceId] })]
)

export const appointmentRequests = pgTable(
  'appointment_requests',
  {
    id: uuid('id').primaryKey().defaultRandom(),
    salonId: uuid('salon_id')
      .notNull()
      .references(() => organization.id, { onDelete: 'cascade' }),
    serviceId: uuid('service_id')
      .notNull()
      .references(() => services.id, { onDelete: 'restrict' }),
    /** Null at submit; set when manager approves. */
    staffId: uuid('staff_id').references(() => user.id, { onDelete: 'set null' }),
    requestedDate: text('requested_date').notNull(),
    requestedStartTime: text('requested_start_time').notNull(),
    requestedEndTime: text('requested_end_time').notNull(),
    customerName: text('customer_name').notNull(),
    customerPhone: text('customer_phone').notNull(),
    notes: text('notes'),
    /** Immutable snapshot — bound on submit, honored on approval even if the service changes. */
    bookedServiceName: text('booked_service_name').notNull(),
    bookedServiceDuration: integer('booked_service_duration').notNull(),
    bookedServicePrice: integer('booked_service_price').notNull(),
    status: text('status')
      .notNull()
      .$type<'pending' | 'approved' | 'rejected' | 'cancelled' | 'expired'>()
      .default('pending'),
    /** Schema hook for future deposit flow. See ADR-0002. */
    paymentStatus: text('payment_status')
      .notNull()
      .$type<'none' | 'pending' | 'paid'>()
      .default('none'),
    depositAmount: integer('deposit_amount'),
    /** Customer's status-page token. Lifetime: forever. */
    confirmationToken: uuid('confirmation_token').notNull().defaultRandom(),
    reviewedByUserId: uuid('reviewed_by_user_id').references(() => user.id, {
      onDelete: 'set null',
    }),
    reviewedAt: timestamp('reviewed_at', { withTimezone: true }),
    rejectionReason: text('rejection_reason'),
    appointmentId: uuid('appointment_id').references(() => appointments.id, {
      onDelete: 'set null',
    }),
    createdAt: timestamp('created_at', { withTimezone: true }).notNull().defaultNow(),
    updatedAt: timestamp('updated_at', { withTimezone: true }).notNull().defaultNow(),
  },
  (t) => [
    uniqueIndex('appointment_requests_confirmation_token_unique').on(t.confirmationToken),
    index('appointment_requests_salon_id_status_date_idx').on(
      t.salonId,
      t.status,
      t.requestedDate
    ),
    index('appointment_requests_salon_id_customer_phone_idx').on(t.salonId, t.customerPhone),
  ]
)

export const publicSubmitRateLimits = pgTable(
  'public_submit_rate_limits',
  {
    id: uuid('id').primaryKey().defaultRandom(),
    ip: text('ip').notNull(),
    createdAt: timestamp('created_at', { withTimezone: true }).notNull().defaultNow(),
  },
  (t) => [index('public_submit_rate_limits_ip_created_at_idx').on(t.ip, t.createdAt)]
)

export const catalogPresets = pgTable(
  'catalog_presets',
  {
    id: uuid('id').primaryKey().defaultRandom(),
    slug: text('slug').notNull(),
    name: text('name').notNull(),
    description: text('description'),
    tree: jsonb('tree').notNull().$type<CatalogPresetTree>(),
    sortOrder: integer('sort_order').notNull().default(0),
    isActive: boolean('is_active').notNull().default(true),
    createdAt: timestamp('created_at', { withTimezone: true }).notNull().defaultNow(),
    updatedAt: timestamp('updated_at', { withTimezone: true }).notNull().defaultNow(),
  },
  (t) => [
    uniqueIndex('catalog_presets_slug_unique').on(t.slug),
    index('catalog_presets_active_sort_idx').on(t.isActive, t.sortOrder),
  ]
)

export const presetApplications = pgTable(
  'preset_applications',
  {
    id: uuid('id').primaryKey().defaultRandom(),
    salonId: uuid('salon_id')
      .notNull()
      .references(() => organization.id, { onDelete: 'cascade' }),
    presetId: uuid('preset_id')
      .notNull()
      .references(() => catalogPresets.id, { onDelete: 'restrict' }),
    appliedAt: timestamp('applied_at', { withTimezone: true }).notNull().defaultNow(),
    importedVariantIds: uuid('imported_variant_ids').array().notNull().default([]),
  },
  (t) => [
    index('preset_applications_salon_id_applied_at_idx').on(t.salonId, t.appliedAt),
    index('preset_applications_preset_id_idx').on(t.presetId),
  ]
)

export const notificationPreferences = pgTable(
  'notification_preferences',
  {
    salonId: uuid('salon_id')
      .notNull()
      .references(() => organization.id, { onDelete: 'cascade' }),
    userId: uuid('user_id')
      .notNull()
      .references(() => user.id, { onDelete: 'cascade' }),
    appointmentAlertsEnabled: boolean('appointment_alerts_enabled').notNull().default(true),
    localAlertsEnabled: boolean('local_alerts_enabled').notNull().default(true),
    smsAlertsEnabled: boolean('sms_alerts_enabled').notNull().default(false),
    createdAt: timestamp('created_at', { withTimezone: true }).notNull().defaultNow(),
    updatedAt: timestamp('updated_at', { withTimezone: true }).notNull().defaultNow(),
  },
  (t) => [
    primaryKey({ columns: [t.salonId, t.userId] }),
    index('notification_preferences_user_id_idx').on(t.userId),
  ]
)

export const userMessagingAccounts = pgTable(
  'user_messaging_accounts',
  {
    id: uuid('id').primaryKey().defaultRandom(),
    userId: uuid('user_id')
      .notNull()
      .references(() => user.id, { onDelete: 'cascade' }),
    provider: text('provider').notNull().$type<MessagingProviderId>(),
    externalId: text('external_id').notNull(),
    displayName: text('display_name'),
    enabled: boolean('enabled').notNull().default(true),
    linkedAt: timestamp('linked_at', { withTimezone: true }).notNull().defaultNow(),
    updatedAt: timestamp('updated_at', { withTimezone: true }).notNull().defaultNow(),
  },
  (t) => [
    uniqueIndex('user_messaging_accounts_provider_external_id_unique').on(
      t.provider,
      t.externalId
    ),
    uniqueIndex('user_messaging_accounts_user_id_provider_unique').on(t.userId, t.provider),
    index('user_messaging_accounts_user_id_idx').on(t.userId),
  ]
)

export const messagingLinkTokens = pgTable(
  'messaging_link_tokens',
  {
    token: uuid('token').primaryKey().defaultRandom(),
    userId: uuid('user_id')
      .notNull()
      .references(() => user.id, { onDelete: 'cascade' }),
    salonId: uuid('salon_id')
      .notNull()
      .references(() => organization.id, { onDelete: 'cascade' }),
    provider: text('provider').notNull().$type<MessagingProviderId>(),
    createdAt: timestamp('created_at', { withTimezone: true }).notNull().defaultNow(),
    expiresAt: timestamp('expires_at', { withTimezone: true }).notNull(),
    consumedAt: timestamp('consumed_at', { withTimezone: true }),
  },
  (t) => [index('messaging_link_tokens_user_provider_idx').on(t.userId, t.provider)]
)
