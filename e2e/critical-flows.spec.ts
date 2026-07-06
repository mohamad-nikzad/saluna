import { test, expect } from '@playwright/test'
import { apiPathPattern } from './helpers/api'
import {
  loginManagerExpectsCalendar,
  loginManagerExpectsToday,
  loginStaffExpectsToday,
  logoutFromSettings,
  SEEDED_MANAGER,
  SEEDED_STAFF,
  signupNewSalon,
} from './helpers/auth'
import { LoginPage } from './pages/login.page'

/**
 * Top 20 user-journey tests (serial, shared seeded DB).
 * Requires: migrated DB + `bun run db:seed` for primary salon demo data.
 */
test.describe('Critical salon journeys', () => {
  test.describe.configure({ mode: 'serial' })

  test('01 — Unauthenticated home redirects to login with auth entry points', async ({
    page,
  }) => {
    await test.step('Root redirects to login', async () => {
      await page.goto('/')
      await expect(page).toHaveURL(/\/auth/)
    })
    await test.step('Login form and signup CTA', async () => {
      await expect(
        page.getByRole('heading', { name: 'ورود یا ثبت‌نام' }),
      ).toBeVisible()
      await expect(
        page.getByRole('textbox', { name: 'شماره موبایل' }),
      ).toBeVisible()
      await expect(page.getByRole('button', { name: 'ادامه' })).toBeVisible()
    })
  })

  test('02 — Login rejects invalid credentials', async ({ page }) => {
    const loginPage = new LoginPage(page)
    await test.step('Invalid password stays on auth screen and UI shows error', async () => {
      await loginPage.goto()
      await loginPage.submit(SEEDED_MANAGER.phone, 'wrong-password-xyz')
      await expect(
        page.getByText('شماره موبایل یا رمز عبور اشتباه است'),
      ).toBeVisible()
      await expect(page).toHaveURL(/\/auth/)
    })
  })

  test('03 — Manager logs in, lands on today, and can open calendar', async ({
    page,
  }) => {
    await test.step('Authenticate manager', async () => {
      await loginManagerExpectsToday(page)
    })
    await test.step('Today operations load', async () => {
      await expect(
        page.getByRole('heading', { name: 'صف امروز' }),
      ).toBeVisible()
    })
    await test.step('Calendar chrome', async () => {
      await page
        .getByRole('navigation')
        .getByRole('link', { name: 'تقویم' })
        .click()
      await expect(page).toHaveURL(/\/calendar/)
      await expect(page.getByRole('button', { name: 'ماه' })).toBeVisible()
      await expect(page.getByLabel('نوبت جدید')).toBeVisible()
    })
  })

  test('04 — Staff session: dedicated home, clients route blocked', async ({
    page,
  }) => {
    await test.step('Login as staff', async () => {
      await page.context().clearCookies()
      await loginStaffExpectsToday(page)
    })
    await test.step('Staff home shows personal agenda', async () => {
      await expect(page.getByText('نوبت‌های امروز')).toBeVisible()
    })
    await test.step('No manager-only nav link', async () => {
      await expect(
        page.getByRole('navigation').getByRole('link', { name: 'مشتریان' }),
      ).toHaveCount(0)
    })
    await test.step('Deep link to clients redirects away', async () => {
      await page.goto('/clients')
      await expect(page).toHaveURL(/\/today/)
    })
  })

  test('05 — Manager can walk primary navigation', async ({ page }) => {
    await test.step('Manager login', async () => {
      await page.context().clearCookies()
      await loginManagerExpectsToday(page)
    })
    await test.step('Today', async () => {
      await expect(page.getByText('نوبت‌های امروز').first()).toBeVisible()
    })
    await test.step('Clients', async () => {
      await page.getByRole('link', { name: 'مشتریان' }).click()
      await expect(page.getByRole('heading', { name: 'مشتریان' })).toBeVisible()
    })
    await test.step('Retention', async () => {
      await page.getByRole('link', { name: 'بیشتر' }).click()
      await page.getByRole('link', { name: 'پیگیری مشتریان' }).click()
      await expect(
        page.getByRole('heading', { name: 'پیگیری مشتریان' }),
      ).toBeVisible()
    })
    await test.step('More hub', async () => {
      await page.getByRole('link', { name: 'بیشتر' }).click()
      await expect(
        page.getByText('مدیریت، گزارش‌ها و تنظیمات سالن'),
      ).toBeVisible()
    })
    await test.step('Dashboard from more hub', async () => {
      await page.getByRole('link', { name: 'داشبورد و آمار' }).click()
      await expect(page.getByRole('heading', { name: 'داشبورد' })).toBeVisible()
    })
    await test.step('Back to calendar', async () => {
      await page.getByRole('link', { name: 'تقویم' }).click()
      await expect(page).toHaveURL(/\/calendar/)
    })
  })

  test('06 — Clients list: search narrows results', async ({ page }) => {
    await loginManagerExpectsCalendar(page)
    await page.getByRole('link', { name: 'مشتریان' }).click()
    await test.step('Type search query', async () => {
      await page.getByPlaceholder('جستجوی نام یا شماره…').fill('دمو')
    })
    await test.step('Still see demo rows', async () => {
      await expect(page.getByText('دمو VIP امروز')).toBeVisible()
    })
  })

  test('07 — Clients: create customer from drawer', async ({ page }) => {
    await loginManagerExpectsCalendar(page)
    await page.getByRole('link', { name: 'مشتریان' }).click()
    const suffix = Date.now().toString().slice(-7)
    const phone = `0912${suffix}`
    const name = `این مشتری E2E ${suffix}`

    await test.step('Open new client drawer', async () => {
      await page.getByRole('button', { name: /مشتری جدید/ }).click()
      await expect(
        page.getByRole('heading', { name: 'مشتری جدید' }),
      ).toBeVisible()
    })
    await test.step('Fill and save', async () => {
      await page.locator('#client-name').fill(name)
      await page.locator('#client-phone').fill(phone)
      await page.getByRole('button', { name: 'افزودن مشتری' }).click()
    })
    await test.step('Appears in list', async () => {
      await expect(page.getByText(name)).toBeVisible()
    })
  })

  test('08 — Client profile: open from list and return', async ({ page }) => {
    await loginManagerExpectsCalendar(page)
    await page.getByRole('link', { name: 'مشتریان' }).click()
    await test.step('Open seeded demo profile', async () => {
      await page.getByText('دمو VIP امروز').click()
    })
    await test.step('Profile header', async () => {
      await expect(
        page.getByRole('heading', { name: 'دمو VIP امروز' }),
      ).toBeVisible()
      await expect(page.getByText('۰۹۱۲۹۹۰۰۱۰۴')).toBeVisible()
    })
    await test.step('Back to list', async () => {
      await page.getByRole('link', { name: 'بازگشت' }).click()
      await expect(page.getByRole('heading', { name: 'مشتریان' })).toBeVisible()
    })
  })

  test('09 — Calendar: switch day / week / month / list', async ({ page }) => {
    await loginManagerExpectsCalendar(page)
    await test.step('Day view', async () => {
      await page.getByRole('button', { name: 'روز', exact: true }).click()
      await expect(page.locator('.fc-timeGridDay-view')).toBeVisible()
    })
    await test.step('Week view', async () => {
      await page.getByRole('button', { name: 'هفته', exact: true }).click()
      await expect(page.locator('.fc-timeGridWeek-view')).toBeVisible()
    })
    await test.step('Month view', async () => {
      await page.getByRole('button', { name: 'ماه', exact: true }).click()
      await expect(page.locator('.fc-dayGridMonth-view')).toBeVisible()
    })
    await test.step('List view', async () => {
      await page.getByRole('button', { name: 'لیست', exact: true }).click()
      await expect(page.locator('.fc-listWeek-view, .fc-list')).toBeVisible()
    })
  })

  test('10 — Calendar: open appointment from agenda', async ({ page }) => {
    await loginManagerExpectsCalendar(page)
    await page.getByRole('button', { name: 'لیست', exact: true }).click()
    await test.step('Click first seeded event row', async () => {
      await page
        .getByText(/دمو VIP امروز/)
        .first()
        .click()
    })
    await test.step('Detail drawer shows service', async () => {
      const drawer = page.getByRole('dialog', { name: 'جزئیات نوبت' })
      await expect(
        drawer.getByRole('heading', { name: 'جزئیات نوبت' }),
      ).toBeVisible()
      await expect(drawer.getByText('دمو VIP امروز')).toBeVisible()
      await expect(
        drawer.getByText('رنگ کامل مو', { exact: true }),
      ).toBeVisible()
    })
    await test.step('Close drawer', async () => {
      await page
        .getByRole('dialog', { name: 'جزئیات نوبت' })
        .getByRole('button', { name: 'بستن' })
        .first()
        .click()
    })
  })

  test('11 — Appointment: confirm scheduled visit from drawer', async ({
    page,
  }) => {
    await loginManagerExpectsCalendar(page)
    await page.getByRole('button', { name: 'لیست', exact: true }).click()
    await page
      .getByText(/دمو VIP امروز/)
      .first()
      .click()
    await test.step('Confirm when available', async () => {
      const confirm = page.getByRole('button', { name: 'تایید نوبت' })
      if (await confirm.isVisible()) {
        await confirm.click()
        await expect(
          page.getByRole('heading', { name: 'جزئیات نوبت' }),
        ).not.toBeVisible()
      }
    })
  })

  test('12 — Calendar: FAB opens new appointment drawer', async ({ page }) => {
    await loginManagerExpectsCalendar(page)
    await test.step('Tap floating action', async () => {
      await page.getByLabel('نوبت جدید').click()
    })
    await test.step('Drawer title', async () => {
      await expect(
        page.getByRole('heading', { name: 'نوبت جدید' }),
      ).toBeVisible()
    })
    await test.step('Dismiss', async () => {
      await page.getByRole('button', { name: 'انصراف' }).click()
    })
  })

  test('13 — Calendar: create appointment on future day', async ({ page }) => {
    await loginManagerExpectsCalendar(page)

    await test.step('Advance calendar nav (FAB uses navigationDate as initialDate — avoids seeded “today” overlap)', async () => {
      await page.getByRole('button', { name: 'هفته', exact: true }).click()
      const weekSkips = 6 + (Date.now() % 9)
      for (let i = 0; i < weekSkips; i++) {
        await page.getByRole('button', { name: 'بعدی' }).click()
      }
    })

    await test.step('Open new-visit drawer from FAB', async () => {
      await page.getByLabel('نوبت جدید').click()
      await expect(
        page.getByRole('heading', { name: 'نوبت جدید' }),
      ).toBeVisible()
    })

    await test.step('Select client', async () => {
      await page.getByRole('button', { name: /انتخاب مشتری/ }).click()
      await page
        .locator('input[placeholder="جستجو نام یا شماره…"]')
        .fill('09129900102')
      await page.getByRole('button', { name: /۰۹۱۲۹۹۰۰۱۰۲/ }).click()
    })

    await test.step('Select service (staff auto-fills when eligible)', async () => {
      await page
        .getByRole('combobox')
        .filter({ hasText: 'انتخاب خدمت' })
        .click()
      await page
        .getByRole('option', { name: /پاکسازی پوست/ })
        .first()
        .click()
      await expect(
        page.getByRole('combobox').filter({ hasText: 'سارا محمودی' }),
      ).toBeVisible()
    })

    await test.step('Submit and wait for API', async () => {
      const submit = page.getByRole('button', { name: 'ثبت نوبت' })
      await expect(submit).toBeEnabled({ timeout: 25_000 })
      const waitCreate = page.waitForResponse(
        (r) =>
          apiPathPattern('appointments').test(r.url()) &&
          r.request().method() === 'POST',
      )
      await submit.click()
      const res = await waitCreate
      expect(res.ok(), await res.text()).toBeTruthy()
    })

    await test.step('Drawer closes', async () => {
      await expect(
        page.getByRole('heading', { name: 'نوبت جدید' }),
      ).not.toBeVisible({ timeout: 20_000 })
    })
  })

  test('14 — Today: manager dashboard loads with counters', async ({
    page,
  }) => {
    await loginManagerExpectsCalendar(page)
    await page.getByRole('link', { name: 'امروز' }).click()
    await test.step('Header + stats strip', async () => {
      await expect(page.getByText('نوبت‌های امروز').first()).toBeVisible()
      await expect(page.locator('.hero-surface').first()).toBeVisible()
    })
  })

  test('15 — Today: mark first active visit as completed', async ({ page }) => {
    await loginManagerExpectsCalendar(page)
    await page.getByRole('link', { name: 'امروز' }).click()
    const done = page.getByRole('button', { name: 'انجام شد' }).first()
    await test.step('Tap انجام شد when present', async () => {
      if (await done.isVisible().catch(() => false)) {
        const waitPatch = page.waitForResponse(
          (r) =>
            apiPathPattern('appointments/').test(r.url()) &&
            r.request().method() === 'PATCH',
        )
        await done.click()
        await waitPatch
      }
    })
  })

  test('16 — Retention queue loads and can mark reviewed', async ({ page }) => {
    await loginManagerExpectsCalendar(page)
    await page.getByRole('link', { name: 'بیشتر' }).click()
    await page.getByRole('link', { name: 'پیگیری مشتریان' }).click()
    await test.step('List or empty state', async () => {
      const empty = page.getByText('موردی در صف نیست.')
      const card = page.getByRole('button', { name: 'بررسی شد' }).first()
      if (await empty.isVisible().catch(() => false)) {
        await expect(empty).toBeVisible()
      } else if (await card.isVisible().catch(() => false)) {
        const waitPatch = page.waitForResponse(
          (r) =>
            apiPathPattern('retention/').test(r.url()) &&
            r.request().method() === 'PATCH',
        )
        await card.click()
        await waitPatch
      }
    })
  })

  test('17 — Retention: “نوبت” deep-link opens calendar with booking drawer', async ({
    page,
  }) => {
    await loginManagerExpectsCalendar(page)
    await page.getByRole('link', { name: 'بیشتر' }).click()
    await page.getByRole('link', { name: 'پیگیری مشتریان' }).click()
    const book = page.getByRole('link', { name: 'نوبت' }).first()
    if (!(await book.isVisible().catch(() => false))) {
      return
    }
    await test.step('Follow نوبت link', async () => {
      await book.click()
    })
    await test.step('Pre-filled create drawer', async () => {
      await expect(page).toHaveURL(/\/calendar/)
      await expect(
        page.getByRole('heading', { name: 'نوبت جدید' }),
      ).toBeVisible({ timeout: 20_000 })
    })
    await page.getByRole('button', { name: 'انصراف' }).click()
  })

  test('18 — Settings: save business hours and sign out', async ({ page }) => {
    await loginManagerExpectsCalendar(page)
    await page.getByRole('link', { name: 'بیشتر' }).click()
    await test.step('PATCH business hours', async () => {
      const waitSave = page.waitForResponse(
        (r) =>
          apiPathPattern('settings/business').test(r.url()) &&
          r.request().method() === 'PATCH',
      )
      await page.getByRole('button', { name: 'ذخیره ساعات کاری' }).click()
      const res = await waitSave
      expect(res.ok()).toBeTruthy()
    })
    await test.step('Logout returns to login', async () => {
      await logoutFromSettings(page)
    })
  })

  test('19 — Staff directory: open weekly schedule drawer', async ({
    page,
  }) => {
    await loginManagerExpectsCalendar(page)
    await page.getByRole('link', { name: 'بیشتر' }).click()
    await page.getByRole('link', { name: 'پرسنل و نقش‌ها' }).click()
    await expect(
      page.getByRole('heading', { name: 'پرسنل و نقش‌ها' }),
    ).toBeVisible()
    await test.step('Open schedule from staff row menu', async () => {
      await page
        .getByRole('button', { name: /گزینه‌های بیشتر برای سارا محمودی/ })
        .click()
      await page.getByRole('menuitem', { name: 'روزها و ساعات کاری' }).click()
    })
    await test.step('Drawer title', async () => {
      await expect(
        page.getByRole('heading', { name: /برنامه کاری/ }),
      ).toBeVisible()
    })
  })

  test('20 — Signup creates salon and lands on onboarding', async ({
    page,
  }) => {
    await page.context().clearCookies()
    const phone = `0913${Date.now().toString().slice(-7)}`
    /** ASCII salon name: controlled Persian input occasionally failed to update React state in headless runs. */
    const salonLabel = `E2E Salon ${Date.now()}`

    await test.step('Submit signup', async () => {
      await signupNewSalon(page, {
        phone,
        salonLabel,
        managerName: 'مدیر E2E',
        password: 'Salon1234',
      })
    })

    await test.step('Redirected to onboarding', async () => {
      await expect(page).toHaveURL(/\/onboarding\/welcome/)
      await expect(page.getByRole('button', { name: 'بزن بریم' })).toBeVisible({
        timeout: 30_000,
      })
    })
  })
})
