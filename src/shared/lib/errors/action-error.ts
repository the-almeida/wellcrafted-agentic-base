import { AccountPendingDeletionError, type AppError, ValidationError } from './base'

/**
 * The shape an expected error takes once it leaves a server action.
 *
 * React Flight (the server action transport) does not serialize Error
 * instances. In production a returned Error reaches the browser as a
 * generic "An error occurred in the Server Components render" Error, and
 * `code` plus every other own field is dropped. In dev the message
 * survives, so the bug only shows up after `next build`. Server actions
 * therefore hand the client plain data: `code` + `message`, plus the
 * extra fields a client legitimately needs.
 *
 * Fields are listed per error type, not copied wholesale. Internal
 * details like the rate-limit key (which embeds the email/IP) or the
 * failing external service never leave the server.
 */
export type ActionError<E> = E extends ValidationError
  ? { code: E['code']; message: string; details: unknown }
  : E extends AccountPendingDeletionError
    ? { code: E['code']; message: string; scheduledFor: Date }
    : E extends AppError
      ? { code: E['code']; message: string }
      : never

/** A server action's return type as the client receives it. */
export type ActionResult<R> = R extends { ok: false; error: infer E }
  ? { ok: false; error: ActionError<E> }
  : R

export function toActionError<E extends AppError>(error: E): ActionError<E> {
  const base = { code: error.code, message: error.message }
  if (error instanceof ValidationError) {
    return { ...base, details: error.details } as ActionError<E>
  }
  if (error instanceof AccountPendingDeletionError) {
    return { ...base, scheduledFor: error.scheduledFor } as ActionError<E>
  }
  return base as ActionError<E>
}
