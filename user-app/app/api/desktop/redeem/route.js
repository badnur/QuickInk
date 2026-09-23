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

    // Check if device is suspended by admin; also fetch its pricing tier
    const { data: devCheck } = await supabase
      .from('devices')
      .select(`
        status,
        location,
        pricing_tiers (
          id,
          name,
          bw_price,
          color_price
        )
      `)
      .eq('id', device_id)
      .maybeSingle()

    if (devCheck && (devCheck.status === 'suspended' || devCheck.status === 'cancelled')) {
      return NextResponse.json({
        error: 'Partnership Suspended. Printing and job redemption are locked by administration.',
        suspended: true,
        reason: devCheck.location?.suspension_reason || 'Administrative partnership suspension'
      }, { status: 403 })
    }

    // Resolve zone pricing (fall back to Standard if not assigned)
    const zoneTier = devCheck?.pricing_tiers || null
    const zoneBwPrice = zoneTier?.bw_price ?? 2.0
    const zoneColorPrice = zoneTier?.color_price ?? 8.0
    const zoneName = zoneTier?.name ?? 'Standard'

    // Call Supabase atomic redemption RPC
    let { data, error } = await supabase.rpc('redeem_otp', {
      p_code: cleanCode,
      p_device_id: device_id,
    })

    // If device not yet registered in DB, attempt to seed device and retry
    if (error && error.message?.includes('Device with ID')) {
      const { error: seedErr } = await supabase.from('devices').upsert({
        id: device_id,
        name: 'PrintKoro Partner Shop - Dhanmondi',
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
        device: { id: device_id, name: 'PrintKoro Partner Shop' },
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

    // Calculate display pricing using zone-specific rates
    const unitPrice = colorMode === 'color' ? zoneColorPrice : zoneBwPrice
    const calculatedAmount =
      paymentInfo?.amount ||
      ((data?.print_job?.page_count || 1) * unitPrice * (data?.print_job?.copies || 1)).toFixed(2)

    // Generate download URL for file
    let fileUrl = null
    const rawPath = data?.print_job?.file_path
    let cleanPath = rawPath
    let rangeFromPath = null
    let nupFromPath = 1
    let borderFromPath = false

    if (rawPath && rawPath.includes('#')) {
      const parts = rawPath.split('#')
      cleanPath = parts[0]
      const hashStr = parts[1] || ''
      const hashParams = hashStr.split('&')
      for (const param of hashParams) {
        const [k, v] = param.split('=')
        if (k === 'range' && v) {
          try { rangeFromPath = decodeURIComponent(v) } catch (e) { rangeFromPath = v }
        } else if (k === 'nup' && v) {
          const parsed = parseInt(v, 10)
          if ([1, 2, 4, 6].includes(parsed)) nupFromPath = parsed
        } else if (k === 'border') {
          borderFromPath = v === '1' || v === 'true'
        }
      }
    }

    const effectivePageRange = data?.print_job?.page_range || rangeFromPath || null
    const effectiveNup = data?.print_job?.pages_per_sheet || nupFromPath || 1
    const effectiveBorder = Boolean(data?.print_job?.mini_border ?? borderFromPath)

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

    if (fileUrl) {
      const outParams = []
      if (effectivePageRange) outParams.push(`range=${encodeURIComponent(effectivePageRange)}`)
      if (effectiveNup > 1) outParams.push(`nup=${effectiveNup}`)
      if (effectiveBorder) outParams.push(`border=1`)
      if (outParams.length > 0) fileUrl = `${fileUrl}#${outParams.join('&')}`
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
          pages_per_sheet: effectiveNup,
          mini_border: effectiveBorder,
          file_url: fileUrl,
        },
        target_printer: targetPrinter,
        amount: calculatedAmount,
        payment: paymentInfo || {
          method: data?.print_job?.payment_type,
          status: data?.print_job?.payment_type === 'online' ? 'completed' : 'pending',
        },
        // Zone pricing info — displayed on POS screen & used for cash collection
        zone: {
          name: zoneName,
          bw_price: zoneBwPrice,
          color_price: zoneColorPrice,
        },
      },
    })
  } catch (err) {
    console.error('Desktop redeem endpoint error:', err)
    return NextResponse.json({ error: err.message || 'Internal server error while verifying OTP' }, { status: 500 })
  }
}
