// VENDORED from crawlbrulee/packages/shared/core/src/model/common/ScrapeScreenshotRules.ts
// Keep in sync with the canonical source on schema bumps. Trimmed to the
// pieces consumed by the vendored Zod schemas — runtime helpers used only by
// the server are intentionally left out.

export const MAX_SCRAPE_SCREENSHOT_ACTIONS_BEFORE = 5
export const MAX_SCRAPE_SCREENSHOT_TOTAL_WAIT_MS = 20_000
export const MAX_SCRAPE_SCREENSHOT_TOTAL_SCROLL_PIXELS = 50_000

export const DEFAULT_SCRAPE_SCREENSHOT_DEVICE_MODE = 'desktop' as const

export const DEFAULT_SCRAPE_SCREENSHOT_CLEANUP = {
  ads_and_popups: true,
} as const

export type ScrapeScreenshotBeforeActionLike =
  | { type: 'wait'; ms: number }
  | { type: 'scroll'; pixels: number }

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
