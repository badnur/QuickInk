import { NextResponse } from 'next/server'
import { supabase } from '@/lib/supabase'

function generateOtpCode() {
  // Generate random 6-digit numerical code (100000 - 999999)
  return Math.floor(100000 + Math.random() * 900000).toString()
}

/**
 * POST /api/print-jobs
 * Creates a print job, generates an OTP (Type A for online, Type B for cash), and records payment.
 */
export async function POST(request) {
  try {
    const body = await request.json()
    const {
      file_path,
      file_type = 'pdf',
      file_name = 'document.pdf',
      copies = 1,
      color_mode = 'bw',
      duplex = false,
      page_count = 1,
      payment_type = 'online',
      amount = 0,
    } = body

    if (!file_path) {
      return NextResponse.json({ error: 'File path is required' }, { status: 400 })
    }

    const parsedCopies = Math.max(1, parseInt(copies) || 1)
    const parsedPages = Math.max(1, parseInt(page_count) || 1)
    const validColorMode = color_mode === 'color' ? 'color' : 'bw'
    const validPaymentType = payment_type === 'cash' ? 'cash' : 'online'
    const otpType = validPaymentType === 'online' ? 'type_a' : 'type_b'
    const parsedAmount = parseFloat(amount) || 0

    // 1. Try atomic database RPC function first
    const { data: rpcData, error: rpcError } = await supabase.rpc('create_print_job', {
      p_file_path: file_path,
      p_file_type: file_type,
      p_copies: parsedCopies,
      p_color_mode: validColorMode,
      p_duplex: Boolean(duplex),
      p_page_count: parsedPages,
      p_payment_type: validPaymentType,
      p_amount: parsedAmount,
    })

    if (!rpcError && rpcData?.success) {
      return NextResponse.json(
        {
          success: true,
          message: 'Order created successfully',
          order: {
            ...rpcData.order,
            file_name,
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
          file_path,
          file_type: file_type.toLowerCase(),
          copies: parsedCopies,
          color_mode: validColorMode,
          duplex: Boolean(duplex),
          page_count: parsedPages,
          status: 'awaiting_redemption',
          payment_type: validPaymentType,
          expires_at: expiresAt,
        },
      ])
      .select()
      .single()

    if (jobError || !job) {
      // If RLS blocked anon table insert, return clear instructions
      console.error('Job creation error:', jobError || rpcError)
      return NextResponse.json(
        {
          error:
            'Order creation failed: ' +
            (jobError?.message || rpcError?.message || 'Database permissions error'),
        },
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
      return NextResponse.json({ error: 'Failed to generate OTP: ' + otpError.message }, { status: 500 })
    }

    await supabase.from('payments').insert([
      {
        print_job_id: job.id,
        amount: parsedAmount,
        method: validPaymentType,
        gateway_reference: validPaymentType === 'online' ? `sim_${Date.now()}` : null,
        status: validPaymentType === 'online' ? 'completed' : 'pending',
        cash_collected: false,
      },
    ])

    return NextResponse.json(
      {
        success: true,
        message: 'Order created successfully',
        order: {
          id: job.id,
          file_name,
          file_path: job.file_path,
          copies: job.copies,
          color_mode: job.color_mode,
          duplex: job.duplex,
          page_count: job.page_count,
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
    console.error('Print jobs API exception:', error)
    return NextResponse.json({ error: 'Internal server error: ' + error.message }, { status: 500 })
  }
}
