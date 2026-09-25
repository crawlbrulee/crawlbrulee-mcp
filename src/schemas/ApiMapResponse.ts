// VENDORED from crawlbrulee/packages/core/src/model/common/ApiMapResponse.ts + ApiUsage.ts
// Keep in sync with the canonical source on schema bumps.

import { z } from 'zod'
import { openEnum } from './openEnum.js'
import { PROXY_MULTIPLIER_DESCRIPTION, Schema_ApiProxyMultiplier } from './ApiScrapeResponse.js'
const API_RESOLVED_PROXY_TIER_VALUES = ['basic', 'advanced'] as const

/** Which limit stopped sitemap discovery first. The FIRST limit to fire wins. */
const DISCOVERY_CAP_REASONS = [
  'max_urls',
  'time',
  'file_budget',
  'depth',
  'file_size',
  'unread_files',
] as const

/** Map usage has no screenshot-slice add-on. The new parts are optional: older api versions send only `credits`, `engine` and `proxy`. */
export const Schema_ApiMapUsageMeta = z.looseObject({
  total_credit_cost: z
    .number()
    .int()
    .nonnegative()
    .optional()
    .describe(
      'Credits charged for this map request. Always equals engine_credit_cost × proxy_multiplier. 0 for a cache hit, and for an empty map when the site answered only with statuses we do not bill (a 5xx, for example) or not at all. Older api versions do not send it; read `credits` then, which has the same value.'
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
  engine: openEnum(['http', 'cache']).describe(
    'The map billing engine: `http` for fresh discovery or `cache` for a cached result'
  ),
  proxy: openEnum(API_RESOLVED_PROXY_TIER_VALUES).describe(
    'The proxy tier the request actually ran on (resolved value — never `auto`)'
  ),
  credits: z
    .number()
    .int()
    .nonnegative()
    .meta({
      description:
        'Deprecated: use total_credit_cost, which always has the same value. This field will be removed in a future version.',
      deprecated: true,
    })
    .optional(),
})

export type ApiMapUsageMeta = z.infer<typeof Schema_ApiMapUsageMeta>

export const Schema_ApiMapLinkItem = z.looseObject({
  url: z.string().describe('The discovered URL'),
})

export const Schema_ApiMapPagination = z.looseObject({
  page: z.number().int().positive().describe('Current page number'),
  limit: z.number().int().positive().describe('Number of items per page'),
  total: z.number().int().nonnegative().describe('Total number of URLs in the map'),
  total_pages: z.number().int().nonnegative().describe('Total number of pages available'),
  has_more: z.boolean().describe('Whether more pages are available'),
})

export const Schema_ApiMapTruncation = z.looseObject({
  storage_capped: z.boolean().describe('Whether the stored map hit the 100000-URL storage cap.'),
  response_capped: z
    .boolean()
    .describe(
      'Whether more links were eligible than max_urls, so the list was trimmed. Discovery itself ' +
        'stops at max_urls, so this is normally true only when home-page links pushed the total ' +
        'past it. See discovery_cap_reason for a discovery stop.'
    ),
  total_before_max_urls: z
    .number()
    .int()
    .nonnegative()
    .describe('Total URLs found before applying the max_urls cap'),
  total_detected_before_storage_cap: z
    .number()
    .int()
    .nonnegative()
    .describe('Total URLs detected during discovery before the storage cap was applied'),
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
  discovery_cap_reason: openEnum(DISCOVERY_CAP_REASONS)
    .nullable()
    .describe(
      'Which limit stopped sitemap discovery first, or null when nothing stopped it. ' +
        '"max_urls" means your own max_urls was reached — ask again with a higher one to get more. ' +
        '"time" means discovery ran out of its time budget, "file_budget" that the site has more ' +
        'sitemap files than one request reads, "depth" that its sitemap indexes nest too deeply, ' +
        'and "file_size" that a sitemap file was too large to read. "unread_files" means a sitemap ' +
        'file the site publishes could not be read at all this time — the request for it failed or ' +
        'was rate limited, or the file was not a readable sitemap. Only "max_urls" is a limit you ' +
        'can raise from the request; "unread_files" is often temporary, so asking again later can ' +
        'return more.'
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
        'What this map request cost: total_credit_cost = engine_credit_cost × proxy_multiplier, plus the billed engine and the resolved proxy tier.'
      ),
    })
    .describe('Response metadata including pagination, truncation, and usage info'),
})

export type ApiMapResult = z.infer<typeof Schema_ApiMapResult>
