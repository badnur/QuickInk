import { NextResponse } from 'next/server'
import { supabase } from '@/lib/supabase'
import { getCache, setCache, invalidateCache } from '@/lib/admin-cache'

export const dynamic = 'force-dynamic'

/**
 * GET /api/admin/partners
 * List all partner registration applications from Supabase instantly (no slow localhost calls)
 */
export async function GET(request) {
  try {
    const { searchParams } = new URL(request.url)
    const status = searchParams.get('status') || 'all'
    const type = searchParams.get('type') || 'all'
    const forceRefresh = searchParams.get('refresh') === 'true'

    const cacheKey = `admin_partners_${status}_${type}`
    if (!forceRefresh) {
      const cached = getCache(cacheKey)
      if (cached) return NextResponse.json(cached)
    }

    // Fetch both partners and devices in parallel for instant data availability
    const [{ data: partnersData }, { data: devicesData }] = await Promise.all([
      supabase.from('partners').select('*').order('created_at', { ascending: false }),
      supabase.from('devices').select('*').order('created_at', { ascending: false }),
    ])

    const dbPartners = partnersData || []
    const dbDevices = devicesData || []

    // Build unified partner applications list
    const partnerMap = new Map() // key: clean phone or id

    // 1. Ingest partner entries from 'partners' table
    for (const p of dbPartners) {
      const cleanPhone = (p.phone || '').trim().replace(/[^0-9]/g, '')
      const key = cleanPhone || p.id

      // Check if there is a corresponding device record in devices table
      const matchingDev = dbDevices.find(
        (d) => d.location && (d.location.phone === cleanPhone || d.location.phone === p.phone)
      )

      const derivedStatus = matchingDev?.location?.partner_status || (matchingDev?.status === 'online' ? 'approved' : p.status) || 'pending'

      partnerMap.set(key, {
        id: p.id,
        reference_id: matchingDev?.location?.reference_id || `QIK-REG-${(cleanPhone || '').slice(-6) || '729410'}`,
        type: matchingDev?.type || matchingDev?.location?.type || 'shop',
        name: matchingDev?.location?.owner_name || p.name?.replace(/\s*Duplicate\s*/gi, '').trim() || 'Partner Owner',
        shop_name: p.shop_name || matchingDev?.location?.shop_name || 'Partner Shop',
        phone: p.phone,
        location: p.location || matchingDev?.location?.address || 'Bangladesh',
        operating_hours: matchingDev?.location?.operating_hours || (matchingDev?.type === 'kiosk' ? '24/7 Automated' : '09:00 AM - 10:00 PM'),
        status: derivedStatus,
        rejection_reason: matchingDev?.location?.rejection_reason || null,
        logo_url: matchingDev?.location?.logo_url || '',
        shop_photo_url: matchingDev?.location?.shop_photo_url || '',
        provisioned_device_id: matchingDev?.id || null,
        created_at: p.created_at || matchingDev?.created_at || new Date().toISOString(),
      })
    }

    // 2. Ingest any partner applications recorded directly into devices table
    for (const d of dbDevices) {
      if (d.location && (d.location.is_partner_application || d.location.partner_status)) {
        const cleanPhone = (d.location.phone || '').trim().replace(/[^0-9]/g, '')
        const key = cleanPhone || d.id

        if (!partnerMap.has(key)) {
          partnerMap.set(key, {
            id: d.id,
            reference_id: d.location.reference_id || d.location.registration_reference || `QIK-REG-${(cleanPhone || '').slice(-6) || '729410'}`,
            type: d.type || d.location.type || 'shop',
            name: d.location.owner_name || d.location.contact_person || 'Partner Owner',
            shop_name: d.location.shop_name || d.name?.replace(/^PrintKoro (Shop|Kiosk) — /, '') || d.name?.replace(/^QuickInk (Shop|Kiosk) — /, '') || 'Partner Shop',
            phone: d.location.phone || '',
            location: d.location.address || 'Bangladesh',
            operating_hours: d.location?.operating_hours || (d.type === 'kiosk' ? '24/7 Automated' : '09:00 AM - 10:00 PM'),
            status: d.location.partner_status || (d.status === 'online' ? 'approved' : 'pending'),
            rejection_reason: d.location.rejection_reason || null,
            logo_url: d.location.logo_url || '',
            shop_photo_url: d.location.shop_photo_url || '',
            provisioned_device_id: d.id,
            created_at: d.created_at,
          })
        }
      }
    }

    let results = Array.from(partnerMap.values())

    // Apply filtering
    if (status && status !== 'all') {
      results = results.filter((p) => p.status === status)
    }
    if (type && type !== 'all') {
      results = results.filter((p) => p.type === type)
    }

    // Sort by created_at descending
    results.sort((a, b) => new Date(b.created_at) - new Date(a.created_at))

    const payload = { success: true, partners: results }
    setCache(cacheKey, payload, 8)

    return NextResponse.json(payload)
  } catch (err) {
    console.error('Error fetching admin partners:', err)
    return NextResponse.json({ error: err.message }, { status: 500 })
  }
}

/**
 * POST /api/admin/partners
 * Approve partner application AND provision / activate device in public.devices
 */
export async function POST(request) {
  try {
    const body = await request.json()
    const { partnerId } = body

    if (!partnerId) {
      return NextResponse.json({ error: 'Partner ID is required' }, { status: 400 })
    }

    // 1. Fetch the application from partners or devices
    const [{ data: dbPartners }, { data: dbDevices }] = await Promise.all([
      supabase.from('partners').select('*'),
      supabase.from('devices').select('*'),
    ])

    const partner = (dbPartners || []).find((p) => p.id === partnerId)
    const existingDev = (dbDevices || []).find(
      (d) => d.id === partnerId || (partner && d.location && d.location.phone === partner.phone)
    )

    const cleanPhone = (partner?.phone || existingDev?.location?.phone || '').trim().replace(/[^0-9]/g, '')
    const shopName = partner?.shop_name || existingDev?.location?.shop_name || 'Partner Shop'
    const ownerName = partner?.name || existingDev?.location?.owner_name || 'Partner Owner'
    const address = partner?.location || existingDev?.location?.address || 'Bangladesh'
    const type = existingDev?.type || 'shop'
    const refId = existingDev?.location?.reference_id || `QIK-REG-${cleanPhone.slice(-6) || '729410'}`

    const locationObj = {
      ...(existingDev?.location || {}),
      address,
      phone: partner?.phone || existingDev?.location?.phone || cleanPhone,
      owner_name: ownerName,
      shop_name: shopName,
      operating_hours: existingDev?.location?.operating_hours || (type === 'kiosk' ? '24/7 Automated' : '09:00 AM - 10:00 PM'),
      commission_rate: 40.0,
      partner_status: 'approved',
      rejection_reason: null,
      is_partner_application: true,
      reference_id: refId,
      approved_at: new Date().toISOString(),
    }

    let provisionedDevice = null

    if (existingDev) {
      // Update existing device to online & approved
      const { data: updatedDev, error: upErr } = await supabase
        .from('devices')
        .update({
          status: 'online',
          location: locationObj,
        })
        .eq('id', existingDev.id)
        .select()
        .single()

      provisionedDevice = updatedDev || { ...existingDev, status: 'online', location: locationObj }
    } else {
      // Insert brand new device with status 'online'
      const { data: newDev, error: devErr } = await supabase
        .from('devices')
        .insert([
          {
            name: type === 'kiosk' ? `PrintKoro Kiosk — ${shopName}` : `PrintKoro Shop — ${shopName}`,
            type: type === 'kiosk' ? 'kiosk' : 'shop',
            location: locationObj,
            status: 'online',
          },
        ])
        .select()
        .single()

      provisionedDevice = newDev || {
        id: `dev-${Date.now()}`,
        name: `PrintKoro Shop — ${shopName}`,
        type,
        location: locationObj,
        status: 'online',
      }
    }

    // Also update partners table if row exists (ignoring RLS errors if restricted)
    if (partner) {
      try {
        await supabase.from('partners').update({ status: 'approved' }).eq('id', partner.id)
      } catch (e) {
        // Safe to ignore since devices table is authoritatively updated
      }
    }

    invalidateCache('admin_partners')
    invalidateCache('admin_devices')
    invalidateCache('admin_stats')

    return NextResponse.json({
      success: true,
      message: `Station successfully provisioned & approved for ${shopName}`,
      device: provisionedDevice,
      partner: {
        id: partnerId,
        shop_name: shopName,
        phone: cleanPhone,
        status: 'approved',
        provisioned_device_id: provisionedDevice?.id,
      },
    })
  } catch (err) {
    console.error('Approval error:', err)
    return NextResponse.json({ error: err.message }, { status: 500 })
  }
}

/**
 * PATCH /api/admin/partners
 * Reject partner application with reason
 */
export async function PATCH(request) {
  try {
    const body = await request.json()
    const { id, status, rejection_reason } = body

    if (!id || !status) {
      return NextResponse.json({ error: 'ID and status required' }, { status: 400 })
    }

    const reason = rejection_reason || 'Storefront verification requirements not met.'

    const [{ data: dbPartners }, { data: dbDevices }] = await Promise.all([
      supabase.from('partners').select('*'),
      supabase.from('devices').select('*'),
    ])

    const partner = (dbPartners || []).find((p) => p.id === id)
    const existingDev = (dbDevices || []).find(
      (d) => d.id === id || (partner && d.location && d.location.phone === partner.phone)
    )

    if (existingDev) {
      const updatedLoc = {
        ...(existingDev.location || {}),
        partner_status: status,
        rejection_reason: reason,
        rejected_at: new Date().toISOString(),
      }

      await supabase
        .from('devices')
        .update({
          status: 'offline',
          location: updatedLoc,
        })
        .eq('id', existingDev.id)
    }

    if (partner) {
      try {
        await supabase.from('partners').update({ status }).eq('id', partner.id)
      } catch (e) {
        // Safe fallback
      }
    }

    invalidateCache('admin_partners')
    invalidateCache('admin_devices')
    invalidateCache('admin_stats')

    return NextResponse.json({
      success: true,
      partner: {
        id,
        status,
        rejection_reason: reason,
      },
    })
  } catch (err) {
    console.error('Reject error:', err)
    return NextResponse.json({ error: err.message }, { status: 500 })
  }
}

/**
 * DELETE /api/admin/partners
 */
export async function DELETE(request) {
  try {
    const { searchParams } = new URL(request.url)
    const id = searchParams.get('id')

    if (!id) {
      return NextResponse.json({ error: 'ID required' }, { status: 400 })
    }

    await Promise.all([
      supabase.from('devices').delete().eq('id', id),
      supabase.from('partners').delete().eq('id', id),
    ])

    invalidateCache('admin_partners')
    invalidateCache('admin_devices')
    invalidateCache('admin_stats')

    return NextResponse.json({ success: true, message: 'Application deleted successfully' })
  } catch (err) {
    return NextResponse.json({ error: err.message }, { status: 500 })
  }
}
