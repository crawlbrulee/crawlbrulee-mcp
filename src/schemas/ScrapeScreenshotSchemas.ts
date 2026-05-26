// VENDORED from crawlbrulee/packages/shared/core/src/model/common/ScrapeScreenshotSchemas.ts
// Keep in sync with the canonical source on schema bumps.

import { z } from 'zod'
import {
  DEFAULT_SCRAPE_SCREENSHOT_CLEANUP,
  getScrapeScreenshotBeforeActionTotals,
  MAX_SCRAPE_SCREENSHOT_TOTAL_SCROLL_PIXELS,
  MAX_SCRAPE_SCREENSHOT_TOTAL_WAIT_MS,
} from './ScrapeScreenshotRules.js'

export const Schema_ApiScrapeScreenshotType = z
  .enum(['viewport', 'full_page'])
  .describe('Screenshot mode: viewport (visible area) or full_page (entire page)')

export const Schema_ScrapeScreenshotDeviceMode = z
  .enum(['desktop', 'mobile'])
  .describe('Device mode to emulate for viewport sizing')

export const Schema_ScrapeScreenshotCleanup = z
  .object({
    ads_and_popups: z
      .boolean()
      .default(DEFAULT_SCRAPE_SCREENSHOT_CLEANUP.ads_and_popups)
      .describe('Remove ads, cookie banners, and popups before capturing'),
  })
  .strict()
  .describe('Page cleanup options applied before screenshot capture')

export const Schema_ScrapeScreenshotBeforeAction = z.discriminatedUnion('type', [
  z.object({
    type: z.literal('wait').describe('Wait for a duration before capturing'),
    ms: z.number().int().nonnegative().describe('Milliseconds to wait'),
  }),
  z.object({
    type: z.literal('scroll').describe('Scroll the page before capturing'),
    pixels: z.number().int().describe('Pixels to scroll (positive = down, negative = up)'),
  }),
])

export const Schema_ScrapeScreenshotAfterAction = z.object({
  type: z.literal('slice').describe('Slice the screenshot into horizontal tiles'),
  height: z.number().int().min(500).describe('Height of each tile in pixels (minimum 500)'),
})

export function refineScrapeScreenshotActionsBefore(
  value: { actions_before: Array<z.infer<typeof Schema_ScrapeScreenshotBeforeAction>> },
  ctx: z.core.$RefinementCtx
): void {
  const totals = getScrapeScreenshotBeforeActionTotals(value.actions_before)
  if (totals.totalWaitMs > MAX_SCRAPE_SCREENSHOT_TOTAL_WAIT_MS) {
    ctx.addIssue({
      code: 'custom',
      path: ['actions_before'],
      message: `Total wait time cannot exceed ${MAX_SCRAPE_SCREENSHOT_TOTAL_WAIT_MS}ms.`,
    })
  }
  if (totals.totalAbsoluteScrollPixels > MAX_SCRAPE_SCREENSHOT_TOTAL_SCROLL_PIXELS) {
    ctx.addIssue({
      code: 'custom',
      path: ['actions_before'],
      message: `Total absolute scroll distance cannot exceed ${MAX_SCRAPE_SCREENSHOT_TOTAL_SCROLL_PIXELS}px.`,
    })
  }
}
