import { z } from 'zod'
import type { McpServer } from '@modelcontextprotocol/sdk/server/mcp.js'
import type { Deps } from './types'
import { orient } from './orient'
import { refusal } from './refusal'
import { render } from './render'

const description =
	'wag in the cloud. Build a project end to end by voice: discovery, ' +
	'docs, ADR, dev run, review, merge. Call with no arguments to get ' +
	'the guide. Call with a project name to hear where it is and what ' +
	'comes next. Call with a continuation only when the previous ' +
	'response told you to.'

const projectDescription =
	'Project name, which is also its repo name, e.g. gigger. Omit for ' +
	'the guide.'

const continuationDescription =
	'Omit to orient. approve = phase complete, act and advance. ' +
	'snag = halt on an upstream doc defect. save = record work so far.'

const payloadDescription =
	'What the continuation carries. The orient response tells you ' +
	'exactly what to put here.'

const operationPrefix = /^[A-Za-z]+$/

const operationOf = (e: unknown) => {
	if (!(e instanceof Error))
		return 'reading the project'
	const prefix = e.message.split(':')[0]
	return operationPrefix.test(prefix) ? prefix : 'reading the project'
}

export const registerWagc = (server: McpServer, deps: Deps) => {
	server.registerTool(
		'wagc',
		{
			title: 'wagc',
			description,
			inputSchema: {
				project: z.string().regex(/^[A-Za-z0-9._-]{1,100}$/).optional()
					.describe(projectDescription),
				continuation: z.enum(['approve', 'snag', 'save']).optional()
					.describe(continuationDescription),
				payload: z.record(z.unknown()).optional()
					.describe(payloadDescription)
			}
		},
		async ({ project, continuation }) => {
			if (continuation != null)
				return render(refusal.notYetAvailable(continuation))
			try {
				if (project == null) {
					const guide = await deps.rituals.read('guide')
					return { content: [{ type: 'text' as const, text: guide }] }
				}
				return await orient(project, deps)
			}
			catch (e) {
				console.error(e)
				const text = project == null
					? 'wagc failed while reading the guide. Try again.'
					: `Orient on ${project} failed while ${operationOf(e)}. ` +
						'Try again.'
				return {
					content: [{ type: 'text' as const, text }],
					isError: true
				}
			}
		})
}
