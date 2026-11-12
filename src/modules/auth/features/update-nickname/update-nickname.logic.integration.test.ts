import { randomUUID } from 'node:crypto'

import { eq, sql } from 'drizzle-orm'
import { afterEach, describe, expect, it } from 'vitest'

import { db } from '@/shared/db/client'
import { users } from '@/shared/db/schema/auth'
import { cleanupAuthUser, createTestUser } from '@/shared/db/test-helpers'
import { UserIdSchema, type UserId } from '@/shared/lib/ids'

import { userRepository } from '../../adapters/user-repository.drizzle'
import type { User } from '../../domain/user'

import { updateNicknameFor } from './update-nickname.logic'

const sqlUserIds: string[] = []
const adminUserIds: string[] = []
afterEach(async () => {
  for (const id of sqlUserIds.splice(0))
    await db.execute(sql`DELETE FROM auth.users WHERE id = ${id}`)
  for (const id of adminUserIds.splice(0)) await cleanupAuthUser(id)
})

async function load(id: UserId): Promise<User> {
  const user = await userRepository.findById(id)
  if (!user) throw new Error('no user')
  return user
}

// Inserted with SQL, as an anonymous sign-in would (real ones are limited per IP).
async function anonymousUser(nickname = 'Wolf'): Promise<User> {
  const id = UserIdSchema.parse(randomUUID())
  await db.execute(sql`
    INSERT INTO auth.users (id, aud, role, is_anonymous, raw_user_meta_data, created_at, updated_at)
    VALUES (${id}, 'authenticated', 'authenticated', true, ${JSON.stringify({ nickname })}::jsonb, now(), now())
  `)
  sqlUserIds.push(id)
  return load(id)
}

const row = async (id: UserId) => (await db.select().from(users).where(eq(users.id, id)))[0]

describe('updateNicknameFor', () => {
  it('stores the new nickname with a newly drawn discriminator', async () => {
    const guest = await anonymousUser(`Wolf${randomUUID().slice(0, 6)}`)
    const current = guest.profile?.discriminator ?? 0
    // Another account already is "Fox #<the guest's current number>", so
    // keeping the number would collide: only a fresh draw succeeds.
    const fox = await anonymousUser(`Fox${randomUUID().slice(0, 6)}`)
    const nickname = fox.profile?.nickname ?? ''
    await db.update(users).set({ discriminator: current }).where(eq(users.id, fox.id))

    const result = await updateNicknameFor(guest, { nickname })

    expect(result).toEqual({ ok: true, value: { nickname, discriminator: expect.any(Number) } })
    if (!result.ok) return
    expect(result.value.discriminator).not.toBe(current)
    expect(await row(guest.id)).toMatchObject({
      nickname,
      discriminator: result.value.discriminator,
    })
  })

  it('keeps the discriminator when only the letter case changes', async () => {
    const guest = await anonymousUser('wolf')
    const before = guest.profile?.discriminator

    const result = await updateNicknameFor(guest, { nickname: 'Wolf' })

    expect(result).toEqual({ ok: true, value: { nickname: 'Wolf', discriminator: before } })
  })

  it('lets a permanent account without a profile pick one', async () => {
    const seeded = await createTestUser({ prefix: 'nickname' })
    adminUserIds.push(seeded.id)
    const user = await load(UserIdSchema.parse(seeded.id))
    expect(user.profile).toBeNull()

    const result = await updateNicknameFor(user, { nickname: 'Owl' })

    expect(result).toMatchObject({ ok: true, value: { nickname: 'Owl' } })
    expect(await row(user.id)).toMatchObject({ nickname: 'Owl', name: user.name })
  })

  it('answers CONFLICT and changes nothing when every number for the nickname is taken', async () => {
    const guest = await anonymousUser('Wolf')
    const before = await row(guest.id)
    // 9999 permanent accounts, then the whole range of "Crowded" handed out.
    const prefix = `crowded-${randomUUID().slice(0, 8)}`
    await db.execute(sql`
      INSERT INTO auth.users (id, aud, role, email, raw_user_meta_data, created_at, updated_at)
      SELECT gen_random_uuid(), 'authenticated', 'authenticated', ${prefix} || '-' || n || '@example.test',
             '{"name":"Crowd"}'::jsonb, now(), now()
      FROM generate_series(1, 9999) AS n
    `)
    try {
      await db.execute(sql`
        UPDATE public.users u SET nickname = 'Crowded', discriminator = numbered.n
        FROM (
          SELECT id, row_number() OVER (ORDER BY id) AS n FROM public.users
          WHERE email LIKE ${prefix + '-%'}
        ) AS numbered
        WHERE u.id = numbered.id
      `)

      const result = await updateNicknameFor(guest, { nickname: 'crowded' })

      expect(result).toEqual({ ok: false, error: expect.objectContaining({ code: 'CONFLICT' }) })
      expect(await row(guest.id)).toMatchObject({
        nickname: before?.nickname,
        discriminator: before?.discriminator,
      })
    } finally {
      await db.execute(sql`DELETE FROM auth.users WHERE email LIKE ${prefix + '-%'}`)
    }
  }, 60_000)
})
