import {
  AuthenticationError,
  CrawlbruleeError,
  ENV_API_KEY,
  RateLimitError,
  ZeroDataRetentionNotEnabledError,
} from '@crawlbrulee/sdk'
import type { ApiErrorName } from '@crawlbrulee/sdk'
import { describe, expect, it } from 'vitest'

import { toToolError } from '../src/errors.js'

function extractText(result: ReturnType<typeof toToolError>): string {
  return result.content[0]?.text ?? ''
}

describe('toToolError', () => {
  it('formats an authentication error with the SDK error name and HTTP status', () => {
    const err = new AuthenticationError('bad key', {
      status: 401,
      errorName: 'invalid_credentials',
    })
    const out = toToolError(err)
    expect(out.isError).toBe(true)
    expect(extractText(out)).toBe('[invalid_credentials] bad key (HTTP 401)')
  })

  it('formats a rate-limit error (errorName is hardcoded to too_many_requests by the SDK)', () => {
    const err = new RateLimitError('slow down', { status: 429 })
    expect(extractText(toToolError(err))).toBe('[too_many_requests] slow down (HTTP 429)')
  })

  it('falls back to crawlbrulee_error when errorName is null on a generic SDK error', () => {
    const err = new CrawlbruleeError('boom', { status: 500, errorName: null })
    expect(extractText(toToolError(err))).toBe('[crawlbrulee_error] boom (HTTP 500)')
  })

  it('adds a next step to target_unreachable, so an agent knows to retry or check the url', () => {
    const err = new CrawlbruleeError('Could not reach the target site.', {
      status: 502,
      // sdk 1.0's ApiErrorName does not list it yet; the api sends it anyway.
      errorName: 'target_unreachable' as string as ApiErrorName,
    })
    const text = extractText(toToolError(err))
    // The stable prefix agents branch on stays the same.
    expect(text).toMatch(/^\[target_unreachable\] Could not reach the target site\. \(HTTP 502\)/)
    expect(text).toMatch(/retry later/i)
    expect(text).toMatch(/check the url/i)
    expect(text).toMatch(/not billed/i)
  })

  it('explains zero_data_retention_not_enabled for both cases: asked for it, or not', () => {
    const err = new ZeroDataRetentionNotEnabledError(
      'zero_data_retention is not enabled for your organization. Contact us to turn it on.',
      { status: 403, errorName: 'zero_data_retention_not_enabled' }
    )
    const text = extractText(toToolError(err))
    expect(text).toMatch(/^\[zero_data_retention_not_enabled\] .* \(HTTP 403\)/)
    expect(text).toMatch(/not enabled for this organization/i)
    expect(text).toMatch(/again without `zero_data_retention`/i)
    expect(text).toMatch(/turn it on/i)
    expect(text).toMatch(/not billed/i)
  })

  it('leaves errors without a hint unchanged', () => {
    const err = new CrawlbruleeError('nope', { status: 403, errorName: 'antibot_blocked' })
    expect(extractText(toToolError(err))).toBe('[antibot_blocked] nope (HTTP 403)')
  })

  it('rewrites the SDK missing-API-key error into a missing_api_key remediation message', () => {
    const err = new CrawlbruleeError(`${ENV_API_KEY} is not set. ...`, {
      status: 0,
      errorName: null,
    })
    const text = extractText(toToolError(err))
    expect(text).toContain('[missing_api_key]')
    expect(text).toContain(ENV_API_KEY)
    expect(text).toContain('claude mcp add')
  })

  it('omits HTTP status when it is 0 (transport-level error with no response)', () => {
    const err = new CrawlbruleeError('aborted', { status: 0, errorName: 'client_closed_request' })
    expect(extractText(toToolError(err))).toBe('[client_closed_request] aborted')
  })

  it('wraps non-Crawlbrulee errors with the internal_error code', () => {
    expect(extractText(toToolError(new TypeError('oops')))).toBe('[internal_error] oops')
  })

  it('handles thrown non-Error values', () => {
    expect(extractText(toToolError('weird'))).toBe('[internal_error] weird')
  })
})
