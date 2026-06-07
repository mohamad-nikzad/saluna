import { z } from '@hono/zod-openapi'
import { applyCatalogPresetBodySchema } from '@repo/salon-core/forms/catalog-preset'
import {
  comboComponentsUpdateSchema,
  serviceAddonCreateSchema,
  serviceAddonUpdateSchema,
  serviceCategoryCreateSchema,
  serviceCategoryUpdateSchema,
  serviceCreateSchema,
  serviceFamilyCreateSchema,
  serviceFamilyUpdateSchema,
  serviceUpdateSchema,
} from '@repo/salon-core/forms/service'

function bodyFromCoreSchema<T extends z.ZodType>(
  name: string,
  shape: z.ZodRawShape,
  coreSchema: T,
) {
  return z
    .object(shape)
    .openapi(name)
    .superRefine((data, ctx) => {
      const result = coreSchema.safeParse(data)
      if (!result.success) {
        for (const issue of result.error.issues) {
          ctx.addIssue({
            code: 'custom',
            message: issue.message,
            path: issue.path,
          })
        }
      }
    })
    .transform((data) => coreSchema.parse(data))
}

const isoDateTimeSchema = z.string().datetime().or(z.string())

export const includeInactiveQuerySchema = z
  .object({
    all: z.string().optional().openapi({
      param: { name: 'all', in: 'query' },
      example: '1',
      description:
        'When set to "1" and the caller is a manager, inactive catalog rows are included',
    }),
  })
  .openapi('IncludeInactiveQuery')

export const serviceKindSchema = z
  .enum(['standard', 'combo'])
  .openapi('ServiceKind')

export const legacyServiceCategoryKeySchema = z
  .enum(['hair', 'nails', 'skincare', 'spa'])
  .openapi('LegacyServiceCategoryKey')

export const serviceSchema = z
  .object({
    id: z.string(),
    name: z.string(),
    category: legacyServiceCategoryKeySchema,
    categoryId: z.string(),
    categoryName: z.string().nullable().optional(),
    familyId: z.string().nullable(),
    familyName: z.string().nullable().optional(),
    duration: z.number().int(),
    price: z.number(),
    color: z.string(),
    active: z.boolean(),
    description: z.string().nullable().optional(),
    kind: serviceKindSchema.optional(),
  })
  .passthrough()
  .openapi('Service')

export const serviceCategorySchema = z
  .object({
    id: z.string(),
    name: z.string(),
    active: z.boolean(),
    createdAt: isoDateTimeSchema,
    updatedAt: isoDateTimeSchema,
  })
  .passthrough()
  .openapi('ServiceCategory')

export const serviceFamilySchema = z
  .object({
    id: z.string(),
    categoryId: z.string(),
    categoryName: z.string().nullable().optional(),
    name: z.string(),
    active: z.boolean(),
    createdAt: isoDateTimeSchema,
    updatedAt: isoDateTimeSchema,
  })
  .passthrough()
  .openapi('ServiceFamily')

export const serviceAddonScopeSchema = z
  .discriminatedUnion('type', [
    z.object({
      type: z.literal('category'),
      categoryId: z.string(),
      categoryName: z.string(),
      active: z.boolean(),
    }),
    z.object({
      type: z.literal('family'),
      familyId: z.string(),
      familyName: z.string(),
      categoryId: z.string(),
      active: z.boolean(),
    }),
    z.object({
      type: z.literal('service'),
      serviceId: z.string(),
      serviceName: z.string(),
      familyId: z.string().nullable(),
      active: z.boolean(),
    }),
  ])
  .openapi('ServiceAddonScope')

export const serviceAddonSchema = z
  .object({
    id: z.string(),
    salonId: z.string(),
    name: z.string(),
    priceDelta: z.number(),
    durationDelta: z.number(),
    active: z.boolean(),
    sortOrder: z.number().int(),
    description: z.string().nullable().optional(),
    color: z.string().nullable().optional(),
    scopes: z.array(serviceAddonScopeSchema),
    createdAt: isoDateTimeSchema,
    updatedAt: isoDateTimeSchema,
  })
  .passthrough()
  .openapi('ServiceAddon')

export const comboComponentSchema = z
  .object({
    id: z.string(),
    salonId: z.string(),
    comboServiceId: z.string(),
    componentServiceId: z.string(),
    sortOrder: z.number().int(),
    service: serviceSchema,
    createdAt: isoDateTimeSchema,
    updatedAt: isoDateTimeSchema,
  })
  .passthrough()
  .openapi('ComboComponent')

export const comboComponentsSummarySchema = z
  .object({
    comboServiceId: z.string(),
    components: z.array(comboComponentSchema),
    totalDuration: z.number().int(),
    totalPrice: z.number(),
  })
  .openapi('ComboComponentsSummary')

export const serviceCreateBodySchema = bodyFromCoreSchema(
  'ServiceCreateRequest',
  {
    name: z.string().openapi({ example: 'رنگ مو' }),
    categoryId: z.string().openapi({ example: 'cat-1' }),
    familyId: z.string().nullable().optional(),
    category: legacyServiceCategoryKeySchema.optional(),
    duration: z.number().int().openapi({ example: 90 }),
    price: z.number().openapi({ example: 450000 }),
    color: z.string().optional(),
    active: z.boolean().optional(),
    description: z.string().optional(),
    kind: serviceKindSchema.optional(),
    id: z.string().optional(),
  },
  serviceCreateSchema,
)

export const serviceUpdateBodySchema = bodyFromCoreSchema(
  'ServiceUpdateRequest',
  {
    name: z.string().optional(),
    categoryId: z.string().optional(),
    familyId: z.string().nullable().optional(),
    duration: z.number().int().optional(),
    price: z.number().optional(),
    color: z.string().optional(),
    active: z.boolean().optional(),
    description: z.string().optional(),
    kind: serviceKindSchema.optional(),
  },
  serviceUpdateSchema,
)

export const serviceCategoryCreateBodySchema = bodyFromCoreSchema(
  'ServiceCategoryCreateRequest',
  {
    name: z.string().openapi({ example: 'مو' }),
    active: z.boolean().optional(),
    id: z.string().optional(),
  },
  serviceCategoryCreateSchema,
)

export const serviceCategoryUpdateBodySchema = bodyFromCoreSchema(
  'ServiceCategoryUpdateRequest',
  {
    name: z.string().optional(),
    active: z.boolean().optional(),
  },
  serviceCategoryUpdateSchema,
)

export const serviceFamilyCreateBodySchema = bodyFromCoreSchema(
  'ServiceFamilyCreateRequest',
  {
    categoryId: z.string().openapi({ example: 'cat-1' }),
    name: z.string().openapi({ example: 'رنگ و لایت' }),
    active: z.boolean().optional(),
    id: z.string().optional(),
  },
  serviceFamilyCreateSchema,
)

export const serviceFamilyUpdateBodySchema = bodyFromCoreSchema(
  'ServiceFamilyUpdateRequest',
  {
    categoryId: z.string().optional(),
    name: z.string().optional(),
    active: z.boolean().optional(),
  },
  serviceFamilyUpdateSchema,
)

const serviceAddonScopeInputOpenApiSchema = z
  .discriminatedUnion('type', [
    z.object({
      type: z.literal('category'),
      categoryId: z.string(),
    }),
    z.object({
      type: z.literal('family'),
      familyId: z.string(),
    }),
    z.object({
      type: z.literal('service'),
      serviceId: z.string(),
    }),
  ])
  .openapi('ServiceAddonScopeInput')

export const serviceAddonCreateBodySchema = bodyFromCoreSchema(
  'ServiceAddonCreateRequest',
  {
    name: z.string().openapi({ example: 'طراحی ناخن' }),
    priceDelta: z.number().optional(),
    durationDelta: z.number().optional(),
    active: z.boolean().optional(),
    sortOrder: z.number().int().optional(),
    description: z.string().optional(),
    color: z.string().nullable().optional(),
    scopes: z.array(serviceAddonScopeInputOpenApiSchema).optional(),
    id: z.string().optional(),
  },
  serviceAddonCreateSchema,
)

export const serviceAddonUpdateBodySchema = bodyFromCoreSchema(
  'ServiceAddonUpdateRequest',
  {
    name: z.string().optional(),
    priceDelta: z.number().optional(),
    durationDelta: z.number().optional(),
    active: z.boolean().optional(),
    sortOrder: z.number().int().optional(),
    description: z.string().optional(),
    color: z.string().nullable().optional(),
    scopes: z.array(serviceAddonScopeInputOpenApiSchema).optional(),
  },
  serviceAddonUpdateSchema,
)

export const comboComponentsUpdateBodySchema = bodyFromCoreSchema(
  'ComboComponentsUpdateRequest',
  {
    componentServiceIds: z.array(z.string()).openapi({
      example: ['svc-1', 'svc-2'],
    }),
  },
  comboComponentsUpdateSchema,
)

export const servicesListResponseSchema = z
  .object({
    services: z.array(serviceSchema),
  })
  .openapi('ServicesListResponse')

export const serviceResponseSchema = z
  .object({
    service: serviceSchema,
  })
  .openapi('ServiceResponse')

export const serviceCategoriesListResponseSchema = z
  .object({
    categories: z.array(serviceCategorySchema),
  })
  .openapi('ServiceCategoriesListResponse')

export const serviceCategoryResponseSchema = z
  .object({
    category: serviceCategorySchema,
  })
  .openapi('ServiceCategoryResponse')

export const serviceFamiliesListResponseSchema = z
  .object({
    families: z.array(serviceFamilySchema),
  })
  .openapi('ServiceFamiliesListResponse')

export const serviceFamilyResponseSchema = z
  .object({
    family: serviceFamilySchema,
  })
  .openapi('ServiceFamilyResponse')

export const serviceAddonsListResponseSchema = z
  .object({
    addons: z.array(serviceAddonSchema),
  })
  .openapi('ServiceAddonsListResponse')

export const serviceAddonResponseSchema = z
  .object({
    addon: serviceAddonSchema,
  })
  .openapi('ServiceAddonResponse')

export const comboComponentsResponseSchema = z
  .object({
    combo: comboComponentsSummarySchema,
  })
  .openapi('ComboComponentsResponse')

export const importStarterTemplatesResponseSchema = z
  .object({
    categories: z.array(serviceCategorySchema),
    families: z.array(serviceFamilySchema),
    services: z.array(serviceSchema),
  })
  .openapi('ImportStarterTemplatesResponse')

export const catalogPresetTreeSchema = z
  .array(
    z
      .object({
        name: z.string(),
        families: z.array(
          z.object({
            name: z.string(),
            variants: z.array(
              z.object({
                name: z.string(),
                duration: z.number().int(),
                price: z.number(),
                color: z.string(),
                description: z.string().optional(),
              }),
            ),
          }),
        ),
      }),
  )
  .openapi('CatalogPresetTree')

export const catalogPresetListItemSchema = z
  .object({
    id: z.string(),
    slug: z.string(),
    name: z.string(),
    description: z.string().nullable(),
    tree: catalogPresetTreeSchema,
    sortOrder: z.number().int(),
    disabled: z.boolean(),
    disabledReason: z.enum(['collision']).nullable(),
  })
  .openapi('CatalogPresetListItem')

export const catalogPresetsListResponseSchema = z
  .object({
    presets: z.array(catalogPresetListItemSchema),
  })
  .openapi('CatalogPresetsListResponse')

export const applyCatalogPresetBodySchemaOpenApi = bodyFromCoreSchema(
  'ApplyCatalogPresetRequest',
  {
    selection: z
      .array(
        z.object({
          categoryIndex: z.number().int().nonnegative(),
          families: z
            .array(
              z.object({
                familyIndex: z.number().int().nonnegative(),
                variantIndices: z
                  .array(z.number().int().nonnegative())
                  .min(1),
              }),
            )
            .min(1),
        }),
      )
      .min(1),
  },
  applyCatalogPresetBodySchema,
)

export const applyCatalogPresetResponseSchema = z
  .object({
    importedCategoryIds: z.array(z.string()),
    importedVariantIds: z.array(z.string()),
  })
  .openapi('ApplyCatalogPresetResponse')
