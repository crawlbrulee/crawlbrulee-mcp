import { Client } from '@modelcontextprotocol/sdk/client/index.js'
import { InMemoryTransport } from '@modelcontextprotocol/sdk/inMemory.js'
import { beforeEach, describe, expect, it } from 'vitest'

import { Schema_ApiScrapeSuccessResponse } from '../src/schemas/ApiScrapeResponse.js'
import { buildServer } from '../src/server.js'
import { makeMockedClient, type MockedCrawlbrulee } from './helpers/mockClient.js'

// `extract.elements`: named values read from the page by CSS selector. The
// server checks every result against the advertised output schema before it
// sends it, so a schema narrower than what the api returns would break real
// calls. The client only validates after it has listed the tools, exactly as a
// real host does, so the harness lists them first.

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

const DOCS_URL = 'https://crawlbrulee.com/docs/scrape/elements'

const booksRequest = () => ({
  url: 'https://books.toscrape.com/',
  extract: {
    elements: {
      heading: 'h1',
      books: {
        selector: 'article.product_pod',
        all: true,
        fields: {
          title: { selector: 'h3 a', output: 'attribute', attribute: 'title' },
          price: '.price_color',
          url: { selector: 'h3 a', output: 'attribute', attribute: 'href' },
        },
      },
      next_page: { selector: 'li.next a', output: 'attribute', attribute: 'href' },
    },
  },
})

const usage = () => ({
  total_credit_cost: 1,
  engine_credit_cost: 1,
  proxy_multiplier: 1,
  screenshot_slicing_credit_cost: 0,
  zero_data_retention_credit_cost: 0,
  engine: 'http',
  proxy: 'basic',
})

const booksResponse = () => ({
  url: 'https://books.toscrape.com/',
  requested_url: 'https://books.toscrape.com/',
  page_status_code: 200,
  content_type: 'text/html',
  metadata: { title: 'All products | Books to Scrape - Sandbox' },
  elements: {
    heading: 'All products',
    books: [
      {
        title: 'A Light in the Attic',
        price: '£51.77',
        url: 'https://books.toscrape.com/catalogue/a-light-in-the-attic_1000/index.html',
      },
      {
        title: 'Tipping the Velvet',
        price: '£53.74',
        url: 'https://books.toscrape.com/catalogue/tipping-the-velvet_999/index.html',
      },
      {
        title: 'Soumission',
        price: '£50.10',
        url: 'https://books.toscrape.com/catalogue/soumission_998/index.html',
      },
    ],
    next_page: 'https://books.toscrape.com/catalogue/page-2.html',
  },
  warnings: [],
  response_meta: { usage: usage() },
})

// Every kind of value at once: strings, null, an empty list, a list of strings,
// and objects nested the full 3 levels of `fields`, with nulls and lists inside.
const nestedElements = () => ({
  title: 'Shop',
  missing: null,
  no_matches: [],
  tags: ['new', 'sale'],
  html: '<h1 class="x">Shop</h1>',
  first_category: {
    name: 'Shoes',
    banner: null,
    products: [
      {
        name: 'Runner',
        variants: [
          { size: '42', stock: null, badges: ['eco'] },
          { size: '43', stock: 'in stock', badges: [] },
        ],
      },
    ],
  },
  categories: [
    {
      name: 'Shoes',
      products: [{ name: 'Runner', variants: [{ size: '42', colors: ['red', 'blue'] }] }],
    },
    { name: 'Bags', products: [] },
  ],
})

describe('extract.elements', () => {
  let h: Harness

  beforeEach(async () => {
    h = await setup()
  })

  describe('tool discovery', () => {
    it('lists extract.elements in the scrape and scrape_async input schemas', async () => {
      const { tools } = await h.client.listTools()
      for (const name of ['scrape', 'scrape_async']) {
        const props = tools.find(t => t.name === name)?.inputSchema.properties as Record<
          string,
          { properties?: Record<string, { description?: string }> }
        >
        const elements = props.extract?.properties?.elements
        expect(elements?.description).toContain(DOCS_URL)
        expect(elements?.description).toMatch(/no extra credits/i)
      }
    })

    it('documents elements in the scrape and scrape_result output schemas', async () => {
      const { tools } = await h.client.listTools()
      for (const name of ['scrape', 'scrape_result']) {
        const schema = tools.find(t => t.name === name)?.outputSchema as {
          properties: Record<string, { description?: string }>
          required?: string[]
        }
        expect(schema.properties.elements?.description).toContain('extract.elements')
        expect(schema.required ?? []).not.toContain('elements')
        expect(schema.properties.warnings?.description).toContain('elements_truncated')
      }
    })

    it('tells agents when to use elements, that it is free, and where the rules are', async () => {
      const { tools } = await h.client.listTools()
      for (const name of ['scrape', 'scrape_async']) {
        const description = tools.find(t => t.name === name)?.description ?? ''
        expect(description).toContain('extract.elements')
        expect(description).toMatch(/no extra credits/i)
        expect(description).toContain(DOCS_URL)
      }
      expect(tools.find(t => t.name === 'scrape_result')?.description).toContain('`elements`')
    })

    it('keeps the input schema a plain tree, so every host can read it', async () => {
      const { tools } = await h.client.listTools()
      const text = JSON.stringify(tools.find(t => t.name === 'scrape')?.inputSchema)
      expect(text).not.toContain('$ref')
    })
  })

  describe('scrape', () => {
    it('forwards elements to the sdk and returns the books example', async () => {
      const body = booksResponse()
      h.mock.scrape.mockResolvedValueOnce(body)

      const res = await h.client.callTool({ name: 'scrape', arguments: booksRequest() })

      expect(res.isError).toBeFalsy()
      expect(h.mock.scrape.mock.calls[0]?.[0]).toMatchObject(booksRequest())
      expect(res.structuredContent).toEqual(body)
    })

    it('accepts every kind of value, nested 3 levels', async () => {
      const body = { ...booksResponse(), elements: nestedElements() }
      h.mock.scrape.mockResolvedValueOnce(body)

      const res = await h.client.callTool({
        name: 'scrape',
        arguments: { url: 'https://example.com', extract: { elements: { title: 'h1' } } },
      })

      expect(res.isError).toBeFalsy()
      expect(res.structuredContent).toMatchObject({ elements: nestedElements() })
    })

    it('accepts the elements_truncated warning', async () => {
      const body = {
        ...booksResponse(),
        elements: { books: [], big: null },
        warnings: ['elements_truncated'],
      }
      h.mock.scrape.mockResolvedValueOnce(body)

      const res = await h.client.callTool({
        name: 'scrape',
        arguments: { url: 'https://example.com', extract: { elements: { big: 'main' } } },
      })

      expect(res.isError).toBeFalsy()
      expect(res.structuredContent).toEqual(body)
    })

    // Only JSON, plain text, XML and markdown pages list `elements` as unsupported.
    // A PDF or an image is refused by the api (415), so it never gets here. A JSON
    // page has no metadata either, and `metadata` is on by default, so it is listed too.
    it('returns unsupported_fields for a JSON page', async () => {
      const body = {
        url: 'https://example.com/data.json',
        requested_url: 'https://example.com/data.json',
        page_status_code: 200,
        content_type: 'application/json',
        unsupported_fields: ['metadata', 'elements'],
        cleaned_html: '{"price":"£51.77"}',
        warnings: [],
        response_meta: { usage: usage() },
      }
      h.mock.scrape.mockResolvedValueOnce(body)

      const res = await h.client.callTool({
        name: 'scrape',
        arguments: { url: 'https://example.com/data.json', extract: { elements: { big: 'main' } } },
      })

      expect(res.isError).toBeFalsy()
      expect(res.structuredContent).toEqual(body)
      expect(res.structuredContent).not.toHaveProperty('metadata')
      expect(res.structuredContent).not.toHaveProperty('elements')
    })

    it('accepts a request nested the full 3 levels of fields', async () => {
      h.mock.scrape.mockResolvedValueOnce(booksResponse())

      const res = await h.client.callTool({
        name: 'scrape',
        arguments: {
          url: 'https://example.com',
          extract: {
            elements: {
              categories: {
                selector: '.category',
                all: true,
                fields: {
                  products: {
                    selector: '.product',
                    all: true,
                    fields: {
                      variants: {
                        selector: '.variant',
                        all: true,
                        fields: { size: '.size', image: { selector: 'img', output: 'html' } },
                      },
                    },
                  },
                },
              },
            },
          },
        },
      })

      expect(res.isError).toBeFalsy()
    })
  })

  describe('scrape_async and scrape_result', () => {
    it('scrape_async forwards elements to the sdk', async () => {
      h.mock.scrapeAsync.mockResolvedValueOnce({ job_id: 'job_1' })

      const res = await h.client.callTool({ name: 'scrape_async', arguments: booksRequest() })

      expect(res.isError).toBeFalsy()
      expect(h.mock.scrapeAsync.mock.calls[0]?.[0]).toMatchObject(booksRequest())
    })

    it('scrape_result returns elements, nested 3 levels, with the truncation warning', async () => {
      const body = {
        ...booksResponse(),
        elements: nestedElements(),
        warnings: ['elements_truncated'],
      }
      h.mock.getScrapeResult.mockResolvedValueOnce(body)

      const res = await h.client.callTool({ name: 'scrape_result', arguments: { job_id: 'job_1' } })

      expect(res.isError).toBeFalsy()
      expect(res.structuredContent).toEqual(body)
    })
  })

  describe('output schema', () => {
    it('parses the books example and every kind of value', () => {
      expect(Schema_ApiScrapeSuccessResponse.safeParse(booksResponse()).success).toBe(true)
      expect(
        Schema_ApiScrapeSuccessResponse.safeParse({
          ...booksResponse(),
          elements: nestedElements(),
        }).success
      ).toBe(true)
    })

    // The value shape is documented, not enforced: one value the schema does not
    // expect must not fail the whole result.
    it('accepts values of a shape it does not know yet', () => {
      for (const elements of [
        { price: 51.77 },
        { a: [null] },
        { flag: true, list: [[1, 2]] },
        { deep: { a: { b: { c: { d: { e: 'past 3 levels' } } } } } },
      ]) {
        const parsed = Schema_ApiScrapeSuccessResponse.safeParse({ ...booksResponse(), elements })
        expect(parsed.success).toBe(true)
      }
    })

    it('still refuses elements that is not keyed by name', () => {
      for (const elements of [['h1'], 'h1']) {
        const parsed = Schema_ApiScrapeSuccessResponse.safeParse({ ...booksResponse(), elements })
        expect(parsed.success).toBe(false)
      }
    })
  })

  describe('input checks', () => {
    const call = (elements: unknown) =>
      h.client.callTool({
        name: 'scrape',
        arguments: { url: 'https://example.com', extract: { elements } },
      })

    it('refuses fields combined with output', async () => {
      const res = await call({ x: { selector: 'a', output: 'html', fields: { y: 'b' } } })
      expect(res.isError).toBe(true)
      expect(JSON.stringify(res.content)).toContain('fields cannot be combined')
    })

    it('refuses output attribute without an attribute name', async () => {
      const res = await call({ x: { selector: 'a', output: 'attribute' } })
      expect(res.isError).toBe(true)
      expect(JSON.stringify(res.content)).toContain('attribute is required')
    })

    it('refuses an unknown key in a spec', async () => {
      const res = await call({ x: { selector: 'a', multiple: true } })
      expect(res.isError).toBe(true)
    })

    it('refuses fields nested deeper than 3 levels', async () => {
      const res = await call({
        a: {
          selector: '.a',
          fields: {
            b: {
              selector: '.b',
              fields: {
                c: { selector: '.c', fields: { d: { selector: '.d', fields: { e: '.e' } } } },
              },
            },
          },
        },
      })
      expect(res.isError).toBe(true)
      expect(h.mock.scrape).not.toHaveBeenCalled()
    })

    it('refuses a selector longer than 500 characters', async () => {
      const res = await call({ x: 'a'.repeat(501) })
      expect(res.isError).toBe(true)
      expect(h.mock.scrape).not.toHaveBeenCalled()
    })
  })
})
