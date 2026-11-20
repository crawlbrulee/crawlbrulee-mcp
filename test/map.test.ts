import { Client } from '@modelcontextprotocol/sdk/client/index.js'
import { InMemoryTransport } from '@modelcontextprotocol/sdk/inMemory.js'
import { RateLimitError } from '@crawlbrulee/sdk'
import { beforeEach, describe, expect, it } from 'vitest'

import { buildServer } from '../src/server.js'
import { makeMockedClient, type MockedCrawlbrulee } from './helpers/mockClient.js'

// The map tool's input mirrors the api: `sitemap_url`, `depth`, `entries`,
// `modified_since` and `max_results`. Every link carries `type` (`page`, `sitemap` or
// `sitemap_index`) and `lastmod`, and `truncation.unread_sitemaps` lists the files a call
// did not read.

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
  await client.listTools()
  return { client, mock }
}

const mapResponse = () => ({
  links: [
    {
      url: 'https://example.com/sitemaps/products.xml',
      type: 'sitemap_index',
      lastmod: '2026-11-01T00:00:00.000Z',
    },
    {
      url: 'https://example.com/sitemaps/products-1.xml.gz',
      type: 'sitemap',
      lastmod: '2026-11-01T00:00:00.000Z',
    },
    { url: 'https://example.com/books/the-night-garden', type: 'page', lastmod: null },
  ],
  response_meta: {
    usage: {
      total_credit_cost: 1,
      engine_credit_cost: 1,
      proxy_multiplier: 1,
      zero_data_retention_credit_cost: 0,
      engine: 'http',
      proxy: 'basic',
    },
    pagination: { page: 1, limit: 5000, total: 3, total_pages: 1, has_more: false },
    truncation: {
      storage_capped: false,
      response_capped: false,
      total_before_max_results: 3,
      total_before_max_urls: 3,
      total_detected_before_storage_cap: 3,
      discovery_capped: true,
      sitemaps_skipped: 1,
      unread_sitemaps: ['https://example.com/sitemaps/products-2.xml.gz'],
      discovery_cap_reason: 'depth',
    },
  },
})

const mapCall = (args: Record<string, unknown>) => ({
  name: 'map',
  arguments: { url: 'https://example.com', ...args },
})

/** The body the tool handed to the sdk for its first map call. */
const sentBody = (h: Harness) => h.mock.map.mock.calls[0]?.[0] as Record<string, unknown>

describe('map tool, new map shape', () => {
  let h: Harness

  beforeEach(async () => {
    h = await setup()
  })

  describe('tool discovery', () => {
    it('lists the map fields as top-level inputs, and no sitemap block', async () => {
      const { tools } = await h.client.listTools()
      const props = tools.find(t => t.name === 'map')?.inputSchema.properties ?? {}
      for (const field of [
        'sitemap_url',
        'depth',
        'entries',
        'modified_since',
        'max_results',
        'max_urls',
      ]) {
        expect(props).toHaveProperty(field)
      }
      expect(props).not.toHaveProperty('sitemap')
    })

    it('marks max_urls as deprecated in its description', async () => {
      const { tools } = await h.client.listTools()
      const props = tools.find(t => t.name === 'map')?.inputSchema.properties as Record<
        string,
        { description?: string }
      >
      expect(props.max_urls?.description).toMatch(/^Deprecated: use `max_results`/)
    })

    it('says in the map description how to map a large site', async () => {
      const { tools } = await h.client.listTools()
      const description = tools.find(t => t.name === 'map')?.description ?? ''
      expect(description).toContain('`sitemap_url`')
      expect(description).toContain('`depth: 1` and `entries: "sitemaps"`')
      expect(description).not.toContain('`depth: 0`')
      expect(description).toContain('unread_sitemaps')
      expect(description).toContain('too_many_requests')
      expect(description).not.toContain('max_urls')
    })

    it('names every link type in the map description', async () => {
      const { tools } = await h.client.listTools()
      const description = tools.find(t => t.name === 'map')?.description ?? ''
      expect(description).toContain('`type` is `page`, `sitemap` or')
      expect(description).toContain('`sitemap_index`')
    })

    it('says that modified_since reads every sitemap file, whatever its date', async () => {
      const { tools } = await h.client.listTools()
      const map = tools.find(t => t.name === 'map')
      const props = map?.inputSchema.properties as Record<string, { description?: string }>
      for (const text of [map?.description ?? '', props.modified_since?.description ?? '']) {
        expect(text).toContain('Every sitemap file is read whatever its own')
        expect(text).toContain('`entries: "pages"`')
        expect(text).not.toMatch(/older `?lastmod`? is not read/)
      }
    })

    it('gives depth 1 with entries "sitemaps" as the way to list a sitemap tree', async () => {
      const { tools } = await h.client.listTools()
      const props = tools.find(t => t.name === 'map')?.inputSchema.properties as Record<
        string,
        { description?: string }
      >
      expect(props.depth?.description).toContain('`depth: 1` with `entries: "sitemaps"`')
      expect(props.entries?.description).toContain('`sitemap_index`')
    })

    it('lists sitemap_index among the known link types in the output schema', async () => {
      const { tools } = await h.client.listTools()
      const schema = tools.find(t => t.name === 'map')?.outputSchema as unknown as {
        properties: { links: { items: { properties: { type: { anyOf: { enum?: string[] }[] } } } } }
      }
      const known = schema.properties.links.items.properties.type.anyOf.find(s => s.enum)?.enum
      expect(known).toEqual(['page', 'sitemap', 'sitemap_index'])
    })

    it('documents type, lastmod and the new truncation fields in the output schema, as optional', async () => {
      const { tools } = await h.client.listTools()
      const schema = tools.find(t => t.name === 'map')?.outputSchema as unknown as {
        properties: {
          links: { items: { properties: Record<string, unknown>; required?: string[] } }
          response_meta: {
            properties: {
              truncation: { properties: Record<string, unknown>; required?: string[] }
            }
          }
        }
      }
      const link = schema.properties.links.items
      expect(link.properties).toHaveProperty('type')
      expect(link.properties).toHaveProperty('lastmod')
      expect(link.required).toEqual(['url'])

      const truncation = schema.properties.response_meta.properties.truncation
      for (const field of [
        'total_before_max_results',
        'total_before_max_urls',
        'unread_sitemaps',
      ]) {
        expect(truncation.properties).toHaveProperty(field)
        expect(truncation.required).not.toContain(field)
      }
    })
  })

  describe('forwarding', () => {
    it('sends only url and the paging defaults for a plain map', async () => {
      h.mock.map.mockResolvedValueOnce(mapResponse())

      await h.client.callTool(mapCall({}))

      expect(sentBody(h)).toEqual({
        url: 'https://example.com',
        proxy: 'auto',
        sitemap_only: false,
        page: 1,
        limit: 5000,
      })
    })

    it('passes every map field through unchanged', async () => {
      h.mock.map.mockResolvedValueOnce(mapResponse())
      const fields = {
        sitemap_url: 'https://cdn.example.com/sitemaps/products-1.xml.gz',
        depth: 1,
        entries: 'all',
        modified_since: '2026-11-01T00:00:00+01:00',
        max_results: 200,
      }

      const res = await h.client.callTool(mapCall(fields))

      expect(res.isError).toBeFalsy()
      expect(sentBody(h)).toMatchObject(fields)
    })

    it('sends a plain modified_since date as it is', async () => {
      h.mock.map.mockResolvedValueOnce(mapResponse())

      const res = await h.client.callTool(mapCall({ modified_since: '2026-11-01' }))

      expect(res.isError).toBeFalsy()
      expect(sentBody(h)).toMatchObject({ modified_since: '2026-11-01' })
    })

    it('leaves the depth maximum to the api', async () => {
      h.mock.map.mockResolvedValueOnce(mapResponse())

      const res = await h.client.callTool(mapCall({ depth: 7 }))

      expect(res.isError).toBeFalsy()
      expect(sentBody(h)).toMatchObject({ depth: 7 })
    })

    it('sends max_urls as max_results', async () => {
      h.mock.map.mockResolvedValueOnce(mapResponse())

      await h.client.callTool(mapCall({ max_urls: 300 }))

      expect(sentBody(h)).toMatchObject({ max_results: 300 })
      expect(sentBody(h)).not.toHaveProperty('max_urls')
    })

    it('uses max_results when both are given', async () => {
      h.mock.map.mockResolvedValueOnce(mapResponse())

      await h.client.callTool(mapCall({ max_urls: 300, max_results: 50 }))

      expect(sentBody(h)).toMatchObject({ max_results: 50 })
      expect(sentBody(h)).not.toHaveProperty('max_urls')
    })

    it('returns type, lastmod and the truncation fields as the api sent them', async () => {
      h.mock.map.mockResolvedValueOnce(mapResponse())

      const res = await h.client.callTool(mapCall({ depth: 1, entries: 'sitemaps' }))

      expect(res.isError).toBeFalsy()
      expect(res.structuredContent).toEqual(mapResponse())
    })

    it('accepts an answer without the deprecated total_before_max_urls', async () => {
      const body = mapResponse()
      const { total_before_max_urls: _gone, ...truncation } = body.response_meta.truncation
      h.mock.map.mockResolvedValueOnce({
        ...body,
        response_meta: { ...body.response_meta, truncation },
      })

      const res = await h.client.callTool(mapCall({}))

      expect(res.isError).toBeFalsy()
    })

    it('does not send a key the tool does not know', async () => {
      h.mock.map.mockResolvedValueOnce(mapResponse())

      await h.client.callTool(mapCall({ sitemap: {} }))

      expect(sentBody(h)).not.toHaveProperty('sitemap')
    })

    it('maps a 429 from the site to too_many_requests', async () => {
      h.mock.map.mockRejectedValueOnce(
        new RateLimitError('The site is rate limiting.', { status: 429 })
      )

      const res = await h.client.callTool(mapCall({ depth: 1, entries: 'sitemaps' }))

      expect(res.isError).toBe(true)
      expect(JSON.stringify(res.content)).toContain('[too_many_requests]')
    })
  })

  describe('input checks', () => {
    it.each([
      ['a negative depth', { depth: -1 }],
      ['a depth that is not a whole number', { depth: 1.5 }],
      ['an unknown entries value', { entries: 'images' }],
      ['a modified_since that is not a date and time', { modified_since: 'last week' }],
      ['a modified_since with no time zone', { modified_since: '2026-11-01T08:00:00' }],
      ['a modified_since date that does not exist', { modified_since: '2026-02-30' }],
      ['a max_results over 100000', { max_results: 100001 }],
      ['a max_results of 0', { max_results: 0 }],
    ])('refuses %s', async (_label, args) => {
      const res = await h.client.callTool(mapCall(args))
      expect(res.isError).toBe(true)
      expect(h.mock.map).not.toHaveBeenCalled()
    })
  })
})
