import { describe, test, expect } from 'vitest'
import { render } from '../lib/wag/render'
import { readRitual } from '../lib/wag/rituals'
import { refusal } from '../lib/wag/refusal'
import type { Facts, Orient, Phase, Position, State } from '../lib/wag/types'

const defaultState: State = {
	app_name: 'claude-mcps',
	wag_version: '0.4.1',
	current_mode: null,
	active_epic: 'epic-001-wagc',
	active_pbi: '001',
	feature_branch: null,
	docs_page_path: null
}

const facts = (overrides: Partial<Facts> = {}): Facts => ({
	project: 'claude-mcps',
	workingRef: 'dev',
	branch: null,
	state: defaultState,
	snags: [],
	adr: null,
	pr: null,
	review: null,
	stash: [],
	pick: null,
	...overrides
})

const orient = (
	phase: Phase,
	position: Position,
	f: Facts,
	next: Orient['next']
): Orient => ({
	project: f.project,
	phase,
	position,
	next,
	facts: f,
	ritual: 'guide'
})

const branch = { name: 'feature/PBI-001.001', head: 'sha1' }
const adrPbi = { epic: '001', pbi: '001' }
const draftAdr = { path: 'x', status: 'draft' as const, pbi: adrPbi }
const approvedAdr = { path: 'x', status: 'approved' as const, pbi: adrPbi }

const openPr = {
	number: 1,
	url: 'u',
	title: 't',
	state: 'open' as const,
	checks: 'green' as const
}

const mergedPr = {
	number: 1,
	url: 'u',
	title: 't',
	state: 'merged' as const,
	checks: 'green' as const
}

const pbiSummary = {
	id: { epic: '001', pbi: '002' },
	title: 'x',
	priority: 'P1' as const,
	dependencies: []
}

const sayLine = (result: ReturnType<typeof render>) => {
	const first = result.content[0] as { type: string, text?: string }
	if (first.type != 'text' || first.text == null)
		throw new Error('expected text content')
	const line = first.text.split('\n')
		.find(l => l.startsWith('**Say this first:**'))
	if (line == null)
		throw new Error('no opener line found')
	return line
}

const fullText = (result: ReturnType<typeof render>) => {
	const first = result.content[0] as { type: string, text?: string }
	if (first.type != 'text' || first.text == null)
		throw new Error('expected text content')
	return first.text
}

describe('opener text per derivation rule', () => {
	test('rule 1: halted names the open snag count', () => {
		const f = facts({ snags: ['.wag/snags/SNAG-001.md'] })
		const say = sayLine(render(orient('tri', 'halted', f, 'tri')))
		expect(say).toContain('halted')
		expect(say).toContain('1 open snag')
	})

	test('rule 2 / 9: closure-pending names the merge step', () => {
		const f = facts({ adr: approvedAdr })
		const say = sayLine(render(orient('dev', 'closure-pending', f, 'merge')))
		expect(say).toContain('closure')
		expect(say).toContain('merge')
	})

	test('rule 4: grill names the design conversation', () => {
		const f = facts({ branch, adr: draftAdr })
		const say = sayLine(render(orient('adr', 'grill', f, 'approve')))
		expect(say).toContain('grilling the design')
		expect(say).toContain('approve')
	})

	test('rule 5: ready names the dev run', () => {
		const f = facts({ branch, adr: approvedAdr })
		const say = sayLine(render(orient('dev', 'ready', f, 'approve')))
		expect(say).toContain('approve')
		expect(say).toContain('dev run')
	})

	test('rule 6: awaiting-review names the checks', () => {
		const f = facts({ branch, adr: approvedAdr, pr: openPr })
		const say =
			sayLine(render(orient('rvw', 'awaiting-review', f, 'approve')))
		expect(say).toContain('rvw')
		expect(say).toContain('Checks are')
	})

	test('rule 7: dispositions names the save step', () => {
		const f = facts({
			branch,
			adr: approvedAdr,
			pr: openPr,
			review: { path: 'r', verdict: 'REQUEST_CHANGES', dispositions: false }
		})
		const say = sayLine(render(orient('rvw', 'dispositions', f, 'save')))
		expect(say).toContain('dispositions')
		expect(say).toContain('save')
	})

	test('rule 8: merge names the merge position', () => {
		const f = facts({
			branch,
			adr: approvedAdr,
			pr: openPr,
			review: { path: 'r', verdict: 'APPROVE', dispositions: false }
		})
		const say = sayLine(render(orient('dev', 'merge', f, 'approve')))
		expect(say).toContain('merge position')
	})

	test('rule 9: a merged PR also names the merge step', () => {
		const f = facts({ branch, adr: approvedAdr, pr: mergedPr })
		const say = sayLine(render(orient('dev', 'closure-pending', f, 'merge')))
		expect(say).toContain('closure')
		expect(say).toContain('merge')
	})

	test('rule 10: cycle-end names both options', () => {
		const f = facts({ stash: ['.wag/stash/STASH-001.md'] })
		const say = sayLine(render(orient('tri', 'cycle-end', f, 'approve')))
		expect(say).toContain('cycle-end tri')
		expect(say).toContain('pick')
	})

	test('rule 11: pick names both options', () => {
		const f = facts({
			pick: { eligible: [pbiSummary], blocked: 0, suggested: pbiSummary }
		})
		const say = sayLine(render(orient('adr', 'pick', f, 'pick')))
		expect(say).toContain('between PBIs')
		expect(say).toContain('pick one for an ADR')
		expect(say).toContain('author docs first')
	})
})

describe('opener text for refusal kinds', () => {
	test('unknown-project names the project and owner', () => {
		const r = refusal.unknownProject('claude-mcps', 'samfreeman')
		const say = sayLine(render(r))
		expect(say).toContain('claude-mcps')
		expect(say).toContain('samfreeman')
	})

	test('ambiguous-branch names the project and every branch found', () => {
		const r = refusal.ambiguousBranch(
			'claude-mcps', ['feature/PBI-001.001', 'feature/PBI-001.002'])
		const say = sayLine(render(r))
		expect(say).toContain('claude-mcps')
		expect(say).toContain('feature/PBI-001.001')
		expect(say).toContain('feature/PBI-001.002')
	})

	test('branch-without-adr names the project and the branch', () => {
		const r = refusal.branchWithoutAdr('claude-mcps', 'feature/PBI-001.001')
		const say = sayLine(render(r))
		expect(say).toContain('claude-mcps')
		expect(say).toContain('feature/PBI-001.001')
	})

	test('not-a-wag-project (no-wag-dir) names the project and ref', () => {
		const r = refusal.notAWagProject('claude-mcps', 'dev', 'no-wag-dir')
		const say = sayLine(render(r))
		expect(say).toContain('claude-mcps')
		expect(say).toContain('.wag/')
	})

	test('invalid-state names the project and the field', () => {
		const r = refusal.invalidState('claude-mcps', 'feature_branch')
		const say = sayLine(render(r))
		expect(say).toContain('claude-mcps')
		expect(say).toContain('feature_branch')
	})

	test('unreadable-artifact names the project and the path', () => {
		const r = refusal.unreadableArtifact(
			'claude-mcps', '.wag/adr/active/ADR-001.001.md', '**Status:**')
		const say = sayLine(render(r))
		expect(say).toContain('claude-mcps')
		expect(say).toContain('.wag/adr/active/ADR-001.001.md')
	})

	test('listing-truncated names the project', () => {
		const r = refusal.listingTruncated('claude-mcps')
		const say = sayLine(render(r))
		expect(say).toContain('claude-mcps')
		expect(say).toContain('truncated')
	})

	test('not-yet-available names the continuation', () => {
		const r = refusal.notYetAvailable('approve')
		const say = sayLine(render(r))
		expect(say).toContain('approve')
		expect(say).toContain('isn\'t available')
	})
})

describe('render guards a position\'s required facts', () => {
	test(
		'rendering "grill" without an ADR throws, naming the position ' +
			'and the missing fact',
		() => {
			expect(() => render(orient('adr', 'grill', facts(), 'approve')))
				.toThrow(/^render: position grill requires an ADR$/)
		})

	test('rendering "awaiting-review" without a PR throws', () => {
		const f = facts({ branch, adr: approvedAdr })
		expect(() => render(orient('rvw', 'awaiting-review', f, 'approve')))
			.toThrow(/^render: position awaiting-review requires a PR$/)
	})

	test('rendering "merge" without a review throws', () => {
		const f = facts({ branch, adr: approvedAdr, pr: openPr })
		expect(() => render(orient('dev', 'merge', f, 'approve')))
			.toThrow(/^render: position merge requires a review$/)
	})

	test('rendering "pick" without a pick throws', () => {
		expect(() => render(orient('adr', 'pick', facts(), 'pick')))
			.toThrow(/^render: position pick requires a pick$/)
	})
})

describe('position bullet formatting', () => {
	test('the stash bullet is singular for one, plural for several', () => {
		const f1 = facts({ stash: ['.wag/stash/STASH-001.md'] })
		const one = fullText(render(orient('tri', 'cycle-end', f1, 'approve')))
		expect(one).toContain('Stash: 1 item')
		const f3 = facts({
			stash: [
				'.wag/stash/STASH-001.md',
				'.wag/stash/STASH-002.md',
				'.wag/stash/STASH-003.md'
			]
		})
		const three = fullText(render(orient('tri', 'cycle-end', f3, 'approve')))
		expect(three).toContain('Stash: 3 items')
	})

	test('the no-branch bullet names dev and the PR text', () => {
		const text = fullText(render(orient('tri', 'cycle-end', facts(), 'approve')))
		expect(text).toContain('Feature branch: none, working on dev, no PR yet')
	})
})

describe('a full orient render', () => {
	test('has all four sections in order, the ritual, and no isError', () => {
		const f = facts({ branch, adr: approvedAdr, pr: openPr })
		const result = render(
			orient('rvw', 'awaiting-review', f, 'approve'), 'THE RITUAL TEXT')
		const text = fullText(result)
		expect(text.startsWith('# claude-mcps — rvw')).toBe(true)
		const iSay = text.indexOf('**Say this first:**')
		const iPosition = text.indexOf('## Position')
		const iRitual = text.indexOf('## Ritual')
		const iNext = text.indexOf('## Next call')
		expect(iSay).toBeGreaterThan(-1)
		expect(iPosition).toBeGreaterThan(iSay)
		expect(iRitual).toBeGreaterThan(iPosition)
		expect(iNext).toBeGreaterThan(iRitual)
		expect(text).toContain('THE RITUAL TEXT')
		expect(text).toContain('not available in this release')
		expect('isError' in result).toBe(false)
	})
})

describe('a full refusal render', () => {
	test('has the refusal heading, Why and What to do, and no isError', () => {
		const result = render(refusal.unknownProject('claude-mcps', 'samfreeman'))
		const text = fullText(result)
		expect(text.startsWith('# refused')).toBe(true)
		const iSay = text.indexOf('**Say this first:**')
		const iWhy = text.indexOf('## Why')
		const iWhat = text.indexOf('## What to do')
		expect(iSay).toBeGreaterThan(-1)
		expect(iWhy).toBeGreaterThan(iSay)
		expect(iWhat).toBeGreaterThan(iWhy)
		expect('isError' in result).toBe(false)
	})
})

const allRituals =
	['guide', 'voice', 'adr', 'dev', 'rvw', 'tri', 'docs'] as const
const phaseRituals = ['adr', 'dev', 'rvw', 'tri', 'docs'] as const

describe('readRitual', () => {
	test.each(allRituals)('%s reads a non-empty file', async name => {
		const content = await readRitual(name)
		expect(content.length).toBeGreaterThan(0)
	})

	test.each(phaseRituals)(
		'%s contains an "## In this release" heading',
		async name => {
			const content = await readRitual(name)
			expect(content).toMatch(/^## In this release\s*$/m)
		})
})
