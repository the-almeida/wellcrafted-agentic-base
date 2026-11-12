import { randomUUID } from 'node:crypto'

import { afterEach, describe, expect, it } from 'vitest'

import { ExampleEntityIdSchema } from '@/shared/lib/ids'

import type { User } from '@/modules/auth'

import { exampleFixtures } from '../../example-entity.test-helper'
import { createExampleEntityFor } from '../create-example-entity/create-example-entity.logic'

import { updateExampleEntityFor } from './update-example-entity.logic'

const fixtures = exampleFixtures()
afterEach(() => fixtures.cleanup())

async function entityOwnedBy(owner: User) {
  const created = await createExampleEntityFor(owner, { title: 'Original', description: 'Kept' })
  if (!created.ok) throw created.error
  return created.value
}

describe('updateExampleEntityFor', () => {
  it('lets the owner change the title', async () => {
    const owner = await fixtures.user()
    const entity = await entityOwnedBy(owner)

    const result = await updateExampleEntityFor(owner, { id: entity.id, title: 'Renamed' })

    expect(result.ok).toBe(true)
    expect(await fixtures.row(entity.id)).toMatchObject({ title: 'Renamed' })
  })

  it('leaves the description alone when only the title is sent', async () => {
    const owner = await fixtures.user()
    const entity = await entityOwnedBy(owner)

    await updateExampleEntityFor(owner, { id: entity.id, title: 'Renamed' })

    expect(await fixtures.row(entity.id)).toMatchObject({ title: 'Renamed', description: 'Kept' })
  })

  it('answers NOT_FOUND for an id that does not exist', async () => {
    const owner = await fixtures.user()
    const id = ExampleEntityIdSchema.parse(randomUUID())

    const result = await updateExampleEntityFor(owner, { id, title: 'Renamed' })

    expect(result).toEqual({ ok: false, error: expect.objectContaining({ code: 'NOT_FOUND' }) })
  })

  it("refuses another user's entity and leaves it unchanged", async () => {
    const owner = await fixtures.user()
    const intruder = await fixtures.user()
    const entity = await entityOwnedBy(owner)

    const result = await updateExampleEntityFor(intruder, { id: entity.id, title: 'Hijacked' })

    expect(result).toEqual({ ok: false, error: expect.objectContaining({ code: 'FORBIDDEN' }) })
    expect(await fixtures.row(entity.id)).toMatchObject({ title: 'Original' })
  })

  it("lets an admin change another user's entity", async () => {
    const owner = await fixtures.user()
    const admin = await fixtures.user('admin')
    const entity = await entityOwnedBy(owner)

    const result = await updateExampleEntityFor(admin, { id: entity.id, title: 'Moderated' })

    expect(result.ok).toBe(true)
    expect(await fixtures.row(entity.id)).toMatchObject({ title: 'Moderated' })
  })
})
