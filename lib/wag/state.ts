import { z } from 'zod'
import type { Refusal } from './types'
import { refusal } from './refusal'

export const Env = z.object({
	GITHUB_TOKEN: z.string().min(1),
	MCP_SHARED_SECRET: z.string().min(1),
	GITHUB_OWNER: z.string().min(1).default('samfreeman')
}).strict()

export type Env = z.infer<typeof Env>

export const State = z.object({
	app_name: z.string().min(1),
	wag_version: z.string().min(1),
	current_mode: z.string().nullable().optional(),
	active_epic: z.string().regex(/^epic-\d{3}-[a-z0-9-]+$/),
	active_pbi: z.string().regex(/^\d{3}$/).nullable(),
	feature_branch: z.string().min(1).nullable(),
	docs_page_path: z.string().nullable().optional()
}).strict()

export type State = z.infer<typeof State>

type EnvResult = ReturnType<typeof Env.safeParse>
type EnvSuccess = Extract<EnvResult, { success: true }>

let cached: EnvSuccess | null = null

export const parseEnv = (): EnvResult => {
	if (cached != null)
		return cached
	const result = Env.safeParse({
		GITHUB_TOKEN: process.env.GITHUB_TOKEN,
		MCP_SHARED_SECRET: process.env.MCP_SHARED_SECRET,
		GITHUB_OWNER: process.env.GITHUB_OWNER
	})
	if (result.success)
		cached = result
	return result
}

const fieldOf = (issue: z.ZodIssue) =>
	issue.code == 'unrecognized_keys'
		? issue.keys.join(', ')
		: issue.path.join('.')

const legacyFields = new Set(['active_epic', 'wag_version'])

export const parseState = (project: string, text: string): State | Refusal => {
	let json: unknown
	try {
		json = JSON.parse(text)
	}
	catch {
		return refusal.invalidState(project, null)
	}
	const parsed = State.safeParse(json)
	if (parsed.success)
		return parsed.data
	const fields = parsed.error.issues.map(fieldOf)
	const legacy = fields.some(field => legacyFields.has(field))
	return refusal.invalidState(project, fields[0], legacy)
}
