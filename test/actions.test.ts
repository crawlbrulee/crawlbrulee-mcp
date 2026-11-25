import { Client } from '@modelcontextprotocol/sdk/client/index.js'
import { InMemoryTransport } from '@modelcontextprotocol/sdk/inMemory.js'
import { beforeEach, describe, expect, it } from 'vitest'

import { buildServer } from '../src/server.js'
import { makeMockedClient, type MockedCrawlbrulee } from './helpers/mockClient.js'

// `actions` does things on the page before it is read. The scrape tools take the
// list as it is, check what is cheap to check, send it to the sdk unchanged, and
// return the `actions` report. `extract.screenshot.actions_before` is gone. The
// client lists the tools first, as a real host does, so every result is checked
// against the advertised output schema.

// The parts of a tool's JSON schema these tests read.
interface ActionsJsonSchema {
  description?: string
  maxItems?: number
  items: {
    anyOf?: Array<{ properties: { type: { const: string } } }>
    oneOf?: Array<{ properties: { type: { const: string } } }>
  }
}
type ToolJsonSchema = { properties: Record<string, { description?: string } | undefined> }

const actionsOf = (schema: unknown) =>
  (schema as { properties: { actions: ActionsJsonSchema } }).properties.actions

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

const EVERY_ACTION = [
  { type: 'wait', ms: 500 },
  { type: 'scroll', pixels: 800 },
  { type: 'scroll', to: 'bottom', duration_ms: 2000 },
  { type: 'wait_for', selector: '.product' },
  { type: 'hover', selector: '#menu' },
  { type: 'hover', x: 10, y: 20 },
  { type: 'click', selector: '#load-more', optional: true },
]

const actionsResponse = (report: Array<Record<string, unknown>>, warnings?: string[]) => ({
  url: 'https://example.com/',
  requested_url: 'https://example.com',
  page_status_code: 200,
  markdown: '# Example',
  actions: report,
  ...(warnings ? { warnings } : {}),
  response_meta: {
    usage: {
      total_credit_cost: 3,
      engine_credit_cost: 3,
      proxy_multiplier: 1,
      screenshot_slicing_credit_cost: 0,
      zero_data_retention_credit_cost: 0,
      engine: 'browser',
      proxy: 'basic',
    },
  },
})

describe('actions', () => {
  let h: Harness

  beforeEach(async () => {
    h = await setup()
  })

  describe('tool discovery', () => {
    it('lists actions on scrape and scrape_async with exactly the five types', async () => {
      const { tools } = await h.client.listTools()
      for (const name of ['scrape', 'scrape_async']) {
        const actions = actionsOf(tools.find(t => t.name === name)?.inputSchema)
        const members = actions.items.anyOf ?? actions.items.oneOf ?? []
        const types = members.map(member => member.properties.type.const).sort()
        expect(types).toEqual(['click', 'hover', 'scroll', 'wait', 'wait_for'])
        expect(actions.maxItems).toBe(12)
      }
    })

    it('says what the actions do and when not to use them', async () => {
      const { tools } = await h.client.listTools()
      const scrape = tools.find(t => t.name === 'scrape')!
      const actionsText = actionsOf(scrape.inputSchema).description
      for (const text of [scrape.description ?? '', actionsText ?? '']) {
        expect(text).toContain('actions_incomplete')
        expect(text).toContain('must happen only once')
        expect(text).toContain('directly instead of clicking')
      }
      expect(scrape.description).toContain('scrape_async')
      // Forms are the http api's: this server offers only the five reading actions.
      for (const text of [scrape.description ?? '', actionsText ?? '']) {
        expect(text).toContain('call the HTTP API')
      }
    })

    it('offers no actions_before on the screenshot', async () => {
      const { tools } = await h.client.listTools()
      for (const name of ['scrape', 'scrape_async']) {
        expect(JSON.stringify(tools.find(t => t.name === name)?.inputSchema)).not.toContain(
          'actions_before'
        )
      }
    })

    it('names the report statuses and the warning in the output schema', async () => {
      const { tools } = await h.client.listTools()
      for (const name of ['scrape', 'scrape_result']) {
        const schema = tools.find(t => t.name === name)?.outputSchema as ToolJsonSchema
        const text = JSON.stringify(schema.properties.actions)
        for (const status of ['ok', 'failed', 'skipped', 'not_run']) {
          expect(text).toContain(`"${status}"`)
        }
        expect(schema.properties.warnings?.description).toContain('actions_incomplete')
      }
    })
  })

  describe('forwarding', () => {
    it('sends every action type to the sdk unchanged', async () => {
      h.mock.scrape.mockResolvedValueOnce(actionsResponse([]))

      const res = await h.client.callTool({
        name: 'scrape',
        arguments: { url: 'https://example.com', actions: EVERY_ACTION },
      })

      expect(res.isError).toBeFalsy()
      expect(h.mock.scrape.mock.calls[0]?.[0].actions).toEqual(EVERY_ACTION)
    })

    it('scrape_async sends them too', async () => {
      h.mock.scrapeAsync.mockResolvedValueOnce({ job_id: 'job-1' })

      const res = await h.client.callTool({
        name: 'scrape_async',
        arguments: { url: 'https://example.com', actions: [{ type: 'wait', ms: 1000 }] },
      })

      expect(res.isError).toBeFalsy()
      expect(h.mock.scrapeAsync.mock.calls[0]?.[0].actions).toEqual([{ type: 'wait', ms: 1000 }])
    })

    it('sends no actions when the input leaves them out', async () => {
      h.mock.scrape.mockResolvedValueOnce(actionsResponse([]))

      await h.client.callTool({ name: 'scrape', arguments: { url: 'https://example.com' } })

      expect(h.mock.scrape.mock.calls[0]?.[0]).not.toHaveProperty('actions')
    })

    it('returns the report and the warning as the api sent them', async () => {
      const body = actionsResponse(
        [
          { type: 'click', status: 'ok' },
          { type: 'wait_for', status: 'failed' },
          { type: 'wait', status: 'not_run' },
        ],
        ['actions_incomplete']
      )
      h.mock.getScrapeResult.mockResolvedValueOnce(body)

      const res = await h.client.callTool({ name: 'scrape_result', arguments: { job_id: 'job-1' } })

      expect(res.isError).toBeFalsy()
      expect(res.structuredContent).toEqual(body)
    })

    it('accepts a status or a field the api adds later', async () => {
      const body = actionsResponse([{ type: 'click', status: 'partly', note: 'x' }])
      h.mock.scrape.mockResolvedValueOnce(body)

      const res = await h.client.callTool({
        name: 'scrape',
        arguments: { url: 'https://example.com', actions: [{ type: 'click', selector: '#a' }] },
      })

      expect(res.isError).toBeFalsy()
      expect(res.structuredContent).toEqual(body)
    })
  })

  describe('input checks', () => {
    const call = (actions: unknown, extract?: Record<string, unknown>) =>
      h.client.callTool({
        name: 'scrape',
        arguments: { url: 'https://example.com', actions, ...(extract ? { extract } : {}) },
      })

    it.each([
      ['type', { type: 'type', selector: '#q', text: 'shoes' }],
      ['select', { type: 'select', selector: '#size', value: '42' }],
    ])('refuses a %s action, naming the types it takes', async (_label, action) => {
      const res = await call([action])
      expect(res.isError).toBe(true)
      expect(JSON.stringify(res.content)).toContain(
        'unknown action type; use one of wait, scroll, wait_for, hover, click'
      )
      expect(h.mock.scrape).not.toHaveBeenCalled()
    })

    it.each([
      ['more than 12 actions', Array.from({ length: 13 }, () => ({ type: 'wait', ms: 1 }))],
      [
        'waits over 60 seconds',
        [
          { type: 'wait', ms: 40_000 },
          { type: 'wait', ms: 20_001 },
        ],
      ],
      ['a scroll with both pixels and to', [{ type: 'scroll', pixels: 1, to: 'bottom' }]],
      ['a scroll with neither', [{ type: 'scroll' }]],
      ['a hover with a selector and a point', [{ type: 'hover', selector: '#a', x: 1, y: 1 }]],
      ['a hover with only x', [{ type: 'hover', x: 1 }]],
      ['an unknown key', [{ type: 'click', selector: '#a', force: true }]],
      ['a click without a selector', [{ type: 'click' }]],
    ])('refuses %s', async (_label, actions) => {
      const res = await call(actions)
      expect(res.isError).toBe(true)
      expect(h.mock.scrape).not.toHaveBeenCalled()
    })

    it('refuses extract.screenshot.actions_before', async () => {
      const res = await call(undefined, {
        screenshot: { type: 'viewport', actions_before: [{ type: 'wait', ms: 1000 }] },
      })
      expect(res.isError).toBe(true)
      expect(JSON.stringify(res.content)).toContain('actions_before')
      expect(h.mock.scrape).not.toHaveBeenCalled()
    })

    it('still takes the screenshot slices in actions_after', async () => {
      h.mock.scrape.mockResolvedValueOnce(actionsResponse([]))

      const res = await call(undefined, {
        screenshot: { type: 'full_page', actions_after: [{ type: 'slice', height: 1000 }] },
      })

      expect(res.isError).toBeFalsy()
      expect(h.mock.scrape.mock.calls[0]?.[0].extract.screenshot.actions_after).toEqual([
        { type: 'slice', height: 1000 },
      ])
    })
  })
})
