import type { Crawlbrulee } from '@crawlbrulee/sdk'
import { vi, type Mock } from 'vitest'

export interface MockedCrawlbrulee {
  client: Crawlbrulee
  scrape: Mock
  scrapeAsync: Mock
  getScrapeStatus: Mock
  getScrapeResult: Mock
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
  const scrapeAsync = vi.fn()
  const getScrapeStatus = vi.fn()
  const getScrapeResult = vi.fn()
  const map = vi.fn()
  const usage = vi.fn()
  const whoami = vi.fn()
  const client = {
    scrape,
    scrapeAsync,
    getScrapeStatus,
    getScrapeResult,
    map,
    usage,
    whoami,
  } as unknown as Crawlbrulee
  return { client, scrape, scrapeAsync, getScrapeStatus, getScrapeResult, map, usage, whoami }
}
