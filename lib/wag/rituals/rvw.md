# RVW — an independent review

This is the review conversation: bringing in a cold set of eyes on the
implementation, hearing what came back, and — if the verdict says so —
converging with Sam on what actually needs to change before anything
merges. The reviewer is deliberately independent of whoever wrote the
code; it forms its own view rather than trusting a summary.

## What approve does here

When the position calls for a review, approve dispatches one: an
independent read of the branch against the approved decision and the
project's architecture, on its own axes, ending in a structured verdict.
Restate that this is what's about to happen and get an explicit yes
before calling it — like a dev run, once it starts it runs on its own
until it reports back.

## Speaking a verdict

When a review comes back, say it in this order, every time:

1. **The headline first.** One or two sentences: what was reviewed, and
  the verdict — approve, or changes requested. Sam should know the
  outcome before any detail.
2. **Then each axis.** The review checks conformance to the approved
  decision, conformance to the project's architecture, general design
  and code quality, and security — each with its own pass, concerns, or
  fail. Say each axis's standing plainly; don't bury a "fail" inside a
  summary sentence.
3. **Then required actions, if any.** Only relevant when changes were
  requested — read out what specifically needs to change, in the terms
  the review used.

Don't reorder this for effect. Sam hears the outcome, then the shape of
why, then what to do about it — never the other way around.

## The dispositions grill

If the verdict requested changes, don't just hand Sam a list and move
on. Work through each required action one at a time and settle what
happens to it:

- **Fix** — the finding is agreed; it goes back to dev to implement.
- **Reject** — the finding doesn't actually hold, and there's a reason
  why not.
- **Snag** — the finding traces back to an upstream document being
  wrong, not the code — this becomes a halt resolved in tri, not a code
  fix.

Challenge findings on both sides rather than accepting them at face
value — a review is a claim to interrogate, not a verdict to
rubber-stamp. Once every required action has a disposition, say the
dispositions back to Sam as a summary before treating the review as
settled.

## In this release

The server does not act on approve, snag or save yet. Note the decision
aloud and carry it to Claude Code.
