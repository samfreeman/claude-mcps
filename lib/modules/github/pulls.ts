import type { z } from 'zod'
import type { OctokitLike } from './client'
import { CheckRunsSchema, PullListSchema, issue, shapeError } from './schemas'

type Pull = z.infer<typeof PullListSchema>[number]

const isMerged = (pull: Pull): pull is Pull & { merged_at: string } =>
	pull.merged_at != null

const failing = new Set([
	'failure',
	'timed_out',
	'cancelled',
	'action_required'
])

export const findPullForBranch = (octokit: OctokitLike, owner: string) =>
	async (repo: string, branch: string) => {
		const res = await octokit.pulls.list({
			owner,
			repo,
			state: 'all',
			head: `${owner}:${branch}`,
			per_page: 100
		})
		const parsed = PullListSchema.safeParse(res.data)
		if (!parsed.success)
			throw shapeError('findPullForBranch', issue(parsed.error))
		const open = parsed.data.find(pull => pull.state == 'open')
		if (open != null)
			return {
				number: open.number,
				url: open.html_url,
				title: open.title,
				state: 'open' as const,
				head: open.head.sha
			}
		const merged = parsed.data
			.filter(isMerged)
			.sort((a, b) =>
				Date.parse(b.merged_at) - Date.parse(a.merged_at))[0]
		if (merged == null)
			return null
		return {
			number: merged.number,
			url: merged.html_url,
			title: merged.title,
			state: 'merged' as const,
			head: merged.head.sha
		}
	}

export const getCheckRollup = (octokit: OctokitLike, owner: string) =>
	async (repo: string, sha: string) => {
		const res = await octokit.checks.listForRef({ owner, repo, ref: sha })
		const parsed = CheckRunsSchema.safeParse(res.data)
		if (!parsed.success)
			throw shapeError('getCheckRollup', issue(parsed.error))
		const runs = parsed.data.check_runs
		if (runs.length == 0)
			return 'none' as const
		if (runs.some(run =>
			run.conclusion != null && failing.has(run.conclusion)))
			return 'red' as const
		if (runs.some(run => run.status != 'completed'))
			return 'pending' as const
		return 'green' as const
	}
