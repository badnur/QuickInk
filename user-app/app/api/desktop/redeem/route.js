import { NextResponse } from 'next/server'
import { supabase } from '@/lib/supabase'

export const dynamic = 'force-dynamic'

// Security: In-memory rate limiting tracker to prevent OTP brute-force guessing
// Key: deviceId_clientIp -> { attempts: number, lockUntil: number, windowStart: number }
const redeemAttemptTracker = new Map()
const MAX_FAILED_ATTEMPTS = 5
const LOCKOUT_DURATION_MS = 5 * 60 * 1000 // 5 minutes lockout after 5 consecutive failures
const ATTEMPT_WINDOW_MS = 60 * 1000 // 1 minute sliding window

function recordFailedAttempt(clientKey) {
  const now = Date.now()
  const tracker = redeemAttemptTracker.get(clientKey) || { attempts: 0, lockUntil: 0, windowStart: now }

  // Reset if window expired and not currently locked out
  if (now - tracker.windowStart > ATTEMPT_WINDOW_MS && tracker.lockUntil <= now) {
    tracker.attempts = 1
    tracker.windowStart = now
  } else {
    tracker.attempts += 1
  }

  if (tracker.attempts >= MAX_FAILED_ATTEMPTS) {
    tracker.lockUntil = now + LOCKOUT_DURATION_MS
  }

  redeemAttemptTracker.set(clientKey, tracker)
}

function clearTracker(clientKey) {
  redeemAttemptTracker.delete(clientKey)
}

export async function POST(request) {
  try {
    const body = await request.json()
    const { code, device_id = '11111111-1111-1111-1111-111111111111' } = body

    if (device_id && !/^[0-9a-fA-F-]{8,64}$/.test(device_id)) {
      return NextResponse.json({ error: 'Invalid device identifier format' }, { status: 400 })
    }

    // Client tracking key for rate limiting
    const ip = request.headers.get('x-forwarded-for')?.split(',')[0]?.trim() || 'local'
    const clientKey = `${device_id}_${ip}`

    // Security: Check active lockout
    const tracker = redeemAttemptTracker.get(clientKey)
    const now = Date.now()
    if (tracker && tracker.lockUntil && tracker.lockUntil > now) {
      const remainingSec = Math.ceil((tracker.lockUntil - now) / 1000)
      return NextResponse.json(
        { error: `Too many failed attempts. Terminal redemption locked for ${remainingSec} seconds to prevent brute-force attacks.` },
        { status: 429 }
      )
    }

    if (!code) {
      return NextResponse.json({ error: '6-digit OTP code is required' }, { status: 400 })
    }

    const cleanCode = code.toString().trim().toUpperCase()

    if (cleanCode.length !== 6 || !/^[A-Za-z0-9]{6}$/.test(cleanCode)) {
      recordFailedAttempt(clientKey)
      return NextResponse.json({ error: 'Please enter a valid 6-character OTP code' }, { status: 400 })
    }

    // Check if device is suspended by admin; also fetch its pricing tier and credit balance
    const { data: devCheck } = await supabase
      .from('devices')
      .select(`
        status,
        location,
        credits_balance,
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
        recordFailedAttempt(clientKey)
        return NextResponse.json({ error: 'Invalid or non-existent 6-digit OTP code' }, { status: 400 })
      }

      if (otpRec.used) {
        recordFailedAttempt(clientKey)
        return NextResponse.json({ error: 'This OTP has already been redeemed' }, { status: 400 })
      }
      if (new Date(otpRec.expires_at) < new Date()) {
        recordFailedAttempt(clientKey)
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
      recordFailedAttempt(clientKey)
      console.warn('Redemption error:', error)
      return NextResponse.json({ error: error.message || 'Invalid or expired OTP code' }, { status: 400 })
    }

    // Successful OTP redemption clears the failed attempt tracker
    clearTracker(clientKey)

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
      } else if (cleanPath.startsWith('local://')) {
        const localFileName = cleanPath.replace('local://', '')
        fileUrl = `/api/download/file?name=${encodeURIComponent(localFileName)}`
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
        credits_balance: Number(devCheck?.credits_balance ?? devCheck?.location?.credits_balance ?? 10000),
        credit_cost: Number(calculatedAmount),
      },
    })
  } catch (err) {
    console.error('[Redeem] Endpoint error:', err)
    return NextResponse.json({ error: 'OTP verification failed. Please try again.' }, { status: 500 })
  }
}
