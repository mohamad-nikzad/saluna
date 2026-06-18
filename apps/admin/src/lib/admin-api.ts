import type {
  AdminAuditLogResponse,
  AdminCatalogPresetCreateRequest,
  AdminCatalogPresetUpdateRequest,
  AdminCatalogPresetsResponse,
  AdminMeResponse,
  AdminMessagingHealthResponse,
  AdminNotesResponse,
  AdminOverviewResponse,
  AdminPlatformAdminCreateRequest,
  AdminPlatformAdminUpdateRequest,
  AdminPlatformAdminsResponse,
  AdminSalonDetailResponse,
  AdminSalonStatus,
  AdminSalonsResponse,
  AdminSupportAppointmentRequestsResponse,
  AdminSupportAppointmentsResponse,
  AdminUserDetailResponse,
  AdminUsersResponse,
} from '@repo/api-client/types'

export class AdminApiError extends Error {
  constructor(
    message: string,
    readonly status: number,
  ) {
    super(message)
    this.name = 'AdminApiError'
  }
}

type ListParams = {
  page?: number
  pageSize?: number
  search?: string
}

type AuditParams = ListParams & {
  action?: string
  targetType?: string
  targetId?: string
  salonId?: string
}

function withQuery(
  path: string,
  params: Record<string, string | number | undefined>,
) {
  const query = new URLSearchParams()
  for (const [key, value] of Object.entries(params)) {
    if (value !== undefined && value !== '') query.set(key, String(value))
  }
  const serialized = query.toString()
  return serialized ? `${path}?${serialized}` : path
}

async function apiJson<T>(path: string, init?: RequestInit): Promise<T> {
  const response = await fetch(path, {
    ...init,
    credentials: 'include',
    headers: {
      ...(init?.body ? { 'Content-Type': 'application/json' } : {}),
      ...init?.headers,
    },
  })

  if (!response.ok) {
    const fallback =
      response.status === 401 ? 'ورود لازم است' : 'درخواست ادمین انجام نشد'
    let message = fallback
    try {
      const body = (await response.json()) as { error?: string }
      message = body.error ?? fallback
    } catch {
      message = response.statusText || fallback
    }
    throw new AdminApiError(message, response.status)
  }

  return response.json() as Promise<T>
}

function body(input: unknown): RequestInit {
  return {
    body: JSON.stringify(input),
  }
}

export const adminApi = {
  me: () => apiJson<AdminMeResponse>('/api/v1/admin/auth/me'),
  overview: () => apiJson<AdminOverviewResponse>('/api/v1/admin/overview'),
  salons: (params: ListParams) =>
    apiJson<AdminSalonsResponse>(withQuery('/api/v1/admin/salons', params)),
  salon: (id: string) =>
    apiJson<AdminSalonDetailResponse>(`/api/v1/admin/salons/${id}`),
  updateSalonStatus: (
    id: string,
    input: {
      status: AdminSalonStatus
      reason: string
      liveConfirmation?: string
    },
  ) =>
    apiJson<AdminSalonDetailResponse>(`/api/v1/admin/salons/${id}/status`, {
      method: 'PATCH',
      ...body(input),
    }),
  salonNotes: (id: string) =>
    apiJson<AdminNotesResponse>(`/api/v1/admin/salons/${id}/notes`),
  createSalonNote: (id: string, input: { body: string; reason: string }) =>
    apiJson(`/api/v1/admin/salons/${id}/notes`, {
      method: 'POST',
      ...body(input),
    }),
  users: (params: ListParams) =>
    apiJson<AdminUsersResponse>(withQuery('/api/v1/admin/users', params)),
  user: (id: string) =>
    apiJson<AdminUserDetailResponse>(`/api/v1/admin/users/${id}`),
  userNotes: (id: string) =>
    apiJson<AdminNotesResponse>(`/api/v1/admin/users/${id}/notes`),
  createUserNote: (id: string, input: { body: string; reason: string }) =>
    apiJson(`/api/v1/admin/users/${id}/notes`, {
      method: 'POST',
      ...body(input),
    }),
  catalogPresets: (params: ListParams) =>
    apiJson<AdminCatalogPresetsResponse>(
      withQuery('/api/v1/admin/catalog-presets', params),
    ),
  createCatalogPreset: (input: AdminCatalogPresetCreateRequest) =>
    apiJson('/api/v1/admin/catalog-presets', {
      method: 'POST',
      ...body(input),
    }),
  updateCatalogPreset: (id: string, input: AdminCatalogPresetUpdateRequest) =>
    apiJson(`/api/v1/admin/catalog-presets/${id}`, {
      method: 'PATCH',
      ...body(input),
    }),
  messagingHealth: () =>
    apiJson<AdminMessagingHealthResponse>('/api/v1/admin/messaging/health'),
  notificationDeliveries: (params: ListParams) =>
    apiJson<AdminCatalogPresetsResponse>(
      withQuery('/api/v1/admin/notifications/deliveries', params),
    ),
  supportAppointments: (params: ListParams) =>
    apiJson<AdminSupportAppointmentsResponse>(
      withQuery('/api/v1/admin/support/appointments', params),
    ),
  supportAppointmentRequests: (params: ListParams) =>
    apiJson<AdminSupportAppointmentRequestsResponse>(
      withQuery('/api/v1/admin/support/appointment-requests', params),
    ),
  auditLog: (params: AuditParams) =>
    apiJson<AdminAuditLogResponse>(
      withQuery('/api/v1/admin/audit-log', params),
    ),
  platformAdmins: (params: ListParams) =>
    apiJson<AdminPlatformAdminsResponse>(
      withQuery('/api/v1/admin/platform-admins', params),
    ),
  createPlatformAdmin: (input: AdminPlatformAdminCreateRequest) =>
    apiJson('/api/v1/admin/platform-admins', {
      method: 'POST',
      ...body(input),
    }),
  updatePlatformAdmin: (id: string, input: AdminPlatformAdminUpdateRequest) =>
    apiJson(`/api/v1/admin/platform-admins/${id}`, {
      method: 'PATCH',
      ...body(input),
    }),
}
