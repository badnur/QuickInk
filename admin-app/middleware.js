import { NextResponse } from 'next/server'
import { verifyAdminToken } from '@/lib/auth-server'

const COOKIE_NAME = 'printkoro_admin_session'

export async function middleware(request) {
  const { pathname } = request.nextUrl

  // 1. Allow static assets, images, and public files
  if (
    pathname.startsWith('/_next') ||
    pathname.startsWith('/images') ||
    pathname.startsWith('/favicon') ||
    pathname.endsWith('.png') ||
    pathname.endsWith('.jpg') ||
    pathname.endsWith('.svg') ||
    pathname.endsWith('.ico')
  ) {
    return NextResponse.next()
  }

  // 2. Allow auth endpoints (login, logout)
  if (
    pathname === '/login' ||
    pathname === '/api/admin/auth/login' ||
    pathname === '/api/admin/auth/logout'
  ) {
    // If user already has a valid session and is visiting /login, redirect to dashboard
    if (pathname === '/login') {
      const token = request.cookies.get(COOKIE_NAME)?.value
      if (token) {
        const session = await verifyAdminToken(token)
        if (session) {
          return NextResponse.redirect(new URL('/', request.url))
        }
      }
    }
    return NextResponse.next()
  }

  // 3. For any other /api/admin/* or app page routes, enforce valid session
  let token = request.cookies.get(COOKIE_NAME)?.value
  if (!token) {
    const authHeader = request.headers.get('authorization')
    if (authHeader?.startsWith('Bearer ')) {
      token = authHeader.substring(7)
    }
  }
  const session = token ? await verifyAdminToken(token) : null

  if (!session) {
    // Reject API requests with 401 JSON
    if (pathname.startsWith('/api/')) {
      return NextResponse.json(
        { error: 'Unauthorized administrative access. Please log in.' },
        { status: 401 }
      )
    }

    // Redirect browser page requests to /login
    const loginUrl = new URL('/login', request.url)
    return NextResponse.redirect(loginUrl)
  }

  // 4. Attach admin identity headers for downstream handlers
  const requestHeaders = new Headers(request.headers)
  requestHeaders.set('x-admin-id', session.id || '')
  requestHeaders.set('x-admin-email', session.email || '')
  requestHeaders.set('x-admin-role', session.role || 'admin')

  return NextResponse.next({
    request: {
      headers: requestHeaders,
    },
  })
}

export const config = {
  matcher: [
    /*
     * Match all request paths except for the ones starting with:
     * - _next/static (static files)
     * - _next/image (image optimization files)
     */
    '/((?!_next/static|_next/image).*)',
  ],
}
