import { Outlet, createFileRoute } from '@tanstack/react-router'

export const Route = createFileRoute('/_admin/salons')({
  component: SalonsRoute,
})

function SalonsRoute() {
  return <Outlet />
}
