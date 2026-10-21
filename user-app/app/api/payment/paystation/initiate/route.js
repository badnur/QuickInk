import { NextResponse } from 'next/server'
import { createPayStationPayment } from '@/lib/paystation'
import { enforceRateLimit, RATE_LIMITS } from '@/lib/rate-limiter'
import { supabase } from '@/lib/supabase'

export const dynamic = 'force-dynamic'

/**
 * POST /api/payment/paystation/initiate
 * Initiates an online payment session through PayStation (bKash, Nagad, Rocket, Cards)
 */
export async function POST(request) {
  try {
    const rateLimitRes = enforceRateLimit(request, 'paystation_initiate', RATE_LIMITS.PAYMENT_TOPUP)
    if (rateLimitRes) return rateLimitRes

    const body = await request.json()
    const {
      purpose = 'print_job', // 'print_job' | 'credit_recharge'
      amount,
      customerName = 'PrintKoro Customer',
      customerPhone = '01700000000',
      customerEmail = 'support@printkoro.com',
      // Print job specific
      jobDetails = null,
      // Station credit top-up specific
      deviceId = null,
      packageId = null,
      creditsToAdd = null
    } = body

    const numericAmount = parseFloat(amount)
    if (!numericAmount || numericAmount <= 0) {
      return NextResponse.json({ error: 'Valid payment amount is required.' }, { status: 400 })
    }

    const uniqueSuffix = `${Date.now()}-${Math.random().toString(36).substring(2, 7).toUpperCase()}`

    let invoiceNumber = ''
    let reference = ''

    if (purpose === 'credit_recharge') {
      if (!deviceId) {
        return NextResponse.json({ error: 'Device ID is required for credit recharge.' }, { status: 400 })
      }
      invoiceNumber = `PK-CR-${uniqueSuffix}`
      reference = `CR|${deviceId}|${packageId || 'custom'}|${creditsToAdd || 0}`
    } else {
      // Print Job: Encode jobId and otpCode into reference for seamless reconciliation
      const jId = body.jobId || jobDetails?.jobId || ''
      const oCode = body.otpCode || jobDetails?.otpCode || ''
      invoiceNumber = `PK-PJ-${uniqueSuffix}`
      reference = jId ? `PJ|${jId}|${oCode}` : `PJ|${uniqueSuffix}`
    }

    // Determine callback URL
    const host = request.headers.get('host') || 'printkoro.com'
    const protocol = host.includes('localhost') ? 'http' : 'https'
    const callbackUrl = `${protocol}://${host}/api/payment/paystation/callback`

    const paymentResult = await createPayStationPayment({
      invoiceNumber,
      amount: numericAmount,
      reference,
      customerName,
      customerPhone,
      customerEmail,
      callbackUrl
    })

    // Store pending payment record in database for audit and reconciliation
    try {
      await supabase.from('payment_sessions').insert([{
        invoice_number: invoiceNumber,
        gateway: 'paystation',
        purpose,
        amount: numericAmount,
        status: 'initiated',
        metadata: {
          jobId: body.jobId || jobDetails?.jobId || null,
          otpCode: body.otpCode || jobDetails?.otpCode || null,
          jobDetails,
          deviceId,
          packageId,
          creditsToAdd,
          customerName,
          customerPhone
        },
        created_at: new Date().toISOString()
      }])
    } catch (dbErr) {
      // Table may not exist yet in minimal schema; continue safely
    }

    return NextResponse.json({
      success: true,
      invoiceNumber,
      paymentUrl: paymentResult.paymentUrl,
      amount: paymentResult.amount
    })
  } catch (err) {
    console.error('[PayStation Initiate Error]:', err)
    return NextResponse.json({
      success: false,
      error: err.message || 'Payment initiation failed.'
    }, { status: 500 })
  }
}
