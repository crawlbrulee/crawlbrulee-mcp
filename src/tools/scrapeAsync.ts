import type { AsyncScrapeRequest } from '@crawlbrulee/sdk'
import type { McpServer } from '@modelcontextprotocol/sdk/server/mcp.js'

import type { CrawlbruleeClientFactory } from '../client.js'
import { runTool } from '../errors.js'
import { Schema_ApiScrapeAsyncRequest } from '../schemas/ApiScrapeAsyncRequest.js'
import { Schema_ApiScrapeAsyncResponse } from '../schemas/ApiScrapeAsyncResponse.js'
import type { ApiScrapeAsyncRequest, ApiScrapeAsyncResponse } from '../schemas/index.js'

const DESCRIPTION = [
  'Submit a scrape job to run ASYNCHRONOUSLY and return a `job_id` immediately,',
  'instead of holding the connection open. Use this for long-running scrapes',
  '(heavy JS rendering, full-page screenshots of long pages) — for a quick one-shot',
  'fetch prefer the synchronous `scrape` tool, which blocks and returns the page directly.',
  'Poll the job with `scrape_status` and fetch the page with `scrape_result` once done.',
  'Optionally attach a per-job completion `webhook`: crawlbrulee delivers a single',
  'signed `scrape.complete` POST to your endpoint when the job finishes (HTTPS required',
  'in production), and echoes your opaque `webhook.metadata` back in the delivery',
  '(under `data.metadata`, alongside `data.response_meta.usage`).',
].join(' ')

export function registerScrapeAsyncTool(
  server: McpServer,
  getClient: CrawlbruleeClientFactory
): void {
  server.registerTool(
    'scrape_async',
    {
      title: 'Scrape a URL asynchronously',
      description: DESCRIPTION,
      inputSchema: Schema_ApiScrapeAsyncRequest.shape,
      outputSchema: Schema_ApiScrapeAsyncResponse.shape,
    },
    (args: ApiScrapeAsyncRequest) =>
      runTool(
        async () =>
          (await getClient().scrapeAsync(args as AsyncScrapeRequest)) as ApiScrapeAsyncResponse
      )
  )
}
