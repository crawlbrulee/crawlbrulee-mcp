import { Client } from '@modelcontextprotocol/sdk/client/index.js'
import { InMemoryTransport } from '@modelcontextprotocol/sdk/inMemory.js'
import { beforeEach, describe, expect, it } from 'vitest'

import { buildServer } from '../src/server.js'
import { makeMockedClient, type MockedCrawlbrulee } from './helpers/mockClient.js'

// The api adds response fields and enum values over time. A host that validates
// structured output against our advertised outputSchema must accept those, or
// every published server version breaks the day the api grows. It must still
// refuse a response that lacks a required field.
//
// The client only validates after it has listed the tools, exactly as a real
// host does, so every test here lists them first.

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

// Usage as the api sends it: the price parts.
const usage = () => ({
  total_credit_cost: 1,
  engine_credit_cost: 1,
  proxy_multiplier: 1,
  screenshot_slicing_credit_cost: 0,
  zero_data_retention_credit_cost: 0,
  engine: 'http',
  proxy: 'basic',
})

// Usage as an older api version sends it: only the old names. They are not in the schemas
// any more, but the output objects are loose, so a response that carries them still validates.
const oldUsage = () => ({ credits: 1, engine: 'http', proxy: 'basic', screenshot_slices: 0 })

const mapUsage = () => ({
  total_credit_cost: 1,
  engine_credit_cost: 1,
  proxy_multiplier: 1,
  zero_data_retention_credit_cost: 0,
  engine: 'http',
  proxy: 'basic',
})

const scrapeResponse = () => ({
  url: 'https://example.com/',
  requested_url: 'https://example.com',
  page_status_code: 200,
  metadata: { title: 'Example' },
  response_meta: { usage: usage() },
})

const mapResponse = () => ({
  links: [{ url: 'https://example.com/a' }],
  response_meta: {
    usage: mapUsage(),
    pagination: { page: 1, limit: 5000, total: 1, total_pages: 1, has_more: false },
    truncation: {
      storage_capped: false,
      response_capped: false,
      total_before_max_urls: 1,
      total_detected_before_storage_cap: 1,
      discovery_capped: false,
      sitemaps_skipped: 0,
      discovery_cap_reason: null,
    },
  },
})

const statusResponse = () => ({
  job_id: 'job_1',
  status: 'done',
  created_at: '2026-09-25T00:00:00.000Z',
  response_meta: { usage: usage() },
})

const usageResponse = () => ({
  total_credits: 100,
  used_credits: 1,
  available_credits: 99,
  used_quota_percent: 1,
  max_concurrency: 2,
  usage_reset: '2026-10-01T00:00:00.000Z',
})

const whoamiResponse = () => ({
  organization_name: 'Acme',
  token_name: 'ci',
  token_preview: 'cwbl_…xyz',
})

type Case = {
  tool: string
  args: Record<string, unknown>
  method: keyof Omit<MockedCrawlbrulee, 'client'>
  valid: () => Record<string, unknown>
}

const cases: Case[] = [
  { tool: 'scrape', args: { url: 'https://example.com' }, method: 'scrape', valid: scrapeResponse },
  {
    tool: 'scrape_result',
    args: { job_id: 'job_1' },
    method: 'getScrapeResult',
    valid: scrapeResponse,
  },
  {
    tool: 'scrape_status',
    args: { job_id: 'job_1' },
    method: 'getScrapeStatus',
    valid: statusResponse,
  },
  {
    tool: 'scrape_async',
    args: { url: 'https://example.com' },
    method: 'scrapeAsync',
    valid: () => ({ job_id: 'job_1' }),
  },
  { tool: 'map', args: { url: 'https://example.com' }, method: 'map', valid: mapResponse },
  { tool: 'usage', args: {}, method: 'usage', valid: usageResponse },
  { tool: 'whoami', args: {}, method: 'whoami', valid: whoamiResponse },
]

describe('structured output tolerates api growth', () => {
  let h: Harness

  beforeEach(async () => {
    h = await setup()
  })

  describe.each(cases)('$tool', ({ tool, args, method, valid }) => {
    it('accepts a new top-level field', async () => {
      h.mock[method].mockResolvedValueOnce({ ...valid(), a_field_added_later: 404 })

      const res = await h.client.callTool({ name: tool, arguments: args })

      expect(res.isError).toBeFalsy()
      expect(res.structuredContent).toMatchObject({ a_field_added_later: 404 })
    })

    it('refuses a response that lacks a required field', async () => {
      const body = valid()
      const [firstKey] = Object.keys(body)
      delete body[firstKey as string]
      h.mock[method].mockResolvedValueOnce(body)

      // The server checks structured output against the same schema before it
      // sends anything, so the refusal arrives as a tool error, not a throw.
      const res = await h.client.callTool({ name: tool, arguments: args })

      expect(res.isError).toBe(true)
      expect(JSON.stringify(res.content)).toMatch(/output validation|invalid/i)
    })
  })

  it('accepts new fields inside nested objects (usage, pagination, truncation)', async () => {
    const body = mapResponse()
    Object.assign(body.response_meta.usage, { a_cost_added_later: 1 })
    Object.assign(body.response_meta.pagination, { cursor: 'x' })
    Object.assign(body.response_meta.truncation, { note: 'x' })
    h.mock.map.mockResolvedValueOnce(body)

    const res = await h.client.callTool({ name: 'map', arguments: { url: 'https://example.com' } })

    expect(res.isError).toBeFalsy()
  })

  it('accepts new fields on scrape usage, links, images and metadata', async () => {
    const body = {
      ...scrapeResponse(),
      page_status_code: 404,
      links: [{ text: 'a', href: 'https://example.com/a', internal: true, rel: 'nofollow' }],
      images: [{ url: 'https://example.com/i.png', alt: null, width: 10 }],
      metadata: { title: 'Example', og_video: 'x' },
      response_meta: { usage: { ...usage(), a_cost_added_later: 1 } },
    }
    h.mock.scrape.mockResolvedValueOnce(body)

    const res = await h.client.callTool({
      name: 'scrape',
      arguments: { url: 'https://example.com' },
    })

    expect(res.isError).toBeFalsy()
    expect(res.structuredContent).toMatchObject({ page_status_code: 404 })
  })

  it('accepts a proxy multiplier it does not know yet', async () => {
    h.mock.scrape.mockResolvedValueOnce({
      ...scrapeResponse(),
      response_meta: { usage: { ...usage(), proxy_multiplier: 3 } },
    })

    const res = await h.client.callTool({
      name: 'scrape',
      arguments: { url: 'https://example.com' },
    })

    expect(res.isError).toBeFalsy()
  })

  it('accepts enum values it does not know yet', async () => {
    h.mock.scrape.mockResolvedValueOnce({
      ...scrapeResponse(),
      response_meta: { usage: { ...usage(), engine: 'a-new-engine', proxy: 'a-new-tier' } },
    })
    h.mock.getScrapeStatus.mockResolvedValueOnce({ ...statusResponse(), status: 'a-new-state' })
    const map = mapResponse()
    map.response_meta.truncation.discovery_cap_reason = 'a-new-reason' as unknown as null
    h.mock.map.mockResolvedValueOnce(map)

    const results = await Promise.all([
      h.client.callTool({ name: 'scrape', arguments: { url: 'https://example.com' } }),
      h.client.callTool({ name: 'scrape_status', arguments: { job_id: 'job_1' } }),
      h.client.callTool({ name: 'map', arguments: { url: 'https://example.com' } }),
    ])

    for (const res of results) expect(res.isError).toBeFalsy()
  })

  it.each([
    ['scrape', 'scrape', { url: 'https://example.com' }],
    ['scrape_result', 'getScrapeResult', { job_id: 'job_1' }],
  ] as const)(
    '%s accepts elements values of a shape it does not know yet',
    async (tool, method, args) => {
      const body = {
        ...scrapeResponse(),
        markdown: '# Example',
        elements: {
          a: [null],
          price: 51.77,
          deep: { a: { b: { c: { d: 'past 3 levels' } } } },
        },
      }
      h.mock[method].mockResolvedValueOnce(body)

      const res = await h.client.callTool({ name: tool, arguments: args })

      expect(res.isError).toBeFalsy()
      expect(res.structuredContent).toEqual(body)
    }
  )

  it('accepts the screenshot_unavailable warning and the retired metadata_truncated', async () => {
    h.mock.scrape.mockResolvedValueOnce({
      ...scrapeResponse(),
      warnings: ['screenshot_unavailable', 'metadata_truncated'],
    })

    const res = await h.client.callTool({
      name: 'scrape',
      arguments: { url: 'https://example.com' },
    })

    expect(res.isError).toBeFalsy()
  })

  it('still rejects unknown keys in tool input', async () => {
    const res = await h.client.callTool({
      name: 'scrape',
      arguments: { url: 'https://example.com', extract: { markdwon: true } },
    })

    expect(res.isError).toBe(true)
  })
})

// A page the site served is a result, whatever its status: a 404 page comes back
// with its content and `page_status_code: 404`, not as a tool error.
describe('page is data', () => {
  let h: Harness

  beforeEach(async () => {
    h = await setup()
  })

  const notFoundPage = () => ({
    url: 'https://example.com/missing',
    requested_url: 'https://example.com/missing',
    page_status_code: 404,
    content_type: 'text/html',
    markdown: '# Page not found',
    metadata: { title: 'Page not found' },
    warnings: [],
    response_meta: {
      usage: {
        total_credit_cost: 15,
        engine_credit_cost: 3,
        proxy_multiplier: 5,
        screenshot_slicing_credit_cost: 0,
        engine: 'browser',
        proxy: 'advanced',
      },
    },
  })

  it.each([
    ['scrape', 'scrape', { url: 'https://example.com/missing' }],
    ['scrape_result', 'getScrapeResult', { job_id: 'job_1' }],
  ] as const)('%s returns a 404 page as a result', async (tool, method, args) => {
    const body = notFoundPage()
    h.mock[method].mockResolvedValueOnce(body)

    const res = await h.client.callTool({ name: tool, arguments: args })

    expect(res.isError).toBeFalsy()
    expect(res.structuredContent).toEqual(body)
  })

  it('returns an unbilled 5xx page with every cost part at 0', async () => {
    const body = {
      ...notFoundPage(),
      page_status_code: 503,
      response_meta: {
        usage: {
          total_credit_cost: 0,
          engine_credit_cost: 0,
          proxy_multiplier: 1,
          screenshot_slicing_credit_cost: 0,
          engine: 'http',
          proxy: 'basic',
        },
      },
    }
    h.mock.scrape.mockResolvedValueOnce(body)

    const res = await h.client.callTool({
      name: 'scrape',
      arguments: { url: 'https://example.com' },
    })

    expect(res.isError).toBeFalsy()
    expect(res.structuredContent).toMatchObject({ page_status_code: 503 })
  })

  it('returns the new usage fields on scrape_status and map', async () => {
    h.mock.getScrapeStatus.mockResolvedValueOnce({
      job_id: 'job_1',
      status: 'done',
      created_at: '2026-09-25T00:00:00.000Z',
      response_meta: { usage: usage() },
    })
    h.mock.map.mockResolvedValueOnce(mapResponse())

    const [status, map] = await Promise.all([
      h.client.callTool({ name: 'scrape_status', arguments: { job_id: 'job_1' } }),
      h.client.callTool({ name: 'map', arguments: { url: 'https://example.com' } }),
    ])

    expect(status.isError).toBeFalsy()
    expect(status.structuredContent).toMatchObject({
      response_meta: { usage: { total_credit_cost: 1, screenshot_slicing_credit_cost: 0 } },
    })
    expect(map.isError).toBeFalsy()
    expect(map.structuredContent).toMatchObject({
      response_meta: {
        usage: { total_credit_cost: 1, engine_credit_cost: 1, proxy_multiplier: 1 },
      },
    })
  })

  // An older api version sends no page_status_code and only the old usage names.
  it('accepts responses from an older api version', async () => {
    const oldScrape = {
      url: 'https://example.com/',
      requested_url: 'https://example.com',
      metadata: { title: 'Example' },
      response_meta: { usage: oldUsage() },
    }
    h.mock.scrape.mockResolvedValueOnce(oldScrape)
    h.mock.getScrapeResult.mockResolvedValueOnce(oldScrape)
    h.mock.getScrapeStatus.mockResolvedValueOnce({
      job_id: 'job_1',
      status: 'done',
      created_at: '2026-09-25T00:00:00.000Z',
      response_meta: { usage: oldUsage() },
    })
    const oldMap = mapResponse()
    oldMap.response_meta.usage = {
      credits: 1,
      engine: 'http',
      proxy: 'basic',
    } as unknown as ReturnType<typeof mapUsage>
    h.mock.map.mockResolvedValueOnce(oldMap)

    const results = await Promise.all([
      h.client.callTool({ name: 'scrape', arguments: { url: 'https://example.com' } }),
      h.client.callTool({ name: 'scrape_result', arguments: { job_id: 'job_1' } }),
      h.client.callTool({ name: 'scrape_status', arguments: { job_id: 'job_1' } }),
      h.client.callTool({ name: 'map', arguments: { url: 'https://example.com' } }),
    ])

    for (const res of results) expect(res.isError).toBeFalsy()
    expect(results[0]?.structuredContent).toEqual(oldScrape)
  })

  it('still accepts usage that carries the old names next to the new ones', async () => {
    const withOld = { ...usage(), credits: 1, screenshot_slices: 0 }
    const withOldMap = { ...mapUsage(), credits: 1 }
    h.mock.scrape.mockResolvedValueOnce({ ...scrapeResponse(), response_meta: { usage: withOld } })
    const laterMap = mapResponse()
    h.mock.map.mockResolvedValueOnce({
      ...laterMap,
      response_meta: { ...laterMap.response_meta, usage: withOldMap },
    })

    const results = await Promise.all([
      h.client.callTool({ name: 'scrape', arguments: { url: 'https://example.com' } }),
      h.client.callTool({ name: 'map', arguments: { url: 'https://example.com' } }),
    ])

    for (const res of results) expect(res.isError).toBeFalsy()
    expect(results[0]?.structuredContent).toEqual({
      ...scrapeResponse(),
      response_meta: { usage: withOld },
    })
  })

  it('documents page_status_code and the new usage fields in the output schemas', async () => {
    const { tools } = await h.client.listTools()
    const byName = Object.fromEntries(tools.map(t => [t.name, t]))

    for (const name of ['scrape', 'scrape_result']) {
      const schema = byName[name]?.outputSchema as {
        properties: Record<string, { description?: string }>
        required?: string[]
      }
      expect(schema.properties.page_status_code?.description).toMatch(/404/)
      // Optional, so a response from an older api version still validates.
      expect(schema.required ?? []).not.toContain('page_status_code')
    }

    const text = JSON.stringify(byName.scrape?.outputSchema)
    for (const field of [
      'total_credit_cost',
      'engine_credit_cost',
      'proxy_multiplier',
      'screenshot_slicing_credit_cost',
      'zero_data_retention_credit_cost',
    ]) {
      expect(text).toContain(field)
    }
    expect(JSON.stringify(byName.map?.outputSchema)).toContain('total_credit_cost')
    expect(JSON.stringify(byName.map?.outputSchema)).toContain('zero_data_retention_credit_cost')
    expect(JSON.stringify(byName.map?.outputSchema)).not.toContain('screenshot_slicing_credit_cost')
  })

  it('no longer documents credits and screenshot_slices in the output schemas', async () => {
    const { tools } = await h.client.listTools()
    for (const name of ['scrape', 'scrape_result', 'scrape_status', 'scrape_async', 'map']) {
      const text = JSON.stringify(tools.find(t => t.name === name)?.outputSchema ?? {})
      expect(text).not.toContain('"credits"')
      expect(text).not.toContain('screenshot_slices')
    }
  })

  it('tells agents in the tool descriptions to check page_status_code', async () => {
    const { tools } = await h.client.listTools()
    for (const name of ['scrape', 'scrape_result']) {
      expect(tools.find(t => t.name === name)?.description).toContain('page_status_code')
    }
  })
})
