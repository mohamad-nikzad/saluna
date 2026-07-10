#!/usr/bin/env node
/**
 * Local issue tracker for Sandcastle over repo-root tickets.md.
 *
 * Commands:
 *   list              → JSON array of open frontier tickets
 *   view <id>         → one ticket as markdown (or JSON with --json)
 *   close <id> [note] → check off every acceptance criterion for that ticket
 *
 * Ticket ids are slugified titles: "Create manager Staff Invites"
 * → "create-manager-staff-invites"
 */
import { readFileSync, writeFileSync } from "node:fs";
import { resolve } from "node:path";

const TICKETS_PATH = resolve(process.cwd(), "tickets.md");
const SPEC_PATH = "backlog/ready/BL-0016-staff-can-join-multiple-salons.md";

function slugify(title) {
  return title
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-|-$/g, "");
}

function parseTickets(markdown) {
  const lines = markdown.split("\n");
  /** @type {Array<{id:string,title:string,body:string,blockedBy:string[],criteria:Array<{text:string,done:boolean}>,start:number,end:number}>} */
  const tickets = [];
  let current = null;

  const flush = (end) => {
    if (!current) return;
    current.end = end;
    current.body = lines.slice(current.start, current.end).join("\n").trimEnd();
    tickets.push(current);
    current = null;
  };

  for (let i = 0; i < lines.length; i++) {
    const line = lines[i];
    const heading = line.match(/^## (.+)$/);
    if (heading) {
      flush(i);
      const title = heading[1].trim();
      current = {
        id: slugify(title),
        title,
        body: "",
        blockedBy: [],
        criteria: [],
        start: i,
        end: i,
      };
      continue;
    }
    if (!current) continue;

    const blocked = line.match(/^\*\*Blocked by:\*\*\s*(.+)\s*$/);
    if (blocked) {
      const raw = blocked[1].trim();
      if (!/^none\b/i.test(raw)) {
        current.blockedBy = raw
          .split(";")
          .flatMap((part) => part.split(","))
          .map((s) => s.trim())
          .filter(Boolean)
          .map((s) => s.replace(/\.$/, ""));
      }
      continue;
    }

    const criterion = line.match(/^- \[([ xX])\] (.+)$/);
    if (criterion) {
      current.criteria.push({
        text: criterion[2].trim(),
        done: criterion[1].toLowerCase() === "x",
      });
    }
  }
  flush(lines.length);
  return { lines, tickets };
}

function isDone(ticket) {
  return ticket.criteria.length > 0 && ticket.criteria.every((c) => c.done);
}

function titleDone(tickets, title) {
  const match = tickets.find((t) => t.title === title);
  return match ? isDone(match) : false;
}

function frontier(tickets) {
  return tickets.filter(
    (t) =>
      !isDone(t) && t.blockedBy.every((blocker) => titleDone(tickets, blocker)),
  );
}

function toIssue(ticket) {
  const criteria = ticket.criteria
    .map((c) => `- [${c.done ? "x" : " "}] ${c.text}`)
    .join("\n");
  const blocked =
    ticket.blockedBy.length === 0
      ? "None — can start immediately."
      : ticket.blockedBy.join("; ");
  return {
    id: ticket.id,
    number: ticket.id,
    title: ticket.title,
    body: [
      `## Parent`,
      "",
      `BL-0016 — ${SPEC_PATH}`,
      "",
      `## What to build`,
      "",
      ticket.body
        .split("\n")
        .filter((l) => !l.startsWith("## ") && !l.startsWith("- ["))
        .join("\n")
        .replace(/\*\*What to build:\*\*\s*/i, "")
        .replace(/\*\*Blocked by:\*\*.*\n?/i, "")
        .trim(),
      "",
      `## Acceptance criteria`,
      "",
      criteria,
      "",
      `## Blocked by`,
      "",
      blocked,
      "",
      `## Source`,
      "",
      `- Spec: ${SPEC_PATH}`,
      `- Tickets: tickets.md`,
    ].join("\n"),
  };
}

function usage() {
  console.error(`Usage:
  node .sandcastle/tickets-tracker.mjs list
  node .sandcastle/tickets-tracker.mjs view <id>
  node .sandcastle/tickets-tracker.mjs close <id> [note]`);
  process.exit(1);
}

const [cmd, id, ...rest] = process.argv.slice(2);
if (!cmd) usage();

const markdown = readFileSync(TICKETS_PATH, "utf8");
const { lines, tickets } = parseTickets(markdown);

if (cmd === "list") {
  process.stdout.write(JSON.stringify(frontier(tickets).map(toIssue), null, 2) + "\n");
  process.exit(0);
}

if (cmd === "view") {
  if (!id) usage();
  const ticket = tickets.find((t) => t.id === id || t.title === id);
  if (!ticket) {
    console.error(`Ticket not found: ${id}`);
    process.exit(1);
  }
  process.stdout.write(toIssue(ticket).body + "\n");
  process.exit(0);
}

if (cmd === "close") {
  if (!id) usage();
  const ticket = tickets.find((t) => t.id === id || t.title === id);
  if (!ticket) {
    console.error(`Ticket not found: ${id}`);
    process.exit(1);
  }
  if (isDone(ticket)) {
    console.log(`Already closed: ${ticket.title}`);
    process.exit(0);
  }

  const note = rest.join(" ").trim();
  const next = [...lines];
  for (let i = ticket.start; i < ticket.end; i++) {
    next[i] = next[i].replace(/^- \[ \]/, "- [x]");
  }
  if (note) {
    next.splice(ticket.end, 0, "", `> Closed by Sandcastle: ${note}`);
  }
  writeFileSync(TICKETS_PATH, next.join("\n"));
  console.log(`Closed: ${ticket.title} (${ticket.id})`);
  process.exit(0);
}

usage();
