import type { McpServer } from '@modelcontextprotocol/sdk/server/mcp.js'

import type { CrawlbruleeClientFactory } from '../client.js'
import { runTool } from '../errors.js'
import { Schema_ApiMapRequest } from '../schemas/ApiMapRequest.js'
import { Schema_ApiMapResult } from '../schemas/ApiMapResponse.js'
import type { ApiMapRequest, ApiMapResult } from '../schemas/index.js'

const DESCRIPTION = [
  'Build (or fetch a cached) link-map for a website by combining sitemap discovery with homepage',
  'link extraction. Returns paginated lists of discovered URLs, each item just { url }.',
  'Filterable by link type (internal / external / subdomain). Use this to enumerate a site before',
  'scraping selected pages.',
  '`max_urls` (default 5000, max 100000) is a discovery budget, not a trim at the end: discovery',
  'stops as soon as that many URLs are found, so a smaller value is a faster, cheaper crawl.',
  'A map stopped that way returns exactly `max_urls` links with `response_capped` false — the',
  'signal that the site has more is `response_meta.truncation.discovery_cap_reason`. When that is',
  '"max_urls", ask again with a higher `max_urls` to get more; "unread_files" means a sitemap file',
  'could not be read this time and is often temporary, so asking again later can return more;',
  '"time", "file_budget", "depth" and "file_size" mean the site itself is big, slow or deep and a',
  'retry will not help. `discovery_capped` says discovery stopped early, `sitemaps_skipped` how',
  'many sitemap files were skipped or only partly read.',
  '`limit` (default 5000, max 10000) only pages the answer.',
  'Set `zero_data_retention: true` to keep the result out of the shared cache; anything stored to deliver it is kept for 24 hours, then deleted. It adds 1 credit and must be enabled for the organization (else a `zero_data_retention_not_enabled` error, not billed). See https://crawlbrulee.com/docs/zero-data-retention.',
  'Returned URLs are normalized the same way `scrape` normalizes its returned `url`, so',
  'map-then-scrape stays on one host. Results are ordered with the most useful links first.',
  'The response carries `response_meta.usage`: `total_credit_cost` = `engine_credit_cost` ×',
  '`proxy_multiplier` + `zero_data_retention_credit_cost`, plus `engine` and `proxy` (the resolved tier, never `auto`). Map has no screenshot slicing and no',
  '`page_status_code`: it reads many files, not one page. A map that found nothing because the site',
  "answered only with statuses we don't bill (a 5xx, for example), or not at all, is empty and free. If the site cannot be reached, the",
  'tool can return a `target_unreachable` error (HTTP 502, not billed): retry later or check the URL.',
].join(' ')

export function registerMapTool(server: McpServer, getClient: CrawlbruleeClientFactory): void {
  server.registerTool(
    'map',
    {
      title: 'Map a website',
      description: DESCRIPTION,
      inputSchema: Schema_ApiMapRequest.shape,
      outputSchema: Schema_ApiMapResult,
    },
    (args: ApiMapRequest) =>
      // Double cast: the vendored schema above is the wire contract. The SDK's
      // MapTruncation type now has discovery_capped / sitemaps_skipped /
      // discovery_cap_reason, so a plain `as ApiMapResult` compiles and the
      // `unknown` step can go in a later release. SDK 0.16.0's reason type lacks
      // "unread_files" (0.16.1 adds it); the schema here accepts it either way.
      runTool(async () => (await getClient().map(args)) as unknown as ApiMapResult)
  )
}
