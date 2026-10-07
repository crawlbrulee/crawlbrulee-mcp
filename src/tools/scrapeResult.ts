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
  'Check `page_status_code` before you trust the content: it is the HTTP status the site answered',
  'with for the final page. A page the site served is a successful result whatever its status, so a',
  '404 or 503 page comes back with its content, not as an error. A 404 means the markdown is the',
  'site\'s "not found" page, not the page you asked for. 2xx and 4xx pages are billed, except 403,',
  '407, 408, 429 and 451; 5xx pages are never billed.',
  'A job answers for 24 hours after it was submitted, then returns `not_found`. Screenshot URLs are',
  'signed download links that expire at the same moment, however late you fetch the result: download',
  'the image if you need it later.',
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
      outputSchema: Schema_ApiScrapeSuccessResponse,
    },
    (args: AsyncJobId) =>
      runTool(
        async () => (await getClient().getScrapeResult(args.job_id)) as ApiScrapeSuccessResponse
      )
  )
}
