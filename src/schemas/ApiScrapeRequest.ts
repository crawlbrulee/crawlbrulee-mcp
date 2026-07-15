import { z } from 'zod'
import {
  DEFAULT_SCRAPE_SCREENSHOT_CLEANUP,
  DEFAULT_SCRAPE_SCREENSHOT_DEVICE_MODE,
  MAX_SCRAPE_SCREENSHOT_ACTIONS_BEFORE,
} from './ScrapeScreenshotRules.js'
import {
  Schema_ApiScrapeScreenshotType,
  Schema_ScrapeScreenshotAfterAction,
  Schema_ScrapeScreenshotBeforeAction,
  Schema_ScrapeScreenshotCleanup,
  Schema_ScrapeScreenshotDeviceMode,
  refineScrapeScreenshotActionsBefore,
} from './ScrapeScreenshotSchemas.js'

export const DEFAULT_API_SCRAPE_CACHE_MAX_AGE_SECONDS = 2 * 24 * 60 * 60

// The supported proxy tiers.
export const API_PROXY_TIER_VALUES = ['basic', 'advanced', 'auto'] as const

export const Schema_ApiProxyType = z
  .enum(API_PROXY_TIER_VALUES)
  .default('auto')
  .describe(
    'Proxy tier: basic, advanced, or auto. ' +
      'Defaults to auto (automatic selection: basic tier first, escalates to advanced on failure).'
  )

export const Schema_ApiScrapeViewport = z
  .object({
    width: z.number().int().min(16).max(10000).describe('Viewport width in pixels (16–10000)'),
    height: z.number().int().min(16).max(10000).describe('Viewport height in pixels (16–10000)'),
    device_scale_factor: z
      .number()
      .min(1)
      .max(4)
      .optional()
      .describe('Device pixel ratio (1–4, fractional allowed; e.g. 2 for Retina). Defaults to 1.'),
  })
  .strict()
  .describe('Custom browser viewport dimensions')

export const Schema_ApiScrapeFormatScreenshot = z
  .object({
    type: Schema_ApiScrapeScreenshotType.describe('Screenshot capture mode'),
    viewport: Schema_ApiScrapeViewport.optional().describe(
      'Custom viewport dimensions; uses device_mode defaults if omitted'
    ),
    device_mode: Schema_ScrapeScreenshotDeviceMode.default(
      DEFAULT_SCRAPE_SCREENSHOT_DEVICE_MODE
    ).describe('Emulate desktop or mobile device viewport'),
    cleanup: Schema_ScrapeScreenshotCleanup.default(DEFAULT_SCRAPE_SCREENSHOT_CLEANUP).describe(
      'Page cleanup options applied before capturing'
    ),
    actions_before: z
      .array(Schema_ScrapeScreenshotBeforeAction)
      .max(MAX_SCRAPE_SCREENSHOT_ACTIONS_BEFORE)
      .default([])
      .describe('Actions to perform before taking the screenshot (wait, scroll)'),
    actions_after: z
      .array(Schema_ScrapeScreenshotAfterAction)
      .max(1)
      .default([])
      .describe('Actions to perform after taking the screenshot (e.g. slice into tiles)'),
  })
  .strict()
  .superRefine(refineScrapeScreenshotActionsBefore)
  .describe('Screenshot capture configuration')

export const Schema_ApiScrapeCache = z
  .object({
    max_age: z
      .union([z.number().int().nonnegative(), z.iso.datetime()])
      .default(DEFAULT_API_SCRAPE_CACHE_MAX_AGE_SECONDS)
      .describe('Maximum cache age in seconds, or an ISO 8601 datetime cutoff'),
    ignore_query_params: z
      .boolean()
      .default(false)
      .describe('Treat URLs with different query parameters as the same cache entry'),
  })
  .strict()
  .describe('Cache settings for the scrape request')

export const Schema_ApiScrapeExtract = z
  .object({
    metadata: z
      .boolean()
      .default(true)
      .describe('Extract page metadata (title, description, OG tags, etc.)'),
    cleaned_html: z.boolean().default(true).describe('Extract cleaned HTML (main content only)'),
    markdown: z.boolean().default(false).describe('Extract page content as clean Markdown'),
    raw_html: z.boolean().default(false).describe('Return the raw, unprocessed HTML'),
    links: z.boolean().default(false).describe('Extract all links found on the page'),
    images: z.boolean().default(false).describe('Extract all inline images found on the page'),
    screenshot: Schema_ApiScrapeFormatScreenshot.optional().describe(
      'Capture a screenshot of the page'
    ),
  })
  .strict()
  .describe('Which content formats to extract from the scraped page')

export const Schema_ApiScrapeLocation = z
  .object({
    locale: z
      .string()
      .min(2)
      .max(35)
      .optional()
      .describe(
        "BCP-47 locale (2-35 chars, e.g. 'en-US', 'de-DE', 'pt-BR') driving Accept-Language and navigator.language"
      ),
    country: z
      .string()
      .regex(
        /^([a-zA-Z]{2}|europe)$/i,
        "country must be a 2-letter ISO 3166-1 alpha-2 code, 'eu', or 'europe'"
      )
      .optional()
      .describe(
        "ISO 3166-1 alpha-2 (e.g. 'us', 'de', 'br'; case-insensitive) driving the emulated browser timezone and proxy exit country. Also accepts 'eu' (random EU member state) or 'europe' (random European state incl. UK and non-EU)."
      ),
  })
  .strict()
  .describe('Optional locale + country emulation for the scrape')

export const Schema_ApiScrapeRequest = z
  .object({
    url: z.string().describe('The URL to scrape'),
    extract: Schema_ApiScrapeExtract.prefault({}).describe(
      'Which content formats to extract. Defaults to metadata + cleaned_html.'
    ),
    cache: Schema_ApiScrapeCache.optional().describe('Cache settings for this request'),
    require_js: z
      .boolean()
      .default(false)
      .describe('Use a headless browser to render JavaScript before scraping'),
    exclude_selectors: z
      .array(z.string())
      .optional()
      .describe('CSS selectors to exclude from the extracted content'),
    proxy: Schema_ApiProxyType.describe('Proxy tier to use for fetching'),
    location: Schema_ApiScrapeLocation.optional(),
  })
  .strict()

export type ApiScrapeRequest = z.infer<typeof Schema_ApiScrapeRequest>
