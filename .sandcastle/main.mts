// Sequential Reviewer — implement-then-review loop for BL-0016 tickets.md
//
// Phase 1 (Implement): Cursor Agent (grok-4.5-high) picks the next frontier
//                      ticket from tickets.md, implements it, commits, closes it.
// Phase 2 (Review):    A second Cursor Agent pass reviews the branch diff and
//                      either approves or fixes issues on the same branch.
//
// After each successful cycle the agent branch is merged into the host HEAD so
// tickets.md closures and code land for the next frontier iteration.
//
// Usage:
//   pnpm sandcastle
//   # or
//   pnpm exec tsx .sandcastle/main.mts

import { execFileSync } from 'node:child_process'
import {
  closeSync,
  constants as fsConstants,
  existsSync,
  mkdirSync,
  openSync,
  unlinkSync,
  writeFileSync,
  writeSync,
} from 'node:fs'
import * as sandcastle from '@ai-hero/sandcastle'
import { docker } from '@ai-hero/sandcastle/sandboxes/docker'

const MAX_ITERATIONS = 10
const COMPLETE_SIGNAL = '<promise>COMPLETE</promise>'
const BLOCKED_SIGNAL = '<promise>BLOCKED</promise>'
// Cursor CLI slug for "Cursor Grok 4.5 Medium" (user-facing "high" maps here).
const AGENT_MODEL = 'grok-4.5-high'
const IMAGE_NAME = 'sandcastle:saluna'
const HOST_CURSOR_HOME = `${process.env.HOME}/.cursor`
const repoRoot = process.cwd()
const lockPath = `${repoRoot}/.sandcastle/sandcastle.lock`
const corepackCachePath = `${repoRoot}/.sandcastle/corepack-cache`
const cursorAuthPath = `${repoRoot}/.sandcastle/cursor-auth/auth.json`
const pnpmStorePath = `${repoRoot}/.sandcastle/pnpm-store`

// Single-instance lock — concurrent sandcastle runs OOM Docker (~7.6GiB).
mkdirSync(`${repoRoot}/.sandcastle`, { recursive: true })
mkdirSync(corepackCachePath, { recursive: true })
mkdirSync(pnpmStorePath, { recursive: true })
let lockFd: number
try {
  lockFd = openSync(
    lockPath,
    fsConstants.O_CREAT | fsConstants.O_EXCL | fsConstants.O_WRONLY,
  )
  writeSync(lockFd, `${process.pid}\n`)
} catch {
  console.error(
    `Another sandcastle is already running (lock: ${lockPath}).\n` +
      `If stale: rm ${lockPath}`,
  )
  process.exit(1)
}
const releaseLock = () => {
  try {
    closeSync(lockFd)
  } catch {
    /* ignore */
  }
  try {
    unlinkSync(lockPath)
  } catch {
    /* ignore */
  }
}
process.on('exit', releaseLock)
process.on('SIGINT', () => {
  releaseLock()
  process.exit(130)
})
process.on('SIGTERM', () => {
  releaseLock()
  process.exit(143)
})

// Empty MCP config so the agent does not auto-start shadcn MCP
// (MCP + typescript-language-server previously OOM-killed the container).
mkdirSync(`${repoRoot}/.sandcastle/cursor-home`, { recursive: true })
writeFileSync(`${repoRoot}/.sandcastle/cursor-home/mcp.json`, '{}\n')

const hooks = {
  sandbox: {
    onSandboxReady: [
      {
        // Image pre-creates ~/.cursor as the agent user so the plugin-cache
        // bind-mount does not leave parent dirs root-owned. Verify warm cache
        // + empty mcp.json before the agent starts.
        command: [
          'test -w /home/agent/.cursor/projects',
          'test -f /home/agent/.cursor/mcp.json',
          'ls /home/agent/.cursor/plugins/cache/cursor-public',
        ].join(' && '),
        timeoutMs: 30_000,
      },
      {
        // Do NOT copy host node_modules (Darwin) into the Linux sandbox —
        // that previously hung on Rollup native binaries. Install Linux deps
        // from the persistent pnpm store, using the network only for cache misses.
        command:
          'rm -rf node_modules && pnpm install --offline --frozen-lockfile || pnpm install --prefer-offline --frozen-lockfile',
        timeoutMs: 600_000,
      },
    ],
  },
}

const sandboxProvider = docker({
  imageName: IMAGE_NAME,
  // Leave headroom on ~7.6GiB Docker Desktop VMs so agent + pnpm don't OOM.
  cpus: 4,
  mounts: [
    {
      hostPath: corepackCachePath,
      sandboxPath: '/home/agent/.cache/node/corepack',
    },
    {
      hostPath: pnpmStorePath,
      sandboxPath: '.pnpm-store',
    },
    ...(existsSync(cursorAuthPath)
      ? [
          {
            hostPath: cursorAuthPath,
            sandboxPath: '/home/agent/.config/cursor/auth.json',
            readonly: true,
          },
        ]
      : []),
    // Warm plugin cache so agent startup does not hang on marketplace fetch.
    {
      hostPath: `${HOST_CURSOR_HOME}/plugins/cache`,
      sandboxPath: '/home/agent/.cursor/plugins/cache',
      readonly: true,
    },
    // Empty MCP config — prevents auto-starting shadcn MCP inside the sandbox.
    {
      hostPath: '.sandcastle/cursor-home/mcp.json',
      sandboxPath: '/home/agent/.cursor/mcp.json',
      readonly: true,
    },
  ],
  env: {
    AGENT_CLI_CREDENTIAL_STORE: 'file',
  },
})

function mergeBranchToHead(branch: string) {
  execFileSync('git', ['merge', '--no-edit', branch], {
    cwd: repoRoot,
    stdio: 'inherit',
  })
}

function getFrontier() {
  return JSON.parse(
    execFileSync(
      'node',
      [`${repoRoot}/.sandcastle/tickets-tracker.mjs`, 'list'],
      { cwd: repoRoot, encoding: 'utf8' },
    ),
  ) as Array<{ id: string; title: string }>
}

for (let iteration = 1; iteration <= MAX_ITERATIONS; iteration++) {
  console.log(`\n=== Iteration ${iteration}/${MAX_ITERATIONS} ===\n`)

  const ticket = getFrontier()[0]
  if (!ticket) {
    console.log('No frontier tickets remain.')
    break
  }

  console.log(`Working ticket: ${ticket.title}`)

  const branch = `sandcastle/bl-0016/${Date.now()}`

  const sandbox = await sandcastle.createSandbox({
    branch,
    sandbox: sandboxProvider,
    hooks,
    timeouts: {
      copyToWorktreeMs: 300_000,
      gitSetupMs: 60_000,
      commitCollectionMs: 60_000,
    },
  })

  try {
    const implement = await sandbox.run({
      name: 'implementer',
      maxIterations: 1,
      agent: sandcastle.cursor(AGENT_MODEL),
      promptFile: './.sandcastle/implement-prompt.md',
      completionSignal: [COMPLETE_SIGNAL, BLOCKED_SIGNAL],
      idleTimeoutSeconds: 1_800,
      completionTimeoutSeconds: 120,
    })

    if (implement.completionSignal === BLOCKED_SIGNAL) {
      throw new Error(`Implementation blocked on ${ticket.title}: ${branch}`)
    }

    if (implement.completionSignal !== COMPLETE_SIGNAL) {
      throw new Error(
        `Implementation agent stopped without completing ${branch}`,
      )
    }

    if (!implement.commits.length) {
      throw new Error(
        `Implementation agent made no commits for ${ticket.title}`,
      )
    }

    console.log(`\nImplementation complete on branch: ${branch}`)
    console.log(`Commits: ${implement.commits.length}`)

    const review = await sandbox.run({
      name: 'reviewer',
      maxIterations: 1,
      agent: sandcastle.cursor(AGENT_MODEL),
      promptFile: './.sandcastle/review-prompt.md',
      promptArgs: {
        BRANCH: branch,
      },
      idleTimeoutSeconds: 1_800,
      completionTimeoutSeconds: 120,
    })

    if (review.completionSignal !== COMPLETE_SIGNAL) {
      throw new Error(`Review agent stopped without completing ${branch}`)
    }

    const frontier = await sandbox.exec(
      'node .sandcastle/tickets-tracker.mjs list',
    )
    if (frontier.exitCode !== 0) {
      throw new Error(`Could not verify ticket closure on ${branch}`)
    }
    if (
      (JSON.parse(frontier.stdout) as Array<{ id: string }>).some(
        (candidate) => candidate.id === ticket.id,
      )
    ) {
      throw new Error(
        `Ticket remains open after agent completion: ${ticket.id}`,
      )
    }

    const status = await sandbox.exec('git status --porcelain')
    if (status.exitCode !== 0 || status.stdout.trim()) {
      throw new Error(`Agent worktree is not clean after review: ${branch}`)
    }

    console.log('\nReview complete.')
  } finally {
    await sandbox.close()
  }

  console.log(`\nMerging ${branch} into host HEAD…`)
  mergeBranchToHead(branch)
}

console.log('\nAll done.')
releaseLock()
