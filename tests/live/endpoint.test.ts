import { describe, test, expect } from 'vitest'
import { Client } from '@modelcontextprotocol/sdk/client/index.js'
import {
	StreamableHTTPClientTransport
} from '@modelcontextprotocol/sdk/client/streamableHttp.js'

const endpoint = process.env.WAGC_ENDPOINT
const secret = process.env.WAGC_SECRET

describe.skipIf(!endpoint || !secret)('the deployed wagc endpoint', () => {
	const makeClient = async () => {
		const client = new Client({ name: 'wagc-live-test', version: '0.1.0' })
		const transport = new StreamableHTTPClientTransport(
			new URL(endpoint as string),
			{ requestInit: { headers: { 'x-mcp-secret': secret as string } } })
		await client.connect(transport)
		return client
	}

	test('the tool list is exactly wagc', async () => {
		const client = await makeClient()
		const { tools } = await client.listTools()
		expect(tools.map(tool => tool.name)).toEqual(['wagc'])
		await client.close()
	})

	test('orienting on claude-mcps returns phase, position and next', async () => {
		const client = await makeClient()
		const result = await client.callTool({
			name: 'wagc',
			arguments: { project: 'claude-mcps' }
		})
		const content = result.content as { type: string, text?: string }[]
		const text = content[0]?.text ?? ''
		expect(text).toContain('## Position')
		expect(text).toContain('## Ritual')
		expect(text).toContain('## Next call')
		await client.close()
	})

	test('a request without the secret is rejected with 401', async () => {
		const response = await fetch(endpoint as string, {
			method: 'POST',
			headers: { 'content-type': 'application/json' },
			body: JSON.stringify({
				jsonrpc: '2.0',
				id: 1,
				method: 'tools/list',
				params: {}
			})
		})
		expect(response.status).toBe(401)
	})
})
