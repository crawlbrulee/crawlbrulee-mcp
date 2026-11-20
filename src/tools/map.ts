import type { McpServer } from '@modelcontextprotocol/sdk/server/mcp.js'

import type { CrawlbruleeClientFactory } from '../client.js'
import { runTool } from '../errors.js'
import { Schema_ApiMapRequest } from '../schemas/ApiMapRequest.js'
import { Schema_ApiMapResult } from '../schemas/ApiMapResponse.js'
import type { ApiMapRequest, ApiMapResult } from '../schemas/index.js'

const DESCRIPTION = [
  'Build (or fetch a cached) link map of a website from its sitemaps, plus the links on its home',
  'page. Returns paginated links, each { url, type, lastmod }: `type` is `page`, `sitemap` or',
  '`sitemap_index` (a sitemap file that lists other sitemap files); read either kind of sitemap',
  'file with `sitemap_url` in another call. `lastmod` is the date from the sitemap (UTC) or null.',
  'Filterable by link type (internal /',
  'external / subdomain). Use this to enumerate a site before scraping selected pages.',
  "By default the map reads the site's top sitemap files and 2 levels of nested ones (`depth` 3),",
  'returns pages (`entries`) and finds up to 5000 of them (`max_results`, max 100000).',
  '`max_results` is a discovery budget, not a trim at the end: discovery stops as soon as that many',
  'entries of the asked kind are found, so a smaller value is a faster map. A map stopped that way',
  'returns exactly `max_results` links with `response_capped` false; the signal that the site has',
  'more is `response_meta.truncation.discovery_cap_reason`. "max_results": ask again with a higher',
  '`max_results`. "depth": there are sitemap files past the `depth` you asked for, listed in',
  '`unread_sitemaps`; that is the answer to your depth, not a fault. "unread_files": a sitemap file',
  'could not be read whole this time, often temporary, so asking again later can return more. "time",',
  '"file_budget" and "file_size": the site is big or slow, and a retry will not help.',
  '`discovery_capped` says discovery stopped early, `sitemaps_skipped` how many sitemap files were',
  'skipped or only partly read.',
  '`limit` (default 5000, max 10000) only pages the answer.',
  'To map a very large site in several calls, first ask with `depth: 1` and `entries: "sitemaps"`:',
  'one call lists the top sitemap files and every file they list (a listed file shows as `sitemap`',
  'until a map reads it, even when it is an index). Then read each file with `sitemap_url` (on the',
  "same site as `url`, or on a host the site's robots.txt names, such as a CDN), or ask with a",
  'higher `depth`.',
  '`truncation.unread_sitemaps` names the files a call did not read whole, to read next (except',
  'a file that says it is over the size limit: no call reads that one); when that',
  'list is full, ask the same with `entries: "sitemaps"` to get every sitemap file as a link, paged.',
  'A sitemap index holds only sitemap files, so reading one at a low `depth` with',
  '`entries: "pages"` returns no pages: ask with `entries: "sitemaps"` or a higher `depth`.',
  '`modified_since` keeps only entries whose `lastmod` is at or after it: an entry with no',
  '`lastmod` is left out (so no home page link is returned). Every sitemap file is read whatever',
  'its own date, and each entry is judged by its own `lastmod`. With `entries: "sitemaps"` a file',
  'is returned by its own date, so ask with `entries: "pages"` to find the pages that changed.',
  'A request with `modified_since` is always mapped fresh, never from the',
  'cache, and priced as a fresh map. A map with `modified_since` or `sitemap_url` adds no home page',
  'links. If the site answers 429 on the file in `sitemap_url`, on its robots.txt or on one of',
  'its top sitemap files, the tool returns `too_many_requests` (not billed): wait and retry.',
  'Set `zero_data_retention: true` to keep the result out of the shared cache; anything stored to deliver it is kept for 24 hours, then deleted. It adds 1 credit and must be enabled for the organization (else a `zero_data_retention_not_enabled` error, not billed). See https://crawlbrulee.com/docs/zero-data-retention.',
  'Returned URLs are normalized the same way `scrape` normalizes its returned `url`, so',
  'map-then-scrape stays on one host. Results are ordered with the most useful links first.',
  'The response carries `response_meta.usage`: `total_credit_cost` = `engine_credit_cost` ×',
  '`proxy_multiplier` + `zero_data_retention_credit_cost`, plus `engine` and `proxy` (the resolved tier, never `auto`). Map has no screenshot slicing and no',
  '`page_status_code`: it reads many files, not one page. A map that found nothing because the site',
  "answered only with statuses we don't bill (a 5xx, for example), or not at all, is empty and free. If the site cannot be reached, the",
  'tool can return a `target_unreachable` error (HTTP 502, not billed): retry later or check the URL.',
  'The full walk-through for a very large or deep site:',
  'https://crawlbrulee.com/docs/map/sitemaps#map-a-very-large-or-deep-site-in-several-calls.',
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
      // The local schemas are the wire contract. The request goes through as is (extra
      // fields are fine for the SDK's MapRequest); the result takes a double cast because
      // the SDK's MapResponse does not type `type`, `lastmod` or the new truncation fields yet.
      runTool(async () => (await getClient().map(toApiBody(args))) as unknown as ApiMapResult)
  )
}

/**
 * `max_urls` is the old name of `max_results`. The tool sends it as `max_results`, so it
 * keeps working after the api drops the old name. When both are given, `max_results` wins,
 * as it does in the api.
 */
export function toApiBody(args: ApiMapRequest): Omit<ApiMapRequest, 'max_urls'> {
  const { max_urls: maxUrls, ...body } = args
  if (maxUrls !== undefined && body.max_results === undefined) {
    return { ...body, max_results: maxUrls }
  }
  return body
}
