import {
  appointmentIntervalsConflict,
  SCHEDULE_CONFLICT_CODES,
} from '@repo/salon-core/appointment-conflict'
import {
  durationMinutesFromRange,
  validateAppointmentWindow,
} from '@repo/salon-core/appointment-time'
import type {
  Appointment,
  ServicePackage,
  ServicePackageBooking,
  ServicePackageBookingTask,
  ServicePackageComponent,
} from '@repo/salon-core/types'
import { getDb } from '../client'
import {
  appointments,
  servicePackageBookings,
  servicePackageTasks,
} from '../schema'
import { rowToAppointment } from './row-mappers'
import { getClientById } from './client-queries'
import { getScheduleOverlapFlags } from './appointment-queries'
import {
  checkStaffAvailabilityForAppointment,
  getAllStaff,
  staffMayPerformService,
} from './staff-queries'
import { getServicePackageById } from './service-package-queries'

type PackageBookingTaskInput = {
  packageComponentId: string
  staffId: string
  startTime: string
  endTime: string
  addonIds?: unknown
}

type CreateServicePackageBookingInput = {
  salonId: string
  packageId: string
  clientId: string
  date: string
  tasks: PackageBookingTaskInput[]
  notes?: string | null
  createdByUserId?: string | null
}

type ResolvedTask = {
  component: ServicePackageComponent
  staffId: string
  startTime: string
  endTime: string
  sortOrder: number
}

function rowToServicePackageBooking(
  row: typeof servicePackageBookings.$inferSelect,
  tasks: ServicePackageBookingTask[],
): ServicePackageBooking {
  return {
    id: row.id,
    salonId: row.salonId,
    packageId: row.packageId,
    clientId: row.clientId,
    leadStaffId: row.leadStaffId,
    date: row.date,
    bookedPackageName: row.bookedPackageName,
    bookedPackagePrice: row.bookedPackagePrice,
    status: row.status,
    notes: row.notes,
    createdByUserId: row.createdByUserId,
    tasks,
    createdAt: row.createdAt,
    updatedAt: row.updatedAt,
  }
}

function rowToServicePackageTask(
  row: typeof servicePackageTasks.$inferSelect,
  appointment: Appointment,
): ServicePackageBookingTask {
  return {
    id: row.id,
    salonId: row.salonId,
    packageBookingId: row.packageBookingId,
    packageComponentId: row.packageComponentId,
    serviceId: row.serviceId,
    appointmentId: row.appointmentId,
    staffId: row.staffId,
    startTime: row.startTime,
    endTime: row.endTime,
    sortOrder: row.sortOrder,
    appointment,
    createdAt: row.createdAt,
    updatedAt: row.updatedAt,
  }
}

function resolveRequestedTasks(
  servicePackage: ServicePackage,
  requestedTasks: PackageBookingTaskInput[],
): ResolvedTask[] {
  const components = [...servicePackage.components].sort(
    (a, b) => a.sortOrder - b.sortOrder,
  )
  if (components.length === 0) {
    throw new Error('service package booking package has no components')
  }
  if (requestedTasks.length !== components.length) {
    throw new Error(
      'service package booking tasks must match package components',
    )
  }

  const byComponentId = new Map(
    components.map((component) => [component.id, component]),
  )
  const seen = new Set<string>()

  return requestedTasks.map((task, index) => {
    if (task.addonIds !== undefined) {
      throw new Error('service package booking add-ons are not supported')
    }

    if (!task.packageComponentId) {
      throw new Error(
        'service package booking task must identify one component',
      )
    }

    const component = byComponentId.get(task.packageComponentId)
    if (!component) {
      throw new Error('service package booking task component not found')
    }
    if (seen.has(component.id)) {
      throw new Error('service package booking task component duplicate')
    }
    seen.add(component.id)

    const windowCheck = validateAppointmentWindow(task.startTime, task.endTime)
    if (!windowCheck.ok) throw new Error(windowCheck.error)

    return {
      component,
      staffId: task.staffId,
      startTime: task.startTime,
      endTime: task.endTime,
      sortOrder: index,
    }
  })
}

function validatePackageComponentsStillBookable(
  servicePackage: ServicePackage,
) {
  for (const component of servicePackage.components) {
    if (!component.service.active) {
      throw new Error('service package booking component service inactive')
    }
    if ((component.service.kind ?? 'standard') !== 'standard') {
      throw new Error('service package booking component service invalid')
    }
  }
}

function validateInternalStaffConflicts(date: string, tasks: ResolvedTask[]) {
  for (let i = 0; i < tasks.length; i += 1) {
    for (let j = i + 1; j < tasks.length; j += 1) {
      const a = tasks[i]!
      const b = tasks[j]!
      if (a.staffId !== b.staffId) continue
      if (
        appointmentIntervalsConflict(
          a.startTime,
          a.endTime,
          b.startTime,
          b.endTime,
        )
      ) {
        throw new Error(
          `service package booking internal staff conflict:${date}`,
        )
      }
    }
  }
}

async function validateSchedule(input: {
  salonId: string
  clientId: string
  date: string
  task: ResolvedTask
}) {
  const availability = await checkStaffAvailabilityForAppointment(
    input.salonId,
    input.task.staffId,
    input.date,
    input.task.startTime,
    input.task.endTime,
  )
  if (!availability.ok) {
    throw new Error(
      `service package booking staff unavailable:${availability.error}`,
    )
  }

  const overlaps = await getScheduleOverlapFlags(
    input.salonId,
    input.task.staffId,
    input.clientId,
    input.date,
    input.task.startTime,
    input.task.endTime,
  )
  if (overlaps.staffConflict) {
    throw new Error(
      `service package booking staff conflict:${SCHEDULE_CONFLICT_CODES.STAFF_OVERLAP}`,
    )
  }
  if (overlaps.clientConflict) {
    throw new Error(
      `service package booking client conflict:${SCHEDULE_CONFLICT_CODES.CLIENT_OVERLAP}`,
    )
  }
}

export async function createServicePackageBooking(
  input: CreateServicePackageBookingInput,
): Promise<ServicePackageBooking> {
  const servicePackage = await getServicePackageById(
    input.packageId,
    input.salonId,
  )
  if (!servicePackage) throw new Error('service package not found')
  if (!servicePackage.active) {
    throw new Error('service package booking package inactive')
  }
  validatePackageComponentsStillBookable(servicePackage)

  const client = await getClientById(input.clientId, input.salonId)
  if (!client) throw new Error('service package booking client not found')

  const tasks = resolveRequestedTasks(servicePackage, input.tasks)
  validateInternalStaffConflicts(input.date, tasks)

  const staffById = new Map(
    (await getAllStaff(input.salonId))
      .filter((staff) => staff.role === 'staff')
      .map((staff) => [staff.id, staff]),
  )

  for (const task of tasks) {
    const staff = staffById.get(task.staffId)
    if (!staff || staff.salonId !== input.salonId) {
      throw new Error('service package booking staff not found')
    }
    if (
      !(await staffMayPerformService(
        task.staffId,
        task.component.serviceId,
        input.salonId,
      ))
    ) {
      throw new Error('service package booking staff cannot perform service')
    }
    await validateSchedule({
      salonId: input.salonId,
      clientId: input.clientId,
      date: input.date,
      task,
    })
  }

  const db = getDb()
  const { bookingRow, appointmentRows, taskRows } = await db.transaction(
    async (tx) => {
      const [createdBooking] = await tx
        .insert(servicePackageBookings)
        .values({
          salonId: input.salonId,
          packageId: servicePackage.id,
          clientId: input.clientId,
          leadStaffId: tasks[0]!.staffId,
          date: input.date,
          bookedPackageName: servicePackage.name,
          bookedPackagePrice: servicePackage.resolvedPrice,
          status: 'scheduled',
          notes: input.notes ?? null,
          createdByUserId: input.createdByUserId ?? null,
        })
        .returning()

      const createdAppointments = await tx
        .insert(appointments)
        .values(
          tasks.map((task) => {
            const service = task.component.service
            const bookedTotalDuration = durationMinutesFromRange(
              task.startTime,
              task.endTime,
            )
            return {
              salonId: input.salonId,
              clientId: input.clientId,
              staffId: task.staffId,
              serviceId: task.component.serviceId,
              date: input.date,
              startTime: task.startTime,
              endTime: task.endTime,
              bookedServiceName: service.name,
              bookedServiceDuration: service.duration,
              bookedServicePrice: service.price,
              bookedTotalDuration,
              bookedTotalPrice: service.price,
              status: 'scheduled' as const,
              notes: input.notes ?? null,
              createdByUserId: input.createdByUserId ?? null,
            }
          }),
        )
        .returning()

      const createdTasks = await tx
        .insert(servicePackageTasks)
        .values(
          tasks.map((task, index) => ({
            salonId: input.salonId,
            packageBookingId: createdBooking!.id,
            packageComponentId: task.component.id,
            serviceId: task.component.serviceId,
            appointmentId: createdAppointments[index]!.id,
            staffId: task.staffId,
            startTime: task.startTime,
            endTime: task.endTime,
            sortOrder: task.sortOrder,
          })),
        )
        .returning()

      return {
        bookingRow: createdBooking!,
        appointmentRows: createdAppointments,
        taskRows: createdTasks,
      }
    },
  )

  const appointmentById = new Map(
    appointmentRows.map((row) => [row.id, rowToAppointment(row)]),
  )
  const bookedTasks = taskRows.map((row) =>
    rowToServicePackageTask(row, appointmentById.get(row.appointmentId)!),
  )
  return rowToServicePackageBooking(bookingRow, bookedTasks)
}
