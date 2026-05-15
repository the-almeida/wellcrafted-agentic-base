import { z } from 'zod'

/**
 * Pages the OAuth callback is allowed to bounce the user back to on
 * failure. Strict allow-list (not a same-origin check) because failure
 * redirects are always one of these two pages — anything else is a
 * mis-configuration or an attempt to manipulate the flow.
 */
export const OAUTH_ORIGIN_PATHS = ['/sign-in', '/sign-up'] as const
export type OauthOriginPath = (typeof OAUTH_ORIGIN_PATHS)[number]

export const oauthCallbackInputSchema = z.object({
  code: z
    .string()
    .min(1)
    .max(128)
    .refine((s) => s.trim().length > 0, 'code must not be blank'),
  next: z
    .string()
    .default('/dashboard')
    .refine(
      (s) => s.startsWith('/') && !s.startsWith('//') && !s.includes('\\'),
      'next must be a same-origin path starting with /',
    ),
  from: z.enum(OAUTH_ORIGIN_PATHS).default('/sign-in'),
})

export type OauthCallbackInput = z.infer<typeof oauthCallbackInputSchema>
