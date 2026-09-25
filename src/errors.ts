import { ENV_API_KEY, isCrawlbruleeError } from '@crawlbrulee/sdk'
import type { CrawlbruleeError } from '@crawlbrulee/sdk'

/**
 * Tool-result envelopes. The index signatures match the MCP SDK's
 * `CallToolResult` shape so they can be returned directly from a
 * registered tool handler.
 */
export interface ToolErrorResult {
  isError: true
  content: Array<{ type: 'text'; text: string }>
  [key: string]: unknown
}

export interface ToolSuccessResult<T> {
  content: Array<{ type: 'text'; text: string }>
  structuredContent: T
  [key: string]: unknown
}

/**
 * Build a tool success envelope from an SDK result. The JSON-stringified
 * body is what non-structured-aware hosts display; `structuredContent`
 * carries the typed payload for hosts that respect the output schema.
 */
export function toToolSuccess<T>(result: T): ToolSuccessResult<T> {
  return {
    content: [{ type: 'text', text: JSON.stringify(result, null, 2) }],
    structuredContent: result,
  }
}

/**
 * Run an SDK call and wrap the outcome in the appropriate MCP envelope.
 * All four tool handlers share this shape — keeps them down to a one-line
 * forward to the SDK.
 */
export async function runTool<T>(
  fn: () => Promise<T>
): Promise<ToolSuccessResult<T> | ToolErrorResult> {
  try {
    return toToolSuccess(await fn())
  } catch (err) {
    return toToolError(err)
  }
}

const MISSING_API_KEY_REMEDIATION =
  `${ENV_API_KEY} is not set on the MCP host. Add --env ${ENV_API_KEY}=cwbl_... to your ` +
  `"claude mcp add" command (or the equivalent env block in your MCP client config), then restart the host.`

/**
 * Map any thrown value into the MCP tool-error envelope. SDK errors carry
 * stable `errorName` codes and HTTP `status`; both go into the surfaced
 * message so the calling agent can branch on them (e.g. back off and retry on
 * `too_many_requests` or `service_unavailable` — a transient backend failure,
 * not a bad key — and prompt the user on `invalid_credentials`). A few codes get
 * a short next step appended (see ERROR_HINTS).
 *
 * One special case: the SDK throws a generic `CrawlbruleeError` (status 0,
 * errorName null) when `CRAWLBRULEE_API_KEY` is missing. We rewrite that
 * to a clearer `missing_api_key` code with setup guidance.
 */
export function toToolError(err: unknown): ToolErrorResult {
  if (isCrawlbruleeError(err)) {
    if (isMissingApiKeyError(err)) {
      return textErrorResult(`[missing_api_key] ${MISSING_API_KEY_REMEDIATION}`)
    }
    return crawlbruleeErrorResult(err)
  }
  const message = err instanceof Error ? err.message : String(err)
  return textErrorResult(`[internal_error] ${message}`)
}

function isMissingApiKeyError(err: CrawlbruleeError): boolean {
  return err.status === 0 && err.errorName === null && err.message.includes(ENV_API_KEY)
}

/**
 * A next step for codes whose api message alone does not tell an agent what to
 * do. Added after the stable `[code] message (HTTP status)` prefix, so anything
 * that branches on the code keeps working.
 *
 * `target_unreachable` arrives as a plain `CrawlbruleeError` (the SDK has no class
 * for it yet), so it is matched by name.
 */
const ERROR_HINTS: Readonly<Record<string, string>> = {
  target_unreachable:
    'We could not reach the site: it did not answer, took too long, or its certificate was not valid. ' +
    'Retry later or check the URL. Not billed. ' +
    'This is not the same as a page that says "not found": a page the site served comes back as a result, with its status in page_status_code.',
}

function crawlbruleeErrorResult(err: CrawlbruleeError): ToolErrorResult {
  const code = err.errorName ?? 'crawlbrulee_error'
  const httpPart = err.status > 0 ? ` (HTTP ${err.status})` : ''
  const hint = ERROR_HINTS[code]
  const hintPart = hint ? ` ${hint}` : ''
  return textErrorResult(`[${code}] ${err.message}${httpPart}${hintPart}`)
}

function textErrorResult(text: string): ToolErrorResult {
  return { isError: true, content: [{ type: 'text', text }] }
}
