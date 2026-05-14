import { describe, expect, it } from 'vitest'

import { deleteExampleEntitySchema } from './delete-example-entity.schema'

describe('deleteExampleEntitySchema', () => {
  it('accepts a valid uuid id', () => {
    const result = deleteExampleEntitySchema.safeParse({
      id: '00000000-0000-4000-8000-000000000000',
    })
    expect(result.success).toBe(true)
  })

  it('rejects a non-uuid id', () => {
    const result = deleteExampleEntitySchema.safeParse({ id: 'not-a-uuid' })
    expect(result.success).toBe(false)
  })
})
