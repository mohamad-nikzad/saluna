import { expect, test } from '@playwright/test'

import { loginManagerExpectsToday } from './helpers/auth'

const PUBLIC_URL = 'http://localhost:3000/salons/saluna'
const SHARE_TEXT = 'خدمات سالن را ببینید و درخواست نوبت ثبت کنید.'

test('manager can complete and share the saved public page', async ({
  page,
}) => {
  await loginManagerExpectsToday(page)
  await page.request.put('/api/v1/salon-public-settings', {
    data: { enabled: true },
  })

  await page.addInitScript(() => {
    const state = {
      shareMode: 'success',
      clipboardMode: 'success',
      shareCalls: [] as ShareData[],
      clipboardCalls: [] as string[],
      openCalls: [] as unknown[][],
    }
    Object.assign(window, { __publicPageTest: state })

    Object.defineProperty(navigator, 'share', {
      configurable: true,
      value: async (data: ShareData) => {
        state.shareCalls.push(data)
        if (state.shareMode === 'cancel') {
          throw new DOMException('Cancelled', 'AbortError')
        }
        if (state.shareMode === 'failure') throw new Error('Share failed')
      },
    })
    Object.defineProperty(navigator, 'clipboard', {
      configurable: true,
      value: {
        writeText: async (text: string) => {
          if (state.clipboardMode === 'failure') {
            throw new Error('Clipboard failed')
          }
          state.clipboardCalls.push(text)
        },
      },
    })
    Object.defineProperty(window, 'open', {
      configurable: true,
      value: (...args: unknown[]) => {
        state.openCalls.push(args)
        return null
      },
    })
  })

  try {
    await page.goto('/public-page')

    const share = page.getByRole('button', { name: 'اشتراک' })
    const copy = page.getByRole('button', { name: 'کپی لینک' })
    const open = page.getByRole('button', { name: 'باز کردن' })
    const publicationSwitch = page.getByRole('switch', {
      name: 'فعال بودن صفحه عمومی',
    })

    await expect(
      page.getByText(PUBLIC_URL, { exact: true }).first(),
    ).toBeVisible()
    await expect(page.getByText(/معرفی کوتاه/)).toBeVisible()

    await share.click()
    expect(
      await page.evaluate(
        () =>
          (
            window as typeof window & {
              __publicPageTest: { shareCalls: ShareData[] }
            }
          ).__publicPageTest.shareCalls,
      ),
    ).toEqual([
      {
        title: 'سالن آراویرا',
        text: SHARE_TEXT,
        url: PUBLIC_URL,
      },
    ])

    await page.evaluate(() => {
      ;(
        window as typeof window & {
          __publicPageTest: { shareMode: string }
        }
      ).__publicPageTest.shareMode = 'cancel'
    })
    await share.click()
    await expect(page.getByText('اشتراک‌گذاری لینک انجام نشد')).toHaveCount(0)

    await page.evaluate(() => {
      ;(
        window as typeof window & {
          __publicPageTest: { shareMode: string }
        }
      ).__publicPageTest.shareMode = 'failure'
    })
    await share.click()
    await expect(page.getByText('اشتراک‌گذاری لینک انجام نشد')).toBeVisible()

    await page.evaluate(() => {
      Object.defineProperty(navigator, 'share', {
        configurable: true,
        value: undefined,
      })
    })
    await share.click()
    await expect(page.getByText('کپی شد')).toBeVisible()

    await expect(copy).toBeVisible()
    await copy.click()
    expect(
      await page.evaluate(
        () =>
          (
            window as typeof window & {
              __publicPageTest: { clipboardCalls: string[] }
            }
          ).__publicPageTest.clipboardCalls,
      ),
    ).toEqual([PUBLIC_URL, PUBLIC_URL])

    await expect(copy).toBeVisible()
    await page.evaluate(() => {
      ;(
        window as typeof window & {
          __publicPageTest: { clipboardMode: string }
        }
      ).__publicPageTest.clipboardMode = 'failure'
    })
    await copy.click()
    await expect(page.getByText('کپی لینک انجام نشد')).toBeVisible()

    await open.click()
    expect(
      await page.evaluate(
        () =>
          (
            window as typeof window & {
              __publicPageTest: { openCalls: unknown[][] }
            }
          ).__publicPageTest.openCalls,
      ),
    ).toEqual([[PUBLIC_URL, '_blank', 'noopener,noreferrer']])

    await publicationSwitch.click()
    await expect(share).toBeDisabled()
    await expect(copy).toBeDisabled()
    await expect(open).toBeDisabled()
    await expect(
      page.getByText('برای اشتراک‌گذاری، صفحه را فعال و ذخیره کنید.'),
    ).toBeVisible()

    const disabledSave = page.waitForResponse(
      (response) =>
        response.url().endsWith('/api/v1/salon-public-settings') &&
        response.request().method() === 'PUT',
    )
    await page.getByRole('button', { name: 'ذخیره تغییرات' }).click()
    await disabledSave
    await expect(publicationSwitch).not.toBeChecked()
    await expect(share).toBeDisabled()

    await publicationSwitch.click()
    await expect(share).toBeDisabled()
    await expect(
      page.getByText('برای فعال شدن لینک، تغییرات را ذخیره کنید.'),
    ).toBeVisible()

    const enabledSave = page.waitForResponse(
      (response) =>
        response.url().endsWith('/api/v1/salon-public-settings') &&
        response.request().method() === 'PUT',
    )
    await page.getByRole('button', { name: 'ذخیره تغییرات' }).click()
    await enabledSave
    await expect(publicationSwitch).toBeChecked()
    await expect(share).toBeEnabled()
  } finally {
    await page.request.put('/api/v1/salon-public-settings', {
      data: { enabled: true },
    })
  }
})
