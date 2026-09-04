# Research — claude-mcps (wagc)

**Created:** 2026-09-04
**Derived from:** [PRD.md](./PRD.md)

This project's research was a grill, not a survey. The discovery conversation on 2026-09-04 walked from "how do we run wag from Claude Voice on an iPad" to the wagc shape recorded in the PRD, rejecting several alternatives on the way. This document preserves that path so "why not X" stays answerable. Where a claim was checked against current documentation rather than memory, that is noted.

## Ecosystem

### The server's own stack (already in place)

- **mcp-handler** (Vercel) provides the streamable HTTP MCP transport as a Next.js route handler. It is serverless-friendly and already carries the v1 read-only GitHub tools at `/api/mcp`.
- **@modelcontextprotocol/sdk** registers tools with zod input schemas; mcp-handler validates tool inputs against them.
- **@octokit/rest** talks to GitHub with a server-side token. The v1 tools use the Contents API for reads.

### GitHub as the truth

Everything wagc needs from GitHub exists on the Free plan:

- **Contents API** creates, updates and deletes one file per commit. Adequate for single-document saves.
- **Git Data API** (blobs, trees, commits, refs) lands a multi-file change as one commit. Needed so an ADR plus a state change, or a PBI close that moves two files, is atomic.
- **Template repositories** are created from with a single API call. This is how init produces a repo that already carries the workflow file, the `.wag/` skeleton and the toolkit pin, removing the chicken-and-egg of dispatching a workflow that does not yet exist.
- **workflow_dispatch** and the Actions runs API let the server start a job and read its status.
- **Pull request and issue comment APIs** carry the review verdict, the run's asks, and the merge.
- **Self-hosted runners** register any machine as a job target. Runners poll GitHub, so no inbound path to a laptop is needed.

### Claude Code in GitHub Actions (verified against docs, 2026-09-04)

The official `anthropics/claude-code-action@v1` was checked against the current Claude Code documentation:

- It accepts `claude_code_oauth_token`, generated locally by `claude setup-token`, available on Pro, Max, Team and Enterprise. The docs state that with an OAuth token, "runs use your Claude subscription instead of API billing." This is what makes the no-API-tax constraint achievable.
- With a `prompt` input it runs in automation mode "on any GitHub event", which includes a dispatched workflow.
- Skills and the `.claude` directory come from the checked-out repo, so checking out claude-home into the runner gives the job the wag toolkit. `claude_args` accepts `--mcp-config`, so the hwag and fs MCP servers can be mounted from the checkout.
- The docs also note the metered cost: GitHub-hosted runners consume Actions minutes, and the OAuth token is tied to the subscription of whoever ran `setup-token`.

### The toolkit is already portable

Sam's home `.claude` is the `samfreeman/claude-home` git repo. The wag commands, agents, workflows, templates and the MCP server sources (hwag, fs, sidecar, wag, and others) are tracked; only build output, session data and machine-local settings are ignored. A fresh host can clone it, build the MCP servers, install Claude Code and run wag. This was checked on disk, not assumed.

### Dropbox

The Dropbox API covers list, read, write (overwrite), delete, move and create-folder. The built-in claude.ai Dropbox connector exposes read, create and delete but not edit, which is why the planet and kwiki need the server's own Dropbox module.

### Noted and set aside

- **Vercel Sandbox** runs ephemeral microVMs from a function, persists between commands, and can be reconnected to by id. It could host Claude Code, but every run would bootstrap from scratch and it is metered compute. Not needed once Actions is the job system.
- **Claude Code on the web** runs full sessions in a cloud sandbox from a phone. It is subscription-billed and GitHub-connected, but it is not reachable from CV by voice, so it does not serve the product's goal.

## Feasibility

### Hard limits that shaped the design

- **CV has MCP tools only.** No bash, no Agent tool, no local git, no filesystem. Anything wag needs is a tool call or a job the server dispatches. This is the constraint the whole design is built around.
- **A Vercel function cannot run dev.** Function execution is bounded to minutes on Hobby; a wag dev run takes an hour. The server orchestrates; execution lives in Actions runners, which allow six-hour jobs.
- **The built-in connectors are insufficient.** GitHub's returns unreadable file bodies on mobile and cannot write; Dropbox's cannot edit. Both are bypassed entirely, which also satisfies the everything-routes-through-the-server constraint.
- **Subscription rate limits are shared.** CV's conversation and an Actions run both draw on the same subscription. Acceptable for one user; noted as a risk.

### Costs that are not API costs

- **Actions minutes.** GitHub-hosted runners on private repos are metered past the free monthly allowance, and a dev run is long. Self-hosted runners are free.
- **Public repos are ruled out for self-hosted runners.** GitHub warns that a fork pull request can run code on a self-hosted machine. So the repos stay private, which is exactly where fallback minutes cost money. The trade was accepted: private repos, self-hosted first, paid minutes only on the rare all-laptops-off day.
- **Bootstrap per job.** Every run clones claude-home, builds the MCP servers and installs Claude Code before working. Minutes of overhead per run; a self-hosted runner with a warm checkout reduces it.

### What headless changes

- Wag dev's "user can intervene at any time" does not survive. A run finishes at a PR or hard-stops. Asks become asynchronous: the run posts a comment and exits; the answer re-triggers it. This is the same contract as the existing wagh headless court, with GitHub comments replacing Telegram.
- Voice shapes the thinking phases. An ADR's code examples and a review's file-and-line findings do not read aloud well, so the ritual for those phases needs a spoken-summary layer over the written artifact.

## Architecture patterns

### Wag2 itself

The existing wag2 toolkit defines the phases (init, docs, adr, dev, rvw, tri), the `.wag/` state tree, the halt-on-open-snag rule, the template conformance manifests, and the ADR-then-branch-then-PR-then-merge lifecycle. wagc keeps all of it. What changes is who enforces it: in Claude Code the command text enforces pre-flight because the harness has hooks and file access; in CV nothing does. So enforcement moves into the server, where the approve continuation double-checks artifacts before advancing.

### The headless court (wagh)

The wagh commands already run wag unattended: a confined team acting only through the hwag and fs MCP servers, hard-stopping to a human on snags, template drift, or low-confidence high-blast-radius decisions, and never merging. wagc's dev run is this court in an Actions runner. Confinement by MCP is complemented by confinement by GitHub App permissions and workflow permissions.

### RADD's uphill flow

Fix once at root, every project benefits. This is the reason the toolkit is pinned rather than copied into projects: a copy per project must be patched per project, and the copies drift. A pinned reference (a claude-home ref now, a plugin version later) is reproducible like a copy and upstream-fixable like a clone.

### Planets and the two-zone boundary

Sam's system map already places every project in a Dropbox planet folder with docs, specs and dated decision captures, and init's Phase 0 is "establish the project folder". wagc adopts the planet as the pre-repo zone: discovery lives there until the repo exists, then all wag state lives in `.wag/`. The server owns the boundary; CV never chooses a location.

### Ritual returned, not fetched

The surface-toolsets record shows CD running kwiki rituals end to end by reading the sidecar text and following it in good faith. wagc does the same, but the server hands back the ritual with the state on orient, so CV reads nothing from claude-home directly. This is route-scoped prompting: the tool result carries the instructions for the next stretch of conversation.

### Derived position, stored phase

Wag's state file already records only what cannot be derived (the active PBI and feature branch) and reads everything else off the repo. wagc adds one stored field, the phase, written only by the server at continuation boundaries. Position within the phase is discovered from artifacts on every orient, so it cannot drift.

## Key takeaways

### What was decided

1. **wagc is the target**: wag with GitHub as the truth, Dropbox as the planet and kwiki, and every disk a cache.
2. **Claude Code is the dev executor**, running in GitHub Actions on a subscription token. The server launches and observes; it never executes long work.
3. **Self-hosted runners first, GitHub-hosted as fallback.** Laptops are an optimisation, not architecture.
4. **The toolkit is pinned, not copied**: claude-home at a ref in v1, a plugin later.
5. **One entry point per project** with three continuations: approve, snag, save. The server derives position, checks artifacts on approve, and chooses every artifact's home.
6. **Everything routes through the server.** No built-in connectors. GitHub and Dropbox are internal modules under the wag surface.
7. **Init is two-stage**: discovery in the planet by voice, then repo creation from a template when discovery converges.

### Alternatives rejected, and when to reopen them

| Rejected | Why | Reopen if |
|----------|-----|-----------|
| Give CV filesystem or shell access to a sandbox or the WSL box | Makes CV the dev agent, one tool call at a time by voice. Loses the team, the hooks and the confinement. Not wag dev. | Never for dev. A raw file surface may be mounted later for non-wag uses. |
| Run dev inside the Vercel function | Minutes of execution against an hour of work. | Never on this hosting. |
| Vercel Sandbox as the executor | Bootstrap from scratch every run, metered compute, and Actions already provides a job system with free self-hosted runners. | Actions proves unworkable. |
| Tunnel from Vercel to an always-on WSL box | Inbound exposure, single point of failure, and the box must be on. Runners poll outbound and any laptop can serve. | Never; runners subsume it. |
| Copy the wag toolkit into each project repo | Breaks RADD's uphill flow: root fixes must be re-applied per project and copies drift. | Never; pin instead. |
| Thin GitHub file layer with wag on good faith | Was the phase 1 plan. Superseded when the wag-shaped surface was chosen from the start, which brings enforcement on approve for free. | The harness proves too rigid; raw tools remain reachable but unadvertised. |
| Per-phase tools with open and close calls | Collapsed into one entry point with continuations, since approve, snag and save mean the same thing in every phase. | Tool-description quality for the model demands a small family; decided in the first ADR. |
| A separate capture verb for intermediate results | Save, called often with partial artifacts, is the same thing. | Never. |
| A decisions log of rejected paths returned on orient | Useful in principle, but dropped for now. RESEARCH.md and the ADR's alternatives sections cover it by hand. | A later session re-proposes something already rejected and it costs real time. |
| Telegram as the headless ask channel | GitHub comments are the native channel when the run lives in Actions and the answer comes from CV. | Never for wagc. |
| Move kwiki to a git repo | Would let the server edit it through the GitHub module, but the Dropbox module edits it in place and the planet needs Dropbox anyway. | Dropbox becomes a liability, or Obsidian read-side moves. |
| An always-on machine as the WSL host, choosing one of five laptops | Any laptop can be a runner; none needs to be the host. | Fallback minutes become expensive enough that one always-on runner is cheaper. |

### Remaining unknowns

- The exact resumption mechanism for a run that stopped on an ask: re-dispatch with a checkpoint, or re-run from the branch.
- Whether Claude Code's Agent tool and team shape run cleanly inside an Actions runner, or whether the run becomes a single confined agent. Accepted either way.
- The right home for the audit log.
- Observed frequency of all-laptops-off, which decides whether fallback minutes matter.
