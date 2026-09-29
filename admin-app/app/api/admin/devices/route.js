import { NextResponse } from 'next/server'
import { supabase } from '@/lib/supabase'
import { getCache, setCache, invalidateCache } from '@/lib/admin-cache'
import { logAdminAction } from '@/lib/audit-logger'

export const dynamic = 'force-dynamic'

const CACHE_KEY = 'admin_devices'

/**
 * GET /api/admin/devices
 */
export async function GET(request) {
  try {
    const { searchParams } = new URL(request?.url || 'http://localhost')
    const forceRefresh = searchParams.get('refresh') === 'true'

    if (!forceRefresh) {
      const cached = getCache(CACHE_KEY)
      if (cached) return NextResponse.json(cached)
    }

    const { data: devices, error } = await supabase
      .from('devices')
      .select(`
        *,
        pricing_tiers (
          id,
          name,
          bw_price,
          color_price,
          is_default
        )
      `)
      .order('created_at', { ascending: false })

    if (error) {
      return NextResponse.json({ error: error.message }, { status: 500 })
    }

    const payload = { success: true, devices: devices || [] }
    setCache(CACHE_KEY, payload, 8)

    return NextResponse.json(payload)
  } catch (err) {
    return NextResponse.json({ error: err.message }, { status: 500 })
  }
}

/**
 * POST /api/admin/devices
 * Create a new device/kiosk with pairing credentials
 */
export async function POST(request) {
  try {
    const adminEmail = request.headers.get('x-admin-email') || 'superadmin@printkoro.com'
    const ip = request.headers.get('x-forwarded-for') || '127.0.0.1'

    const body = await request.json()
    const { name, type = 'kiosk', address, phone, operating_hours = '24/7', pricing_tier_id = null } = body

    if (!name || !address) {
      return NextResponse.json({ error: 'Name and address are required' }, { status: 400 })
    }

    // Auto-generate terminal pairing key
    const pairingKey = `PK-TERM-${Math.random().toString(36).substring(2, 6).toUpperCase()}-${Math.random().toString(36).substring(2, 6).toUpperCase()}`

    const locationObj = {
      address,
      phone: phone || '',
      operating_hours,
      created_via: 'admin_dashboard',
      pairing_key: pairingKey,
      last_heartbeat: new Date().toISOString(),
    }

    const { data, error } = await supabase
      .from('devices')
      .insert([{
        name,
        type: type === 'shop' ? 'shop' : 'kiosk',
        location: locationObj,
        status: 'online',
        pricing_tier_id: pricing_tier_id || null,
      }])
      .select()
      .single()

    if (error) {
      return NextResponse.json({ error: error.message }, { status: 500 })
    }

    await logAdminAction({
      actorEmail: adminEmail,
      action: 'DEVICE_CREATE',
      resourceType: 'device',
      resourceId: data.id,
      details: { name: data.name, type: data.type, pairingKey },
      ip,
    })

    invalidateCache('admin_devices')
    invalidateCache('admin_stats')

    return NextResponse.json({ success: true, device: data, pairingKey }, { status: 201 })
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
    const adminEmail = request.headers.get('x-admin-email') || 'superadmin@printkoro.com'
    const ip = request.headers.get('x-forwarded-for') || '127.0.0.1'

    const body = await request.json()
    const { id, name, status, type, location, pricing_tier_id, action: customAction } = body

    if (!id) {
      return NextResponse.json({ error: 'Device ID is required' }, { status: 400 })
    }

    // Handle remote ping / test print dispatch
    if (customAction === 'REMOTE_TEST_PRINT') {
      await logAdminAction({
        actorEmail: adminEmail,
        action: 'DEVICE_TEST_PRINT_DISPATCH',
        resourceType: 'device',
        resourceId: id,
        details: { command: 'PRINT_TEST_ALIGNMENT_SHEET' },
        ip,
      })
      return NextResponse.json({ success: true, message: 'Remote test print command queued for station.' })
    }

    // Handle regenerate pairing key
    if (customAction === 'REGENERATE_PAIRING_KEY') {
      const newPairingKey = `PK-TERM-${Math.random().toString(36).substring(2, 6).toUpperCase()}-${Math.random().toString(36).substring(2, 6).toUpperCase()}`
      const existingLoc = location || {}
      existingLoc.pairing_key = newPairingKey

      const { data, error } = await supabase
        .from('devices')
        .update({ location: existingLoc })
        .eq('id', id)
        .select()
        .single()

      if (error) return NextResponse.json({ error: error.message }, { status: 500 })

      await logAdminAction({
        actorEmail: adminEmail,
        action: 'DEVICE_REGEN_PAIRING_KEY',
        resourceType: 'device',
        resourceId: id,
        details: { newPairingKey },
        ip,
      })

      invalidateCache('admin_devices')
      return NextResponse.json({ success: true, device: data, newPairingKey })
    }

    const updates = {}
    if (name) updates.name = name
    if (status) updates.status = status
    if (type) updates.type = type
    if (location) updates.location = location
    if (pricing_tier_id !== undefined) updates.pricing_tier_id = pricing_tier_id || null

    const { data, error } = await supabase
      .from('devices')
      .update(updates)
      .eq('id', id)
      .select()
      .single()

    if (error) {
      return NextResponse.json({ error: error.message }, { status: 500 })
    }

    await logAdminAction({
      actorEmail: adminEmail,
      action: 'DEVICE_UPDATE',
      resourceType: 'device',
      resourceId: id,
      details: updates,
      ip,
    })

    invalidateCache('admin_devices')
    invalidateCache('admin_stats')

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
    const adminEmail = request.headers.get('x-admin-email') || 'superadmin@printkoro.com'
    const ip = request.headers.get('x-forwarded-for') || '127.0.0.1'

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

    await logAdminAction({
      actorEmail: adminEmail,
      action: 'DEVICE_DELETE',
      resourceType: 'device',
      resourceId: id,
      ip,
    })

    invalidateCache('admin_devices')
    invalidateCache('admin_stats')

    return NextResponse.json({ success: true, message: 'Device removed successfully' })
  } catch (err) {
    return NextResponse.json({ error: err.message }, { status: 500 })
  }
}
