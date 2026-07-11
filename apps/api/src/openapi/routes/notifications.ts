import { createRoute } from '@hono/zod-openapi'
import {
  apiErrorSchema,
  idParamSchema,
  tenantSecurity,
} from '../schemas/common'
import {
  listNotificationsQuerySchema,
  markAllNotificationsReadResponseSchema,
  notificationResponseSchema,
  notificationsListResponseSchema,
} from '../schemas/notifications'

const unauthorizedResponse = {
  description: 'Missing or invalid session',
  content: { 'application/json': { schema: apiErrorSchema } },
} as const

const forbiddenResponse = {
  description: 'Authenticated but missing tenant context',
  content: { 'application/json': { schema: apiErrorSchema } },
} as const

const notFoundResponse = {
  description: 'Notification not found',
  content: { 'application/json': { schema: apiErrorSchema } },
} as const

export const listNotificationsRoute = createRoute({
  method: 'get',
  path: '/',
  tags: ['Notifications'],
  summary: 'List in-app notifications',
  security: tenantSecurity,
  request: {
    query: listNotificationsQuerySchema,
  },
  responses: {
    200: {
      description: 'Notifications for the authenticated user',
      content: {
        'application/json': { schema: notificationsListResponseSchema },
      },
    },
    401: unauthorizedResponse,
    403: forbiddenResponse,
  },
})

export const markAllNotificationsReadRoute = createRoute({
  method: 'post',
  path: '/read-all',
  tags: ['Notifications'],
  summary: 'Mark all notifications as read',
  security: tenantSecurity,
  responses: {
    200: {
      description: 'All notifications marked read',
      content: {
        'application/json': { schema: markAllNotificationsReadResponseSchema },
      },
    },
    401: unauthorizedResponse,
    403: forbiddenResponse,
  },
})

export const createNotificationTestRoute = createRoute({
  method: 'post',
  path: '/test',
  tags: ['Notifications'],
  summary: 'Create a test notification',
  description:
    'Development-only route. Returns 404 when ENABLE_NOTIFICATION_TEST is not set or in production.',
  security: tenantSecurity,
  responses: {
    200: {
      description: 'Created test notification',
      content: {
        'application/json': { schema: notificationResponseSchema },
      },
    },
    401: unauthorizedResponse,
    403: forbiddenResponse,
    404: notFoundResponse,
  },
})

export const markNotificationReadRoute = createRoute({
  method: 'post',
  path: '/{id}/read',
  tags: ['Notifications'],
  summary: 'Mark a notification as read',
  security: tenantSecurity,
  request: {
    params: idParamSchema,
  },
  responses: {
    200: {
      description: 'Updated notification',
      content: {
        'application/json': { schema: notificationResponseSchema },
      },
    },
    401: unauthorizedResponse,
    403: forbiddenResponse,
    404: notFoundResponse,
  },
})
