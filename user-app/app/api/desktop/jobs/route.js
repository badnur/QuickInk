import { NextResponse } from 'next/server'
import { supabase } from '@/lib/supabase'

export const dynamic = 'force-dynamic'

export async function GET(request) {
  try {
    const { searchParams } = new URL(request.url)
    const deviceId = searchParams.get('device_id') || searchParams.get('deviceId')

    // Security: Reject requests without valid device identifier
    if (!deviceId || typeof deviceId !== 'string' || !/^[a-zA-Z0-9_-]{8,64}$/.test(deviceId.trim())) {
      return NextResponse.json({ error: 'A valid device_id parameter is required.' }, { status: 400 })
    }

    const cleanDeviceId = deviceId.trim()

    // Security: Only return jobs specifically redeemed by or assigned to this terminal
    const { data: jobs, error } = await supabase
      .from('print_jobs')
      .select('id, file_type, copies, color_mode, duplex, page_count, page_range, pages_per_sheet, status, created_at, redeemed_at, redeemed_by_device_id')
      .eq('redeemed_by_device_id', cleanDeviceId)
      .order('created_at', { ascending: false })
      .limit(30)

    if (error) {
      console.warn('Fetch desktop jobs error:', error.message)
      return NextResponse.json({ success: true, jobs: [] })
    }

    return NextResponse.json({ success: true, jobs: jobs || [] })
  } catch (err) {
    console.error('Desktop jobs endpoint error:', err)
    return NextResponse.json({ success: true, jobs: [] })
  }
}
