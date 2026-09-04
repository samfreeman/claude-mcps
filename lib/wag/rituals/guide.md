# The wagc guide

wagc is wag in the cloud: the tool that lets Sam build a project end to
end by voice — discovery, docs, an architecture decision, a dev run, a
review, and a merge — with GitHub holding the truth about where every
project stands. The server keeps nothing of its own; every answer it
gives is worked out fresh from what's actually in the project's
repository at the moment you ask.

## The phases

A project moves through these phases, in order, though a round can loop
through adr, dev, and rvw more than once before tri closes it out:

- **discovery** — early thinking about what to build, before there's a
  repository at all.
- **init** — creating the project's repo and turning discovery into a
  working plan.
- **docs** — writing and refining the product requirements, the
  architecture, and the backlog of epics and PBIs.
- **adr** — picking a PBI and designing its solution as an Architecture
  Decision Record.
- **dev** — implementing the approved decision.
- **rvw** — an independent review of what dev produced.
- **tri** — resolving whatever the round surfaced — defects, review
  findings, stashed thoughts — before the next round starts.

## How to orient

Call wagc with a project name and nothing else. The name is also the
project's repository name — there's no separate registry to look up.
You'll hear which phase the project is in, where it sits within that
phase, a suggested next step, and the ritual for running that phase's
conversation, so you know exactly how to talk Sam through it.

## The three continuations

Once oriented, the response tells you exactly which continuation to call
next and what to put in its payload:

- **approve** — the current step is done; act on it and move the project
  forward.
- **snag** — something upstream is wrong; stop everything until it's
  fixed.
- **save** — record where things stand without ending the conversation.

Only call a continuation when the response you just heard told you to,
with the payload it described. Never guess at one.

## What this release doesn't do yet

This release of wagc orients only. It can tell you a project's phase,
its position, and what a human would do next — but it doesn't act on any
continuation yet. Two things in particular aren't here yet:

- Starting a brand-new project by voice — that arrives in a later
  release.
- Adopting an existing GitHub repository that isn't already a wag
  project — also later.

For either of those right now, tell Sam it needs to happen from Claude
Code.

## Voice rules

Sam listens to every wagc session with his eyes closed, so:

- Say the opener first, close to word for word, and wait for him to
  acknowledge it before anything else.
- Ask one question at a time — never a list of questions in one breath.
- Summarise what you find in your own words; only read a path, an
  identifier, or code aloud if he asks.
- Before any approve, restate exactly what's about to happen and get an
  explicit yes.
- After any continuation, say in one sentence what happened, then orient
  again so he knows where things stand.
