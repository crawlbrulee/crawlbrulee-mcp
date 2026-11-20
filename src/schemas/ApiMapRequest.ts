// Mirrors the crawlbrulee api's own schema. Update it by hand when the api changes.

import { z } from 'zod'
import { Schema_ApiProxyType } from './ApiScrapeRequest.js'

export const Schema_ApiMapLocation = z
  .object({
    country: z
      .string()
      .regex(
        /^([a-zA-Z]{2}|europe)$/i,
        "country must be a 2-letter ISO 3166-1 alpha-2 code, 'eu', or 'europe'"
      )
      .optional()
      .describe(
        "ISO 3166-1 alpha-2 (e.g. 'us', 'de', 'br'; case-insensitive) hint for proxy egress country. Also accepts 'eu' (random EU member state) or 'europe' (random European state incl. UK and non-EU)."
      ),
  })
  .strict()
  .describe('Optional country emulation for the map')

export const DEFAULT_API_MAP_CACHE_MAX_AGE_SECONDS = 7 * 24 * 60 * 60
/**
 * How many entries a /map call finds when the caller names no limit. Discovery
 * stops here, so the default is real work, not a slice taken at the end.
 */
export const DEFAULT_API_MAP_MAX_RESULTS = 5000
export const MAX_API_MAP_MAX_RESULTS = 100000
export const DEFAULT_API_MAP_PAGE_LIMIT = 5000
export const MAX_API_MAP_PAGE_LIMIT = 10000

export const Schema_ApiMapTypes = z
  .object({
    internal: z
      .boolean()
      .default(true)
      .describe('Include internal links (same domain; www and the bare domain are equivalent)'),
    internal_subdomains: z
      .boolean()
      .default(true)
      .describe('Include links to subdomains of the target domain (other than www)'),
    external: z.boolean().default(true).describe('Include external links (different domains)'),
  })
  .describe('Filter which link types to include in the map')

export const Schema_ApiMapCache = z
  .object({
    max_age: z
      .union([z.number().int().nonnegative(), z.iso.datetime()])
      .default(DEFAULT_API_MAP_CACHE_MAX_AGE_SECONDS)
      .describe('Maximum cache age in seconds, or an ISO 8601 datetime cutoff'),
  })
  .describe('Cache settings for the map request')

export const DEFAULT_API_MAP_DEPTH = 3
export const API_MAP_ENTRIES_VALUES = ['pages', 'sitemaps', 'all'] as const

export const Schema_ApiMapRequest = z.object({
  url: z
    .string()
    .describe(
      'The website URL to map. Mapping always targets the site root, so the path, query string ' +
        'and fragment are dropped; known tracking parameters are removed before the request is ' +
        'processed.'
    ),
  proxy: Schema_ApiProxyType.default('auto').describe(
    'Proxy tier. Defaults to auto: we start on basic and move to a stronger proxy on our own ' +
      'when a site needs it, and bill the tier that delivered. basic or advanced pins the tier.'
  ),
  sitemap_only: z
    .boolean()
    .default(false)
    .describe(
      'Use the sitemaps only: leave out the links found on the home page. A map with ' +
        '`modified_since` or `sitemap_url` never adds home page links.'
    ),
  types: Schema_ApiMapTypes.optional().describe('Filter which link types to include'),
  cache: Schema_ApiMapCache.optional().describe('Cache settings for this request'),
  // No schema default for the map's own fields below: the api applies its defaults, so the
  // tool sends only what the agent asked for.
  max_results: z
    .number()
    .int()
    .positive()
    .max(MAX_API_MAP_MAX_RESULTS)
    .optional()
    .describe(
      `The most entries the map finds, counting only the kind asked for in \`entries\`. Default ${DEFAULT_API_MAP_MAX_RESULTS}, ` +
        `maximum ${MAX_API_MAP_MAX_RESULTS}. Discovery stops as soon as this many have been found, so a smaller ` +
        'value is a faster and lighter map, not just a smaller answer.'
    ),
  max_urls: z
    .number()
    .int()
    .positive()
    .max(MAX_API_MAP_MAX_RESULTS)
    .optional()
    .describe(
      'Deprecated: use `max_results`, which means the same. This tool sends it as ' +
        '`max_results`. When both are given, only `max_results` is used.'
    ),
  sitemap_url: z
    .string()
    .optional()
    .describe(
      'Start from this sitemap file, as a full http or https address. It must be on the ' +
        "same site as `url`, or on a host the site's robots.txt names, such as a CDN. Left out: start from the site's own top sitemap files."
    ),
  depth: z
    .number()
    .int()
    .nonnegative()
    .optional()
    .describe(
      `How many levels of nested sitemaps to follow: 0 to 3, default ${DEFAULT_API_MAP_DEPTH}. With \`sitemap_url\`, ` +
        "level 0 is that file, and it is read. Without it, level 0 is the list of the site's " +
        'top sitemap files, which 0 returns without reading their entries. A top file found ' +
        'at one of the usual addresses can still show as `sitemap_index`, because finding it ' +
        'shows its kind. A sitemap index holds only sitemap files, so reading one at a low ' +
        'depth with `entries: "pages"` returns no pages: ask with `entries: "sitemaps"` or a ' +
        'higher depth. `depth: 1` with `entries: "sitemaps"` lists the site\'s top sitemap ' +
        'files and every file they list, in one call. A listed file shows as `sitemap` until a ' +
        'map opens it, even when it is a sitemap index itself. To go deeper, read a listed file ' +
        'with `sitemap_url`, or ask with a higher depth. A large site can reach `max_results` ' +
        'or a discovery limit first; `discovery_cap_reason` then says which.'
    ),
  entries: z
    .enum(API_MAP_ENTRIES_VALUES)
    .optional()
    .describe(
      'What to return: `pages` (page addresses, the default), `sitemaps` (sitemap files, of ' +
        'type `sitemap` or `sitemap_index`) or `all` (both).'
    ),
  // a plain date is the start of that day in UTC; the api reads it the same way
  modified_since: z
    .union([z.iso.date(), z.iso.datetime({ offset: true })])
    .optional()
    .describe(
      'Return only entries whose `lastmod` is at or after this date (`2026-11-01`, the start of ' +
        'that day in UTC) or date and time (ISO 8601, with a time zone). An entry with no `lastmod` is left out, so every entry returned matches; ' +
        'links found on the home page have none, so none is returned. Every sitemap file is ' +
        'read whatever its own `lastmod`, and each entry returned, a page or a sitemap file, is ' +
        'judged by its own `lastmod`. With `entries: "sitemaps"`, a sitemap file is returned ' +
        'when its own `lastmod` matches, not when a page in it does: to find the pages that ' +
        'changed, ask with `entries: "pages"`. A request with this field is always mapped ' +
        'fresh: it never reads from or adds to the cache, so `cache.max_age` does nothing, and ' +
        'it is priced as a fresh map.'
    ),
  page: z.number().int().positive().default(1).describe('Page number for paginated results'),
  limit: z
    .number()
    .int()
    .positive()
    .max(MAX_API_MAP_PAGE_LIMIT)
    .default(DEFAULT_API_MAP_PAGE_LIMIT)
    .describe('Number of URLs to return per page. Default 5000, maximum 10000.'),
  location: Schema_ApiMapLocation.optional(),
  zero_data_retention: z
    .boolean()
    .optional()
    .describe(
      'Keeps the result out of the shared cache; anything stored to deliver it is kept for 24 hours, then deleted. Adds 1 credit. Must be enabled for your organization. See https://crawlbrulee.com/docs/zero-data-retention.'
    ),
})

export type ApiMapRequest = z.infer<typeof Schema_ApiMapRequest>
