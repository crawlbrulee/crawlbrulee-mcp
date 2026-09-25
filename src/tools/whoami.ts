import type { McpServer } from '@modelcontextprotocol/sdk/server/mcp.js'

import type { CrawlbruleeClientFactory } from '../client.js'
import { runTool } from '../errors.js'
import { Schema_ApiWhoamiResponse } from '../schemas/ApiWhoamiResponse.js'
import type { ApiWhoamiResponse } from '../schemas/index.js'

const DESCRIPTION = [
  'Return the organization name, token name, and truncated token preview for the API key',
  'currently configured on the MCP server. Useful for confirming which account is in use',
  'before performing credit-consuming operations.',
].join(' ')

export function registerWhoamiTool(server: McpServer, getClient: CrawlbruleeClientFactory): void {
  server.registerTool(
    'whoami',
    {
      title: 'Identify the API token',
      description: DESCRIPTION,
      inputSchema: {},
      outputSchema: Schema_ApiWhoamiResponse,
    },
    () => runTool(async () => (await getClient().whoami()) as ApiWhoamiResponse)
  )
}
