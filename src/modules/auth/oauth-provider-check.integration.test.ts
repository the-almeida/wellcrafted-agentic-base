import { execFile, type ExecFileException } from 'node:child_process'
import { createServer, type IncomingHttpHeaders, type Server } from 'node:http'
import type { AddressInfo } from 'node:net'
import { readFileSync } from 'node:fs'
import { resolve } from 'node:path'

import { afterEach, describe, expect, it } from 'vitest'

import { env } from '@/shared/lib/env'

// Runs the check exactly as `pnpm build` does, with the same Node flags taken
// from package.json: a separate process whose exit code decides whether the
// build continues. The env-file flag is harmless here: Node never lets the
// file override variables that are already set, and every test sets its own.
const ROOT = resolve(__dirname, '../../..')
const [node, ...NODE_ARGS] = (
  JSON.parse(readFileSync(resolve(ROOT, 'package.json'), 'utf8')) as {
    scripts: Record<string, string>
  }
).scripts['check:oauth-providers']!.split(' ')
if (node !== 'node') throw new Error('check:oauth-providers is expected to run node directly')

type Run = { code: number; stdout: string; stderr: string }

function runCheck(vars: Record<string, string>): Promise<Run> {
  return new Promise((done) => {
    execFile(
      process.execPath,
      NODE_ARGS,
      {
        cwd: ROOT,
        env: {
          // Required by the project's ProcessEnv type; `pnpm build` runs with it too.
          NODE_ENV: 'production',
          PATH: process.env.PATH,
          SystemRoot: process.env.SystemRoot,
          NEXT_PUBLIC_SUPABASE_ANON_KEY: env.NEXT_PUBLIC_SUPABASE_ANON_KEY,
          GOOGLE_OAUTH_CLIENT_ID: '',
          FACEBOOK_OAUTH_CLIENT_ID: '',
          ...vars,
        },
        encoding: 'utf8',
        timeout: 20_000,
      },
      (error: ExecFileException | null, stdout: string, stderr: string) => {
        const code = error ? (typeof error.code === 'number' ? error.code : 1) : 0
        done({ code, stdout, stderr })
      },
    )
  })
}

// Stands in for Supabase Auth so error paths can be exercised.
let stub: Server | undefined
const seenHeaders: IncomingHttpHeaders[] = []

async function startStub(status: number, body: string): Promise<string> {
  stub = createServer((req, res) => {
    seenHeaders.push(req.headers)
    res.writeHead(status, { 'content-type': 'application/json' })
    res.end(body)
  })
  await new Promise<void>((ready) => stub!.listen(0, '127.0.0.1', ready))
  return `http://127.0.0.1:${(stub.address() as AddressInfo).port}`
}

const settings = (external: Record<string, boolean>) =>
  JSON.stringify({
    external: { email: true, phone: false, google: false, facebook: false, ...external },
  })

afterEach(async () => {
  seenHeaders.length = 0
  if (stub) await new Promise((closed) => stub!.close(closed))
  stub = undefined
})

describe('scripts/check-oauth-providers.mts', () => {
  it('passes against the local Supabase in the repository default state', async () => {
    const run = await runCheck({ NEXT_PUBLIC_SUPABASE_URL: env.NEXT_PUBLIC_SUPABASE_URL })

    expect(run.stderr).toBe('')
    expect(run.code).toBe(0)
  })

  it('fails the build and names the provider when the app and Supabase disagree', async () => {
    const url = await startStub(200, settings({ google: true }))

    const run = await runCheck({ NEXT_PUBLIC_SUPABASE_URL: url })

    expect(run.code).toBe(1)
    expect(run.stderr).toContain(
      'Google is enabled in Supabase, but GOOGLE_OAUTH_CLIENT_ID is not set in the app.',
    )
  })

  it('fails the build when Facebook is active without the app secret', async () => {
    const url = await startStub(200, settings({ facebook: true }))
    const facebook = { NEXT_PUBLIC_SUPABASE_URL: url, FACEBOOK_OAUTH_CLIENT_ID: 'facebook-id' }

    const missing = await runCheck({ ...facebook, FACEBOOK_OAUTH_CLIENT_SECRET: '' })
    const configured = await runCheck({ ...facebook, FACEBOOK_OAUTH_CLIENT_SECRET: 'app-secret' })

    expect(missing.code).toBe(1)
    expect(missing.stderr).toContain('FACEBOOK_OAUTH_CLIENT_SECRET is not')
    expect(missing.stderr).toContain('data deletion callback')
    // Same Supabase answer, only the secret differs.
    expect(configured.code).toBe(0)
  })

  it('lists the missing Facebook secret together with provider mismatches', async () => {
    const url = await startStub(200, settings({ facebook: true, google: true }))

    const run = await runCheck({
      NEXT_PUBLIC_SUPABASE_URL: url,
      FACEBOOK_OAUTH_CLIENT_ID: 'facebook-id',
      FACEBOOK_OAUTH_CLIENT_SECRET: '',
    })

    expect(run.code).toBe(1)
    expect(run.stderr).toContain('Google is enabled in Supabase, but GOOGLE_OAUTH_CLIENT_ID')
    expect(run.stderr).toContain('FACEBOOK_OAUTH_CLIENT_SECRET is not')
  })

  it('reads the settings with the anon key and never prints it', async () => {
    const url = await startStub(200, settings({ google: true }))

    const run = await runCheck({ NEXT_PUBLIC_SUPABASE_URL: url })

    expect(seenHeaders[0]?.apikey).toBe(env.NEXT_PUBLIC_SUPABASE_ANON_KEY)
    expect(run.stdout + run.stderr).not.toContain(env.NEXT_PUBLIC_SUPABASE_ANON_KEY)
  })

  it('fails the build when Supabase answers with an error', async () => {
    const url = await startStub(401, '{"message":"Invalid API key"}')

    const run = await runCheck({ NEXT_PUBLIC_SUPABASE_URL: url })

    expect(run.code).toBe(1)
    expect(run.stderr).toContain(`${url}/auth/v1/settings`)
    expect(run.stderr).toContain('401')
  })

  it('fails the build when the answer is not the settings JSON', async () => {
    const url = await startStub(200, '<html>not supabase</html>')

    const run = await runCheck({ NEXT_PUBLIC_SUPABASE_URL: url })

    expect(run.code).toBe(1)
    expect(run.stderr).toContain(`${url}/auth/v1/settings`)
  })

  it.each([
    ['an array', '{"external":["google"]}'],
    ['a non-boolean flag', '{"external":{"email":true,"google":"true"}}'],
  ])('fails the build when external is %s instead of provider flags', async (_label, body) => {
    const url = await startStub(200, body)

    const run = await runCheck({ NEXT_PUBLIC_SUPABASE_URL: url })

    expect(run.code).toBe(1)
    expect(run.stderr).toContain(`${url}/auth/v1/settings did not return Supabase Auth settings`)
  })

  it('fails the build instead of following a redirect', async () => {
    const target = await startStub(200, settings({}))
    const redirector = createServer((_req, res) => {
      res.writeHead(302, { location: `${target}/auth/v1/settings` })
      res.end()
    })
    await new Promise<void>((ready) => redirector.listen(0, '127.0.0.1', ready))
    const url = `http://127.0.0.1:${(redirector.address() as AddressInfo).port}`
    try {
      const run = await runCheck({ NEXT_PUBLIC_SUPABASE_URL: url })

      expect(run.code).toBe(1)
      expect(run.stderr).toContain(`${url}/auth/v1/settings`)
      expect(seenHeaders).toHaveLength(0)
    } finally {
      await new Promise((closed) => redirector.close(closed))
    }
  })

  it('fails the build with a hint when Supabase cannot be reached', async () => {
    // A port that was just free and is closed again, so nothing listens on it.
    const url = await startStub(200, '{}')
    await new Promise((closed) => stub!.close(closed))
    stub = undefined

    const run = await runCheck({ NEXT_PUBLIC_SUPABASE_URL: url })

    expect(run.code).toBe(1)
    expect(run.stderr).toContain(`${url}/auth/v1/settings`)
    expect(run.stderr).toContain('pnpm exec supabase start')
  })

  it('fails the build when the Supabase URL is missing', async () => {
    const run = await runCheck({ NEXT_PUBLIC_SUPABASE_URL: '' })

    expect(run.code).toBe(1)
    expect(run.stderr).toContain('NEXT_PUBLIC_SUPABASE_URL is not set.')
  })
})
