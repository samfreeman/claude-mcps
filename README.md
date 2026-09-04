# claude-mcps

One remote MCP server, hosted on Vercel, reachable from every Claude surface (phone, iPad, desktop) as a custom connector. This is wagc — wag in the cloud: it drives the wag cycle by voice, with GitHub as the truth for where every project stands.

## Why

Sam runs wag by voice from Claude Desktop with no screen in front of him. wagc is the one tool that surface calls: given a project name, it reads the project's GitHub repository fresh on every call, works out the phase and position, and hands back an opener to say out loud, the ritual for running that phase's conversation, and what to call next. Nothing is stored on the server — every answer comes from the repo at the moment of the call.

## The tool

There is exactly one tool: **wagc**.

- **No arguments** — returns the guide: what wagc is, the phases, how to orient, and what this release does and doesn't do yet.
- **`project` only** — orients: reads the project's repo, derives its phase and position, and returns a four-section response (opener, position, ritual, next call).
- **`continuation`** (`approve` | `snag` | `save`) — acts on the current step. Not implemented yet in this release: every continuation call is refused, naming what to carry to Claude Code instead.

A project name is its GitHub repository name — there's no separate registry. "Known to the server" means the repository exists and holds `.wag/` on `dev` (or on its one open feature branch).

### Refusals

A call that can't be honoured — an unknown project, a repo with no `.wag/`, a state file that fails validation, an ambiguous branch, a malformed artifact — comes back as a normal, spoken response: an opener naming the problem, why it happened, and what to do about it. This is never the MCP `isError` flag; that's reserved for a genuinely unexpected failure (a GitHub outage, a bug), which is flagged as an error and asks for a retry.

### What's gone

The earlier `read_file` and `list_tree` tools are no longer registered on this surface — CV never sees raw repository access. That logic now lives as internal GitHub module operations under `lib/modules/github/`, reachable to the server but not advertised as tools.

## Architecture

- Next.js app with a single MCP route: `app/api/[transport]/route.ts` (endpoint: `/api/mcp`)
- [mcp-handler](https://github.com/vercel/mcp-handler) provides the streamable HTTP transport (serverless-friendly); the guide is also passed through as the MCP server's `instructions`
- `@octokit/rest` talks to GitHub with a server-side token, wrapped by `lib/modules/github/` — every response is validated with a zod schema before use
- `lib/wag/` is the engine: state and artifact validation, fact-gathering, phase/position derivation, rendering, and the ritual text read from `lib/wag/rituals/`

## Auth

The endpoint is public, so every request must carry a shared secret — either header works:

- `x-mcp-secret: <secret>`
- `Authorization: Bearer <secret>`

Claude custom connectors support custom request headers, so the secret is configured once in the connector dialog. The secret is checked before the environment is even read, so a misconfigured deploy never explains itself to an unauthenticated caller.

## Environment variables (Vercel, encrypted — never committed)

- `GITHUB_TOKEN` — GitHub token with `repo` scope
- `MCP_SHARED_SECRET` — the shared secret the connector must send
- `GITHUB_OWNER` — the GitHub account/org that owns every project repo (default: `samfreeman`)

## Tests

- `npm run typecheck` — TypeScript, no emit
- `npm test` — unit tests (`vitest run`), offline: derivation rules, state and artifact validation, rendering, the GitHub module against a stubbed client
- `npm run test:coverage` — unit tests with coverage
- `npm run test:live` — live tests against a deployed endpoint over streamable HTTP; self-skips unless `WAGC_ENDPOINT` and `WAGC_SECRET` are set (e.g. in a gitignored `.env.local`)

## Adding as a Claude connector

1. claude.ai → Settings → Connectors → Add custom connector
2. URL: `https://<deployment>.vercel.app/api/mcp`
3. Request headers: `x-mcp-secret: <secret>`
4. Connectors added on claude.ai are automatically available in the iOS/iPadOS apps
