# Epic 001: wagc — the wag shape from CV

**Priority:** P1
**Status:** Ready
**Depends on:** None

## Goal

Sam can build a Node project end to end from CV by voice, with no laptop required: discovery in the planet, a repo from the template, docs and an ADR by conversation, a dev run to a PR, a review, a merge, and the next PBI offered. One entry point per project, three continuations, every artifact placed by the server, every model call on the subscription. Traces to PRD Goals 1–5 and Architecture decisions 1–11.

## Deliverables

- The wag entry point on the server: orient with ritual, and the approve, snag and save continuations, behaving per phase.
- The phase engine: stored phase, derived position, artifact double-checks on approve, well-known home resolution across planet and project repo.
- The GitHub, Dropbox and Actions modules as internal libraries the surface calls.
- The template repo every project repo is generated from, carrying the workflow, the `.wag/` skeleton and the toolkit pin.
- The Actions workflow that runs Claude Code on the subscription token with the toolkit checked out, for dev and review runs, ending at a PR or a verdict, stopping on an ask.
- Self-hosted runner registration on Sam's laptops with GitHub-hosted fallback.
- Adoption of existing wag2 projects, so a project not born from the template is stamped, wired for runs and registered, and thereafter treated like any other.

## Design Input Required

- Tool count: one tool with a continuation parameter, or a small family with one orienting call. Decided in PBI 001.001's ADR.
- The shape of the ritual text returned on orient, including how it summarises written artifacts for voice. Decided across the phase PBIs.
- Run resumption after an ask is answered. Decided in PBI 001.010's ADR.

## Non-goals

- The audit log, permissions and hardening — Epic 002.
- Plugin packaging, a richer ask channel, kwiki to git, raw modules as a surface — Epic 501.
- Exposing GitHub or Dropbox file tools to CV directly.
- Running any long work inside the Vercel function.
