import { NextResponse } from 'next/server'
import { supabase } from '@/lib/supabase'

export async function POST(request) {
  try {
    const body = await request.json()
    const { code, device_id = '11111111-1111-1111-1111-111111111111' } = body

    if (!code) {
      return NextResponse.json({ error: '6-digit OTP code is required' }, { status: 400 })
    }

    const cleanCode = code.toString().trim().toUpperCase()

    if (cleanCode.length !== 6) {
      return NextResponse.json({ error: 'Please enter a valid 6-digit OTP code' }, { status: 400 })
    }

    // Check if device is suspended by admin
    const { data: devCheck } = await supabase
      .from('devices')
      .select('status, location')
      .eq('id', device_id)
      .maybeSingle()

    if (devCheck && (devCheck.status === 'suspended' || devCheck.status === 'cancelled')) {
      return NextResponse.json({
        error: 'Partnership Suspended. Printing and job redemption are locked by administration.',
        suspended: true,
        reason: devCheck.location?.suspension_reason || 'Administrative partnership suspension'
      }, { status: 403 })
    }

    // Call Supabase atomic redemption RPC
    let { data, error } = await supabase.rpc('redeem_otp', {
      p_code: cleanCode,
      p_device_id: device_id,
    })

    // If device not yet registered in DB, attempt to seed device and retry
    if (error && error.message?.includes('Device with ID')) {
      const { error: seedErr } = await supabase.from('devices').upsert({
        id: device_id,
        name: 'QuickInk Partner Shop - Dhanmondi',
        type: 'shop',
        status: 'online',
      })

      if (!seedErr) {
        const retry = await supabase.rpc('redeem_otp', {
          p_code: cleanCode,
          p_device_id: device_id,
        })
        if (!retry.error) {
          data = retry.data
          error = null
        }
      }
    }

    // Secondary fallback: direct OTP query if RPC not present or device still unseeded
    if (error && (error.message?.includes('Device with ID') || error.message?.includes('function redeem_otp'))) {
      const { data: otpRec } = await supabase
        .from('otps')
        .select('*, print_jobs(*)')
        .eq('code', cleanCode)
        .maybeSingle()

      if (!otpRec) {
        return NextResponse.json({ error: 'Invalid or non-existent 6-digit OTP code' }, { status: 400 })
      }

      if (otpRec.used) {
        return NextResponse.json({ error: 'This OTP has already been redeemed' }, { status: 400 })
      }
      if (new Date(otpRec.expires_at) < new Date()) {
        return NextResponse.json({ error: 'This OTP has expired' }, { status: 400 })
      }

      // Mark as used
      await supabase.from('otps').update({ used: true, used_at: new Date().toISOString() }).eq('id', otpRec.id)
      if (otpRec.print_jobs?.id) {
        await supabase.from('print_jobs').update({ status: 'redeemed', redeemed_at: new Date().toISOString() }).eq('id', otpRec.print_jobs.id)
      }

      data = {
        success: true,
        print_job: otpRec.print_jobs || {},
        device: { id: device_id, name: 'QuickInk Partner Shop' },
      }
      error = null
    }

    if (error) {
      console.warn('Redemption error:', error)
      return NextResponse.json({ error: error.message || 'Invalid or expired OTP code' }, { status: 400 })
    }

    // Determine target printer based on color_mode
    const colorMode = data?.print_job?.color_mode || 'bw'
    const targetPrinter = colorMode === 'color' ? 'color' : 'bw'

    // Fetch payment information for cash collection verification if needed
    let paymentInfo = null
    if (data?.print_job?.id) {
      const { data: payData } = await supabase
        .from('payments')
        .select('*')
        .eq('print_job_id', data.print_job.id)
        .maybeSingle()

      if (payData) {
        paymentInfo = payData
      }
    }

    // Calculate display pricing if payment info missing
    const unitPrice = colorMode === 'color' ? 8.0 : 2.0
    const calculatedAmount =
      paymentInfo?.amount ||
      ((data?.print_job?.page_count || 1) * unitPrice * (data?.print_job?.copies || 1)).toFixed(2)

    // Generate download URL for file
    let fileUrl = null
    const rawPath = data?.print_job?.file_path
    let cleanPath = rawPath
    let rangeFromPath = null

    if (rawPath && rawPath.includes('#range=')) {
      const parts = rawPath.split('#range=')
      cleanPath = parts[0]
      try {
        rangeFromPath = decodeURIComponent(parts[1])
      } catch (e) {
        rangeFromPath = parts[1]
      }
    }

    const effectivePageRange = data?.print_job?.page_range || rangeFromPath || null

    if (cleanPath) {
      if (cleanPath.startsWith('http://') || cleanPath.startsWith('https://')) {
        fileUrl = cleanPath
      } else if (cleanPath.startsWith('/uploads/')) {
        fileUrl = `http://localhost:3000${cleanPath}`
      } else {
        try {
          const { data: signedData } = await supabase.storage
            .from('print-files')
            .createSignedUrl(cleanPath, 3600)

          if (signedData?.signedUrl) {
            fileUrl = signedData.signedUrl
          } else {
            const { data: publicData } = supabase.storage
              .from('print-files')
              .getPublicUrl(cleanPath)
            fileUrl = publicData?.publicUrl
          }
        } catch (e) {
          console.warn('Could not generate signed URL for print file:', e)
        }
      }
    }

    if (fileUrl && effectivePageRange) {
      fileUrl = `${fileUrl}#range=${encodeURIComponent(effectivePageRange)}`
    }

    return NextResponse.json({
      success: true,
      message: 'OTP verified & redeemed successfully',
      data: {
        ...data,
        print_job: {
          ...data?.print_job,
          file_path: cleanPath,
          page_range: effectivePageRange,
          file_url: fileUrl,
        },
        target_printer: targetPrinter,
        amount: calculatedAmount,
        payment: paymentInfo || {
          method: data?.print_job?.payment_type,
          status: data?.print_job?.payment_type === 'online' ? 'completed' : 'pending',
        },
      },
    })
  } catch (err) {
    console.error('Desktop redeem endpoint error:', err)
    return NextResponse.json({ error: err.message || 'Internal server error while verifying OTP' }, { status: 500 })
  }
}
