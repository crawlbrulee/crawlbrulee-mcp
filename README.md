# 🍮 crawlbrulee mcp

[![npm](https://img.shields.io/npm/v/@crawlbrulee/mcp?style=flat-square&label=npm)](https://www.npmjs.com/package/@crawlbrulee/mcp)
[![license](https://img.shields.io/npm/l/@crawlbrulee/mcp?style=flat-square&label=license)](./LICENSE)

**EU-native web scraping for AI agents & developers.**

plug crawlbrulee into your agent. the official [mcp](https://modelcontextprotocol.io) server for [crawlbrulee](https://crawlbrulee.com) gives mcp-aware agents — Claude Code, Codex, Cursor, Claude Desktop — native tools to scrape pages, map sites, run background jobs, and check usage. one call turns any url into clean markdown, screenshots, metadata and links.

- **everything runs in the EU.** the fetch, the render, the cache and your result never leave EU servers. the proxy exit is the one hop you choose: pick an EU exit and nothing leaves at all. gdpr-aligned, with a data processing agreement.
- **output made for models.** markdown with the page chrome stripped and the links kept, ready for the prompt. full-page screenshots can come back as tiles sized for an image model.
- **the hard parts, handled.** headless Chrome when a page needs it, rotating proxies with country selection, automatic retries, ad and cookie-banner removal, caching, background jobs and signed webhooks.
- **start free.** 750 credits, no credit card.

**get a free api key** → [dashboard.crawlbrulee.com](https://dashboard.crawlbrulee.com)

the server:

- `npx`-runnable — zero install.
- wraps the [`@crawlbrulee/sdk`](https://www.npmjs.com/package/@crawlbrulee/sdk) under the hood; this mcp is just a thin protocol adapter.
- stdio transport for terminal-based agents.
- strict, fully-described tool schemas — agents see what every parameter does without reading docs.

this readme covers the mcp server itself — its tools and how to wire it into a host. for how the api behaves — endpoints, parameters, and error semantics — please see our
[api docs](https://crawlbrulee.com/docs).

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
  "cleanup": { "ads_and_popups": true, "exclude_selectors": ["nav", "footer"] },
  "cache": { "max_age": 3600 },
  "location": { "locale": "en-US", "country": "US" },
  "zero_data_retention": false,
}
```

`zero_data_retention` (boolean, default `false`) keeps the result out of the shared cache; anything stored to deliver it is kept for 24 hours, then deleted. it adds 1 credit and must be enabled for your organization. `scrape_async` takes it too. see [zero data retention](https://crawlbrulee.com/docs/zero-data-retention).

**named values with `extract.elements`.** to pull a few values from a page — prices, titles, links — give each one a name and a CSS selector, instead of reading the whole markdown. they come back in `elements` under the same names. `all: true` returns every match as a list, and `fields` reads named values inside each match. it costs no extra credits. `scrape_async` takes it too.

```jsonc
{
  "url": "https://books.toscrape.com/",
  "extract": {
    "elements": {
      "heading": "h1",
      "books": {
        "selector": "article.product_pod",
        "all": true,
        "fields": {
          "title": { "selector": "h3 a", "output": "attribute", "attribute": "title" },
          "price": ".price_color",
        },
      },
    },
  },
}
// → "elements": {
//     "heading": "All products",
//     "books": [{ "title": "A Light in the Attic", "price": "£51.77" }, ...]
//   }
```

a name with no match is `null` (or `[]` with `all: true`). limits and selector rules: see [elements](https://crawlbrulee.com/docs/scrape/elements).

**output** — full scrape result. page metadata (title, OG tags, etc.) is returned under `metadata`. extracted `images` are returned as absolute urls — query strings are preserved, and relative `src`s are resolved against the page url. screenshots are returned as signed download urls the agent can fetch separately. in rare cases a screenshot can't be captured: when you requested other outputs too, the `screenshot` field is simply left out while the rest is still returned — but a screenshot-only call that can't deliver errors instead (`unsupported_screenshot_output`, HTTP 422, when the content type can't be screenshotted) and isn't billed. the result also carries `page_status_code` and a top-level `response_meta.usage` block:

```jsonc
{
  "url": "https://example.com",
  "requested_url": "https://example.com",
  "page_status_code": 200, // the site's own HTTP status for the final page
  "markdown": "...",
  "metadata": { "title": "Example Domain" },
  "response_meta": {
    "usage": {
      // total_credit_cost = engine_credit_cost × proxy_multiplier + screenshot_slicing_credit_cost + zero_data_retention_credit_cost
      "total_credit_cost": 1,
      "engine_credit_cost": 1, // http 1, browser 3, screenshot 5, cache 0
      "proxy_multiplier": 1, // basic 1, advanced 5
      "screenshot_slicing_credit_cost": 0, // 1 when the screenshot was split into slices, otherwise 0
      "zero_data_retention_credit_cost": 0, // 1 when zero_data_retention added its credit, otherwise 0
      "engine": "http", // "http" | "browser" | "screenshot" | "cache"
      "proxy": "basic", // resolved tier actually used: "basic" | "advanced" (never "auto")
    },
  },
}
```

**a page the site served is a result, not an error.** `page_status_code` is the HTTP status the site answered with for the final page, after redirects. a 404, 410 or 503 page comes back with its content and its status here, so check `page_status_code` before you trust the content: a 404 means the markdown is the site's "not found" page. 2xx and 4xx pages are billed, except 403, 407, 408, 429 and 451; 5xx pages are never billed. when the site can't be reached at all, the tool returns a `target_unreachable` error instead (see [errors](#errors)).

alongside `response_meta.usage`, the result surfaces any non-fatal `warnings` — stable string codes an agent can switch on. an outsized page is truncated rather than refused, and the code names which part was cut:

| code                      | what it means for the payload                                                                         |
| ------------------------- | ----------------------------------------------------------------------------------------------------- |
| `screenshot_truncated`    | the page was taller than the scrolling-capture height cap; the screenshot covers the top of the page. |
| `links_truncated`         | the page had more than 30,000 links; the `links` array is cut at the cap and is incomplete.           |
| `inline_images_truncated` | the page had more than 10,000 inline images; the `images` array is cut at the cap and is incomplete.  |
| `raw_html_truncated`      | the page body exceeded 10,000,000 characters; `raw_html` is cut at a tag boundary, never mid-tag.     |
| `elements_truncated`      | an `elements` value hit a limit; see [elements](https://crawlbrulee.com/docs/scrape/elements).        |

one more code is not about size: `screenshot_unavailable` means a screenshot was asked for, but the page came back from the http engine without one. the rest of the result is still there.

and if you requested an extract that doesn't apply to the content type (e.g. `metadata` of a JSON file), the field name comes back in an `unsupported_fields` list — with the rest of the payload still returned.

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

when a `webhook` is attached, we deliver a single signed `scrape.complete` POST to your endpoint once the job reaches a terminal state, with your `metadata` echoed under `data.metadata` and the job's usage under `data.response_meta.usage` — so you can react to completion (and track cost) without polling. verify the `X-Cwbl-Signature` header with the sdk's `verifyWebhookSignature` (configure the signing secret in the dashboard under account → webhooks).

the job lifecycle is documented under [async scrape](https://crawlbrulee.com/docs/scrape/async); the delivery contract and payload shape under [webhooks](https://crawlbrulee.com/docs/scrape/webhooks), with the signature scheme in [webhook verification](https://crawlbrulee.com/docs/webhook-verification).

### `scrape_status`

look up the current lifecycle status of an async job: `pending`, `running`, `done`, or `failed` (with an `error` message when failed). once the job is `done` the response also carries a `response_meta.usage` block (`total_credit_cost` and its parts, billed `engine`, resolved `proxy` tier). a cache hit is represented by `engine: "cache"`. a job whose page the site served ends `done` even when that page is a 404 — read `page_status_code` in the result. poll until `done`, then call `scrape_result`.

```jsonc
{ "job_id": "..." }
```

### `scrape_result`

fetch the extracted content of a completed async job — the same result shape as the synchronous `scrape` tool (including `page_status_code`, `metadata`, `elements` and `response_meta.usage`). errors if the job is still `pending`/`running`, so check `scrape_status` first.

```jsonc
{ "job_id": "..." }
```

### `map`

build (or fetch a cached) link-map for a website. combines sitemap discovery with homepage link extraction. use this to enumerate a site before scraping selected pages. each link is just `{ url }`.

`max_urls` (default `5000`, max `100000`) is a discovery budget, not a trim at the end — discovery stops as soon as that many urls are found, so a smaller value is a faster, cheaper crawl. `limit` (default `5000`, max `10000`) only pages the answer.

returned urls are normalized the same way `scrape` normalizes its returned `url`, so map-then-scrape stays on one host. results are ordered with the most useful links first.

the response's `response_meta` carries `pagination`, `truncation`, and a `usage` block (`total_credit_cost` = `engine_credit_cost` × `proxy_multiplier` + `zero_data_retention_credit_cost`, billed `engine`, resolved `proxy` tier). map has no screenshot slicing and no `page_status_code`, since it reads many files, not one page. a map that found nothing because the site answered only with statuses we don't bill (a `5xx`, for example), or not at all, is empty and free.

```jsonc
{
  "url": "https://example.com",
  "sitemap_only": false,
  "types": { "internal": true, "external": false, "internal_subdomains": true },
  "max_urls": 5000,
  "page": 1,
  "limit": 1000,
  "zero_data_retention": false,
}
```

`zero_data_retention` works as it does on `scrape` (see [zero data retention](https://crawlbrulee.com/docs/zero-data-retention)).

a map stopped by your own `max_urls` returns exactly that many links with `response_capped: false` — the signal that the site has more is `truncation.discovery_cap_reason`:

```jsonc
{
  "truncation": {
    "storage_capped": false,
    "response_capped": false,
    "total_before_max_urls": 5000,
    "total_detected_before_storage_cap": 5000,
    "discovery_capped": true, // discovery stopped before reading every sitemap file
    "sitemaps_skipped": 3, // files skipped or only partly read
    "discovery_cap_reason": "max_urls", // retry with a higher max_urls
  },
}
```

`discovery_cap_reason` is one of `max_urls`, `time`, `file_budget`, `depth`, `file_size`, `unread_files`, or `null` when nothing stopped discovery. only `max_urls` is a limit you can raise from the request. `unread_files` means a sitemap file the site publishes could not be read at all this time — often temporary, so asking again later can return more. `time`, `file_budget`, `depth` and `file_size` mean the site itself is big, slow or deep, and a retry will not help.

see the [map endpoint](https://crawlbrulee.com/docs/map) for discovery rules and pagination semantics.

### `usage`

returns the current billing-cycle snapshot: total / used / available credits, used quota percent, max concurrency, and cycle reset timestamp. takes no arguments. what a call costs, and how credits are counted, is documented under [credits & pricing](https://crawlbrulee.com/docs/credits-and-pricing).

### `whoami`

returns the organization name, token name, and truncated token preview for the configured api key. useful for confirming which account is in use before credit-consuming operations.

---

## errors

every tool returns an mcp error result (`isError: true`) when the api call fails. the error text follows a stable format:

```
[<errorName>] <message> (HTTP <status>)
```

a few codes add a short next step after that, e.g. `target_unreachable` and `zero_data_retention_not_enabled`. branch on the `errorName` code, not on the rest of the text.

agents can branch on the `errorName` code. the set comes from the sdk's `ApiErrorName` union plus two synthetic codes added by this mcp (`missing_api_key`, `internal_error`):

| code                              | meaning                                                                                        |
| --------------------------------- | ---------------------------------------------------------------------------------------------- |
| `missing_api_key`                 | `CRAWLBRULEE_API_KEY` is not set in the mcp host's env.                                        |
| `invalid_credentials`             | server rejected the api key (revoked, wrong env, etc.).                                        |
| `service_unavailable`             | temporary backend failure (HTTP 503). your key is fine — retry with backoff.                   |
| `too_many_requests`               | rate limit hit — back off and retry.                                                           |
| `usage_allocation_error`          | plan credit / concurrency cap exceeded. show `usage` to user.                                  |
| `validation_error`                | input failed server validation.                                                                |
| `invalid_url`                     | target url was rejected before fetching.                                                       |
| `blocked_url`                     | target url is on the blocklist.                                                                |
| `antibot_blocked`                 | origin's anti-bot defenses blocked the fetch.                                                  |
| `too_many_redirects`              | origin redirected the fetch in a loop (HTTP 422). the target's doing — don't retry blindly.    |
| `page_too_large`                  | the page's html was too large to process (HTTP 422). terminal — never retry it.                |
| `target_unreachable`              | we could not reach the site at all (HTTP 502). not billed. retry later or check the url.       |
| `zero_data_retention_not_enabled` | `zero_data_retention` is not enabled for your organization (HTTP 403). not billed.             |
| `scrape_error`                    | the scrape could not be completed. a page the site served, even a 404, is never this error.    |
| `unsupported_screenshot_output`   | screenshot-only request on a content type that can't be screenshotted (HTTP 422). not billed.  |
| `not_found`                       | async job ID unknown, or submitted more than 24 hours ago (`scrape_status` / `scrape_result`). |
| `request_timeout`                 | network / read timeout. safe to retry.                                                         |
| `client_closed_request`           | caller cancelled before completion.                                                            |
| `internal_server_error`           | unhandled server-side failure.                                                                 |
| `crawlbrulee_error`               | sdk error without a typed name.                                                                |
| `internal_error`                  | bug in this mcp — please open an issue.                                                        |

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

[Apache-2.0](./LICENSE)
