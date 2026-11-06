// Mirrors the crawlbrulee api's own schema. Update it by hand when the api changes.

import { z } from 'zod'

export const Schema_ApiUsageResponse = z.looseObject({
  total_credits: z
    .number()
    .int()
    .nonnegative()
    .describe(
      'Total credits available for the current billing cycle (plan base + purchased + gifted).'
    ),
  used_credits: z
    .number()
    .int()
    .nonnegative()
    .describe(
      'Credits spent so far in the current billing cycle. May exceed total_credits on plans that allow overages.'
    ),
  available_credits: z
    .number()
    .int()
    .nonnegative()
    .describe(
      'Remaining credits (max(0, total_credits - used_credits)). Clamped to 0 when in overage.'
    ),
  used_quota_percent: z
    .number()
    .nonnegative()
    .describe(
      'Percentage of total_credits used in the current cycle, rounded to 1 decimal. Not capped — values >100 indicate overage.'
    ),
  max_concurrency: z
    .number()
    .int()
    .nonnegative()
    .describe(
      'Maximum number of concurrent jobs allowed for this organization (plan base + purchased + gifted extras).'
    ),
  usage_reset: z
    .string()
    .datetime()
    .describe(
      'ISO 8601 UTC timestamp when the current billing cycle ends and used_credits resets.'
    ),
})

export type ApiUsageResponse = z.infer<typeof Schema_ApiUsageResponse>
