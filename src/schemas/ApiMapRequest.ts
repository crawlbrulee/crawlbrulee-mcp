// VENDORED from crawlbrulee/packages/shared/core/src/model/common/ApiMapRequest.ts
// Keep in sync with the canonical source on schema bumps.

import { z } from 'zod'
import { Schema_ApiProxyType } from './ApiScrapeRequest.js'

export const Schema_ApiMapLocation = z
  .object({
    country: z
      .string()
      .regex(/^[a-zA-Z]{2}$/, 'country must be a 2-letter ISO 3166-1 alpha-2 code')
      .optional()
      .describe(
        "ISO 3166-1 alpha-2 (e.g. 'us', 'de', 'br'; case-insensitive) hint for proxy egress country"
      ),
  })
  .strict()
  .describe('Optional country emulation for the map')

export const DEFAULT_API_MAP_CACHE_MAX_AGE_SECONDS = 7 * 24 * 60 * 60
export const DEFAULT_API_MAP_MAX_URLS = 100000
export const MAX_API_MAP_MAX_URLS = 100000
export const DEFAULT_API_MAP_PAGE_LIMIT = 10000
export const MAX_API_MAP_PAGE_LIMIT = 10000

export const Schema_ApiMapTypes = z
  .object({
    internal: z.boolean().default(true).describe('Include internal links (same domain)'),
    internal_subdomains: z
      .boolean()
      .default(true)
      .describe('Include links to subdomains of the target domain'),
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

export const Schema_ApiMapRequest = z.object({
  url: z.string().describe('The website URL to map'),
  proxy: Schema_ApiProxyType.default('basic').describe('Proxy tier to use for fetching'),
  sitemap_only: z
    .boolean()
    .default(false)
    .describe('Only use sitemap.xml — skip homepage link extraction'),
  types: Schema_ApiMapTypes.optional().describe('Filter which link types to include'),
  cache: Schema_ApiMapCache.optional().describe('Cache settings for this request'),
  max_urls: z
    .number()
    .int()
    .positive()
    .max(MAX_API_MAP_MAX_URLS)
    .default(DEFAULT_API_MAP_MAX_URLS)
    .describe('Maximum number of URLs to store in the map'),
  page: z.number().int().positive().default(1).describe('Page number for paginated results'),
  limit: z
    .number()
    .int()
    .positive()
    .max(MAX_API_MAP_PAGE_LIMIT)
    .default(DEFAULT_API_MAP_PAGE_LIMIT)
    .describe('Number of URLs to return per page'),
  location: Schema_ApiMapLocation.optional(),
})

export type ApiMapRequest = z.infer<typeof Schema_ApiMapRequest>
