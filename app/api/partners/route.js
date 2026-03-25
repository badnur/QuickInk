import { NextResponse } from 'next/server'

// In-memory storage for partners
let partners = []

/**
 * POST /api/partners
 * Create a new partner registration (mock - no database)
 */
export async function POST(request) {
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

    // Create mock partner
    const newPartner = {
      id: `partner_${Date.now()}`,
      name,
      shop_name,
      location,
      phone,
      created_at: new Date().toISOString(),
      status: 'pending'
    }

    partners.push(newPartner)

    return NextResponse.json(
      {
        success: true,
        message: 'Partner application submitted successfully',
        partner: newPartner
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
 * Get all partners (mock data)
 */
export async function GET(request) {
  try {
    return NextResponse.json(
      {
        success: true,
        partners: partners,
        count: partners.length
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
