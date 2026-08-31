# 🍮 crawlbrulee mcp

[![npm](https://img.shields.io/npm/v/@crawlbrulee/mcp?style=flat-square&label=npm)](https://www.npmjs.com/package/@crawlbrulee/mcp)
[![license](https://img.shields.io/npm/l/@crawlbrulee/mcp?style=flat-square&label=license)](./LICENSE)

the official [mcp](https://modelcontextprotocol.io) server for the [crawlbrulee](https://crawlbrulee.com) web-scraping api. lets mcp-aware ai agents — Claude Code, Codex, Cursor, Claude Desktop — scrape pages, map sites, and check their crawlbrulee usage as native tool calls.

- `npx`-runnable — zero install.
- wraps the [`@crawlbrulee/sdk`](https://www.npmjs.com/package/@crawlbrulee/sdk) under the hood; this mcp is just a thin protocol adapter.
- stdio transport for terminal-based agents.
- strict, fully-described tool schemas — agents see what every parameter does without reading docs.

this readme covers the mcp server itself — its tools and how to wire it into a host. for how the api behaves — endpoints, parameters, and error semantics — please see our
[api docs](https://crawlbrulee.com/docs).

> **status:** v0.8.1 (beta). tool surface is stabilizing — expect minor changes between 0.x releases.

**get a free api key** → [dashboard.crawlbrulee.com](https://dashboard.crawlbrulee.com)

---

## install

```bash
# Claude Code
claude mcp add crawlbrulee \
  --env CRAWLBRULEE_API_KEY=cwbl_... \
  -- npx -y @crawlbrulee/mcp

# Cursor — add to ~/.cursor/mcp.json:
{
  "mcpServers": {
    "crawlbrulee": {
      "command": "npx",
      "args": ["-y", "@crawlbrulee/mcp"],
      "env": { "CRAWLBRULEE_API_KEY": "cwbl_..." }
    }
  }
}
```

the same pattern works for Codex, Claude Desktop, and any other host that
accepts a stdio mcp launch command — set `command: npx`, `args: ["-y",
"@crawlbrulee/mcp"]`, and forward `CRAWLBRULEE_API_KEY` via the env block.

## configuration

| env var               | required | description                                                                    |
| --------------------- | -------- | ------------------------------------------------------------------------------ |
| `CRAWLBRULEE_API_KEY` | yes      | api key sent as `Authorization: Bearer …`. get one at https://crawlbrulee.com. |

the mcp reads the env var on first tool invocation — not at startup — so a
typo in your config surfaces as a clear tool-error message rather than the
server failing to come up. see
[authentication](https://crawlbrulee.com/docs/authentication) for how the api consumes keys.

---

## tools

### `scrape`

fetch a single url and return the requested content (markdown, cleaned
html, raw html, links, images, screenshot, page metadata).

**input** — only `url` is required; everything else has sane defaults.

```jsonc
{
  "url": "https://example.com",
  "extract": {
    "markdown": true,
    "links": true,
    "screenshot": { "type": "full_page", "device_mode": "desktop" },
  },
  "require_js": false,
  "proxy": "basic",
  "exclude_selectors": ["nav", "footer"],
  "cache": { "max_age": 3600 },
  "location": { "locale": "en-US", "country": "US" },
}
```

**output** — full scrape result. page metadata (title, OG tags, etc.) is returned under `metadata`. extracted `images` are returned as absolute urls — query strings are preserved, and relative `src`s are resolved against the page url. screenshots are returned as signed download urls the agent can fetch separately. in rare cases a screenshot can't be captured: when you requested other outputs too, the `screenshot` field is simply left out while the rest is still returned — but a screenshot-only call that can't deliver errors instead (`unsupported_screenshot_output`, HTTP 422, when the content type can't be screenshotted) and isn't billed. the result also carries a top-level `response_meta.usage` block:

```jsonc
{
  "url": "https://example.com",
  "markdown": "...",
  "metadata": { "title": "Example Domain" },
  "response_meta": {
    "usage": {
      "credits": 1,
      "engine": "text", // "text" | "browser" | "screenshot" | "cache"
      "proxy": "basic", // resolved tier actually used: "basic" | "advanced" (never "auto")
      "screenshot_slices": 0, // 1 when the screenshot-split add-on was billed, otherwise 0
    },
  },
}
```

alongside `response_meta.usage`, the result surfaces any non-fatal `warnings` — stable string codes an agent can switch on. an outsized page is truncated rather than refused, and the code names which part was cut:

| code                      | what it means for the payload                                                                         |
| ------------------------- | ----------------------------------------------------------------------------------------------------- |
| `screenshot_truncated`    | the page was taller than the scrolling-capture height cap; the screenshot covers the top of the page. |
| `links_truncated`         | the page had more than 30,000 links; the `links` array is cut at the cap and is incomplete.           |
| `inline_images_truncated` | the page had more than 10,000 inline images; the `images` array is cut at the cap and is incomplete.  |
| `raw_html_truncated`      | the page body exceeded 10,000,000 characters; `raw_html` is cut at a tag boundary, never mid-tag.     |
| `metadata_truncated`      | the page head exceeded 2,000,000 characters; `metadata` can be missing tags that sat past the cut.    |

and if you requested an extract that doesn't apply to the content type (e.g. `markdown` of a pdf), the field name comes back in an `unsupported_fields` list — with the rest of the payload still returned.

every input field, its default, and its constraints are documented under the [scrape endpoint](https://crawlbrulee.com/docs/scrape) — with [extraction](https://crawlbrulee.com/docs/scrape/extraction), [screenshots](https://crawlbrulee.com/docs/scrape/screenshots), [proxies & location](https://crawlbrulee.com/docs/proxies), and [caching](https://crawlbrulee.com/docs/scrape/caching) covering the individual blocks.

### `scrape_async`

submit a scrape job to run **asynchronously** and get back a `job_id` immediately, instead of holding the connection open. use this for long-running scrapes (heavy js rendering, full-page screenshots of long pages); for a quick one-shot fetch prefer the synchronous `scrape` tool. then poll `scrape_status` until the job is `done` and fetch the page with `scrape_result`.

takes the same input as `scrape` plus an optional per-job completion `webhook`:

```jsonc
{
  "url": "https://example.com",
  "extract": { "markdown": true },
  "webhook": {
    // Endpoint that receives one signed `scrape.complete` POST when the job
    // finishes. http/https (HTTPS required in production), max 2048 chars.
    "url": "https://hooks.example.com/cwbl",
    // Opaque correlation object echoed back verbatim in the delivery's
    // `data.metadata`. Serializes to at most 2048 bytes.
    "metadata": { "ref": "order-42" },
  },
}
```

**output** — `{ "job_id": "..." }`.

when a `webhook` is attached, we deliver a single signed `scrape.complete` POST to your endpoint once the job reaches a terminal state, with your `metadata` echoed under `data.metadata` and the job's usage under `data.response_meta.usage` — so you can react to completion (and reconcile cost) without polling. verify the `X-Cwbl-Signature` header with the sdk's `verifyWebhookSignature` (configure the signing secret in the dashboard under account → webhooks).

the job lifecycle is documented under [async scrape](https://crawlbrulee.com/docs/scrape/async); the delivery contract and payload shape under [webhooks](https://crawlbrulee.com/docs/scrape/webhooks), with the signature scheme in [webhook verification](https://crawlbrulee.com/docs/webhook-verification).

### `scrape_status`

look up the current lifecycle status of an async job: `pending`, `running`, `done`, or `failed` (with an `error` message when failed). once the job is `done` the response also carries a `response_meta.usage` block (`credits`, billed `engine`, resolved `proxy` tier, `screenshot_slices`). a cache hit is represented by `engine: "cache"`. poll until `done`, then call `scrape_result`.

```jsonc
{ "job_id": "..." }
```

### `scrape_result`

fetch the extracted content of a completed async job — the same result shape as the synchronous `scrape` tool (including `metadata` and `response_meta.usage`). errors if the job is still `pending`/`running`, so check `scrape_status` first.

```jsonc
{ "job_id": "..." }
```

### `map`

build (or fetch a cached) link-map for a website. combines sitemap discovery with homepage link extraction. use this to enumerate a site before scraping selected pages. the response's `response_meta` carries `pagination`, `truncation`, and a `usage` block (`credits`, billed `engine`, resolved `proxy` tier). map responses do not include screenshot-slice accounting.

```jsonc
{
  "url": "https://example.com",
  "sitemap_only": false,
  "types": { "internal": true, "external": false, "internal_subdomains": true },
  "max_urls": 5000,
  "page": 1,
  "limit": 1000,
}
```

see the [map endpoint](https://crawlbrulee.com/docs/map) for discovery rules and pagination semantics.

### `usage`

returns the current billing-cycle snapshot: total / used / available credits, used quota percent, max concurrency, and cycle reset timestamp. takes no arguments. what a call costs, and how credits are counted, is documented under [credits & pricing](https://crawlbrulee.com/docs/credits-and-pricing).

### `whoami`

returns the organization name, token name, and truncated token preview for the configured api key. useful for confirming which account is in use before credit-consuming operations.

---

## errors

every tool returns an mcp error envelope (`isError: true`) when the api call fails. the error text follows a stable format:

```
[<errorName>] <message> (HTTP <status>)
```

agents can branch on the `errorName` code. the set comes from the sdk's `ApiErrorName` union plus two synthetic codes added by this mcp (`missing_api_key`, `internal_error`):

| code                            | meaning                                                                                       |
| ------------------------------- | --------------------------------------------------------------------------------------------- |
| `missing_api_key`               | `CRAWLBRULEE_API_KEY` is not set in the mcp host's env.                                       |
| `invalid_credentials`           | server rejected the api key (revoked, wrong env, etc.).                                       |
| `service_unavailable`           | temporary backend failure (HTTP 503). your key is fine — retry with backoff.                  |
| `too_many_requests`             | rate limit hit — back off and retry.                                                          |
| `usage_allocation_error`        | plan credit / concurrency cap exceeded. show `usage` to user.                                 |
| `validation_error`              | input failed server validation.                                                               |
| `invalid_url`                   | target url was rejected before fetching.                                                      |
| `blocked_url`                   | target url is on the blocklist.                                                               |
| `antibot_blocked`               | origin's anti-bot defenses blocked the fetch.                                                 |
| `scrape_error`                  | origin returned an error during scraping.                                                     |
| `unsupported_screenshot_output` | screenshot-only request on a content type that can't be screenshotted (HTTP 422). not billed. |
| `not_found`                     | async job ID unknown (e.g. bad `job_id` to `scrape_status` / `scrape_result`).                |
| `request_timeout`               | network / read timeout. safe to retry.                                                        |
| `client_closed_request`         | caller cancelled before completion.                                                           |
| `internal_server_error`         | unhandled server-side failure.                                                                |
| `crawlbrulee_error`             | sdk error without a typed name.                                                               |
| `internal_error`                | bug in this mcp — please open an issue.                                                       |

the api docs carry the canonical [error reference](https://crawlbrulee.com/docs/errors) — every error name, what causes it, and how to recover.

---

## development

```bash
pnpm install
pnpm typecheck   # tsc --noEmit
pnpm lint        # eslint
pnpm test        # vitest run
pnpm build       # tsup → dist/index.js with shebang
pnpm verify      # all of the above
```

run the built mcp locally:

```bash
CRAWLBRULEE_API_KEY=cwbl_... node ./dist/index.js
```

it will block waiting for an mcp client on stdio. combine with the [MCP Inspector](https://github.com/modelcontextprotocol/inspector) for interactive debugging.

## docs

this readme covers the mcp server itself — installing it, wiring it into a host, and the tools it exposes. for how the api behaves — endpoints, parameters, and error semantics — the [api docs](https://crawlbrulee.com/docs) are canonical. the [mcp guide](https://crawlbrulee.com/docs/mcp) covers host setup in more depth.

## part of the crawlbrulee toolkit

one api, many ways to call it:

- **[js/ts sdk](https://github.com/crawlbrulee/crawlbrulee-js)** — `@crawlbrulee/sdk` (the sdk this mcp wraps)
- **[python sdk](https://github.com/crawlbrulee/crawlbrulee-py)** — `crawlbrulee` on pypi
- **[cli](https://github.com/crawlbrulee/crawlbrulee-cli)** — `npx crawlbrulee`
- **[mcp server](https://github.com/crawlbrulee/crawlbrulee-mcp)** — `@crawlbrulee/mcp` (this one)
- **[agent skills](https://github.com/crawlbrulee/crawlbrulee-skills)** — for skills-aware coding agents

docs: [crawlbrulee.com/docs](https://crawlbrulee.com/docs) · dashboard: [dashboard.crawlbrulee.com](https://dashboard.crawlbrulee.com)

## license

[AGPL-3.0-only](./LICENSE)
