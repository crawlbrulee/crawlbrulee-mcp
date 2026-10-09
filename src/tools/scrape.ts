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
  'To pull named values such as prices, titles or links, set `extract.elements` (name → CSS selector)',
  'instead of reading the whole markdown: they come back in `elements`, for no extra credits.',
  'Rules: https://crawlbrulee.com/docs/scrape/elements.',
  'Check `page_status_code` before you trust the content: it is the HTTP status the site answered',
  'with for the final page. A page the site served is a successful result whatever its status, so a',
  '404 or 503 page comes back with its content, not as an error. A 404 means the markdown is the',
  'site\'s "not found" page, not the page you asked for. 2xx and 4xx pages are billed, except 403,',
  '407, 408, 429 and 451; 5xx pages are never billed.',
  'If the site cannot be reached at all the tool returns a `target_unreachable` error (HTTP 502,',
  'not billed): retry later or check the URL.',
  'Screenshot URLs in the response are signed download links that expire 24 hours after the scrape:',
  'download the image if you need it later; do not keep the link.',
  'The response also carries `response_meta.usage`: `total_credit_cost` = `engine_credit_cost` ×',
  '`proxy_multiplier` + `screenshot_slicing_credit_cost` + `zero_data_retention_credit_cost`, plus `engine` and `proxy` (the resolved',
  'tier — never `auto`). `engine` is the billed engine (`http`, `browser`, `screenshot`, `cache`); a',
  'cache hit is represented by `engine: "cache"`.',
  'Set `zero_data_retention: true` to keep the result out of the shared cache; anything stored to deliver it is kept for 24 hours, then deleted. It adds 1 credit and must be enabled for the organization (else a `zero_data_retention_not_enabled` error, not billed). See https://crawlbrulee.com/docs/zero-data-retention.',
  'Extraction is capped per page: 30,000 links, 10,000 inline images and 10,000,000 characters of',
  'HTML. A page past a cap is truncated rather than refused, and the response `warnings` array names',
  'which one (`links_truncated`, `inline_images_truncated`, `raw_html_truncated`) — so treat that',
  'output as incomplete. `elements_truncated` means an `elements` value hit a limit.',
  'Use `cleanup` to control what is removed before any output is built: `ads_and_popups` (on by',
  'default) drops ads, cookie banners and chat widgets, and `exclude_selectors` removes anything',
  'else. It shapes markdown, cleaned_html, links, images and the screenshot, and NEVER `raw_html` —',
  'so request `raw_html` when you need the page exactly as it arrived.',
  '`warnings` also reports a section whose extraction failed outright (`links_unavailable`,',
  '`inline_images_unavailable`, `metadata_unavailable`): that field comes back omitted or empty',
  'while the rest of the scrape succeeded, so do NOT conclude the page had no links/images/metadata',
  '— re-run the scrape instead. An empty field with no such warning does mean the page had none.',
  '`screenshot_unavailable` means a screenshot was asked for, but the page came back from the http',
  'engine without one.',
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
