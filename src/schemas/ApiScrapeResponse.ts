// VENDORED from crawlbrulee/packages/shared/core/src/model/common/ApiScrapeResponse.ts
// Keep in sync with the canonical source on schema bumps.

import { z } from 'zod'
import { Schema_ApiScrapeScreenshotType } from './ScrapeScreenshotSchemas.js'

export const Schema_ApiViewport = z.object({
  width: z.number().describe('Viewport width in pixels'),
  height: z.number().describe('Viewport height in pixels'),
  device_scale_factor: z.number().describe('Device pixel ratio used for the capture'),
})

export const Schema_ApiScreenshotProperties = z.object({
  file_name: z.string().describe('File name of the screenshot image'),
  mime: z.string().describe('MIME type of the screenshot (e.g. image/png)'),
  width: z.number().describe('Image width in pixels'),
  height: z.number().describe('Image height in pixels'),
  viewport: Schema_ApiViewport.describe('Viewport dimensions used during capture'),
})

export const Schema_ApiScreenshotSlice = z.object({
  row_nr: z.number().describe('Row index of this slice (0-based)'),
  url: z.string().describe('URL to download this slice image'),
  type: z.literal('slice').describe('Slice type identifier'),
  properties: Schema_ApiScreenshotProperties.describe('Image properties for this slice'),
})

export const Schema_ApiScreenshotResponse = z.object({
  url: z.string().describe('URL to download the full screenshot image'),
  type: Schema_ApiScrapeScreenshotType.describe('Screenshot capture mode that was used'),
  properties: Schema_ApiScreenshotProperties.describe('Image properties for the full screenshot'),
  slices: z
    .array(Schema_ApiScreenshotSlice)
    .optional()
    .describe('Individual tile slices (present when slice action_after was requested)'),
})

export const Schema_ApiPageInlineImgItem = z.object({
  url: z.string().describe('Absolute URL of the image'),
  alt: z.string().nullable().describe('Alt text of the image, or null if not set'),
})

export const Schema_ApiPageLink = z.object({
  text: z.string().describe('Anchor text of the link'),
  href: z.string().describe('The link URL as it appears on the page (absolute or relative)'),
  internal: z.boolean().describe('Whether the link points to the same domain'),
})

// Resolved proxy tier the request actually ran on. Never `auto` — the server
// resolves `auto` to a concrete tier and reports the resolved value here.
export const API_RESOLVED_PROXY_TIER_VALUES = ['basic', 'advanced'] as const

export const Schema_ApiUsageMeta = z.object({
  credits: z
    .number()
    .int()
    .nonnegative()
    .describe('Credits charged for this request. `0` on a cache hit (no fresh fetch was billed).'),
  proxy: z
    .enum(API_RESOLVED_PROXY_TIER_VALUES)
    .describe(
      'The proxy tier the request actually ran on (resolved value — never `auto`; `auto` is resolved server-side to `basic` or `advanced`).'
    ),
  cache_hit: z
    .boolean()
    .describe('Whether the result was served from cache (`true`) or freshly fetched (`false`).'),
})

export const Schema_ApiResponseMeta = z.object({
  usage: Schema_ApiUsageMeta.describe(
    'Usage accounting for this request: credits charged, resolved proxy tier, and cache-hit flag.'
  ),
})

export const Schema_ApiScrapeMeta = z.object({
  title: z.string().optional().describe('Page title from the <title> tag'),
  description: z.string().optional().describe('Meta description'),
  keywords: z.array(z.string()).optional().describe('Meta keywords'),
  canonical: z.string().optional().describe('Canonical URL specified by the page'),
  og_url: z.string().optional().describe('Open Graph URL'),
  og_title: z.string().optional().describe('Open Graph title'),
  og_description: z.string().optional().describe('Open Graph description'),
  og_type: z.string().optional().describe('Open Graph type (e.g. article, website)'),
  og_site_name: z.string().optional().describe('Open Graph site name'),
  og_locale: z.string().optional().describe('Open Graph locale (e.g. en_US)'),
  og_locale_alternate: z.array(z.string()).optional().describe('Alternate Open Graph locales'),
  og_image: z.string().optional().describe('Open Graph image URL'),
  author: z.string().optional().describe('Article author'),
  date_modified: z.string().optional().describe('Article last-modified date'),
  date_published: z.string().optional().describe('Article publication date'),
  twitter_site: z.string().optional().describe('Twitter @username for the site'),
  twitter_card: z.string().optional().describe('Twitter card type (e.g. summary_large_image)'),
  twitter_description: z.string().optional().describe('Twitter card description'),
  twitter_title: z.string().optional().describe('Twitter card title'),
  twitter_image: z.string().optional().describe('Twitter card image URL'),
  robots: z.string().optional().describe('Robots meta directive (e.g. noindex, nofollow)'),
  favicon_url: z
    .string()
    .nullish()
    .describe('Resolved favicon URL for the page (best-effort, from <head> icon hints + manifest)'),
})

export const Schema_ApiScrapeSuccessResponse = z.object({
  url: z.string().describe('The URL that was scraped (after any redirects)'),
  content_type: z.string().optional().describe('Content-Type header returned by the server'),
  unsupported_fields: z
    .array(z.string())
    .optional()
    .describe('Extract fields that were requested but are not supported for this content type'),
  markdown: z.string().optional().describe('Page content converted to clean Markdown'),
  cleaned_html: z.string().optional().describe('Cleaned HTML of the main page content'),
  raw_html: z.string().optional().describe('Raw, unprocessed HTML of the page'),
  images: z
    .array(Schema_ApiPageInlineImgItem)
    .optional()
    .describe('Inline images found on the page'),
  links: z.array(Schema_ApiPageLink).optional().describe('Links found on the page'),
  screenshot: Schema_ApiScreenshotResponse.optional().describe(
    'Screenshot of the page, if requested'
  ),
  metadata: Schema_ApiScrapeMeta.optional().describe(
    'Extracted page metadata (title, OG tags, etc.)'
  ),
  warnings: z
    .array(z.string())
    .optional()
    .describe(
      'Non-error notices about the scrape (e.g. `screenshot_truncated` when a long page exceeded the scrolling-screenshot height cap). Stable string codes — clients can switch on them. Currently surfaced only on fresh scrapes; cache hits omit warnings.'
    ),
  response_meta: Schema_ApiResponseMeta.describe(
    'Request-level metadata. `response_meta.usage` reports credits charged (0 on a cache hit), the resolved proxy tier, and the cache-hit flag.'
  ),
})

export type ApiUsageMeta = z.infer<typeof Schema_ApiUsageMeta>
export type ApiResponseMeta = z.infer<typeof Schema_ApiResponseMeta>
export type ApiScrapeSuccessResponse = z.infer<typeof Schema_ApiScrapeSuccessResponse>
