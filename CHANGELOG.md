# changelog

all notable changes to `@crawlbrulee/mcp` are documented here. the format loosely
follows [keep a changelog](https://keepachangelog.com); this project is pre-1.0, so
minor `0.x` bumps may carry contract changes.

## 0.4.0

syncs the vendored schemas to the api contract shipped 2026-07-13.

### changed

- **default proxy tier is now `auto`** (was `basic`) when `proxy` is omitted on
  `scrape`, `scrape_async`, and `map`. allowed values are unchanged (`basic`,
  `advanced`, `auto`, `none`); `auto` starts on the basic tier and escalates to
  advanced on failure. the resolved tier is still reported back in
  `response_meta.usage.proxy`.
- **screenshot custom viewport is bounded**: `width`/`height` are integers in
  `16–10000`, and `device_scale_factor` is `1–4` (fractional allowed, defaults 1).
- **api token examples use the new `cwbl_` prefix** (`cwbl_staging_` on staging).
  existing `cble_` tokens keep working — no validation change.
- **async job status is uniformly snake_case** (`job_id`, `created_at`), matching
  the live wire contract; the old camelCase status schema was dropping those fields.
- extracted `images` are now returned as absolute urls with query strings
  preserved, and relative `src`s resolved against the page url (documented; no
  schema change).
- bumped the `@crawlbrulee/sdk` peer to `^0.6.0`.

### notes

- in rare cases a screenshot can't be captured; when that happens the `screenshot`
  field is simply left out and the rest of the requested outputs are still returned
  (the response schema keeps it optional).
- this release folds in the previously-unreleased status-casing / proxy-default /
  viewport-bounds / `cwbl_` work committed after 0.3.0.

## 0.3.0

- surfaced `response_meta.usage` (credits, resolved proxy tier, cache-hit) in tool
  outputs.
- added the async scrape tools: `scrape_async`, `scrape_status`, `scrape_result`.
