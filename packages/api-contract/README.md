# @repo/api-contract

Generated OpenAPI contract for the Saluna API.

**Do not hand-edit `openapi.json`.** It is produced from Hono route definitions in `apps/api`.

## Generate

From the repo root:

```bash
pnpm generate:api-contract
```

Or from `apps/api`:

```bash
pnpm generate:openapi
```

Output: `packages/api-contract/openapi.json`

## Scope

The contract is built incrementally. Phase 2 documents the **clients** route group only (`/api/v1/clients/*`). Other route groups remain legacy until converted in later passes.

## Source of truth

```txt
Hono OpenAPI route definitions (apps/api/src/openapi/)
  → packages/api-contract/openapi.json
  → HeyAPI generated client (packages/api-client/src/generated/) — Phase 3+
```
