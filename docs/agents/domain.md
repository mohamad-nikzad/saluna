# Domain docs

Saluna has one domain glossary, [GLOSSARY.md](../../GLOSSARY.md), and
[architecture decisions](../adr/). Read the relevant terms and ADRs before
exploring or changing a domain area.

- Use the glossary's canonical terms in code, tests, specs, and tickets.
- Keep definitions short. Storage mappings, algorithms, workflows, and
  implementation plans belong in ADRs, technical docs, or backlog items.
- Respect superseding ADRs. Flag contradictions with the decision's ID;
  update an ADR when the decision changes.
- The glossary names the domain. ADRs record decisions. Backlog items record
  delivery status. An accepted decision does not imply shipped behavior.

Update `GLOSSARY.md` when terminology is resolved. Keep this single-context
layout when running skill setup; the package structure does not create
separate domain contexts.
