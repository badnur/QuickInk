import { SignJWT, jwtVerify } from 'jose'

const COOKIE_NAME = 'printkoro_admin_session'
const JWT_SECRET = new TextEncoder().encode(
  (process.env.ADMIN_JWT_SECRET || 'printkoro_superadmin_sec_default_change_in_prod').trim()
)

/**
 * Sign an administrative JWT session token
 */
export async function signAdminToken(payload) {
  return await new SignJWT(payload)
    .setProtectedHeader({ alg: 'HS256' })
    .setIssuedAt()
    .setExpirationTime('24h')
    .sign(JWT_SECRET)
}

/**
 * Verify and decode an administrative JWT session token
 */
export async function verifyAdminToken(token) {
  if (!token) return null
  try {
    const { payload } = await jwtVerify(token, JWT_SECRET)
    return payload
  } catch (err) {
    return null
  }
}

/**
 * Get current admin session from server-side request (cookies or Auth header)
 */
export async function getAdminSessionServer(request = null) {
  if (!request) return null
  let token = null

  // 1. Check cookies in request
  token = request.cookies?.get?.(COOKIE_NAME)?.value

  // 2. Fallback to Bearer token header
  if (!token && request.headers) {
    const authHeader = request.headers.get?.('authorization') || request.headers['authorization']
    if (authHeader?.startsWith?.('Bearer ')) {
      token = authHeader.substring(7)
    }
  }

  if (!token) return null
  return await verifyAdminToken(token)
}

/**
 * Attach HttpOnly session cookie to an HTTP response
 */
export function setAdminSessionCookie(response, token) {
  response.cookies.set({
    name: COOKIE_NAME,
    value: token,
    httpOnly: true,
    secure: process.env.NODE_ENV === 'production',
    sameSite: 'lax',
    path: '/',
    maxAge: 24 * 60 * 60, // 24 hours
  })
  return response
}

/**
 * Clear HttpOnly session cookie on logout
 */
export function clearAdminSessionCookie(response) {
  response.cookies.set({
    name: COOKIE_NAME,
    value: '',
    httpOnly: true,
    secure: process.env.NODE_ENV === 'production',
    sameSite: 'lax',
    path: '/',
    maxAge: 0,
  })
  return response
}
