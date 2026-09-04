import { describe, test, expect } from 'vitest'
import { derive } from '../lib/wag/derive'
import { isRefusal } from '../lib/wag/refusal'
import type { Facts, Orient, Phase, Position } from '../lib/wag/types'
import type { State } from '../lib/wag/state'

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

const branch = { name: 'feature/PBI-001.001', head: 'sha1' }

const draftAdr = {
	path: '.wag/adr/active/ADR-001.001.md',
	status: 'draft' as const,
	pbi: { epic: '001', pbi: '001' }
}

const approvedAdr = {
	path: '.wag/adr/active/ADR-001.001.md',
	status: 'approved' as const,
	pbi: { epic: '001', pbi: '001' }
}

const openPr = {
	number: 1,
	url: 'https://github.com/x/y/pull/1',
	title: 'PBI 001.001',
	state: 'open' as const,
	checks: 'green' as const
}

const mergedPr = {
	number: 1,
	url: 'https://github.com/x/y/pull/1',
	title: 'PBI 001.001',
	state: 'merged' as const,
	checks: 'green' as const
}

test.each<[string, Facts, Phase, Position, Orient['next']]>([
	[
		'rule 1: open snags halt, regardless of other facts',
		facts({ branch, adr: null, snags: ['.wag/snags/SNAG-001.md'] }),
		'tri', 'halted', 'tri'
	],
	[
		'rule 2: no feature branch, an active ADR — closure pending',
		facts({ branch: null, adr: approvedAdr }),
		'dev', 'closure-pending', 'merge'
	],
	[
		'rule 4: draft ADR — grill in progress',
		facts({ branch, adr: draftAdr }),
		'adr', 'grill', 'approve'
	],
	[
		'rule 5: approved ADR, no PR — ready to dispatch',
		facts({ branch, adr: approvedAdr, pr: null }),
		'dev', 'ready', 'approve'
	],
	[
		'rule 6: PR open, no review — awaiting review',
		facts({ branch, adr: approvedAdr, pr: openPr, review: null }),
		'rvw', 'awaiting-review', 'approve'
	],
	[
		'rule 7: PR open, REQUEST_CHANGES, no dispositions — ' +
			'dispositions pending',
		facts({
			branch,
			adr: approvedAdr,
			pr: openPr,
			review: { path: 'r', verdict: 'REQUEST_CHANGES', dispositions: false }
		}),
		'rvw', 'dispositions', 'save'
	],
	[
		'rule 8: PR open, APPROVE — merge position',
		facts({
			branch,
			adr: approvedAdr,
			pr: openPr,
			review: { path: 'r', verdict: 'APPROVE', dispositions: false }
		}),
		'dev', 'merge', 'approve'
	],
	[
		'rule 9: PR merged, ADR still active — closure pending',
		facts({ branch, adr: approvedAdr, pr: mergedPr }),
		'dev', 'closure-pending', 'merge'
	],
	[
		'rule 10: no feature branch, stash present — cycle-end tri offered',
		facts({ branch: null, adr: null, stash: ['.wag/stash/STASH-001.md'] }),
		'tri', 'cycle-end', 'approve'
	],
	[
		'rule 11: no feature branch, nothing pending — between PBIs',
		facts({ branch: null, adr: null }),
		'adr', 'pick', 'pick'
	]
])('%s', (_name, f, phase, position, next) => {
	const result = derive(f)
	expect(isRefusal(result)).toBe(false)
	if (!isRefusal(result)) {
		expect(result.phase).toBe(phase)
		expect(result.position).toBe(position)
		expect(result.next).toBe(next)
	}
})

test(
	'rule 8, the dispositions-present variant, also lands on the merge ' +
		'position',
	() => {
		const result = derive(facts({
			branch,
			adr: approvedAdr,
			pr: openPr,
			review: { path: 'r', verdict: 'REQUEST_CHANGES', dispositions: true }
		}))
		expect(isRefusal(result)).toBe(false)
		if (!isRefusal(result)) {
			expect(result.phase).toBe('dev')
			expect(result.position).toBe('merge')
			expect(result.next).toBe('approve')
		}
	})

describe('refusal', () => {
	test(
		'rule 3: a feature branch with no active ADR refuses, naming ' +
			'the branch',
		() => {
			const result = derive(facts({ branch, adr: null }))
			expect(isRefusal(result)).toBe(true)
			if (isRefusal(result)) {
				expect(result.kind).toBe('branch-without-adr')
				expect(result.say).toContain(branch.name)
			}
		})
})
