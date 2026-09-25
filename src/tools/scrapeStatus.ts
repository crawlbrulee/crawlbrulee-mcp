import type { McpServer } from '@modelcontextprotocol/sdk/server/mcp.js'

import type { CrawlbruleeClientFactory } from '../client.js'
import { runTool } from '../errors.js'
import {
  Schema_ApiScrapeStatusResponse,
  Schema_AsyncJobId,
} from '../schemas/ApiScrapeAsyncResponse.js'
import type { ApiScrapeStatusResponse, AsyncJobId } from '../schemas/index.js'

const DESCRIPTION = [
  'Look up the current lifecycle status of an async scrape job submitted via `scrape_async`.',
  'Returns the job state (`pending`, `running`, `done`, `failed`), with an `error` message',
  'when it failed and a `response_meta.usage` block (credits, billed engine, resolved proxy tier,',
  'screenshot_slices) once it is',
  '`done`. Poll this until the status is `done`, then call `scrape_result` to fetch',
  'the page. If you registered a completion webhook on submit you can skip polling and react',
  'to the delivery instead.',
].join(' ')

export function registerScrapeStatusTool(
  server: McpServer,
  getClient: CrawlbruleeClientFactory
): void {
  server.registerTool(
    'scrape_status',
    {
      title: 'Check an async scrape job status',
      description: DESCRIPTION,
      inputSchema: Schema_AsyncJobId.shape,
      outputSchema: Schema_ApiScrapeStatusResponse,
    },
    (args: AsyncJobId) =>
      // The SDK's `AsyncJobStatusResponse` is snake_case (job_id, created_at),
      // matching the vendored status schema 1:1, so a direct cast lines the SDK
      // return type up with the tool's output schema.
      runTool(
        async () => (await getClient().getScrapeStatus(args.job_id)) as ApiScrapeStatusResponse
      )
  )
}
