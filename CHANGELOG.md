# changelog

all notable changes to `@crawlbrulee/mcp` are documented here.

this project follows [Semantic Versioning](https://semver.org). while on `0.x`, minor versions may include breaking changes.

## 0.6.0 (2026-07-27)

### removed

- **the `cache.ignore_query_params` argument is gone** from `scrape` and `scrape_async`, because the
  api no longer accepts it and rejects requests carrying it. `cache.max_age` is now the only cache
  control.

### changed

- the `url` argument description now explains how the cache key is built: known tracking parameters
  (`utm_*`, `mtm_*`, `ga_*`, `pk_*`, `gclid`, `fbclid`, `msclkid`, and more) are stripped before the
  page is fetched, so they reach neither the target site nor the cache key, while every other query
  parameter is kept verbatim. the `map` url description states that mapping always targets the site
  root. both help an agent pick urls that actually hit the cache.

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
