import { NextResponse } from 'next/server'
import { supabase } from '@/lib/supabase'

/**
 * GET /api/machines
 * Retrieves active printer locations from Supabase
 */
export async function GET(request) {
  try {
    // 1. Check for registered devices from new schema
    const { data: devices, error: devicesError } = await supabase
      .from('devices')
      .select('*')
      .order('created_at', { ascending: false })

    if (!devicesError && devices && devices.length > 0) {
      const formattedDevices = devices.map((d) => ({
        id: d.id,
        name: d.name,
        type: d.type,
        address: typeof d.location === 'object' ? d.location?.address || d.name : d.name,
        latitude: typeof d.location === 'object' ? d.location?.latitude : null,
        longitude: typeof d.location === 'object' ? d.location?.longitude : null,
        status: d.status,
        paper_available: true,
        distance: typeof d.location === 'object' ? d.location?.distance || 'Nearby' : 'Nearby',
      }))

      return NextResponse.json({
        success: true,
        machines: formattedDevices,
        count: formattedDevices.length,
      })
    }

    // 2. Fallback to existing machines table if devices table is not yet seeded
    const { data: machines, error: machinesError } = await supabase
      .from('machines')
      .select('*')

    if (!machinesError && machines && machines.length > 0) {
      return NextResponse.json({
        success: true,
        machines,
        count: machines.length,
      })
    }

    return NextResponse.json({
      success: true,
      machines: [],
      count: 0,
    })
  } catch (error) {
    console.error('API error:', error)
    return NextResponse.json(
      { error: 'Internal server error', details: error.message },
      { status: 500 }
    )
  }
}
