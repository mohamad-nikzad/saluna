---
id: BL-0037
title: Add and import Setup Salon Clients
status: done
type: feature
priority: high
size: medium
created: 2026-06-23
updated: 2026-06-23
---

## Parent

[BL-0031 Assisted Salon Setup and handoff](BL-0031-assisted-salon-setup-and-handoff.md)

## What to build

Give authorized admins a complete Client setup flow: add Clients individually or import name-and-phone rows from VCF and CSV. Both formats share canonical phone validation, duplicate detection, a selectable preview, and the existing bulk-create behavior. Confirmation commits the selected rows; source files are not retained and there is no batch rollback.

## Acceptance criteria

- [x] An authorized admin can add an individual Client to a Setup Salon using the existing Client validation rules.
- [x] An authorized admin can select either a VCF or CSV source and preview normalized name-and-phone rows before creating Clients.
- [x] The preview identifies invalid rows, duplicates within the source, and duplicates already in the salon.
- [x] Only eligible rows explicitly selected and confirmed in the preview are created.
- [x] CSV and VCF initially import only Client name and phone; other columns are ignored or reported clearly.
- [x] Source files are processed ephemerally and are not persisted in application storage or audit metadata.
- [x] The audit event records the real platform actor and aggregate imported, skipped, duplicate, and invalid counts without Client personal data.
- [x] There is no batch rollback; imported Clients remain editable through ordinary Client editing after handoff.
- [x] Parser, API, and UI tests cover both formats, Persian and Latin phone forms, duplicates, invalid rows, selection, permissions, and lifecycle checks.

## Blocked by

- [BL-0032 Create and recognize a Setup Salon](BL-0032-create-and-recognize-setup-salon.md)

## Completion comment

Implemented on 2026-06-23. Added individual Setup Salon Client creation, an ephemeral CSV/VCF preview-confirm flow with canonical phone normalization, source and salon duplicate detection, invalid-row reporting, and explicit eligible-row selection. Confirmation reparses the source as the commit boundary, uses the existing bulk-create behavior, and records only real platform actor attribution plus aggregate imported, skipped, duplicate, and invalid counts. The admin UI explains ignored columns, non-retention, and the absence of batch rollback. Added parser, API, permission/lifecycle, audit, and UI selection coverage; regenerated the OpenAPI contract and client.
