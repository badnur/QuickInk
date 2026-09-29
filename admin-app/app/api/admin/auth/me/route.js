import { NextResponse } from 'next/server'
import { getAdminSessionServer } from '@/lib/auth-server'

export const dynamic = 'force-dynamic'

export async function GET(request) {
  try {
    const session = await getAdminSessionServer(request)
    if (!session) {
      return NextResponse.json({ authenticated: false, user: null }, { status: 401 })
    }

    return NextResponse.json({
      authenticated: true,
      user: {
        id: session.id,
        email: session.email,
        name: session.name,
        role: session.role || 'superadmin',
        permissions: session.permissions || ['*'],
      },
    })
  } catch (err) {
    return NextResponse.json({ authenticated: false, error: 'Session check failed' }, { status: 500 })
  }
}
