// Mirrors the crawlbrulee api's own schema. Update it by hand when the api changes.

import { z } from 'zod'
import { openEnum } from './openEnum.js'
import { PROXY_MULTIPLIER_DESCRIPTION, Schema_ApiProxyMultiplier } from './ApiScrapeResponse.js'
const API_RESOLVED_PROXY_TIER_VALUES = ['basic', 'advanced'] as const

/** Which limit stopped sitemap discovery first. The FIRST limit to fire wins. */
const DISCOVERY_CAP_REASONS = [
  'max_results',
  'time',
  'file_budget',
  'depth',
  'file_size',
  'unread_files',
] as const

/** Map usage has no screenshot-slice add-on. The new parts are optional: older api versions do not send them. */
export const Schema_ApiMapUsageMeta = z.looseObject({
  total_credit_cost: z
    .number()
    .int()
    .nonnegative()
    .optional()
    .describe(
      'Credits charged for this map request. Always equals engine_credit_cost × proxy_multiplier + zero_data_retention_credit_cost. 0 for a cache hit, and for an empty map when the site answered only with statuses we do not bill (a 5xx, for example) or not at all. Older api versions do not send it.'
    ),
  engine_credit_cost: z
    .number()
    .int()
    .nonnegative()
    .optional()
    .describe(
      'The engine base charged, before the proxy multiplier: 1 for "http", 0 for "cache". Also 0 for an empty map that is not billed. Older api versions do not send it.'
    ),
  proxy_multiplier: Schema_ApiProxyMultiplier.optional().describe(PROXY_MULTIPLIER_DESCRIPTION),
  zero_data_retention_credit_cost: z
    .number()
    .int()
    .nonnegative()
    .optional()
    .describe(
      'Credits added by zero data retention: 1 on a billed, fresh result, else 0. Older api versions do not send it.'
    ),
  engine: openEnum(['http', 'cache']).describe(
    'The map billing engine: `http` for fresh discovery or `cache` for a cached result'
  ),
  proxy: openEnum(API_RESOLVED_PROXY_TIER_VALUES).describe(
    'The proxy tier the request actually ran on (resolved value — never `auto`)'
  ),
})

export type ApiMapUsageMeta = z.infer<typeof Schema_ApiMapUsageMeta>

export const API_MAP_LINK_TYPE_VALUES = ['page', 'sitemap'] as const

// The api always sends `type` and `lastmod`. They are optional here so a response from an
// older api version still validates.
export const Schema_ApiMapLinkItem = z.looseObject({
  url: z.string().describe('The discovered URL'),
  type: openEnum(API_MAP_LINK_TYPE_VALUES)
    .optional()
    .describe(
      "`page` for a page address, `sitemap` for a sitemap file, which you can read with `sitemap_url` in another call (a file on another site only when the site's robots.txt names its host). A link found on the home page is a `page`."
    ),
  lastmod: z
    .string()
    .nullable()
    .optional()
    .describe(
      "The entry's `lastmod` from the sitemap, as an ISO 8601 date and time in UTC, or null when the sitemap gives none or it cannot be read. Always null for a link found on the home page."
    ),
})

export const Schema_ApiMapPagination = z.looseObject({
  page: z.number().int().positive().describe('Current page number'),
  limit: z.number().int().positive().describe('Number of items per page'),
  total: z
    .number()
    .int()
    .nonnegative()
    .describe(
      'How many links this answer holds across all its pages, after `entries`, `types` and `max_results` are applied'
    ),
  total_pages: z.number().int().nonnegative().describe('Total number of pages available'),
  has_more: z.boolean().describe('Whether more pages are available'),
})

export const Schema_ApiMapTruncation = z.looseObject({
  storage_capped: z
    .boolean()
    .describe(
      'Whether the map found more than 100,000 URLs, the most one map holds, so some were left out.'
    ),
  response_capped: z
    .boolean()
    .describe(
      'Whether more links were eligible than max_results, so the list was trimmed. Discovery ' +
        'itself stops at max_results, so this is normally true only when home-page links pushed ' +
        'the total past it. See discovery_cap_reason for a discovery stop.'
    ),
  // Required in the api, optional here: older api versions do not send it.
  total_before_max_results: z
    .number()
    .int()
    .nonnegative()
    .optional()
    .describe('Total links found before applying max_results. Older api versions do not send it.'),
  // Optional here so the tool keeps working once the api stops sending it.
  total_before_max_urls: z
    .number()
    .int()
    .nonnegative()
    .optional()
    .describe(
      'Deprecated: use total_before_max_results, which always has the same value. The api stops sending it on 2027-02-01.'
    ),
  total_detected_before_storage_cap: z
    .number()
    .int()
    .nonnegative()
    .describe('Total URLs found, before the 100,000-URL limit of one map'),
  discovery_capped: z
    .boolean()
    .describe(
      'Whether sitemap discovery stopped before it had read every sitemap file it found. When true, the site has more pages than this map lists.'
    ),
  sitemaps_skipped: z
    .number()
    .int()
    .nonnegative()
    .describe(
      'How many sitemap files were skipped or only partly read during discovery, because a file was too large, could not be fetched, or the discovery limits were reached.'
    ),
  // Required in the api, optional here: older api versions do not send it.
  unread_sitemaps: z
    .array(z.string())
    .optional()
    .describe(
      'The sitemap files this call knew about but did not read whole, because a limit stopped it, the file could not be read, or its download broke off. Read each one with `sitemap_url` in another call, except a file that says it is over the size limit: no call reads that one. Files past `depth` are listed here. Up to 1000 addresses; empty when every file was read. When the list is full, ask the same with `entries: "sitemaps"` to get every sitemap file as a link. Older api versions do not send it.'
    ),
  discovery_cap_reason: openEnum(DISCOVERY_CAP_REASONS)
    .nullable()
    .describe(
      'Which limit stopped sitemap discovery first, or null when nothing stopped it. ' +
        '"max_results": your own max_results was reached; ask again with a higher one to get ' +
        'more. "depth": there are sitemap files past the `depth` you asked for, listed in ' +
        'unread_sitemaps; this is the answer to the depth you chose, not a fault (with ' +
        '`depth: 0` it is how a site\'s top sitemap files are listed). "time": discovery ran out ' +
        'of its time budget. "file_budget": the site has more sitemap files than one request ' +
        'reads. "file_size": a sitemap file was too large. A file that says up front that it is ' +
        'over the size limit is not downloaded: nothing comes back from it, and it is listed in ' +
        'unread_sitemaps. A file of pages that turns out too large while it is read returns the ' +
        'links in its first part. Any other file that turns out too large, such as a sitemap ' +
        'index, returns nothing and is listed. "unread_files": a sitemap file the site publishes ' +
        'could not be read whole this time (the request failed or was rate limited, the download ' +
        'broke off, or the file was not a readable sitemap). When a download broke off, the links ' +
        'received before the break are returned, and the file is listed in unread_sitemaps. ' +
        'Asking again later can return more.'
    ),
})

export const Schema_ApiMapResult = z.looseObject({
  links: z.array(Schema_ApiMapLinkItem).describe('List of discovered URLs for the current page'),
  response_meta: z
    .looseObject({
      pagination: Schema_ApiMapPagination.describe('Pagination details for the result set'),
      truncation: Schema_ApiMapTruncation.describe(
        'Information about whether the results were truncated'
      ),
      usage: Schema_ApiMapUsageMeta.describe(
        'What this map request cost: total_credit_cost = engine_credit_cost × proxy_multiplier + zero_data_retention_credit_cost, plus the billed engine and the resolved proxy tier.'
      ),
    })
    .describe('Response metadata including pagination, truncation, and usage info'),
})

export type ApiMapResult = z.infer<typeof Schema_ApiMapResult>
