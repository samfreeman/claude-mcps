import { isNotFound, type OctokitLike } from './client'
import {
	DirectoryContentSchema,
	FileContentSchema,
	issue,
	shapeError
} from './schemas'

export const readFile = (octokit: OctokitLike, owner: string) =>
	async (repo: string, path: string, ref: string) => {
		try {
			const res = await octokit.repos.getContent({
				owner,
				repo,
				path,
				ref
			})
			if (Array.isArray(res.data))
				throw new Error(`readFile: '${path}' is a directory`)
			const parsed = FileContentSchema.safeParse(res.data)
			if (!parsed.success)
				throw shapeError('readFile', issue(parsed.error))
			if (parsed.data.encoding != 'base64')
				throw shapeError(
					'readFile',
					`encoding ${parsed.data.encoding} is not base64`)
			return Buffer.from(parsed.data.content, 'base64').toString('utf-8')
		}
		catch (e) {
			if (isNotFound(e))
				return null
			throw e
		}
	}

export const listTree = (octokit: OctokitLike, owner: string) =>
	async (repo: string, path: string, ref: string) => {
		try {
			const res = await octokit.repos.getContent({
				owner,
				repo,
				path,
				ref
			})
			if (!Array.isArray(res.data))
				throw new Error(`listTree: '${path}' is a file`)
			const parsed = DirectoryContentSchema.safeParse(res.data)
			if (!parsed.success)
				throw shapeError('listTree', issue(parsed.error))
			const unsupported = parsed.data.find(entry =>
				entry.type != 'dir' && entry.type != 'file')
			if (unsupported != null)
				throw shapeError(
					'listTree',
					`unsupported entry type '${unsupported.type}' at ` +
						`'${unsupported.path}'`)
			return parsed.data.map(entry => ({
				path: entry.path,
				type: entry.type == 'dir' ? 'dir' as const : 'file' as const,
				size: entry.size
			}))
		}
		catch (e) {
			if (isNotFound(e))
				return null
			throw e
		}
	}
