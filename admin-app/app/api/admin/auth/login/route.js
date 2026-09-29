import { NextResponse } from 'next/server'
import { signAdminToken, setAdminSessionCookie } from '@/lib/auth-server'
import { supabase } from '@/lib/supabase'

export const dynamic = 'force-dynamic'

// In-memory rate limiting map: ip -> { count, firstAttempt }
const loginAttempts = new Map()
const RATE_LIMIT_MAX = 7 // max 7 attempts
const RATE_LIMIT_WINDOW_MS = 5 * 60 * 1000 // 5 minutes window

function checkRateLimit(ip) {
  const now = Date.now()
  const record = loginAttempts.get(ip)

  if (!record) {
    loginAttempts.set(ip, { count: 1, firstAttempt: now })
    return { allowed: true }
  }

  if (now - record.firstAttempt > RATE_LIMIT_WINDOW_MS) {
    loginAttempts.set(ip, { count: 1, firstAttempt: now })
    return { allowed: true }
  }

  record.count += 1
  if (record.count > RATE_LIMIT_MAX) {
    const retryAfterSec = Math.ceil((RATE_LIMIT_WINDOW_MS - (now - record.firstAttempt)) / 1000)
    return { allowed: false, retryAfterSec }
  }

  return { allowed: true }
}

function clearRateLimit(ip) {
  loginAttempts.delete(ip)
}

export async function POST(request) {
  try {
    const ip = request.headers.get('x-forwarded-for') || request.headers.get('x-real-ip') || '127.0.0.1'
    const rateCheck = checkRateLimit(ip)

    if (!rateCheck.allowed) {
      return NextResponse.json(
        {
          success: false,
          error: `Too many login attempts. Please wait ${rateCheck.retryAfterSec} seconds before retrying.`,
        },
        { status: 429 }
      )
    }

    const body = await request.json()
    const { pin, email, password } = body

    // 1. Master PIN Authentication (Server-Side verification)
    const masterPin = process.env.ADMIN_MASTER_PIN || '882314'
    if (pin && pin.trim() === masterPin) {
      clearRateLimit(ip)

      const user = {
        id: 'printkoro-master-superadmin',
        email: email || 'admin@printkoro.com',
        name: 'Super Admin',
        role: 'superadmin',
        permissions: ['*'],
      }

      const token = await signAdminToken(user)
      const response = NextResponse.json({
        success: true,
        user,
      })

      return setAdminSessionCookie(response, token)
    }

    // 2. Email & Password Authentication via Supabase
    if (email && password) {
      const { data, error } = await supabase.auth.signInWithPassword({
        email,
        password,
      })

      if (!error && data?.user) {
        clearRateLimit(ip)

        const user = {
          id: data.user.id,
          email: data.user.email,
          name: data.user.user_metadata?.name || data.user.email.split('@')[0],
          role: data.user.user_metadata?.role || 'admin',
          permissions: data.user.user_metadata?.permissions || ['read', 'write'],
        }

        const token = await signAdminToken(user)
        const response = NextResponse.json({
          success: true,
          user,
        })

        return setAdminSessionCookie(response, token)
      }

      return NextResponse.json(
        { success: false, error: error?.message || 'Invalid administrative credentials' },
        { status: 401 }
      )
    }

    return NextResponse.json(
      { success: false, error: 'Invalid PIN or credentials provided' },
      { status: 400 }
    )
  } catch (err) {
    return NextResponse.json(
      { success: false, error: 'Server authentication error' },
      { status: 500 }
    )
  }
}
