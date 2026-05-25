import { createNextConfig } from '@repo/next-config'

export default {
  ...createNextConfig({
    transpilePackages: ['@repo/salon-core'],
  }),
  allowedDevOrigins: ['192.168.1.3', '192.168.1.21'],
}
