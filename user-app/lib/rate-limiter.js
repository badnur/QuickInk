/**
 * In-Memory Sliding-Window Rate Limiter & Abuse Control
 * Lightweight, zero-dependency rate limiter with automatic stale key eviction.
 */

class RateLimiter {
  constructor() {
    this.hits = new Map() // key -> { count, windowStart }
    this.lastCleanup = Date.now()
    this.CLEANUP_INTERVAL_MS = 60 * 1000 // Run garbage collection every 60s
  }

  _cleanup(now) {
    if (now - this.lastCleanup < this.CLEANUP_INTERVAL_MS) return
    this.lastCleanup = now
    for (const [key, data] of this.hits.entries()) {
      if (now - data.windowStart > 15 * 60 * 1000) {
        this.hits.delete(key)
      }
    }
  }

  /**
   * Check if a client key has exceeded rate limits.
   * @param {string} key - Unique identifier (e.g. `ip:action` or `phone:otp`)
   * @param {Object} options
   * @param {number} options.limit - Maximum permitted requests within the window
   * @param {number} options.windowMs - Window duration in milliseconds
   * @returns {{ allowed: boolean, remaining: number, retryAfterSec: number }}
   */
  check(key, { limit = 10, windowMs = 60 * 1000 } = {}) {
    const now = Date.now()
    this._cleanup(now)

    const record = this.hits.get(key)

    if (!record || now - record.windowStart > windowMs) {
      this.hits.set(key, { count: 1, windowStart: now })
      return { allowed: true, remaining: limit - 1, retryAfterSec: 0 }
    }

    if (record.count >= limit) {
      const retryAfterSec = Math.max(1, Math.ceil((windowMs - (now - record.windowStart)) / 1000))
      return { allowed: false, remaining: 0, retryAfterSec }
    }

    record.count += 1
    return { allowed: true, remaining: limit - record.count, retryAfterSec: 0 }
  }

  reset(key) {
    this.hits.delete(key)
  }
}

// Global singleton instance per Node.js process
const globalLimiter = new RateLimiter()

export function getClientIp(request) {
  if (!request) return '127.0.0.1'
  const forwarded = request.headers.get('x-forwarded-for')
  if (forwarded) {
    return forwarded.split(',')[0].trim()
  }
  const realIp = request.headers.get('x-real-ip')
  if (realIp) {
    return realIp.trim()
  }
  return '127.0.0.1'
}

/**
 * Standard Rate Limit Profiles
 */
export const RATE_LIMITS = {
  // Strictest limits: Authentication, OTP & Reset
  LOGIN: { limit: 5, windowMs: 60 * 1000 },             // 5 attempts / min
  OTP_SEND: { limit: 3, windowMs: 60 * 1000 },          // 3 SMS OTPs / min (anti-SMS-pumping)
  OTP_VERIFY: { limit: 5, windowMs: 5 * 60 * 1000 },     // 5 verify attempts / 5 min
  PASSWORD_RESET: { limit: 3, windowMs: 15 * 60 * 1000 },// 3 reset requests / 15 min

  // Expensive Operations
  UPLOAD: { limit: 10, windowMs: 60 * 1000 },           // 10 document uploads / min
  PRINT_JOB: { limit: 20, windowMs: 60 * 1000 },        // 20 orders / min
  PAYMENT_TOPUP: { limit: 10, windowMs: 60 * 1000 },    // 10 topup requests / min

  // Public Form Submissions
  PARTNER_APPLY: { limit: 5, windowMs: 15 * 60 * 1000 },// 5 applications / 15 min
  CONTACT_FORM: { limit: 5, windowMs: 5 * 60 * 1000 },  // 5 messages / 5 min
  FEEDBACK: { limit: 10, windowMs: 5 * 60 * 1000 },     // 10 reviews / 5 min

  // General Read & Search
  SEARCH: { limit: 60, windowMs: 60 * 1000 },           // 60 requests / min
}

/**
 * Helper to enforce a rate limit profile and return a standardized 429 response if exceeded.
 * @param {Request} request
 * @param {string} actionName
 * @param {Object} profile - e.g. RATE_LIMITS.LOGIN
 * @param {string} [customSuffix] - e.g. phone number or device ID
 * @returns {Response|null} - Returns 429 Response if blocked, or null if allowed
 */
export function enforceRateLimit(request, actionName, profile, customSuffix = '') {
  const ip = getClientIp(request)
  const key = `${actionName}:${ip}${customSuffix ? `:${customSuffix}` : ''}`
  const result = globalLimiter.check(key, profile)

  if (!result.allowed) {
    return new Response(
      JSON.stringify({
        error: `Too many requests for ${actionName}. Please retry after ${result.retryAfterSec} seconds.`,
        retryAfter: result.retryAfterSec,
      }),
      {
        status: 429,
        headers: {
          'Content-Type': 'application/json',
          'Retry-After': String(result.retryAfterSec),
          'X-RateLimit-Limit': String(profile.limit),
          'X-RateLimit-Remaining': '0',
        },
      }
    )
  }

  return null
}

export { globalLimiter }
