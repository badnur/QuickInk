import { NextResponse } from 'next/server'
import { supabase } from '@/lib/supabase'

export const dynamic = 'force-dynamic'

/**
 * GET /api/admin/stats
 * Aggregates core business KPIs, recent activities, and fleet status for the admin dashboard.
 */
export async function GET(request) {
  try {
    // 1. Fetch Print Jobs, Payments, Devices, and Partners in parallel for maximum speed
    const [
      { data: jobs, error: jobsError },
      { data: payments, error: paymentsError },
      { data: devices, error: devicesError },
      { data: partners, error: partnersError },
    ] = await Promise.all([
      supabase.from('print_jobs').select('*').order('created_at', { ascending: false }),
      supabase.from('payments').select('*'),
      supabase.from('devices').select('*').order('created_at', { ascending: false }),
      supabase.from('partners').select('id, status'),
    ])

    if (jobsError) console.warn('Jobs fetch notice in admin stats:', jobsError.message)
    if (paymentsError) console.warn('Payments fetch notice:', paymentsError.message)
    if (devicesError) console.warn('Devices fetch notice:', devicesError.message)

    const allJobs = jobs || []
    const allPayments = payments || []
    const allDevices = devices || []
    const pendingPartners = (partners || []).filter((p) => p.status === 'pending').length

    // Calculate job stats
    const totalJobs = allJobs.length
    const awaitingJobs = allJobs.filter((j) => j.status === 'awaiting_redemption' || j.status === 'redeemed').length
    const printedJobs = allJobs.filter((j) => j.status === 'printed').length
    const expiredJobs = allJobs.filter((j) => j.status === 'expired').length

    // 2. Revenue calculation
    let totalRevenue = 0
    let onlineRevenue = 0
    let cashRevenue = 0

    if (allPayments.length > 0) {
      allPayments.forEach((p) => {
        const amt = parseFloat(p.amount) || 0
        totalRevenue += amt
        if (p.method === 'cash') {
          cashRevenue += amt
        } else {
          onlineRevenue += amt
        }
      })
    } else {
      // Fallback: estimate revenue from print_jobs if payments table is empty
      allJobs.forEach((j) => {
        const amt = parseFloat(j.amount) || (j.page_count * (j.color_mode === 'color' ? 8 : 2) * (j.copies || 1))
        totalRevenue += amt
        if (j.payment_type === 'cash') {
          cashRevenue += amt
        } else {
          onlineRevenue += amt
        }
      })
    }

    // Total sheets printed
    const totalSheets = allJobs.reduce((acc, j) => acc + ((j.page_count || 1) * (j.copies || 1)), 0)

    // 3. Device stats
    const totalDevices = allDevices.length
    const onlineDevices = allDevices.filter((d) => d.status === 'online').length
    const kioskCount = allDevices.filter((d) => d.type === 'kiosk').length
    const shopCount = allDevices.filter((d) => d.type === 'shop').length

    // 5. Build 7-day revenue & print trends
    const daysMap = {}
    for (let i = 6; i >= 0; i--) {
      const d = new Date()
      d.setDate(d.getDate() - i)
      const dateKey = d.toISOString().split('T')[0]
      const label = d.toLocaleDateString('en-US', { weekday: 'short', month: 'numeric', day: 'numeric' })
      daysMap[dateKey] = { date: label, revenue: 0, jobs: 0, sheets: 0 }
    }

    allJobs.forEach((j) => {
      const jobDate = (j.created_at || '').split('T')[0]
      if (daysMap[jobDate]) {
        daysMap[jobDate].jobs += 1
        const sheets = (j.page_count || 1) * (j.copies || 1)
        daysMap[jobDate].sheets += sheets
        const rev = parseFloat(j.amount) || (sheets * (j.color_mode === 'color' ? 8 : 2))
        daysMap[jobDate].revenue += rev
      }
    })

    const chartData = Object.values(daysMap)

    // Recent 8 jobs with cleaned names
    const recentJobs = allJobs.slice(0, 8).map((j) => ({
      ...j,
      device_name: allDevices.find((d) => d.id === j.redeemed_by_device_id)?.name || 'Not yet redeemed',
    }))

    // Per-shop copies, earnings, and SaaS subscription breakdown
    const shopLeaderboard = allDevices.map((d) => {
      const loc = typeof d.location === 'object' && d.location !== null ? d.location : {}
      const shopJobs = allJobs.filter((j) => j.redeemed_by_device_id === d.id)

      let shopSheets = 0
      let shopRevenue = 0
      let bwSheets = 0
      let colorSheets = 0

      shopJobs.forEach((j) => {
        const pages = (j.page_count || 1) * (j.copies || 1)
        shopSheets += pages
        if (j.color_mode === 'color') {
          colorSheets += pages
        } else {
          bwSheets += pages
        }
        const amt = parseFloat(j.amount) || (pages * (j.color_mode === 'color' ? 8 : 2))
        shopRevenue += amt
      })

      return {
        id: d.id,
        name: d.name,
        type: d.type,
        status: d.status,
        address: loc.address || 'Configured Address',
        phone: loc.phone || 'N/A',
        operating_hours: loc.operating_hours || '24/7',
        subscriptionPlan: loc.subscription_plan || 'Pro SaaS',
        subscriptionStatus: loc.subscription_status || 'active',
        payoutRate: loc.payout_rate ?? 100,
        totalJobs: shopJobs.length,
        totalSheets: shopSheets,
        bwSheets,
        colorSheets,
        shopEarnings: shopRevenue,
      }
    }).sort((a, b) => b.totalSheets - a.totalSheets)

    return NextResponse.json({
      success: true,
      stats: {
        totalRevenue: Math.round(totalRevenue),
        onlineRevenue: Math.round(onlineRevenue),
        cashRevenue: Math.round(cashRevenue),
        totalJobs,
        awaitingJobs,
        printedJobs,
        expiredJobs,
        totalSheets,
        totalDevices,
        onlineDevices,
        kioskCount,
        shopCount,
        pendingPartners,
      },
      chartData,
      recentJobs,
      devices: allDevices,
      shopLeaderboard,
    })
  } catch (err) {
    console.error('Admin stats error:', err)
    return NextResponse.json(
      { error: 'Failed to aggregate admin statistics', details: err.message },
      { status: 500 }
    )
  }
}
