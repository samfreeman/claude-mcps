import { describe, test, expect, vi } from 'vitest'
import type { McpServer } from '@modelcontextprotocol/sdk/server/mcp.js'
import { registerWagc } from '../lib/wag/entry'
import type { Deps } from '../lib/wag/types'
import type { Github } from '../lib/modules/github'

const notCalled = (name: string) =>
	async () => {
		throw new Error(`${name} should not have been called`)
	}

const makeGithub = (overrides: Partial<Github> = {}): Github => ({
	owner: 'samfreeman',
	getRepo: notCalled('getRepo'),
	listFeatureBranches: notCalled('listFeatureBranches'),
	getBranchHead: notCalled('getBranchHead'),
	readFile: notCalled('readFile'),
	listTree: notCalled('listTree'),
	listTreeRecursive: notCalled('listTreeRecursive'),
	findPullForBranch: notCalled('findPullForBranch'),
	getCheckRollup: notCalled('getCheckRollup'),
	...overrides
})

const makeRituals = (read = async (name: string) => `RITUAL:${name}`) => ({
	read
})

type Handler = (args: {
	project?: string
	continuation?: string
	payload?: Record<string, unknown>
}) => Promise<{ content: { type: string, text?: string }[], isError?: boolean }>

const register = (deps: Deps) => {
	const registerTool = vi.fn()
	const server = { registerTool } as unknown as McpServer
	registerWagc(server, deps)
	return registerTool
}

const textOf = (result: { content: { type: string, text?: string }[] }) => {
	const first = result.content[0]
	if (first.type != 'text' || first.text == null)
		throw new Error('expected text content')
	return first.text
}

describe('registerWagc', () => {
	test('registers exactly one tool, named wagc', () => {
		const deps: Deps = { github: makeGithub(), rituals: makeRituals() }
		const registerTool = register(deps)
		expect(registerTool).toHaveBeenCalledTimes(1)
		expect(registerTool.mock.calls[0][0]).toBe('wagc')
	})

	test('the input schema has exactly project, continuation and payload', () => {
		const deps: Deps = { github: makeGithub(), rituals: makeRituals() }
		const registerTool = register(deps)
		const config = registerTool.mock.calls[0][1] as {
			inputSchema: Record<string, unknown>
		}
		expect(Object.keys(config.inputSchema).sort()).toEqual(
			['continuation', 'payload', 'project'])
	})

	test(
		'a continuation refuses as not-yet-available, without isError',
		async () => {
			const deps: Deps = { github: makeGithub(), rituals: makeRituals() }
			const registerTool = register(deps)
			const handler = registerTool.mock.calls[0][2] as Handler
			const result = await handler({
				continuation: 'approve', project: 'x'
			})
			expect(textOf(result)).toContain('approve')
			expect(textOf(result)).toContain('isn\'t available')
			expect(result.isError).toBeUndefined()
		})

	test('no arguments returns the guide text', async () => {
		const deps: Deps = { github: makeGithub(), rituals: makeRituals() }
		const registerTool = register(deps)
		const handler = registerTool.mock.calls[0][2] as Handler
		const result = await handler({})
		expect(textOf(result)).toBe('RITUAL:guide')
		expect(result.isError).toBeUndefined()
	})

	test(
		'an Error thrown by the github module names its operation',
		async () => {
			const github = makeGithub({
				getRepo: async () => {
					throw new Error('getRepo: boom')
				}
			})
			const deps: Deps = { github, rituals: makeRituals() }
			const registerTool = register(deps)
			const handler = registerTool.mock.calls[0][2] as Handler
			const result = await handler({ project: 'x' })
			expect(result.isError).toBe(true)
			expect(textOf(result)).toContain('failed while getRepo')
		})

	test(
		'an unlabelled throw (e.g. a TypeError) falls back to a generic ' +
			'operation name',
		async () => {
			const github = makeGithub({
				getRepo: async () => {
					throw new TypeError('Cannot read properties of undefined')
				}
			})
			const deps: Deps = { github, rituals: makeRituals() }
			const registerTool = register(deps)
			const handler = registerTool.mock.calls[0][2] as Handler
			const result = await handler({ project: 'x' })
			expect(result.isError).toBe(true)
			expect(textOf(result)).toContain('failed while reading the project')
		})

	test('a rejected guide read is reported and flagged isError', async () => {
		const rituals = makeRituals(async () => {
			throw new Error('disk on fire')
		})
		const deps: Deps = { github: makeGithub(), rituals }
		const registerTool = register(deps)
		const handler = registerTool.mock.calls[0][2] as Handler
		const result = await handler({})
		expect(result.isError).toBe(true)
		expect(textOf(result)).toContain('reading the guide')
	})
})
