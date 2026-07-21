import { expect, type Locator, type Page } from '@playwright/test'
import {
  JALALI_MONTHS,
  parseGregorianToJalali,
} from '../../packages/salon-core/src/jalali'

const numFmt = new Intl.NumberFormat('fa-IR')
const timeFmt = new Intl.NumberFormat('fa-IR', { minimumIntegerDigits: 2 })

function monthLabel(jy: number, jm: number) {
  return `${JALALI_MONTHS[jm - 1]} ${numFmt.format(jy)}`
}

function parseMonthLabel(label: string): { jy: number; jm: number } | null {
  for (let jm = 1; jm <= 12; jm++) {
    const month = JALALI_MONTHS[jm - 1]
    if (!label.startsWith(month)) continue
    const yearText = label.slice(month.length).trim()
    const jy = Number(
      yearText.replace(/[۰-۹]/g, (ch) =>
        String(ch.charCodeAt(0) - '۰'.charCodeAt(0)),
      ),
    )
    if (Number.isFinite(jy)) return { jy, jm }
  }
  return null
}

async function chooseJalaliDayInOpenDrawer(
  page: Page,
  gregorianYmd: string,
) {
  const { jy, jm, jd } = parseGregorianToJalali(gregorianYmd)
  const targetLabel = monthLabel(jy, jm)
  const drawer = page
    .locator('[data-slot="drawer-content"]')
    .filter({ hasText: 'روز مورد نظر را انتخاب کنید' })
  await expect(drawer).toBeVisible()

  for (let i = 0; i < 18; i++) {
    const currentLabel = (
      await drawer.locator('span.text-base.font-semibold').innerText()
    ).trim()
    if (currentLabel === targetLabel) break
    const current = parseMonthLabel(currentLabel)
    expect(current).toBeTruthy()
    const currentIndex = current!.jy * 12 + current!.jm
    const targetIndex = jy * 12 + jm
    if (targetIndex > currentIndex) {
      await drawer.getByRole('button', { name: 'ماه بعد' }).click()
    } else {
      await drawer.getByRole('button', { name: 'ماه قبل' }).click()
    }
  }

  await expect(drawer.locator('span.text-base.font-semibold')).toHaveText(
    targetLabel,
  )
  await drawer.getByRole('button', { name: numFmt.format(jd), exact: true }).click()
  await expect(drawer).toBeHidden()
}

export async function pickJalaliDate(
  page: Page,
  trigger: Locator,
  gregorianYmd: string,
) {
  await trigger.click()
  await chooseJalaliDayInOpenDrawer(page, gregorianYmd)
}

/** Use when the date drawer was already opened (e.g. “افزودن تاریخ”). */
export async function pickOpenJalaliDate(page: Page, gregorianYmd: string) {
  await chooseJalaliDayInOpenDrawer(page, gregorianYmd)
}

export async function pickTime(
  page: Page,
  trigger: Locator,
  timeHm: string,
) {
  const [hour, minute] = timeHm.split(':').map(Number)
  await trigger.click()
  const drawer = page
    .locator('[data-slot="drawer-content"]')
    .filter({ hasText: 'ساعت و دقیقه را انتخاب کنید' })
  await expect(drawer).toBeVisible()
  const columns = drawer.locator('.relative.isolate')
  await columns
    .nth(0)
    .getByRole('button', { name: timeFmt.format(hour), exact: true })
    .click()
  await columns
    .nth(1)
    .getByRole('button', { name: timeFmt.format(minute), exact: true })
    .click()
  await drawer.getByRole('button', { name: 'تایید' }).click()
  await expect(drawer).toBeHidden()
}
