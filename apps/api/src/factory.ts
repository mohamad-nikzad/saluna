import { createFactory } from 'hono/factory'
import type { TenantUser } from '@repo/auth/tenant'
import type { PlatformAdminUser } from '@repo/auth/platform'

export type AppEnv = {
  Variables: {
    tenant: TenantUser
    platformAdmin: PlatformAdminUser
    requestId: string
  }
}

export const factory = createFactory<AppEnv>()
