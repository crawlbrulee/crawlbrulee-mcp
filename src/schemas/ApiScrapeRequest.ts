import { z } from 'zod'
import {
  DEFAULT_SCRAPE_SCREENSHOT_DEVICE_MODE,
  MAX_SCRAPE_SCREENSHOT_ACTIONS_BEFORE,
} from './ScrapeScreenshotRules.js'
import { DEFAULT_SCRAPE_CLEANUP, Schema_ApiScrapeCleanup } from './ScrapeCleanupSchemas.js'
import {
  HEADERS_AND_COOKIES_CHAT_NOTE,
  HEADERS_AND_COOKIES_DOCS_URL,
  MAX_SCRAPE_COOKIE_BYTES,
  MAX_SCRAPE_COOKIES,
  MAX_SCRAPE_CUSTOM_HEADERS,
  MAX_SCRAPE_CUSTOM_HEADERS_AND_COOKIES_BYTES,
  Schema_ScrapeCookies,
  Schema_ScrapeCustomHeaders,
} from './ScrapeCustomHeadersSchemas.js'
import { ELEMENTS_DOCS_URL, Schema_ScrapeElements } from './ScrapeElementsSchemas.js'
import {
  Schema_ApiScrapeScreenshotType,
  Schema_ScrapeScreenshotAfterAction,
  Schema_ScrapeScreenshotBeforeAction,
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
      .max(3)
      .optional()
      .describe('Device pixel ratio (1–3, fractional allowed; e.g. 2 for Retina). Defaults to 1.'),
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
  })
  .strict()
  .describe('Cache settings for the scrape request')

export const Schema_ApiScrapeExtract = z
  .object({
    metadata: z
      .boolean()
      .default(true)
      .describe('Extract page metadata (title, description, OG tags, etc.) from the page head'),
    cleaned_html: z
      .boolean()
      .default(true)
      .describe(
        'Extract cleaned HTML: the page body with scripts, styles, ads and cookie banners removed'
      ),
    markdown: z.boolean().default(false).describe('Extract page content as clean Markdown'),
    raw_html: z
      .boolean()
      .default(false)
      .describe(
        'Return the raw, unprocessed HTML, up to 10,000,000 characters of page body. A larger body is truncated at a tag boundary and the response carries a `raw_html_truncated` warning.'
      ),
    links: z
      .boolean()
      .default(false)
      .describe(
        'Extract links found on the page, up to 30,000 per page. Beyond that the array is truncated and the response carries a `links_truncated` warning.'
      ),
    images: z
      .boolean()
      .default(false)
      .describe(
        'Extract inline images found on the page, up to 10,000 per page. Beyond that the array is truncated and the response carries an `inline_images_truncated` warning.'
      ),
    screenshot: Schema_ApiScrapeFormatScreenshot.optional().describe(
      'Capture a screenshot of the page'
    ),
    elements: Schema_ScrapeElements.optional().describe(
      'Named values to read from the page by CSS selector, returned in the top-level ' +
        '`elements` field under the same names. Each value is either a selector string ' +
        '(the text of the first match) or an object with `selector`, `output`, `attribute` ' +
        'and `all`. `fields` (instead of `output`) turns each match into an object of named ' +
        'values read inside that match (the selector `:scope` reads the match itself, for ' +
        "example the matched element's own href), so a list of products can return a title, " +
        'price and url per product. A name with no match is null, or [] with `all: true`. Read ' +
        'after cleanup; `<script>` and `<style>` tags are not part of it. An invalid selector ' +
        'is a 400. No extra credits, also when the page comes from cache. Limits and selector ' +
        `rules: ${ELEMENTS_DOCS_URL}.`
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
        "BCP-47 locale (2-35 chars, e.g. 'en-US', 'de-DE', 'pt-BR'): the language to ask the site for"
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
    url: z
      .string()
      .describe(
        'The URL to scrape. Known tracking parameters are removed before the page is fetched, ' +
          'so they are neither sent to the target site nor part of the cache key. Every other ' +
          'query parameter is kept verbatim and is part of the cache key.'
      ),
    extract: Schema_ApiScrapeExtract.prefault({}).describe(
      'Which content formats to extract. Defaults to metadata + cleaned_html.'
    ),
    cache: Schema_ApiScrapeCache.optional().describe('Cache settings for this request'),
    require_js: z
      .boolean()
      .default(false)
      .describe('Use a headless browser to render JavaScript before scraping'),
    cleanup: Schema_ApiScrapeCleanup.prefault({ ...DEFAULT_SCRAPE_CLEANUP }),
    proxy: Schema_ApiProxyType.describe('Proxy tier to use for fetching'),
    location: Schema_ApiScrapeLocation.optional(),
    zero_data_retention: z
      .boolean()
      .optional()
      .describe(
        'Keeps the result out of the shared cache; anything stored to deliver it is kept for 24 hours, then deleted. Adds 1 credit. Must be enabled for your organization. See https://crawlbrulee.com/docs/zero-data-retention.'
      ),
    headers: Schema_ScrapeCustomHeaders.optional().describe(
      'Your own HTTP headers to send to the site with the request, for example ' +
        '`Authorization`, an api key, or a fixed `User-Agent` that the site has on an ' +
        'allowlist. Sent only to the origin of `url` (same scheme, host ' +
        'and port), or to its https version when `url` is http, and not on a redirect to ' +
        'another origin. ' +
        `Up to ${MAX_SCRAPE_CUSTOM_HEADERS} headers; headers and cookies together up to ` +
        `${MAX_SCRAPE_CUSTOM_HEADERS_AND_COOKIES_BYTES} bytes. Values are printable ASCII, ` +
        'with no space or tab at either end. ' +
        "Headers a browser doesn't let a web page set can't be set here either (a 400 " +
        'names the header). Use `cookies` for cookies and `location.locale` for the ' +
        'language. Never put secrets in the `User-Agent`. Your own `User-Agent` can lower ' +
        'the success rate, and the response carries the `custom_user_agent` warning. ' +
        'A `Referer` must be the full http or https url of a public page, with no ' +
        'username or password; it is sent the way a browser sends it after a click on ' +
        'that page. A request with headers or cookies never reads from or writes to the ' +
        'cache. On a plain http url they travel unencrypted. ' +
        `${HEADERS_AND_COOKIES_CHAT_NOTE} See ${HEADERS_AND_COOKIES_DOCS_URL}.`
    ),
    cookies: Schema_ScrapeCookies.optional().describe(
      'Your own cookies to send to the site with the request. Each is a `name` and a ' +
        '`value`, sent only to the host of `url`. Cookies the site sets while redirecting ' +
        `are not kept. Up to ${MAX_SCRAPE_COOKIES} cookies, each up to ` +
        `${MAX_SCRAPE_COOKIE_BYTES} bytes (name and value), counted toward the limit on ` +
        '`headers`. A value may not hold ";" or start or end with a space. A `__Secure-`, ' +
        '`__Host-` or `__Http-` cookie needs an https url. A request with headers or cookies ' +
        `never reads from or writes to the cache. ${HEADERS_AND_COOKIES_CHAT_NOTE} ` +
        `See ${HEADERS_AND_COOKIES_DOCS_URL}.`
    ),
  })
  .strict()

export type ApiScrapeRequest = z.infer<typeof Schema_ApiScrapeRequest>
