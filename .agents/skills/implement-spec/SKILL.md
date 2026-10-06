---
name: implement-spec
description: "Implement the result of /to-spec and /to-tickets in code."
disable-model-invocation: true
---

You have been provided a spec. This spec should have tickets associated with it, describing how to implement the spec.

Read `docs/agents/issue-tracker.md` and `docs/agents/domain.md` first. Saluna's
specs and tickets live in `backlog/`; read their `parent` and `blocked_by` IDs
and use `GLOSSARY.md` terms. Pass these configuration paths to every subagent.
Create remote issues or PRs only when the user explicitly requests them.

The goal is the entire spec implemented on a single **integration branch**, with every ticket resolved the way the issue tracker closes work.

The tickets are not a list of steps. They are a **task graph** with blocking relationships between them. This means there is always a **frontier** of tickets which are ready to be grabbed.

Communication to and from subagents should be sparse. Communicate primarily through **context pointers**: to the spec, tickets, research notes, and previous commits. Don't duplicate information already available via pointers.

Use one implementer at a time, following the backlog's one-ticket-at-a-time
rule. Run independent tickets concurrently only when the user explicitly
authorizes it. Keep at most one backlog item in `now` unless the user permits
more; an already-active parent may remain that item.

## Steps

1. Read the spec and tickets to understand the task graph.

2. (optional) Use an **exploration subagent** to conduct any exploration required by the tickets - relevant codebase files or external documentation. Ensure the exploration subagent can save files - it should save its markdown notes in a directory outside the repo, accessible by all future subagents. This lets **implementer subagents** focus on implementation rather than exploration.

3. Create a `codex/` integration branch and record its starting commit SHA as the review base. If the user explicitly requested a PR, open a draft after the first merge in step 5, referencing the local spec and tickets.

4. Use **implementer subagents** to implement each ticket, each in its own worktree on its own branch. Each implementer subagent:
   - starts in a clean worktree based on the current integration branch tip;
   - reads and applies `.agents/skills/tdd/SKILL.md` to build the ticket at the spec's agreed test seams;
   - merges the integration branch tip into its own branch before reporting done

5. Once an implementer completes, merge and verify its work on the integration branch with a merger subagent. Mark that task `done`, move it to `backlog/done/`, and update the index and parent links before recomputing the frontier.

6. Recompute the frontier after each merge and dispatch the next unblocked ticket. Use multiple implementers only if parallel work was explicitly authorized.

7. Once all tickets are complete, read and apply `.agents/skills/code-review/SKILL.md` to the integration branch, using the recorded starting SHA as the fixed point and the parent backlog file as the spec. Fix all actionable findings with one implementer and verify the fixes.

8. Complete the parent only when its full acceptance criteria are met and review findings are resolved. Move it to `backlog/done/` and update the index. If a requested draft PR exists, mark it ready for review; report the integration branch.

9. Archive managed implementer worktrees once their merged work is verified.
