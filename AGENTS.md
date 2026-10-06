## Agent skills

### Issue tracker

Specs and tickets live only in local Markdown under `backlog/`. Read
`docs/agents/issue-tracker.md` before using any engineering skill. A GitHub
remote does not select the tracker. Create remote issues or PRs only when the
user explicitly requests them.

### Triage labels

Canonical five-role vocabulary (`needs-triage`, `needs-info`, `ready-for-agent`, `ready-for-human`, `wontfix`). See `docs/agents/triage-labels.md`.

### Domain docs

One `GLOSSARY.md` at the repo root and decisions in `docs/adr/`. See
`docs/agents/domain.md`. These project paths override skill defaults;
setup must preserve them.
