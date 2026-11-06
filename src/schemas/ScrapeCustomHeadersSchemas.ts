// Mirrors the crawlbrulee api's own schema. Update it by hand when the api changes.
//
// Only the cheap checks live here: the cookie shape and the cookie count. The
// header count, the byte limits, the allowed characters, the refused headers and
// the https rule for secure cookies are left to the api, which answers with a
// 400 that names the header or cookie.

import { z } from 'zod'

export const MAX_SCRAPE_CUSTOM_HEADERS = 10
export const MAX_SCRAPE_COOKIES = 20
export const MAX_SCRAPE_COOKIE_BYTES = 4096
export const MAX_SCRAPE_CUSTOM_HEADERS_AND_COOKIES_BYTES = 16384

export const HEADERS_AND_COOKIES_DOCS_URL =
  'https://crawlbrulee.com/docs/scrape/custom-headers-and-cookies'

// The values reach the api through the chat, so the AI host sees them too.
export const HEADERS_AND_COOKIES_CHAT_NOTE =
  'Header and cookie values pass through the chat with the AI, so the AI host may keep ' +
  'them in its history. Use short-lived tokens or a test account, and never a password ' +
  "you can't change."

// One line for the `scrape` and `scrape_async` tool descriptions.
export const HEADERS_AND_COOKIES_TOOL_TEXT =
  'To send your own headers or cookies to the site, set `headers` (for example ' +
  '`Authorization`, or a fixed `User-Agent`) or `cookies`. They go only to the site in `url`, ' +
  'and such a request never uses ' +
  `the cache. ${HEADERS_AND_COOKIES_CHAT_NOTE} Tell the user this before they share one. ` +
  `See ${HEADERS_AND_COOKIES_DOCS_URL}.`

export const Schema_ScrapeCustomHeaders = z.record(z.string(), z.string())

export const Schema_ScrapeCookie = z
  .object({
    name: z.string().min(1),
    value: z.string(),
  })
  .strict()

export const Schema_ScrapeCookies = z.array(Schema_ScrapeCookie).max(MAX_SCRAPE_COOKIES)
