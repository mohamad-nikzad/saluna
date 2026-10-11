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

### Public content

Read [public content writing rules](docs/agents/public-content.md) before writing
or revising Blog Articles or Product Guides. Use the `saluna-writing` skill for
Blog Articles. The title limit, Persian slug rules, and mobile preview guidance
apply to later agents.
For user-requested production drafts, use the `saluna_emdash_prod` connection
documented in [the agent drafting guide](docs/EMDASH_AGENT.md). Its draft-only
policy leaves publication and published URL changes to an authorized operator.
