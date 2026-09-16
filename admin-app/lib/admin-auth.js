import { supabase } from '@/lib/supabase'

const ADMIN_SESSION_KEY = 'quickink_admin_session'

export function getAdminSession() {
  if (typeof window === 'undefined') return null
  try {
    const raw = localStorage.getItem(ADMIN_SESSION_KEY)
    if (!raw) return null
    const session = JSON.parse(raw)
    // Check expiry (24 hours)
    if (session?.expiresAt && Date.now() > session.expiresAt) {
      localStorage.removeItem(ADMIN_SESSION_KEY)
      return null
    }
    return session
  } catch (e) {
    return null
  }
}

export function setAdminSession(user) {
  if (typeof window === 'undefined') return
  const session = {
    ...user,
    expiresAt: Date.now() + 24 * 60 * 60 * 1000, // 24 hours
  }
  localStorage.setItem(ADMIN_SESSION_KEY, JSON.stringify(session))
}

export function clearAdminSession() {
  if (typeof window === 'undefined') return
  localStorage.removeItem(ADMIN_SESSION_KEY)
}

/**
 * Authenticate admin via Supabase Auth or master admin key
 */
export async function authenticateAdmin({ email, password, pin }) {
  // Option A: Quick Access Master PIN for development/kiosk ops
  const MASTER_PIN = process.env.NEXT_PUBLIC_ADMIN_PIN || '882314'
  if (pin && pin.trim() === MASTER_PIN) {
    const sessionUser = {
      id: 'quickink-master-admin',
      email: email || 'admin@quickink.com',
      name: 'Executive Admin',
      role: 'superadmin',
      authMethod: 'master_pin',
    }
    setAdminSession(sessionUser)
    return { success: true, user: sessionUser }
  }

  // Option B: Standard email & password (with demo fallback)
  if (email === 'admin@quickink.com' && password === 'admin123') {
    const sessionUser = {
      id: 'quickink-demo-admin',
      email: 'admin@quickink.com',
      name: 'System Admin',
      role: 'superadmin',
      authMethod: 'demo_credentials',
    }
    setAdminSession(sessionUser)
    return { success: true, user: sessionUser }
  }

  // Option C: Supabase Auth
  try {
    const { data, error } = await supabase.auth.signInWithPassword({
      email,
      password,
    })

    if (!error && data?.user) {
      const sessionUser = {
        id: data.user.id,
        email: data.user.email,
        name: data.user.user_metadata?.name || data.user.email.split('@')[0],
        role: 'admin',
        authMethod: 'supabase',
      }
      setAdminSession(sessionUser)
      return { success: true, user: sessionUser }
    }
    return { success: false, error: error?.message || 'Invalid admin credentials' }
  } catch (err) {
    return { success: false, error: err.message || 'Authentication failed' }
  }
}
