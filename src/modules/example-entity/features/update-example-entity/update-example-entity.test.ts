import { describe, expect, it } from 'vitest'

import { updateExampleEntitySchema } from './update-example-entity.schema'

const validId = '00000000-0000-4000-8000-000000000000'

describe('updateExampleEntitySchema', () => {
  it('accepts a partial update', () => {
    const result = updateExampleEntitySchema.safeParse({ id: validId, title: 'new title' })
    expect(result.success).toBe(true)
  })

  it('accepts setting description to null', () => {
    const result = updateExampleEntitySchema.safeParse({ id: validId, description: null })
    expect(result.success).toBe(true)
  })

  it('rejects a non-uuid id', () => {
    const result = updateExampleEntitySchema.safeParse({ id: 'not-a-uuid', title: 'x' })
    expect(result.success).toBe(false)
  })

  it('rejects an empty title', () => {
    const result = updateExampleEntitySchema.safeParse({ id: validId, title: '' })
    expect(result.success).toBe(false)
  })
})
