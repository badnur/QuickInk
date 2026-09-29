const ADMIN_SESSION_CACHE_KEY = 'printkoro_admin_user_cache'

/**
 * Get cached session user info for optimistic UI rendering
 */
export function getAdminSession() {
  if (typeof window === 'undefined') return null
  try {
    const raw = localStorage.getItem(ADMIN_SESSION_CACHE_KEY)
    if (!raw) return null
    return JSON.parse(raw)
  } catch (e) {
    return null
  }
}

/**
 * Set cached session user info
 */
export function setAdminSession(user) {
  if (typeof window === 'undefined') return
  localStorage.setItem(ADMIN_SESSION_CACHE_KEY, JSON.stringify(user))
}

/**
 * Clear cached session and call server logout
 */
export async function clearAdminSession() {
  if (typeof window !== 'undefined') {
    localStorage.removeItem(ADMIN_SESSION_CACHE_KEY)
  }
  try {
    await fetch('/api/admin/auth/logout', { method: 'POST' })
  } catch (e) {
    // Ignore network error on logout
  }
}

/**
 * Authenticate admin securely via server-side API (with rate-limiting & HttpOnly cookies)
 */
export async function authenticateAdmin({ email, password, pin }) {
  try {
    const res = await fetch('/api/admin/auth/login', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ email, password, pin }),
    })

    const data = await res.json()

    if (res.ok && data.success) {
      setAdminSession(data.user)
      return { success: true, user: data.user }
    }

    return {
      success: false,
      error: data.error || 'Authentication failed. Please verify credentials.',
    }
  } catch (err) {
    return {
      success: false,
      error: 'Network connection error during authentication.',
    }
  }
}

/**
 * Verify current server session
 */
export async function verifyServerSession() {
  try {
    const res = await fetch('/api/admin/auth/me')
    if (res.ok) {
      const data = await res.json()
      if (data.authenticated && data.user) {
        setAdminSession(data.user)
        return data.user
      }
    }
    clearAdminSession()
    return null
  } catch (err) {
    return null
  }
}
