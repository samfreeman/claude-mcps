# Architecture — claude-mcps (wagc)

**Created:** 2026-09-04
**Version:** 1.1
**Derived from:** [PRD.md](./PRD.md) + [RESEARCH.md](./RESEARCH.md)

## Ubiquitous language

One name per referent, everywhere — these docs, the tool contract, the data model, and the code. See `~/.claude/wag/references/ubiquitous-language.md`. No bounded contexts: one author, one system, one self-owned contract.

| Term | Meaning |
|------|---------|
| **wagc** | Wag in the cloud. The product: the wag cycle driven from CV with GitHub as the truth. |
| **server** | This deployment — claude-mcps on Vercel. The one remote MCP server every Claude surface connects to. |
| **CV** | Claude Desktop with voice, on iOS or desktop. The client. It has MCP tools only. |
| **project** | A thing being built with wag. Identified by name. Has a planet always, and a project repo once init completes. |
| **entry point** | The single wag tool. Called with a project and no continuation it orients; with a continuation it acts. |
| **orient** | The entry point's response when called without a continuation: current phase, position within it, suggested next step, and the ritual for the phase. |
| **ritual** | The instructions the server returns to CV for running a phase's conversation: what to collect, what to discuss, which continuation comes next and what to put in it. |
| **continuation** | One of three verbs passed to the entry point: **approve**, **snag**, **save**. |
| **approve** | The phase is complete, continue. The server double-checks artifacts, refuses with a reason if they fall short, otherwise acts and advances the phase. |
| **snag** | Stop, a defect in an upstream doc was discovered. The server captures it and halts every phase until tri clears it. |
| **save** | Record the work so far and where we are. Writes artifacts to their well-known homes. Callable any number of times; not a goodbye. |
| **payload** | What CV passes with a continuation: the artifacts, a snag description, a pickup note. |
| **artifact** | A document wag produces: PRD, RESEARCH, Architecture, epic, PBI, ADR, review, snag, stash item, decision capture. |
| **well-known home** | Where an artifact lives. Chosen by the server from the project's state, never by CV. The planet before a repo exists; `.wag/` in the project repo after. |
| **phase** | Where a project is in the wag cycle: discovery, init, docs, adr, dev, rvw, tri. Stored in state; written only by the server. |
| **position** | Where within a phase the project is. Never stored; discovered from artifacts on every orient. |
| **planet** | The project's Dropbox folder. Home of discovery, dated decision captures, and the door into kwiki. Not a wag state store once a repo exists. |
| **project repo** | The project's private GitHub repo. Holds `.wag/`, the app, and the workflow that runs dev and rvw. Created from the template repo at init. |
| **template repo** | The GitHub template every project repo is generated from: workflow file, `.wag/` skeleton, toolkit pin. |
| **run** | A GitHub Actions job the server dispatches: a dev run or a review run. Runs Claude Code on the subscription token with the toolkit checked out. |
| **runner** | Where a run executes: a self-hosted runner on one of Sam's laptops, or a GitHub-hosted runner as fallback. |
| **ask** | A run's request for a human decision. Posted as a PR or issue comment; the run stops. The answer re-triggers it. |
| **toolkit** | The wag commands, agents, workflows, templates and MCP servers, from the claude-home repo at a pinned ref. |
| **module** | An internal library under the wag surface: the GitHub module, the Dropbox module, the Actions module. Not advertised to CV in v1. |
| **audit log** | The durable append-only record of every tool call the server handled: who, what, where, when. |
| **shared secret** | The header value every request to the server must carry. |
| **state** | The project's `.wag/state.json`: app name, wag version, phase, active epic, active PBI, feature branch. |

## Tech stack

| Layer | Choice | Rationale |
|-------|--------|-----------|
| Runtime and hosting | Next.js 15 App Router on Vercel Hobby, Node runtime (Fluid Compute) | Already deployed; one route handler is the whole HTTP surface. Function execution is bounded to minutes, which is fine because the server orchestrates and never executes long work. |
| MCP transport | mcp-handler (streamable HTTP) + @modelcontextprotocol/sdk | Serverless-friendly, already in place, validates tool inputs against zod schemas. |
| Validation | zod | Runtime schema at every trust boundary (see validation policy). Already a dependency. |
| GitHub access | @octokit/rest with a server-side token | Contents API for single-file writes, Git Data API for multi-file commits, repos, PRs, comments, Actions dispatch and status. |
| Dropbox access | Dropbox SDK for JavaScript with a server-side token | List, read, write, delete, move, create-folder on the planet and kwiki. The built-in connector cannot edit. |
| Execution plane | GitHub Actions running `anthropics/claude-code-action@v1` | Runs Claude Code on a subscription OAuth token, so no API billing (verified against docs). Six-hour jobs. Self-hosted runners free; GitHub-hosted as fallback. |
| Toolkit delivery | `samfreeman/claude-home` checked out at a pinned ref inside the run | Portable today; the plugin form replaces it later without touching project repos. |
| Language and style | TypeScript per `~/.claude/documents/typescript-rules.md` | Single quotes, tabs, no semicolons, no trailing commas, `==`, single-statement blocks without braces. |

## High-level architecture

Three layers inside the server, one execution plane outside it, one cross-cutting record.

```
CV (voice, MCP tools only)
   │  wag(project, continuation?, payload?)          shared secret header
   ▼
┌──────────────────────────────────────────────────────────────────┐
│ server (claude-mcps on Vercel)                                    │
│                                                                   │
│  surface        the wag entry point: orient | approve | snag | save
│      │                                                            │
│  phase engine   reads state + artifacts → phase, position         │
│                 returns ritual; on approve runs checks, acts,     │
│                 advances phase; chooses every well-known home     │
│      │                                                            │
│  modules        github · dropbox · actions   (internal libraries) │
│                                                                   │
│  audit log      every call, appended, cross-cutting               │
└──────┬───────────────────────┬───────────────────────┬────────────┘
       ▼                       ▼                       ▼
   project repo             planet / kwiki          Actions runs
   (.wag/, app,             (Dropbox)               (Claude Code on
    workflow, PRs)                                   subscription token,
                                                     toolkit checked out,
                                                     self-hosted first)
```

**The surface** is one tool. Without a continuation it orients. With one it acts. Its response always carries the ritual for whatever comes next, so CV never reads the toolkit itself.

**The phase engine** owns the rules wag's command text used to enforce in Claude Code: halt on open snags, template manifests, an approved ADR before dev, green checks and a review before merge, never merge without approve. It derives position from artifacts on every call and writes the phase only at continuation boundaries. It decides where each artifact lives from whether the project has a repo yet.

**The modules** are plain libraries. Nothing in them knows about phases. They are structured so any of them can be mounted as its own MCP surface later without change.

**The execution plane** is GitHub Actions. The server dispatches a run with the phase's instructions, then reads status, comments and PRs. A run that needs a human posts an ask and stops.

**The audit log** records every call before the surface returns, in a store the server controls.

## Directory structure

Target shape; the v1 GitHub module is currently a single file and moves under `lib/modules/` in the first ADR that touches it.

```
claude-mcps/
├── app/api/[transport]/route.ts    MCP endpoint, shared-secret gate, mounts the surface
├── lib/
│   ├── wag/                        the surface and the phase engine
│   │   ├── entry.ts                the one tool: orient | approve | snag | save
│   │   ├── phases/                 one file per phase: ritual, checks, actions, homes
│   │   ├── position.ts             derive position from artifacts
│   │   └── homes.ts                well-known home resolution (planet vs repo)
│   ├── modules/
│   │   ├── github/                 contents, git-data commits, repos, PRs, comments
│   │   ├── dropbox/                planet and kwiki file operations
│   │   └── actions/                dispatch runs, read status, resolve runners
│   └── audit/                      append-only log writer
├── .wag/                           this project's own wag state and docs
└── README.md
```

Outside this repo, but part of the architecture:

```
samfreeman/wagc-template            template repo: .github/workflows/wag.yml, .wag/ skeleton, toolkit pin
samfreeman/claude-home              the toolkit, checked out at a pinned ref inside every run
<Project>/  (Dropbox planet)        discovery docs, dated decision captures
```

## Key decisions

| # | Decision | Alternatives considered | Why this choice |
|---|----------|------------------------|-----------------|
| 1 | GitHub is the truth; every disk is a cache | Dropbox as state store; an always-on WSL box as host; vendored state per laptop | Every piece wag touches has a GitHub home already (state in the repo, toolkit in claude-home). Removes the machine from the loop, which is the product goal. |
| 2 | The server orchestrates; Claude Code in Actions executes | Run dev in the Vercel function; Vercel Sandbox; CV holding a shell over a sandbox | Function limits rule out in-process execution. A sandbox makes CV the dev agent, which is not wag dev. Actions gives a job system, six-hour jobs, free self-hosted runners and subscription auth. |
| 3 | Subscription OAuth token in Actions, no API key | Anthropic API key; Bedrock/Vertex | The no-API-tax constraint. Verified: claude-code-action accepts `claude_code_oauth_token` and bills to the subscription. |
| 4 | Self-hosted runners first, GitHub-hosted fallback; repos private | GitHub-hosted only; public repos for free minutes; one always-on machine | Laptops become an optimisation, not architecture. Self-hosted must not serve public repos, so private it is, and fallback minutes are accepted on rare all-off days. |
| 5 | Toolkit pinned, not copied | Copy the toolkit into each project; plugin now | A copy breaks RADD's uphill flow. A pinned claude-home ref is reproducible and upstream-fixable today; the plugin is the same pin in a better package later. |
| 6 | One entry point with three continuations | Per-phase open/close tools; raw file tools with wag on good faith; a separate capture verb | approve, snag and save mean the same thing in every phase, so the phase engine, not the tool count, carries the phase logic. Enforcement on approve arrives for free. Raw tools stay reachable but unadvertised. |
| 7 | Phase stored, position derived | Store nothing (derive phase too); store everything | Phase changes only at continuation boundaries, which only the server executes, so a stored phase cannot drift. Position changes constantly and is cheap to read off artifacts. |
| 8 | Server chooses every well-known home | CV names paths; a save-specific location parameter | The planet/repo boundary is a rule the server owns. CV never knows where anything is. |
| 9 | Init is two-stage: planet then template repo | Create the repo first; carry discovery in the closing call | Discovery can span sessions and must be saved as it goes; a template repo makes the first commit already carry the workflow, so there is no chicken-and-egg on dispatch. |
| 10 | Asks are PR/issue comments; the run stops and is re-triggered | Telegram (wagh); keep the run alive waiting | GitHub-native when the run lives in Actions and the answer comes from CV. Same hard-stop contract as the headless court. |
| 11 | GitHub and Dropbox are internal modules under the wag surface | Expose raw tools alongside wag; separate MCP servers | Everything routes through one surface for control and audit. Modules are structured to mount separately later if anything other than wagc needs them. |
| 12 | Audit log written by the server to a store it controls | Rely on Vercel function logs | Vercel logs are short-lived. The good-faith period is exactly when the record matters. |

## Data model

No database. State is files in three places, all written only by the server.

**Project state** — `.wag/state.json` in the project repo. The existing wag2 fields plus the phase:

| Field | Meaning |
|-------|---------|
| app_name | The project name |
| wag_version | The wag2 tooling version the project runs under |
| phase | discovery, init, docs, adr, dev, rvw, tri. Written by the server at continuation boundaries only |
| active_epic | Epic folder in scope; defaults to epic-000-general |
| active_pbi | Zero-padded local PBI number, or null between PBIs |
| feature_branch | The branch an approved ADR lives on, or null |
| docs_page_path | Unchanged from wag2 |

**Position** is not stored. It is derived on each orient from: open snags, the active ADR and its status, the feature branch's existence and PR, the PR's checks and reviews, the stash, and, before a repo exists, the planet's contents.

**Planet** — `<Dropbox>/Claude/<project>/`. Discovery drafts (PRD, notes), dated decision captures (`<topic>-decisions-YYYY-MM-DD.md`), and after init only what is not wag state.

**Wag artifacts** — `.wag/` in the project repo, exactly the wag2 tree: docs, backlog with epics and `_completed/`, adr active and completed, snags, stash, reviews.

**Audit log** — one entry per call: timestamp, project, continuation or orient, the artifacts touched with their homes, the outcome, and the caller (the shared-secret identity, one in v1). Append-only. Location is an open question resolved in Epic 002.

**Runs** — not stored by the server. GitHub is the record: the workflow run, its logs, the PR, the comments.

## Validation policy

zod is the runtime schema library, and the trust boundary is every value that arrives from outside the process and is given a typed identity. All of these run through `safeParse`, not just the obvious venues:

- MCP tool inputs (mcp-handler validates against the tool's zod schema; payload artifacts inside them are parsed again by artifact type before they are written anywhere)
- GitHub API responses that the phase engine reasons about: file contents, tree listings, PR state, check rollups, comments, workflow run status
- Dropbox API responses: listings, file bodies
- `state.json` read back from the repo, before any field is trusted
- Any artifact read from the repo or planet that the engine parses positionally (epic and PBI records, ADR headers, snag files)
- Environment variables at startup (tokens, shared secret, template repo name)

A value that fails to parse is an error surfaced to CV with the reason, never a default silently applied. Signed or authenticated is not the same as shape-valid.

## External dependencies

| Dependency | Purpose | Risk |
|------------|---------|------|
| Vercel Hobby | Hosts the server | Function duration bounds; mitigated by never executing long work in-process. Tier features re-verified before any ADR relies on one. |
| GitHub Free (private repos) | Truth store, job system, template repos, PRs | Fallback minutes metered past the free allowance. Self-hosted runners must never serve a public repo. |
| anthropics/claude-code-action@v1 | Runs Claude Code in Actions | Behaviour of Agent tool and teams in a runner unverified; accepted that a run may be a single confined agent. Action version pinned. |
| Claude subscription OAuth token | Model access for runs without API billing | Tied to one person's subscription; shares rate limits with CV; token rotation is a manual step. |
| samfreeman/claude-home | The toolkit | A breaking change upstream is contained by the pin; bumping the pin is a per-project decision. |
| Dropbox API | Planet and kwiki | Token scope and rotation; Dropbox as a second truth for non-wag artifacts. |
| mcp-handler, @modelcontextprotocol/sdk | Transport and tool registration | Young libraries; versions pinned. |
| @octokit/rest, Dropbox SDK | API clients | Low. |

## Baseline

The baseline app already exists and boots: a Next.js 15 App Router project with one MCP route at `/api/mcp`, mcp-handler as the transport, a shared-secret gate, and a GitHub module exposing two read tools. No database, auth or theme layers; none are needed. Init's Phase C was therefore skipped. Platform and tier: Vercel Hobby, GitHub Free with private repos.

## Open questions

- **Tool count.** Whether the entry point is literally one tool with a continuation parameter or a small family with one orienting call. Principle fixed; decided in the first ADR on tool-description quality for the model.
- **Approve checks.** Which are manifest-driven (docs), which are phase rules (ADR approved, checks green, review present), and how a refusal is phrased for voice.
- **Audit log home.** Dropbox file, a repo, or a store the server owns. Epic 002.
- **Run resumption.** After an ask is answered, re-dispatch with a checkpoint or re-run from the branch.
- **Runner reality.** Whether Claude Code's Agent tool and team shape run in an Actions runner. A single confined agent is the accepted fallback.
- **Voice layer.** How the ritual summarises an ADR or a review for speech without losing the written artifact's precision.
- **Rate limits.** Whether one subscription comfortably carries CV plus concurrent runs.
- **Fallback frequency.** Observed all-laptops-off rate, which decides whether one always-on runner is worth it.
- **Stored phase versus derived position.** Projects are worked from CC as well as CV, and wag2's CC commands do not yet write the phase. When the two disagree, orient either repairs the phase from the artifacts or refuses until repaired; the uphill fix is wag2 writing the phase at the same boundaries. Decided in PBI 001.012's ADR, applied from PBI 001.001.

## Changelog

- 1.1 (2026-09-04) — Open question on stored phase versus derived position for projects also worked from CC; adoption of existing projects noted.
- 1.0 (2026-09-04) — Initial, derived from the 2026-09-04 discovery grill.
