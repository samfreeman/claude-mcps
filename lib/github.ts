import { Octokit } from '@octokit/rest'
import { z } from 'zod'
import type { McpServer } from '@modelcontextprotocol/sdk/server/mcp.js'

const octokit = new Octokit({ auth: process.env.GITHUB_TOKEN })

const text = (value: string) => ({
	content: [{ type: 'text' as const, text: value }]
})

const error = (value: string) => ({
	content: [{ type: 'text' as const, text: value }],
	isError: true
})

const message = (e: unknown) =>
	e instanceof Error
		? e.message
		: String(e)

export const registerGithubTools = (server: McpServer) => {
	server.registerTool(
		'read_file',
		{
			title: 'Read GitHub File',
			description: 'Read a file from a GitHub repository and return its body as plain inline text',
			inputSchema: {
				repo: z.string().describe('Repository name'),
				path: z.string().describe('File path within the repository'),
				owner: z.string().default('samfreeman').describe('Repository owner (default: samfreeman)'),
				ref: z.string().optional().describe('Branch, tag, or commit SHA (default: the default branch)')
			}
		},
		async ({ owner, repo, path, ref }) => {
			try {
				const res = await octokit.repos.getContent({ owner, repo, path, ref })
				if (Array.isArray(res.data))
					return error(`'${path}' is a directory - use list_tree instead`)
				if (res.data.type != 'file')
					return error(`'${path}' is a ${res.data.type}, not a file`)
				const body = Buffer.from(res.data.content, 'base64').toString('utf-8')
				return text(body)
			}
			catch (e) {
				return error(`read_file failed: ${message(e)}`)
			}
		})

	server.registerTool(
		'list_tree',
		{
			title: 'List GitHub Directory',
			description: 'List the entries of a directory in a GitHub repository',
			inputSchema: {
				repo: z.string().describe('Repository name'),
				path: z.string().default('').describe('Directory path within the repository (default: repo root)'),
				owner: z.string().default('samfreeman').describe('Repository owner (default: samfreeman)'),
				ref: z.string().optional().describe('Branch, tag, or commit SHA (default: the default branch)')
			}
		},
		async ({ owner, repo, path, ref }) => {
			try {
				const res = await octokit.repos.getContent({ owner, repo, path, ref })
				if (!Array.isArray(res.data))
					return error(`'${path}' is a file - use read_file instead`)
				const lines = res.data.map(entry =>
					`${entry.type == 'dir' ? 'dir ' : 'file'}  ${entry.path}${entry.type == 'file' ? `  (${entry.size} bytes)` : ''}`)
				return text(lines.length > 0
					? lines.join('\n')
					: '(empty directory)')
			}
			catch (e) {
				return error(`list_tree failed: ${message(e)}`)
			}
		})
}
