# Coding Standards (Saluna)

Reviewer checklist for Sandcastle runs. Prefer repo sources of truth over this file when they conflict.

## Domain

- Use terms from `CONTEXT.md` and ADRs under `docs/adr/`.
- For BL-0016 work: prefer Staff Invite, Staff Invite Acceptance, Staff Profile Access, Staff Access Revocation. Do not present claim/transfer as the user-facing path.

## Architecture

- Keep modules deep: small interfaces, hide implementation.
- Prefer composition over boolean-prop proliferation in React (see `.agents/skills/vercel-composition-patterns`).
- Tenant-scoped staff API requests must respect active salon context / Staff Profile Access.

## Testing

- Test external behaviour at the highest useful seams (routes, domain flows, PWA visible behaviour).
- Prefer route/domain tests over low-level implementation tests where possible.
- Security-sensitive paths (pending invite, wrong phone, revoked access, cross-salon leakage) need explicit tests.
- Follow `.agents/skills/tdd/SKILL.md`: red → green vertical slices; no tautological or implementation-coupled tests.

## Tooling

- Package manager: `pnpm` via Corepack.
- Typecheck with `pnpm typecheck`; run focused package tests while iterating.
- Match existing file layout, naming, and import style in the touched package.

## Style

- No drive-by refactors outside the ticket.
- No commented-out code or leftover TODOs in commits.
- Prefer clarity over cleverness.
