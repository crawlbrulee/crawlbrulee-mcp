# changelog

all notable changes to `@crawlbrulee/mcp` are documented here.

this project follows [Semantic Versioning](https://semver.org). while on `0.x`, minor versions may include breaking changes.

## 1.0.1 (2026-09-21)

### changed

- **readme and package description rewritten.** they now lead with what crawlbrulee is: EU-native web
  scraping for AI agents & developers. new npm keywords. no code or tool changes.

## 1.0.0 (2026-09-21)

### changed

- **first stable release.** no code or tool changes since 0.13.1. from here on, breaking changes
  only come in a new major version.
- **license changed from `AGPL-3.0-only` to `Apache-2.0`.** no code or api changes.
- **readme: the beta status note is gone.** the server is stable.
- **now built on `@crawlbrulee/sdk` `^1.0.0`**, the first Apache-2.0 sdk release, so the whole install
  is Apache-2.0.

## 0.13.1 (2026-09-20)

### fixed

- **a `map` call no longer fails when discovery reports `unread_files`.** the api added
  `unread_files` to `truncation.discovery_cap_reason`, but this server's response schema only
  accepted the five older reasons, so such a map came back as an output validation error instead
  of the map. the schema now accepts `unread_files` and the map is returned.

### changed

- the `map` tool description and the `discovery_cap_reason` field description now explain
  `unread_files`: a sitemap file the site publishes could not be read at all this time, which is
  often temporary — so asking again later can return more. `time`, `file_budget`, `depth` and
  `file_size` still mean a retry will not help, and `max_urls` is still the only limit you can
  raise from the request.

## 0.13.0 (2026-09-17)

### changed

- **the `http` engine replaces `text`.** the `scrape`, `scrape_status`, `scrape_result`, and `map`
  responses now report `engine: "http"` when the plain fetch engine delivered the result (no
  JavaScript ran). they used to report `"text"`. the response schemas accept `http`,
  `browser`, `screenshot`, and `cache` (map: `http` and `cache`). the credit base is unchanged.
  pair this release with the api that reports `http`: older servers return `text`, which this
  version's response schema rejects, and older releases of this server reject `http`.

## 0.12.0 (2026-09-13)

### changed

- **`map` defaults are smaller: `max_urls` is now `5000` (was `100000`) and `limit` is now `5000`
  (was `10000`).** the maximums are unchanged (`100000` / `10000`). `max_urls` is a discovery
  budget, not a trim at the end — discovery stops as soon as that many urls are found, so a
  smaller value is a faster, cheaper crawl.
- **`map` response `truncation` gained three fields**: `discovery_capped` (discovery stopped
  before reading every sitemap file), `sitemaps_skipped` (files skipped or only partly read), and
  `discovery_cap_reason` (`max_urls`, `time`, `file_budget`, `depth`, `file_size`, or `null`).
  a map stopped by your own `max_urls` returns exactly that many links with
  `response_capped: false`, so `discovery_cap_reason` is the signal that the site has more —
  only `max_urls` is worth a retry.
- the `map` tool description now states the defaults, the url form of the returned links (the same
  normalization `scrape` applies to its returned `url`), and the result ordering.
- documents the api's new `too_many_redirects` error code (HTTP 422: the origin redirected
  the fetch in a loop). surfaced like every other api error code; no tool schema changed.
- documents the api's new `page_too_large` error code (HTTP 422: the page's html was too large
  to process). it is terminal — the same url fails the same way, so never retry it. surfaced
  like every other api error code; no tool schema changed.

## 0.10.0 (2026-09-02)

### changed

- map usage now reports only `credits`, `engine`, and `proxy`; scrape and async usage retain
  `screenshot_slices`. the map schema accepts only `text` or `cache` as its billing engine.

## 0.9.0 (2026-08-30)

### changed

- **the `response_meta.usage` output now reports `engine` and `screenshot_slices` instead of
  `cache_hit`.** `engine` is the billed engine (`text`, `browser`, `screenshot`, or `cache`),
  and `screenshot_slices` is the nonnegative slice add-on count. a cache hit is represented by
  `engine: "cache"`.
- **requires `@crawlbrulee/sdk` `^0.12.0`**, which carries the engine-aware usage contract.

## 0.8.1 (2026-08-17)

### fixed

- **the MCP initialize handshake reports the current package version again.** the published
  0.8.0 package still announced itself as 0.7.0. a version-lockstep test now guards the
  package metadata and handshake version.

### changed

- **`@crawlbrulee/sdk` moved to `^0.11.1`**, carrying the improved advanced proxy tier
  documentation. no MCP tool input, output, or behavior changed.

## 0.8.0 (2026-08-14)

### changed

- **`device_scale_factor` max lowered `4` → `3`** in the scrape tool's input schema,
  matching the api (the backend now rejects `dsf > 3` with a `400` — raster memory
  scales with dsf² and `4` cost 16× the dsf-1 pixels for no machine-reading gain).
  `device_scale_factor: 4` now fails local validation inside the MCP server instead
  of reaching the api.
- **the `warnings` output description now names every code an agent can see** —
  `screenshot_truncated`, `links_truncated`, `inline_images_truncated`,
  `raw_html_truncated`, `metadata_truncated` — instead of `screenshot_truncated` alone.
  the description ships to the model as part of the `scrape` / `scrape_result` output
  schema, so an agent can now tell truncated output from complete output without a doc
  lookup. no schema shape change: `warnings` is still an optional array of strings.
- **the `extract` argument descriptions carry the per-page caps**: 30,000 links,
  10,000 inline images, 10,000,000 characters of body html, 2,000,000 characters of head
  html. past a cap the output is truncated (never silently) and the matching
  `*_truncated` warning is returned. the `scrape` tool description says the same, so the
  limits are visible before the call as well as after it.
- **the `warnings` description now covers the `*_unavailable` codes** —
  `links_unavailable`, `inline_images_unavailable`, `metadata_unavailable` — which say that
  section's extraction failed and the field came back omitted or empty while the rest of
  the scrape succeeded. this matters more for an agent than for a human caller: an empty
  `links` array reads as "this page has no links" and gets reported as a finding, so both
  the tool description and the output schema now say explicitly that an empty field
  carrying one of these codes is unread, not absent, and the call should be retried.
- **the `warnings` description no longer claims cache hits omit warnings.** they are stored
  with the result now, so `scrape_result` fetches and cache hits carry the same codes,
  filtered to the fields the request asked for.
- **`@crawlbrulee/sdk` moved to `^0.11.0`** (from `^0.10.0`), picking up
  `ServiceUnavailableError` and the `ScrapeWarningCode` union. a `^` range on a `0.x`
  dependency pins the minor, so this had to move by hand for the server to run against
  the sdk release that carries the codes described above.

### docs

- the readme's warnings section enumerates all five codes and what each one means for the
  payload, and the error table gains `service_unavailable` — a temporary backend failure
  (HTTP 503) that says nothing about your key, so retry it with backoff rather than
  rotating credentials. the error-mapping guidance in the code now names
  `too_many_requests` (the real rate-limit code) and `service_unavailable` as the
  retryable pair.
- the readme status line reports the current version again (it still said `v0.7.0`).

## 0.7.1 (2026-08-03)

### changed

- **requires `@crawlbrulee/sdk` `^0.10.0`**, which drops `overage_hard_cap` from
  `UsageAllocationReason`. the api now reports every credit-exhaustion refusal as
  `credit_limit`. no tool output or input schema changes — this server never surfaced the
  reason code directly, so the bump is here to keep the sdk floor current rather than to
  change behaviour.

## 0.7.0 (2026-07-28)

### added

- **`requested_url` in the `scrape` / `scrape_result` output schemas** — the url you requested,
  echoed verbatim, before any redirects. the `url` field description now spells out what it always
  was: the url actually scraped, after any redirects, in normalized form (the
  fragment removed) — the base that links, images, and internal labels are computed against.

### changed

- **requires `@crawlbrulee/sdk` `^0.9.0`**.
- corrected the cache-billing descriptions: credits are `0` on a fully cached result; only parts
  still computed fresh (e.g. a newly produced screenshot-slice variant) are charged.
- corrected the `links` descriptions: `href` is the link as written on the page resolved to an
  absolute url, verbatim otherwise (query string, fragment, and duplicates preserved); `internal`
  treats www and the bare domain as equivalent, other subdomains as external.
- documented what happens when a screenshot can't be captured: if other outputs were requested the
  `screenshot` field is left out and the rest is returned, but a screenshot-only call errors with
  `unsupported_screenshot_output` (HTTP 422) when the content type can't be screenshotted — and
  isn't billed. the readme error table now carries the new code.

### fixed

- the server again reports its real package version over MCP (0.6.0 had drifted and reported
  itself as 0.5.0).

## 0.6.0 (2026-07-27)

### removed

- **the `cache.ignore_query_params` argument is gone** from `scrape` and `scrape_async`, because the
  api no longer accepts it and rejects requests carrying it. `cache.max_age` is now the only cache
  control.

### changed

- the `url` argument description now explains that known tracking parameters are stripped before
  the page is fetched, so they reach neither the target site nor the cache key, while every other
  query parameter is kept verbatim. the `map` url description states that mapping always targets
  the site root. both help an agent pick urls that actually hit the cache.

## 0.5.1 (2026-07-19)

### changed

- internal: the server is now built with tsdown (previously tsup) on TypeScript 6. no changes to the
  tools, their schemas, or runtime behaviour.

## 0.5.0 (2026-07-15)

### changed

- **requires `@crawlbrulee/sdk` `^0.7.0`**.
- **the `proxy` argument on `scrape`, `scrape_async`, and `map` now accepts exactly the supported
  tiers** — `basic`, `advanced`, `auto` (default). any value outside these was already rejected by
  the api, so no working call changes.

### fixed

- the server now reports its real package version over MCP (it had drifted behind the release).

## 0.4.0 (2026-07-14)

tracks a wave of server-side behavior changes. no tools were removed or renamed.

### changed

- **requires `@crawlbrulee/sdk` `^0.6.0`** (built against the updated response contract).
- **default proxy tier is now `auto`** (was `basic`) when `proxy` is omitted on `scrape`,
  `scrape_async`, and `map`. allowed values are unchanged (`basic`, `advanced`, `auto`);
  `auto` starts on the basic tier and escalates to advanced on failure. the resolved tier is
  still reported back in `response_meta.usage.proxy`.
- **custom screenshot viewport is bounded**: `width`/`height` are integers in `16–10000`, and
  `device_scale_factor` is in `1–4` (fractional allowed, defaults to `1`).
- **async job status is uniformly snake_case** (`job_id`, `created_at`), matching the live wire
  contract; the old camelCase status schema was dropping those fields.

### notes

- **screenshots.** in the rare case a screenshot can't be captured, the `screenshot` field is
  left out and the rest of the requested outputs are still returned (the response schema keeps
  it optional).
- **extracted `images`** are now returned as absolute urls: relative `src`s resolve against the
  full page url and query strings are preserved. no schema change.

## 0.3.0 (2026-07-03)

### added

- **`response_meta.usage` in tool outputs** — credits charged, the resolved proxy tier, and
  whether the result was served from cache.
- the async scrape tools: `scrape_async`, `scrape_status`, `scrape_result`.
