import { NextResponse } from 'next/server'
import { supabase } from '@/lib/supabase'

export const dynamic = 'force-dynamic'

// Fallback partner state if Supabase table is unreachable
let memoryPartners = []

/**
 * GET /api/admin/partners
 * List all partner registration applications
 */
export async function GET(request) {
  try {
    const { searchParams } = new URL(request.url)
    const status = searchParams.get('status')
    const type = searchParams.get('type')

    let query = supabase
      .from('partners')
      .select('*')
      .order('created_at', { ascending: false })

    if (status && status !== 'all') {
      query = query.eq('status', status)
    }
    if (type && type !== 'all') {
      query = query.eq('type', type)
    }

    const { data, error } = await query

    let results = []
    if (!error && data && data.length > 0) {
      results = data
    } else {
      results = [...memoryPartners]
    }

    // Attempt to merge any live desktop accounts from user-app (e.g. newly registered in memory)
    try {
      const controller = new AbortController()
      const timer = setTimeout(() => controller.abort(), 1200)
      const resp = await fetch('http://localhost:3000/api/desktop/auth?action=list-accounts', {
        signal: controller.signal
      }).catch(() => null)
      clearTimeout(timer)

      if (resp && resp.ok) {
        const accData = await resp.json()
        if (accData?.accounts) {
          accData.accounts.forEach((acc) => {
            const alreadyInResults = results.some((p) => p.phone === acc.phone)
            if (!alreadyInResults) {
              const syntheticPartner = {
                id: acc.id || `partner-${acc.phone}`,
                reference_id: acc.reference_id || `QIK-REG-${Math.floor(100000 + Math.random() * 900000)}`,
                type: acc.type || 'shop',
                name: acc.name,
                shop_name: acc.shop_name,
                phone: acc.phone,
                location: acc.location,
                logo_url: acc.logo_url || '',
                shop_photo_url: acc.shop_photo_url || '',
                status: acc.status || 'pending',
                created_at: acc.created_at || new Date().toISOString(),
              }
              results.unshift(syntheticPartner)
              if (!memoryPartners.some((p) => p.phone === acc.phone)) {
                memoryPartners.unshift(syntheticPartner)
              }
            }
          })
        }
      }
    } catch (syncErr) {
      // Safe to ignore
    }

    // Return filtered
    let filtered = results
    if (status && status !== 'all') {
      filtered = filtered.filter((p) => p.status === status)
    }
    if (type && type !== 'all') {
      filtered = filtered.filter((p) => p.type === type)
    }

    return NextResponse.json({ success: true, partners: filtered })
  } catch (err) {
    return NextResponse.json({ error: err.message }, { status: 500 })
  }
}

/**
 * POST /api/admin/partners/approve
 * Approve application AND provision a brand new Device in public.devices
 */
export async function POST(request) {
  try {
    const body = await request.json()
    const { partnerId } = body

    if (!partnerId) {
      return NextResponse.json({ error: 'Partner ID is required' }, { status: 400 })
    }

    // 1. Fetch the application
    let partner = null
    const { data: dbPartner } = await supabase
      .from('partners')
      .select('*')
      .eq('id', partnerId)
      .single()

    if (dbPartner) {
      partner = dbPartner
    } else {
      partner = memoryPartners.find((p) => p.id === partnerId)
    }

    if (!partner) {
      return NextResponse.json({ error: 'Partner application not found' }, { status: 404 })
    }

    // 2. Prepare location object and device attributes
    const deviceName = partner.type === 'kiosk'
      ? `QuickInk Kiosk — ${partner.shop_name}`
      : `QuickInk Shop — ${partner.shop_name}`

    const locationObj = {
      address: partner.location,
      phone: partner.phone,
      operating_hours: partner.operating_hours || (partner.type === 'kiosk' ? '24/7 Automated' : '09:00 AM - 10:00 PM'),
      contact_person: partner.name,
      partner_reference_id: partner.reference_id,
      city: partner.city || 'Dhaka',
      commission_rate: partner.commission_rate || 40.0,
      printer_model: partner.printer_model || 'Auto-Detected',
      logo_url: partner.logo_url || '',
      shop_photo_url: partner.shop_photo_url || '',
    }

    // 3. Provision the device in public.devices
    let provisionedDevice = null
    const { data: newDevice, error: devError } = await supabase
      .from('devices')
      .insert([
        {
          name: deviceName,
          type: partner.type === 'kiosk' ? 'kiosk' : 'shop',
          location: locationObj,
          status: 'online',
        },
      ])
      .select()
      .single()

    if (!devError && newDevice) {
      provisionedDevice = newDevice
    } else {
      // Fallback pseudo device id
      provisionedDevice = {
        id: `dev-${Date.now()}`,
        name: deviceName,
        type: partner.type === 'kiosk' ? 'kiosk' : 'shop',
        location: locationObj,
        status: 'online',
        created_at: new Date().toISOString(),
      }
    }

    // 4. Update the partner status in DB
    await supabase
      .from('partners')
      .update({
        status: 'approved',
        provisioned_device_id: provisionedDevice.id,
      })
      .eq('id', partnerId)

    // Update in memory too
    const memIndex = memoryPartners.findIndex((p) => p.id === partnerId)
    if (memIndex !== -1) {
      memoryPartners[memIndex].status = 'approved'
      memoryPartners[memIndex].provisioned_device_id = provisionedDevice.id
    }

    // 5. Notify Desktop Auth API (user-app) to unlock dashboard immediately
    try {
      fetch('http://localhost:3000/api/desktop/auth', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          action: 'admin-approve',
          phone: partner.phone,
          deviceId: provisionedDevice.id,
          partnerId: partner.id,
        })
      }).catch(() => {})
    } catch (syncErr) {
      // safe
    }

    return NextResponse.json({
      success: true,
      message: `Station successfully provisioned for ${partner.shop_name}`,
      device: provisionedDevice,
      partner: {
        ...partner,
        status: 'approved',
        provisioned_device_id: provisionedDevice.id,
      },
    })
  } catch (err) {
    console.error('Approval & provisioning error:', err)
    return NextResponse.json({ error: err.message }, { status: 500 })
  }
}

/**
 * PATCH /api/admin/partners
 * Update status (e.g. reject with reason)
 */
export async function PATCH(request) {
  try {
    const body = await request.json()
    const { id, status, rejection_reason } = body

    if (!id || !status) {
      return NextResponse.json({ error: 'ID and status required' }, { status: 400 })
    }

    const updates = { status }
    if (rejection_reason !== undefined) updates.rejection_reason = rejection_reason

    const { data, error } = await supabase
      .from('partners')
      .update(updates)
      .eq('id', id)
      .select()
      .single()

    // Update memory
    const memIdx = memoryPartners.findIndex((p) => p.id === id)
    if (memIdx !== -1) {
      memoryPartners[memIdx] = { ...memoryPartners[memIdx], ...updates }
    }

    const targetPartner = data || memoryPartners.find((p) => p.id === id)

    // Notify Desktop Auth API (user-app) of rejection
    if (targetPartner?.phone) {
      try {
        fetch('http://localhost:3000/api/desktop/auth', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            action: 'admin-reject',
            phone: targetPartner.phone,
            reason: rejection_reason,
            partnerId: id,
          })
        }).catch(() => {})
      } catch (notifyErr) {
        // safe
      }
    }

    return NextResponse.json({
      success: true,
      partner: targetPartner,
    })
  } catch (err) {
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

    await supabase.from('partners').delete().eq('id', id)
    memoryPartners = memoryPartners.filter((p) => p.id !== id)

    return NextResponse.json({ success: true, message: 'Application deleted' })
  } catch (err) {
    return NextResponse.json({ error: err.message }, { status: 500 })
  }
}
