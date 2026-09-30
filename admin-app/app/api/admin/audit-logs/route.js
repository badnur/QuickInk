import { NextResponse } from 'next/server'
import { getRecentAuditLogs } from '@/lib/audit-logger'
import { getCache, setCache, FAST_EDGE_HEADERS } from '@/lib/admin-cache'

export const dynamic = 'force-dynamic'

export async function GET(request) {
  try {
    const { searchParams } = new URL(request.url)
    const limit = parseInt(searchParams.get('limit') || '50', 10)
    const forceRefresh = searchParams.get('refresh') === 'true'

    const cacheKey = `admin_audit_logs_${limit}`
    if (!forceRefresh) {
      const cached = getCache(cacheKey)
      if (cached) return NextResponse.json(cached, { headers: FAST_EDGE_HEADERS })
    }

    const logs = await getRecentAuditLogs(limit)
    const payload = {
      success: true,
      logs: logs || [],
      count: logs?.length || 0,
    }
    setCache(cacheKey, payload, 30)

    return NextResponse.json(payload, { headers: FAST_EDGE_HEADERS })
  } catch (err) {
    return NextResponse.json({ success: false, error: 'Failed to fetch audit logs' }, { status: 500 })
  }
}
