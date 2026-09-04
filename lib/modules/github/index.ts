import type { OctokitLike } from './client'
import { readFile, listTree } from './contents'
import { getRepo, listFeatureBranches, getBranchHead } from './refs'
import { listTreeRecursive } from './trees'
import { findPullForBranch, getCheckRollup } from './pulls'

export const createGithub = (octokit: OctokitLike, owner: string) => ({
	owner,
	getRepo: getRepo(octokit, owner),
	listFeatureBranches: listFeatureBranches(octokit, owner),
	getBranchHead: getBranchHead(octokit, owner),
	readFile: readFile(octokit, owner),
	listTree: listTree(octokit, owner),
	listTreeRecursive: listTreeRecursive(octokit, owner),
	findPullForBranch: findPullForBranch(octokit, owner),
	getCheckRollup: getCheckRollup(octokit, owner)
})

export type Github = ReturnType<typeof createGithub>
