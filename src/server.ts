import { McpServer } from '@modelcontextprotocol/sdk/server/mcp.js'

import { createDefaultClientFactory, type CrawlbruleeClientFactory } from './client.js'
import { registerMapTool } from './tools/map.js'
import { registerScrapeTool } from './tools/scrape.js'
import { registerScrapeAsyncTool } from './tools/scrapeAsync.js'
import { registerScrapeResultTool } from './tools/scrapeResult.js'
import { registerScrapeStatusTool } from './tools/scrapeStatus.js'
import { registerUsageTool } from './tools/usage.js'
import { registerWhoamiTool } from './tools/whoami.js'
import { SERVER_NAME, SERVER_VERSION } from './version.js'

/**
 * Build a configured `McpServer` instance with all crawlbrulee tools
 * registered. Pure factory — no I/O — so it can be reused under different
 * transports (currently only stdio).
 *
 * Pass `clientFactory` from tests to inject a stubbed SDK client.
 */
export function buildServer(
  clientFactory: CrawlbruleeClientFactory = createDefaultClientFactory()
): McpServer {
  const server = new McpServer({ name: SERVER_NAME, version: SERVER_VERSION })

  registerScrapeTool(server, clientFactory)
  registerScrapeAsyncTool(server, clientFactory)
  registerScrapeStatusTool(server, clientFactory)
  registerScrapeResultTool(server, clientFactory)
  registerMapTool(server, clientFactory)
  registerUsageTool(server, clientFactory)
  registerWhoamiTool(server, clientFactory)

  return server
}
