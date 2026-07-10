# TASK

Review the code changes on branch `{{BRANCH}}` for BL-0016 multi-salon staff invites. Improve clarity, consistency, and maintainability while preserving exact functionality. Prefer the repo's `/code-review` two-axis mindset (Standards + Spec) even though you apply fixes directly.

# CONTEXT

## Spec sources

- Parent: `backlog/ready/BL-0016-staff-can-join-multiple-salons.md`
- Tickets: `tickets.md`
- Domain: `CONTEXT.md` and relevant `docs/adr/`

## Branch diff

!`git diff {{TARGET_BRANCH}}...{{BRANCH}}`

## Commits on this branch

!`git log {{TARGET_BRANCH}}..{{BRANCH}} --oneline`

# REVIEW PROCESS

1. **Understand the change**: Read the diff and commits above. Identify which frontier ticket this branch claims to implement.

2. **Spec check**:
   - Does the diff satisfy the ticket's acceptance criteria?
   - Any scope creep beyond the ticket / BL-0016?
   - Wrong domain language (claim/transfer vs invite/access)?

3. **Standards / clarity**:
   - Reduce unnecessary complexity and nesting
   - Eliminate redundant code and abstractions
   - Improve names; consolidate related logic
   - Remove comments that narrate obvious code
   - Prefer explicit control flow over nested ternaries
   - Follow @.sandcastle/CODING_STANDARDS.md

4. **Correctness / security**:
   - Pending invites must grant no access
   - Wrong-phone acceptance must fail
   - Revoked access must not authorize a salon context
   - Staff appointment visibility stays scoped to the active Staff Profile / salon
   - Tests cover the new behaviour at useful seams

5. **Preserve functionality**: Never change what the code does — only how it does it — unless a Spec failure requires a fix to meet the ticket.

# EXECUTION

If you find improvements or Spec gaps to fix:

1. Make the changes directly on this branch
2. Run `pnpm typecheck` and the relevant package tests
3. Commit with a message starting `RALPH: review — …`

If the code already matches the ticket and is clean, do nothing.

# Rules

- Do **not** start MCP servers (`shadcn mcp`, etc.) or long-lived background daemons.
- Do **not** install/sync Cursor marketplace plugins.
- Before emitting `<promise>COMPLETE</promise>`, kill leftover MCP/plugin children so the agent can exit.

Once complete, output <promise>COMPLETE</promise>.
