import {
  pgTable,
  uuid,
  text,
  boolean,
  integer,
  serial,
  timestamp,
  jsonb,
  index,
  uniqueIndex,
  primaryKey,
} from 'drizzle-orm/pg-core'

export const salons = pgTable(
  'salons',
  {
    id: uuid('id').primaryKey().defaultRandom(),
    name: text('name').notNull(),
    slug: text('slug').notNull(),
    phone: text('phone'),
    address: text('address'),
    timezone: text('timezone').notNull().default('Asia/Tehran'),
    locale: text('locale').notNull().default('fa-IR'),
    status: text('status').notNull().$type<'active' | 'suspended' | 'archived'>().default('active'),
    createdAt: timestamp('created_at', { withTimezone: true }).notNull().defaultNow(),
    updatedAt: timestamp('updated_at', { withTimezone: true }).notNull().defaultNow(),
  },
  (t) => [uniqueIndex('salons_slug_unique').on(t.slug)]
)

export const locations = pgTable(
  'locations',
  {
    id: uuid('id').primaryKey().defaultRandom(),
    salonId: uuid('salon_id')
      .notNull()
      .references(() => salons.id, { onDelete: 'cascade' }),
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

export const users = pgTable('users', {
  id: uuid('id').primaryKey().defaultRandom(),
  salonId: uuid('salon_id')
    .notNull()
    .references(() => salons.id, { onDelete: 'restrict' }),
  name: text('name').notNull(),
  phone: text('phone').notNull().unique(),
  passwordHash: text('password_hash').notNull(),
  role: text('role').notNull().$type<'manager' | 'staff'>(),
  color: text('color').notNull(),
  active: boolean('active').notNull().default(true),
  createdAt: timestamp('created_at', { withTimezone: true }).notNull().defaultNow(),
}, (t) => [
  index('users_salon_id_role_active_idx').on(t.salonId, t.role, t.active),
])

export const staffSchedules = pgTable(
  'staff_schedules',
  {
    id: uuid('id').primaryKey().defaultRandom(),
    salonId: uuid('salon_id')
      .notNull()
      .references(() => salons.id, { onDelete: 'cascade' }),
    staffId: uuid('staff_id')
      .notNull()
      .references(() => users.id, { onDelete: 'cascade' }),
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

export const services = pgTable(
  'services',
  {
    id: uuid('id').primaryKey().defaultRandom(),
    salonId: uuid('salon_id')
      .notNull()
      .references(() => salons.id, { onDelete: 'restrict' }),
    name: text('name').notNull(),
    category: text('category').notNull().$type<'hair' | 'nails' | 'skincare' | 'spa'>(),
    duration: integer('duration').notNull(),
    price: integer('price').notNull(),
    color: text('color').notNull(),
    active: boolean('active').notNull().default(true),
    createdAt: timestamp('created_at', { withTimezone: true }).notNull().defaultNow(),
  },
  (t) => [
    uniqueIndex('services_salon_id_name_unique').on(t.salonId, t.name),
    index('services_salon_id_active_idx').on(t.salonId, t.active),
  ]
)

export const resources = pgTable(
  'resources',
  {
    id: uuid('id').primaryKey().defaultRandom(),
    salonId: uuid('salon_id')
      .notNull()
      .references(() => salons.id, { onDelete: 'cascade' }),
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
      .references(() => users.id, { onDelete: 'cascade' }),
    serviceId: uuid('service_id')
      .notNull()
      .references(() => services.id, { onDelete: 'cascade' }),
    salonId: uuid('salon_id')
      .notNull()
      .references(() => salons.id, { onDelete: 'cascade' }),
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
      .references(() => salons.id, { onDelete: 'restrict' }),
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
      .references(() => salons.id, { onDelete: 'cascade' }),
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
      .references(() => salons.id, { onDelete: 'restrict' }),
    clientId: uuid('client_id')
      .notNull()
      .references(() => clients.id, { onDelete: 'restrict' }),
    staffId: uuid('staff_id')
      .notNull()
      .references(() => users.id, { onDelete: 'restrict' }),
    serviceId: uuid('service_id')
      .notNull()
      .references(() => services.id, { onDelete: 'restrict' }),
    date: text('date').notNull(),
    startTime: text('start_time').notNull(),
    endTime: text('end_time').notNull(),
    status: text('status')
      .notNull()
      .$type<'scheduled' | 'confirmed' | 'completed' | 'cancelled' | 'no-show'>(),
    notes: text('notes'),
    createdByUserId: uuid('created_by_user_id').references(() => users.id, {
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

export const clientFollowUps = pgTable(
  'client_follow_ups',
  {
    id: uuid('id').primaryKey().defaultRandom(),
    salonId: uuid('salon_id')
      .notNull()
      .references(() => salons.id, { onDelete: 'cascade' }),
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
      .references(() => salons.id, { onDelete: 'cascade' }),
    workingStart: text('working_start').notNull().default('09:00'),
    workingEnd: text('working_end').notNull().default('19:00'),
    slotDurationMinutes: integer('slot_duration_minutes').notNull().default(30),
  },
  (t) => [uniqueIndex('business_settings_salon_id_unique').on(t.salonId)]
)

export const salonOnboarding = pgTable('salon_onboarding', {
  salonId: uuid('salon_id')
    .primaryKey()
    .references(() => salons.id, { onDelete: 'cascade' }),
  profileConfirmedAt: timestamp('profile_confirmed_at', { withTimezone: true }),
  completedAt: timestamp('completed_at', { withTimezone: true }),
  skippedAt: timestamp('skipped_at', { withTimezone: true }),
  updatedAt: timestamp('updated_at', { withTimezone: true }).notNull().defaultNow(),
})

export const pushSubscriptions = pgTable('push_subscriptions', {
  id: uuid('id').primaryKey().defaultRandom(),
  salonId: uuid('salon_id')
    .notNull()
    .references(() => salons.id, { onDelete: 'cascade' }),
  userId: uuid('user_id')
    .notNull()
    .references(() => users.id, { onDelete: 'cascade' }),
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
      .references(() => salons.id, { onDelete: 'cascade' }),
    userId: uuid('user_id')
      .notNull()
      .references(() => users.id, { onDelete: 'cascade' }),
    type: text('type').notNull().$type<'appointment_created'>(),
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
      .$type<'in_app' | 'local_sync' | 'sms' | 'android_regional_push'>(),
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

export const notificationPreferences = pgTable(
  'notification_preferences',
  {
    salonId: uuid('salon_id')
      .notNull()
      .references(() => salons.id, { onDelete: 'cascade' }),
    userId: uuid('user_id')
      .notNull()
      .references(() => users.id, { onDelete: 'cascade' }),
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
