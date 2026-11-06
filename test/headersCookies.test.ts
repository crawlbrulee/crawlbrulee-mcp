import { Client } from '@modelcontextprotocol/sdk/client/index.js'
import { InMemoryTransport } from '@modelcontextprotocol/sdk/inMemory.js'
import { beforeEach, describe, expect, it } from 'vitest'

import { buildServer } from '../src/server.js'
import { makeMockedClient, type MockedCrawlbrulee } from './helpers/mockClient.js'

// `headers` and `cookies`: your own headers and cookies, sent to the site. The
// tools must pass them to the sdk unchanged, and must not add them when the
// input leaves them out. The client lists the tools first, as a real host does,
// so the server checks every result against the advertised output schema.

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

const DOCS_URL = 'https://crawlbrulee.com/docs/scrape/custom-headers-and-cookies'

const loginRequest = () => ({
  url: 'https://app.example.com/orders',
  headers: { Authorization: 'Bearer abc', 'X-Tenant-Id': 'acme' },
  cookies: [{ name: 'session_id', value: 'a1b2c3' }],
})

const pageResponse = () => ({
  url: 'https://app.example.com/orders',
  requested_url: 'https://app.example.com/orders',
  page_status_code: 200,
  content_type: 'text/html',
  metadata: { title: 'Orders' },
  response_meta: {
    usage: {
      total_credit_cost: 1,
      engine_credit_cost: 1,
      proxy_multiplier: 1,
      screenshot_slicing_credit_cost: 0,
      zero_data_retention_credit_cost: 0,
      engine: 'http',
      proxy: 'basic',
    },
  },
})

describe('headers and cookies', () => {
  let h: Harness

  beforeEach(async () => {
    h = await setup()
  })

  describe('tool discovery', () => {
    it('lists headers and cookies, with the chat note, on scrape and scrape_async', async () => {
      const { tools } = await h.client.listTools()
      for (const name of ['scrape', 'scrape_async']) {
        const props = tools.find(t => t.name === name)?.inputSchema.properties as Record<
          string,
          { description?: string }
        >
        for (const field of ['headers', 'cookies']) {
          const description = props[field]?.description ?? ''
          expect(description).toContain('pass through the chat with the AI')
          expect(description).toContain('short-lived tokens or a test account')
          expect(description).toContain(DOCS_URL)
        }
        const description = tools.find(t => t.name === name)?.description ?? ''
        expect(description).toContain('`headers`')
        expect(description).toContain('`cookies`')
        expect(description).toContain('pass through the chat with the AI')
      }
    })

    it('does not offer headers or cookies on map', async () => {
      const { tools } = await h.client.listTools()
      const props = tools.find(t => t.name === 'map')?.inputSchema.properties ?? {}
      expect(props).not.toHaveProperty('headers')
      expect(props).not.toHaveProperty('cookies')
    })

    it('names custom_user_agent in the scrape description and output schemas', async () => {
      const { tools } = await h.client.listTools()
      expect(tools.find(t => t.name === 'scrape')?.description).toContain('custom_user_agent')
      for (const name of ['scrape', 'scrape_result']) {
        const schema = tools.find(t => t.name === name)?.outputSchema as {
          properties: Record<string, { description?: string }>
        }
        expect(schema.properties.warnings?.description).toContain('custom_user_agent')
      }
    })
  })

  describe('forwarding', () => {
    it('scrape forwards headers and cookies to the sdk', async () => {
      h.mock.scrape.mockResolvedValueOnce(pageResponse())

      const res = await h.client.callTool({ name: 'scrape', arguments: loginRequest() })

      expect(res.isError).toBeFalsy()
      expect(h.mock.scrape.mock.calls[0]?.[0]).toMatchObject(loginRequest())
    })

    it('scrape_async forwards headers and cookies to the sdk', async () => {
      h.mock.scrapeAsync.mockResolvedValueOnce({ job_id: 'job-1' })

      const res = await h.client.callTool({ name: 'scrape_async', arguments: loginRequest() })

      expect(res.isError).toBeFalsy()
      expect(h.mock.scrapeAsync.mock.calls[0]?.[0]).toMatchObject(loginRequest())
    })

    it('sends neither field when the input leaves them out', async () => {
      h.mock.scrape.mockResolvedValueOnce(pageResponse())
      h.mock.scrapeAsync.mockResolvedValueOnce({ job_id: 'job-1' })

      await h.client.callTool({ name: 'scrape', arguments: { url: 'https://example.com' } })
      await h.client.callTool({ name: 'scrape_async', arguments: { url: 'https://example.com' } })

      for (const sent of [
        h.mock.scrape.mock.calls[0]?.[0],
        h.mock.scrapeAsync.mock.calls[0]?.[0],
      ]) {
        expect(sent).toBeDefined()
        expect(sent).not.toHaveProperty('headers')
        expect(sent).not.toHaveProperty('cookies')
      }
    })
  })

  describe('input checks', () => {
    const call = (args: Record<string, unknown>) =>
      h.client.callTool({ name: 'scrape', arguments: { url: 'https://example.com', ...args } })

    it('refuses more than 20 cookies', async () => {
      const cookies = Array.from({ length: 21 }, (_, i) => ({ name: `c${i}`, value: 'v' }))
      const res = await call({ cookies })
      expect(res.isError).toBe(true)
      expect(h.mock.scrape).not.toHaveBeenCalled()
    })

    it('refuses a cookie with an empty name', async () => {
      const res = await call({ cookies: [{ name: '', value: 'v' }] })
      expect(res.isError).toBe(true)
      expect(h.mock.scrape).not.toHaveBeenCalled()
    })

    it('refuses an unknown key in a cookie', async () => {
      const res = await call({ cookies: [{ name: 'a', value: 'v', domain: 'example.com' }] })
      expect(res.isError).toBe(true)
      expect(h.mock.scrape).not.toHaveBeenCalled()
    })

    it('refuses a header value that is not a string', async () => {
      const res = await call({ headers: { 'X-Count': 3 } })
      expect(res.isError).toBe(true)
      expect(h.mock.scrape).not.toHaveBeenCalled()
    })
  })
})
