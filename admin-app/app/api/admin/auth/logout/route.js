import { NextResponse } from 'next/server'
import { clearAdminSessionCookie } from '@/lib/auth-server'

export const dynamic = 'force-dynamic'

export async function POST() {
  const response = NextResponse.json({ success: true, message: 'Logged out successfully' })
  return clearAdminSessionCookie(response)
}
