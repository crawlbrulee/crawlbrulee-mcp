import { readFileSync } from 'node:fs'
import { dirname, resolve } from 'node:path'
import { fileURLToPath } from 'node:url'
import { describe, expect, test } from 'vitest'

import { SERVER_VERSION } from '../src/version.js'

const packageVersion = JSON.parse(
  readFileSync(resolve(dirname(fileURLToPath(import.meta.url)), '../package.json'), 'utf8')
).version as string

describe('SERVER_VERSION', () => {
  test('matches the version in package.json', () => {
    expect(SERVER_VERSION).toBe(packageVersion)
  })
})
