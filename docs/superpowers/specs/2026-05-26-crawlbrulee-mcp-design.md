# crawlbrulee MCP server — design

**Status:** approved
**Date:** 2026-05-26
**Package:** `@crawlbrulee/mcp`
**Repo:** `crawlbrulee-mcp` (sibling under `/crawlbrulee-root/`)

## Goal

Ship a Node/TypeScript stdio MCP server that gives terminal-based AI agents
(Claude Code, Codex, Cursor) first-class access to the crawlbrulee scraping
API. The server wraps `@crawlbrulee/sdk` — no HTTP, auth, retry, or error
mapping is re-implemented here. Installable via `npx`.

This is the third tool in the planned trio (SDK → CLI → MCP). Follows the
same conventions established by `@crawlbrulee/sdk` and the CLI.

## Non-goals (v1)

- Remote / HTTP+SSE transport — stdio only. The Notion ticket (CWBL-109)
  asks for both; remote ships in a later milestone.
- MCP resources or prompts.
- Streaming partial results.
- Auto-truncation of large scrape responses.
- A `login` / interactive setup flow (impossible to run reliably over stdio
  from a host the user hasn't configured yet).

## Architecture

Single Node process. Entry point parses argv minimally, instantiates
`McpServer`, registers tools, and connects a `StdioServerTransport`.

- **Transport:** stdio only. `@modelcontextprotocol/sdk` ≥ 1.29's
  `StdioServerTransport`.
- **Server core:** `McpServer.registerTool(name, { description, inputSchema,
  outputSchema }, handler)`.
- **API access:** all tools call the same lazily-built `@crawlbrulee/sdk`
  client (`Crawlbrulee.fromEnv()`). The client is built on first tool
  invocation so a missing `CRAWLBRULEE_API_KEY` produces a tool-level error
  (with a clear remediation message), not a startup crash that's hard to
  debug from an MCP host's logs.
- **Schemas:** vendored Zod schemas mirrored from
  `crawlbrulee/packages/shared/core/src/model/common/Api*.ts`. See
  [Schemas](#schemas) below.

## Tool surface

Four tools. The single scrape tool is sync — agents shouldn't be choosing
between sync and async, and async-with-polling stalls the agent's turn
worse than a long sync call. Heavy scrapes (slice screenshots on large
pages) remain a known edge case; users who need them can fall back to the
CLI or REST.

| Tool      | SDK method           | Input schema              | Output schema                  |
|-----------|----------------------|---------------------------|--------------------------------|
| `scrape`  | `client.scrape(req)` | `Schema_ApiScrapeRequest` | `Schema_ApiScrapeSuccessResponse` |
| `map`     | `client.map(req)`    | `Schema_ApiMapRequest`    | `Schema_ApiMapResult`          |
| `usage`   | `client.usage()`     | `z.object({}).strict()`   | `Schema_ApiUsageResponse`      |
| `whoami`  | `client.whoami()`    | `z.object({}).strict()`   | `Schema_ApiWhoamiResponse`     |

Each tool returns the SDK response verbatim, JSON-stringified as a single
`type: "text"` content block plus the same payload as `structuredContent`
(MCP's typed-output channel). Hosts that understand structured outputs get
a typed object; hosts that don't fall back to the text block.

### Screenshot handling

Scrape responses with `extract.screenshot` contain signed URLs in the
response payload. The MCP returns those URLs unchanged. The agent decides
whether to fetch (via a separate tool, `curl`, or the user's browser).
This keeps tool responses small and avoids burning agent context on
base64-encoded images.

### Response shape

SDK passthrough — no field stripping, no truncation. The agent already
controls verbosity via the `extract` field on `scrape` (e.g. ask for
`markdown` only, not `raw_html`). The MCP doesn't second-guess that.

## Schemas

The shared subtree (`crawlbrulee/packages/shared/core/src/model/common/`)
already defines fully-`.describe()`d Zod schemas (the OpenAPI generator
consumes them). Their description strings become first-class MCP tool
documentation — input field hints visible to the agent for free.

**However**, the ecosystem skill is explicit:

> *No future tool (SDK / MCP / CLI / Postman / public skills) imports
> this subtree — it carries far more than any tool needs.*

So we **vendor** (copy) only the customer-facing `Schema_Api*` schemas
into `src/schemas/`. Files mirrored 1:1:

```
src/schemas/
├── ApiScrapeRequest.ts        # input: scrape
├── ApiScrapeResponse.ts       # output: scrape (+ supporting screenshot/meta schemas)
├── ApiMapRequest.ts           # input: map
├── ApiMapResponse.ts          # output: map
├── ApiUsageResponse.ts        # output: usage
├── ApiWhoamiResponse.ts       # output: whoami
└── ScrapeScreenshotSchemas.ts # supporting (Screenshot type/device/cleanup/actions)
```

Mirror policy:

- Each file gets a header banner: `// VENDORED from
  crawlbrulee/packages/shared/core/src/model/common/<Name>.ts —
  do not edit; resync from source on schema bumps.`
- Sync is manual until a `@crawlbrulee/types` package exists (open
  ecosystem question, called out in the parent skill). README documents
  the resync procedure.
- The vendored schemas are kept lossless — same field names, same
  `.describe()` strings, same defaults. Drift between the MCP and the
  REST API is a release-blocker bug.

## Auth & configuration

- Reads `CRAWLBRULEE_API_KEY` (the SDK's existing env contract via
  `Crawlbrulee.fromEnv()`).
- `CRAWLBRULEE_BASE_URL` is honored when set — passthrough to the SDK's
  `baseUrl` option. Intended for local development against staging /
  self-hosted instances.
- No CLI flags. The MCP is launched by a host (`claude mcp add ...`),
  so all configuration arrives via env vars in the host's command spec.
- If the env var is missing when a tool is invoked, the tool returns an
  MCP error (`isError: true`) whose text explains exactly which env var
  to set and how (`claude mcp add crawlbrulee --env CRAWLBRULEE_API_KEY=cble_... -- npx -y @crawlbrulee/mcp`).

## Error handling

The SDK throws typed `CrawlbruleeError` subclasses
(`AuthenticationError`, `RateLimitError`, `NotFoundError`,
`UsageAllocationError`, `ValidationError`, `TransportError`). Each tool
handler wraps the SDK call and converts thrown errors to MCP tool
errors:

- The MCP response sets `isError: true`.
- A `type: "text"` block carries a human-readable message: `[<errorName>]
  <message> (HTTP <status>)` — e.g. `[rate_limited] Too many requests
  (HTTP 429)`. Stable `errorName` codes let the agent reason about
  retries.
- `structuredContent` carries `{ error: { name, status, message } }` for
  hosts that read it.
- Unknown / non-Crawlbrulee errors (programmer mistakes, transport
  flakes the SDK didn't catch) surface as `[internal_error] <message>`.

Zod validation failures on `inputSchema` are handled by the MCP SDK
itself before the handler runs — those return as schema-validation
errors with the standard MCP shape.

## Repo layout

```
crawlbrulee-mcp/
├── src/
│   ├── index.ts              # bin: shebang, builds server, connects stdio transport
│   ├── server.ts             # buildServer(): McpServer w/ tools registered. Pure factory, no I/O.
│   ├── client.ts             # getCrawlbruleeClient(): lazy SDK client, env read on first call
│   ├── errors.ts             # toToolError(err): SDK error → MCP tool error content
│   ├── schemas/              # VENDORED zod schemas (see Schemas above)
│   │   ├── index.ts
│   │   └── ...
│   └── tools/
│       ├── scrape.ts         # registerScrapeTool(server)
│       ├── map.ts            # registerMapTool(server)
│       ├── usage.ts          # registerUsageTool(server)
│       └── whoami.ts         # registerWhoamiTool(server)
├── test/
│   ├── server.test.ts        # InMemoryTransport: list tools, schema shape sanity
│   ├── tools/
│   │   ├── scrape.test.ts    # success + each error mapping, with mocked SDK
│   │   ├── map.test.ts
│   │   ├── usage.test.ts
│   │   └── whoami.test.ts
│   └── helpers/
│       └── mockClient.ts     # fake Crawlbrulee instance for tests
├── package.json
├── tsup.config.ts
├── tsconfig.json
├── vitest.config.ts
├── eslint.config.js
├── README.md
└── .gitignore
```

**package.json highlights:**

- `"name": "@crawlbrulee/mcp"`
- `"version": "0.1.0"`
- `"type": "module"`, `"bin": { "crawlbrulee-mcp": "dist/index.js" }`
- `"engines": { "node": ">=22" }` (matches CLI; SDK is `>=20` so we're
  fine taking the stricter bound)
- `"files": ["dist", "README.md"]`
- dependencies: `@crawlbrulee/sdk`, `@modelcontextprotocol/sdk`, `zod`
- devDeps: `tsup`, `typescript`, `vitest`, `@types/node`, `eslint`

**Build:** `tsup` produces a single bundled ESM `dist/index.js` with a
shebang, matching the CLI's approach. No `.cjs` build — MCP hosts run
the `bin` directly.

## Testing strategy

Two layers:

1. **Per-tool unit tests** (`test/tools/*.test.ts`) — instantiate the
   tool handler directly, inject a mocked `Crawlbrulee` instance, and
   verify:
   - Request shape passed to the SDK matches the tool input.
   - Success-path response shape (text block + structuredContent).
   - Each error class maps to the correct MCP error envelope.
2. **Integration round-trip** (`test/server.test.ts`) — use
   `InMemoryTransport` (paired client/server) from
   `@modelcontextprotocol/sdk`. Confirms:
   - `listTools` returns the four tools with their full descriptions.
   - Each `inputSchema` is non-empty and well-formed.
   - Tool calls go end-to-end through the server with a stubbed SDK.

Coverage target: every tool handler + every error class path. Single
source of truth for "does this MCP actually work" is the integration
test.

## Distribution

- Published to npm as `@crawlbrulee/mcp` (public).
- Hosted on GitHub at `crawlbrulee/crawlbrulee-mcp` (public). License
  added by the user later — not in v1.
- Install snippet in the README:
  ```
  claude mcp add crawlbrulee \
    --env CRAWLBRULEE_API_KEY=cble_... \
    -- npx -y @crawlbrulee/mcp
  ```
- CI: GitHub Actions — typecheck, lint, test, build on PR.
- Release: manual `npm publish` for v0.x. Automated release pipeline
  deferred to post-v1.

## Open questions / future work

- **Remote transport** — Notion ticket asks for HTTP+SSE in addition to
  stdio. Will ship as a separate `@crawlbrulee/mcp-remote` (or a `--http`
  flag) once the stdio path is stable in users' hands.
- **Async scrape exposure** — if real users hit sync timeouts often, add
  `scrape_submit` + `scrape_status` as opt-in tools (gated by a flag so
  the surface stays minimal by default).
- **`@crawlbrulee/types` extraction** — open ecosystem-level decision.
  When it lands, replace the vendored `src/schemas/` directory with an
  import from that package. Until then, manual sync.
- **Resources** — could surface OpenAPI spec / docs as MCP resources so
  agents can introspect deeper. YAGNI for v1.
