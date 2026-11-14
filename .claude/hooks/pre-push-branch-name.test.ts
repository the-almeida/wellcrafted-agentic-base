import { execFileSync, spawnSync } from 'node:child_process'
import { mkdtempSync, rmSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { join, resolve } from 'node:path'

import { afterEach, describe, expect, it } from 'vitest'

const HOOK = resolve(__dirname, 'pre-push-branch-name.sh')
const RANDOM_BRANCH = 'claude/nifty-cray-c5i9qp'

const repos: string[] = []

// Isolate from the caller's git state: the suite also runs inside .husky/pre-push,
// where GIT_* vars point at the real repo, and global config may sign commits.
const cleanEnv = {
  ...Object.fromEntries(Object.entries(process.env).filter(([k]) => !k.startsWith('GIT_'))),
  GIT_CONFIG_GLOBAL: '/dev/null',
  GIT_CONFIG_NOSYSTEM: '1',
}

function repoOn(branch: string | null): string {
  const dir = mkdtempSync(join(tmpdir(), 'branch-hook-'))
  repos.push(dir)
  const git = (...args: string[]) =>
    execFileSync('git', args, { cwd: dir, env: cleanEnv, stdio: 'ignore' })
  git('init', '-q', '-b', 'main')
  git('-c', 'user.email=t@t', '-c', 'user.name=t', 'commit', '-q', '--allow-empty', '-m', 'init')
  if (branch === null) git('checkout', '-q', '--detach')
  else git('checkout', '-q', '-b', branch)
  return dir
}

function runHook(opts: {
  command?: string
  branch?: string | null
  remote?: string
  rawInput?: string
}) {
  const dir = repoOn(opts.branch === undefined ? RANDOM_BRANCH : opts.branch)
  const input =
    opts.rawInput ?? JSON.stringify({ tool_name: 'Bash', tool_input: { command: opts.command } })
  return spawnSync('bash', [HOOK], {
    input,
    encoding: 'utf8',
    env: { ...cleanEnv, CLAUDE_CODE_REMOTE: opts.remote ?? 'true', CLAUDE_PROJECT_DIR: dir },
  })
}

afterEach(() => {
  while (repos.length) rmSync(repos.pop()!, { recursive: true, force: true })
})

describe('pre-push-branch-name hook', () => {
  it('allows a push from a branch named claude/<type>-<slug>', () => {
    const r = runHook({ command: 'git push', branch: 'claude/feat-audit-log' })
    expect(r.status).toBe(0)
  })

  it('blocks a push from a random session branch and explains the rename', () => {
    const r = runHook({ command: 'git push -u origin HEAD' })
    expect(r.status).toBe(2)
    expect(r.stderr).toContain(RANDOM_BRANCH)
    expect(r.stderr).toContain('claude/<type>-<slug>')
    expect(r.stderr).toContain('git branch -m')
  })

  it('does nothing outside cloud sessions', () => {
    const r = runHook({ command: 'git push', remote: 'false' })
    expect(r.status).toBe(0)
  })

  it.each(['git status', 'echo "git push"', 'git push-something', 'gitpush'])(
    'ignores non-push command: %s',
    (command) => {
      expect(runHook({ command }).status).toBe(0)
    },
  )

  it('checks a push at the end of a command chain', () => {
    const r = runHook({ command: 'git add . && git commit -m x; git push' })
    expect(r.status).toBe(2)
  })

  it('checks a push with git global options', () => {
    expect(runHook({ command: 'git -C . push' }).status).toBe(2)
  })

  it('allows the rename step: pushing a well-named branch from the random one', () => {
    const r = runHook({ command: 'git push -u origin claude/chore-branch-name-guard' })
    expect(r.status).toBe(0)
  })

  it.each([
    ['plain destination', `HEAD:${RANDOM_BRANCH}`],
    ['refs/heads/ destination', `HEAD:refs/heads/${RANDOM_BRANCH}`],
    ['force-prefixed refspec', `+HEAD:${RANDOM_BRANCH}`],
  ])('blocks a src:dst refspec by its destination (%s)', (_case, refspec) => {
    expect(runHook({ command: `git push origin ${refspec}`, branch: 'claude/fix-x' }).status).toBe(
      2,
    )
  })

  it('allows a refs/heads/ destination that is well named', () => {
    expect(runHook({ command: 'git push origin HEAD:refs/heads/claude/fix-x' }).status).toBe(0)
  })

  it('does not mistake a push option value for the remote', () => {
    const r = runHook({ command: 'git push -o ci.skip origin claude/feat-x' })
    expect(r.status).toBe(0)
  })

  it.each([
    `git push origin --delete ${RANDOM_BRANCH}`,
    `git push origin -d ${RANDOM_BRANCH}`,
    `git push origin :${RANDOM_BRANCH}`,
  ])('allows deleting the old random branch: %s', (command) => {
    expect(runHook({ command }).status).toBe(0)
  })

  it('fails open on a detached HEAD', () => {
    expect(runHook({ command: 'git push', branch: null }).status).toBe(0)
  })

  it.each([
    'claude/feature-x',
    'claude/feat-',
    'claude/feat-Foo',
    'claude/feat-a_b',
    'claude/feat',
  ])('blocks a malformed branch name: %s', (branch) => {
    expect(runHook({ command: 'git push', branch }).status).toBe(2)
  })

  it.each(['', 'not json', '{}'])('fails open on malformed input: %j', (rawInput) => {
    const r = runHook({ rawInput })
    expect(r.status).toBe(0)
    expect(r.stdout + r.stderr).toBe('')
  })
})
