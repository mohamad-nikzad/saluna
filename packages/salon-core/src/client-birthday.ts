import {
  jalaliMonthLength,
  jalaliToGregorianStr,
  parseGregorianToJalali,
} from './jalali'
import { addDaysYmd } from './salon-local-time'

export type BirthdayOccurrence = {
  occurrenceYear: number
  dueDate: string
  expiresOn: string
}

export function birthdayOccurrenceInWindow(
  birthDate: string,
  today: string,
): BirthdayOccurrence | null {
  const birth = parseGregorianToJalali(birthDate)
  const currentYear = parseGregorianToJalali(today).jy

  for (const occurrenceYear of [
    currentYear - 1,
    currentYear,
    currentYear + 1,
  ]) {
    const day = Math.min(birth.jd, jalaliMonthLength(occurrenceYear, birth.jm))
    const dueDate = jalaliToGregorianStr(occurrenceYear, birth.jm, day)
    if (today < addDaysYmd(dueDate, -7) || today > addDaysYmd(dueDate, 7)) {
      continue
    }
    return {
      occurrenceYear,
      dueDate,
      expiresOn: addDaysYmd(dueDate, 7),
    }
  }

  return null
}
