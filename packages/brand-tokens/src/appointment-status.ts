import type { ColorToken } from './colors'

const tok = (oklch: string, hex: string): ColorToken => ({ oklch, hex })

export type AppointmentStatusId =
  | 'scheduled'
  | 'confirmed'
  | 'completed'
  | 'cancelled'
  | 'no-show'

export type AppointmentStatusPalette = {
  readonly background: ColorToken
  readonly foreground: ColorToken
  readonly border: ColorToken
}

export const appointmentStatusPalettes = {
  scheduled: {
    background: tok('oklch(0.961 0.007 53.4)', '#F4EFE7'),
    foreground: tok('oklch(0.495 0.017 132.6)', '#767A6F'),
    border: tok('oklch(0.893 0.018 0.4)', '#E5D9DB'),
  },
  confirmed: {
    background: tok('oklch(0.902 0.033 1.5)', '#ECD3D7'),
    foreground: tok('oklch(0.414 0.072 359.8)', '#6B3A4A'),
    border: tok('oklch(0.597 0.126 10)', '#C26878'),
  },
  completed: {
    background: tok('oklch(0.92 0.06 145)', '#D8EFDF'),
    foreground: tok('oklch(0.43 0.11 145)', '#287345'),
    border: tok('oklch(0.68 0.11 145)', '#6ABB82'),
  },
  cancelled: {
    background: tok('oklch(0.92 0.045 25)', '#F4D8D2'),
    foreground: tok('oklch(0.55 0.2 25)', '#C03A2C'),
    border: tok('oklch(0.7 0.13 25)', '#DD806F'),
  },
  'no-show': {
    background: tok('oklch(0.93 0.06 70)', '#F3E5C3'),
    foreground: tok('oklch(0.48 0.12 60)', '#8A611A'),
    border: tok('oklch(0.72 0.12 70)', '#D4AA4C'),
  },
} as const satisfies Record<AppointmentStatusId, AppointmentStatusPalette>
