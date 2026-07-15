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

The public list is mirrored by hand from `PUBLIC_API_PROXY_TIER_VALUES` in
`crawlbrulee/packages/core/src/model/common/ApiScrapeRequest.ts` (it cannot be imported here
— vendor policy), and must be updated in lockstep with the JS/Python SDK types and the CLI
parser. After any schema sync, verify the built bundle exposes only the public tiers.

A future `@crawlbrulee/types` npm package will replace this manual sync.

This is maintainer context — keep it out of the README, which is the public, customer-facing
surface for this package.
