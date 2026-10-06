---
name: setup-matt-pocock-skills
description: "Validate or repair Saluna's engineering skill configuration: local backlog, existing triage labels, and one root glossary."
disable-model-invocation: true
---

# Set up Saluna engineering skills

This repository is already configured. Preserve its choices when validating
or repairing setup; a GitHub remote does not select an issue tracker.

1. Read `AGENTS.md`, `backlog/README.md`, and
   `docs/agents/{issue-tracker,triage-labels,domain}.md`.
2. Keep specs and tickets in `backlog/` with stable `BL-NNNN` IDs, one file per
   item, `parent` and `blocked_by` links, and `backlog/INDEX.md`.
3. Keep the five existing triage values in local frontmatter. Create remote
   issues, labels, or PRs only when the user explicitly requests them.
4. Keep one root `GLOSSARY.md` and `docs/adr/`. A monorepo package structure
   does not require separate domain glossaries.
5. Repair missing or conflicting configuration in place. Preserve surrounding
   user instructions and avoid duplicate configuration blocks or trackers.
6. Report what was repaired, or that the existing setup is valid.

The configured paths override generic skill defaults, including `.scratch/`
trackers. Ask about configuration only if the user explicitly wants to change
these choices or a required choice is genuinely missing.
