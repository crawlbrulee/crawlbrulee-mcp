# Agent context

This file is auto-loaded by coding agents (Claude Code, Codex, Gemini CLI, and others).

## crawlbrulee ecosystem

This repository is one component of the broader crawlbrulee ecosystem of related projects.
The authoritative `crawlbrulee-ecosystem` skill — the full map of related projects,
shared-code locations, and the cross-project conventions — lives one level up, in the
maintainer's umbrella checkout:

    ../.agents/skills/crawlbrulee-ecosystem/SKILL.md

Read it from there when you need the bigger picture. It may be absent if this repository
was cloned on its own. It is also exposed locally as the `crawlbrulee-ecosystem` skill
(`.agents/skills/crawlbrulee-ecosystem/`), which agents discover via the
`.claude/skills` symlink.

## Schema sync

The `src/schemas/*.ts` files are **vendored copies** of the canonical Zod schemas in
`crawlbrulee/packages/core/src/model/common/Api*.ts`. The ecosystem policy is that
tool repos do not import the shared subtree. When the canonical schemas change:

1. Copy the updated `Api*.ts` and supporting `ScrapeScreenshot*.ts` files into `src/schemas/`.
2. Keep the `// VENDORED from …` banner intact and update the path if the source moved.
3. Re-apply the known divergences below — a verbatim copy will silently undo them.
4. Re-run `pnpm verify`.

### Known deliberate divergences from canonical

⚠️ This repo is **public** and its `dist/` ships to npm. Some canonical enums are wider than
the supported public surface, and the extra members are internal — they must not appear in
this repo at all: not in an enum, a type, a comment, a doc, or a changelog. Treat "what the
public list is" as the only thing expressible here.

- **`proxy` request enum** (`ApiScrapeRequest.ts`, `ApiMapRequest.ts`) is exactly
  `['basic', 'advanced', 'auto']`. Canonical's is wider. **Never widen it on re-sync** — a
  verbatim copy will silently do so, and tree-shaking does _not_ drop the unused values from
  the published bundle.
- **`proxy` response enum** (`ApiScrapeResponse.ts`) is exactly `['basic', 'advanced']`.
- **Responses are loose, requests are not.** Every response object is `z.looseObject(...)` and every
  response enum is `openEnum(...)` (`src/schemas/openEnum.ts`: the known values, plus any string).
  Canonical uses `z.object` / `z.enum`; a verbatim re-copy undoes this, and the published server then
  breaks the day the api adds a field. Tools pass the **whole** output schema to `registerTool()`,
  never `.shape` — with `.shape` the MCP SDK wraps it in its own strict object. Request schemas stay
  strict. `test/responseTolerance.test.ts` pins all of this.
- **Fields the api added later are optional here.** `page_status_code` and the usage parts
  (`total_credit_cost`, `engine_credit_cost`, `proxy_multiplier`, `screenshot_slicing_credit_cost`)
  are required in canonical but `.optional()` here, because older api versions do not send them.
  `proxy_multiplier` is an open `z.number().int().positive()`, not canonical's `1 | 5` literal union,
  for the same reason as `openEnum`. The old names `credits` / `screenshot_slices` are gone from the
  schemas; the output objects are loose, so a response that still carries them validates.
- **`extract.elements`** (`ScrapeElementsSchemas.ts`) mirrors canonical's `ScrapeElements*` shape and
  the public per-string limits only. The 50-selector total, the CSS syntax check and the element
  name length (1–100 characters, not in the public spec) are left to the api (a clear 400). The
  response is looser than canonical: `elements` is a record keyed by name, but each value is
  `z.unknown()`. Canonical's value shape (a string, null, a record or a list, nested 3 levels)
  lives only in the field description. A strict value would fail the whole tool call on one value
  the schema does not expect. Do not re-copy canonical's value schema.

The public list is mirrored by hand from `PUBLIC_API_PROXY_TIER_VALUES` in
`crawlbrulee/packages/core/src/model/common/ApiScrapeRequest.ts` (it cannot be imported here
— vendor policy), and must be updated in lockstep with the JS/Python SDK types and the CLI
parser. After any schema sync, verify the built bundle exposes only the public tiers.

These copies stay: there is no shared schema package (decided 2026-09-25). Each tool keeps its
own definitions and they are adjusted by hand when the api changes.

This is maintainer context — keep it out of the README, which is the public, customer-facing
surface for this package.

## releasing

a release is a `vX.Y.Z` tag pushed on a commit that is already on `main`. the publish
workflow refuses a tag whose commit is not on `origin/main` or whose version doesn't match
`package.json`, runs the checks, publishes with trusted publishing (no tokens anywhere) and
creates the GitHub release.

- bump the version in every place it lives: `package.json`, both `version` fields in `server.json`, and `SERVER_VERSION` in `src/version.ts`.
- add a dated `CHANGELOG.md` entry. a version that is already published is final: later
  changes get a new version, never an edit to the old entry. check the registry, not local
  tags, to see what is out.
- CI installs with `--frozen-lockfile`. after a new `@crawlbrulee/sdk` is on npm, raise the
  range in `package.json` and run `pnpm install` to refresh `pnpm-lock.yaml` before you tag.
- the official MCP registry is a separate step: once the npm publish has finished, run the
  `Publish to MCP Registry` workflow by hand (`gh workflow run "Publish to MCP Registry" --ref main`).
  the registry checks the npm package for the same `mcpName`.
