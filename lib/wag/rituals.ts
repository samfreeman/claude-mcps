import { readFile } from 'node:fs/promises'
import { join } from 'node:path'
import type { RitualName } from './types'

const dir = join(process.cwd(), 'lib', 'wag', 'rituals')
const cache = new Map<string, Promise<string>>()

export const readRitual = (name: RitualName) => {
	const cached = cache.get(name)
	if (cached != null)
		return cached
	const promise = readFile(join(dir, `${name}.md`), 'utf-8')
	promise.catch(() => cache.delete(name))
	cache.set(name, promise)
	return promise
}
