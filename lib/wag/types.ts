import type { Github } from '../modules/github'
import type { State } from './state'

export type { State } from './state'

export type Phase =
	| 'discovery' | 'init' | 'docs' | 'adr' | 'dev' | 'rvw' | 'tri'
export type Continuation = 'approve' | 'snag' | 'save'
export type Position =
	| 'halted' | 'grill' | 'ready' | 'awaiting-review' | 'dispositions'
	| 'merge' | 'closure-pending' | 'cycle-end' | 'pick'
export type RitualName =
	| 'guide' | 'voice' | 'adr' | 'dev' | 'rvw' | 'tri' | 'docs'

export type PbiId = { epic: string, pbi: string }

export type Facts = {
	project: string
	workingRef: string
	branch: { name: string, head: string } | null
	state: State
	snags: string[]
	adr: {
		path: string
		status: 'draft' | 'approved'
		pbi: PbiId
	} | null
	pr: {
		number: number
		url: string
		title: string
		state: 'open' | 'merged'
		checks: CheckRollup
	} | null
	review: {
		path: string
		verdict: 'APPROVE' | 'REQUEST_CHANGES'
		dispositions: boolean
	} | null
	stash: string[]
	pick: {
		eligible: PbiSummary[]
		blocked: number
		suggested: PbiSummary | null
	} | null
}
export type CheckRollup = 'none' | 'pending' | 'green' | 'red'
export type PbiSummary = {
	id: PbiId
	title: string
	priority: 'P1' | 'P2' | 'P3'
	dependencies: PbiId[]
}

export type Orient = {
	project: string
	phase: Phase
	position: Position
	next: Continuation | 'merge' | 'tri' | 'pick'
	facts: Facts
	ritual: RitualName
}

export type Refusal = {
	kind: RefusalKind
	say: string
	why: string[]
	next: string[]
}
export type RefusalKind =
	| 'unknown-project' | 'not-a-wag-project' | 'invalid-state'
	| 'ambiguous-branch' | 'branch-without-adr' | 'unreadable-artifact'
	| 'listing-truncated' | 'not-yet-available'

export type Deps = {
	github: Github
	rituals: { read: (name: RitualName) => Promise<string> }
}
