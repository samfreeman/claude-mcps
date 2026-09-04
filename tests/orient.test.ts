import { describe, test, expect } from 'vitest'
import { orient } from '../lib/wag/orient'
import type { Deps } from '../lib/wag/types'
import type { Github } from '../lib/modules/github'
import type { State } from '../lib/wag/state'

const stateJson = (overrides: Partial<State> = {}) => JSON.stringify({
	app_name: 'claude-mcps',
	wag_version: '0.4.1',
	current_mode: null,
	active_epic: 'epic-001-wagc',
	active_pbi: '001',
	feature_branch: null,
	docs_page_path: null,
	...overrides
})

type GithubOptions = {
	repoExists?: boolean
	branches?: { name: string, head: string }[]
	stateText?: string | null
	treePaths?: string[]
	files?: Record<string, string | null>
}

const makeGithub = (opts: GithubOptions = {}): Github => ({
	owner: 'samfreeman',
	getRepo: async () => (opts.repoExists == false ? null : { exists: true }),
	listFeatureBranches: async () => opts.branches ?? [],
	getBranchHead: async () => ({ commit: 'commit-sha', tree: 'tree-sha' }),
	readFile: async (_repo, path) =>
		path == '.wag/state.json'
			? (opts.stateText ?? null)
			: (opts.files?.[path] ?? null),
	listTree: async () => null,
	listTreeRecursive: async () => ({
		paths: opts.treePaths ?? [],
		truncated: false
	}),
	findPullForBranch: async () => null,
	getCheckRollup: async () => 'none'
})

const makeRituals = () => ({
	read: async (name: string) => `RITUAL:${name}`
})

const content = (result: Awaited<ReturnType<typeof orient>>) => {
	const first = result.content[0] as { type: string, text?: string }
	if (first.type != 'text' || first.text == null)
		throw new Error('expected text content')
	return first.text
}

describe('orient', () => {
	test('an unknown repo renders unknown-project, naming the owner', async () => {
		const github = makeGithub({ repoExists: false })
		const deps: Deps = { github, rituals: makeRituals() }
		const result = await orient('claude-mcps', deps)
		const text = content(result)
		expect(text).toContain('claude-mcps')
		expect(text).toContain('samfreeman')
		expect('isError' in result).toBe(false)
	})

	test(
		'the happy path (approved ADR, no PR) carries the voice preamble ' +
			'and the dev ritual',
		async () => {
			const github = makeGithub({
				branches: [{ name: 'feature/PBI-001.001', head: 'sha1' }],
				stateText: stateJson({ feature_branch: 'feature/PBI-001.001' }),
				treePaths: ['.wag/state.json', '.wag/adr/active/ADR-001.001.md'],
				files: {
					'.wag/adr/active/ADR-001.001.md': '**Status:** approved\n'
				}
			})
			const deps: Deps = { github, rituals: makeRituals() }
			const result = await orient('claude-mcps', deps)
			const text = content(result)
			expect(text).toContain('## Ritual')
			expect(text).toContain('RITUAL:voice')
			expect(text).toContain('RITUAL:dev')
			expect('isError' in result).toBe(false)
		})

	test(
		'a gatherFacts refusal (two feature branches) renders as a refusal',
		async () => {
			const github = makeGithub({
				branches: [
					{ name: 'feature/PBI-001.001', head: 'sha1' },
					{ name: 'feature/PBI-001.002', head: 'sha2' }
				]
			})
			const deps: Deps = { github, rituals: makeRituals() }
			const result = await orient('claude-mcps', deps)
			const text = content(result)
			expect(text.startsWith('# refused')).toBe(true)
			expect(text).toContain('More than one feature branch')
			expect('isError' in result).toBe(false)
		})
})
