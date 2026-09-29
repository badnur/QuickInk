import { NextResponse } from 'next/server'
import { getRecentAuditLogs } from '@/lib/audit-logger'

export const dynamic = 'force-dynamic'

export async function GET(request) {
  try {
    const { searchParams } = new URL(request.url)
    const limit = parseInt(searchParams.get('limit') || '50', 10)

    const logs = await getRecentAuditLogs(limit)
    return NextResponse.json({
      success: true,
      logs: logs || [],
      count: logs?.length || 0,
    })
  } catch (err) {
    return NextResponse.json({ success: false, error: 'Failed to fetch audit logs' }, { status: 500 })
  }
}
