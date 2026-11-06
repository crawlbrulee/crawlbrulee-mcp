// Mirrors the crawlbrulee api's own schema. Update it by hand when the api changes.
// Only the pieces the schemas here use.

export const MAX_SCRAPE_SCREENSHOT_ACTIONS_BEFORE = 5
export const MAX_SCRAPE_SCREENSHOT_TOTAL_WAIT_MS = 20_000
export const MAX_SCRAPE_SCREENSHOT_TOTAL_SCROLL_PIXELS = 50_000

export const DEFAULT_SCRAPE_SCREENSHOT_DEVICE_MODE = 'desktop' as const

export type ScrapeScreenshotBeforeActionLike =
  { type: 'wait'; ms: number } | { type: 'scroll'; pixels: number }

export function getScrapeScreenshotBeforeActionTotals(
  actions: ScrapeScreenshotBeforeActionLike[] | undefined | null
): { totalWaitMs: number; totalAbsoluteScrollPixels: number } {
  let totalWaitMs = 0
  let totalAbsoluteScrollPixels = 0

  for (const action of actions ?? []) {
    if (action.type === 'wait') {
      totalWaitMs += action.ms
      continue
    }
    totalAbsoluteScrollPixels += Math.abs(action.pixels)
  }

  return { totalWaitMs, totalAbsoluteScrollPixels }
}
