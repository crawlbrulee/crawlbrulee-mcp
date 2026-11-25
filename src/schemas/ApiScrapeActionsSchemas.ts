// Mirrors the crawlbrulee api's own schema. Update it by hand when the api changes.
//
// The request keeps the cheap checks: the action shapes, the count, the "one of two fields"
// rules and the list's time budget. The api checks the CSS selectors itself (a clear 400).

import { z } from 'zod'
import { openEnum } from './openEnum.js'

export const MAX_SCRAPE_ACTIONS = 12
export const SCRAPE_ACTIONS_TIME_BUDGET_MS = 60_000
export const MAX_SCRAPE_ACTION_SELECTOR_LENGTH = 500
export const MAX_SCRAPE_ACTION_POINT = 10_000
export const SCRAPE_ACTION_ELEMENT_WAIT_MS = 5_000
export const SCRAPE_WAIT_FOR_TIMEOUT_MS = 10_000
export const SCRAPE_SCROLL_EDGES = ['top', 'bottom', 'left', 'right'] as const

export const SCRAPE_ACTION_TYPES = ['wait', 'scroll', 'wait_for', 'hover', 'click'] as const
export const SCRAPE_ACTION_STATUSES = ['ok', 'failed', 'skipped', 'not_run'] as const

const Schema_ScrapeActionSelector = z.string().min(1).max(MAX_SCRAPE_ACTION_SELECTOR_LENGTH)

const Schema_ScrapeActionOptional = z
  .boolean()
  .optional()
  .describe(
    'When true, a failure of this action does not stop the list: it is reported as `skipped` ' +
      'and the next action runs. A page that moves on to another page during the action ' +
      'still stops the list. Defaults to false.'
  )

const Schema_ScrapeActionWait = z
  .object({
    type: z.literal('wait').describe('Wait for a set time'),
    ms: z
      .number()
      .int()
      .nonnegative()
      .max(SCRAPE_ACTIONS_TIME_BUDGET_MS)
      .describe('Milliseconds to wait'),
    optional: Schema_ScrapeActionOptional,
  })
  .strict()

const Schema_ScrapeActionScroll = z
  .object({
    type: z.literal('scroll').describe('Scroll the page'),
    pixels: z
      .number()
      .int()
      .optional()
      .describe(
        'Pixels to scroll down (negative scrolls up). Use either `pixels` or `to`, not both.'
      ),
    to: z
      .string()
      .min(1)
      .max(MAX_SCRAPE_ACTION_SELECTOR_LENGTH)
      .optional()
      .describe(
        `Where to scroll: ${SCRAPE_SCROLL_EDGES.map(edge => `\`${edge}\``).join(', ')} of the ` +
          'page, or a CSS selector, which brings the first match to the middle of the window ' +
          `(it waits up to ${SCRAPE_ACTION_ELEMENT_WAIT_MS / 1000} s for the element). ` +
          'Use either `pixels` or `to`, not both.'
      ),
    duration_ms: z
      .number()
      .int()
      .nonnegative()
      .max(SCRAPE_ACTIONS_TIME_BUDGET_MS)
      .optional()
      .describe(
        'How long the scroll takes, in milliseconds. A slow scroll gives images further down ' +
          'the page time to load on the way. 0 jumps at once. Without it, the page scrolls at ' +
          'a steady pace, taking up to 5 s.'
      ),
    optional: Schema_ScrapeActionOptional,
  })
  .strict()

const Schema_ScrapeActionWaitFor = z
  .object({
    type: z.literal('wait_for').describe('Wait for an element to appear'),
    selector: Schema_ScrapeActionSelector.describe(
      'CSS selector. The action waits until the first match is on the page and visible, for ' +
        `up to ${SCRAPE_WAIT_FOR_TIMEOUT_MS / 1000} s; after that it fails.`
    ),
    optional: Schema_ScrapeActionOptional,
  })
  .strict()

const Schema_ScrapeActionHover = z
  .object({
    type: z
      .literal('hover')
      .describe(
        'Move the mouse over an element, or to a point. Desktop only: on a mobile device it ' +
          'is skipped.'
      ),
    selector: Schema_ScrapeActionSelector.optional().describe(
      'CSS selector: the mouse goes to the first match, brought into view first. Use either ' +
        '`selector` or `x` and `y`.'
    ),
    x: z
      .number()
      .int()
      .nonnegative()
      .max(MAX_SCRAPE_ACTION_POINT)
      .optional()
      .describe('A point in the visible window, in pixels from its left edge. Needs `y`.'),
    y: z
      .number()
      .int()
      .nonnegative()
      .max(MAX_SCRAPE_ACTION_POINT)
      .optional()
      .describe('A point in the visible window, in pixels from its top edge. Needs `x`.'),
    optional: Schema_ScrapeActionOptional,
  })
  .strict()

const Schema_ScrapeActionClick = z
  .object({
    type: z.literal('click').describe('Click an element (a tap on a mobile device)'),
    selector: Schema_ScrapeActionSelector.describe(
      'CSS selector: the first match on the page itself (not inside a frame or a shadow root), ' +
        'brought into view first.'
    ),
    optional: Schema_ScrapeActionOptional,
  })
  .strict()

// Zod's own text for an unknown `type` is a bare "Invalid input"; this one tells the
// model which types there are, so it can fix its call.
const UNKNOWN_ACTION_TYPE_MESSAGE = `unknown action type; use one of ${SCRAPE_ACTION_TYPES.join(', ')}`

export const Schema_ApiScrapeAction = z.discriminatedUnion(
  'type',
  [
    Schema_ScrapeActionWait,
    Schema_ScrapeActionScroll,
    Schema_ScrapeActionWaitFor,
    Schema_ScrapeActionHover,
    Schema_ScrapeActionClick,
  ],
  {
    error: issue => {
      const path = issue.path ?? []
      if (issue.code === 'invalid_union' && path[path.length - 1] === 'type') {
        return UNKNOWN_ACTION_TYPE_MESSAGE
      }
      return undefined
    },
  }
)

export type ApiScrapeAction = z.infer<typeof Schema_ApiScrapeAction>

function refineScrapeAction(action: ApiScrapeAction, index: number, ctx: z.core.$RefinementCtx) {
  if (action.type === 'scroll') {
    if ((action.pixels !== undefined) === (action.to !== undefined)) {
      ctx.addIssue({
        code: 'custom',
        path: [index],
        message: 'scroll needs either pixels or to, not both',
      })
    }
    return
  }
  if (action.type === 'hover') {
    const hasSelector = action.selector !== undefined
    const hasPoint = action.x !== undefined || action.y !== undefined
    if (hasSelector === hasPoint) {
      ctx.addIssue({
        code: 'custom',
        path: [index],
        message: 'hover needs either selector or x and y, not both',
      })
    } else if (hasPoint && (action.x === undefined || action.y === undefined)) {
      ctx.addIssue({ code: 'custom', path: [index], message: 'hover needs both x and y' })
    }
  }
}

/** The time a list asks for outright: its waits and the scroll durations it set. */
function statedTimeMs(actions: readonly ApiScrapeAction[]): number {
  let totalMs = 0
  for (const action of actions) {
    if (action.type === 'wait') {
      totalMs += action.ms
    } else if (action.type === 'scroll') {
      totalMs += action.duration_ms ?? 0
    }
  }
  return totalMs
}

export const Schema_ApiScrapeActions = z
  .array(Schema_ApiScrapeAction)
  .max(MAX_SCRAPE_ACTIONS)
  .superRefine((actions, ctx) => {
    actions.forEach((action, index) => refineScrapeAction(action, index, ctx))
    const statedMs = statedTimeMs(actions)
    if (statedMs > SCRAPE_ACTIONS_TIME_BUDGET_MS) {
      ctx.addIssue({
        code: 'custom',
        path: [],
        message:
          `The waits and scroll durations add up to ${statedMs} ms; the whole list may take at ` +
          `most ${SCRAPE_ACTIONS_TIME_BUDGET_MS} ms.`,
      })
    }
  })

/** One entry of the response's `actions` report. Open enums: see openEnum. */
export const Schema_ApiScrapeActionReportEntry = z.looseObject({
  type: openEnum(SCRAPE_ACTION_TYPES).describe('The action type, as sent'),
  status: openEnum(SCRAPE_ACTION_STATUSES).describe(
    '`ok`: it was done. `failed`: it could not be done (for example its element was not ' +
      'found or was covered by something else, or the page a click loaded failed to load). ' +
      '`skipped`: it could not be done, but it was `optional`, so the list went on; a ' +
      '`hover` is always skipped on a mobile device, which has no mouse. ' +
      '`not_run`: the list never got to it.'
  ),
})
