/** The public face of an account: a nickname plus a number (1–9999) that makes it unique. */
export type PublicProfile = { nickname: string; discriminator: number }

/** "Wolf #0042". */
export function formatPublicHandle({ nickname, discriminator }: PublicProfile): string {
  return `${nickname} #${String(discriminator).padStart(4, '0')}`
}

/** What to call the account in the UI: the name, else the public handle, else the email. */
export function displayName(user: {
  name: string | null
  profile: PublicProfile | null
  email?: string | null
}): string {
  if (user.name) return user.name
  if (user.profile) return formatPublicHandle(user.profile)
  return user.email ?? ''
}
