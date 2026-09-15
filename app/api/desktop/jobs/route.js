import { NextResponse } from 'next/server'
import { supabase } from '@/lib/supabase'

export async function GET(request) {
  try {
    const { searchParams } = new URL(request.url)
    const deviceId = searchParams.get('device_id')

    let query = supabase
      .from('print_jobs')
      .select('*')
      .order('created_at', { ascending: false })
      .limit(20)

    if (deviceId) {
      query = query.or(`redeemed_by_device_id.eq.${deviceId},status.eq.awaiting_redemption`)
    }

    const { data: jobs, error } = await query

    if (error) {
      console.warn('Fetch desktop jobs error:', error)
      return NextResponse.json({ success: true, jobs: [] })
    }

    return NextResponse.json({ success: true, jobs: jobs || [] })
  } catch (err) {
    console.error('Desktop jobs endpoint error:', err)
    return NextResponse.json({ success: true, jobs: [] })
  }
}
