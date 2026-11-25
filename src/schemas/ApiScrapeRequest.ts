import { z } from 'zod'
import { DEFAULT_SCRAPE_SCREENSHOT_DEVICE_MODE } from './ScrapeScreenshotRules.js'
import {
  MAX_SCRAPE_ACTIONS,
  SCRAPE_ACTIONS_TIME_BUDGET_MS,
  Schema_ApiScrapeActions,
} from './ApiScrapeActionsSchemas.js'
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
import { Schema_ApiScrapePdf } from './ScrapePdfSchemas.js'
import {
  Schema_ApiScrapeScreenshotType,
  Schema_ScrapeScreenshotAfterAction,
  Schema_ScrapeScreenshotColorScheme,
  Schema_ScrapeScreenshotDeviceMode,
} from './ScrapeScreenshotSchemas.js'

export const DEFAULT_API_SCRAPE_CACHE_MAX_AGE_SECONDS = 2 * 24 * 60 * 60

// The supported proxy tiers.
export const API_PROXY_TIER_VALUES = ['basic', 'advanced', 'auto'] as const

export const Schema_ApiProxyType = z
  .enum(API_PROXY_TIER_VALUES)
  .default('auto')
  .describe(
    'Proxy tier: basic, advanced, or auto. Defaults to auto: we start with the lightest way to ' +
      'get the page and step up our effort on our own when a site needs more, and bill the tier ' +
      'that delivered.'
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
    // No schema default: the api applies `light` itself, so a screenshot that leaves the
    // field out sends the same body as before the field existed.
    color_scheme: Schema_ScrapeScreenshotColorScheme.optional().describe(
      '`light` (default) or `dark`. `dark` asks the site for its dark theme, if it has one, and ' +
        'the screenshot shows it. A site without a dark theme, or whose dark theme is only a ' +
        'switch on the page, looks the same as with `light`. When the request also asks for ' +
        '`extract.pdf`, the PDF shows the dark theme too. No extra credits.'
    ),
    actions_after: z
      .array(Schema_ScrapeScreenshotAfterAction)
      .max(1)
      .default([])
      .describe('Actions to perform after taking the screenshot (e.g. slice into tiles)'),
  })
  .strict()
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
      .default(false)
      .describe(
        'Extract cleaned HTML: the page body with scripts, styles, ads and cookie banners removed'
      ),
    markdown: z.boolean().default(true).describe('Extract page content as clean Markdown'),
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
    pdf: Schema_ApiScrapePdf.optional().describe(
      'Save the page as a PDF: a real document with selectable text and working links, ' +
        'backgrounds printed, and no header or footer added. `{}` takes every default. The ' +
        'request runs in a browser. The response carries a top-level `pdf` with a signed link ' +
        'that expires 24 hours after the scrape. It costs what a screenshot costs, and a PDF and ' +
        'a screenshot in one request are billed once. A cached copy of the page answers only when ' +
        'it has a PDF made with the same settings; `cache.max_age: 0` always makes a new one. In ' +
        'rare cases the PDF cannot be made: the rest of the scrape still comes back, with the ' +
        '`pdf_unavailable` warning, and the request costs what it costs without the PDF. A ' +
        'PDF-only request (every other format off, `markdown` and `metadata` included) on a page ' +
        'that cannot be made into a PDF is a 422 `unsupported_pdf_output`, not billed. An async ' +
        'job in that case, or one that asked only for a PDF and got none, ends `failed` and is ' +
        'not billed. A PDF on ' +
        'its own is made with the light theme. When the same request also asks for a screenshot with ' +
        '`color_scheme: "dark"`, the PDF is dark too.'
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
      'Which content formats to extract. Defaults to markdown + metadata.'
    ),
    cache: Schema_ApiScrapeCache.optional().describe('Cache settings for this request'),
    require_js: z
      .boolean()
      .default(false)
      .describe(
        'Go straight to a headless browser to render JavaScript before scraping. Without it, we ' +
          'still move to a browser on our own when a page needs one; set it when you already know ' +
          'the page needs JavaScript, to save time.'
      ),
    cleanup: Schema_ApiScrapeCleanup.prefault({ ...DEFAULT_SCRAPE_CLEANUP }),
    proxy: Schema_ApiProxyType.describe(
      'Proxy tier. Defaults to auto: we start with the lightest way to get the page and step up ' +
        'our effort on our own when a site needs more (a stronger proxy, a real browser, or ' +
        'both), and bill the tier that delivered. basic or advanced pins the tier.'
    ),
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
    actions: Schema_ApiScrapeActions.optional().describe(
      'Things to do on the page, in order, before it is read: `wait`, `scroll`, `wait_for` ' +
        '(an element), `hover` and `click`, with CSS selectors. Every output, the screenshot ' +
        'and the PDF included, shows the page as the actions left it. A list with an action ' +
        'that does something runs in a browser, so it is billed as a browser scrape, and never ' +
        'reads from or writes to the cache. The actions run after `cleanup`: ads, popups and ' +
        'cookie banners (with `cleanup.ads_and_popups` on) and the elements in ' +
        '`cleanup.exclude_selectors` are removed first, also from a page a click loads. A popup ' +
        'that opens later can still be in the way of a click and make it fail, so click the ' +
        "popup's close button first. " +
        `Up to ${MAX_SCRAPE_ACTIONS} actions, and ${SCRAPE_ACTIONS_TIME_BUDGET_MS / 1000} s for ` +
        'the whole list, waits and scroll durations included. An action that fails stops the ' +
        'list: the page still comes back as it is then, billed as usual, with the ' +
        '`actions_incomplete` warning; mark an action `optional` to go on past it. The response ' +
        'reports each action in `actions`. A click that loads a new page is followed: the ' +
        'response is that page (its url, its `page_status_code`, its content), and the rest of ' +
        'the list runs there. A click that opens a new tab is ignored. When you know the next ' +
        "page's url, such as `?page=2`, scrape that url directly instead of clicking to it: the " +
        'page loads once, so it comes back faster, and it can come from the cache. If a try ' +
        'fails and we try again, the actions run again from the start, so do not use them for ' +
        'anything that must happen only once, such as an order. The actions themselves cost no ' +
        'extra credits.'
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
