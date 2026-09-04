import type { CallToolResult } from '@modelcontextprotocol/sdk/types.js'
import type { Continuation, Facts, Orient, Position, Refusal } from './types'
import { isRefusal } from './refusal'
import { formatPbiId } from './artifacts'

const text = (value: string): CallToolResult => ({
	content: [{ type: 'text', text: value }]
})

const adrOf = (o: Orient) => {
	if (o.facts.adr == null)
		throw new Error(`render: position ${o.position} requires an ADR`)
	return o.facts.adr
}

const prOf = (o: Orient) => {
	if (o.facts.pr == null)
		throw new Error(`render: position ${o.position} requires a PR`)
	return o.facts.pr
}

const reviewOf = (o: Orient) => {
	if (o.facts.review == null)
		throw new Error(`render: position ${o.position} requires a review`)
	return o.facts.review
}

const pickOf = (o: Orient) => {
	if (o.facts.pick == null)
		throw new Error(`render: position ${o.position} requires a pick`)
	return o.facts.pick
}

const pbiText = (o: Orient) => formatPbiId(adrOf(o).pbi)

const openers: Record<Position, (o: Orient) => string> = {
	halted: o => {
		const count = o.facts.snags.length
		return `${o.project} is halted in tri. ${count} open ` +
			`snag${count == 1 ? '' : 's'} must be resolved before anything ` +
			'else moves.'
	},
	grill: o =>
		`${o.project} is in adr, grilling the design for ` +
		`${pbiText(o)}. The next step is approve once the design ` +
		'is settled.',
	ready: o =>
		`${o.project} is in dev. The ADR for ${pbiText(o)} is ` +
		'approved and no run has been dispatched yet. The next step is ' +
		'approve, which starts the dev run.',
	'awaiting-review': o =>
		`${o.project} is in rvw, waiting on a review for ` +
		`${pbiText(o)}. Checks are ${prOf(o).checks}. ` +
		'The next step is approve, which dispatches the review.',
	dispositions: o =>
		`${o.project} is in rvw. The review for ${pbiText(o)} ` +
		'requested changes, and the dispositions still need converging. ' +
		'The next step is save once they\'re settled.',
	merge: o =>
		`${o.project} is in dev, at the merge position for ` +
		`${pbiText(o)}. Checks are ${prOf(o).checks} ` +
		`and the review is ${reviewOf(o).verdict}.`,
	'closure-pending': o =>
		`${o.project} is in dev. The work for ${pbiText(o)} looks ` +
		'finished, but closure hasn\'t run yet. The next step is merge, ' +
		'to close it out.',
	'cycle-end': o =>
		`${o.project} has finished its build loop and has items waiting ` +
		'in the stash. You can run cycle-end tri to drain them, or pick ' +
		'the next PBI\'s ADR instead.',
	pick: o => {
		const pick = pickOf(o)
		const eligible = pick.eligible.length
		const suggested = pick.suggested
		const suggestedText = suggested == null
			? ''
			: `, and ${formatPbiId(suggested.id)} is the suggested default`
		return `${o.project} is between PBIs. ${eligible} ` +
			`PBI${eligible == 1 ? ' is' : 's are'} eligible${suggestedText}. ` +
			'You can pick one for an ADR, or author docs first.'
	}
}

const branchAndPr = (facts: Facts) => {
	const branch = facts.branch == null
		? 'none, working on dev'
		: facts.branch.name
	const pr = facts.pr == null
		? 'no PR yet'
		: `PR #${facts.pr.number} ${facts.pr.state}`
	return `${branch}, ${pr}`
}

const checksAndReview = new Set<Position>([
	'awaiting-review',
	'dispositions',
	'merge'
])

const pluralItems = (count: number) =>
	`${count} item${count == 1 ? '' : 's'}`

const positionBullets = (o: Orient): string[] => {
	const base = [
		`Phase: ${o.phase}, ${o.position}`,
		`PBI: ${o.facts.adr == null ? 'none' : formatPbiId(o.facts.adr.pbi)}`,
		`Feature branch: ${branchAndPr(o.facts)}`,
		`Snags: ${
			o.facts.snags.length == 0 ? 'none' : o.facts.snags.join(', ')
		}`,
		`Stash: ${
			o.facts.stash.length == 0
				? 'none'
				: pluralItems(o.facts.stash.length)
		}`
	]
	const withChecks = checksAndReview.has(o.position)
		? [
			...base,
			`Checks: ${prOf(o).checks}`,
			`Review: ${o.facts.review?.verdict ?? 'none'}`
		]
		: base
	if (o.position != 'pick')
		return withChecks
	const pick = pickOf(o)
	const suggested = pick.suggested == null
		? 'none'
		: `${formatPbiId(pick.suggested.id)} — ${pick.suggested.title}`
	return [
		...withChecks,
		`Eligible: ${pick.eligible.length}`,
		`Suggested: ${suggested}`,
		`Blocked: ${pick.blocked}`
	]
}

const continuations: ReadonlySet<Orient['next']> =
	new Set<Continuation>(['approve', 'snag', 'save'])

const nextCallText = (o: Orient) =>
	continuations.has(o.next)
		? `wagc with project "${o.project}", continuation "${o.next}", and ` +
			'no payload — not available in this release.'
		: `${o.next} happens from Claude Code for now — this release has ` +
			'no continuation for it.'

const renderOrient = (
	o: Orient,
	ritual: string | undefined
): CallToolResult => {
	const lines = [
		`# ${o.project} — ${o.phase}`,
		'',
		`**Say this first:** ${openers[o.position](o)}`,
		'',
		'## Position',
		...positionBullets(o).map(line => `- ${line}`),
		'',
		'## Ritual',
		'',
		ritual ?? '(ritual unavailable)',
		'',
		'## Next call',
		nextCallText(o)
	]
	return text(lines.join('\n'))
}

const renderRefusal = (r: Refusal): CallToolResult => {
	const lines = [
		'# refused',
		'',
		`**Say this first:** ${r.say}`,
		'',
		'## Why',
		...r.why.map(line => `- ${line}`),
		'',
		'## What to do',
		...r.next.map(line => `- ${line}`)
	]
	return text(lines.join('\n'))
}

export const render = (
	result: Orient | Refusal,
	ritual?: string
): CallToolResult =>
	isRefusal(result)
		? renderRefusal(result)
		: renderOrient(result, ritual)
