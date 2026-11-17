// Mirrors the crawlbrulee api's own schema. Update it by hand when the api changes.

import { z } from 'zod'

export const SCRAPE_PDF_LAYOUT_VALUES = ['pages', 'single_page'] as const
export const SCRAPE_PDF_PAPER_VALUES = ['a4', 'letter'] as const
export const SCRAPE_PDF_MEDIA_VALUES = ['screen', 'print'] as const

/** The tallest `single_page` PDF page, in css pixels. A taller page goes on over more pages. */
export const MAX_SCRAPE_PDF_SINGLE_PAGE_HEIGHT_PX = 15_000

export const Schema_ApiScrapePdf = z
  .object({
    layout: z
      .enum(SCRAPE_PDF_LAYOUT_VALUES)
      .default('pages')
      .describe(
        '`pages` (default): the page on sheets of paper, laid out as in the browser window ' +
          '(the desktop default, or the screenshot device and viewport when the request also ' +
          'asks for a screenshot) and shrunk to fit the paper width. `single_page`: one page as ' +
          'wide as the browser window and as tall as the web page, up to ' +
          `${MAX_SCRAPE_PDF_SINGLE_PAGE_HEIGHT_PX.toLocaleString('en-US')} px; a taller page goes ` +
          'on over more pages, with the `pdf_single_page_overflow` warning.'
      ),
    // No default for `paper` and `landscape`: with `single_page` they may not be sent at all.
    paper: z
      .enum(SCRAPE_PDF_PAPER_VALUES)
      .optional()
      .describe(
        'Paper size for `layout: "pages"`: `a4` (default) or `letter`. Not allowed with `single_page`.'
      ),
    landscape: z
      .boolean()
      .optional()
      .describe(
        'Turn the paper sideways, for `layout: "pages"`. Defaults to false. Not allowed with `single_page`.'
      ),
    media: z
      .enum(SCRAPE_PDF_MEDIA_VALUES)
      .default('screen')
      .describe(
        "`screen` (default): the page as it looks on screen. `print`: the site's own print " +
          'style, which on many sites hides menus and images; a site without one looks as on screen.'
      ),
  })
  .strict()
  .superRefine((pdf, ctx) => {
    if (pdf.layout !== 'single_page') {
      return
    }
    for (const field of ['paper', 'landscape'] as const) {
      if (pdf[field] !== undefined) {
        ctx.addIssue({
          code: 'custom',
          path: [field],
          message: `${field} is only allowed with layout "pages"; leave it out for "single_page".`,
        })
      }
    }
  })

export type ApiScrapePdf = z.infer<typeof Schema_ApiScrapePdf>
