import { isNotFound, type OctokitLike } from './client'
import {
	BranchHeadSchema,
	BranchListSchema,
	RepoSchema,
	issue,
	shapeError
} from './schemas'

export const getRepo = (octokit: OctokitLike, owner: string) =>
	async (repo: string) => {
		try {
			const res = await octokit.repos.get({ owner, repo })
			const parsed = RepoSchema.safeParse(res.data)
			if (!parsed.success)
				throw shapeError('getRepo', issue(parsed.error))
			return { exists: true as const }
		}
		catch (e) {
			if (isNotFound(e))
				return null
			throw e
		}
	}

export const listFeatureBranches = (octokit: OctokitLike, owner: string) =>
	async (repo: string) => {
		const res = await octokit.repos.listBranches({
			owner,
			repo,
			per_page: 100
		})
		const parsed = BranchListSchema.safeParse(res.data)
		if (!parsed.success)
			throw shapeError('listFeatureBranches', issue(parsed.error))
		return parsed.data
			.filter(branch => branch.name.startsWith('feature/PBI-'))
			.map(branch => ({ name: branch.name, head: branch.commit.sha }))
	}

export const getBranchHead = (octokit: OctokitLike, owner: string) =>
	async (repo: string, ref: string) => {
		try {
			const res = await octokit.repos.getBranch({
				owner,
				repo,
				branch: ref
			})
			const parsed = BranchHeadSchema.safeParse(res.data)
			if (!parsed.success)
				throw shapeError('getBranchHead', issue(parsed.error))
			return {
				commit: parsed.data.commit.sha,
				tree: parsed.data.commit.commit.tree.sha
			}
		}
		catch (e) {
			if (isNotFound(e))
				return null
			throw e
		}
	}
