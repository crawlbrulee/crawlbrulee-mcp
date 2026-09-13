import { z } from 'zod'

/**
 * Mirrors `packages/core/src/model/common/ScrapeCleanup*` in the server repo.
 * Kept in step by hand — this package deliberately does not import from the
 * monorepo. If the server's shape changes, change it here too.
 */
export const DEFAULT_SCRAPE_CLEANUP = {
  ads_and_popups: true,
} as const

export const MAX_SCRAPE_EXCLUDE_SELECTORS = 100
export const MAX_SCRAPE_EXCLUDE_SELECTOR_LENGTH = 500

export const Schema_ApiScrapeCleanup = z
  .object({
    ads_and_popups: z
      .boolean()
      .default(DEFAULT_SCRAPE_CLEANUP.ads_and_popups)
      .describe(
        'Remove ads, cookie banners, consent dialogs and chat widgets. Defaults to true. Also affects the screenshot. Set it to false to capture the page as-is, or to get past a site that refuses to serve an ad-blocking client.'
      ),
    exclude_selectors: z
      .array(z.string().max(MAX_SCRAPE_EXCLUDE_SELECTOR_LENGTH))
      .max(MAX_SCRAPE_EXCLUDE_SELECTORS)
      .optional()
      .describe(
        'CSS selectors whose elements are removed before anything is captured. Affects the extracted content and the screenshot, never raw_html. Use it for a banner or widget that ads_and_popups does not recognise. Sending any selector here makes the request skip the cache.'
      ),
  })
  .strict()
  // ⚠️ `.describe()` goes LAST. Zod's `.extend()` clones a schema without its
  // registry entry, so describing first and extending after silently drops the
  // text — the same trap the server repo hit.
  .describe(
    'What is removed from the page before any output is built. Applies to markdown, cleaned_html, links and images on every engine, and to the screenshot. Never applies to raw_html, which is always the page before we removed anything.'
  )

export type ApiScrapeCleanup = z.infer<typeof Schema_ApiScrapeCleanup>
