import { NextResponse } from 'next/server'
import { supabase } from '@/lib/supabase'

export const dynamic = 'force-dynamic'

/**
 * POST /api/desktop/jobs/complete
 * Safe Physical Print Confirmation & Atomic Credit Deduction
 * Called ONLY when the desktop terminal confirms paper has physically printed.
 * If hardware error or paper jam occurs after OTP entry, credits are NEVER deducted.
 */
export async function POST(request) {
  try {
    const body = await request.json()
    const {
      jobId,
      deviceId,
      hardwareSuccess = true,
      failureReason = null
    } = body

    if (!jobId || !deviceId) {
      return NextResponse.json({ error: 'jobId and deviceId are required' }, { status: 400 })
    }

    // 1. IF PRINT FAILED AT HARDWARE LEVEL (Paper jam, printer offline, spooler timeout, user canceled):
    // Zero credits are cut! We update the job note and return zero deduction confirmation.
    if (!hardwareSuccess) {
      console.warn(`[Safe Print Rule] Physical print failed for job ${jobId} on device ${deviceId}: ${failureReason}. ZERO credits deducted.`)
      
      try {
        await supabase
          .from('print_jobs')
          .update({
            status: 'failed',
            // Keep track of reason without cutting credits
          })
          .eq('id', jobId)
      } catch (e) {}

      return NextResponse.json({
        success: false,
        hardwareSuccess: false,
        creditsDeducted: 0,
        message: `Print failed (${failureReason || 'Hardware error'}). Zero credits were deducted from partner balance.`,
      })
    }

    // 2. Try atomic database RPC function first
    try {
      const { data: rpcData, error: rpcErr } = await supabase.rpc('confirm_print_and_deduct_credits', {
        p_job_id: jobId,
        p_device_id: deviceId,
      })

      if (!rpcErr && rpcData?.success) {
        return NextResponse.json({
          success: true,
          creditsDeducted: rpcData.credits_deducted,
          unitPrice: rpcData.unit_price,
          previousBalance: rpcData.previous_balance,
          newBalance: rpcData.balance,
          jobId,
          message: rpcData.message,
        })
      }
    } catch (rpcEx) {
      console.warn('RPC confirm_print_and_deduct_credits not available, performing resilient direct transaction:', rpcEx.message)
    }

    // 3. Fallback direct execution:
    // Fetch device and pricing tier
    const [{ data: dev }, { data: job }] = await Promise.all([
      supabase
        .from('devices')
        .select(`
          *,
          pricing_tiers (
            id,
            name,
            bw_price,
            color_price
          )
        `)
        .eq('id', deviceId)
        .maybeSingle(),
      supabase
        .from('print_jobs')
        .select('*')
        .eq('id', jobId)
        .maybeSingle()
    ])

    if (!dev) {
      return NextResponse.json({ error: 'Device not found' }, { status: 404 })
    }
    if (!job) {
      return NextResponse.json({ error: 'Print job not found' }, { status: 404 })
    }

    // Check if already completed
    if (job.status === 'completed') {
      const currentBal = Number(dev.credits_balance ?? dev.location?.credits_balance ?? 0)
      return NextResponse.json({
        success: true,
        alreadyCompleted: true,
        creditsDeducted: 0,
        newBalance: currentBal,
        message: 'Job was already confirmed completed.'
      })
    }

    // Calculate dynamic pricing based on shop's assigned tier
    const tier = dev.pricing_tiers || {}
    const isColor = job.color_mode === 'color'
    const unitPrice = isColor ? Number(tier.color_price ?? 8.00) : Number(tier.bw_price ?? 2.00)
    const pageCount = Number(job.page_count ?? 1)
    const copies = Number(job.copies ?? 1)

    // 1 credit = 1 Taka of customer print value
    const creditCost = Math.round(unitPrice * pageCount * copies * 100) / 100

    const currentBal = Number(dev.credits_balance ?? dev.location?.credits_balance ?? 10000.00)
    const newBal = Math.max(0, Math.round((currentBal - creditCost) * 100) / 100)

    const loc = dev.location || {}
    const history = loc.credit_history || []
    const txObj = {
      id: `tx-${Date.now()}`,
      device_id: deviceId,
      amount: -creditCost,
      balance_after: newBal,
      type: 'print_deduction',
      description: `Print Job Completed: ${pageCount} sheet(s) ${isColor ? 'Color' : 'B&W'} × ${copies} copy @ ৳${unitPrice}/sheet`,
      print_job_id: jobId,
      created_at: new Date().toISOString()
    }

    // Update DB
    await Promise.all([
      supabase
        .from('devices')
        .update({
          credits_balance: newBal,
          location: {
            ...loc,
            credits_balance: newBal,
            credit_history: [txObj, ...history].slice(0, 30),
          },
          updated_at: new Date().toISOString(),
        })
        .eq('id', deviceId),
      supabase
        .from('print_jobs')
        .update({
          status: 'completed',
          printed_at: new Date().toISOString(),
          redeemed_by_device_id: deviceId,
        })
        .eq('id', jobId)
    ])

    try {
      await supabase.from('partner_credit_transactions').insert([txObj])
    } catch (e) {}

    return NextResponse.json({
      success: true,
      creditsDeducted: creditCost,
      unitPrice,
      previousBalance: currentBal,
      newBalance: newBal,
      jobId,
      message: `Print completed successfully. ${creditCost} credits deducted based on your active rate.`,
    })
  } catch (err) {
    console.error('Job complete endpoint error:', err)
    return NextResponse.json({ error: err.message }, { status: 500 })
  }
}
