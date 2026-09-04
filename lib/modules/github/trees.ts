import type { OctokitLike } from './client'
import { TreeSchema, issue, shapeError } from './schemas'

export const listTreeRecursive = (octokit: OctokitLike, owner: string) =>
	async (repo: string, treeSha: string, prefix: string) => {
		const res = await octokit.git.getTree({
			owner,
			repo,
			tree_sha: treeSha,
			recursive: '1'
		})
		const parsed = TreeSchema.safeParse(res.data)
		if (!parsed.success)
			throw shapeError('listTreeRecursive', issue(parsed.error))
		return {
			paths: parsed.data.tree
				.map(entry => entry.path)
				.filter(path => path.startsWith(prefix)),
			truncated: parsed.data.truncated
		}
	}
