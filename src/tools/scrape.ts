import type { McpServer } from '@modelcontextprotocol/sdk/server/mcp.js'

import type { CrawlbruleeClientFactory } from '../client.js'
import { runTool } from '../errors.js'
import { Schema_ApiScrapeRequest } from '../schemas/ApiScrapeRequest.js'
import { Schema_ApiScrapeSuccessResponse } from '../schemas/ApiScrapeResponse.js'
import type { ApiScrapeRequest, ApiScrapeSuccessResponse } from '../schemas/index.js'

const DESCRIPTION = [
  'Fetch a single URL via the crawlbrulee scraping API and return the requested content',
  '(markdown, cleaned HTML, raw HTML, links, images, screenshot, page metadata in `metadata`).',
  'Use this for one-shot page extraction. For full-site discovery use the `map` tool first.',
  'Screenshot URLs in the response are signed download links — the agent can fetch them when needed.',
  'The response also carries `response_meta.usage` = { credits (0 on a cache hit), proxy (the resolved',
  'tier — never `auto`), cache_hit } so you can see what the request cost.',
].join(' ')

export function registerScrapeTool(server: McpServer, getClient: CrawlbruleeClientFactory): void {
  server.registerTool(
    'scrape',
    {
      title: 'Scrape a URL',
      description: DESCRIPTION,
      inputSchema: Schema_ApiScrapeRequest.shape,
      outputSchema: Schema_ApiScrapeSuccessResponse.shape,
    },
    (args: ApiScrapeRequest) =>
      runTool(async () => (await getClient().scrape(args)) as ApiScrapeSuccessResponse)
  )
}
