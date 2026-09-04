export type OctokitLike = {
	repos: {
		get(params: { owner: string, repo: string }): Promise<{ data: unknown }>
		listBranches(params: {
			owner: string
			repo: string
			per_page: number
		}): Promise<{ data: unknown }>
		getBranch(params: {
			owner: string
			repo: string
			branch: string
		}): Promise<{ data: unknown }>
		getContent(params: {
			owner: string
			repo: string
			path: string
			ref?: string
		}): Promise<{ data: unknown }>
	}
	git: {
		getTree(params: {
			owner: string
			repo: string
			tree_sha: string
			recursive?: string
		}): Promise<{ data: unknown }>
	}
	pulls: {
		list(params: {
			owner: string
			repo: string
			state: 'all'
			head: string
			per_page: number
		}): Promise<{ data: unknown }>
	}
	checks: {
		listForRef(params: {
			owner: string
			repo: string
			ref: string
		}): Promise<{ data: unknown }>
	}
}

export const isNotFound = (e: unknown) =>
	e != null && typeof e == 'object' && 'status' in e && e.status == 404
