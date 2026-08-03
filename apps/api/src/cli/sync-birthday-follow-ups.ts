/** Daily cron entrypoint — run at 07:00 Asia/Tehran. */
import { syncBirthdayFollowUps } from '@repo/database/retention'
import { notifyManagersOfBirthdayFollowUp } from '@repo/notifications'

async function main() {
  const followUps = await syncBirthdayFollowUps()
  await Promise.all(
    followUps.map((followUp) =>
      notifyManagersOfBirthdayFollowUp(followUp.salonId, followUp.id).catch(
        (err) => {
          console.error('[birthday-follow-up] manager notification failed', {
            salonId: followUp.salonId,
            followUpId: followUp.id,
            err,
          })
        },
      ),
    ),
  )
  console.log(
    `[birthday-follow-up] synced ${followUps.length} open occurrence(s)`,
  )

  const global = globalThis as {
    __salon_postgres?: { end: () => Promise<void> }
  }
  await global.__salon_postgres?.end()
}

main().catch((err) => {
  console.error('[birthday-follow-up] failed:', err)
  process.exit(1)
})
