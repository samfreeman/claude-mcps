# claude-mcps

One remote MCP server, hosted on Vercel, reachable from every Claude surface (phone, iPad, desktop) as a custom connector. Each capability is a module mounted under the one server — adding a capability = new module + redeploy, not a new deployment.

## Why

The built-in GitHub connector cannot read file bodies from mobile (returns an unreadable resource blob), cannot create repos, and cannot write files. This server carries a GitHub token server-side and returns file bodies as plain inline text.

## Modules

- **github** (`lib/github.ts`)
  - `read_file` — return a file's body as inline UTF-8 text (base64-decoded server-side)
  - `list_tree` — list a directory's entries

## Architecture

- Next.js app with a single MCP route: `app/api/[transport]/route.ts` (endpoint: `/api/mcp`)
- [mcp-handler](https://github.com/vercel/mcp-handler) provides the streamable HTTP transport (serverless-friendly)
- `@octokit/rest` talks to GitHub with a server-side token

## Auth

The endpoint is public, so every request must carry a shared secret — either header works:

- `x-mcp-secret: <secret>`
- `Authorization: Bearer <secret>`

Claude custom connectors support custom request headers, so the secret is configured once in the connector dialog.

## Environment variables (Vercel, encrypted — never committed)

- `GITHUB_TOKEN` — GitHub token with `repo` scope
- `MCP_SHARED_SECRET` — the shared secret the connector must send

## Adding as a Claude connector

1. claude.ai → Settings → Connectors → Add custom connector
2. URL: `https://<deployment>.vercel.app/api/mcp`
3. Request headers: `x-mcp-secret: <secret>`
4. Connectors added on claude.ai are automatically available in the iOS/iPadOS apps
