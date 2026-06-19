import type { McpServer } from '@modelcontextprotocol/sdk/server/mcp.js'

import type { CrawlbruleeClientFactory } from '../client.js'
import { runTool } from '../errors.js'
import { Schema_ApiMapRequest } from '../schemas/ApiMapRequest.js'
import { Schema_ApiMapResult } from '../schemas/ApiMapResponse.js'
import type { ApiMapRequest, ApiMapResult } from '../schemas/index.js'

const DESCRIPTION = [
  'Build (or fetch a cached) link-map for a website by combining sitemap discovery with homepage',
  'link extraction. Returns paginated lists of discovered URLs. Filterable by link type',
  '(internal / external / subdomain). Use this to enumerate a site before scraping selected pages.',
].join(' ')

export function registerMapTool(server: McpServer, getClient: CrawlbruleeClientFactory): void {
  server.registerTool(
    'map',
    {
      title: 'Map a website',
      description: DESCRIPTION,
      inputSchema: Schema_ApiMapRequest.shape,
      outputSchema: Schema_ApiMapResult.shape,
    },
    (args: ApiMapRequest) =>
      // The vendored response schema tracks the new wire contract: the envelope is
      // `response_meta` (with a `usage` block), whereas the published SDK's `MapResponse`
      // type still has the older `meta` envelope (no `usage`). The field is both renamed
      // and widened, so a plain cast won't type-check — bridge through `unknown` until the
      // SDK catches up. The runtime payload already matches the vendored shape.
      runTool(async () => (await getClient().map(args)) as unknown as ApiMapResult)
  )
}
