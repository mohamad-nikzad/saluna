import { describe, expect, it, vi } from 'vitest'

vi.mock('@tanstack/react-router', async (importOriginal) => ({
  ...(await importOriginal<typeof import('@tanstack/react-router')>()),
  createFileRoute:
    () =>
    (options: {
      beforeLoad: (input: { context: { user: { role: string } } }) => void
    }) =>
      options,
  redirect: (options: { to: string }) => options,
}))
vi.mock('#/components/appointments/appointment-list-page', () => ({
  AppointmentListPage: () => null,
}))

// Import the route's actual guard while replacing only the router registration.
const route = await import('#/routes/_authed/appointments')
const registration: unknown = route.Route
function enter(role: string) {
  if (
    typeof registration !== 'object' ||
    registration === null ||
    !('beforeLoad' in registration) ||
    typeof registration.beforeLoad !== 'function'
  ) {
    throw new Error('Missing appointment list guard')
  }
  registration.beforeLoad({ context: { user: { role } } })
}

describe('appointment list access', () => {
  it('allows managers', () => {
    expect(() => enter('manager')).not.toThrow()
  })
  it('redirects staff to Today', () => {
    expect(() => enter('staff')).toThrow(
      expect.objectContaining({ to: '/today' }),
    )
  })
})
