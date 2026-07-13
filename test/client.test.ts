import { CrawlbruleeError, ENV_API_KEY } from '@crawlbrulee/sdk'
import { afterEach, describe, expect, it } from 'vitest'

import { createDefaultClientFactory } from '../src/client.js'

describe('createDefaultClientFactory', () => {
  const originalKey = process.env[ENV_API_KEY]

  afterEach(() => {
    if (originalKey === undefined) delete process.env[ENV_API_KEY]
    else process.env[ENV_API_KEY] = originalKey
  })

  it('returns the same client on repeated calls (lazy memoization)', () => {
    process.env[ENV_API_KEY] = 'cwbl_test_key'
    const factory = createDefaultClientFactory()
    expect(factory()).toBe(factory())
  })

  it('throws a CrawlbruleeError mentioning the env var when the API key is missing', () => {
    delete process.env[ENV_API_KEY]
    const factory = createDefaultClientFactory()
    try {
      factory()
      throw new Error('factory should have thrown')
    } catch (err) {
      expect(err).toBeInstanceOf(CrawlbruleeError)
      expect((err as Error).message).toContain(ENV_API_KEY)
    }
  })
})
