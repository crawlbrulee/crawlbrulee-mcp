// Mirrors the crawlbrulee api's own schema. Update it by hand when the api changes.

import { z } from 'zod'

export const Schema_ApiScrapeScreenshotType = z
  .enum(['viewport', 'full_page'])
  .describe('Screenshot mode: viewport (visible area) or full_page (entire page)')

export const Schema_ScrapeScreenshotDeviceMode = z
  .enum(['desktop', 'mobile'])
  .describe('Device mode to emulate for viewport sizing')

export const Schema_ScrapeScreenshotColorScheme = z
  .enum(['light', 'dark'])
  .describe('Color scheme to ask the site for: light or dark')

export const Schema_ScrapeScreenshotAfterAction = z.object({
  type: z.literal('slice').describe('Slice the screenshot into horizontal tiles'),
  height: z.number().int().min(500).describe('Height of each tile in pixels (minimum 500)'),
})
