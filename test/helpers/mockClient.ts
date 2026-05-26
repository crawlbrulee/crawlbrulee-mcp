import type { Crawlbrulee } from '@crawlbrulee/sdk'
import { vi, type Mock } from 'vitest'

export interface MockedCrawlbrulee {
  client: Crawlbrulee
  scrape: Mock
  map: Mock
  usage: Mock
  whoami: Mock
}

/**
 * Returns a duck-typed Crawlbrulee instance with each method mocked via vitest.
 * Safe because the MCP tool handlers only ever call the public methods.
 */
export function makeMockedClient(): MockedCrawlbrulee {
  const scrape = vi.fn()
  const map = vi.fn()
  const usage = vi.fn()
  const whoami = vi.fn()
  const client = { scrape, map, usage, whoami } as unknown as Crawlbrulee
  return { client, scrape, map, usage, whoami }
}
