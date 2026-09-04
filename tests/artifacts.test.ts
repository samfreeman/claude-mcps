import { describe, test, expect } from 'vitest'
import {
	formatPbiId,
	isEligible,
	parseAdrHeader,
	parsePbiHeader,
	parseReviewHeader,
	selectDefault
} from '../lib/wag/artifacts'
import { isRefusal } from '../lib/wag/refusal'
import type { PbiSummary } from '../lib/wag/types'

const project = 'claude-mcps'
const adrPath = '.wag/adr/active/ADR-001.001.md'
const reviewPath = '.wag/reviews/REVIEW-001.001-001.md'
const pbiPath001 = '.wag/backlog/epic-001-wagc/PBI-001.md'
const pbiPath005 = '.wag/backlog/epic-001-wagc/PBI-005.md'

describe('parseAdrHeader', () => {
	test('valid draft status', () => {
		const result = parseAdrHeader(
			project, adrPath, '# ADR\n\n**Status:** draft\n')
		expect(result).toEqual({ status: 'draft' })
	})

	test('valid approved status', () => {
		const result = parseAdrHeader(
			project, adrPath, '# ADR\n\n**Status:** approved\n')
		expect(result).toEqual({ status: 'approved' })
	})

	test('missing status line is refused', () => {
		const result = parseAdrHeader(
			project, adrPath, '# ADR\n\nno status here\n')
		expect(isRefusal(result)).toBe(true)
		if (isRefusal(result)) {
			expect(result.kind).toBe('unreadable-artifact')
			expect(result.say).toContain(project)
			expect(result.why[0]).toContain(adrPath)
		}
	})

	test('a foreign status value is refused', () => {
		const result = parseAdrHeader(
			project, adrPath, '**Status:** deprecated\n')
		expect(isRefusal(result)).toBe(true)
	})
})

describe('parseReviewHeader', () => {
	test('valid APPROVE with no dispositions heading', () => {
		const result = parseReviewHeader(
			project, reviewPath, '**Verdict:** APPROVE\n')
		expect(result).toEqual({ verdict: 'APPROVE', dispositions: false })
	})

	test('valid REQUEST_CHANGES with a dispositions heading', () => {
		const body =
			'**Verdict:** REQUEST_CHANGES\n\n## Grill dispositions\n\n' +
			'some text\n'
		const result = parseReviewHeader(project, reviewPath, body)
		expect(result).toEqual({ verdict: 'REQUEST_CHANGES', dispositions: true })
	})

	test('valid REQUEST_CHANGES with no dispositions heading', () => {
		const result = parseReviewHeader(
			project, reviewPath, '**Verdict:** REQUEST_CHANGES\n')
		expect(result).toEqual({
			verdict: 'REQUEST_CHANGES',
			dispositions: false
		})
	})

	test('missing verdict line is refused', () => {
		const result = parseReviewHeader(
			project, reviewPath, 'nothing to see here\n')
		expect(isRefusal(result)).toBe(true)
		if (isRefusal(result))
			expect(result.kind).toBe('unreadable-artifact')
	})

	test('a foreign verdict value is refused', () => {
		const result = parseReviewHeader(
			project, reviewPath, '**Verdict:** MAYBE\n')
		expect(isRefusal(result)).toBe(true)
	})
})

describe('parsePbiHeader', () => {
	test('valid with no dependencies', () => {
		const body =
			'# PBI 001.001: Orient on an existing project\n\n' +
			'**Priority:** P1\n**Dependencies:** None\n'
		const result = parsePbiHeader(project, pbiPath001, body)
		expect(result).toEqual({
			title: 'Orient on an existing project',
			priority: 'P1',
			dependencies: []
		})
	})

	test('valid with dependencies, including a cross-epic reference', () => {
		const body =
			'# PBI 001.005: Cycle-end tri\n\n**Priority:** P2\n' +
			'**Dependencies:** PBI 001.004, PBI 002.010\n'
		const result = parsePbiHeader(project, pbiPath005, body)
		expect(result).toEqual({
			title: 'Cycle-end tri',
			priority: 'P2',
			dependencies: [{ epic: '001', pbi: '004' }, { epic: '002', pbi: '010' }]
		})
	})

	test('missing title line is refused', () => {
		const body = '**Priority:** P1\n**Dependencies:** None\n'
		const result = parsePbiHeader(project, pbiPath001, body)
		expect(isRefusal(result)).toBe(true)
		if (isRefusal(result))
			expect(result.why[0]).toContain('# PBI EEE.PPP: title')
	})

	test('missing priority line is refused', () => {
		const body = '# PBI 001.001: Orient\n\n**Dependencies:** None\n'
		const result = parsePbiHeader(project, pbiPath001, body)
		expect(isRefusal(result)).toBe(true)
		if (isRefusal(result))
			expect(result.why[0]).toContain('**Priority:**')
	})

	test('missing dependencies line is refused', () => {
		const body = '# PBI 001.001: Orient\n\n**Priority:** P1\n'
		const result = parsePbiHeader(project, pbiPath001, body)
		expect(isRefusal(result)).toBe(true)
		if (isRefusal(result))
			expect(result.why[0]).toContain('**Dependencies:**')
	})

	test('a foreign priority value is refused', () => {
		const body =
			'# PBI 001.001: Orient\n\n**Priority:** P4\n**Dependencies:** None\n'
		const result = parsePbiHeader(project, pbiPath001, body)
		expect(isRefusal(result)).toBe(true)
	})
})

describe('pbi id helpers', () => {
	test('formatPbiId renders the canonical form', () => {
		expect(formatPbiId({ epic: '001', pbi: '003' })).toBe('PBI 001.003')
	})
})

describe('isEligible', () => {
	test('None (no dependencies) is eligible', () => {
		expect(isEligible([], ['.wag/backlog/epic-001-wagc/PBI-001.md']))
			.toBe(true)
	})

	test('a completed dependency (closed) makes the PBI eligible', () => {
		const deps = [{ epic: '001', pbi: '002' }]
		const tree = ['.wag/backlog/_completed/epic-001-wagc/PBI-002.md']
		expect(isEligible(deps, tree)).toBe(true)
	})

	test('an open (not completed) dependency blocks the PBI', () => {
		const deps = [{ epic: '001', pbi: '003' }]
		const tree = ['.wag/backlog/epic-001-wagc/PBI-003.md']
		expect(isEligible(deps, tree)).toBe(false)
	})

	test('a future-bucket PBI is blocked by its deferral dependency', () => {
		const deps = [{ epic: '501', pbi: '007' }]
		const tree = ['.wag/backlog/epic-501-future/PBI-007.md']
		expect(isEligible(deps, tree)).toBe(false)
	})

	test(
		'a dependency completed under a different epic\'s _completed/ ' +
			'still counts',
		() => {
			const deps = [{ epic: '002', pbi: '010' }]
			const tree = [
				'.wag/backlog/_completed/epic-002-other-epic/PBI-010.md'
			]
			expect(isEligible(deps, tree)).toBe(true)
		})

	test('one unmet dependency among several blocks the PBI', () => {
		const deps = [{ epic: '001', pbi: '002' }, { epic: '001', pbi: '003' }]
		const tree = [
			'.wag/backlog/_completed/epic-001-wagc/PBI-002.md',
			'.wag/backlog/epic-001-wagc/PBI-003.md'
		]
		expect(isEligible(deps, tree)).toBe(false)
	})
})

describe('selectDefault', () => {
	const summary = (overrides: Partial<PbiSummary>): PbiSummary => ({
		id: { epic: '001', pbi: '001' },
		title: 'title',
		priority: 'P2',
		dependencies: [],
		...overrides
	})

	test('null when nothing is eligible', () => {
		expect(selectDefault([], 'epic-001-wagc')).toBeNull()
	})

	test('highest priority wins regardless of epic', () => {
		const p1 = summary({ id: { epic: '002', pbi: '005' }, priority: 'P1' })
		const p2 = summary({ id: { epic: '001', pbi: '001' }, priority: 'P2' })
		expect(selectDefault([p2, p1], 'epic-001-wagc')).toBe(p1)
	})

	test('ties on priority go to the same epic as active_epic', () => {
		const other = summary({ id: { epic: '002', pbi: '005' }, priority: 'P1' })
		const same = summary({ id: { epic: '001', pbi: '010' }, priority: 'P1' })
		expect(selectDefault([other, same], 'epic-001-wagc')).toBe(same)
	})

	test('ties outside the active epic go to the lowest epic number', () => {
		const higherEpic = summary({
			id: { epic: '003', pbi: '001' },
			priority: 'P1'
		})
		const lowerEpic = summary({
			id: { epic: '002', pbi: '001' },
			priority: 'P1'
		})
		expect(selectDefault([higherEpic, lowerEpic], 'epic-005-other'))
			.toBe(lowerEpic)
	})

	test('ties within the same epic go to the lowest local number', () => {
		const later = summary({ id: { epic: '001', pbi: '010' }, priority: 'P1' })
		const earlier = summary({ id: { epic: '001', pbi: '003' }, priority: 'P1' })
		expect(selectDefault([later, earlier], 'epic-001-wagc')).toBe(earlier)
	})
})
