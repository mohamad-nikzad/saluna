import type { FieldErrors, UseFormSetFocus } from 'react-hook-form'
import type { PresenceInput } from '@repo/salon-core/forms/presence'

export type PresenceField = keyof PresenceInput

/** Display order for address, map, and social rows in the presence form. */
export const PRESENCE_FIELD_ORDER = [
  'province',
  'city',
  'neighborhood',
  'address',
  'mapGoogle',
  'mapNeshan',
  'mapBalad',
  'socialInstagram',
  'socialTelegram',
  'socialWhatsapp',
  'website',
] as const satisfies readonly PresenceField[]

export function getFirstInvalidPresenceField(
  errors: FieldErrors<PresenceInput>,
): PresenceField | null {
  for (const field of PRESENCE_FIELD_ORDER) {
    if (errors[field]) {
      return field
    }
  }
  return null
}

export function revealInvalidPresenceField(
  field: PresenceField,
  actions: {
    setOpen: (field: PresenceField | null) => void
    setFocus: UseFormSetFocus<PresenceInput>
  },
) {
  const structuredLocation =
    field === 'province' || field === 'city' || field === 'neighborhood'
  if (!structuredLocation) actions.setOpen(field)
  requestAnimationFrame(() => {
    requestAnimationFrame(() => {
      if (structuredLocation) {
        document.getElementById(presenceFieldInputId(field))?.focus()
      } else {
        actions.setFocus(field)
      }
      document
        .querySelector(
          structuredLocation
            ? `#${presenceFieldInputId(field)}`
            : `[data-presence-field="${field}"]`,
        )
        ?.scrollIntoView({ block: 'nearest', behavior: 'smooth' })
    })
  })
}

export function presenceFieldInputId(field: PresenceField) {
  return `presence-field-${field}`
}
