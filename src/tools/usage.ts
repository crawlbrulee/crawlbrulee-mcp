import type { McpServer } from '@modelcontextprotocol/sdk/server/mcp.js'

import type { CrawlbruleeClientFactory } from '../client.js'
import { runTool } from '../errors.js'
import { Schema_ApiUsageResponse } from '../schemas/ApiUsageResponse.js'
import type { ApiUsageResponse } from '../schemas/index.js'

const DESCRIPTION = [
  'Return the current billing-cycle usage for the authenticated organization:',
  'total / used / available credits, used quota percent, max concurrency, and cycle reset time.',
  'Call this before launching large scrape jobs to confirm available credit.',
].join(' ')

export function registerUsageTool(server: McpServer, getClient: CrawlbruleeClientFactory): void {
  server.registerTool(
    'usage',
    {
      title: 'Get current usage',
      description: DESCRIPTION,
      inputSchema: {},
      outputSchema: Schema_ApiUsageResponse.shape,
    },
    () => runTool(async () => (await getClient().usage()) as ApiUsageResponse)
  )
}
