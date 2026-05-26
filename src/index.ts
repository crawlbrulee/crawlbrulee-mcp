import { StdioServerTransport } from '@modelcontextprotocol/sdk/server/stdio.js'

import { buildServer } from './server.js'

async function main(): Promise<void> {
  const server = buildServer()
  const transport = new StdioServerTransport()
  await server.connect(transport)
  // Server now runs until stdin closes. Process stays alive on the transport.
}

main().catch((err: unknown) => {
  const message = err instanceof Error ? err.message : String(err)
  process.stderr.write(`crawlbrulee-mcp: fatal: ${message}\n`)
  process.exit(1)
})
