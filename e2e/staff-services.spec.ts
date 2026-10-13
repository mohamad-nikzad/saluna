import { expect, test } from '@playwright/test'
import type { Page } from '@playwright/test'

import { loginManagerExpectsToday } from './helpers/auth'

type StaffRow = {
  id: string
  name: string
  phone: string
  serviceIds: string[] | null
}
type ServiceRow = {
  id: string
  name: string
  active: boolean
  kind?: string
  categoryId: string
  categoryName: string
}

async function readStaff(page: Page): Promise<StaffRow[]> {
  const response = await page.request.get('/api/v1/staff')
  expect(response.ok(), `Staff read returned ${response.status()}`).toBeTruthy()
  return (await response.json()).staff
}

async function openServices(page: Page, staff: StaffRow) {
  await page
    .getByRole('button', { name: `گزینه‌های بیشتر برای ${staff.name}` })
    .click()
  await page.getByRole('menuitem', { name: 'خدمات قابل ارائه' }).click()
  await expect(page.getByRole('dialog', { name: 'خدمات مجاز' })).toBeVisible()
}

for (const viewport of [
  { width: 320, height: 740 },
  { width: 1280, height: 900 },
]) {
  test.describe(`staff services at ${viewport.width}px`, () => {
    test.use({ viewport })

    test('manager searches, saves explicit services, and reopens persisted selections', async ({
      page,
    }, testInfo) => {
      await loginManagerExpectsToday(page)
      const staff = (await readStaff(page)).find(
        (row) => row.phone === '09120000001',
      )
      expect(
        staff,
        'The local demo seed must contain the hair specialist',
      ).toBeTruthy()
      const member = staff!
      const original = member.serviceIds
      const endpoint = `/api/v1/staff/${member.id}/services`
      const response = await page.request.get('/api/v1/services?all=1')
      expect(response.ok()).toBeTruthy()
      const catalog: ServiceRow[] = (await response.json()).services
      const active = catalog.filter(
        (service) => service.active && service.kind !== 'combo',
      )
      const hair = active.find((service) => service.name === 'کوتاهی مو')!
      const keratin = active.find((service) => service.name === 'کراتین مو')!
      const nails = active.find((service) => service.name === 'مانیکور')!
      expect(hair).toBeTruthy()
      expect(keratin).toBeTruthy()
      expect(nails).toBeTruthy()

      const storedIds = async () =>
        (await readStaff(page)).find((row) => row.id === member.id)!.serviceIds
      const save = async () => {
        const saved = page.waitForResponse(
          (result) =>
            result.url().endsWith(endpoint) &&
            result.request().method() === 'PATCH',
        )
        await page.getByRole('button', { name: 'ذخیره', exact: true }).click()
        const result = await saved
        expect(
          result.ok(),
          `Service save returned ${result.status()}`,
        ).toBeTruthy()
        await expect(
          page.getByRole('dialog', { name: 'خدمات مجاز' }),
        ).toBeHidden()
      }

      try {
        const arrange = await page.request.patch(endpoint, {
          data: { serviceIds: [hair.id, nails.id] },
        })
        expect(arrange.ok()).toBeTruthy()
        await page.goto('/staff')
        await openServices(page, member)

        await test.step('Category checkboxes show mixed selection and toggle their own services', async () => {
          const group = page.getByRole('checkbox', {
            name: `همه خدمات دسته ${hair.categoryName}`,
            exact: true,
          })
          await expect(group).toHaveAttribute('aria-checked', 'mixed')
          await expect(group.locator('.lucide-minus')).toBeVisible()
          await expect(group.locator('.lucide-check')).toBeHidden()
          await group.focus()
          await page.screenshot({
            path: testInfo.outputPath('category-partial-selection.png'),
            animations: 'disabled',
          })
          await page.keyboard.press('Space')
          await expect(group).toBeChecked()
          await expect(group.locator('.lucide-check')).toBeVisible()
          await expect(group.locator('.lucide-minus')).toBeHidden()
          await expect(
            page.getByRole('checkbox', { name: keratin.name, exact: true }),
          ).toBeChecked()
          await expect(
            page.getByRole('checkbox', { name: nails.name, exact: true }),
          ).toBeChecked()
          await page.keyboard.press('Space')
          await expect(group).not.toBeChecked()
          await expect(
            page.getByRole('checkbox', { name: nails.name, exact: true }),
          ).toBeChecked()
          await page
            .getByRole('checkbox', { name: hair.name, exact: true })
            .check()
          await expect(group).toHaveAttribute('aria-checked', 'mixed')
        })

        await test.step('Persian search and filtered bulk edits retain hidden selections', async () => {
          const search = page.getByRole('searchbox', {
            name: 'جستجوی نام خدمت یا دسته‌بندی',
          })
          await search.fill('  كراتين  ')
          await expect(
            page.getByRole('checkbox', { name: keratin.name }),
          ).toBeVisible()
          await expect(
            page.getByRole('checkbox', { name: hair.name }),
          ).toHaveCount(0)
          const filteredGroup = page.getByRole('checkbox', {
            name: `خدمات نتایج جستجوی دسته ${hair.categoryName}`,
            exact: true,
          })
          await filteredGroup.check()
          await expect(page.getByRole('status')).toHaveText('۳ خدمت انتخاب شده')
          await filteredGroup.uncheck()
          await expect(page.getByRole('status')).toHaveText('۲ خدمت انتخاب شده')
          await page
            .getByRole('button', {
              name: 'انتخاب همه نتایج جستجو',
              exact: true,
            })
            .click()
          await page.getByRole('button', { name: 'پاک کردن جستجو' }).click()
          await expect(
            page.getByRole('checkbox', { name: hair.name }),
          ).toBeChecked()
          await expect(
            page.getByRole('checkbox', { name: nails.name }),
          ).toBeChecked()
          await save()
          expect((await storedIds())!.sort()).toEqual(
            [hair.id, nails.id, keratin.id].sort(),
          )
          await page.reload()
          await openServices(page, member)
          await expect(
            page.getByRole('checkbox', { name: keratin.name }),
          ).toBeChecked()
          await expect(search).toHaveValue('')
        })

        await test.step('Select-all stays explicit and survives a fresh page load', async () => {
          await page
            .getByRole('button', { name: 'انتخاب همه خدمات فعال', exact: true })
            .click()
          await expect(
            page.getByRole('switch', { name: 'همه خدمات فعال' }),
          ).not.toBeChecked()
          await save()
          expect((await storedIds())!.sort()).toEqual(
            active.map((service) => service.id).sort(),
          )
          await page.reload()
          await openServices(page, member)
          await expect(
            page.getByRole('checkbox', { name: nails.name }),
          ).toBeChecked()
          await expect(
            page.getByRole('switch', { name: 'همه خدمات فعال' }),
          ).not.toBeChecked()
        })

        await test.step('Empty validation is visible and causes no backend write', async () => {
          let writes = 0
          const countWrites = (request: import('@playwright/test').Request) => {
            if (
              request.url().endsWith(endpoint) &&
              request.method() === 'PATCH'
            )
              writes++
          }
          page.on('request', countWrites)
          try {
            await page
              .getByRole('button', {
                name: 'لغو انتخاب همه خدمات فعال',
                exact: true,
              })
              .click()
            await page
              .getByRole('button', { name: 'ذخیره', exact: true })
              .click()
            await expect(page.getByRole('alert')).toContainText(
              'حداقل یک خدمت انتخاب کنید',
            )
            await expect(page.getByRole('alert')).toBeInViewport()
            expect(writes).toBe(0)
            expect((await storedIds())!.length).toBe(active.length)
            await page.screenshot({
              path: testInfo.outputPath('empty-selection.png'),
              animations: 'disabled',
            })
          } finally {
            page.off('request', countWrites)
          }
        })

        await test.step('Discard restores saved services; unrestricted mode persists null', async () => {
          await page.getByRole('button', { name: 'انصراف' }).click()
          await expect(
            page.getByRole('alertdialog', { name: 'خروج بدون ذخیره؟' }),
          ).toBeVisible()
          await page.getByRole('button', { name: 'بستن بدون ذخیره' }).click()
          await expect(
            page.getByRole('dialog', { name: 'خدمات مجاز' }),
          ).toBeHidden()
          await openServices(page, member)
          await expect(
            page.getByRole('checkbox', { name: keratin.name }),
          ).toBeChecked()
          await page
            .getByRole('searchbox', { name: 'جستجوی نام خدمت یا دسته‌بندی' })
            .fill('مو')
          await expect(
            page.getByRole('button', { name: 'ذخیره', exact: true }),
          ).toBeInViewport()
          await page.screenshot({
            path: testInfo.outputPath('staff-services-search.png'),
            animations: 'disabled',
          })
          await page.getByRole('switch', { name: 'همه خدمات فعال' }).click()
          await save()
          expect(await storedIds()).toBeNull()
          await page.reload()
          await openServices(page, member)
          await expect(
            page.getByRole('switch', { name: 'همه خدمات فعال' }),
          ).toBeChecked()
          await page.getByRole('button', { name: 'انصراف' }).click()
        })

        expect(
          await page.evaluate(
            () => document.documentElement.scrollWidth <= window.innerWidth,
          ),
        ).toBe(true)
      } finally {
        const restored = await page.request.patch(endpoint, {
          data: { serviceIds: original },
        })
        expect(
          restored.ok(),
          'Restore only the demo profile modified by this test',
        ).toBeTruthy()
      }
    })
  })
}
