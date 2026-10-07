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
  'when it failed and a `response_meta.usage` block (total_credit_cost and its parts, billed engine,',
  'resolved proxy tier) once it is `done`. A job whose page the site served ends `done` even when',
  'that page is a 404 or 503 — read `page_status_code` in the result. A job that could not reach',
  'the site at all ends `failed` (the `error` text is a general message, not the reason) and is not',
  'billed; retry later or check the url. Poll this until the status is',
  '`done`, then call `scrape_result` to fetch',
  'the page. If you registered a completion webhook on submit you can skip polling and react',
  'to the delivery instead. A job answers for 24 hours after it was submitted; after that this',
  'returns `not_found`, the same as for an unknown job id.',
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
