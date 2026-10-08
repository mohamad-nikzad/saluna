import type { User } from '@emdash-cms/auth'
import type { EmDashHandlers } from 'emdash/astro'

declare global {
  namespace App {
    interface Locals {
      emdash: EmDashHandlers
      user?: User
      publicContentRewrite?: { section: 'blog' | 'guides'; slug: string }
    }
  }
}
