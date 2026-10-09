import { z } from 'zod'

/**
 * Mirrors `packages/core/src/model/common/ScrapeElements*` in the server repo.
 * Kept in step by hand — this package deliberately does not import from the
 * monorepo. If the server's shape changes, change it here too.
 *
 * `extract.elements`: named values read from the page by CSS selector. `fields`
 * nests, at most ELEMENT_FIELDS_DEPTH deep. The schemas are built level by level
 * instead of with `z.lazy`, so the depth limit holds by shape and the tool's JSON
 * Schema stays a plain tree (no `$ref`) that every host can read.
 *
 * Only the public per-string limits are checked here. The total selector count, the
 * CSS syntax and the name length are left to the api, which answers a clear 400.
 */

export const ELEMENTS_DOCS_URL = 'https://crawlbrulee.com/docs/scrape/elements'

/** How deep `fields` may nest. The innermost level has no `fields`. */
export const ELEMENT_FIELDS_DEPTH = 3

export const MAX_ELEMENT_SELECTOR_LENGTH = 500
export const MAX_ELEMENT_ATTRIBUTE_LENGTH = 100

export const ELEMENT_OUTPUT_VALUES = ['text', 'html', 'attribute'] as const

/** The request spec for one name: a selector string, or an object. */
export type ScrapeElementSpec =
  | string
  | {
      selector: string
      output?: (typeof ELEMENT_OUTPUT_VALUES)[number]
      attribute?: string
      all?: boolean
      fields?: ScrapeElementsMap
    }

export type ScrapeElementsMap = Record<string, ScrapeElementSpec>

const Schema_ElementSelector = z.string().max(MAX_ELEMENT_SELECTOR_LENGTH)

function refineSpec(
  spec: { output?: string; attribute?: string; fields?: unknown },
  ctx: z.RefinementCtx
): void {
  if (spec.fields !== undefined) {
    if (spec.output !== undefined || spec.attribute !== undefined) {
      ctx.addIssue({
        code: 'custom',
        path: ['fields'],
        message: 'fields cannot be combined with output or attribute: each match becomes an object',
      })
    }
    if (Object.keys(spec.fields as object).length === 0) {
      ctx.addIssue({ code: 'custom', path: ['fields'], message: 'fields needs at least one field' })
    }
    return
  }
  if (spec.output === 'attribute' && !spec.attribute) {
    ctx.addIssue({
      code: 'custom',
      path: ['attribute'],
      message: 'attribute is required when output is "attribute"',
    })
  }
  if (spec.output !== 'attribute' && spec.attribute !== undefined) {
    ctx.addIssue({
      code: 'custom',
      path: ['attribute'],
      message: 'attribute is only allowed when output is "attribute"',
    })
  }
}

// The field texts are written out once, on the top level. Deeper levels have the
// same shape, and repeating the text there would only make the tool schema longer.
function describeTop<T extends z.ZodType>(schema: T, top: boolean, text: string): T {
  return top ? schema.describe(text) : schema
}

/** One `{ name: spec }` map that may still nest `fields` `fieldsDepth` more levels. */
function buildElementsMap(fieldsDepth: number, top = false): z.ZodType<ScrapeElementsMap> {
  const spec = z
    .object({
      selector: describeTop(Schema_ElementSelector, top, 'CSS selector, up to 500 characters'),
      // No default: `output` must stay absent when `fields` is used.
      output: describeTop(
        z.enum(ELEMENT_OUTPUT_VALUES).optional(),
        top,
        'What to return for a match: `text` (default), `html` (the outer HTML) or `attribute`'
      ),
      attribute: describeTop(
        z.string().min(1).max(MAX_ELEMENT_ATTRIBUTE_LENGTH).optional(),
        top,
        'The attribute to read when `output` is `attribute`. `href` and `src` come back as full urls'
      ),
      all: describeTop(
        z.boolean().default(false),
        top,
        'Return every match as a list instead of the first. Defaults to false'
      ),
      ...(fieldsDepth > 0
        ? {
            fields: describeTop(
              buildElementsMap(fieldsDepth - 1).optional(),
              top,
              'Used instead of `output`: turns each match into an object of named values, each read inside that match only. Same shape as `elements`; nests up to 3 levels'
            ),
          }
        : {}),
    })
    .strict()
    .superRefine(refineSpec)
  // The level-by-level build hides the recursive type from zod's inference; the
  // shape is exactly ScrapeElementsMap, nested `fieldsDepth` deep.
  return z.record(
    z.string(),
    z.union([Schema_ElementSelector, spec])
  ) as unknown as z.ZodType<ScrapeElementsMap>
}

export const Schema_ScrapeElements = buildElementsMap(ELEMENT_FIELDS_DEPTH, true)

/**
 * The answer: name → value. Today a value is a string, an object (`fields`), a
 * list of either (`all: true`), or `null` when nothing matched, nested 3 levels.
 * That shape lives in the field description only. Each value is left open on
 * purpose, like every other response field here: a host checks structured
 * output against this schema, and one value it does not expect (a new output
 * kind, a deeper level) would fail the whole tool call and lose the rest of the
 * result.
 */
export const Schema_ScrapeElementValues = z.record(z.string(), z.unknown())
