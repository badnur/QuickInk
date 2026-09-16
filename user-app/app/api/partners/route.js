import { NextResponse } from 'next/server'
import { supabase } from '@/lib/supabase'

export const dynamic = 'force-dynamic'

// Shared fallback store in case Supabase table is unreachable
let fallbackPartners = [
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
]

function generateReferenceId() {
  const num = Math.floor(100000 + Math.random() * 900000)
  return `QIK-REG-${num}`
}

/**
 * POST /api/partners
 * Submit a new Shop or Kiosk Registration application
 */
export async function POST(request) {
  try {
    const body = await request.json()
    const {
      type = 'shop',
      name,
      shop_name,
      phone,
      email = '',
      location,
      city = 'Dhaka',
      operating_hours = '09:00 AM - 10:00 PM',
      printer_model = '',
      space_type = '',
      daily_footfall = '',
      power_backup = true,
    } = body

    if (!name || !shop_name || !location || !phone) {
      return NextResponse.json(
        { error: 'Required fields missing: name, shop_name, location, phone' },
        { status: 400 }
      )
    }

    const reference_id = generateReferenceId()

    const newRecord = {
      reference_id,
      type: type === 'kiosk' ? 'kiosk' : 'shop',
      name,
      shop_name,
      phone,
      email,
      location,
      city,
      operating_hours,
      printer_model,
      space_type: space_type || (type === 'kiosk' ? 'Commercial / Campus' : 'Print Shop'),
      daily_footfall,
      power_backup: Boolean(power_backup),
      status: 'pending',
      commission_rate: 40.0,
    }

    // Try inserting into Supabase
    try {
      const { data, error } = await supabase
        .from('partners')
        .insert([newRecord])
        .select()
        .single()

      if (!error && data) {
        return NextResponse.json(
          {
            success: true,
            message: 'Application submitted successfully',
            partner: data,
            reference_id,
          },
          { status: 201 }
        )
      }
      if (error) {
        console.warn('Supabase insert warning:', error.message)
      }
    } catch (dbErr) {
      console.warn('Supabase insert exception:', dbErr.message)
    }

    // Fallback store
    const fallbackItem = {
      ...newRecord,
      id: `partner_${Date.now()}`,
      created_at: new Date().toISOString(),
    }
    fallbackPartners.unshift(fallbackItem)

    return NextResponse.json(
      {
        success: true,
        message: 'Application registered successfully',
        partner: fallbackItem,
        reference_id,
      },
      { status: 201 }
    )
  } catch (error) {
    console.error('API error:', error)
    return NextResponse.json(
      { error: 'Internal server error', details: error.message },
      { status: 500 }
    )
  }
}

/**
 * GET /api/partners
 * Query partner list or track single application by ?ref=... or ?phone=...
 */
export async function GET(request) {
  try {
    const { searchParams } = new URL(request.url)
    const ref = searchParams.get('ref')
    const phone = searchParams.get('phone')

    // 1. Single Application Status Lookup
    if (ref || phone) {
      let query = supabase.from('partners').select('*')
      if (ref) query = query.eq('reference_id', ref.trim().toUpperCase())
      else if (phone) query = query.eq('phone', phone.trim())

      const { data, error } = await query

      if (!error && data && data.length > 0) {
        return NextResponse.json({ success: true, partner: data[0] })
      }

      // Check fallback store
      const match = fallbackPartners.find((p) => {
        if (ref && p.reference_id && p.reference_id.toUpperCase() === ref.trim().toUpperCase()) return true
        if (phone && p.phone === phone.trim()) return true
        return false
      })

      if (match) {
        return NextResponse.json({ success: true, partner: match })
      }

      return NextResponse.json(
        { error: 'No application found with provided reference code or phone number.' },
        { status: 404 }
      )
    }

    // 2. Fetch all partners
    const { data, error } = await supabase
      .from('partners')
      .select('*')
      .order('created_at', { ascending: false })

    if (!error && data && data.length > 0) {
      return NextResponse.json({ success: true, partners: data })
    }

    return NextResponse.json({ success: true, partners: fallbackPartners })
  } catch (error) {
    console.error('API error:', error)
    return NextResponse.json(
      { error: 'Internal server error', details: error.message },
      { status: 500 }
    )
  }
}
