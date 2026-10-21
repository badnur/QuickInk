import { NextResponse } from 'next/server'
import { verifyPayStationPayment } from '@/lib/paystation'
import { supabase } from '@/lib/supabase'
import crypto from 'crypto'

export const dynamic = 'force-dynamic'

function generateOtpCode() {
  return crypto.randomInt(100000, 1000000).toString()
}

async function handleCallback(request) {
  try {
    const { searchParams } = new URL(request.url)

    // PayStation may send data via query parameters or form body
    let invoiceNumber = searchParams.get('invoice_number') || searchParams.get('invoice')
    let trxId = searchParams.get('trx_id') || searchParams.get('transaction_id')

    if (!invoiceNumber && request.method === 'POST') {
      try {
        const contentType = request.headers.get('content-type') || ''
        if (contentType.includes('application/json')) {
          const body = await request.json()
          invoiceNumber = body.invoice_number || body.invoice
          trxId = body.trx_id || body.transaction_id
        } else if (contentType.includes('application/x-www-form-urlencoded')) {
          const formData = await request.formData()
          invoiceNumber = formData.get('invoice_number') || formData.get('invoice')
          trxId = formData.get('trx_id') || formData.get('transaction_id')
        }
      } catch (e) {
        // Fallback to URL searchParams
      }
    }

    const host = request.headers.get('host') || 'printkoro.com'
    const protocol = host.includes('localhost') ? 'http' : 'https'
    const baseUrl = `${protocol}://${host}`

    if (!invoiceNumber) {
      return NextResponse.redirect(`${baseUrl}/print?status=failed&message=Missing+invoice+number`)
    }

    // 1. Verify transaction with PayStation server-to-server API
    const verification = await verifyPayStationPayment({ invoiceNumber, trxId })

    if (!verification.isPaid) {
      return NextResponse.redirect(
        `${baseUrl}/print?status=failed&message=${encodeURIComponent(verification.message || 'Payment was not completed.')}`
      )
    }

    // 2. Fetch session metadata from DB if recorded
    let sessionMeta = null
    try {
      const { data: session } = await supabase
        .from('payment_sessions')
        .select('*')
        .eq('invoice_number', invoiceNumber)
        .maybeSingle()

      if (session) {
        sessionMeta = session.metadata
        // Mark session as completed
        await supabase
          .from('payment_sessions')
          .update({
            status: 'completed',
            trx_id: verification.trxId,
            payment_method: verification.paymentMethod,
            updated_at: new Date().toISOString()
          })
          .eq('invoice_number', invoiceNumber)
      }
    } catch (e) {
      console.warn('Could not read payment_sessions table:', e.message)
    }

    // CASE A: Station Credit Top-Up (for Desktop Shop POS)
    if (
      invoiceNumber.startsWith('PK-CR-') ||
      invoiceNumber.startsWith('INV-STN-') ||
      verification.reference?.includes('PK-CR') ||
      verification.reference?.includes('credit_recharge')
    ) {
      let deviceId = sessionMeta?.deviceId
      let packageId = sessionMeta?.packageId
      let creditsToAdd = Number(sessionMeta?.creditsToAdd || 0)

      if (!deviceId && verification.reference) {
        if (verification.reference.includes('|')) {
          const refParts = verification.reference.split('|')
          deviceId = refParts[1]
          packageId = refParts[2]
          creditsToAdd = Number(refParts[3] || Math.round(verification.amount * 50))
        } else if (verification.reference.includes(':')) {
          const refParts = verification.reference.split(':')
          packageId = refParts[1]
          creditsToAdd = Number(refParts[2] || Math.round(verification.amount * 50))
          deviceId = refParts[3]
        }
      }

      if (deviceId) {
        // Top up device balance
        let rpcWorked = false
        try {
          const { data: rpcData, error: rpcErr } = await supabase.rpc('topup_device_credits', {
            p_device_id: deviceId,
            p_amount: creditsToAdd,
            p_type: 'paystation_topup',
            p_description: `PayStation Online Top-Up (Paid ৳${verification.amount} via ${verification.paymentMethod} - TrxID: ${verification.trxId})`
          })
          if (!rpcErr && rpcData?.success) rpcWorked = true
        } catch (e) {}

        if (!rpcWorked) {
          try {
            const { data: dev } = await supabase.from('devices').select('*').eq('id', deviceId).maybeSingle()
            if (dev) {
              const currentBal = Number(dev.credits_balance || 0)
              const newBal = currentBal + creditsToAdd
              const newTx = {
                id: `tx-ps-${Date.now()}`,
                device_id: deviceId,
                amount: creditsToAdd,
                balance_after: newBal,
                type: 'subscription_topup',
                reference: verification.trxId || invoiceNumber,
                trx_id: verification.trxId,
                description: `PayStation Online Top-Up (Paid ৳${verification.amount} via ${verification.paymentMethod})`,
                created_at: new Date().toISOString()
              }

              const loc = dev.location || {}
              await supabase.from('devices').update({
                credits_balance: newBal,
                location: {
                  ...loc,
                  credits_balance: newBal,
                  credit_history: [newTx, ...(loc.credit_history || [])].slice(0, 30)
                },
                updated_at: new Date().toISOString()
              }).eq('id', deviceId)

              await supabase.from('partner_credit_transactions').insert([newTx]).catch(() => {})
            }
          } catch (e) {
            console.error('Direct device balance update error:', e)
          }
        }
      }

      // Return clean success HTML receipt for the desktop station user
      const htmlContent = `
        <!DOCTYPE html>
        <html lang="bn">
        <head>
          <meta charset="UTF-8">
          <title>পেমেন্ট সফল — PrintKoro Station Credits</title>
          <meta name="viewport" content="width=device-width, initial-scale=1">
          <style>
            body { font-family: -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, sans-serif; background: #09090b; color: #fff; display: flex; align-items: center; justify-content: center; height: 100vh; margin: 0; }
            .card { background: #121215; border: 1px solid #222328; border-radius: 16px; padding: 36px 32px; max-width: 440px; text-align: center; box-shadow: 0 10px 30px rgba(0,0,0,0.5); }
            .icon { width: 64px; height: 64px; border-radius: 50%; background: rgba(0, 191, 99, 0.15); color: #00bf63; display: flex; align-items: center; justify-content: center; font-size: 32px; margin: 0 auto 20px; }
            h1 { font-size: 22px; margin: 0 0 10px; color: #fff; }
            p { font-size: 14px; color: #8b8e96; margin: 0 0 24px; line-height: 1.5; }
            .details { background: #18191e; border: 1px solid #27272a; border-radius: 12px; padding: 16px; margin-bottom: 24px; text-align: left; font-size: 13px; }
            .row { display: flex; justify-content: space-between; margin-bottom: 8px; }
            .row:last-child { margin-bottom: 0; }
            .row span:first-child { color: #8b8e96; }
            .row span:last-child { font-weight: 700; color: #fff; }
            .btn { display: inline-block; width: 100%; box-sizing: border-box; background: #00bf63; color: #fff; font-weight: 700; padding: 12px 0; border-radius: 8px; text-decoration: none; font-size: 14px; cursor: pointer; border: none; }
            .btn:hover { background: #00a857; }
          </style>
        </head>
        <body>
          <div class="card">
            <div class="icon">✓</div>
            <h1>রিচার্জ সফল হয়েছে!</h1>
            <p>আপনার পেস্টেশন পেমেন্ট যাচাই সম্পন্ন হয়েছে এবং প্রিন্ট স্টেশনে ক্রেডিট যুক্ত করা হয়েছে।</p>
            <div class="details">
              <div class="row"><span>ক্রেডিট যুক্ত:</span><span style="color:#00bf63;">+${creditsToAdd.toLocaleString()} Credits</span></div>
              <div class="row"><span>পরিশোধিত টাকা:</span><span>৳${verification.amount}</span></div>
              <div class="row"><span>পেমেন্ট মাধ্যম:</span><span>${verification.paymentMethod}</span></div>
              <div class="row"><span>TrxID:</span><span>${verification.trxId || 'N/A'}</span></div>
              <div class="row"><span>ইনভয়েস:</span><span>${invoiceNumber}</span></div>
            </div>
            <button class="btn" onclick="window.close()">উইন্ডো বন্ধ করুন (Close)</button>
          </div>
        </body>
        </html>
      `
      return new NextResponse(htmlContent, {
        headers: { 'Content-Type': 'text/html; charset=utf-8' }
      })
    }

    // CASE B: Customer Document Print Job
    const jobDetails = sessionMeta?.jobDetails || {}
    const otp = generateOtpCode()

    const { data: printJob, error: jobErr } = await supabase
      .from('print_jobs')
      .insert([{
        file_path: jobDetails.file_path || 'document.pdf',
        file_name: jobDetails.file_name || 'document.pdf',
        file_type: jobDetails.file_type || 'pdf',
        copies: jobDetails.copies || 1,
        color_mode: jobDetails.color_mode || 'bw',
        duplex: Boolean(jobDetails.duplex),
        page_count: jobDetails.page_count || 1,
        page_range: jobDetails.page_range || null,
        otp_code: otp,
        otp_type: 'type_a',
        status: 'ready',
        payment_type: 'online',
        payment_status: 'paid',
        payment_amount: verification.amount,
        payment_method: verification.paymentMethod || 'PayStation',
        gateway_reference: verification.trxId || invoiceNumber,
        created_at: new Date().toISOString()
      }])
      .select()
      .maybeSingle()

    const orderId = printJob?.id || invoiceNumber
    return NextResponse.redirect(
      `${baseUrl}/print?status=success&orderId=${orderId}&otp=${otp}&amount=${verification.amount}&trxId=${verification.trxId || ''}`
    )
  } catch (err) {
    console.error('[PayStation Callback Error]:', err)
    return NextResponse.json({ error: 'Callback verification failed.' }, { status: 500 })
  }
}

export async function GET(request) {
  return handleCallback(request)
}

export async function POST(request) {
  return handleCallback(request)
}
