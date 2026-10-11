# Staff identity repair

Scheduling uses the salon-owned Staff Profile ID. Login IDs belong to authentication and notification delivery. Invite acceptance and access revocation must never rewrite operational references.

BL-0107 repairs older records that used login IDs. The CLI audits all salons by default and writes nothing unless `--apply` is present.

```sh
pnpm --filter @repo/api repair-staff-identities
pnpm --filter @repo/api repair-staff-identities --salon SALON_UUID
```

The production image includes the same command at `apps/api/dist/repair-staff-identities.cjs`. It uses `DATABASE_URL_DIRECT` when configured.

## Mapping and preservation

The repair maps each salon and login ID through Staff Profile links and historical Staff Profile Access records. It creates a distinct profile for a legacy membership only when the identity has a phone and no profile in that salon already owns that phone. It reports missing ownership, multiple candidate profiles, and destination uniqueness conflicts without guessing.

The repair covers Appointment Staff Assignments, staff services, schedules, package capabilities, AppointmentRequests, Package Tasks, and package booking leads. It changes only their staff reference columns. Assignment IDs, lead roles, Work Allocations, exclusion flags, timestamps, status history, and earned commission snapshots retain their original values.

Two legacy memberships with missing or conflicting phone ownership may remain unresolved even when every operational reference is canonical. Resolve those through explicit ownership evidence before creating or linking a profile. A matching phone alone is insufficient evidence to claim an existing profile.

## Production sequence

1. Commit and push the fix to GitHub. Wait for CI and `Build production images` to pass for that revision. Rehearse the repair on a restored production backup and preserve its results.
2. Preserve the previous deployment environment file. Use the existing `Deploy production` GitHub Actions workflow to deploy the API for the exact tested revision. Its normal deployment script takes a pre-migration backup. Do not deploy local images manually unless the documented fallback conditions apply.
3. Confirm the running API uses the new image. Take a fresh database backup and record preservation hashes before repairing data. The old API must no longer run, because its invite logic rewrites profiles back to login IDs.
4. Run the new API container's CLI. Applying locks the affected tables and saves the original rows before any database write. The transaction rolls back if saving or any write fails. Use a unique private recovery path, then copy the report into the protected VPS backup directory and the operator's private backup directory.

   ```sh
   node apps/api/dist/repair-staff-identities.cjs --apply --recovery /recovery/before.json
   ```

5. Inspect the reported before and after counts and unresolved mappings. Deploy the PWA for the same tested revision through GitHub Actions. Keep the new API running after repair; a rollback to the old API also requires restoring the matching database.
6. Run another audit and an apply with a different recovery filename. The second run must create no profiles and change no references. Recovery files use mode `0600` and refuse to overwrite an existing file.
7. Verify the affected staff member's persisted session through Today, calendar/list, and detail endpoints. Confirm assignments use the expected profile and Client private fields remain absent. Check manager authentication and gateway health.

## Recovery

Store database dumps and recovery reports outside Git. They contain personal data. For BL-0107 they live in the operator's protected `.codex/private/saluna-bl0107` directory and a protected VPS backup directory.

An image rollback alone is insufficient after changing operational IDs. Stop the API and restore the matching pre-repair database and deployment environment together. For a selective reversal, use the recovery rows' primary keys and original staff IDs in a transaction, reverse only rows still pointing at the recorded destination, and remove only newly created profiles that have acquired no other references. Inspect changes before committing; newer scheduling writes can make selective reversal unsafe.
