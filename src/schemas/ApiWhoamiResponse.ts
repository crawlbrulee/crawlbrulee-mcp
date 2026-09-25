// VENDORED from crawlbrulee/packages/core/src/model/common/ApiWhoamiResponse.ts
// Keep in sync with the canonical source on schema bumps.

import { z } from 'zod'

export const Schema_ApiWhoamiResponse = z.looseObject({
  organization_name: z.string().describe('Display name of the organization that owns the token.'),
  token_name: z
    .string()
    .describe('User-assigned name of the API token authenticating the request.'),
  token_preview: z
    .string()
    .describe(
      'Truncated preview of the API token (e.g. `cwbl_…xyz`). Safe to display; does not authenticate.'
    ),
})

export type ApiWhoamiResponse = z.infer<typeof Schema_ApiWhoamiResponse>
