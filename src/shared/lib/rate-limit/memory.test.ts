import { describeRateLimitContract } from './contract.test-helper'
import { createMemoryRateLimiter } from './memory'

describeRateLimitContract('memory', () => createMemoryRateLimiter())
