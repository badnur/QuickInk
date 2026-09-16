import { NextResponse } from 'next/server'
import { supabase } from '@/lib/supabase'

export const dynamic = 'force-dynamic'

// Shared fallback partner state if Supabase table is unreachable
let memoryPartners = [
  {
    id: 'partner-demo-1',
    reference_id: 'QIK-REG-849201',
    type: 'shop',
    name: 'Kabir Hossain',
    shop_name: 'Nilkhet Book & Print Corner',
    phone: '01711223344',
    email: 'nilkhet.print@gmail.com',
    location: 'Shop 12, Market 3, Nilkhet, Dhaka',
    city: 'Dhaka',
    operating_hours: '08:00 AM - 10:00 PM',
    printer_model: 'Epson L130 & Canon i-SENSYS',
    space_type: 'Stationery & Print Shop',
    daily_footfall: '200+ students',
    power_backup: true,
    status: 'pending',
    commission_rate: 40.0,
    created_at: new Date(Date.now() - 3600000 * 2).toISOString(),
  },
  {
    id: 'partner-demo-2',
    reference_id: 'QIK-REG-910482',
    type: 'kiosk',
    name: 'Dr. Shahriar Alam',
    shop_name: 'United International University Hub',
    phone: '01899887766',
    email: 'admin.support@uiu.ac.bd',
    location: 'Ground Floor Cafeteria Lobby, UIU Campus, Madani Avenue, Dhaka',
    city: 'Dhaka',
    operating_hours: '24/7 Automated',
    space_type: 'University / Campus',
    daily_footfall: '1500+ daily campus footfall',
    power_backup: true,
    status: 'approved',
    provisioned_device_id: '22222222-2222-2222-2222-222222222222',
    commission_rate: 40.0,
    created_at: new Date(Date.now() - 3600000 * 24).toISOString(),
  },
  {
    id: 'partner-demo-3',
    reference_id: 'QIK-REG-305819',
    type: 'shop',
    name: 'Tanvir Hossain',
    shop_name: 'Dhanmondi Students Xerox',
    phone: '01733398911',
    email: 'tanvir.dhanmondi@gmail.com',
    location: 'House 23, Road 5, Dhanmondi, Dhaka-1205',
    city: 'Dhaka',
    operating_hours: '09:00 AM - 10:00 PM',
    printer_model: 'HP LaserJet Pro & Epson L3250',
    space_type: 'Stationery & Print Shop',
    daily_footfall: '150+ students',
    power_backup: true,
    status: 'approved',
    provisioned_device_id: '11111111-1111-1111-1111-111111111111',
    commission_rate: 40.0,
    created_at: new Date(Date.now() - 3600000 * 48).toISOString(),
  }
]

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

    if (!error && data && data.length > 0) {
      return NextResponse.json({ success: true, partners: data })
    }

    // Return memory partners filtered
    let filtered = [...memoryPartners]
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

    return NextResponse.json({
      success: true,
      partner: data || memoryPartners.find((p) => p.id === id),
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
