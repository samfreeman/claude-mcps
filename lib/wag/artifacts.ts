import type { PbiId, PbiSummary, Refusal } from './types'
import { refusal } from './refusal'

const epicNumberOf = (epicDir: string) =>
	/^epic-(\d{3})-/.exec(epicDir)?.[1] ?? null

export const formatPbiId = (id: PbiId) =>
	`PBI ${id.epic}.${id.pbi}`

const statusLine = /^\*\*Status:\*\*\s*(draft|approved)\s*$/m

type AdrHeader = { status: 'draft' | 'approved' }

export const parseAdrHeader = (
	project: string,
	path: string,
	body: string
): AdrHeader | Refusal => {
	const m = statusLine.exec(body)
	return m == null
		? refusal.unreadableArtifact(project, path, '**Status:**')
		: { status: m[1] as 'draft' | 'approved' }
}

const verdictLine = /^\*\*Verdict:\*\*\s*(APPROVE|REQUEST_CHANGES)\s*$/m
const dispositionsHeading = /^##\s*Grill dispositions\s*$/m

type ReviewHeader = {
	verdict: 'APPROVE' | 'REQUEST_CHANGES'
	dispositions: boolean
}

export const parseReviewHeader = (
	project: string,
	path: string,
	body: string
): ReviewHeader | Refusal => {
	const m = verdictLine.exec(body)
	return m == null
		? refusal.unreadableArtifact(project, path, '**Verdict:**')
		: {
			verdict: m[1] as 'APPROVE' | 'REQUEST_CHANGES',
			dispositions: dispositionsHeading.test(body)
		}
}

const titleLine = /^#\s*PBI\s+(\d{3})\.(\d{3}):\s*(.+)$/m
const priorityLine = /^\*\*Priority:\*\*\s*(P[123])\s*$/m
const dependenciesLine = /^\*\*Dependencies:\*\*\s*(.+)$/m
const dependencyRef = /PBI\s+(\d{3})\.(\d{3})/g

type PbiHeader = {
	title: string
	priority: 'P1' | 'P2' | 'P3'
	dependencies: PbiId[]
}

export const parsePbiHeader = (
	project: string,
	path: string,
	body: string
): PbiHeader | Refusal => {
	const title = titleLine.exec(body)
	if (title == null)
		return refusal.unreadableArtifact(project, path, '# PBI EEE.PPP: title')
	const priority = priorityLine.exec(body)
	if (priority == null)
		return refusal.unreadableArtifact(project, path, '**Priority:**')
	const dependenciesText = dependenciesLine.exec(body)
	if (dependenciesText == null)
		return refusal.unreadableArtifact(project, path, '**Dependencies:**')
	const dependencies = dependenciesText[1].trim() == 'None'
		? []
		: [...dependenciesText[1].matchAll(dependencyRef)]
			.map(m => ({ epic: m[1], pbi: m[2] }))
	return {
		title: title[3].trim(),
		priority: priority[1] as 'P1' | 'P2' | 'P3',
		dependencies
	}
}

const completedPbiPattern = (id: PbiId) =>
	new RegExp(
		`^\\.wag/backlog/_completed/epic-${id.epic}-[a-z0-9-]+` +
			`/PBI-${id.pbi}\\.md$`)

export const isEligible = (dependencies: PbiId[], treePaths: string[]) =>
	dependencies.every(dep => {
		const pattern = completedPbiPattern(dep)
		return treePaths.some(path => pattern.test(path))
	})

const priorityRank = { P1: 0, P2: 1, P3: 2 }

const compareKey = (activeEpicNumber: string) =>
	(pbi: PbiSummary): [number, number, number, number] => [
		priorityRank[pbi.priority],
		pbi.id.epic == activeEpicNumber ? 0 : 1,
		Number(pbi.id.epic),
		Number(pbi.id.pbi)
	]

export const selectDefault = (
	eligible: PbiSummary[],
	activeEpic: string
): PbiSummary | null => {
	if (eligible.length == 0)
		return null
	const key = compareKey(epicNumberOf(activeEpic) ?? '')
	return [...eligible].sort((a, b) => {
		const [ap, ae, aen, an] = key(a)
		const [bp, be, ben, bn] = key(b)
		if (ap != bp)
			return ap - bp
		if (ae != be)
			return ae - be
		if (aen != ben)
			return aen - ben
		return an - bn
	})[0]
}
