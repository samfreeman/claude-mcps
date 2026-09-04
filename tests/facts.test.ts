import { describe, test, expect } from 'vitest'
import { gatherFacts } from '../lib/wag/facts'
import { derive } from '../lib/wag/derive'
import { isRefusal } from '../lib/wag/refusal'
import type { CheckRollup } from '../lib/wag/types'
import type { State } from '../lib/wag/state'
import type { Github } from '../lib/modules/github'

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

type StubPr = {
	number: number
	url: string
	title: string
	state: 'open' | 'merged'
	head: string
}

type StubOptions = {
	branches?: { name: string, head: string }[]
	branchHead?: { commit: string, tree: string } | null
	stateText?: string | null
	treePaths?: string[]
	truncated?: boolean
	files?: Record<string, string | null>
	pr?: StubPr | null
	checkRollup?: CheckRollup
}

const makeGithub = (opts: StubOptions): Github => ({
	owner: 'samfreeman',
	getRepo: async () => ({ exists: true }),
	listFeatureBranches: async () => opts.branches ?? [],
	getBranchHead: async () =>
		'branchHead' in opts
			? (opts.branchHead ?? null)
			: { commit: 'commit-sha', tree: 'tree-sha' },
	readFile: async (_repo, path) =>
		path == '.wag/state.json'
			? (opts.stateText ?? null)
			: (opts.files?.[path] ?? null),
	listTree: async () => null,
	listTreeRecursive: async () => ({
		paths: opts.treePaths ?? [],
		truncated: opts.truncated ?? false
	}),
	findPullForBranch: async () => opts.pr ?? null,
	getCheckRollup: async () => opts.checkRollup ?? 'none'
})

test('two feature branches is refused as ambiguous', async () => {
	const github = makeGithub({
		branches: [
			{ name: 'feature/PBI-001.001', head: 'sha1' },
			{ name: 'feature/PBI-001.002', head: 'sha2' }
		]
	})
	const result = await gatherFacts('claude-mcps', github)
	expect(isRefusal(result)).toBe(true)
	if (isRefusal(result))
		expect(result.kind).toBe('ambiguous-branch')
})

test(
	'a feature branch whose state disagrees is refused, naming ' +
		'feature_branch',
	async () => {
		const github = makeGithub({
			branches: [{ name: 'feature/PBI-001.001', head: 'sha1' }],
			stateText: stateJson({ feature_branch: null }),
			treePaths: ['.wag/state.json']
		})
		const result = await gatherFacts('claude-mcps', github)
		expect(isRefusal(result)).toBe(true)
		if (isRefusal(result)) {
			expect(result.kind).toBe('invalid-state')
			expect(result.say).toContain('feature_branch')
		}
	})

test(
	'a feature branch with no active ADR gathers cleanly, and derive ' +
		'refuses it',
	async () => {
		const github = makeGithub({
			branches: [{ name: 'feature/PBI-001.001', head: 'sha1' }],
			stateText: stateJson({ feature_branch: 'feature/PBI-001.001' }),
			treePaths: ['.wag/state.json']
		})
		const result = await gatherFacts('claude-mcps', github)
		expect(isRefusal(result)).toBe(false)
		if (!isRefusal(result)) {
			expect(result.adr).toBeNull()
			expect(result.branch?.name).toBe('feature/PBI-001.001')
			const derived = derive(result)
			expect(isRefusal(derived)).toBe(true)
			if (isRefusal(derived))
				expect(derived.kind).toBe('branch-without-adr')
		}
	})

test('two active ADR files is refused as unreadable', async () => {
	const github = makeGithub({
		branches: [{ name: 'feature/PBI-001.001', head: 'sha1' }],
		stateText: stateJson({ feature_branch: 'feature/PBI-001.001' }),
		treePaths: [
			'.wag/state.json',
			'.wag/adr/active/ADR-001.001.md',
			'.wag/adr/active/ADR-001.002.md'
		]
	})
	const result = await gatherFacts('claude-mcps', github)
	expect(isRefusal(result)).toBe(true)
	if (isRefusal(result))
		expect(result.kind).toBe('unreadable-artifact')
})

test('an ADR file that cannot be read is refused as unreadable', async () => {
	const github = makeGithub({
		branches: [{ name: 'feature/PBI-001.001', head: 'sha1' }],
		stateText: stateJson({ feature_branch: 'feature/PBI-001.001' }),
		treePaths: ['.wag/state.json', '.wag/adr/active/ADR-001.001.md'],
		files: { '.wag/adr/active/ADR-001.001.md': null }
	})
	const result = await gatherFacts('claude-mcps', github)
	expect(isRefusal(result)).toBe(true)
	if (isRefusal(result)) {
		expect(result.kind).toBe('unreadable-artifact')
		expect(result.why[0]).toContain('.wag/adr/active/ADR-001.001.md')
	}
})

test(
	'a closed unmerged PR (the module already reports it as none) ' +
		'leaves pr null',
	async () => {
		const github = makeGithub({
			branches: [{ name: 'feature/PBI-001.001', head: 'sha1' }],
			stateText: stateJson({ feature_branch: 'feature/PBI-001.001' }),
			treePaths: ['.wag/state.json', '.wag/adr/active/ADR-001.001.md'],
			files: { '.wag/adr/active/ADR-001.001.md': '**Status:** approved\n' },
			pr: null
		})
		const result = await gatherFacts('claude-mcps', github)
		expect(isRefusal(result)).toBe(false)
		if (!isRefusal(result))
			expect(result.pr).toBeNull()
	})

test(
	'a merged PR with the branch still present reports pr state merged',
	async () => {
		const github = makeGithub({
			branches: [{ name: 'feature/PBI-001.001', head: 'sha1' }],
			stateText: stateJson({ feature_branch: 'feature/PBI-001.001' }),
			treePaths: ['.wag/state.json', '.wag/adr/active/ADR-001.001.md'],
			files: { '.wag/adr/active/ADR-001.001.md': '**Status:** approved\n' },
			pr: { number: 5, url: 'u', title: 't', state: 'merged', head: 'h' },
			checkRollup: 'green'
		})
		const result = await gatherFacts('claude-mcps', github)
		expect(isRefusal(result)).toBe(false)
		if (!isRefusal(result)) {
			expect(result.pr).toEqual({
				number: 5,
				url: 'u',
				title: 't',
				state: 'merged',
				checks: 'green'
			})
			expect(result.branch?.name).toBe('feature/PBI-001.001')
		}
	})

test('a truncated tree is refused', async () => {
	const github = makeGithub({
		branches: [],
		stateText: stateJson(),
		treePaths: ['.wag/state.json'],
		truncated: true
	})
	const result = await gatherFacts('claude-mcps', github)
	expect(isRefusal(result)).toBe(true)
	if (isRefusal(result))
		expect(result.kind).toBe('listing-truncated')
})

test(
	'a truncated listing is reported even when it also looks empty',
	async () => {
		const github = makeGithub({
			branches: [],
			stateText: stateJson(),
			treePaths: [],
			truncated: true
		})
		const result = await gatherFacts('claude-mcps', github)
		expect(isRefusal(result)).toBe(true)
		if (isRefusal(result))
			expect(result.kind).toBe('listing-truncated')
	})

test(
	'no branch head at all (e.g. dev is missing) is refused as not a ' +
		'wag project (no-wag-dir)',
	async () => {
		const github = makeGithub({
			branches: [],
			branchHead: null,
			stateText: null,
			treePaths: []
		})
		const result = await gatherFacts('claude-mcps', github)
		expect(isRefusal(result)).toBe(true)
		if (isRefusal(result)) {
			expect(result.kind).toBe('not-a-wag-project')
			expect(result.say).toContain('no .wag/ directory')
		}
	})

test(
	'no .wag/ tree entries is refused as not a wag project (no-wag-dir)',
	async () => {
		const github = makeGithub({
			branches: [],
			stateText: null,
			treePaths: []
		})
		const result = await gatherFacts('claude-mcps', github)
		expect(isRefusal(result)).toBe(true)
		if (isRefusal(result)) {
			expect(result.kind).toBe('not-a-wag-project')
			expect(result.say).toContain('no .wag/ directory')
		}
	})

test(
	'a .wag/ directory with no state.json is refused as not a wag ' +
		'project (no-state-file)',
	async () => {
		const github = makeGithub({
			branches: [],
			stateText: null,
			treePaths: ['.wag/adr/active/ADR-001.001.md']
		})
		const result = await gatherFacts('claude-mcps', github)
		expect(isRefusal(result)).toBe(true)
		if (isRefusal(result)) {
			expect(result.kind).toBe('not-a-wag-project')
			expect(result.say).toContain('no state file')
		}
	})

test('only resolved snags means no open snags', async () => {
	const github = makeGithub({
		branches: [],
		stateText: stateJson(),
		treePaths: ['.wag/state.json', '.wag/snags/_resolved/SNAG-001.md']
	})
	const result = await gatherFacts('claude-mcps', github)
	expect(isRefusal(result)).toBe(false)
	if (!isRefusal(result))
		expect(result.snags).toEqual([])
})

test(
	'a review file for a different PBI than the active ADR leaves ' +
		'review null',
	async () => {
		const github = makeGithub({
			branches: [{ name: 'feature/PBI-001.001', head: 'sha1' }],
			stateText: stateJson({ feature_branch: 'feature/PBI-001.001' }),
			treePaths: [
				'.wag/state.json',
				'.wag/adr/active/ADR-001.001.md',
				'.wag/reviews/REVIEW-001.002-001.md'
			],
			files: {
				'.wag/adr/active/ADR-001.001.md': '**Status:** approved\n',
				'.wag/reviews/REVIEW-001.002-001.md': '**Verdict:** APPROVE\n'
			}
		})
		const result = await gatherFacts('claude-mcps', github)
		expect(isRefusal(result)).toBe(false)
		if (!isRefusal(result))
			expect(result.review).toBeNull()
	})

test('a state file carrying the current_mode fossil is accepted', async () => {
	const github = makeGithub({
		branches: [],
		stateText: stateJson({ current_mode: 'dev' }),
		treePaths: ['.wag/state.json']
	})
	const result = await gatherFacts('claude-mcps', github)
	expect(isRefusal(result)).toBe(false)
})

describe('pick', () => {
	test('is null when a feature branch is present', async () => {
		const github = makeGithub({
			branches: [{ name: 'feature/PBI-001.001', head: 'sha1' }],
			stateText: stateJson({ feature_branch: 'feature/PBI-001.001' }),
			treePaths: ['.wag/state.json', '.wag/adr/active/ADR-001.001.md'],
			files: { '.wag/adr/active/ADR-001.001.md': '**Status:** approved\n' }
		})
		const result = await gatherFacts('claude-mcps', github)
		expect(isRefusal(result)).toBe(false)
		if (!isRefusal(result))
			expect(result.pick).toBeNull()
	})

	test('is computed when there is no feature branch', async () => {
		const pbiPath = '.wag/backlog/epic-001-wagc/PBI-002.md'
		const github = makeGithub({
			branches: [],
			stateText: stateJson(),
			treePaths: ['.wag/state.json', pbiPath],
			files: {
				[pbiPath]:
					'# PBI 001.002: Another slice\n\n**Priority:** P1\n' +
					'**Dependencies:** None\n'
			}
		})
		const result = await gatherFacts('claude-mcps', github)
		expect(isRefusal(result)).toBe(false)
		if (!isRefusal(result)) {
			expect(result.pick).not.toBeNull()
			expect(result.pick?.eligible.length).toBe(1)
			expect(result.pick?.suggested?.id).toEqual({ epic: '001', pbi: '002' })
		}
	})
})
