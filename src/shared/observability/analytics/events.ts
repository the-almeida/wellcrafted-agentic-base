export const Events = {
  USER_SIGNED_UP: 'user_signed_up',
  USER_SIGNED_IN: 'user_signed_in',
  USER_SIGNED_OUT: 'user_signed_out',
  CRITICAL_ERROR_SHOWN: 'critical_error_shown',
  EXPECTED_ERROR: 'expected_error',
} as const

export type EventName = (typeof Events)[keyof typeof Events]
