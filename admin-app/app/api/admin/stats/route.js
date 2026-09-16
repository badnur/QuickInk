import { NextResponse } from 'next/server'
import { supabase } from '@/lib/supabase'

export const dynamic = 'force-dynamic'

/**
 * GET /api/admin/stats
 * Aggregates core business KPIs, recent activities, and fleet status for the admin dashboard.
 */
export async function GET(request) {
  try {
    // 1. Fetch Print Jobs summary
    const { data: jobs, error: jobsError } = await supabase
      .from('print_jobs')
      .select('*')
      .order('created_at', { ascending: false })

    if (jobsError) {
      console.warn('Jobs fetch notice in admin stats:', jobsError.message)
    }

    const allJobs = jobs || []

    // Calculate job stats
    const totalJobs = allJobs.length
    const awaitingJobs = allJobs.filter((j) => j.status === 'awaiting_redemption' || j.status === 'redeemed').length
    const printedJobs = allJobs.filter((j) => j.status === 'printed').length
    const expiredJobs = allJobs.filter((j) => j.status === 'expired').length

    // 2. Fetch Payments summary for revenue calculation
    const { data: payments, error: paymentsError } = await supabase
      .from('payments')
      .select('*')

    if (paymentsError) {
      console.warn('Payments fetch notice:', paymentsError.message)
    }

    const allPayments = payments || []
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

    // 3. Fetch Devices summary
    const { data: devices, error: devicesError } = await supabase
      .from('devices')
      .select('*')
      .order('created_at', { ascending: false })

    if (devicesError) {
      console.warn('Devices fetch notice:', devicesError.message)
    }

    const allDevices = devices || []
    const totalDevices = allDevices.length
    const onlineDevices = allDevices.filter((d) => d.status === 'online').length
    const kioskCount = allDevices.filter((d) => d.type === 'kiosk').length
    const shopCount = allDevices.filter((d) => d.type === 'shop').length

    // 4. Fetch Partner Leads count
    const { data: partners } = await supabase
      .from('partners')
      .select('id, status')

    const pendingPartners = (partners || []).filter((p) => p.status === 'pending').length

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
    })
  } catch (err) {
    console.error('Admin stats error:', err)
    return NextResponse.json(
      { error: 'Failed to aggregate admin statistics', details: err.message },
      { status: 500 }
    )
  }
}
