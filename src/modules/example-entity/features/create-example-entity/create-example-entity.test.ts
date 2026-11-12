import { describe, expect, it } from 'vitest'

import { createExampleEntitySchema } from './create-example-entity.schema'

describe('createExampleEntitySchema', () => {
  it('accepts a title-only payload', () => {
    const result = createExampleEntitySchema.safeParse({ title: 'hello' })
    expect(result.success).toBe(true)
  })

  it('accepts title and description', () => {
    const result = createExampleEntitySchema.safeParse({
      title: 'hello',
      description: 'world',
    })
    expect(result.success).toBe(true)
  })

  it('rejects an empty title', () => {
    const result = createExampleEntitySchema.safeParse({ title: '' })
    expect(result.success).toBe(false)
  })

  it('rejects a too-long title', () => {
    const result = createExampleEntitySchema.safeParse({ title: 'x'.repeat(201) })
    expect(result.success).toBe(false)
  })
})

describe('createExampleEntitySchema ownership', () => {
  it('drops a userId sent by the client, so the owner always comes from the session', () => {
    const result = createExampleEntitySchema.safeParse({
      title: 'x',
      userId: '00000000-0000-4000-8000-000000000000',
    })

    expect(result.success).toBe(true)
    expect(result.data).not.toHaveProperty('userId')
  })
})
