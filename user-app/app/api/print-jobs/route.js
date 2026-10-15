import { NextResponse } from 'next/server'
import { supabase } from '@/lib/supabase'
import crypto from 'crypto'
import { enforceRateLimit, RATE_LIMITS } from '@/lib/rate-limiter'

export const dynamic = 'force-dynamic'

function generateOtpCode() {
  // Cryptographically secure 6-digit numerical code (100000 - 999999)
  return crypto.randomInt(100000, 1000000).toString()
}

/**
 * POST /api/print-jobs
 * Creates a print job, generates an OTP (Type A for online, Type B for cash), and records payment.
 */
export async function POST(request) {
  try {
    const rateLimitRes = enforceRateLimit(request, 'create_print_job', RATE_LIMITS.PRINT_JOB)
    if (rateLimitRes) return rateLimitRes

    const body = await request.json()
    const {
      file_path,
      file_type = 'pdf',
      file_name = 'document.pdf',
      copies = 1,
      color_mode = 'bw',
      duplex = false,
      page_count = 1,
      page_range = null,   // e.g. "1-3,5" or null for all pages
      pages_per_sheet = 1, // 1, 2, 4, 6
      mini_border = false,
      payment_type = 'online',
      amount = 0,
      gateway_reference = null,
    } = body

    if (!file_path || typeof file_path !== 'string') {
      return NextResponse.json({ error: 'Valid file path is required' }, { status: 400 })
    }

    if (file_path.length > 500 || file_path.includes('\0') || /[\r\n]/.test(file_path)) {
      return NextResponse.json({ error: 'Invalid file path structure' }, { status: 400 })
    }

    // Security: Input validation and bounds checking
    const parsedCopies = Math.min(Math.max(1, parseInt(copies, 10) || 1), 100)
    const parsedPages = Math.min(Math.max(1, parseInt(page_count, 10) || 1), 5000)
    const validColorMode = color_mode === 'color' ? 'color' : 'bw'
    const validPaymentType = payment_type === 'cash' ? 'cash' : 'online'
    const otpType = validPaymentType === 'online' ? 'type_a' : 'type_b'
    const parsedAmount = Math.max(0, parseFloat(amount) || 0)
    const parsedNup = [1, 2, 4, 6].includes(parseInt(pages_per_sheet, 10)) ? parseInt(pages_per_sheet, 10) : 1
    const hasBorder = Boolean(mini_border)
    const cleanFileName = String(file_name || 'document.pdf').replace(/[\\\/]/g, '_').slice(0, 200)

    // Build URL hash parameters so range, nup, and border survive all database layers
    const params = []
    const rawRange = page_range ? String(page_range).trim() : null
    let cleanRange = null
    if (rawRange) {
      if (!/^[\d\s\-,]+$/.test(rawRange) || rawRange.length > 100) {
        return NextResponse.json({ error: 'Invalid page range format. Use numbers, commas, and hyphens (e.g. 1-5, 8).' }, { status: 400 })
      }
      cleanRange = rawRange
      params.push(`range=${encodeURIComponent(cleanRange)}`)
    }
    if (parsedNup > 1) params.push(`nup=${parsedNup}`)
    if (hasBorder) params.push(`border=1`)

    const storedFilePath = params.length > 0 ? `${file_path}#${params.join('&')}` : file_path

    // 1. Try atomic database RPC function first
    const { data: rpcData, error: rpcError } = await supabase.rpc('create_print_job', {
      p_file_path: storedFilePath,
      p_file_type: file_type,
      p_copies: parsedCopies,
      p_color_mode: validColorMode,
      p_duplex: Boolean(duplex),
      p_page_count: parsedPages,
      p_payment_type: validPaymentType,
      p_amount: parsedAmount,
    })

    if (!rpcError && rpcData?.success) {
      if (page_range && rpcData.order?.id) {
        await supabase.from('print_jobs').update({ page_range }).eq('id', rpcData.order.id).then(() => {})
      }

      return NextResponse.json(
        {
          success: true,
          message: 'Order created successfully',
          order: {
            ...rpcData.order,
            file_name: cleanFileName,
            page_range: page_range || null,
            pages_per_sheet: parsedNup,
            mini_border: hasBorder,
          },
          otp: rpcData.otp,
        },
        { status: 201 }
      )
    }

    // 2. Direct table insert fallback
    const expiresAt = new Date(Date.now() + 60 * 60 * 1000).toISOString()
    const otpCode = generateOtpCode()

    const { data: job, error: jobError } = await supabase
      .from('print_jobs')
      .insert([
        {
          file_path: storedFilePath,
          file_type: file_type.toLowerCase(),
          copies: parsedCopies,
          color_mode: validColorMode,
          duplex: Boolean(duplex),
          page_count: parsedPages,
          page_range: page_range || null,
          status: 'awaiting_redemption',
          payment_type: validPaymentType,
          expires_at: expiresAt,
        },
      ])
      .select()
      .single()

    if (jobError || !job) {
      // Log full error server-side only — never expose DB internals to client
      console.error('[PrintJobs] Job creation error:', jobError || rpcError)
      return NextResponse.json(
        { error: 'Order creation failed. Please try again.' },
        { status: 500 }
      )
    }

    const { data: otp, error: otpError } = await supabase
      .from('otps')
      .insert([
        {
          print_job_id: job.id,
          code: otpCode,
          otp_type: otpType,
          used: false,
          expires_at: expiresAt,
        },
      ])
      .select()
      .single()

    if (otpError) {
      await supabase.from('print_jobs').delete().eq('id', job.id)
      console.error('[PrintJobs] OTP generation error:', otpError)
      return NextResponse.json({ error: 'Failed to generate OTP. Please try again.' }, { status: 500 })
    }

    const hasValidGatewayRef = Boolean(gateway_reference && String(gateway_reference).trim().length >= 6)
    const onlinePaymentStatus = hasValidGatewayRef ? 'completed' : 'pending'

    await supabase.from('payments').insert([
      {
        print_job_id: job.id,
        amount: parsedAmount,
        method: validPaymentType,
        gateway_reference: gateway_reference ? String(gateway_reference).trim() : (validPaymentType === 'online' ? `online_${Date.now()}` : null),
        status: validPaymentType === 'online' ? onlinePaymentStatus : 'pending',
        cash_collected: false,
      },
    ])

    return NextResponse.json(
      {
        success: true,
        message: 'Order created successfully',
        order: {
          id: job.id,
          file_name: cleanFileName,
          file_path: job.file_path,
          copies: job.copies,
          color_mode: job.color_mode,
          duplex: job.duplex,
          page_count: job.page_count,
          page_range: job.page_range || null,
          amount: parsedAmount,
          payment_type: job.payment_type,
          status: job.status,
          expires_at: job.expires_at,
          created_at: job.created_at,
        },
        otp: {
          id: otp.id,
          code: otpCode,
          otp_type: otpType,
          expires_at: expiresAt,
        },
      },
      { status: 201 }
    )
  } catch (error) {
    console.error('[PrintJobs] API exception:', error)
    return NextResponse.json({ error: 'Internal server error. Please try again.' }, { status: 500 })
  }
}
