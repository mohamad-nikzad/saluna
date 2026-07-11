import { OpenAPIHono, type RouteHandler } from '@hono/zod-openapi'
import {
  createClient,
  createClientFollowUp,
  createClientsBulk,
  getAllClients,
  getClientById,
  getClientSummary,
  getClientTags,
  isClientProvidedEntityId,
  isDuplicatePhoneError,
  setClientTags,
  updateClient,
} from '@repo/database/clients'
import type { FollowUpReason } from '@repo/salon-core/types'
import type { AppEnv } from '../factory'
import {
  bulkCreateClientsRoute,
  createClientFollowUpRoute,
  createClientRoute,
  getClientRoute,
  getClientSummaryRoute,
  listClientsRoute,
  updateClientRoute,
} from '../openapi/routes/clients'
import { jsonSerialized } from '../openapi/serialize-dates'

const allowedReasons = new Set<FollowUpReason>([
  'inactive',
  'no-show',
  'new-client',
  'vip',
  'manual',
])

function validationErrorHook(
  result: { success: boolean; error?: { issues: Array<{ message?: string }> } },
  c: { json: (body: { error: string }, status: 400) => Response },
) {
  if (!result.success) {
    return c.json(
      { error: result.error?.issues[0]?.message ?? 'داده نامعتبر' },
      400,
    )
  }
}

const listClientsHandler: RouteHandler<
  typeof listClientsRoute,
  AppEnv
> = async (c) => {
  const { salonId } = c.var.tenant
  const list = await getAllClients(salonId)
  return c.json({ clients: jsonSerialized(list) }, 200)
}

const createClientHandler: RouteHandler<
  typeof createClientRoute,
  AppEnv
> = async (c) => {
  const { salonId } = c.var.tenant
  const { name, phone, notes, tags, id: requestedId } = c.req.valid('json')
  try {
    const client = await createClient({
      name,
      phone,
      notes,
      salonId,
      ...(isClientProvidedEntityId(requestedId) ? { id: requestedId } : {}),
    })
    const savedTags = await setClientTags(client.id, salonId, tags)
    return c.json(
      { client: jsonSerialized({ ...client, tags: savedTags }) },
      200,
    )
  } catch (err) {
    if (isDuplicatePhoneError(err)) {
      return c.json(
        {
          error: 'این شماره تماس برای این سالن قبلاً ثبت شده است',
          code: 'duplicate-phone',
        },
        409,
      )
    }
    throw err
  }
}

const getClientHandler: RouteHandler<typeof getClientRoute, AppEnv> = async (
  c,
) => {
  const { salonId } = c.var.tenant
  const { id } = c.req.valid('param')
  const client = await getClientById(id, salonId)
  if (!client) return c.json({ error: 'مشتری یافت نشد' }, 404)
  const tags = await getClientTags(id, salonId)
  return c.json({ client: jsonSerialized({ ...client, tags }) }, 200)
}

const updateClientHandler: RouteHandler<
  typeof updateClientRoute,
  AppEnv
> = async (c) => {
  const { salonId } = c.var.tenant
  const { id } = c.req.valid('param')
  const { name, phone, notes, tags } = c.req.valid('json')
  try {
    const client = await updateClient(id, salonId, { name, phone, notes })
    if (!client) return c.json({ error: 'مشتری یافت نشد' }, 404)
    const savedTags = Array.isArray(tags)
      ? await setClientTags(id, salonId, tags)
      : await getClientTags(id, salonId)
    return c.json(
      { client: jsonSerialized({ ...client, tags: savedTags }) },
      200,
    )
  } catch (err) {
    if (isDuplicatePhoneError(err)) {
      return c.json(
        {
          error: 'این شماره تماس برای این سالن قبلاً ثبت شده است',
          code: 'duplicate-phone',
        },
        409,
      )
    }
    throw err
  }
}

const getClientSummaryHandler: RouteHandler<
  typeof getClientSummaryRoute,
  AppEnv
> = async (c) => {
  const { salonId } = c.var.tenant
  const { id } = c.req.valid('param')
  const summary = await getClientSummary(salonId, id)
  if (!summary) return c.json({ error: 'مشتری یافت نشد' }, 404)
  return c.json(jsonSerialized(summary), 200)
}

const bulkCreateClientsHandler: RouteHandler<
  typeof bulkCreateClientsRoute,
  AppEnv
> = async (c) => {
  const { salonId } = c.var.tenant
  const { clients: clientRows } = c.req.valid('json')
  const result = await createClientsBulk(salonId, clientRows)
  return c.json(jsonSerialized(result), 200)
}

const createClientFollowUpHandler: RouteHandler<
  typeof createClientFollowUpRoute,
  AppEnv
> = async (c) => {
  const { salonId } = c.var.tenant
  const { id } = c.req.valid('param')
  const client = await getClientById(id, salonId)
  if (!client) return c.json({ error: 'مشتری یافت نشد' }, 404)
  const body = c.req.valid('json')
  const reason: FollowUpReason = allowedReasons.has(
    body.reason as FollowUpReason,
  )
    ? (body.reason as FollowUpReason)
    : 'manual'
  const followUp = await createClientFollowUp(salonId, id, reason, body.dueDate)
  return c.json({ followUp: jsonSerialized(followUp) }, 200)
}

export const clients = new OpenAPIHono<AppEnv>({
  defaultHook: validationErrorHook,
})
  .openapi(listClientsRoute, listClientsHandler)
  .openapi(createClientRoute, createClientHandler)
  .openapi(bulkCreateClientsRoute, bulkCreateClientsHandler)
  .openapi(getClientRoute, getClientHandler)
  .openapi(updateClientRoute, updateClientHandler)
  .openapi(getClientSummaryRoute, getClientSummaryHandler)
  .openapi(createClientFollowUpRoute, createClientFollowUpHandler)

export type ClientsRoute = typeof clients
