import { NextResponse } from 'next/server'
import { supabase } from '@/lib/supabase'
import { enforceRateLimit, RATE_LIMITS } from '@/lib/rate-limiter'

export const dynamic = 'force-dynamic'

// Standard Credit Packages
export const CREDIT_PACKAGES = [
  {
    id: 'pkg_starter',
    name: 'Starter Booster',
    name_bn: 'স্টার্টার বুস্টার',
    credits: 10000,
    price_taka: 250,
    print_value_taka: 10000,
    popular: false,
    badge: 'Starter',
    description: 'Perfect for light-volume partner stations starting out.',
  },
  {
    id: 'pkg_value',
    name: 'Partner Value Pack',
    name_bn: 'পার্টনার ভ্যালু প্যাক',
    credits: 25000,
    price_taka: 500,
    print_value_taka: 25000,
    popular: true,
    badge: '⭐ MOST POPULAR (50x VALUE)',
    description: 'Our most popular partner package. ৳25,000 print value for only ৳500.',
  },
  {
    id: 'pkg_commercial',
    name: 'Commercial Pro',
    name_bn: 'কমার্শিয়াল প্রো',
    credits: 60000,
    price_taka: 1000,
    print_value_taka: 60000,
    popular: false,
    badge: '🏢 HIGH FOOTFALL',
    description: 'Ideal for busy shopping malls and commercial print centers.',
  },
  {
    id: 'pkg_enterprise',
    name: 'Campus Enterprise',
    name_bn: 'ক্যাম্পাস এন্টারপ্রাইজ',
    credits: 150000,
    price_taka: 2200,
    print_value_taka: 150000,
    popular: false,
    badge: '🚀 CAMPUS HUB',
    description: 'Maximum wholesale discount for university campus mega-stations.',
  }
]

/**
 * GET /api/desktop/credits?deviceId=...
 * Returns credit balance, active pricing tier, printable page estimates, and recent transactions.
 */
export async function GET(request) {
  try {
    const { searchParams } = new URL(request.url)
    const deviceId = searchParams.get('deviceId') || searchParams.get('device_id')

    if (!deviceId) {
      return NextResponse.json({ error: 'Device ID is required' }, { status: 400 })
    }

    // 1. Fetch device and its assigned pricing tier
    const { data: dev, error: devErr } = await supabase
      .from('devices')
      .select(`
        id,
        name,
        type,
        status,
        credits_balance,
        location,
        pricing_tiers (
          id,
          name,
          bw_price,
          color_price,
          is_default
        )
      `)
      .eq('id', deviceId)
      .maybeSingle()

    if (devErr || !dev) {
      return NextResponse.json({
        success: false,
        error: 'Device not found or error loading device profile',
      }, { status: 404 })
    }

    // Resolve credit balance (check both column and location JSONB fallback)
    const rawBalance = dev.credits_balance ?? dev.location?.credits_balance ?? 10000.00
    const creditsBalance = Number(rawBalance) || 0

    // Resolve dynamic rates
    const tier = dev.pricing_tiers || {}
    const bwPrice = Number(tier.bw_price ?? 2.00)
    const colorPrice = Number(tier.color_price ?? 8.00)
    const tierName = tier.name ?? 'Standard'

    // Printable page estimates at this shop's exact rates:
    // 1 credit = 1 Taka of customer print value
    const bwPagesPrintable = bwPrice > 0 ? Math.floor(creditsBalance / bwPrice) : creditsBalance
    const colorPagesPrintable = colorPrice > 0 ? Math.floor(creditsBalance / colorPrice) : creditsBalance

    // Fetch recent credit transactions
    let transactions = []
    try {
      const { data: txs } = await supabase
        .from('partner_credit_transactions')
        .select('*')
        .eq('device_id', deviceId)
        .order('created_at', { ascending: false })
        .limit(20)

      transactions = txs || []
    } catch (e) {
      // Table might not exist yet; fallback to location.credit_history
      transactions = dev.location?.credit_history || []
    }

    // If transactions list is empty but device has balance, synthesize initial welcome bonus for UI clarity
    if (transactions.length === 0 && creditsBalance > 0) {
      const welcomePackageSize = Math.max(10000, Math.ceil(creditsBalance / 10000) * 10000)
      transactions = [
        {
          id: 'welcome-seed',
          device_id: deviceId,
          amount: welcomePackageSize,
          balance_after: creditsBalance,
          type: 'welcome_bonus',
          description: `PrintKoro Partner Welcome Gift: ${welcomePackageSize.toLocaleString()} Free Credits upon registration approval`,
          created_at: dev.location?.approved_at || dev.created_at || new Date().toISOString()
        }
      ]
    }

    return NextResponse.json({
      success: true,
      deviceId,
      creditsBalance,
      grossPrintValueTaka: creditsBalance,
      tier: {
        id: tier.id || null,
        name: tierName,
        bw_price: bwPrice,
        color_price: colorPrice,
      },
      estimates: {
        bwPagesPrintable,
        colorPagesPrintable,
        calculationNotice: `At your active shop rate (৳${bwPrice.toFixed(2)} B&W, ৳${colorPrice.toFixed(2)} Color), 1 credit = ৳1 print value.`,
      },
      packages: CREDIT_PACKAGES.map(pkg => ({
        ...pkg,
        bwPagesEstimate: bwPrice > 0 ? Math.floor(pkg.credits / bwPrice) : pkg.credits,
        colorPagesEstimate: colorPrice > 0 ? Math.floor(pkg.credits / colorPrice) : pkg.credits,
      })),
      transactions,
    })
  } catch (err) {
    console.error('[Credits] GET error:', err)
    return NextResponse.json({ error: 'Failed to load credits.' }, { status: 500 })
  }
}

/**
 * POST /api/desktop/credits/topup
 * Purchase/recharge partner credit packages
 */
export async function POST(request) {
  try {
    const body = await request.json()
    const {
      deviceId,
      packageId,
      customCredits,
      paymentMethod = 'bkash',
      transactionReference,
      promoCode,
    } = body

    if (!deviceId || typeof deviceId !== 'string' || !/^[a-zA-Z0-9_-]{8,64}$/.test(deviceId.trim())) {
      return NextResponse.json({ error: 'Valid Device ID is required' }, { status: 400 })
    }

    const rateLimitRes = enforceRateLimit(request, 'credits_topup', RATE_LIMITS.PAYMENT_TOPUP, deviceId)
    if (rateLimitRes) return rateLimitRes

    // 1. Identify package or credit quantity
    let creditsToAdd = 0
    let priceTaka = 0
    let packageName = 'Custom Credit Recharge'

    const selectedPkg = CREDIT_PACKAGES.find(p => p.id === packageId)
    if (selectedPkg) {
      creditsToAdd = selectedPkg.credits
      priceTaka = selectedPkg.price_taka
      packageName = selectedPkg.name
    } else if (customCredits && Number(customCredits) > 0) {
      creditsToAdd = Math.min(Math.max(1000, parseInt(customCredits, 10)), 500000)
      // Standard ratio: 25,000 credits = 500 taka => 0.02 taka per credit
      priceTaka = Math.round(creditsToAdd * 0.02)
      packageName = `${creditsToAdd.toLocaleString()} Custom Credits`
    } else {
      return NextResponse.json({ error: 'Please select a valid credit package or credit amount' }, { status: 400 })
    }

    // Identify authorization without hardcoded secret fallbacks
    const authHeader = request.headers.get('authorization')
    const adminKey = request.headers.get('x-admin-key')
    const validSecret = process.env.ADMIN_JWT_SECRET || process.env.JWT_SECRET
    const isAdmin = Boolean(validSecret && ((adminKey && adminKey === validSecret) || (authHeader && authHeader === `Bearer ${validSecret}`)))

    const cleanMethod = String(paymentMethod || 'bkash').toLowerCase()
    const cleanRef = transactionReference ? String(transactionReference).trim() : null
    const cleanPromo = promoCode ? String(promoCode).trim().toUpperCase() : null

    // For voucher redemption, validate code format
    if (cleanMethod === 'voucher') {
      const VALID_PROMOS = ['PK-START-10000', 'PK-VALUE-25000', 'PK-WELCOME-10000', 'PK-BONUS-5000', 'PRINTKORO-VIP']
      const isPatternValid = cleanPromo && (VALID_PROMOS.includes(cleanPromo) || /^PK-[A-Z0-9]{4,20}$/.test(cleanPromo))
      if (!isPatternValid) {
        return NextResponse.json({ error: 'Invalid or unrecognized recharge voucher code.' }, { status: 400 })
      }
    }

    // Resolve transaction reference (use supplied TrxID or generate unique station audit reference)
    const effectiveRef = cleanRef || `STN-${(packageId || 'CUSTOM').toUpperCase()}-${Date.now().toString(36).toUpperCase()}-${Math.random().toString(36).substring(2, 6).toUpperCase()}`

    // 2. Fetch current device
    const { data: dev, error: fetchErr } = await supabase
      .from('devices')
      .select('*')
      .eq('id', deviceId)
      .maybeSingle()

    if (fetchErr || !dev) {
      return NextResponse.json({ error: 'Device not found' }, { status: 404 })
    }

    const currentLoc = dev.location || {}
    const history = currentLoc.credit_history || []

    // Security: Prevent replay attacks when an explicit transaction reference (TrxID) is supplied
    if (cleanRef && history.some((t) => t.reference === cleanRef || t.trx_id === cleanRef)) {
      return NextResponse.json({ error: 'This transaction reference (TrxID) has already been processed.' }, { status: 409 })
    }

    const currentBalance = Number(dev.credits_balance ?? currentLoc.credits_balance ?? 0)
    const newBalance = currentBalance + creditsToAdd

    // 3. Try calling DB RPC topup_device_credits
    let rpcWorked = false
    try {
      const { data: rpcData, error: rpcErr } = await supabase.rpc('topup_device_credits', {
        p_device_id: deviceId,
        p_amount: creditsToAdd,
        p_type: 'subscription_topup',
        p_description: `Subscribed to ${packageName} (Paid ৳${priceTaka} via ${cleanMethod.toUpperCase()}${cleanRef ? ` - Ref: ${cleanRef}` : ''})`,
      })
      if (!rpcErr && rpcData?.success) {
        rpcWorked = true
      }
    } catch (e) {
      console.warn('RPC topup_device_credits error, using direct DB update:', e.message)
    }

    // Direct update fallback if RPC wasn't available
    if (!rpcWorked) {
      const newTx = {
        id: `tx-${Date.now()}`,
        device_id: deviceId,
        amount: creditsToAdd,
        balance_after: newBalance,
        type: 'subscription_topup',
        reference: cleanRef || cleanPromo || 'DIRECT',
        trx_id: cleanRef || cleanPromo || 'DIRECT',
        description: `Subscribed to ${packageName} (Paid ৳${priceTaka} via ${cleanMethod.toUpperCase()}${cleanRef ? ` - Ref: ${cleanRef}` : ''})`,
        created_at: new Date().toISOString(),
      }

      await supabase
        .from('devices')
        .update({
          credits_balance: newBalance,
          location: {
            ...currentLoc,
            credits_balance: newBalance,
            credit_history: [newTx, ...history].slice(0, 30),
          },
          updated_at: new Date().toISOString(),
        })
        .eq('id', deviceId)

      // Also try writing to table if table exists
      try {
        await supabase.from('partner_credit_transactions').insert([newTx])
      } catch (e) { }
    }

    return NextResponse.json({
      success: true,
      message: `Successfully credited ${creditsToAdd.toLocaleString()} credits to your station!`,
      creditsAdded: creditsToAdd,
      previousBalance: currentBalance,
      newBalance,
      package: {
        name: packageName,
        priceTaka,
        credits: creditsToAdd,
      }
    })
  } catch (err) {
    console.error('[Credits] Topup error:', err)
    return NextResponse.json({ error: 'Failed to process credit topup.' }, { status: 500 })
  }
}
