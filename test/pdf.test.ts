import { Client } from '@modelcontextprotocol/sdk/client/index.js'
import { InMemoryTransport } from '@modelcontextprotocol/sdk/inMemory.js'
import { CrawlbruleeError, type ApiErrorName } from '@crawlbrulee/sdk'
import { beforeEach, describe, expect, it } from 'vitest'

import { buildServer } from '../src/server.js'
import { makeMockedClient, type MockedCrawlbrulee } from './helpers/mockClient.js'

// `extract.pdf` saves the page as a PDF, and `extract.screenshot.color_scheme` asks
// the site for its dark theme. The tools pass both to the sdk, fill in only the
// defaults the api documents, and return the `pdf` block. The client lists the
// tools first, as a real host does, so every result is checked against the
// advertised output schema.

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

const pdfResponse = () => ({
  url: 'https://example.com/',
  requested_url: 'https://example.com',
  page_status_code: 200,
  content_type: 'text/html',
  pdf: { url: 'https://cdn.example.com/pdf/abc.pdf?token=t', bytes: 48213 },
  response_meta: {
    usage: {
      total_credit_cost: 5,
      engine_credit_cost: 5,
      proxy_multiplier: 1,
      screenshot_slicing_credit_cost: 0,
      zero_data_retention_credit_cost: 0,
      engine: 'screenshot',
      proxy: 'basic',
    },
  },
})

const pdfOnly = (pdf: Record<string, unknown>) => ({
  url: 'https://example.com',
  extract: { markdown: false, metadata: false, pdf },
})

describe('pdf and color scheme', () => {
  let h: Harness

  beforeEach(async () => {
    h = await setup()
  })

  describe('tool discovery', () => {
    it('lists extract.pdf on scrape and scrape_async, with its options', async () => {
      const { tools } = await h.client.listTools()
      for (const name of ['scrape', 'scrape_async']) {
        const text = JSON.stringify(tools.find(t => t.name === name)?.inputSchema)
        for (const word of [
          'single_page',
          'letter',
          'landscape',
          'print',
          'unsupported_pdf_output',
        ]) {
          expect(text).toContain(word)
        }
      }
    })

    it('lists screenshot.color_scheme with light and dark', async () => {
      const { tools } = await h.client.listTools()
      const text = JSON.stringify(tools.find(t => t.name === 'scrape')?.inputSchema)
      expect(text).toContain('color_scheme')
      expect(text).toContain('"dark"')
    })

    it('names the pdf and dark theme in the scrape description', async () => {
      const { tools } = await h.client.listTools()
      const description = tools.find(t => t.name === 'scrape')?.description ?? ''
      expect(description).toContain('`extract.pdf: {}`')
      expect(description).toContain('color_scheme: "dark"')
      expect(description).toContain('pdf_unavailable')
      expect(description).toContain('pdf_single_page_overflow')
    })

    it('documents pdf and the new warnings in the output schemas', async () => {
      const { tools } = await h.client.listTools()
      for (const name of ['scrape', 'scrape_result']) {
        const schema = tools.find(t => t.name === name)?.outputSchema as {
          properties: Record<string, { description?: string }>
          required?: string[]
        }
        expect(schema.properties.pdf?.description).toContain('extract.pdf')
        expect(schema.required ?? []).not.toContain('pdf')
        expect(schema.properties.warnings?.description).toContain('pdf_unavailable')
        expect(schema.properties.warnings?.description).toContain('pdf_single_page_overflow')
      }
    })
  })

  describe('forwarding', () => {
    it('fills in the documented defaults for an empty pdf object', async () => {
      h.mock.scrape.mockResolvedValueOnce(pdfResponse())

      const res = await h.client.callTool({ name: 'scrape', arguments: pdfOnly({}) })

      expect(res.isError).toBeFalsy()
      const sent = h.mock.scrape.mock.calls[0]?.[0]
      expect(sent.extract.pdf).toEqual({ layout: 'pages', media: 'screen' })
      expect(sent.extract).toMatchObject({ markdown: false, metadata: false })
    })

    it('passes every pdf option through unchanged', async () => {
      h.mock.scrape.mockResolvedValueOnce(pdfResponse())
      const pdf = { layout: 'pages', paper: 'letter', landscape: true, media: 'print' }

      const res = await h.client.callTool({ name: 'scrape', arguments: pdfOnly(pdf) })

      expect(res.isError).toBeFalsy()
      expect(h.mock.scrape.mock.calls[0]?.[0].extract.pdf).toEqual(pdf)
    })

    it('scrape_async forwards the pdf too', async () => {
      h.mock.scrapeAsync.mockResolvedValueOnce({ job_id: 'job-1' })

      const res = await h.client.callTool({
        name: 'scrape_async',
        arguments: pdfOnly({ layout: 'single_page' }),
      })

      expect(res.isError).toBeFalsy()
      expect(h.mock.scrapeAsync.mock.calls[0]?.[0].extract.pdf).toEqual({
        layout: 'single_page',
        media: 'screen',
      })
    })

    it('passes color_scheme dark on the screenshot', async () => {
      h.mock.scrape.mockResolvedValueOnce(pdfResponse())

      await h.client.callTool({
        name: 'scrape',
        arguments: {
          url: 'https://example.com',
          extract: { screenshot: { type: 'viewport', color_scheme: 'dark' }, pdf: {} },
        },
      })

      expect(h.mock.scrape.mock.calls[0]?.[0].extract.screenshot).toMatchObject({
        type: 'viewport',
        color_scheme: 'dark',
      })
    })

    it('sends no color_scheme and no pdf when the input leaves them out', async () => {
      h.mock.scrape.mockResolvedValueOnce(pdfResponse())

      await h.client.callTool({
        name: 'scrape',
        arguments: { url: 'https://example.com', extract: { screenshot: { type: 'viewport' } } },
      })

      const sent = h.mock.scrape.mock.calls[0]?.[0]
      expect(sent.extract).not.toHaveProperty('pdf')
      expect(sent.extract.screenshot).not.toHaveProperty('color_scheme')
    })

    it('returns the pdf block as the api sent it', async () => {
      h.mock.scrape.mockResolvedValueOnce(pdfResponse())

      const res = await h.client.callTool({ name: 'scrape', arguments: pdfOnly({}) })

      expect(res.isError).toBeFalsy()
      expect(res.structuredContent).toEqual(pdfResponse())
    })

    it('returns a result with the pdf_unavailable warning and no pdf', async () => {
      const { pdf: _pdf, ...rest } = pdfResponse()
      const body = { ...rest, markdown: '# Example', warnings: ['pdf_unavailable'] }
      h.mock.getScrapeResult.mockResolvedValueOnce(body)

      const res = await h.client.callTool({ name: 'scrape_result', arguments: { job_id: 'job-1' } })

      expect(res.isError).toBeFalsy()
      expect(res.structuredContent).toEqual(body)
    })
  })

  describe('input checks', () => {
    const call = (pdf: Record<string, unknown>) =>
      h.client.callTool({ name: 'scrape', arguments: pdfOnly(pdf) })

    it.each([
      ['paper', { layout: 'single_page', paper: 'a4' }],
      ['landscape', { layout: 'single_page', landscape: false }],
    ])('refuses %s with layout single_page', async (field, pdf) => {
      const res = await call(pdf)
      expect(res.isError).toBe(true)
      expect(JSON.stringify(res.content)).toContain(field)
      expect(h.mock.scrape).not.toHaveBeenCalled()
    })

    it.each([
      ['an unknown layout', { layout: 'booklet' }],
      ['an unknown paper size', { paper: 'a3' }],
      ['an unknown media', { media: 'tv' }],
      ['an unknown key', { scale: 2 }],
    ])('refuses %s', async (_label, pdf) => {
      const res = await call(pdf)
      expect(res.isError).toBe(true)
      expect(h.mock.scrape).not.toHaveBeenCalled()
    })

    it('refuses an unknown color_scheme', async () => {
      const res = await h.client.callTool({
        name: 'scrape',
        arguments: {
          url: 'https://example.com',
          extract: { screenshot: { type: 'viewport', color_scheme: 'sepia' } },
        },
      })
      expect(res.isError).toBe(true)
      expect(h.mock.scrape).not.toHaveBeenCalled()
    })
  })

  it('maps unsupported_pdf_output to a tool error with its code', async () => {
    h.mock.scrape.mockRejectedValueOnce(
      new CrawlbruleeError('This content type cannot be saved as a PDF.', {
        status: 422,
        // sdk 1.4's ApiErrorName does not list it yet; the api sends it anyway.
        errorName: 'unsupported_pdf_output' as string as ApiErrorName,
      })
    )

    const res = await h.client.callTool({ name: 'scrape', arguments: pdfOnly({}) })

    expect(res.isError).toBe(true)
    const text = Array.isArray(res.content) ? (res.content[0] as { text?: string }).text : ''
    expect(text).toMatch(/^\[unsupported_pdf_output\] .*\(HTTP 422\)/)
  })
})
