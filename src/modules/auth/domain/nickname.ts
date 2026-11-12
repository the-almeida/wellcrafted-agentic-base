import { z } from 'zod'

/**
 * The nickname of a public profile. Mirrors the database check
 * users_nickname_format, which is the real validation (an anonymous sign-in
 * reaches Supabase from the browser, past the app): 2 to 24 characters;
 * letters (with Latin accents), digits, space, _ . -; a letter or digit at
 * both ends. Excludes emoji, symbols and bidi controls. The integration test
 * runs the same cases against both.
 */
export const NICKNAME_RULE =
  '2 to 24 characters: letters, digits, spaces, _ . - (starting and ending with a letter or digit).'

export const NicknameSchema = z
  .string()
  .trim()
  .regex(/^[A-Za-z0-9À-ÖØ-öø-ÿ][A-Za-z0-9À-ÖØ-öø-ÿ _.-]{0,22}[A-Za-z0-9À-ÖØ-öø-ÿ]$/, NICKNAME_RULE)
