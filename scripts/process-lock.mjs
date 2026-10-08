import { open } from 'node:fs/promises'
import { constants } from 'node:fs'
import { spawn } from 'node:child_process'
import { AsyncLocalStorage } from 'node:async_hooks'

const held = new AsyncLocalStorage()

/** Unix flock belongs to the open file description inherited by Python.
 * The parent keeps that descriptor open after Python exits, retaining the lock.
 * Kernel descriptor cleanup releases it after a crash. Never unlink lock files.
 * Nested operations share their transaction's lock; independent callers wait.
 */
export async function withProcessLock(path, operation) {
  if (held.getStore()?.has(path)) return operation()
  const file = await open(
    path,
    constants.O_CREAT | constants.O_RDWR | constants.O_NOFOLLOW,
    0o600,
  )
  try {
    const child = spawn(
      'python3',
      ['-c', 'import fcntl; fcntl.flock(3, fcntl.LOCK_EX)'],
      {
        stdio: ['ignore', 'ignore', 'ignore', file.fd],
      },
    )
    await new Promise((resolve, reject) => {
      child.once('error', () =>
        reject(new Error('CMS PROCESS_LOCK_UNAVAILABLE')),
      )
      child.once('exit', (code) =>
        code === 0
          ? resolve()
          : reject(new Error('CMS PROCESS_LOCK_UNAVAILABLE')),
      )
    })
    return await held.run(
      new Set([...(held.getStore() || []), path]),
      operation,
    )
  } finally {
    await file.close()
  }
}
