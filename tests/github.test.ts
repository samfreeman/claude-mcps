import { describe, test, expect, vi } from 'vitest'
import { createGithub } from '../lib/modules/github'

const owner = 'samfreeman'
const repo = 'claude-mcps'

const makeOctokit = () => ({
	repos: {
		get: vi.fn(),
		listBranches: vi.fn(),
		getBranch: vi.fn(),
		getContent: vi.fn()
	},
	git: {
		getTree: vi.fn()
	},
	pulls: {
		list: vi.fn()
	},
	checks: {
		listForRef: vi.fn()
	}
})

const notFound = { status: 404 }

describe('getRepo', () => {
	test('exists', async () => {
		const octokit = makeOctokit()
		octokit.repos.get.mockResolvedValue({ data: { id: 123456 } })
		const github = createGithub(octokit, owner)
		expect(await github.getRepo(repo)).toEqual({ exists: true })
	})

	test('404 returns null', async () => {
		const octokit = makeOctokit()
		octokit.repos.get.mockRejectedValue(notFound)
		const github = createGithub(octokit, owner)
		expect(await github.getRepo(repo)).toBeNull()
	})

	test('malformed response refused', async () => {
		const octokit = makeOctokit()
		octokit.repos.get.mockResolvedValue({ data: { name: 'claude-mcps' } })
		const github = createGithub(octokit, owner)
		await expect(github.getRepo(repo)).rejects.toThrow(/^getRepo:/)
	})
})

describe('listFeatureBranches', () => {
	test('filters to feature/PBI-* and maps head', async () => {
		const octokit = makeOctokit()
		octokit.repos.listBranches.mockResolvedValue({
			data: [
				{ name: 'dev', commit: { sha: 'devsha' } },
				{ name: 'feature/PBI-001.001', commit: { sha: 'featsha' } },
				{ name: 'main', commit: { sha: 'mainsha' } }
			]
		})
		const github = createGithub(octokit, owner)
		expect(await github.listFeatureBranches(repo)).toEqual([
			{ name: 'feature/PBI-001.001', head: 'featsha' }
		])
	})

	test('none match returns empty array', async () => {
		const octokit = makeOctokit()
		octokit.repos.listBranches.mockResolvedValue({
			data: [{ name: 'dev', commit: { sha: 'devsha' } }]
		})
		const github = createGithub(octokit, owner)
		expect(await github.listFeatureBranches(repo)).toEqual([])
	})

	test('malformed response refused', async () => {
		const octokit = makeOctokit()
		octokit.repos.listBranches.mockResolvedValue({ data: [{ name: 'dev' }] })
		const github = createGithub(octokit, owner)
		await expect(github.listFeatureBranches(repo))
			.rejects.toThrow(/^listFeatureBranches:/)
	})
})

describe('getBranchHead', () => {
	test('returns commit and tree sha', async () => {
		const octokit = makeOctokit()
		octokit.repos.getBranch.mockResolvedValue({
			data: {
				commit: { sha: 'commitsha', commit: { tree: { sha: 'treesha' } } }
			}
		})
		const github = createGithub(octokit, owner)
		expect(await github.getBranchHead(repo, 'dev')).toEqual({
			commit: 'commitsha',
			tree: 'treesha'
		})
	})

	test('404 returns null', async () => {
		const octokit = makeOctokit()
		octokit.repos.getBranch.mockRejectedValue(notFound)
		const github = createGithub(octokit, owner)
		expect(await github.getBranchHead(repo, 'feature/PBI-999.001'))
			.toBeNull()
	})

	test('malformed response refused', async () => {
		const octokit = makeOctokit()
		octokit.repos.getBranch.mockResolvedValue({
			data: { commit: { sha: 'commitsha' } }
		})
		const github = createGithub(octokit, owner)
		await expect(github.getBranchHead(repo, 'dev'))
			.rejects.toThrow(/^getBranchHead:/)
	})
})

describe('readFile', () => {
	test('decodes base64 content', async () => {
		const octokit = makeOctokit()
		octokit.repos.getContent.mockResolvedValue({
			data: {
				type: 'file',
				encoding: 'base64',
				content: Buffer.from('hello').toString('base64')
			}
		})
		const github = createGithub(octokit, owner)
		expect(await github.readFile(repo, '.wag/state.json', 'dev'))
			.toBe('hello')
	})

	test('404 returns null', async () => {
		const octokit = makeOctokit()
		octokit.repos.getContent.mockRejectedValue(notFound)
		const github = createGithub(octokit, owner)
		expect(await github.readFile(repo, '.wag/state.json', 'dev'))
			.toBeNull()
	})

	test('malformed response refused', async () => {
		const octokit = makeOctokit()
		octokit.repos.getContent.mockResolvedValue({
			data: { type: 'file', encoding: 'base64', content: 12345 }
		})
		const github = createGithub(octokit, owner)
		await expect(github.readFile(repo, '.wag/state.json', 'dev'))
			.rejects.toThrow(/^readFile:/)
	})

	test('a non-base64 encoding is refused', async () => {
		const octokit = makeOctokit()
		octokit.repos.getContent.mockResolvedValue({
			data: { type: 'file', encoding: 'utf-8', content: 'hello' }
		})
		const github = createGithub(octokit, owner)
		await expect(github.readFile(repo, '.wag/state.json', 'dev'))
			.rejects.toThrow(
				'readFile: unexpected response shape: ' +
					'encoding utf-8 is not base64')
	})
})

describe('listTree', () => {
	test('lists directory entries', async () => {
		const octokit = makeOctokit()
		octokit.repos.getContent.mockResolvedValue({
			data: [
				{ type: 'file', path: '.wag/state.json', size: 200 },
				{ type: 'dir', path: '.wag/adr' }
			]
		})
		const github = createGithub(octokit, owner)
		expect(await github.listTree(repo, '.wag', 'dev')).toEqual([
			{ path: '.wag/state.json', type: 'file', size: 200 },
			{ path: '.wag/adr', type: 'dir', size: undefined }
		])
	})

	test('404 returns null', async () => {
		const octokit = makeOctokit()
		octokit.repos.getContent.mockRejectedValue(notFound)
		const github = createGithub(octokit, owner)
		expect(await github.listTree(repo, '.wag', 'dev')).toBeNull()
	})

	test('malformed response refused', async () => {
		const octokit = makeOctokit()
		octokit.repos.getContent.mockResolvedValue({ data: [{ type: 'file' }] })
		const github = createGithub(octokit, owner)
		await expect(github.listTree(repo, '.wag', 'dev'))
			.rejects.toThrow(/^listTree:/)
	})

	test('a symlink entry is refused', async () => {
		const octokit = makeOctokit()
		octokit.repos.getContent.mockResolvedValue({
			data: [{ type: 'symlink', path: '.wag/link' }]
		})
		const github = createGithub(octokit, owner)
		await expect(github.listTree(repo, '.wag', 'dev'))
			.rejects.toThrow(/^listTree:/)
	})

	test('a submodule entry is refused', async () => {
		const octokit = makeOctokit()
		octokit.repos.getContent.mockResolvedValue({
			data: [{ type: 'submodule', path: '.wag/sub' }]
		})
		const github = createGithub(octokit, owner)
		await expect(github.listTree(repo, '.wag', 'dev'))
			.rejects.toThrow(/^listTree:/)
	})
})

describe('listTreeRecursive', () => {
	test('filters paths by prefix and reports truncated', async () => {
		const octokit = makeOctokit()
		octokit.git.getTree.mockResolvedValue({
			data: {
				truncated: false,
				tree: [
					{ path: '.wag/state.json' },
					{ path: 'lib/wag/derive.ts' },
					{ path: '.wag/adr/active/ADR-001.001.md' }
				]
			}
		})
		const github = createGithub(octokit, owner)
		expect(await github.listTreeRecursive(repo, 'treesha', '.wag/'))
			.toEqual({
				paths: ['.wag/state.json', '.wag/adr/active/ADR-001.001.md'],
				truncated: false
			})
	})

	test('reports truncated true', async () => {
		const octokit = makeOctokit()
		octokit.git.getTree.mockResolvedValue({
			data: { truncated: true, tree: [{ path: '.wag/state.json' }] }
		})
		const github = createGithub(octokit, owner)
		const result = await github.listTreeRecursive(repo, 'treesha', '.wag/')
		expect(result.truncated).toBe(true)
	})

	test('malformed response refused', async () => {
		const octokit = makeOctokit()
		octokit.git.getTree.mockResolvedValue({
			data: { tree: [{ path: '.wag/state.json' }] }
		})
		const github = createGithub(octokit, owner)
		await expect(github.listTreeRecursive(repo, 'treesha', '.wag/'))
			.rejects.toThrow(/^listTreeRecursive:/)
	})
})

describe('findPullForBranch', () => {
	test('prefers an open pull', async () => {
		const octokit = makeOctokit()
		octokit.pulls.list.mockResolvedValue({
			data: [
				{
					number: 1,
					state: 'closed',
					merged_at: '2026-01-01T00:00:00Z',
					html_url: 'u1',
					title: 'old',
					head: { sha: 'sha1' }
				},
				{
					number: 2,
					state: 'open',
					merged_at: null,
					html_url: 'u2',
					title: 'current',
					head: { sha: 'sha2' }
				}
			]
		})
		const github = createGithub(octokit, owner)
		expect(await github.findPullForBranch(repo, 'feature/PBI-001.001'))
			.toEqual({
				number: 2, url: 'u2', title: 'current', state: 'open', head: 'sha2'
			})
	})

	test('falls back to the most recently merged pull', async () => {
		const octokit = makeOctokit()
		octokit.pulls.list.mockResolvedValue({
			data: [
				{
					number: 1,
					state: 'closed',
					merged_at: '2026-01-01T00:00:00Z',
					html_url: 'u1',
					title: 'older',
					head: { sha: 'sha1' }
				},
				{
					number: 2,
					state: 'closed',
					merged_at: '2026-02-01T00:00:00Z',
					html_url: 'u2',
					title: 'newer',
					head: { sha: 'sha2' }
				}
			]
		})
		const github = createGithub(octokit, owner)
		expect(await github.findPullForBranch(repo, 'feature/PBI-001.001'))
			.toEqual({
				number: 2, url: 'u2', title: 'newer', state: 'merged', head: 'sha2'
			})
	})

	test('closed unmerged pull is ignored, returns null', async () => {
		const octokit = makeOctokit()
		octokit.pulls.list.mockResolvedValue({
			data: [
				{
					number: 1,
					state: 'closed',
					merged_at: null,
					html_url: 'u1',
					title: 'abandoned',
					head: { sha: 'sha1' }
				}
			]
		})
		const github = createGithub(octokit, owner)
		expect(await github.findPullForBranch(repo, 'feature/PBI-001.001'))
			.toBeNull()
	})

	test('no pulls returns null', async () => {
		const octokit = makeOctokit()
		octokit.pulls.list.mockResolvedValue({ data: [] })
		const github = createGithub(octokit, owner)
		expect(await github.findPullForBranch(repo, 'feature/PBI-001.001'))
			.toBeNull()
	})

	test('malformed response refused', async () => {
		const octokit = makeOctokit()
		octokit.pulls.list.mockResolvedValue({ data: [{ number: 1, state: 'open' }] })
		const github = createGithub(octokit, owner)
		await expect(github.findPullForBranch(repo, 'feature/PBI-001.001'))
			.rejects.toThrow(/^findPullForBranch:/)
	})
})

describe('getCheckRollup', () => {
	test('no runs is none', async () => {
		const octokit = makeOctokit()
		octokit.checks.listForRef.mockResolvedValue({ data: { check_runs: [] } })
		const github = createGithub(octokit, owner)
		expect(await github.getCheckRollup(repo, 'sha')).toBe('none')
	})

	test('all completed and successful is green', async () => {
		const octokit = makeOctokit()
		octokit.checks.listForRef.mockResolvedValue({
			data: { check_runs: [{ status: 'completed', conclusion: 'success' }] }
		})
		const github = createGithub(octokit, owner)
		expect(await github.getCheckRollup(repo, 'sha')).toBe('green')
	})

	test('an incomplete run is pending', async () => {
		const octokit = makeOctokit()
		octokit.checks.listForRef.mockResolvedValue({
			data: { check_runs: [{ status: 'in_progress', conclusion: null }] }
		})
		const github = createGithub(octokit, owner)
		expect(await github.getCheckRollup(repo, 'sha')).toBe('pending')
	})

	test(
		'a "waiting" status (any non-completed string) folds to pending',
		async () => {
			const octokit = makeOctokit()
			octokit.checks.listForRef.mockResolvedValue({
				data: { check_runs: [{ status: 'waiting', conclusion: null }] }
			})
			const github = createGithub(octokit, owner)
			expect(await github.getCheckRollup(repo, 'sha')).toBe('pending')
		})

	test('a failing conclusion is red', async () => {
		const octokit = makeOctokit()
		octokit.checks.listForRef.mockResolvedValue({
			data: { check_runs: [{ status: 'completed', conclusion: 'failure' }] }
		})
		const github = createGithub(octokit, owner)
		expect(await github.getCheckRollup(repo, 'sha')).toBe('red')
	})

	test('red beats pending when both are present', async () => {
		const octokit = makeOctokit()
		octokit.checks.listForRef.mockResolvedValue({
			data: {
				check_runs: [
					{ status: 'in_progress', conclusion: null },
					{ status: 'completed', conclusion: 'failure' }
				]
			}
		})
		const github = createGithub(octokit, owner)
		expect(await github.getCheckRollup(repo, 'sha')).toBe('red')
	})

	test('malformed response refused', async () => {
		const octokit = makeOctokit()
		octokit.checks.listForRef.mockResolvedValue({
			data: { check_runs: [{ status: 'unknown' }] }
		})
		const github = createGithub(octokit, owner)
		await expect(github.getCheckRollup(repo, 'sha'))
			.rejects.toThrow(/^getCheckRollup:/)
	})
})
