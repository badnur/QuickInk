import { NextResponse } from 'next/server'
import { supabase } from '@/lib/supabase'

export const dynamic = 'force-dynamic'

/**
 * GET /api/admin/devices
 */
export async function GET() {
  try {
    const { data: devices, error } = await supabase
      .from('devices')
      .select('*')
      .order('created_at', { ascending: false })

    if (error) {
      return NextResponse.json({ error: error.message }, { status: 500 })
    }

    return NextResponse.json({ success: true, devices: devices || [] })
  } catch (err) {
    return NextResponse.json({ error: err.message }, { status: 500 })
  }
}

/**
 * POST /api/admin/devices
 * Create a new device/kiosk
 */
export async function POST(request) {
  try {
    const body = await request.json()
    const { name, type = 'kiosk', address, phone, operating_hours = '24/7' } = body

    if (!name || !address) {
      return NextResponse.json({ error: 'Name and address are required' }, { status: 400 })
    }

    const locationObj = {
      address,
      phone: phone || '',
      operating_hours,
      created_via: 'admin_dashboard',
    }

    const { data, error } = await supabase
      .from('devices')
      .insert([
        {
          name,
          type: type === 'shop' ? 'shop' : 'kiosk',
          location: locationObj,
          status: 'online',
        },
      ])
      .select()
      .single()

    if (error) {
      return NextResponse.json({ error: error.message }, { status: 500 })
    }

    return NextResponse.json({ success: true, device: data }, { status: 201 })
  } catch (err) {
    return NextResponse.json({ error: err.message }, { status: 500 })
  }
}

/**
 * PATCH /api/admin/devices
 * Update device
 */
export async function PATCH(request) {
  try {
    const body = await request.json()
    const { id, name, status, type, location } = body

    if (!id) {
      return NextResponse.json({ error: 'Device ID is required' }, { status: 400 })
    }

    const updates = {}
    if (name) updates.name = name
    if (status) updates.status = status
    if (type) updates.type = type
    if (location) updates.location = location

    const { data, error } = await supabase
      .from('devices')
      .update(updates)
      .eq('id', id)
      .select()
      .single()

    if (error) {
      return NextResponse.json({ error: error.message }, { status: 500 })
    }

    return NextResponse.json({ success: true, device: data })
  } catch (err) {
    return NextResponse.json({ error: err.message }, { status: 500 })
  }
}

/**
 * DELETE /api/admin/devices
 */
export async function DELETE(request) {
  try {
    const { searchParams } = new URL(request.url)
    const id = searchParams.get('id')

    if (!id) {
      return NextResponse.json({ error: 'Device ID is required' }, { status: 400 })
    }

    const { error } = await supabase
      .from('devices')
      .delete()
      .eq('id', id)

    if (error) {
      return NextResponse.json({ error: error.message }, { status: 500 })
    }

    return NextResponse.json({ success: true, message: 'Device removed successfully' })
  } catch (err) {
    return NextResponse.json({ error: err.message }, { status: 500 })
  }
}
