// VENDORED from crawlbrulee/packages/shared/core/src/model/common/ApiScrapeRequest.ts
// Keep in sync with the canonical source on schema bumps.
//
// The async submit body is the synchronous scrape request plus an optional
// per-job completion webhook. The webhook is ASYNC-ONLY: the synchronous
// `scrape` endpoint's response IS the notification, so it rejects this field.

import { z } from 'zod'
import { Schema_ApiScrapeRequest } from './ApiScrapeRequest.js'

export const Schema_AsyncScrapeWebhook = z
  .object({
    url: z
      .string()
      .url()
      .max(2048)
      .describe(
        'Endpoint that receives a single signed POST when the job reaches a terminal ' +
          'state. Must be an http/https URL (HTTPS is required in production) of at most ' +
          '2048 characters. The body is a `scrape.complete` envelope signed with your ' +
          'organization webhook secret on the X-Cwbl-Signature header.'
      ),
    metadata: z
      .record(z.string(), z.unknown())
      .optional()
      .describe(
        'Opaque correlation object echoed verbatim in the webhook payload’s ' +
          'data.metadata. Must serialize to at most 2048 bytes (UTF-8 JSON). Use it to ' +
          'route deliveries without keeping your own job_id mapping.'
      ),
  })
  .strict()
  .describe('Optional per-job completion webhook delivered when this async job finishes')

export const Schema_ApiScrapeAsyncRequest = Schema_ApiScrapeRequest.extend({
  webhook: Schema_AsyncScrapeWebhook.optional().describe(
    'Completion webhook delivered when this async job finishes. Async-only: the ' +
      'synchronous `scrape` tool does not accept it.'
  ),
})

export type ApiScrapeAsyncRequest = z.infer<typeof Schema_ApiScrapeAsyncRequest>
