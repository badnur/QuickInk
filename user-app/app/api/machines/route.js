import { NextResponse } from 'next/server'
import { supabase } from '@/lib/supabase'

// Standard pricing fallback (matches the seeded "Standard" tier)
const STANDARD_PRICING = { bw_price: 2.0, color_price: 8.0, tier_name: 'Standard', tier_id: null }

/**
 * GET /api/machines
 * Retrieves active printer locations from Supabase, including zone pricing.
 */
export async function GET(request) {
  try {
    // Fetch devices joined with their pricing tier
    const { data: devices, error: devicesError } = await supabase
      .from('devices')
      .select(`
        *,
        pricing_tiers (
          id,
          name,
          bw_price,
          color_price,
          description
        )
      `)
      .order('created_at', { ascending: false })

    if (!devicesError && devices && devices.length > 0) {
      const formattedDevices = devices.map((d) => {
        const tier = d.pricing_tiers || null
        return {
          id: d.id,
          name: d.name,
          type: d.type,
          address: typeof d.location === 'object' ? d.location?.address || d.name : d.name,
          latitude: typeof d.location === 'object' ? d.location?.latitude : null,
          longitude: typeof d.location === 'object' ? d.location?.longitude : null,
          phone: typeof d.location === 'object' ? d.location?.phone || null : null,
          operating_hours: typeof d.location === 'object' ? d.location?.operating_hours || null : null,
          status: d.status,
          paper_available: true,
          distance: typeof d.location === 'object' ? d.location?.distance || 'Nearby' : 'Nearby',
          // Zone/Tier Pricing
          tier_id: tier?.id || null,
          tier_name: tier?.name || STANDARD_PRICING.tier_name,
          tier_description: tier?.description || null,
          bw_price: tier?.bw_price ?? STANDARD_PRICING.bw_price,
          color_price: tier?.color_price ?? STANDARD_PRICING.color_price,
        }
      })

      return NextResponse.json({
        success: true,
        machines: formattedDevices,
        count: formattedDevices.length,
      })
    }

    // Fallback to machines table if devices not yet seeded
    const { data: machines, error: machinesError } = await supabase
      .from('machines')
      .select('*')

    if (!machinesError && machines && machines.length > 0) {
      // Inject standard pricing into legacy machines data
      const machinesWithPricing = machines.map((m) => ({
        ...m,
        ...STANDARD_PRICING,
      }))
      return NextResponse.json({
        success: true,
        machines: machinesWithPricing,
        count: machinesWithPricing.length,
      })
    }

    return NextResponse.json({ success: true, machines: [], count: 0 })
  } catch (error) {
    console.error('API error:', error)
    return NextResponse.json(
      { error: 'Internal server error', details: error.message },
      { status: 500 }
    )
  }
}

