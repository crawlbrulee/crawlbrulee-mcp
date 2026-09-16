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
    it('exposes all sync + async tools with descriptions and schemas', async () => {
      const { tools } = await harness.client.listTools()
      const names = tools.map(t => t.name).sort()
      expect(names).toEqual([
        'map',
        'scrape',
        'scrape_async',
        'scrape_result',
        'scrape_status',
        'usage',
        'whoami',
      ])
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

    it('exposes the cleanup block, with its description, and not the fields it replaced', async () => {
      // The tool schema is the whole contract an LLM sees, so a dropped
      // description is a silently worse tool. Zod's `.extend()` clones without
      // the registry entry, which ate this exact string in the server repo
      // until `.describe()` was moved last — pinned here for the same reason.
      const { tools } = await harness.client.listTools()
      const scrape = tools.find(t => t.name === 'scrape')
      const props = scrape?.inputSchema.properties as Record<string, { description?: string }>

      expect(props).toMatchObject({ cleanup: {} })
      expect(props.cleanup?.description).toContain('Never applies to raw_html')
      // Both replaced shapes are gone: the strict server schema 400s on either.
      expect(props).not.toHaveProperty('exclude_selectors')
    })

    it('scrape_async input schema extends scrape with an optional webhook field', async () => {
      const { tools } = await harness.client.listTools()
      const asyncScrape = tools.find(t => t.name === 'scrape_async')
      expect(asyncScrape?.inputSchema.properties).toMatchObject({
        url: {},
        extract: {},
        webhook: {},
      })
    })

    it('scrape_status and scrape_result take a job_id input', async () => {
      const { tools } = await harness.client.listTools()
      for (const name of ['scrape_status', 'scrape_result']) {
        const tool = tools.find(t => t.name === name)
        expect(tool?.inputSchema.properties).toMatchObject({ job_id: {} })
        expect(tool?.inputSchema.required).toContain('job_id')
      }
    })
  })

  describe('scrape tool', () => {
    it('forwards the request body to the SDK and returns the structured response', async () => {
      const sdkResponse = {
        url: 'https://example.com',
        requested_url: 'https://example.com/?ref=test',
        metadata: { title: 'Example Domain' },
        response_meta: {
          usage: { credits: 1, engine: 'http', proxy: 'basic', screenshot_slices: 0 },
        },
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

  describe('scrape_async tool', () => {
    it('forwards the request to scrapeAsync and returns the job_id', async () => {
      harness.mock.scrapeAsync.mockResolvedValueOnce({ job_id: 'job_123' })

      const res = await harness.client.callTool({
        name: 'scrape_async',
        arguments: { url: 'https://example.com', extract: { markdown: true } },
      })

      expect(harness.mock.scrapeAsync).toHaveBeenCalledTimes(1)
      const [call] = harness.mock.scrapeAsync.mock.calls
      expect(call?.[0]).toMatchObject({
        url: 'https://example.com',
        extract: { markdown: true },
      })
      expect(res.isError).toBeFalsy()
      expect(res.structuredContent).toEqual({ job_id: 'job_123' })
    })

    it('flows webhook.url and webhook.metadata through to the SDK call', async () => {
      harness.mock.scrapeAsync.mockResolvedValueOnce({ job_id: 'job_456' })

      const res = await harness.client.callTool({
        name: 'scrape_async',
        arguments: {
          url: 'https://example.com',
          webhook: {
            url: 'https://hooks.example.com/cwbl',
            metadata: { ref: 'order-42', tenant: 7 },
          },
        },
      })

      expect(res.isError).toBeFalsy()
      const [call] = harness.mock.scrapeAsync.mock.calls
      expect(call?.[0]).toMatchObject({
        url: 'https://example.com',
        webhook: {
          url: 'https://hooks.example.com/cwbl',
          metadata: { ref: 'order-42', tenant: 7 },
        },
      })
    })

    it('rejects a webhook url that is not a valid URL', async () => {
      const res = await harness.client.callTool({
        name: 'scrape_async',
        arguments: { url: 'https://example.com', webhook: { url: 'not-a-url' } },
      })

      expect(res.isError).toBe(true)
      expect(harness.mock.scrapeAsync).not.toHaveBeenCalled()
    })

    it("accepts location.country pseudo-values 'eu' and 'europe'", async () => {
      harness.mock.scrapeAsync.mockResolvedValue({ job_id: 'job_eu' })

      for (const country of ['eu', 'europe', 'EUROPE', 'de']) {
        const res = await harness.client.callTool({
          name: 'scrape_async',
          arguments: { url: 'https://example.com', location: { country } },
        })
        expect(res.isError, `country=${country}`).toBeFalsy()
      }

      const rejected = await harness.client.callTool({
        name: 'scrape_async',
        arguments: { url: 'https://example.com', location: { country: 'usa' } },
      })
      expect(rejected.isError).toBe(true)
    })
  })

  describe('scrape_status tool', () => {
    it('calls getScrapeStatus with the job_id and returns the status', async () => {
      const status = {
        job_id: 'job_123',
        status: 'running',
        created_at: '2026-06-13T00:00:00.000Z',
      }
      harness.mock.getScrapeStatus.mockResolvedValueOnce(status)

      const res = await harness.client.callTool({
        name: 'scrape_status',
        arguments: { job_id: 'job_123' },
      })

      expect(harness.mock.getScrapeStatus).toHaveBeenCalledTimes(1)
      expect(harness.mock.getScrapeStatus.mock.calls[0]?.[0]).toBe('job_123')
      expect(res.isError).toBeFalsy()
      expect(res.structuredContent).toEqual(status)
    })

    it('surfaces response_meta.usage when the job is done', async () => {
      const status = {
        job_id: 'job_123',
        status: 'done',
        created_at: '2026-06-13T00:00:00.000Z',
        response_meta: {
          usage: { credits: 5, engine: 'http', proxy: 'advanced', screenshot_slices: 0 },
        },
      }
      harness.mock.getScrapeStatus.mockResolvedValueOnce(status)

      const res = await harness.client.callTool({
        name: 'scrape_status',
        arguments: { job_id: 'job_123' },
      })

      expect(res.isError).toBeFalsy()
      expect(res.structuredContent).toEqual(status)
    })
  })

  describe('scrape_result tool', () => {
    it('calls getScrapeResult with the job_id and returns the scrape result', async () => {
      const sdkResponse = {
        url: 'https://example.com',
        requested_url: 'https://example.com',
        metadata: { title: 'Example Domain' },
        response_meta: {
          usage: { credits: 0, engine: 'cache', proxy: 'basic', screenshot_slices: 0 },
        },
      }
      harness.mock.getScrapeResult.mockResolvedValueOnce(sdkResponse)

      const res = await harness.client.callTool({
        name: 'scrape_result',
        arguments: { job_id: 'job_123' },
      })

      expect(harness.mock.getScrapeResult).toHaveBeenCalledTimes(1)
      expect(harness.mock.getScrapeResult.mock.calls[0]?.[0]).toBe('job_123')
      expect(res.isError).toBeFalsy()
      expect(res.structuredContent).toEqual(sdkResponse)
    })
  })

  describe('map tool', () => {
    it('returns the discovered links', async () => {
      const sdkResponse = {
        links: [{ url: 'https://example.com/a' }, { url: 'https://example.com/b' }],
        response_meta: {
          pagination: {
            page: 1,
            limit: 5000,
            total: 2,
            total_pages: 1,
            has_more: false,
          },
          truncation: {
            storage_capped: false,
            response_capped: false,
            total_before_max_urls: 2,
            total_detected_before_storage_cap: 2,
            discovery_capped: false,
            sitemaps_skipped: 0,
            discovery_cap_reason: null,
          },
          usage: { credits: 1, engine: 'http', proxy: 'basic' },
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
        token_preview: 'cwbl_…abc',
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
