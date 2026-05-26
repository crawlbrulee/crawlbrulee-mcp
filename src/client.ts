import { Crawlbrulee } from '@crawlbrulee/sdk'

/**
 * Factory the tool handlers call to obtain an SDK client. Built lazily so a
 * missing API key surfaces as a per-tool error (with remediation guidance)
 * rather than a startup crash — easier to diagnose from an MCP host's logs.
 */
export type CrawlbruleeClientFactory = () => Crawlbrulee

export function createDefaultClientFactory(): CrawlbruleeClientFactory {
  let cached: Crawlbrulee | undefined
  return () => {
    if (cached) return cached
    cached = Crawlbrulee.fromEnv()
    return cached
  }
}
