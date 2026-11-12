import { randomUUID } from 'node:crypto'

import { afterEach, describe, expect, it } from 'vitest'

import { ExampleEntityIdSchema } from '@/shared/lib/ids'

import type { User } from '@/modules/auth'

import { exampleFixtures } from '../../example-entity.test-helper'
import { createExampleEntityFor } from '../create-example-entity/create-example-entity.logic'

import { deleteExampleEntityFor } from './delete-example-entity.logic'

const fixtures = exampleFixtures()
afterEach(() => fixtures.cleanup())

async function entityOwnedBy(owner: User) {
  const created = await createExampleEntityFor(owner, { title: 'Doomed' })
  if (!created.ok) throw created.error
  return created.value
}

describe('deleteExampleEntityFor', () => {
  it('lets the owner delete the entity', async () => {
    const owner = await fixtures.user()
    const entity = await entityOwnedBy(owner)

    const result = await deleteExampleEntityFor(owner, { id: entity.id })

    expect(result).toEqual({ ok: true, value: undefined })
    expect(await fixtures.row(entity.id)).toBeNull()
  })

  it('answers NOT_FOUND for an id that does not exist', async () => {
    const owner = await fixtures.user()

    const result = await deleteExampleEntityFor(owner, {
      id: ExampleEntityIdSchema.parse(randomUUID()),
    })

    expect(result).toEqual({ ok: false, error: expect.objectContaining({ code: 'NOT_FOUND' }) })
  })

  it("refuses another user's entity and keeps it", async () => {
    const owner = await fixtures.user()
    const intruder = await fixtures.user()
    const entity = await entityOwnedBy(owner)

    const result = await deleteExampleEntityFor(intruder, { id: entity.id })

    expect(result).toEqual({ ok: false, error: expect.objectContaining({ code: 'FORBIDDEN' }) })
    expect(await fixtures.row(entity.id)).not.toBeNull()
  })

  it("lets an admin delete another user's entity", async () => {
    const owner = await fixtures.user()
    const admin = await fixtures.user('admin')
    const entity = await entityOwnedBy(owner)

    const result = await deleteExampleEntityFor(admin, { id: entity.id })

    expect(result).toEqual({ ok: true, value: undefined })
    expect(await fixtures.row(entity.id)).toBeNull()
  })
})
