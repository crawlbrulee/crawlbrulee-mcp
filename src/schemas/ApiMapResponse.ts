// VENDORED from crawlbrulee/packages/core/src/model/common/ApiMapResponse.ts
// Keep in sync with the canonical source on schema bumps.

import { z } from 'zod'
const API_RESOLVED_PROXY_TIER_VALUES = ['basic', 'advanced'] as const

/** Map usage has no screenshot-slice add-on. */
export const Schema_ApiMapUsageMeta = z.object({
  credits: z.number().int().nonnegative().describe('Credits charged for this map request'),
  engine: z
    .enum(['text', 'browser', 'screenshot', 'cache'])
    .describe('The engine base billed for the delivered map result'),
  proxy: z
    .enum(API_RESOLVED_PROXY_TIER_VALUES)
    .describe('The proxy tier the request actually ran on (resolved value — never `auto`)'),
})

export type ApiMapUsageMeta = z.infer<typeof Schema_ApiMapUsageMeta>

export const Schema_ApiMapLinkItem = z.object({
  url: z.string().describe('The discovered URL'),
})

export const Schema_ApiMapPagination = z.object({
  page: z.number().int().positive().describe('Current page number'),
  limit: z.number().int().positive().describe('Number of items per page'),
  total: z.number().int().nonnegative().describe('Total number of URLs in the map'),
  total_pages: z.number().int().nonnegative().describe('Total number of pages available'),
  has_more: z.boolean().describe('Whether more pages are available'),
})

export const Schema_ApiMapTruncation = z.object({
  storage_capped: z.boolean().describe('Whether the stored map was capped by the max_urls limit'),
  response_capped: z.boolean().describe('Whether the response was capped by pagination'),
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
})

export const Schema_ApiMapResult = z.object({
  links: z.array(Schema_ApiMapLinkItem).describe('List of discovered URLs for the current page'),
  response_meta: z
    .object({
      pagination: Schema_ApiMapPagination.describe('Pagination details for the result set'),
      truncation: Schema_ApiMapTruncation.describe(
        'Information about whether the results were truncated'
      ),
      usage: Schema_ApiMapUsageMeta.describe(
        'Usage accounting for this map request: credits charged, the billed engine, and the resolved proxy tier.'
      ),
    })
    .describe('Response metadata including pagination, truncation, and usage info'),
})

export type ApiMapResult = z.infer<typeof Schema_ApiMapResult>
