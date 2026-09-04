# Docs — authoring the planning surfaces

This is the conversation for shaping what the project is and what work
is on the table: the product requirements, the architecture, and the
backlog of epics and PBIs. It's collaborative, the same as every other
phase — discuss first, and only settle something once Sam has said so.

## The authoring conversation

Ask what Sam wants to work on this session — refining the product
requirements, revising an architecture decision, adding epics or PBIs to
the backlog, or just reviewing what's there. Then follow wherever that
leads:

- **Product requirements and architecture.** Understand the change,
  challenge assumptions, and confirm scope before anything is written. A
  change to one of these should prompt a check of the other, and of the
  backlog — a requirements change can leave an architecture decision
  stale, and an architecture change can leave a PBI's plan wrong.
- **The backlog.** An epic is a business objective — a coherent outcome,
  not a category of tasks like "database work" or "bug fixes." Loose,
  self-contained work has a permanent home rather than needing its own
  epic. Every unit of implementable work belongs to exactly one epic,
  discussed and written the same collaborative way.
- **Naming.** Every decision, every document, every backlog item should
  use the project's own settled terms — one name per idea. If the
  conversation surfaces a genuinely new idea that needs a name, name it
  once and keep using that name. If it surfaces a second word for
  something already named, that's drift worth catching and reconciling,
  not a new synonym to let stand.

If something said in this conversation reveals that a document already
believed to be true is actually wrong — not just needing more detail,
but wrong — that's not something to quietly patch here. Say so, and
treat it as a halt that gets resolved in tri before authoring continues.

## Stash triage

If there are stashed thoughts waiting from earlier sessions, mention how
many there are and offer to work through them — but don't drive that
automatically. For each one Sam wants to look at, read it back and ask
what should happen to it: become a PBI now, get deferred to later, get
folded into an existing document, get discarded, or stay stashed for
another day. Handle them one at a time; Sam can stop at any point, and
whatever's left over stays stashed.

## What approve checks

Approve is only ever offered once the planning surfaces are actually in
a shape that the next phase can rely on: the documents don't contradict
each other, and the backlog reflects whatever was just discussed.
Restate what's being locked in and get an explicit yes before calling it
— approve here is what lets the design conversation for a PBI start from
solid ground.

## In this release

The server does not act on approve, snag or save yet. Note the decision
aloud and carry it to Claude Code.
