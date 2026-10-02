import { describe, expect, it } from 'vitest'
import { jalaliToGregorianStr } from './jalali'
import { birthdayOccurrenceInWindow } from './client-birthday'

describe('birthdayOccurrenceInWindow', () => {
  it('opens seven days before and remains open seven days after', () => {
    const birthDate = jalaliToGregorianStr(1370, 5, 10)
    const dueDate = jalaliToGregorianStr(1405, 5, 10)

    expect(
      birthdayOccurrenceInWindow(birthDate, jalaliToGregorianStr(1405, 5, 3)),
    ).toMatchObject({ occurrenceYear: 1405, dueDate })
    expect(
      birthdayOccurrenceInWindow(birthDate, jalaliToGregorianStr(1405, 5, 18)),
    ).toBeNull()
  })

  it('uses 29 Esfand for an Esfand 30 birthday in a non-leap year', () => {
    const birthDate = jalaliToGregorianStr(1366, 12, 30)
    const dueDate = jalaliToGregorianStr(1405, 12, 29)

    expect(birthdayOccurrenceInWindow(birthDate, dueDate)).toMatchObject({
      occurrenceYear: 1405,
      dueDate,
    })
  })
})
