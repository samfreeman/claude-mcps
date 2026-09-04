# Epic 501: Future

**Priority:** P3
**Status:** Ongoing
**Depends on:** None

## Goal

Holding bucket for envisioned, deferred work — backlog-shaped PBIs the project intends to build later, not now. Unlike feature epics, Epic 501 is not a business objective being actively pursued; it's where "v2/future — parked, not forgotten" lives as concrete, pointable PBIs. Each PBI carries a deferral dependency so `/wag:adr` keeps it visible-but-not-offered — it surfaces in the blocked footnote and feeds Phase 2 design context. When a future item draws near, lift it into its own properly-framed feature epic.

(Number `501` follows the special-bucket convention: feature epics use `001–199`; `200+` buckets borrow HTTP status codes as a soft mnemonic. `501 Not Implemented` = envisioned, not built yet; the `5xx` class marks work that takes priority after delivery.)

## Deliverables

- Whatever individual future PBIs in this epic describe. Per-PBI scope lives in each PBI file.

## Design Input Required

None at the epic level. Future PBIs carry their own design context and inform present ADRs via `/wag:adr` Phase 2.

## Non-goals

- Not a backlog of now-work. PBIs here are deferred by definition; promote one to a feature epic when it's time to build it.
