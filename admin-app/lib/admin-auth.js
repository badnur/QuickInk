const ADMIN_SESSION_CACHE_KEY = 'printkoro_admin_user_cache'
const ADMIN_TOKEN_KEY = 'printkoro_admin_token'

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
 * Get stored JWT Bearer token
 */
export function getAdminToken() {
  if (typeof window === 'undefined') return null
  try {
    return localStorage.getItem(ADMIN_TOKEN_KEY)
  } catch (e) {
    return null
  }
}

/**
 * Set cached session user info and token
 */
export function setAdminSession(user, token = null) {
  if (typeof window === 'undefined') return
  try {
    if (user) {
      localStorage.setItem(ADMIN_SESSION_CACHE_KEY, JSON.stringify(user))
    }
    if (token) {
      localStorage.setItem(ADMIN_TOKEN_KEY, token)
    }
  } catch (e) {
    console.warn('Failed to store session in localStorage:', e)
  }
}

/**
 * Clear cached session and call server logout
 */
export async function clearAdminSession() {
  if (typeof window !== 'undefined') {
    try {
      localStorage.removeItem(ADMIN_SESSION_CACHE_KEY)
      localStorage.removeItem(ADMIN_TOKEN_KEY)
    } catch (e) {}
  }
  try {
    await fetch('/api/admin/auth/logout', {
      method: 'POST',
      credentials: 'include',
    })
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
      credentials: 'include',
      body: JSON.stringify({ email, password, pin }),
    })

    const data = await res.json()

    if (res.ok && data.success) {
      setAdminSession(data.user, data.token)
      return { success: true, user: data.user, token: data.token }
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
    const headers = {}
    const token = getAdminToken()
    if (token) {
      headers['Authorization'] = `Bearer ${token}`
    }

    const res = await fetch('/api/admin/auth/me', {
      credentials: 'include',
      headers,
    })

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
