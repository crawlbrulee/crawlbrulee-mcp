import { Client } from '@modelcontextprotocol/sdk/client/index.js'
import { InMemoryTransport } from '@modelcontextprotocol/sdk/inMemory.js'
import {
  AuthenticationError,
  CrawlbruleeError,
  RateLimitError,
  ValidationError,
} from '@crawlbrulee/sdk'
import { beforeEach, describe, expect, it } from 'vitest'

import { buildServer } from '../src/server.js'
import { makeMockedClient, type MockedCrawlbrulee } from './helpers/mockClient.js'

interface Harness {
  client: Client
  mock: MockedCrawlbrulee
}

async function setup(): Promise<Harness> {
  const mock = makeMockedClient()
  const server = buildServer(() => mock.client)

  const [clientTransport, serverTransport] = InMemoryTransport.createLinkedPair()
  await server.connect(serverTransport)

  const client = new Client({ name: 'test', version: '0.0.0' })
  await client.connect(clientTransport)

  return { client, mock }
}

describe('MCP server', () => {
  let harness: Harness

  beforeEach(async () => {
    harness = await setup()
  })

  describe('tool discovery', () => {
    it('exposes scrape, map, usage, whoami with descriptions and schemas', async () => {
      const { tools } = await harness.client.listTools()
      const names = tools.map(t => t.name).sort()
      expect(names).toEqual(['map', 'scrape', 'usage', 'whoami'])
      for (const tool of tools) {
        expect(tool.description?.length ?? 0).toBeGreaterThan(0)
        expect(tool.inputSchema).toBeTruthy()
        expect(tool.outputSchema).toBeTruthy()
      }
    })

    it('lists scrape extract fields in the input schema (proves describe() strings flow through)', async () => {
      const { tools } = await harness.client.listTools()
      const scrape = tools.find(t => t.name === 'scrape')
      expect(scrape?.inputSchema.properties).toMatchObject({ url: {}, extract: {} })
    })
  })

  describe('scrape tool', () => {
    it('forwards the request body to the SDK and returns the structured response', async () => {
      const sdkResponse = {
        url: 'https://example.com',
        metadata: { title: 'Example Domain' },
      }
      harness.mock.scrape.mockResolvedValueOnce(sdkResponse)

      const res = await harness.client.callTool({
        name: 'scrape',
        arguments: { url: 'https://example.com', extract: { markdown: true } },
      })

      expect(harness.mock.scrape).toHaveBeenCalledTimes(1)
      const [call] = harness.mock.scrape.mock.calls
      expect(call?.[0]).toMatchObject({
        url: 'https://example.com',
        extract: { markdown: true },
      })
      expect(res.isError).toBeFalsy()
      expect(res.structuredContent).toEqual(sdkResponse)
      expect(Array.isArray(res.content) ? res.content[0] : undefined).toMatchObject({
        type: 'text',
      })
    })
  })

  describe('map tool', () => {
    it('returns the discovered links', async () => {
      const sdkResponse = {
        links: [{ url: 'https://example.com/a' }, { url: 'https://example.com/b' }],
        meta: {
          pagination: {
            page: 1,
            limit: 10000,
            total: 2,
            total_pages: 1,
            has_more: false,
          },
          truncation: {
            storage_capped: false,
            response_capped: false,
            total_before_max_urls: 2,
            total_detected_before_storage_cap: 2,
          },
        },
      }
      harness.mock.map.mockResolvedValueOnce(sdkResponse)

      const res = await harness.client.callTool({
        name: 'map',
        arguments: { url: 'https://example.com' },
      })

      expect(res.isError).toBeFalsy()
      expect(res.structuredContent).toEqual(sdkResponse)
    })
  })

  describe('usage + whoami', () => {
    it('returns the SDK responses verbatim', async () => {
      harness.mock.usage.mockResolvedValueOnce({
        total_credits: 1000,
        used_credits: 250,
        available_credits: 750,
        used_quota_percent: 25,
        max_concurrency: 5,
        usage_reset: '2026-06-01T00:00:00.000Z',
      })
      harness.mock.whoami.mockResolvedValueOnce({
        organization_name: 'Acme',
        token_name: 'prod',
        token_preview: 'cble_…abc',
      })

      const usage = await harness.client.callTool({ name: 'usage', arguments: {} })
      const whoami = await harness.client.callTool({ name: 'whoami', arguments: {} })

      expect(usage.isError).toBeFalsy()
      expect(whoami.isError).toBeFalsy()
      expect(usage.structuredContent).toMatchObject({ available_credits: 750 })
      expect(whoami.structuredContent).toMatchObject({ organization_name: 'Acme' })
    })
  })

  describe('error mapping', () => {
    it.each([
      [
        'authentication failure',
        new AuthenticationError('bad key', { status: 401, errorName: 'invalid_credentials' }),
        /\[invalid_credentials\]/,
      ],
      [
        'rate limit (SDK forces too_many_requests)',
        new RateLimitError('slow down', { status: 429 }),
        /\[too_many_requests\]/,
      ],
      [
        'validation error',
        new ValidationError('url required', { status: 400, errorName: 'validation_error' }),
        /\[validation_error\]/,
      ],
      [
        'unknown SDK error falls back to crawlbrulee_error',
        new CrawlbruleeError('boom', { status: 500, errorName: null }),
        /\[crawlbrulee_error\]/,
      ],
    ])('%s', async (_label, err, expected) => {
      harness.mock.scrape.mockRejectedValueOnce(err)
      const res = await harness.client.callTool({
        name: 'scrape',
        arguments: { url: 'https://example.com' },
      })
      expect(res.isError).toBe(true)
      const text = Array.isArray(res.content) ? (res.content[0] as { text?: string }).text : ''
      expect(text).toMatch(expected)
    })

    it('non-Crawlbrulee errors get the internal_error code', async () => {
      harness.mock.scrape.mockRejectedValueOnce(new TypeError('oops'))
      const res = await harness.client.callTool({
        name: 'scrape',
        arguments: { url: 'https://example.com' },
      })
      expect(res.isError).toBe(true)
      const text = Array.isArray(res.content) ? (res.content[0] as { text?: string }).text : ''
      expect(text).toContain('[internal_error]')
    })
  })
})
