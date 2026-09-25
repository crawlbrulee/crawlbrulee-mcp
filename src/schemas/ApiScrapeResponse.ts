// VENDORED from crawlbrulee/packages/core/src/model/common/ApiUsage.ts + ApiScrapeResponse.ts
// Keep in sync with the canonical source on schema bumps.

import { z } from 'zod'
import { openEnum } from './openEnum.js'

export const Schema_ApiViewport = z.looseObject({
  width: z.number().describe('Viewport width in pixels'),
  height: z.number().describe('Viewport height in pixels'),
  device_scale_factor: z.number().describe('Device pixel ratio used for the capture'),
})

export const Schema_ApiScreenshotProperties = z.looseObject({
  file_name: z.string().describe('File name of the screenshot image'),
  mime: z.string().describe('MIME type of the screenshot (e.g. image/png)'),
  width: z.number().describe('Image width in pixels'),
  height: z.number().describe('Image height in pixels'),
  viewport: Schema_ApiViewport.describe('Viewport dimensions used during capture'),
})

export const Schema_ApiScreenshotSlice = z.looseObject({
  row_nr: z.number().describe('Row index of this slice (0-based)'),
  url: z.string().describe('URL to download this slice image'),
  type: z.literal('slice').describe('Slice type identifier'),
  properties: Schema_ApiScreenshotProperties.describe('Image properties for this slice'),
})

export const Schema_ApiScreenshotResponse = z.looseObject({
  url: z.string().describe('URL to download the full screenshot image'),
  // Same values as the request's screenshot type, but open: see openEnum.
  type: openEnum(['viewport', 'full_page']).describe('Screenshot capture mode that was used'),
  properties: Schema_ApiScreenshotProperties.describe('Image properties for the full screenshot'),
  slices: z
    .array(Schema_ApiScreenshotSlice)
    .optional()
    .describe('Individual tile slices (present when slice action_after was requested)'),
})

export const Schema_ApiPageInlineImgItem = z.looseObject({
  url: z.string().describe('Absolute URL of the image'),
  alt: z.string().nullable().describe('Alt text of the image, or null if not set'),
})

export const Schema_ApiPageLink = z.looseObject({
  text: z.string().describe('Anchor text of the link'),
  href: z
    .string()
    .describe(
      'The link URL as written on the page, resolved to an absolute URL; verbatim otherwise (query string, fragment, and duplicates preserved)'
    ),
  internal: z
    .boolean()
    .describe(
      'Whether the link points to the same domain (www and the bare domain are equivalent; other subdomains are external)'
    ),
})

// Resolved proxy tier the request actually ran on. Never `auto` — the server
// resolves `auto` to a concrete tier and reports the resolved value here.
export const API_RESOLVED_PROXY_TIER_VALUES = ['basic', 'advanced'] as const

// Usage parts. Canonical requires them; here they are optional, because older api
// versions send only `credits`, `engine`, `proxy` and `screenshot_slices`.
const Schema_CreditCost = z.number().int().nonnegative()

// Canonical is the literal union 1 | 5. Kept an open number here, like openEnum:
// a new multiplier on the server must not make a host refuse the whole result.
export const Schema_ApiProxyMultiplier = z.number().int().positive()

export const PROXY_MULTIPLIER_DESCRIPTION =
  'The multiplier of the proxy tier the request ran on: 1 for "basic", 5 for "advanced". Always reported, even when the engine cost is 0. Older api versions do not send it.'

export const Schema_ApiUsageMeta = z.looseObject({
  total_credit_cost: Schema_CreditCost.optional().describe(
    'Credits charged for this request. Always equals engine_credit_cost × proxy_multiplier + screenshot_slicing_credit_cost. 0 when nothing is billed: a cache hit, or a page whose status is not billed (see page_status_code). Older api versions do not send it; read `credits` then, which has the same value.'
  ),
  engine_credit_cost: Schema_CreditCost.optional().describe(
    'The engine base charged, before the proxy multiplier: 1 for "http", 3 for "browser", 5 for "screenshot", 0 for "cache". Also 0 when the page is not billed (see page_status_code). Older api versions do not send it.'
  ),
  proxy_multiplier: Schema_ApiProxyMultiplier.optional().describe(PROXY_MULTIPLIER_DESCRIPTION),
  screenshot_slicing_credit_cost: Schema_CreditCost.optional().describe(
    'The screenshot slicing add-on: 1 when the screenshot was split into slices on this request (a flat +1 credit outside the proxy multiplier, however many slices it made), else 0. A cache hit that reused slices that already existed costs 0. Older api versions do not send it; read `screenshot_slices` then, which has the same value.'
  ),
  engine: openEnum(['http', 'browser', 'screenshot', 'cache']).describe(
    'The engine the request was billed at — "http", "browser", "screenshot", or "cache" (the result was served from cache). Reflects what was delivered, never what was requested.'
  ),
  proxy: openEnum(API_RESOLVED_PROXY_TIER_VALUES).describe(
    'The proxy tier the request actually ran on (resolved value — never `auto`; `auto` is resolved server-side to `basic` or `advanced`). "advanced" multiplies the engine base by 5.'
  ),
  credits: Schema_CreditCost.meta({
    description:
      'Deprecated: use total_credit_cost, which always has the same value. This field will be removed in a future version.',
    deprecated: true,
  }).optional(),
  screenshot_slices: Schema_CreditCost.meta({
    description:
      'Deprecated: use screenshot_slicing_credit_cost, which always has the same value. Despite its name this is a 0/1 charge, not a count of slices. This field will be removed in a future version.',
    deprecated: true,
  }).optional(),
})

export const Schema_ApiResponseMeta = z.looseObject({
  usage: Schema_ApiUsageMeta.describe(
    'What this request cost and why: total_credit_cost = engine_credit_cost × proxy_multiplier + screenshot_slicing_credit_cost, plus the billed engine and the resolved proxy tier.'
  ),
})

export const Schema_ApiScrapeMeta = z.looseObject({
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

export const Schema_ApiScrapeSuccessResponse = z.looseObject({
  url: z
    .string()
    .describe(
      'The URL that was actually scraped, after any redirects, in normalized form — the base that links, images, and internal labels are computed against'
    ),
  requested_url: z
    .string()
    .describe('The URL you requested, echoed verbatim — before any redirects'),
  page_status_code: z
    .number()
    .int()
    .optional()
    .describe(
      'The HTTP status the site answered with for the final page, after redirects. Check it before you trust the content. A page the site served is a successful result whatever its status: a 404 or 503 page comes back with its content here, not as an error, so a 404 means the markdown is the site\'s "not found" page, not the page you asked for. Billing follows this status: 2xx and 4xx pages are billed, except 403, 407, 408, 429 and 451; 5xx pages are never billed. Older api versions do not send it; they only returned pages that loaded normally.'
    ),
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
      'Non-error notices about the scrape. Truncation codes — `screenshot_truncated` (long page exceeded the scrolling-screenshot height cap), `links_truncated` / `inline_images_truncated` (page had more links/images than the per-page extraction caps), `raw_html_truncated` / `metadata_truncated` (rendered HTML exceeded the per-page size budget) — mean the field is present but capped. Unavailability codes — `links_unavailable` / `inline_images_unavailable` / `metadata_unavailable` — mean that optional field could not be extracted and was omitted (null/empty) while the rest of the scrape succeeded, so an empty field carrying one of these does NOT mean the page had none. Stable string codes — clients can switch on them. Warnings are stored with the result: async result fetches and cache hits carry them too, filtered to the fields the request asked for.'
    ),
  response_meta: Schema_ApiResponseMeta.describe(
    'Request-level metadata. `response_meta.usage` reports what the request cost (total_credit_cost and its parts), the billed engine and the resolved proxy tier.'
  ),
})

export type ApiUsageMeta = z.infer<typeof Schema_ApiUsageMeta>
export type ApiResponseMeta = z.infer<typeof Schema_ApiResponseMeta>
export type ApiScrapeSuccessResponse = z.infer<typeof Schema_ApiScrapeSuccessResponse>
