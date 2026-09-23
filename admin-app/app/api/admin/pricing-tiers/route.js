import { NextResponse } from 'next/server'
import { supabase } from '@/lib/supabase'

export const dynamic = 'force-dynamic'

/**
 * GET /api/admin/pricing-tiers
 * Returns all pricing tiers ordered by name.
 */
export async function GET() {
  try {
    const { data: tiers, error } = await supabase
      .from('pricing_tiers')
      .select('*')
      .order('name', { ascending: true })

    if (error) {
      return NextResponse.json({ error: error.message }, { status: 500 })
    }

    return NextResponse.json({ success: true, tiers: tiers || [] })
  } catch (err) {
    return NextResponse.json({ error: err.message }, { status: 500 })
  }
}

/**
 * POST /api/admin/pricing-tiers
 * Create a new pricing tier.
 */
export async function POST(request) {
  try {
    const body = await request.json()
    const { name, description = '', bw_price, color_price } = body

    if (!name || bw_price === undefined || color_price === undefined) {
      return NextResponse.json(
        { error: 'name, bw_price and color_price are required' },
        { status: 400 }
      )
    }

    const { data, error } = await supabase
      .from('pricing_tiers')
      .insert([{
        name: name.trim(),
        description: description.trim() || null,
        bw_price: parseFloat(bw_price),
        color_price: parseFloat(color_price),
        is_default: false,
      }])
      .select()
      .single()

    if (error) {
      return NextResponse.json({ error: error.message }, { status: 500 })
    }

    return NextResponse.json({ success: true, tier: data }, { status: 201 })
  } catch (err) {
    return NextResponse.json({ error: err.message }, { status: 500 })
  }
}

/**
 * PATCH /api/admin/pricing-tiers
 * Update an existing pricing tier.
 */
export async function PATCH(request) {
  try {
    const body = await request.json()
    const { id, name, description, bw_price, color_price } = body

    if (!id) {
      return NextResponse.json({ error: 'Tier ID is required' }, { status: 400 })
    }

    const updates = {}
    if (name) updates.name = name.trim()
    if (description !== undefined) updates.description = description?.trim() || null
    if (bw_price !== undefined) updates.bw_price = parseFloat(bw_price)
    if (color_price !== undefined) updates.color_price = parseFloat(color_price)

    const { data, error } = await supabase
      .from('pricing_tiers')
      .update(updates)
      .eq('id', id)
      .select()
      .single()

    if (error) {
      return NextResponse.json({ error: error.message }, { status: 500 })
    }

    return NextResponse.json({ success: true, tier: data })
  } catch (err) {
    return NextResponse.json({ error: err.message }, { status: 500 })
  }
}

/**
 * DELETE /api/admin/pricing-tiers?id=<uuid>
 * Delete a pricing tier. Cannot delete the default tier.
 */
export async function DELETE(request) {
  try {
    const { searchParams } = new URL(request.url)
    const id = searchParams.get('id')

    if (!id) {
      return NextResponse.json({ error: 'Tier ID is required' }, { status: 400 })
    }

    // Prevent deletion of the default tier
    const { data: tier } = await supabase
      .from('pricing_tiers')
      .select('is_default')
      .eq('id', id)
      .maybeSingle()

    if (tier?.is_default) {
      return NextResponse.json(
        { error: 'Cannot delete the default pricing tier. Set another tier as default first.' },
        { status: 400 }
      )
    }

    const { error } = await supabase
      .from('pricing_tiers')
      .delete()
      .eq('id', id)

    if (error) {
      return NextResponse.json({ error: error.message }, { status: 500 })
    }

    return NextResponse.json({ success: true, message: 'Pricing tier deleted' })
  } catch (err) {
    return NextResponse.json({ error: err.message }, { status: 500 })
  }
}
