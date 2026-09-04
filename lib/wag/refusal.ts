import type { Continuation, Refusal } from './types'

export type NotAWagProjectReason = 'no-wag-dir' | 'no-state-file'

export const isRefusal = <T>(value: T | Refusal): value is Refusal =>
	value != null &&
	typeof value == 'object' &&
	'kind' in value &&
	'say' in value

export const refusal = {
	unknownProject: (project: string, owner: string): Refusal => ({
		kind: 'unknown-project',
		say:
			`I can't orient on ${project}. No repository named ${project} ` +
			`exists under ${owner}.`,
		why: [
			'Project names are repo names.',
			`No repo ${owner}/${project} was found.`
		],
		next: [
			'Check the name.',
			'If this is a new project, starting one from CV arrives with ' +
				'a later release; for now create it from CC.'
		]
	}),
	notAWagProject: (
		project: string,
		ref: string,
		reason: NotAWagProjectReason
	): Refusal => ({
		kind: 'not-a-wag-project',
		say: reason == 'no-wag-dir'
			? `I can't orient on ${project}. It's a repository, but ` +
				`there's no .wag/ directory on ${ref}.`
			: `I can't orient on ${project}. Its .wag/ directory on ` +
				`${ref} has no state file.`,
		why: reason == 'no-wag-dir'
			? [`No .wag/ directory was found on ${project}'s ${ref}.`]
			: [`${project}'s .wag/ directory on ${ref} has no state.json.`],
		next: [
			'Run wag init from CC.',
			'Adopting an existing repo without .wag/ arrives with a ' +
				'later release.'
		]
	}),
	invalidState: (
		project: string,
		field: string | null,
		legacy: boolean = false
	): Refusal => ({
		kind: 'invalid-state',
		say: field == null
			? `I can't orient on ${project}. Its state file is not valid JSON.`
			: legacy
				? `I can't orient on ${project}. ${field} is missing from ` +
					'its state, which looks like a legacy shape.'
				: `I can't orient on ${project}. Its state file failed ` +
					`validation on ${field}.`,
		why: field == null
			? ['.wag/state.json could not be parsed as JSON.']
			: legacy
				? [
					`state.json has no ${field}.`,
					'Every current wag project state carries this field.'
				]
				: [
					`.wag/state.json's ${field} doesn't match the expected ` +
						'shape.'
				],
		next: field == null
			? ['Fix .wag/state.json from CC so it parses as JSON.']
			: legacy
				? [
					'Run /wag:update from CC to bring the project state ' +
						'current.'
				]
				: [`Fix ${field} in .wag/state.json from CC.`]
	}),
	ambiguousBranch: (project: string, branches: string[]): Refusal => ({
		kind: 'ambiguous-branch',
		say:
			`I can't orient on ${project}. More than one feature branch ` +
			`exists: ${branches.join(', ')}.`,
		why: [
			'Exactly one feature/PBI-* branch is expected at a time.',
			`Found: ${branches.join(', ')}.`
		],
		next: ['Close or delete one of these branches from CC.']
	}),
	branchWithoutAdr: (project: string, branch: string): Refusal => ({
		kind: 'branch-without-adr',
		say:
			`I can't orient on ${project}. ${branch} exists, but no ` +
			'active ADR was found.',
		why: [`${branch} carries no .wag/adr/active/ADR-*.md file.`],
		next: ['Approve an ADR on this branch from CC, or delete the branch.']
	}),
	unreadableArtifact: (
		project: string,
		path: string,
		expected: string
	): Refusal => ({
		kind: 'unreadable-artifact',
		say:
			`I can't orient on ${project}. ${path} could not be read as ` +
			'expected.',
		why: [`${path} does not contain ${expected}.`],
		next: [`Fix ${path} from CC.`]
	}),
	listingTruncated: (project: string): Refusal => ({
		kind: 'listing-truncated',
		say: `${project}'s .wag/ listing was truncated by GitHub.`,
		why: [`${project}'s .wag/ tree is too large for one listing.`],
		next: [
			'Report this; the tree may need to be split or read differently.'
		]
	}),
	notYetAvailable: (continuation: Continuation): Refusal => ({
		kind: 'not-yet-available',
		say:
			`The ${continuation} continuation isn't available in this ` +
			'release.',
		why: [`This release of wagc doesn't act on ${continuation} yet.`],
		next: ['Carry the decision to CC.']
	})
}
