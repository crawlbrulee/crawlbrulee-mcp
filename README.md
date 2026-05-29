# 🍮 crawlbrulee MCP

The official [Model Context Protocol](https://modelcontextprotocol.io) server for the [crawlbrulee](https://crawlbrulee.com) web-scraping API. Lets MCP-aware AI agents — Claude Code, Codex, Cursor, Claude Desktop — scrape pages, map sites, and check their crawlbrulee usage as native tool calls.

- `npx`-runnable — zero install.
- Wraps the [`@crawlbrulee/sdk`](https://www.npmjs.com/package/@crawlbrulee/sdk) under the hood; this MCP is just a thin protocol adapter.
- Stdio transport for terminal-based agents.
- Strict, fully-described tool schemas — agents see what every parameter does without reading docs.

> **Status:** v0.1.0 (beta). Tool surface is stabilizing — expect minor changes between 0.x releases.

---

## Install

```bash
# Claude Code
claude mcp add crawlbrulee \
  --env CRAWLBRULEE_API_KEY=cble_... \
  -- npx -y @crawlbrulee/mcp

# Cursor — add to ~/.cursor/mcp.json:
{
  "mcpServers": {
    "crawlbrulee": {
      "command": "npx",
      "args": ["-y", "@crawlbrulee/mcp"],
      "env": { "CRAWLBRULEE_API_KEY": "cble_..." }
    }
  }
}
```

The same pattern works for Codex, Claude Desktop, and any other host that
accepts a stdio MCP launch command — set `command: npx`, `args: ["-y",
"@crawlbrulee/mcp"]`, and forward `CRAWLBRULEE_API_KEY` via the env block.

## Configuration

| Env var               | Required | Description                                                                    |
| --------------------- | -------- | ------------------------------------------------------------------------------ |
| `CRAWLBRULEE_API_KEY` | yes      | API key sent as `Authorization: Bearer …`. Get one at https://crawlbrulee.com. |

The MCP reads the env var on first tool invocation — not at startup — so a
typo in your config surfaces as a clear tool-error message rather than the
server failing to come up.

---

## Tools

### `scrape`

Fetch a single URL and return the requested content (markdown, cleaned
HTML, raw HTML, links, images, screenshot, page metadata).

**Input** — only `url` is required; everything else has sane defaults.

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

**Output** — full scrape result. Screenshots are returned as signed download URLs the agent can fetch separately.

### `map`

Build (or fetch a cached) link-map for a website. Combines sitemap discovery with homepage link extraction. Use this to enumerate a site before scraping selected pages.

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

### `usage`

Returns the current billing-cycle snapshot: total / used / available credits, used quota percent, max concurrency, and cycle reset timestamp. Takes no arguments.

### `whoami`

Returns the organization name, token name, and truncated token preview for the configured API key. Useful for confirming which account is in use before credit-consuming operations.

---

## Errors

Every tool returns an MCP error envelope (`isError: true`) when the API call fails. The error text follows a stable format:

```
[<errorName>] <message> (HTTP <status>)
```

Agents can branch on the `errorName` code. The set comes from the SDK's `ApiErrorName` union plus two synthetic codes added by this MCP (`missing_api_key`, `internal_error`):

| Code                     | Meaning                                                       |
| ------------------------ | ------------------------------------------------------------- |
| `missing_api_key`        | `CRAWLBRULEE_API_KEY` is not set in the MCP host's env.       |
| `invalid_credentials`    | Server rejected the API key (revoked, wrong env, etc.).       |
| `too_many_requests`      | Rate limit hit — back off and retry.                          |
| `usage_allocation_error` | Plan credit / concurrency cap exceeded. Show `usage` to user. |
| `validation_error`       | Input failed server validation.                               |
| `invalid_url`            | Target URL was rejected before fetching.                      |
| `blocked_url`            | Target URL is on the blocklist.                               |
| `antibot_blocked`        | Origin's anti-bot defenses blocked the fetch.                 |
| `scrape_error`           | Origin returned an error during scraping.                     |
| `not_found`              | Async job ID unknown (reserved for future async tools).       |
| `request_timeout`        | Network / read timeout. Safe to retry.                        |
| `client_closed_request`  | Caller cancelled before completion.                           |
| `internal_server_error`  | Unhandled server-side failure.                                |
| `crawlbrulee_error`      | SDK error without a typed name.                               |
| `internal_error`         | Bug in this MCP — please open an issue.                       |

---

## Development

```bash
pnpm install
pnpm typecheck   # tsc --noEmit
pnpm lint        # eslint
pnpm test        # vitest run
pnpm build       # tsup → dist/index.js with shebang
pnpm verify      # all of the above
```

Run the built MCP locally:

```bash
CRAWLBRULEE_API_KEY=cble_... node ./dist/index.js
```

It will block waiting for an MCP client on stdio. Combine with the [MCP Inspector](https://github.com/modelcontextprotocol/inspector) for interactive debugging.

### Schema sync

The `src/schemas/*.ts` files are **vendored copies** of the canonical Zod schemas in `crawlbrulee/packages/shared/core/src/model/common/Api*.ts`. The ecosystem policy is that tool repos do not import the shared subtree. When the canonical schemas change:

1. Copy the updated `Api*.ts` and supporting `ScrapeScreenshot*.ts` files into `src/schemas/`.
2. Keep the `// VENDORED from …` banner intact and update the path if the source moved.
3. Re-run `pnpm verify`.

A future `@crawlbrulee/types` npm package will replace this manual sync.

## License

[AGPL-3.0-only](./LICENSE)
