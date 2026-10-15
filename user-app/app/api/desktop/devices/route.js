import { NextResponse } from 'next/server'
import { supabase } from '@/lib/supabase'

export const DEFAULT_DEVICES = [
  {
    id: '11111111-1111-1111-1111-111111111111',
    name: 'PrintKoro Partner Shop - Dhanmondi',
    type: 'shop',
    location: {
      address: 'House 23, Road 5, Dhanmondi, Dhaka-1205',
      phone: '+880 1733-398911',
    },
    status: 'online',
  },
  {
    id: '22222222-2222-2222-2222-222222222222',
    name: 'PrintKoro Kiosk - Central Mall',
    type: 'kiosk',
    location: {
      address: 'Level 1, Central Shopping Mall, Dhanmondi, Dhaka',
      phone: '+880 1700-000002',
    },
    status: 'online',
  },
  {
    id: '33333333-3333-3333-3333-333333333333',
    name: 'PrintKoro Partner Shop - University Campus',
    type: 'shop',
    location: {
      address: 'Near Central Library, University Campus, Dhaka',
      phone: '+880 1712-345678',
    },
    status: 'online',
  },
]

export async function GET() {
  try {
    const { data: dbDevices, error } = await supabase
      .from('devices')
      .select('*')
      .order('name', { ascending: true })

    const rawList = (!error && dbDevices && dbDevices.length > 0) ? dbDevices : DEFAULT_DEVICES

    // Security: Strip passwords, credit history, and sensitive internal fields before returning
    const sanitizedDevices = rawList.map((d) => {
      const loc = { ...(d.location || {}) }
      delete loc.password
      delete loc.credit_history
      delete loc.suspension_reason
      return {
        id: d.id,
        name: d.name,
        type: d.type,
        status: d.status,
        pricing_tier_id: d.pricing_tier_id || null,
        location: loc,
      }
    })

    return NextResponse.json({ success: true, devices: sanitizedDevices })
  } catch (err) {
    console.error('Fetch devices error:', err)
    return NextResponse.json({ success: true, devices: DEFAULT_DEVICES })
  }
}
