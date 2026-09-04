import type { Facts, Orient, Position, Refusal } from './types'
import { refusal } from './refusal'

type DerivedPhase = 'tri' | 'dev' | 'adr' | 'rvw'
type Next = Orient['next']

const orient = (
	phase: DerivedPhase,
	position: Position,
	facts: Facts,
	next: Next
): Orient => ({
	project: facts.project,
	phase,
	position,
	next,
	facts,
	ritual: phase
})

export const derive = (facts: Facts): Orient | Refusal => {
	if (facts.snags.length > 0)
		return orient('tri', 'halted', facts, 'tri')
	if (!facts.branch && facts.adr)
		return orient('dev', 'closure-pending', facts, 'merge')
	if (facts.branch && !facts.adr)
		return refusal.branchWithoutAdr(facts.project, facts.branch.name)
	if (facts.adr?.status == 'draft')
		return orient('adr', 'grill', facts, 'approve')
	if (facts.adr?.status == 'approved' && facts.pr == null)
		return orient('dev', 'ready', facts, 'approve')
	if (facts.pr?.state == 'open' && facts.review == null)
		return orient('rvw', 'awaiting-review', facts, 'approve')
	if (
		facts.pr?.state == 'open' &&
		facts.review?.verdict == 'REQUEST_CHANGES' &&
		!facts.review.dispositions
	)
		return orient('rvw', 'dispositions', facts, 'save')
	if (facts.pr?.state == 'open')
		return orient('dev', 'merge', facts, 'approve')
	if (facts.pr?.state == 'merged')
		return orient('dev', 'closure-pending', facts, 'merge')
	if (facts.stash.length > 0)
		return orient('tri', 'cycle-end', facts, 'approve')
	return orient('adr', 'pick', facts, 'pick')
}
