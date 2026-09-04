# PRD — claude-mcps (wagc)

**Created:** 2026-09-04
**Version:** 1.2

## Overview

claude-mcps is one remote MCP server, hosted on Vercel, reachable from every Claude surface as a custom connector. Its product is **wagc** — wag in the cloud: the full wag product-development cycle (init, docs, adr, dev, rvw, tri) driven by voice from CV on an iPad or phone, with no filesystem and no laptop required.

Why it exists: iOS has no filesystem, and CV has MCP tools only — no shell, no agents, no git. The built-in GitHub connector cannot return readable file bodies on mobile, cannot create repos, and cannot write files. The built-in Dropbox connector can read, create and delete but cannot edit. And wag itself assumes a machine: a home `.claude` with the toolkit, a shell, a git checkout. wagc removes the machine from the loop. GitHub becomes the truth, Dropbox holds the planet and kwiki, every disk is a cache, and the one thing CV needs is this server.

The server carries the GitHub token, the Dropbox token and the audit trail server-side, and exposes wag as a single entry point. Underneath, the GitHub and Dropbox capabilities are internal modules — reusable later by anything that isn't wagc, but not advertised to CV.

## Target users

Sam, working solo, on an iPad or phone through CV (Claude Desktop with voice), and on a desktop through CD. One user, one subscription, many devices and five laptops that may or may not be on.

## Goals

v1 succeeds when Sam can build a Node project end to end from CV:

1. Start from an idea in conversation, with discovery accumulating in the project's planet before any repo exists.
2. Create the project repo from a template and land the PRD, Architecture and backlog in `.wag/` by voice.
3. Design and approve an ADR by voice, with the branch and state committed by the server.
4. Dispatch a dev run that implements the ADR to an open PR, and a review run that returns a verdict, without touching a laptop.
5. Merge from CV and pick the next PBI.

Three constraints hold throughout:

- **No API tax.** Every model call rides the Claude subscription — CV natively, and runs via a subscription token. No Anthropic API key anywhere.
- **Everything routes through the server.** CV uses no built-in connector for GitHub or Dropbox. Every read and write wag makes is one the server saw, so control, logs and auditing have one place to live.
- **Works with the laptops off.** A laptop that is on makes things faster and cheaper; none being on makes nothing impossible.

## v1 Scope

### Epic 001 — wagc: the wag shape from CV

The wag surface as one entry point per project. Called with a project and no continuation, it orients: reads the artifacts, derives the phase and position, reports where the project is, suggests the next step, and returns the ritual CV needs to run that phase's conversation. Called with a continuation and a payload, it acts:

- **approve** — the phase is complete, continue. The server double-checks the artifacts before advancing (template manifests for docs, an approved ADR before dev, green checks and a review before merge) and refuses with a reason when they fall short.
- **snag** — stop, a problem was discovered. The server captures it and halts the phase until tri clears it.
- **save** — record the work so far and where we are, so a later session picks up mid-phase. Save is a write, not a goodbye; it can be called as often as there is something worth keeping.

The payload is the artifacts themselves — documents, an ADR, a snag description, a pickup note — and the server puts each in its well-known home. Before a repo exists, that home is the planet in Dropbox. After, it is `.wag/` in the project repo. CV never chooses where.

Phases covered: init (discovery in the planet, then repo creation from a template), docs, adr, dev (dispatch a run, later merge), rvw (dispatch a review, later accept dispositions), and tri.

Dev and rvw execute as GitHub Actions jobs running Claude Code on a subscription token, with the wag toolkit checked out from claude-home at a pinned ref. Self-hosted runners on Sam's laptops pick up jobs when one is on; GitHub-hosted runners are the fallback. A run that needs a human posts a comment and stops; the answer re-triggers it.

Existing wag2 projects are adopted, not rebuilt: a one-time step adds the workflow and secret and registers the project, after which CV handles it like any project born from the template. Projects continue to be worked from CC on a laptop as well, so the server stores nothing a CC session would have to keep current: the phase is derived from the artifacts on every orient.

### Epic 002 — trust: audit, permissions, hardening

- A durable, append-only audit log of every tool call — who, what, where — written somewhere the server controls, since Vercel function logs are short-lived.
- Permissions on what CV may do through the server, so the good-faith period has a record and a boundary.
- Hardening of the endpoint and its secrets: the shared secret, the GitHub and Dropbox tokens, the subscription token in Actions.

## Out of scope

- **Packaging wag as a Claude Code plugin.** The pinned clone of claude-home is the v1 toolkit pin; the plugin replaces it later without changing the project side.
- **A headless ask channel beyond comment-and-stop.** A run that needs Sam posts and halts; richer resumption is future work.
- **Moving kwiki to git.** Kwiki stays in Dropbox. The server edits it there.
- **Mounting the GitHub and Dropbox modules as their own MCP surface.** They are internal libraries in v1, structured so this is possible later.
- **Intermediate decision capture** — logging rejected paths during discovery for later orient calls. Dropped for now; revisit if its absence bites.
- **Multi-user.** One user, one subscription, one shared secret.
- **Running wag dev inside the server.** A Vercel function dies in minutes; a dev run takes an hour. Execution lives in Actions.
- **Making CV the dev agent.** Giving CV a shell over a sandbox would make it a single agent driving a terminal by voice, which is not wag dev.

## User stories

- As Sam on the iPad, I say "wag, gigger" and hear where the project is and what comes next, then say yes.
- As Sam mid-discovery, I say "save that" and the decisions so far land in the project's planet, so tomorrow's session picks up where we stopped.
- As Sam finishing discovery, I approve init and the repo exists from the template with PRD, Architecture and backlog committed.
- As Sam grilling an ADR by voice, I approve and the ADR is committed on its feature branch with state updated, by the server, in one commit.
- As Sam after approving an ADR, I approve dev and a run starts on whichever runner is available; later I hear that a PR is open.
- As Sam with a PR open, I approve rvw and later hear the verdict and the headline findings, summarised for voice.
- As Sam with an approved review, I say merge and the PBI closes, the ADR moves to completed, and orient offers the next PBI.
- As Sam hitting a contradiction mid-phase, I say snag and everything halts until tri resolves it.
- As Sam auditing later, I can read a log of every call CV made through the server.

## Constraints

- **Surface.** CV has MCP tools only. No bash, no Agent tool, no local git, no filesystem. Everything wag needs must be a tool call or a job.
- **Hosting.** Vercel Hobby tier. Function execution is bounded to minutes, so the server orchestrates and never executes long work. Runs are Actions jobs.
- **Auth.** Anthropic model access is by Claude subscription only. Actions authenticate with a subscription token from `claude setup-token` stored as a repository secret. The server's endpoint is public and gated by a shared secret header.
- **GitHub tier.** Free plan. Template repositories, workflow dispatch and self-hosted runners are available on it. Private repos are required because self-hosted runners must not serve public repos; GitHub-hosted fallback minutes on private repos are metered beyond the free monthly allowance.
- **State.** Wag state lives in `.wag/` in the project repo. The state file keeps wag2's exact shape; phase and position are derived from artifacts on every orient, never stored. Nothing wag reads or writes lives on a laptop disk.
- **Dropbox.** The planet and kwiki live in Dropbox and are edited through the server's Dropbox module. Dropbox is not a wag state store once a repo exists.
- **Toolkit.** The wag commands, agents, workflows and templates come from the claude-home repo at a pinned ref. No project carries a copy.
- **Code style.** TypeScript per `~/.claude/documents/typescript-rules.md`: single quotes, tabs, no semicolons, no trailing commas, `==`, single-statement blocks without braces.

## Open questions

- Whether the entry point is literally one tool with a continuation parameter, or a small family with one orienting call. Principle fixed; count decided in the first ADR.
- How the server double-checks each phase's artifacts on approve — which checks are manifest-driven and which are phase-specific rules.
- Where the audit log lives: a file in Dropbox, a repo, or a store the server owns.
- How a stopped run is resumed after a human answers a comment — re-dispatch with a checkpoint, or re-run from the branch.
- Whether GitHub-hosted fallback minutes are acceptable at the observed frequency of all-laptops-off, or whether one always-on runner is cheaper.

## Changelog

- 1.2 (2026-09-04) — SNAG-001: phase derived, not stored; adoption and the State constraint corrected.
- 1.1 (2026-09-04) — Adoption of existing wag2 projects added to Epic 001 scope, with the CC-and-CV mixed-use constraint.
- 1.0 (2026-09-04) — Initial, derived from the 2026-09-04 discovery grill.
