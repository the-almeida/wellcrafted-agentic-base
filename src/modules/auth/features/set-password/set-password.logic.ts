import type { AuthProvider } from '../../ports/auth-provider'

import type { SetPasswordInput } from './set-password.schema'

/** Sets a new password for the signed-in account (after its old one was replaced). */
export function setPasswordWith(
  { authProvider }: { authProvider: AuthProvider },
  input: SetPasswordInput,
) {
  return authProvider.replacePassword({ password: input.password })
}
