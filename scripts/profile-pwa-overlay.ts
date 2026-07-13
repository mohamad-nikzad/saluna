import {
  chromium,
  type CDPSession,
  type Locator,
  type Page,
} from '@playwright/test'

import { loginManagerExpectsCalendar } from '../e2e/helpers/auth'

type InteractionProbe = {
  latencyMs: number
  maxFrameGapMs: number
  longTasksMs: number[]
}

type Cycle = {
  open: InteractionProbe & { taskDurationMs: number }
  close: InteractionProbe
}

const CYCLES = 5

function launchOptions() {
  const executablePath = process.env.PLAYWRIGHT_CHROMIUM_EXECUTABLE_PATH?.trim()
  if (executablePath) return { executablePath }

  const channel = process.env.PLAYWRIGHT_SYSTEM_BROWSER?.trim().toLowerCase()
  if (channel === 'chrome') return { channel: 'chrome' as const }
  if (channel === 'msedge') return { channel: 'msedge' as const }
  return {}
}

async function taskDuration(session: CDPSession) {
  const { metrics } = await session.send('Performance.getMetrics')
  return (
    (metrics.find((metric) => metric.name === 'TaskDuration')?.value ?? 0) *
    1_000
  )
}

async function armProbe(
  page: Page,
  trigger: Locator,
  resultKey: string,
  targetVisible: boolean,
) {
  await trigger.evaluate((element, key) => {
    element.setAttribute('data-overlay-probe-trigger', key)
  }, resultKey)
  const input = JSON.stringify({ resultKey, targetVisible })
  await page.evaluate(`
    (() => {
      const input = ${input}
      const trigger = document.querySelector(
        '[data-overlay-probe-trigger="' + input.resultKey + '"]',
      )
      if (!(trigger instanceof HTMLElement)) {
        throw new Error('Overlay performance trigger not found')
      }

      trigger.addEventListener('click', () => {
        trigger.removeAttribute('data-overlay-probe-trigger')
        const startedAt = performance.now()
        let previousFrame = startedAt
        let maxFrameGapMs = 0
        const longTasksMs = []
        const recordLongTasks = (entries) => {
          for (const entry of entries) {
            // Ignore the browser input-dispatch task that began before capture.
            if (entry.startTime >= startedAt) {
              longTasksMs.push(entry.duration)
            }
          }
        }
        const observer = PerformanceObserver.supportedEntryTypes.includes(
          'longtask',
        )
          ? new PerformanceObserver((list) =>
              recordLongTasks(list.getEntries()),
            )
          : null
        observer?.observe({ entryTypes: ['longtask'] })

        const measureFrame = (now) => {
          maxFrameGapMs = Math.max(maxFrameGapMs, now - previousFrame)
          previousFrame = now
          const surfaces = Array.from(document.querySelectorAll(
            '[data-slot="form-sheet-content"], [data-slot="form-sheet-overlay"]',
          ))
          const content = surfaces.find(
            (surface) => surface.getAttribute('data-slot') === 'form-sheet-content',
          )
          const contentRect =
            content instanceof HTMLElement
              ? content.getBoundingClientRect()
              : null
          const visible =
            contentRect !== null &&
            content.dataset.state === 'open' &&
            contentRect.bottom > 0 &&
            contentRect.top < window.innerHeight
          const visuallyClosed =
            surfaces.length === 0 ||
            surfaces.every(
              (surface) =>
                surface instanceof HTMLElement &&
                surface.dataset.state === 'closed' &&
                surface
                  .getAnimations()
                  .every((animation) => animation.playState === 'finished'),
            )
          const reachedTarget = input.targetVisible
            ? visible
            : visuallyClosed

          if (reachedTarget) {
            recordLongTasks(observer?.takeRecords() ?? [])
            observer?.disconnect()
            Object.assign(window, {
              [input.resultKey]: {
                latencyMs: now - startedAt,
                maxFrameGapMs,
                longTasksMs,
              },
            })
            return
          }
          requestAnimationFrame(measureFrame)
        }

        requestAnimationFrame(measureFrame)
      }, { capture: true, once: true })
    })()
  `)
}

async function readProbe(page: Page, resultKey: string) {
  await page.waitForFunction(
    (key) => Boolean((window as unknown as Record<string, unknown>)[key]),
    resultKey,
    { timeout: 10_000 },
  )
  return page.evaluate(
    (key) => (window as unknown as Record<string, InteractionProbe>)[key],
    resultKey,
  )
}

async function openAndClose(
  page: Page,
  cdp: CDPSession,
  cycle: number,
): Promise<Cycle> {
  const openKey = `__overlayOpen${cycle}`
  const closeKey = `__overlayClose${cycle}`
  const trigger = page.getByLabel('نوبت جدید')

  const taskBefore = await taskDuration(cdp)
  await armProbe(page, trigger, openKey, true)
  await trigger.click()
  const open = await readProbe(page, openKey)
  const taskAfter = await taskDuration(cdp)

  const dialog = page.getByRole('dialog', { name: 'ثبت نوبت' })
  await dialog.waitFor({ state: 'visible' })
  const cancel = dialog.getByRole('button', { name: 'انصراف' })
  await armProbe(page, cancel, closeKey, false)
  await cancel.click()
  const close = await readProbe(page, closeKey)

  return {
    open: { ...open, taskDurationMs: taskAfter - taskBefore },
    close,
  }
}

async function main() {
  const baseURL = process.env.PLAYWRIGHT_BASE_URL ?? 'http://localhost:3000'
  const browser = await chromium.launch(launchOptions())

  try {
    const context = await browser.newContext({
      baseURL,
      locale: 'fa-IR',
      serviceWorkers: 'block',
      viewport: { width: 393, height: 852 },
    })
    const page = await context.newPage()
    await loginManagerExpectsCalendar(page)

    const cdp = await context.newCDPSession(page)
    await cdp.send('Performance.enable')
    await cdp.send('Emulation.setCPUThrottlingRate', { rate: 6 })

    await openAndClose(page, cdp, 0)
    const cycles: Cycle[] = []
    for (let cycle = 1; cycle <= CYCLES; cycle += 1) {
      cycles.push(await openAndClose(page, cdp, cycle))
    }

    console.table(
      cycles.map(({ open, close }, index) => ({
        cycle: index + 1,
        openMs: Math.round(open.latencyMs),
        openTaskMs: Math.round(open.taskDurationMs),
        maxOpenFrameMs: Math.round(open.maxFrameGapMs),
        maxOpenLongTaskMs: Math.round(Math.max(0, ...open.longTasksMs)),
        openLongTasks: open.longTasksMs.filter((duration) => duration > 50)
          .length,
        closeMs: Math.round(close.latencyMs),
      })),
    )

    const failures: string[] = []
    if (cycles.some(({ open }) => open.latencyMs >= 200)) {
      failures.push('an appointment form open reached 200 ms')
    }
    if (cycles.filter(({ open }) => open.maxFrameGapMs > 50).length > 1) {
      failures.push('more than one cycle had an open frame above 50 ms')
    }
    if (
      cycles.filter(({ open }) =>
        open.longTasksMs.some((duration) => duration > 50),
      ).length > 1
    ) {
      failures.push('more than one cycle had an open long task above 50 ms')
    }
    if (cycles.some(({ close }) => close.latencyMs > 300)) {
      failures.push('a form close exceeded 300 ms')
    }

    if (failures.length > 0) {
      throw new Error(
        `Overlay performance smoke failed:\n- ${failures.join('\n- ')}`,
      )
    }
  } finally {
    await browser.close()
  }
}

main().catch((error: unknown) => {
  console.error(error)
  process.exitCode = 1
})
