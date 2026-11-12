import { afterEach, describe, expect, it } from 'vitest'

import { exampleFixtures } from '../../example-entity.test-helper'

import { createExampleEntityFor } from './create-example-entity.logic'

const fixtures = exampleFixtures()
afterEach(() => fixtures.cleanup())

describe('createExampleEntityFor', () => {
  it('stores the entity owned by the caller', async () => {
    const user = await fixtures.user()

    const result = await createExampleEntityFor(user, { title: 'First', description: 'About it' })

    if (!result.ok) throw result.error
    expect(await fixtures.row(result.value.id)).toMatchObject({
      userId: user.id,
      title: 'First',
      description: 'About it',
    })
  })
})
