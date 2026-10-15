import { NextResponse } from 'next/server'
import { supabase } from '@/lib/supabase'
import { enforceRateLimit, RATE_LIMITS } from '@/lib/rate-limiter'

export const dynamic = 'force-dynamic'

// Fallback store in case Supabase table is unreachable
let fallbackPartners = []

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
    const rateLimitRes = enforceRateLimit(request, 'partner_apply', RATE_LIMITS.PARTNER_APPLY)
    if (rateLimitRes) return rateLimitRes

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

    const cleanName = String(name).trim().slice(0, 100)
    const cleanShopName = String(shop_name).trim().slice(0, 100)
    const cleanPhone = String(phone).trim().replace(/[^0-9+]/g, '').slice(0, 20)
    const cleanEmail = email ? String(email).trim().slice(0, 100) : ''
    const cleanLocation = String(location).trim().slice(0, 250)
    const cleanCity = String(city || 'Dhaka').trim().slice(0, 50)
    const cleanHours = String(operating_hours || '09:00 AM - 10:00 PM').trim().slice(0, 100)
    const cleanModel = String(printer_model || '').trim().slice(0, 100)
    const cleanSpace = String(space_type || (type === 'kiosk' ? 'Commercial / Campus' : 'Print Shop')).trim().slice(0, 100)
    const cleanFootfall = String(daily_footfall || '').trim().slice(0, 50)

    if (cleanName.length < 2 || cleanShopName.length < 2 || cleanLocation.length < 2) {
      return NextResponse.json({ error: 'Applicant name, shop name, and address must be at least 2 characters.' }, { status: 400 })
    }

    if (!/^(\+?88)?01[3-9]\d{8}$/.test(cleanPhone.replace(/[\s-]/g, ''))) {
      return NextResponse.json({ error: 'Please enter a valid Bangladesh mobile number (e.g. 017xxxxxxxx).' }, { status: 400 })
    }

    if (cleanEmail && !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(cleanEmail)) {
      return NextResponse.json({ error: 'Please enter a valid email address.' }, { status: 400 })
    }

    const reference_id = generateReferenceId()

    const newRecord = {
      reference_id,
      type: type === 'kiosk' ? 'kiosk' : 'shop',
      name: cleanName,
      shop_name: cleanShopName,
      phone: cleanPhone,
      email: cleanEmail,
      location: cleanLocation,
      city: cleanCity,
      operating_hours: cleanHours,
      printer_model: cleanModel,
      space_type: cleanSpace,
      daily_footfall: cleanFootfall,
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
    const rateLimitRes = enforceRateLimit(request, 'partner_search', RATE_LIMITS.SEARCH)
    if (rateLimitRes) return rateLimitRes

    const { searchParams } = new URL(request.url)
    const ref = searchParams.get('ref')
    const phone = searchParams.get('phone')

    // 1. Single Application Status Lookup
    if (ref || phone) {
      let query = supabase.from('partners').select('id, reference_id, shop_name, status, created_at, phone')
      if (ref) query = query.eq('reference_id', ref.trim().toUpperCase())
      else if (phone) query = query.eq('phone', phone.trim())

      const { data, error } = await query

      let match = (!error && data && data.length > 0) ? data[0] : null

      if (!match) {
        match = fallbackPartners.find((p) => {
          if (ref && p.reference_id && p.reference_id.toUpperCase() === ref.trim().toUpperCase()) return true
          if (phone && p.phone === phone.trim()) return true
          return false
        })
      }

      if (match) {
        // Security: Mask phone number and expose only non-sensitive applicant tracking status
        const maskedPhone = match.phone ? String(match.phone).replace(/(\d{3})\d+(\d{3})/, '$1****$2') : ''
        return NextResponse.json({
          success: true,
          partner: {
            id: match.id,
            reference_id: match.reference_id,
            shop_name: match.shop_name,
            phone: maskedPhone,
            status: match.status,
            created_at: match.created_at,
          }
        })
      }

      return NextResponse.json(
        { error: 'No application found with provided reference code or phone number.' },
        { status: 404 }
      )
    }

    // 2. Fetch all partners — Requires Admin Authentication
    const authHeader = request.headers.get('authorization')
    const adminKey = request.headers.get('x-admin-key')
    const validSecret = process.env.ADMIN_JWT_SECRET || process.env.JWT_SECRET
    const bearerToken = authHeader?.startsWith('Bearer ') ? authHeader.substring(7).trim() : null
    const isAdmin = Boolean(validSecret && ((adminKey && adminKey === validSecret) || (bearerToken && bearerToken === validSecret)))

    if (!isAdmin) {
      return NextResponse.json(
        { error: 'Unauthorized. Partner search requires reference code (?ref=) or phone number (?phone=).' },
        { status: 401 }
      )
    }

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
