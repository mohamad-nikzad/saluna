# @repo/api-contract

Generated OpenAPI contract for the Saluna API. Edit Hono route definitions in
`apps/api/src/openapi/`, then regenerate `openapi.json`.

## Generation

Run from the repo root, in this order:

```bash
pnpm generate:api-contract
pnpm generate:api-client
```

The first command writes `packages/api-contract/openapi.json`. The second
generates the SDK, types, and TanStack Query options in `packages/api-client`.

## Coverage

The contract includes admin, Support Tickets, Clients, staff, the service
catalog, Appointments, AppointmentRequests, settings, Salon Presence, onboarding,
reporting, retention, messaging, notifications, and public booking.

Better Auth passthrough remains in the manual auth client. See
[API client usage](../api-client/README.md).

[contract-app.ts](../../apps/api/src/openapi/contract-app.ts) registers the
documented routes. Register new routes there as well as in the runtime app.
