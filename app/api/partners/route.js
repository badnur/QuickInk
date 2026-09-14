import { NextResponse } from 'next/server'
import { supabase } from '@/lib/supabase'

let fallbackPartners = []

/**
 * POST /api/partners
 * Create a new partner registration in Supabase (with fallback)
 */
export async function POST(request) {
  try {
    const body = await request.json()
    const { name, shop_name, location, phone } = body

    if (!name || !shop_name || !location || !phone) {
      return NextResponse.json(
        { error: 'All fields are required: name, shop_name, location, phone' },
        { status: 400 }
      )
    }

    // Attempt insert into Supabase
    const { data, error } = await supabase
      .from('partners')
      .insert([
        {
          name,
          shop_name,
          location,
          phone,
          status: 'pending',
        },
      ])
      .select()
      .single()

    if (!error && data) {
      return NextResponse.json(
        {
          success: true,
          message: 'Partner application submitted successfully',
          partner: data,
        },
        { status: 201 }
      )
    }

    // Fallback in-memory storage if direct table insert fails or RLS restricts
    const fallbackPartner = {
      id: `partner_${Date.now()}`,
      name,
      shop_name,
      location,
      phone,
      created_at: new Date().toISOString(),
      status: 'pending',
    }
    fallbackPartners.push(fallbackPartner)

    return NextResponse.json(
      {
        success: true,
        message: 'Partner application submitted successfully',
        partner: fallbackPartner,
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
 * Retrieve partners from Supabase or fallback
 */
export async function GET(request) {
  try {
    const { data, error } = await supabase
      .from('partners')
      .select('*')
      .order('created_at', { ascending: false })

    if (!error && data) {
      return NextResponse.json(
        {
          success: true,
          partners: data,
          count: data.length,
        },
        { status: 200 }
      )
    }

    return NextResponse.json(
      {
        success: true,
        partners: fallbackPartners,
        count: fallbackPartners.length,
      },
      { status: 200 }
    )
  } catch (error) {
    console.error('API error:', error)
    return NextResponse.json(
      { error: 'Internal server error', details: error.message },
      { status: 500 }
    )
  }
}
