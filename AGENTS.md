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
`crawlbrulee/packages/shared/core/src/model/common/Api*.ts`. The ecosystem policy is that
tool repos do not import the shared subtree. When the canonical schemas change:

1. Copy the updated `Api*.ts` and supporting `ScrapeScreenshot*.ts` files into `src/schemas/`.
2. Keep the `// VENDORED from …` banner intact and update the path if the source moved.
3. Re-run `pnpm verify`.

A future `@crawlbrulee/types` npm package will replace this manual sync.

This is maintainer context — keep it out of the README, which is the public, customer-facing
surface for this package.
