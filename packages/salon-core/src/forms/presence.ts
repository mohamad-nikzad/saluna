/**
 * Salon presence form schema — shared between web (`apps/pwa`) and the API.
 *
 * All fields are optional. Empty / nullish inputs collapse to `undefined`
 * (= "leave unset"). Validation enforces:
 *  - maps: HTTPS URLs from a known provider domain
 *    (`maps.app.goo.gl`, `neshan.org`, `balad.ir`)
 *  - socials: an `@handle` or a URL
 *  - WhatsApp: Iranian mobile phone shape (`09XXXXXXXXX`)
 *  - website: any HTTPS URL
 *
 * See Phase 3 of `ONBOARDING_REDESIGN_PLAN.md`.
 */
import { z } from 'zod'

import { formMessages } from './messages'
import { iranianMobilePhoneSchema } from './public'

/** Trim, collapse empty → undefined, otherwise validate with `inner`. */
function optionalWith<T extends z.ZodTypeAny>(inner: T) {
  return z
    .union([z.string(), z.null(), z.undefined()])
    .transform((value) => {
      if (value == null) return undefined
      const trimmed = value.trim()
      return trimmed.length > 0 ? trimmed : undefined
    })
    .pipe(inner.optional())
}

function parseHttpsUrl(value: string): URL | null {
  let url: URL
  try {
    url = new URL(value)
  } catch {
    return null
  }
  return url.protocol === 'https:' ? url : null
}

/** Any HTTPS URL. */
const httpsUrlSchema = z.string().superRefine((value, ctx) => {
  if (!parseHttpsUrl(value)) {
    ctx.addIssue({
      code: z.ZodIssueCode.custom,
      message: formMessages.urlMustBeHttps,
    })
  }
})

/** HTTPS URL whose host is (or is a subdomain of) one of the allowed domains. */
function mapUrlSchema(allowedDomain: string) {
  return z.string().superRefine((value, ctx) => {
    const url = parseHttpsUrl(value)
    if (!url) {
      ctx.addIssue({
        code: z.ZodIssueCode.custom,
        message: formMessages.urlMustBeHttps,
      })
      return
    }
    const host = url.hostname.toLowerCase()
    if (host !== allowedDomain && !host.endsWith(`.${allowedDomain}`)) {
      ctx.addIssue({
        code: z.ZodIssueCode.custom,
        message: formMessages.mapUrlInvalid,
      })
    }
  })
}

/** `@handle` or an HTTPS URL. */
const socialHandleSchema = z.string().superRefine((value, ctx) => {
  if (/^@[A-Za-z0-9_.]{1,64}$/.test(value)) return
  if (parseHttpsUrl(value)) return
  ctx.addIssue({
    code: z.ZodIssueCode.custom,
    message: formMessages.socialHandleInvalid,
  })
})

export const MAP_GOOGLE_DOMAIN = 'maps.app.goo.gl'
export const MAP_NESHAN_DOMAIN = 'neshan.org'
export const MAP_BALAD_DOMAIN = 'balad.ir'

export const presenceSchema = z.object({
  address: optionalWith(z.string()),
  mapGoogle: optionalWith(mapUrlSchema(MAP_GOOGLE_DOMAIN)),
  mapNeshan: optionalWith(mapUrlSchema(MAP_NESHAN_DOMAIN)),
  mapBalad: optionalWith(mapUrlSchema(MAP_BALAD_DOMAIN)),
  socialInstagram: optionalWith(socialHandleSchema),
  socialTelegram: optionalWith(socialHandleSchema),
  socialWhatsapp: optionalWith(iranianMobilePhoneSchema),
  website: optionalWith(httpsUrlSchema),
})

/** Partial PATCH — only keys present in the request body are validated and returned. */
export const presencePatchSchema = presenceSchema.partial()

export type PresenceInput = z.input<typeof presenceSchema>
export type PresencePayload = z.output<typeof presenceSchema>
export type PresencePatchInput = z.input<typeof presencePatchSchema>
export type PresencePatchPayload = z.output<typeof presencePatchSchema>

/** Nullable presence columns as returned by the API / database layer. */
export type SalonPresenceFields = {
  address?: string | null
  mapGoogle?: string | null
  mapNeshan?: string | null
  mapBalad?: string | null
  socialInstagram?: string | null
  socialTelegram?: string | null
  socialWhatsapp?: string | null
  website?: string | null
}

export const EMPTY_PRESENCE_INPUT = {
  address: '',
  mapGoogle: '',
  mapNeshan: '',
  mapBalad: '',
  socialInstagram: '',
  socialTelegram: '',
  socialWhatsapp: '',
  website: '',
} satisfies PresenceInput

/** Map API / DB presence into react-hook-form string defaults. */
export function presenceToInput(
  presence: SalonPresenceFields | null | undefined,
): PresenceInput {
  return {
    address: presence?.address ?? '',
    mapGoogle: presence?.mapGoogle ?? '',
    mapNeshan: presence?.mapNeshan ?? '',
    mapBalad: presence?.mapBalad ?? '',
    socialInstagram: presence?.socialInstagram ?? '',
    socialTelegram: presence?.socialTelegram ?? '',
    socialWhatsapp: presence?.socialWhatsapp ?? '',
    website: presence?.website ?? '',
  }
}
