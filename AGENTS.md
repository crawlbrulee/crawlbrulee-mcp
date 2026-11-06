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

## schemas

`src/schemas/*.ts` hold this server's request and response schemas, kept in step with the
public api by hand. responses are loose: every response object is `z.looseObject(...)` and
every response enum is `openEnum(...)`, so the server keeps working when the api adds a field
or a value. tools pass the whole output schema to `registerTool()`, never `.shape`. requests
stay strict. `test/responseTolerance.test.ts` pins this. run `pnpm verify` after any change.

## before a commit or release

this repository is public, and it has its own maintainer skill. reading that skill is part of
the pre-commit checks, and of every release. find it through the umbrella `crawlbrulee-ecosystem`
skill (path above), which names the skill for each repository, then check the change against it
before you run the tests. it may be absent if this repository was cloned on its own.

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
- then move the pin in `crawlbrulee-skills`: its plugin starts one exact version,
  because plugin stores refuse an unpinned launcher. change
  `npx -y @crawlbrulee/mcp@X.Y.Z` in `.mcp.json`, `mcp.json` and
  `gemini-extension.json` and the version in its readme, then give the skills
  repo a patch release (all six manifests, changelog), push `main`, then push its
  `vX.Y.Z` tag; the Gemini gallery only lists tagged repos. don't ship a
  lockfile with a `node ${CLAUDE_PLUGIN_ROOT}/node_modules/...` launcher there:
  Grok reads Claude's `.mcp.json` but never installs the lockfile (tried in
  skills 1.3.2, reverted in 1.3.3).
- then change the version by hand on cursor.directory: its listing holds its own
  copy of the install config, which a skills release does not update. signed in,
  open https://cursor.directory/plugins/crawlbrulee → "Plugin options" → Edit,
  set the version in the mcp server's `args`, keep the key as
  `"${env:CRAWLBRULEE_API_KEY}"`, then "Update Plugin". don't use "Re-scan": it
  reads Claude's `.mcp.json` and brings back `${user_config.api_key}`, which
  only Claude Code fills in.
