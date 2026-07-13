// VENDORED from crawlbrulee/packages/shared/core/src/model/common/ApiScrapeResponse.ts
// Keep in sync with the canonical source on schema bumps.
//
// Response shapes for the async scrape lifecycle: submit (job_id), status, and
// the per-job id input used by the status/result tools.

import { z } from 'zod'
import { Schema_ApiResponseMeta } from './ApiScrapeResponse.js'

export const ASYNC_JOB_STATUS_VALUES = ['pending', 'running', 'done', 'failed'] as const

export const Schema_AsyncJobId = z.object({
  job_id: z.string().describe('Job identifier returned by the `scrape_async` tool'),
})

export type AsyncJobId = z.infer<typeof Schema_AsyncJobId>

export const Schema_ApiScrapeAsyncResponse = z.object({
  job_id: z
    .string()
    .describe('Job identifier — pass it to the `scrape_status` / `scrape_result` tools'),
})

export type ApiScrapeAsyncResponse = z.infer<typeof Schema_ApiScrapeAsyncResponse>

// The status response is uniformly snake_case (job_id, created_at), matching
// the rest of the crawlbrulee wire format. We mirror it 1:1 — no case mapping.
export const Schema_ApiScrapeStatusResponse = z.object({
  job_id: z.string().describe('The job identifier'),
  status: z
    .enum(ASYNC_JOB_STATUS_VALUES)
    .describe('Current state of the job (pending, running, done, failed)'),
  created_at: z.string().describe('ISO-8601 UTC timestamp when the job was created'),
  error: z.string().optional().describe('Error message if the job ended in `failed`'),
  response_meta: Schema_ApiResponseMeta.optional().describe(
    'Usage accounting for the finished job. Present only once the job is `done`; ' +
      '`response_meta.usage` reports credits charged (0 on a cache hit), the resolved proxy tier, and the cache-hit flag.'
  ),
})

export type ApiScrapeStatusResponse = z.infer<typeof Schema_ApiScrapeStatusResponse>
