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
  'The response also carries `response_meta.usage` = { credits, engine, proxy (the resolved tier —',
  'never `auto`), screenshot_slices }. `engine` is the billed engine (`http`, `browser`, `screenshot`,',
  '`cache`); a cache hit is represented by `engine: "cache"`, so you can see what the request cost.',
  'Extraction is capped per page: 30,000 links, 10,000 inline images and 10,000,000 characters of',
  'HTML. A page past a cap is truncated rather than refused, and the response `warnings` array names',
  'which one (`links_truncated`, `inline_images_truncated`, `raw_html_truncated`) — so treat that',
  'output as incomplete.',
  'Use `cleanup` to control what is removed before any output is built: `ads_and_popups` (on by',
  'default) drops ads, cookie banners and chat widgets, and `exclude_selectors` removes anything',
  'else. It shapes markdown, cleaned_html, links, images and the screenshot, and NEVER `raw_html` —',
  'so request `raw_html` when you need the page exactly as it arrived.',
  '`warnings` also reports a section whose extraction failed outright (`links_unavailable`,',
  '`inline_images_unavailable`, `metadata_unavailable`): that field comes back omitted or empty',
  'while the rest of the scrape succeeded, so do NOT conclude the page had no links/images/metadata',
  '— re-run the scrape instead. An empty field with no such warning does mean the page had none.',
].join(' ')

export function registerScrapeTool(server: McpServer, getClient: CrawlbruleeClientFactory): void {
  server.registerTool(
    'scrape',
    {
      title: 'Scrape a URL',
      description: DESCRIPTION,
      inputSchema: Schema_ApiScrapeRequest.shape,
      outputSchema: Schema_ApiScrapeSuccessResponse,
    },
    (args: ApiScrapeRequest) =>
      runTool(async () => (await getClient().scrape(args)) as ApiScrapeSuccessResponse)
  )
}
