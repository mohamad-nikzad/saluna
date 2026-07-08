import type { CalendarColorId } from './calendar-colors'

export type UserRole = 'manager' | 'staff'

export interface User {
  id: string
  salonId: string
  /** Compact salon-facing label. Uses nickname when one exists, otherwise fullName. */
  name: string
  /** Legal/account name used in edit forms and authentication records. */
  fullName?: string
  /** Optional salon nickname shown in dense operational UI. */
  nickname?: string | null
  role: UserRole
  color: string
  phone: string
  createdAt: Date
  /**
   * When omitted or `null`, the user may perform every active service.
   * When a non-empty array, only those services apply.
   */
  serviceIds?: string[] | null
  /** Manager-only: minimum setup (services + staff) is still incomplete. */
  needsOnboarding?: boolean
  /** Manager-only: finished the one-time onboarding flow. */
  onboardingCompleted?: boolean
}

export interface Service {
  id: string
  name: string
  /** Deprecated legacy bucket kept until the grouped catalog UI fully replaces it. */
  category: 'hair' | 'nails' | 'skincare' | 'spa'
  categoryId: string
  categoryName?: string | null
  /** Legacy storage only; new service catalog flows do not require a family. */
  familyId?: string | null
  familyName?: string | null
  duration: number // in minutes
  price: number
  color: string
  active: boolean
  description?: string | null
  kind?: 'standard' | 'combo'
}

export interface ServiceCategory {
  id: string
  name: string
  active: boolean
  createdAt: Date
  updatedAt: Date
}

export interface ServiceFamily {
  id: string
  categoryId: string
  categoryName?: string | null
  name: string
  active: boolean
  createdAt: Date
  updatedAt: Date
}

export interface ComboComponent {
  id: string
  salonId: string
  comboServiceId: string
  componentServiceId: string
  sortOrder: number
  service: Service
  createdAt: Date
  updatedAt: Date
}

export interface ComboComponentsSummary {
  comboServiceId: string
  components: ComboComponent[]
  totalDuration: number
  totalPrice: number
}

export interface ServicePackageComponent {
  id: string
  salonId: string
  packageId: string
  serviceId: string
  sortOrder: number
  service: Service
  createdAt: Date
  updatedAt: Date
}

export interface ServicePackage {
  id: string
  salonId: string
  categoryId: string | null
  categoryName?: string | null
  name: string
  description?: string | null
  color?: string | null
  active: boolean
  priceOverride: number | null
  sortOrder: number
  components: ServicePackageComponent[]
  staffIds?: string[]
  totalDuration: number
  componentPriceTotal: number
  resolvedPrice: number
  createdAt: Date
  updatedAt: Date
}

export interface ServicePackageBookingTask {
  id: string
  salonId: string
  packageBookingId: string
  packageComponentId: string
  serviceId: string
  appointmentId: string
  staffId: string
  startTime: string
  endTime: string
  sortOrder: number
  appointment?: Appointment
  createdAt: Date
  updatedAt: Date
}

export interface ServicePackageBooking {
  id: string
  salonId: string
  packageId: string
  clientId: string
  leadStaffId: string
  date: string
  bookedPackageName: string
  bookedPackagePrice: number
  status: Appointment['status']
  notes?: string | null
  createdByUserId?: string | null
  tasks: ServicePackageBookingTask[]
  createdAt: Date
  updatedAt: Date
}

export type ServiceAddonScope =
  | { type: 'all' }
  | {
      type: 'category'
      categoryId: string
      categoryName: string
      active: boolean
    }
  | {
      type: 'service'
      serviceId: string
      serviceName: string
      familyId?: string | null
      active: boolean
    }

export interface ServiceAddon {
  id: string
  salonId: string
  name: string
  priceDelta: number
  durationDelta: number
  active: boolean
  sortOrder: number
  description?: string | null
  color?: string | null
  scopes: ServiceAddonScope[]
  createdAt: Date
  updatedAt: Date
}

export interface BookedServiceSnapshot {
  bookedServiceName: string
  bookedServiceDuration: number
  bookedServicePrice: number
}

export interface BookedAppointmentAddonLine {
  id: string
  appointmentId: string
  serviceAddonId: string
  bookedAddonName: string
  bookedAddonPriceDelta: number
  bookedAddonDurationDelta: number
  sortOrder: number
  createdAt: Date
}

export interface Client {
  id: string
  name: string
  phone: string | null
  isPlaceholder: boolean
  notes?: string
  createdAt: Date
  tags?: ClientTag[]
}

export interface Appointment {
  id: string
  clientId: string
  staffId: string
  serviceId: string
  bookedServiceName: string
  bookedServiceDuration: number
  bookedServicePrice: number
  bookedTotalDuration: number
  bookedTotalPrice: number
  bookedAddonCount: number
  bookedAddons?: BookedAppointmentAddonLine[]
  date: string // YYYY-MM-DD
  startTime: string // HH:MM
  endTime: string // HH:MM
  status: 'scheduled' | 'confirmed' | 'completed' | 'cancelled' | 'no-show'
  notes?: string
  createdAt: Date
  updatedAt: Date
}

export interface AppointmentWithDetails extends Appointment {
  client: Client
  staff: User
  service: Service
}

export type CalendarView = 'day' | 'week' | 'month' | 'list'

export interface TimeSlot {
  time: string // HH:MM
  available: boolean
}

/** Default fallback when DB business_settings row is missing */
export const WORKING_HOURS = {
  start: '09:00',
  end: '19:00',
  slotDuration: 30, // minutes
} as const

export interface BusinessHours {
  workingStart: string
  workingEnd: string
  slotDurationMinutes: number
  /** Bitmask of working days. Bit 0 = Saturday … bit 6 = Friday. See ADR-0004. */
  workingDays: number
}

export interface StaffSchedule {
  id: string
  salonId: string
  staffId: string
  dayOfWeek: number
  workingStart: string
  workingEnd: string
  active: boolean
  createdAt: Date
  updatedAt: Date
}

export interface ClientTag {
  id: string
  salonId: string
  clientId: string
  label: string
  color: string
  createdAt: Date
}

export type FollowUpReason =
  | 'inactive'
  | 'no-show'
  | 'new-client'
  | 'vip'
  | 'manual'
export type FollowUpStatus = 'open' | 'reviewed' | 'dismissed'

export interface ClientFollowUp {
  id: string
  salonId: string
  clientId: string
  reason: FollowUpReason
  status: FollowUpStatus
  dueDate: string
  createdAt: Date
  updatedAt: Date
  reviewedAt: Date | null
}

export interface ClientSummary {
  client: Client
  tags: ClientTag[]
  upcomingAppointment: AppointmentWithDetails | null
  history: AppointmentWithDetails[]
  stats: {
    completedCount: number
    cancelledCount: number
    noShowCount: number
    estimatedSpend: number
    lastVisitDate: string | null
    favoriteServiceName: string | null
    lastStaffName: string | null
    totalCompletedVisits: number
  }
  openFollowUps: ClientFollowUp[]
}

export interface TodayAttentionItem {
  id: string
  type:
    | 'soon'
    | 'overdue'
    | 'no-show-risk'
    | 'first-time'
    | 'vip'
    | 'incomplete-client'
  title: string
  detail: string
  appointmentId?: string
  clientId?: string
  priority: number
}

export interface TodayData {
  date: string
  counts: Record<Appointment['status'], number>
  appointments: AppointmentWithDetails[]
  attentionItems: TodayAttentionItem[]
  staffLoad: Array<{
    staffId: string
    staffName: string
    appointmentCount: number
    bookedMinutes: number
  }>
  openSlots: Array<{
    staffId: string
    staffName: string
    ranges: Array<{ startTime: string; endTime: string }>
  }>
}

export interface RetentionItem {
  id: string
  client: Client
  reason: FollowUpReason
  status: FollowUpStatus
  dueDate: string
  lastVisitDate: string | null
  lastServiceName: string | null
  completedCount: number
  estimatedSpend: number
  noShowCount: number
  suggestedReason: string
}

export const SERVICE_CATEGORIES = {
  hair: { label: 'مو', color: 'bg-staff-1' },
  nails: { label: 'ناخن', color: 'bg-staff-2' },
  skincare: { label: 'پوست', color: 'bg-staff-3' },
  spa: { label: 'اسپا', color: 'bg-staff-4' },
} as const

export const STAFF_COLORS = [
  'rose',
  'violet',
  'mint',
  'gold',
  'coral',
] as const satisfies readonly CalendarColorId[]

export const APPOINTMENT_STATUS = {
  scheduled: { label: 'در انتظار', color: 'bg-muted text-muted-foreground' },
  confirmed: { label: 'تایید شده', color: 'bg-primary/20 text-primary' },
  completed: { label: 'انجام شده', color: 'bg-green-100 text-green-700' },
  cancelled: { label: 'لغو شده', color: 'bg-destructive/20 text-destructive' },
  'no-show': { label: 'غیبت', color: 'bg-orange-100 text-orange-700' },
} as const
