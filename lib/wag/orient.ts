import type { CallToolResult } from '@modelcontextprotocol/sdk/types.js'
import type { Deps } from './types'
import { refusal, isRefusal } from './refusal'
import { gatherFacts } from './facts'
import { derive } from './derive'
import { render } from './render'

export const orient = async (
	project: string,
	deps: Deps
): Promise<CallToolResult> => {
	const repo = await deps.github.getRepo(project)
	if (repo == null)
		return render(refusal.unknownProject(project, deps.github.owner))

	const facts = await gatherFacts(project, deps.github)
	if (isRefusal(facts))
		return render(facts)

	const result = derive(facts)
	if (isRefusal(result))
		return render(result)

	const [voice, phaseRitual] = await Promise.all([
		deps.rituals.read('voice'),
		deps.rituals.read(result.ritual)
	])
	return render(result, `${voice}\n\n${phaseRitual}`)
}
