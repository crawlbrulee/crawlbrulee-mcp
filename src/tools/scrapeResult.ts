import type { McpServer } from '@modelcontextprotocol/sdk/server/mcp.js'

import type { CrawlbruleeClientFactory } from '../client.js'
import { runTool } from '../errors.js'
import { Schema_ApiScrapeSuccessResponse } from '../schemas/ApiScrapeResponse.js'
import { Schema_AsyncJobId } from '../schemas/ApiScrapeAsyncResponse.js'
import type { ApiScrapeSuccessResponse, AsyncJobId } from '../schemas/index.js'

const DESCRIPTION = [
  'Fetch the extracted content of a completed async scrape job (the same result shape as the',
  'synchronous `scrape` tool: markdown, cleaned HTML, raw HTML, links, images, screenshot,',
  'page metadata in `metadata`, and `response_meta.usage`). Errors if the job is still',
  '`pending`/`running` — check `scrape_status` first (status `done`) before calling this.',
  'Screenshot URLs are signed download links.',
].join(' ')

export function registerScrapeResultTool(
  server: McpServer,
  getClient: CrawlbruleeClientFactory
): void {
  server.registerTool(
    'scrape_result',
    {
      title: 'Get an async scrape job result',
      description: DESCRIPTION,
      inputSchema: Schema_AsyncJobId.shape,
      outputSchema: Schema_ApiScrapeSuccessResponse.shape,
    },
    (args: AsyncJobId) =>
      runTool(
        async () => (await getClient().getScrapeResult(args.job_id)) as ApiScrapeSuccessResponse
      )
  )
}
