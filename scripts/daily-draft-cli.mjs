#!/usr/bin/env node
import { readPrivateJson } from './cms-draft-client.mjs'
import {
  initializeDailyJournal,
  deliverDailyDraft,
  acknowledgeDailyReport,
} from './daily-draft-delivery.mjs'
const [path, action, date, input, receipt] = process.argv.slice(2)
try {
  const config = await readPrivateJson(path)
  let result
  if (action === 'init') result = await initializeDailyJournal(config)
  else if (action === 'run')
    result = await deliverDailyDraft(
      config,
      date,
      input ? await readPrivateJson(input) : undefined,
    )
  else if (action === 'revise')
    result = await deliverDailyDraft(config, date, {
      patch: (await readPrivateJson(input)).data,
    })
  else if (action === 'ack')
    result = await acknowledgeDailyReport(config, date, input, receipt)
  else throw new Error('CMS DAILY_ACTION_REQUIRED')
  console.log(JSON.stringify(result))
} catch (error) {
  console.log(
    JSON.stringify({
      date,
      status: 'blocked',
      creation: 'unknown',
      code: /^CMS [A-Z0-9_]+$/.test(error.message)
        ? error.message.slice(4)
        : 'DAILY_STORAGE_OR_TRANSPORT_ERROR',
      retry: 'operator handoff; never create replacement',
    }),
  )
  process.exitCode = 1
}
