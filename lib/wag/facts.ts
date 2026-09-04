import type { Github } from '../modules/github'
import type { CheckRollup, Facts, PbiId, PbiSummary, Refusal } from './types'
import { parseState } from './state'
import { refusal, isRefusal } from './refusal'
import {
	isEligible,
	parseAdrHeader,
	parsePbiHeader,
	parseReviewHeader,
	selectDefault
} from './artifacts'

const snagPattern = /^\.wag\/snags\/SNAG-.*\.md$/
const stashPattern = /^\.wag\/stash\/STASH-.*\.md$/
const adrPattern = /^\.wag\/adr\/active\/ADR-(\d{3})\.(\d{3})\.md$/
const pbiPathPattern =
	/^\.wag\/backlog\/epic-(\d{3})-[a-z0-9-]+\/PBI-(\d{3})\.md$/

const gatherTree = async (project: string, ref: string, github: Github) => {
	const head = await github.getBranchHead(project, ref)
	if (head == null)
		return null
	return github.listTreeRecursive(project, head.tree, '.wag/')
}

const reviewPattern = (pbi: PbiId) =>
	new RegExp(`^\\.wag/reviews/REVIEW-${pbi.epic}\\.${pbi.pbi}-(\\d{3})\\.md$`)

type ReviewMatch = { candidate: string, match: RegExpExecArray }
type AdrMatch = { path: string, match: RegExpExecArray }
type AdrAndReview = { adr: Facts['adr'], review: Facts['review'] }

const gatherAdrAndReview = async (
	project: string,
	treePaths: string[],
	workingRef: string,
	github: Github
): Promise<AdrAndReview | Refusal> => {
	const adrMatches = treePaths
		.map(path => ({ path, match: adrPattern.exec(path) }))
		.filter((entry): entry is AdrMatch => entry.match != null)
	if (adrMatches.length > 1)
		return refusal.unreadableArtifact(
			project,
			'.wag/adr/active/',
			'exactly one ADR-EEE.PPP.md')
	if (adrMatches.length == 0)
		return { adr: null, review: null }

	const { path, match } = adrMatches[0]
	const pbi = { epic: match[1], pbi: match[2] }
	const body = await github.readFile(project, path, workingRef)
	if (body == null)
		return refusal.unreadableArtifact(project, path, 'file content')
	const header = parseAdrHeader(project, path, body)
	if (isRefusal(header))
		return header
	const adr = { path, status: header.status, pbi }

	const regex = reviewPattern(pbi)
	const matches = treePaths
		.map(candidate => ({ candidate, match: regex.exec(candidate) }))
		.filter((entry): entry is ReviewMatch => entry.match != null)
	if (matches.length == 0)
		return { adr, review: null }
	const latest = matches.sort((a, b) =>
		Number(b.match[1]) - Number(a.match[1]))[0]
	const reviewBody =
		await github.readFile(project, latest.candidate, workingRef)
	if (reviewBody == null)
		return refusal.unreadableArtifact(
			project,
			latest.candidate,
			'file content')
	const reviewHeader =
		parseReviewHeader(project, latest.candidate, reviewBody)
	if (isRefusal(reviewHeader))
		return reviewHeader
	return {
		adr,
		review: {
			path: latest.candidate,
			verdict: reviewHeader.verdict,
			dispositions: reviewHeader.dispositions
		}
	}
}

const gatherPick = async (
	project: string,
	treePaths: string[],
	workingRef: string,
	github: Github,
	activeEpic: string
): Promise<Facts['pick'] | Refusal> => {
	const pbiPaths = treePaths.filter(path => pbiPathPattern.test(path))
	const results = await Promise.all(pbiPaths.map(
		async (path): Promise<PbiSummary | Refusal> => {
			const match = pbiPathPattern.exec(path)
			if (match == null)
				return refusal.unreadableArtifact(
					project,
					path,
					'PBI-PPP.md under an epic directory')
			const body = await github.readFile(project, path, workingRef)
			if (body == null)
				return refusal.unreadableArtifact(project, path, 'file content')
			const header = parsePbiHeader(project, path, body)
			if (isRefusal(header))
				return header
			return {
				id: { epic: match[1], pbi: match[2] },
				title: header.title,
				priority: header.priority,
				dependencies: header.dependencies
			}
		}))
	const failure = results.find(isRefusal)
	if (failure != null)
		return failure
	const summaries = results.filter((r): r is PbiSummary => !isRefusal(r))
	const eligible = summaries.filter(summary =>
		isEligible(summary.dependencies, treePaths))
	return {
		eligible,
		blocked: summaries.length - eligible.length,
		suggested: selectDefault(eligible, activeEpic)
	}
}

export const gatherFacts = async (
	project: string,
	github: Github
): Promise<Facts | Refusal> => {
	const branches = await github.listFeatureBranches(project)
	if (branches.length > 1)
		return refusal.ambiguousBranch(
			project,
			branches.map(branch => branch.name))
	const branch = branches.length == 1 ? branches[0] : null
	const workingRef = branch?.name ?? 'dev'

	const [stateText, tree, pr] = await Promise.all([
		github.readFile(project, '.wag/state.json', workingRef),
		gatherTree(project, workingRef, github),
		branch != null
			? github.findPullForBranch(project, branch.name)
			: Promise.resolve(null)
	])

	if (tree == null)
		return refusal.notAWagProject(project, workingRef, 'no-wag-dir')
	if (tree.truncated)
		return refusal.listingTruncated(project)
	if (tree.paths.length == 0)
		return refusal.notAWagProject(project, workingRef, 'no-wag-dir')
	if (stateText == null)
		return refusal.notAWagProject(project, workingRef, 'no-state-file')

	const state = parseState(project, stateText)
	if (isRefusal(state))
		return state
	if (branch != null && state.feature_branch != branch.name)
		return refusal.invalidState(project, 'feature_branch')

	const [adrAndReview, checks, pick] = await Promise.all([
		gatherAdrAndReview(project, tree.paths, workingRef, github),
		pr != null
			? github.getCheckRollup(project, pr.head)
			: Promise.resolve<CheckRollup>('none'),
		branch == null
			? gatherPick(
				project,
				tree.paths,
				workingRef,
				github,
				state.active_epic)
			: Promise.resolve(null)
	])

	if (isRefusal(adrAndReview))
		return adrAndReview
	if (isRefusal(pick))
		return pick

	return {
		project,
		workingRef,
		branch,
		state,
		snags: tree.paths.filter(path => snagPattern.test(path)),
		adr: adrAndReview.adr,
		pr: pr == null
			? null
			: {
				number: pr.number,
				url: pr.url,
				title: pr.title,
				state: pr.state,
				checks
			},
		review: adrAndReview.review,
		stash: tree.paths.filter(path => stashPattern.test(path)),
		pick
	}
}
