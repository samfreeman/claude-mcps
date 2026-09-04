import { Octokit } from '@octokit/rest'
import { createMcpHandler } from 'mcp-handler'
import { createGithub } from '../../../lib/modules/github'
import { registerWagc } from '../../../lib/wag/entry'
import { readRitual } from '../../../lib/wag/rituals'
import { parseEnv, type Env } from '../../../lib/wag/state'

export const maxDuration = 60

let cachedHandler: ((req: Request) => Promise<Response>) | null = null

const getHandler = async (env: Env) => {
	if (cachedHandler != null)
		return cachedHandler
	const octokit = new Octokit({ auth: env.GITHUB_TOKEN })
	const github = createGithub(octokit, env.GITHUB_OWNER)
	const guide = await readRitual('guide')
	const deps = { github, rituals: { read: readRitual } }
	cachedHandler = createMcpHandler(
		server => registerWagc(server, deps),
		{
			instructions: guide,
			serverInfo: { name: 'claude-mcps', version: '0.1.0' }
		},
		{
			basePath: '/api',
			maxDuration: 60
		})
	return cachedHandler
}

const withAuth = async (req: Request) => {
	const secret = process.env.MCP_SHARED_SECRET
	const supplied = req.headers.get('x-mcp-secret')
		?? req.headers.get('authorization')?.replace(/^Bearer\s+/i, '')
	if (secret == null || secret == '' || supplied != secret)
		return new Response('Unauthorized', { status: 401 })

	const env = parseEnv()
	if (!env.success) {
		const name = env.error.issues[0].path.join('.')
		return new Response(
			`Missing or invalid environment variable: ${name}`,
			{ status: 500 })
	}

	try {
		const handler = await getHandler(env.data)
		return await handler(req)
	}
	catch (e) {
		console.error(e)
		return new Response('Internal error', { status: 500 })
	}
}

export { withAuth as GET, withAuth as POST }
