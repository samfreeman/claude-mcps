# Epic 002: Trust — audit, permissions, hardening

**Priority:** P2
**Status:** Ready
**Depends on:** PBI 001.001

## Goal

Everything CV does through the server is recorded, bounded and protected. Because every access routes through one surface, there is one place for a durable audit trail, one place to say what CV may and may not do, and one endpoint to harden. This is the reason the everything-routes-through-the-server constraint exists. Traces to PRD Epic 002 and Architecture decision 12.

## Deliverables

- A durable, append-only audit log of every call the server handles, readable later from CV and from a desktop.
- A permission boundary on what CV may do through the server, enforced server-side, with a clear refusal when a call exceeds it.
- Hardening of the endpoint, the shared secret, and every token the server or a run holds, including rotation.

## Design Input Required

- Audit log home: a Dropbox file, a repo, or a store the server owns. Decided in PBI 002.001's ADR.
- The permission model: what is bounded (phases, continuations, projects, merge) and how it is expressed. Decided in PBI 002.002's ADR.

## Non-goals

- Multi-user identity. One caller, one shared secret, in v1.
- Building the wag surface itself — Epic 001.
