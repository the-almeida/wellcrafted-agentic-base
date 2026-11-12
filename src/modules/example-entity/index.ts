/**
 * Example module: a template to copy, meant to be deleted once you ship your
 * first real module. Structure and rules: docs/architecture.md.
 */

export type { ExampleEntity } from './domain/example-entity'
export type { ExampleAction } from './domain/policy'
export { examplePolicy } from './domain/policy'

export { createExampleEntity } from './features/create-example-entity/create-example-entity.handler'
export { deleteExampleEntity } from './features/delete-example-entity/delete-example-entity.handler'
export { updateExampleEntity } from './features/update-example-entity/update-example-entity.handler'
