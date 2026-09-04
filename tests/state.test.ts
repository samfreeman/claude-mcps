import { describe, test, expect, beforeEach, afterEach, vi } from 'vitest'
import { readFileSync } from 'node:fs'
import { join } from 'node:path'
import { parseState } from '../lib/wag/state'
import { isRefusal } from '../lib/wag/refusal'

const project = 'claude-mcps'
const stateFixturePath = join(process.cwd(), '.wag', 'state.json')
const stateFixture = readFileSync(stateFixturePath, 'utf-8')

describe('parseState', () => {
	test('this repo\'s own state.json is valid', () => {
		const result = parseState(project, stateFixture)
		expect(isRefusal(result)).toBe(false)
	})

	test('missing app_name names the field', () => {
		const data = JSON.parse(stateFixture)
		delete data.app_name
		const result = parseState(project, JSON.stringify(data))
		expect(isRefusal(result)).toBe(true)
		if (isRefusal(result)) {
			expect(result.kind).toBe('invalid-state')
			expect(result.say).toContain(project)
			expect(result.say).toContain('app_name')
			expect(result.next[0]).not.toContain('/wag:update')
		}
	})

	test('missing wag_version names the field and points to /wag:update', () => {
		const data = JSON.parse(stateFixture)
		delete data.wag_version
		const result = parseState(project, JSON.stringify(data))
		expect(isRefusal(result)).toBe(true)
		if (isRefusal(result)) {
			expect(result.kind).toBe('invalid-state')
			expect(result.say).toContain('wag_version')
			expect(result.next.join(' ')).toContain('/wag:update')
		}
	})

	test('missing active_epic names the field and points to /wag:update', () => {
		const data = JSON.parse(stateFixture)
		delete data.active_epic
		const result = parseState(project, JSON.stringify(data))
		expect(isRefusal(result)).toBe(true)
		if (isRefusal(result)) {
			expect(result.kind).toBe('invalid-state')
			expect(result.say).toContain('active_epic')
			expect(result.next.join(' ')).toContain('/wag:update')
		}
	})

	test('missing active_pbi names the field', () => {
		const data = JSON.parse(stateFixture)
		delete data.active_pbi
		const result = parseState(project, JSON.stringify(data))
		expect(isRefusal(result)).toBe(true)
		if (isRefusal(result))
			expect(result.say).toContain('active_pbi')
	})

	test('missing feature_branch names the field', () => {
		const data = JSON.parse(stateFixture)
		delete data.feature_branch
		const result = parseState(project, JSON.stringify(data))
		expect(isRefusal(result)).toBe(true)
		if (isRefusal(result))
			expect(result.say).toContain('feature_branch')
	})

	test('an unknown key is refused, naming it', () => {
		const data = JSON.parse(stateFixture)
		data.mystery_field = 'nope'
		const result = parseState(project, JSON.stringify(data))
		expect(isRefusal(result)).toBe(true)
		if (isRefusal(result)) {
			expect(result.kind).toBe('invalid-state')
			expect(result.say).toContain('mystery_field')
		}
	})

	test('the current_mode fossil is tolerated when present as a string', () => {
		const data = JSON.parse(stateFixture)
		data.current_mode = 'dev'
		const result = parseState(project, JSON.stringify(data))
		expect(isRefusal(result)).toBe(false)
	})

	test('the current_mode fossil is tolerated when null', () => {
		const data = JSON.parse(stateFixture)
		data.current_mode = null
		const result = parseState(project, JSON.stringify(data))
		expect(isRefusal(result)).toBe(false)
	})

	test('the current_mode fossil is tolerated when absent', () => {
		const data = JSON.parse(stateFixture)
		delete data.current_mode
		const result = parseState(project, JSON.stringify(data))
		expect(isRefusal(result)).toBe(false)
	})

	test('malformed JSON is refused, with no field named', () => {
		const result = parseState(project, '{ this is not json')
		expect(isRefusal(result)).toBe(true)
		if (isRefusal(result)) {
			expect(result.kind).toBe('invalid-state')
			expect(result.say).toContain(project)
			expect(result.say).toContain('not valid JSON')
		}
	})
})

describe('parseEnv', () => {
	const original = {
		GITHUB_TOKEN: process.env.GITHUB_TOKEN,
		MCP_SHARED_SECRET: process.env.MCP_SHARED_SECRET,
		GITHUB_OWNER: process.env.GITHUB_OWNER
	}

	beforeEach(() => {
		vi.resetModules()
	})

	afterEach(() => {
		process.env.GITHUB_TOKEN = original.GITHUB_TOKEN
		process.env.MCP_SHARED_SECRET = original.MCP_SHARED_SECRET
		process.env.GITHUB_OWNER = original.GITHUB_OWNER
	})

	test(
		'valid environment parses, ignoring the rest of the ambient ' +
			'environment',
		async () => {
			process.env.GITHUB_TOKEN = 'ghp_test'
			process.env.MCP_SHARED_SECRET = 'shhh'
			process.env.GITHUB_OWNER = 'someone'
			const { parseEnv } = await import('../lib/wag/state')
			const result = parseEnv()
			expect(result.success).toBe(true)
			if (result.success)
				expect(result.data).toEqual({
					GITHUB_TOKEN: 'ghp_test',
					MCP_SHARED_SECRET: 'shhh',
					GITHUB_OWNER: 'someone'
				})
		})

	test('missing GITHUB_TOKEN fails', async () => {
		delete process.env.GITHUB_TOKEN
		process.env.MCP_SHARED_SECRET = 'shhh'
		const { parseEnv } = await import('../lib/wag/state')
		const result = parseEnv()
		expect(result.success).toBe(false)
	})

	test('missing MCP_SHARED_SECRET fails', async () => {
		process.env.GITHUB_TOKEN = 'ghp_test'
		delete process.env.MCP_SHARED_SECRET
		const { parseEnv } = await import('../lib/wag/state')
		const result = parseEnv()
		expect(result.success).toBe(false)
	})

	test('GITHUB_OWNER default is applied when omitted', async () => {
		process.env.GITHUB_TOKEN = 'ghp_test'
		process.env.MCP_SHARED_SECRET = 'shhh'
		delete process.env.GITHUB_OWNER
		const { parseEnv } = await import('../lib/wag/state')
		const result = parseEnv()
		expect(result.success).toBe(true)
		if (result.success)
			expect(result.data.GITHUB_OWNER).toBe('samfreeman')
	})

	test('a successful parse is memoised', async () => {
		process.env.GITHUB_TOKEN = 'first'
		process.env.MCP_SHARED_SECRET = 'shhh'
		const { parseEnv } = await import('../lib/wag/state')
		const first = parseEnv()
		process.env.GITHUB_TOKEN = 'second'
		const second = parseEnv()
		expect(second).toBe(first)
	})
})
