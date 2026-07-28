import { createMcpHandler } from 'mcp-handler'
import { registerGithubTools } from '../../../lib/github'

export const maxDuration = 60

const handler = createMcpHandler(
	server =>
		registerGithubTools(server),
	{},
	{
		basePath: '/api',
		maxDuration: 60
	})

const withAuth = (req: Request) => {
	const secret = process.env.MCP_SHARED_SECRET
	const supplied = req.headers.get('x-mcp-secret')
		?? req.headers.get('authorization')?.replace(/^Bearer\s+/i, '')
	if (secret == null || secret == '' || supplied != secret)
		return new Response('Unauthorized', { status: 401 })
	return handler(req)
}

export { withAuth as GET, withAuth as POST }
