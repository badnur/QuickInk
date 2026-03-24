import { NextRequest, NextResponse } from 'next/server'
import { createServerClient } from '@/lib/supabase/server'

/**
 * POST /api/partners
 * Create a new partner registration
 * Public endpoint - anyone can register as a partner
 */
export async function POST(request: NextRequest) {
  try {
    const body = await request.json()
    const { name, shop_name, location, phone } = body

    // Validation
    if (!name || !shop_name || !location || !phone) {
      return NextResponse.json(
        { error: 'All fields are required: name, shop_name, location, phone' },
        { status: 400 }
      )
    }

    // Create Supabase client
    const supabase = await createServerClient()

    // Insert partner into database
    const { data, error } = await supabase
      .from('partners')
      .insert([
        {
          name,
          shop_name,
          location,
          phone,
          status: 'pending'
        }
      ])
      .select()
      .single()

    if (error) {
      console.error('Supabase error:', error)
      return NextResponse.json(
        { error: 'Failed to create partner registration', details: error.message },
        { status: 500 }
      )
    }

    return NextResponse.json(
      {
        success: true,
        message: 'Partner registration submitted successfully',
        partner: data
      },
      { status: 201 }
    )
  } catch (error: any) {
    console.error('API error:', error)
    return NextResponse.json(
      { error: 'Internal server error', details: error.message },
      { status: 500 }
    )
  }
}

/**
 * GET /api/partners
 * Get all partners (admin only in production, public for demo)
 */
export async function GET(request: NextRequest) {
  try {
    const supabase = await createServerClient()

    // Get all partners, ordered by most recent first
    const { data, error } = await supabase
      .from('partners')
      .select('*')
      .order('created_at', { ascending: false })

    if (error) {
      console.error('Supabase error:', error)
      return NextResponse.json(
        { error: 'Failed to fetch partners', details: error.message },
        { status: 500 }
      )
    }

    return NextResponse.json(
      {
        success: true,
        partners: data || [],
        count: data?.length || 0
      },
      { status: 200 }
    )
  } catch (error: any) {
    console.error('API error:', error)
    return NextResponse.json(
      { error: 'Internal server error', details: error.message },
      { status: 500 }
    )
  }
}
