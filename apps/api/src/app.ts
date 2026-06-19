import { Hono } from 'hono'
import type { MiddlewareHandler } from 'hono'
import { cors } from 'hono/cors'
import { logger } from 'hono/logger'
import { requestId } from 'hono/request-id'
import { secureHeaders } from 'hono/secure-headers'
import { bodyLimit } from 'hono/body-limit'
import type { AppEnv } from './factory'
import { getEnv } from './env'
import { errorHandler, notFoundHandler } from './middleware/error'
import { requireTenant } from './middleware/auth'
import { health } from './routes/health'
import { clients } from './routes/clients'
import { catalogPresets } from './routes/catalog-presets'
import { serviceCategories } from './routes/service-categories'
import { serviceFamilies } from './routes/service-families'
import { serviceAddons } from './routes/service-addons'
import { services } from './routes/services'
import { staff } from './routes/staff'
import { settings } from './routes/settings'
import { salonProfile } from './routes/salon-profile'
import { salonPublicSettings } from './routes/salon-public-settings'
import { notificationPreferences } from './routes/notification-preferences'
import { onboarding } from './routes/onboarding'
import { retention } from './routes/retention'
import { dashboard } from './routes/dashboard'
import { today } from './routes/today'
import { notifications } from './routes/notifications'
import { push } from './routes/push'
import { appointments } from './routes/appointments'
import { authRoute } from './routes/auth'
import { auth as authServer } from '@repo/auth/server'
import { publicRoutes } from './routes/public'
import { appointmentRequestsRoute } from './routes/appointment-requests'
import { messagingRoute } from './routes/messaging'
import { messagingBaleRoute } from './routes/messaging-bale'
import { messagingTelegramRoute } from './routes/messaging-telegram'
import { adminRoute } from './routes/admin'
const env = getEnv()

const corsOrigins = env.CORS_ORIGINS
const corsOrigin: string | ((origin: string) => string | null) =
  corsOrigins.length === 1 && corsOrigins[0] === '*'
    ? '*'
    : (origin: string) => (corsOrigins.includes(origin) ? origin : null)

const loggerDisabled =
  env.NODE_ENV === 'test' || process.env.DISABLE_REQUEST_LOG === '1'
const conditionalLogger: MiddlewareHandler = loggerDisabled
  ? async (_c, next) => next()
  : logger()

const app = new Hono<AppEnv>()
  .use(requestId())
  .use(conditionalLogger)
  .use(secureHeaders())
  .use(
    cors({
      origin: corsOrigin,
      credentials: true,
      allowMethods: ['GET', 'POST', 'PUT', 'PATCH', 'DELETE', 'OPTIONS'],
      allowHeaders: ['Content-Type', 'Authorization', 'Accept'],
      maxAge: 86400,
    }),
  )
  .use(bodyLimit({ maxSize: 2 * 1024 * 1024 }))
  // Our `/api/v1/auth/signup` wrapper is matched first; everything else under
  // `/api/v1/auth/*` (sign-in, sign-out, get-session, …) falls through to the
  // Better Auth handler below.
  .route('/api/v1/auth', authRoute)
  .on(['GET', 'POST'], '/api/v1/auth/*', (c) => authServer.handler(c.req.raw))
  .route('/health', health)
  .route('/api/v1/admin', adminRoute)
  .use('/api/v1/clients', requireTenant('manage_clients'))
  .use('/api/v1/clients/*', requireTenant('manage_clients'))
  .route('/api/v1/clients', clients)
  .route('/api/v1/catalog-presets', catalogPresets)
  .route('/api/v1/service-categories', serviceCategories)
  .route('/api/v1/service-families', serviceFamilies)
  .route('/api/v1/service-addons', serviceAddons)
  .route('/api/v1/services', services)
  .route('/api/v1/staff', staff)
  .route('/api/v1/settings', settings)
  .route('/api/v1/salon-profile', salonProfile)
  .route('/api/v1/salon-public-settings', salonPublicSettings)
  .route('/api/v1/notification-preferences', notificationPreferences)
  .route('/api/v1/onboarding', onboarding)
  .route('/api/v1/retention', retention)
  .route('/api/v1/dashboard', dashboard)
  .route('/api/v1/today', today)
  .route('/api/v1/notifications', notifications)
  .route('/api/v1/push', push)
  .route('/api/v1/appointments', appointments)
  .route('/api/v1/public', publicRoutes)
  .route('/api/v1/appointment-requests', appointmentRequestsRoute)
  .route('/api/v1/messaging/bale', messagingBaleRoute)
  .route('/api/v1/messaging/telegram', messagingTelegramRoute)
  .route('/api/v1/messaging', messagingRoute)
  .onError(errorHandler)
  .notFound(notFoundHandler)

export type AppType = typeof app
export { app }
