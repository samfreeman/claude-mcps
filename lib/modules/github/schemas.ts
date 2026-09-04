import { z } from 'zod'

export const issue = (error: z.ZodError) => {
	const first = error.issues[0]
	const field = first.path.length == 0 ? first.code : first.path.join('.')
	return `${field}: ${first.message}`
}

export const shapeError = (operation: string, detail: string) =>
	new Error(`${operation}: unexpected response shape: ${detail}`)

export const RepoSchema = z.object({
	id: z.number()
})

export const BranchListSchema = z.array(z.object({
	name: z.string(),
	commit: z.object({
		sha: z.string()
	})
}))

export const BranchHeadSchema = z.object({
	commit: z.object({
		sha: z.string(),
		commit: z.object({
			tree: z.object({
				sha: z.string()
			})
		})
	})
})

export const FileContentSchema = z.object({
	type: z.literal('file'),
	content: z.string(),
	encoding: z.string()
})

export const DirectoryEntrySchema = z.object({
	type: z.enum(['file', 'dir', 'symlink', 'submodule']),
	path: z.string(),
	size: z.number().optional()
})

export const DirectoryContentSchema = z.array(DirectoryEntrySchema)

export const TreeSchema = z.object({
	truncated: z.boolean(),
	tree: z.array(z.object({
		path: z.string()
	}))
})

export const PullListSchema = z.array(z.object({
	number: z.number(),
	state: z.enum(['open', 'closed']),
	merged_at: z.string().nullable(),
	html_url: z.string(),
	title: z.string(),
	head: z.object({
		sha: z.string()
	})
}))

export const CheckRunsSchema = z.object({
	check_runs: z.array(z.object({
		status: z.string(),
		conclusion: z.string().nullable()
	}))
})
