/**
 * Base for expected, typed errors that flow via `Result<T, E>`.
 *
 * The `code` field is a literal string per subclass, so callers can do
 * `if (err.code === 'NOT_FOUND')` and TypeScript narrows the type.
 *
 * Supports `cause` (ES2022) for chaining errors without losing the
 * original stack.
 */
export abstract class AppError extends Error {
  abstract readonly code: string

  constructor(message: string, options?: { cause?: unknown }) {
    super(message, options)
    this.name = this.constructor.name
    Object.setPrototypeOf(this, new.target.prototype)
  }
}

export class ValidationError extends AppError {
  readonly code = 'VALIDATION_ERROR' as const
  constructor(
    public readonly details: unknown,
    message = 'Validation failed',
    options?: { cause?: unknown },
  ) {
    super(message, options)
  }
}

export class NotFoundError extends AppError {
  readonly code = 'NOT_FOUND' as const
  constructor(message = 'Resource not found', options?: { cause?: unknown }) {
    super(message, options)
  }
}

export class UnauthenticatedError extends AppError {
  readonly code = 'UNAUTHENTICATED' as const
  constructor(message = 'Not authenticated', options?: { cause?: unknown }) {
    super(message, options)
  }
}

export class ForbiddenError extends AppError {
  readonly code = 'FORBIDDEN' as const
  constructor(message = 'Forbidden', options?: { cause?: unknown }) {
    super(message, options)
  }
}

export class ConflictError extends AppError {
  readonly code = 'CONFLICT' as const
  constructor(message = 'Conflict', options?: { cause?: unknown }) {
    super(message, options)
  }
}

export class AccountPendingDeletionError extends AppError {
  readonly code = 'ACCOUNT_PENDING_DELETION' as const
  constructor(
    public readonly scheduledFor: Date,
    message = 'Account is scheduled for deletion',
    options?: { cause?: unknown },
  ) {
    super(message, options)
  }
}

export class ExternalServiceError extends AppError {
  readonly code = 'EXTERNAL_SERVICE_ERROR' as const
  constructor(
    public readonly service: string,
    message = `External service failed: ${service}`,
    options?: { cause?: unknown },
  ) {
    super(message, options)
  }
}

export type AppErrorCode =
  | ValidationError['code']
  | NotFoundError['code']
  | UnauthenticatedError['code']
  | ForbiddenError['code']
  | ConflictError['code']
  | AccountPendingDeletionError['code']
  | ExternalServiceError['code']
