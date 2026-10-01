// =============================================================================
// PrintKoro Desktop POS & Kiosk Terminal — Client Logic
// Shop & Kiosk Registration, Mobile OTP Verification & Authentication
// =============================================================================

// Standard Wholesale Credit Packages (1 Credit = ৳1 Gross Print Value)
const CREDIT_PACKAGES = [
  {
    id: 'pkg_starter',
    name: 'Starter Booster',
    credits: 10000,
    price_taka: 250,
    print_value_taka: 10000,
  },
  {
    id: 'pkg_value',
    name: 'Partner Value Pack',
    credits: 25000,
    price_taka: 500,
    print_value_taka: 25000,
    popular: true,
  },
  {
    id: 'pkg_commercial',
    name: 'Commercial Pro',
    credits: 60000,
    price_taka: 1000,
    print_value_taka: 60000,
  },
  {
    id: 'pkg_enterprise',
    name: 'Campus Enterprise',
    credits: 150000,
    price_taka: 2200,
    print_value_taka: 150000,
  }
]

// Default Fallback Config & Session State
const state = {
  config: {
    deviceId: '',
    apiBaseUrl: '', // empty or URL. When empty or unreachable, defaults to PrintKoro Cloud
    bwPrinterName: '',
    colorPrinterName: '',
    isKiosk: false
  },
  account: null, // Logged in shop owner profile
  regDraft: {
    type: 'shop',
    name: '',
    shop_name: '',
    phone: '',
    location: '',
    operating_hours: '09:00 AM - 10:00 PM',
    logo_url: '',
    shop_photo_url: '',
  },
  creditsBalance: 10000,
  pricingTier: {
    id: null,
    name: 'Standard',
    bw_price: 2.00,
    color_price: 8.00
  },
  creditTransactions: [],
  selectedPackage: CREDIT_PACKAGES[1], // Partner Value Pack: 25,000 credits for 500 taka
  systemPrinters: [],
  activeJob: null,
  recentJobs: [],
  todayStats: {
    totalJobs: 0,
    bwSheets: 0,
    colorSheets: 0,
    totalRevenue: 0,
    partnerCommission: 0
  }
}

// Check if running inside Electron desktop container
const isElectron = Boolean(window.printkoroDesktop || window.quickinkDesktop)

// Audio Synthesizer Chime (Web Audio API)
function playSuccessChime() {
  try {
    const AudioContext = window.AudioContext || window.webkitAudioContext
    if (!AudioContext) return
    const ctx = new AudioContext()
    const notes = [523.25, 659.25, 783.99] // C5, E5, G5 major triad

    notes.forEach((freq, i) => {
      const osc = ctx.createOscillator()
      const gain = ctx.createGain()
      osc.type = 'sine'
      osc.frequency.setValueAtTime(freq, ctx.currentTime + i * 0.1)

      gain.gain.setValueAtTime(0, ctx.currentTime + i * 0.1)
      gain.gain.linearRampToValueAtTime(0.2, ctx.currentTime + i * 0.1 + 0.02)
      gain.gain.exponentialRampToValueAtTime(0.0001, ctx.currentTime + i * 0.1 + 0.35)

      osc.connect(gain)
      gain.connect(ctx.destination)

      osc.start(ctx.currentTime + i * 0.1)
      osc.stop(ctx.currentTime + i * 0.1 + 0.4)
    })
  } catch (e) {
    console.warn('Audio chime error:', e)
  }
}

// Phone Number Helpers
function normalizePhone(p) {
  if (!p) return ''
  const digits = String(p).replace(/[^0-9]/g, '')
  if (digits.startsWith('880') && digits.length >= 13) {
    return '0' + digits.slice(3)
  }
  return digits
}

function phonesMatch(p1, p2) {
  if (!p1 || !p2) return false
  const c1 = String(p1).replace(/[^0-9]/g, '')
  const c2 = String(p2).replace(/[^0-9]/g, '')
  if (c1 === c2) return true
  if (c1.length >= 10 && c2.length >= 10 && c1.slice(-10) === c2.slice(-10)) return true
  return false
}

// =============================================================================
// PRINTKORO DIRECT CLOUD CLIENT
// Connects directly to Supabase cloud across all devices
// Automatically used when standalone or when local dev server is unreachable
// =============================================================================
const PrintKoroCloud = {
  SUPABASE_URL: 'https://xhzfrmpbhasnipirccnt.supabase.co',
  SUPABASE_KEY: 'sb_publishable_5QRgqfQTgNnpH3PN2wfz1g_4wwy5k8I',
  SMS_API_KEY: '42fc1e917497409da3d3ffc7622e566e',
  ADMIN_CONTACT: { phone: '01733398911', email: 'help@printkoro.com' },

  otpCache: new Map(),

  async rest(path, options = {}) {
    const url = `${this.SUPABASE_URL}/rest/v1/${path}`
    const headers = {
      apikey: this.SUPABASE_KEY,
      Authorization: `Bearer ${this.SUPABASE_KEY}`,
      'Content-Type': 'application/json',
      Prefer: 'return=representation',
      ...(options.headers || {})
    }
    return fetch(url, { ...options, headers })
  },

  async login(phone, password) {
    const cleanPhone = phone.trim().replace(/[^0-9]/g, '')
    const [devRes, partRes] = await Promise.all([
      this.rest('devices?select=*'),
      this.rest('partners?select=*')
    ])
    if (!devRes.ok) throw new Error('Could not connect to PrintKoro cloud database')
    const devices = await devRes.json()
    const partners = partRes.ok ? await partRes.json() : []

    const matchingDevs = (devices || []).filter(d => phonesMatch(d.location?.phone, cleanPhone))
    matchingDevs.sort((a, b) => {
      const aScore = (a.status === 'online' ? 2 : 0) + (a.location?.partner_status === 'approved' ? 2 : 0)
      const bScore = (b.status === 'online' ? 2 : 0) + (b.location?.partner_status === 'approved' ? 2 : 0)
      return bScore - aScore
    })

    let candidateDev = matchingDevs.find(d => d.location?.password === password)
    if (!candidateDev && matchingDevs.length > 0) {
      const legacyDev = matchingDevs.find(d => !d.location?.password)
      if (legacyDev && password.length >= 6) {
        candidateDev = legacyDev
        const updLoc = { ...(candidateDev.location || {}), password }
        this.rest(`devices?id=eq.${candidateDev.id}`, {
          method: 'PATCH',
          body: JSON.stringify({ location: updLoc })
        }).catch(() => {})
      }
    }

    if (!candidateDev) {
      return { ok: false, status: 401, data: { error: 'Invalid mobile number or password.' } }
    }

    const loc = candidateDev.location || {}
    const dbPartner = (partners || []).find(p => phonesMatch(p.phone, cleanPhone))
    const devPartnerStatus = loc.partner_status
    const isOnlineApproved = candidateDev.status === 'online' && devPartnerStatus !== 'pending' && devPartnerStatus !== 'rejected'

    if (candidateDev.status === 'suspended' || candidateDev.status === 'cancelled') {
      return {
        ok: false,
        status: 403,
        data: {
          suspended: true,
          shop_name: loc.shop_name || candidateDev.name,
          deviceId: candidateDev.id,
          reason: loc.suspension_reason || 'Partnership suspended by PrintKoro administration.',
          suspended_at: candidateDev.updated_at || new Date().toISOString()
        }
      }
    }

    let finalStatus = 'pending'
    let rejectionReason = null
    if (devPartnerStatus === 'approved' || isOnlineApproved || dbPartner?.status === 'approved') {
      finalStatus = 'approved'
    } else if (devPartnerStatus === 'rejected' || dbPartner?.status === 'rejected') {
      finalStatus = 'rejected'
      rejectionReason = loc.rejection_reason || dbPartner?.rejection_reason || 'Storefront requirements not met.'
    }

    const account = {
      id: candidateDev.id,
      deviceId: candidateDev.id,
      name: loc.owner_name || candidateDev.name,
      shop_name: loc.shop_name || candidateDev.name,
      phone: cleanPhone,
      location: loc.address || '',
      type: candidateDev.type || loc.type || 'shop',
      operating_hours: loc.operating_hours || '09:00 AM - 10:00 PM',
      status: finalStatus,
      rejection_reason: rejectionReason,
      password: password,
      logo_url: loc.logo_url || '',
      shop_photo_url: loc.shop_photo_url || '',
      created_at: loc.created_at || candidateDev.created_at || new Date().toISOString(),
    }

    if (finalStatus === 'pending') {
      return {
        ok: false,
        status: 403,
        data: {
          pending: true,
          status: 'pending',
          error: 'Application Under Review. Quick Ink administration must approve your shop before dashboard access is granted.',
          account
        }
      }
    }

    if (finalStatus === 'rejected') {
      return {
        ok: false,
        status: 403,
        data: {
          rejected: true,
          status: 'rejected',
          reason: rejectionReason,
          account
        }
      }
    }

    // Set device online in Supabase
    this.rest(`devices?id=eq.${candidateDev.id}`, {
      method: 'PATCH',
      body: JSON.stringify({ status: 'online' })
    }).catch(() => {})

    return {
      ok: true,
      status: 200,
      data: {
        success: true,
        account,
        deviceId: candidateDev.id
      }
    }
  },

  async checkStatus(devId, phone) {
    const cleanPhone = phone ? phone.trim().replace(/[^0-9]/g, '') : ''
    let targetDev = null
    if (devId) {
      const res = await this.rest(`devices?id=eq.${devId}&select=*`)
      if (res.ok) {
        const rows = await res.json()
        if (rows.length > 0) targetDev = rows[0]
      }
    }
    if (!targetDev && cleanPhone) {
      const res = await this.rest('devices?select=*')
      if (res.ok) {
        const rows = await res.json()
        targetDev = rows.find(d => phonesMatch(d.location?.phone, cleanPhone))
      }
    }
    if (!targetDev) {
      return { ok: true, status: 200, data: { pending: true, status: 'pending' } }
    }
    if (targetDev.status === 'suspended' || targetDev.status === 'cancelled') {
      return {
        ok: true,
        status: 200,
        data: {
          suspended: true,
          status: 'suspended',
          reason: targetDev.location?.suspension_reason || 'Administrative partnership suspension',
          suspended_at: targetDev.updated_at
        }
      }
    }
    const loc = targetDev.location || {}
    const isApproved = loc.partner_status === 'approved' || targetDev.status === 'online'
    const isRejected = loc.partner_status === 'rejected'
    if (isApproved) {
      return { ok: true, status: 200, data: { approved: true, status: 'approved', deviceId: targetDev.id, device: targetDev } }
    }
    if (isRejected) {
      return { ok: true, status: 200, data: { rejected: true, status: 'rejected', reason: loc.rejection_reason || 'Storefront requirements not met.' } }
    }
    return { ok: true, status: 200, data: { pending: true, status: 'pending' } }
  },

  async fetchDevices() {
    const res = await this.rest('devices?select=*&order=name.asc')
    if (res.ok) {
      const devices = await res.json()
      if (Array.isArray(devices) && devices.length > 0) return { ok: true, data: { success: true, devices } }
    }
    return { ok: true, data: { success: true, devices: [] } }
  },

  async fetchJobs(deviceId) {
    let path = 'print_jobs?select=*&order=created_at.desc&limit=20'
    if (deviceId) {
      path += `&or=(redeemed_by_device_id.eq.${deviceId},status.eq.awaiting_redemption)`
    }
    const res = await this.rest(path)
    if (res.ok) {
      const jobs = await res.json()
      return { ok: true, data: { success: true, jobs: Array.isArray(jobs) ? jobs : [] } }
    }
    return { ok: true, data: { success: true, jobs: [] } }
  },

  async redeemOtp(code, deviceId) {
    const cleanCode = code.toString().trim().toUpperCase()
    const res = await fetch(`${this.SUPABASE_URL}/rest/v1/rpc/redeem_otp`, {
      method: 'POST',
      headers: {
        apikey: this.SUPABASE_KEY,
        Authorization: `Bearer ${this.SUPABASE_KEY}`,
        'Content-Type': 'application/json'
      },
      body: JSON.stringify({ p_code: cleanCode, p_device_id: deviceId })
    })
    const data = await res.json()
    if (!res.ok || data.code) {
      throw new Error(data.message || 'Invalid or expired OTP code')
    }

    const printJob = data.print_job || {}
    const colorMode = printJob.color_mode || 'bw'
    const targetPrinter = colorMode === 'color' ? 'color' : 'bw'
    const unitPrice = colorMode === 'color' ? 8.0 : 2.0
    const calculatedAmount = ((printJob.page_count || 1) * unitPrice * (printJob.copies || 1)).toFixed(2)

    let rawPath = printJob.file_path
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
    const effectivePageRange = printJob.page_range || rangeFromPath || null

    let fileUrl = cleanPath
    if (fileUrl && !fileUrl.startsWith('http')) {
      try {
        const signRes = await fetch(`${this.SUPABASE_URL}/storage/v1/object/sign/print-files/${cleanPath}`, {
          method: 'POST',
          headers: {
            apikey: this.SUPABASE_KEY,
            Authorization: `Bearer ${this.SUPABASE_KEY}`,
            'Content-Type': 'application/json'
          },
          body: JSON.stringify({ expiresIn: 3600 })
        })
        if (signRes.ok) {
          const signData = await signRes.json()
          if (signData.signedURL) {
            fileUrl = `${this.SUPABASE_URL}/storage/v1${signData.signedURL}`
          }
        }
      } catch (e) {
        console.warn('Storage sign note:', e)
      }
    }

    if (fileUrl && effectivePageRange) {
      fileUrl = `${fileUrl}#range=${encodeURIComponent(effectivePageRange)}`
    }

    return {
      ok: true,
      data: {
        ...data,
        print_job: {
          ...printJob,
          file_path: cleanPath,
          page_range: effectivePageRange,
          file_url: fileUrl
        },
        target_printer: targetPrinter,
        amount: calculatedAmount,
        payment: {
          method: printJob.payment_type || 'cash',
          status: printJob.payment_type === 'online' ? 'completed' : 'pending'
        }
      }
    }
  },

  async sendOtp(phone) {
    const cleanPhone = phone.trim().replace(/[^0-9]/g, '')
    const code = Math.floor(100000 + Math.random() * 900000).toString()
    this.otpCache.set(cleanPhone, { code, expiresAt: Date.now() + 10 * 60 * 1000 })

    const msg = encodeURIComponent(`Your PrintKoro verification code is: ${code}. Valid for 10 minutes.`)
    const smsUrl = `https://fraudchecker.link/api/v1/sms/?api_key=${this.SMS_API_KEY}&number=${cleanPhone}&message=${msg}`
    fetch(smsUrl).catch(() => {})
    return { ok: true, data: { success: true, message: `Verification code sent to ${cleanPhone}`, phone: cleanPhone } }
  },

  async verifyOtp(phone, otp) {
    const cleanPhone = phone.trim().replace(/[^0-9]/g, '')
    const cleanOtp = otp.trim()
    const stored = this.otpCache.get(cleanPhone)
    if (stored && stored.code === cleanOtp && stored.expiresAt > Date.now()) {
      return { ok: true, data: { success: true, verified: true, phone: cleanPhone } }
    }
    return { ok: false, data: { error: 'Invalid or expired verification code. Please check your SMS or request a new code.' } }
  },

  async register(draft) {
    const cleanPhone = draft.phone.trim().replace(/[^0-9]/g, '')
    const reference_id = `QIK-REG-${Math.floor(100000 + Math.random() * 900000)}`
    const resolvedHours = draft.operating_hours || (draft.type === 'kiosk' ? '24/7 Automated' : '09:00 AM - 10:00 PM')

    const locationObj = {
      address: draft.location,
      phone: cleanPhone,
      owner_name: draft.name,
      shop_name: draft.shop_name,
      type: draft.type === 'kiosk' ? 'kiosk' : 'shop',
      operating_hours: resolvedHours,
      password: draft.password,
      logo_url: draft.logo_url || '',
      shop_photo_url: draft.shop_photo_url || '',
      payout_rate: 100.0,
      subscription_status: 'active',
      subscription_plan: 'Pro SaaS',
      registration_reference: reference_id,
      reference_id,
      partner_status: 'pending',
      rejection_reason: null,
      is_partner_application: true,
      created_at: new Date().toISOString(),
    }

    let devData = null
    const insRes = await this.rest('devices', {
      method: 'POST',
      body: JSON.stringify({
        name: draft.type === 'kiosk' ? `PrintKoro Kiosk — ${draft.shop_name}` : `PrintKoro Shop — ${draft.shop_name}`,
        type: draft.type === 'kiosk' ? 'kiosk' : 'shop',
        location: locationObj,
        status: 'offline'
      })
    })

    if (insRes.ok) {
      const rows = await insRes.json()
      devData = rows[0]
    }

    this.rest('partners', {
      method: 'POST',
      body: JSON.stringify({
        name: draft.name,
        shop_name: draft.shop_name,
        phone: cleanPhone,
        location: draft.location,
        status: 'pending'
      })
    }).catch(() => {})

    const newAccount = {
      id: devData?.id || `dev-${Date.now()}`,
      reference_id,
      deviceId: devData?.id,
      name: draft.name,
      shop_name: draft.shop_name,
      phone: cleanPhone,
      location: draft.location,
      type: draft.type,
      operating_hours: resolvedHours,
      status: 'pending',
      rejection_reason: null,
      password: draft.password,
      logo_url: draft.logo_url,
      shop_photo_url: draft.shop_photo_url,
      created_at: new Date().toISOString()
    }

    return {
      ok: true,
      status: 201,
      data: {
        success: true,
        pending: true,
        status: 'pending',
        account: newAccount,
        device: devData || newAccount,
        contact: this.ADMIN_CONTACT
      }
    }
  },

  async resetPasswordSave(phone, newPassword) {
    const cleanPhone = phone.trim().replace(/[^0-9]/g, '')
    const devRes = await this.rest('devices?select=*')
    if (devRes.ok) {
      const devices = await devRes.json()
      const dev = (devices || []).find(d => phonesMatch(d.location?.phone, cleanPhone))
      if (dev) {
        const updLoc = { ...(dev.location || {}), password: newPassword }
        await this.rest(`devices?id=eq.${dev.id}`, {
          method: 'PATCH',
          body: JSON.stringify({ location: updLoc })
        })
        return { ok: true, data: { success: true, message: 'Password reset successfully' } }
      }
    }
    return { ok: false, data: { error: 'Account not found with this mobile number.' } }
  },

  async fetchCredits(deviceId) {
    if (!deviceId) return { ok: false, data: { error: 'No device ID provided' } }
    try {
      const devRes = await this.rest(`devices?id=eq.${deviceId}&select=*,pricing_tiers(*)`)
      if (!devRes.ok) return { ok: false, data: { error: 'Could not fetch device details from cloud' } }
      const rows = await devRes.json()
      const dev = rows[0] || {}
      const rawBalance = dev.credits_balance ?? dev.location?.credits_balance ?? 10000.00
      const creditsBalance = Number(rawBalance) || 0
      const tier = dev.pricing_tiers || {}
      const bwPrice = Number(tier.bw_price ?? 2.00)
      const colorPrice = Number(tier.color_price ?? 8.00)

      let transactions = []
      try {
        const txRes = await this.rest(`partner_credit_transactions?device_id=eq.${deviceId}&order=created_at.desc&limit=20`)
        if (txRes.ok) transactions = await txRes.json()
      } catch (e) {
        transactions = dev.location?.credit_history || []
      }

      if (transactions.length === 0 && creditsBalance > 0) {
        transactions = [
          {
            id: 'welcome-init',
            device_id: deviceId,
            amount: creditsBalance,
            balance_after: creditsBalance,
            type: 'welcome_bonus',
            description: `PrintKoro Partner Welcome Gift: ${creditsBalance.toLocaleString()} Free Credits upon registration approval`,
            created_at: dev.location?.approved_at || dev.created_at || new Date().toISOString()
          }
        ]
      }

      return {
        ok: true,
        data: {
          success: true,
          deviceId,
          creditsBalance,
          grossPrintValueTaka: creditsBalance,
          tier: { id: tier.id, name: tier.name || 'Standard', bw_price: bwPrice, color_price: colorPrice },
          estimates: {
            bwPagesPrintable: bwPrice > 0 ? Math.floor(creditsBalance / bwPrice) : creditsBalance,
            colorPagesPrintable: colorPrice > 0 ? Math.floor(creditsBalance / colorPrice) : creditsBalance
          },
          transactions
        }
      }
    } catch (err) {
      console.warn('Cloud fetchCredits error:', err)
      return { ok: false, data: { error: err.message } }
    }
  },

  async topupCredits(deviceId, packageId, amount, details = {}) {
    const pkg = CREDIT_PACKAGES.find(p => p.id === packageId)
    const creditsToAdd = pkg ? pkg.credits : Number(amount || 25000)
    const priceTaka = pkg ? pkg.price_taka : Math.round(creditsToAdd * 0.02)
    const packageName = pkg?.name || `${creditsToAdd.toLocaleString()} Credits`

    try {
      const rpcRes = await fetch(`${this.SUPABASE_URL}/rest/v1/rpc/topup_device_credits`, {
        method: 'POST',
        headers: {
          apikey: this.SUPABASE_KEY,
          Authorization: `Bearer ${this.SUPABASE_KEY}`,
          'Content-Type': 'application/json'
        },
        body: JSON.stringify({
          p_device_id: deviceId,
          p_amount: creditsToAdd,
          p_type: 'subscription_topup',
          p_description: `Subscribed to ${packageName} (Paid ৳${priceTaka})`
        })
      })
      if (rpcRes.ok) {
        const rpcData = await rpcRes.json()
        return { ok: true, data: { success: true, creditsAdded: creditsToAdd, newBalance: rpcData?.balance || creditsToAdd } }
      }
    } catch (e) {}

    // Direct fallback
    const devRes = await this.rest(`devices?id=eq.${deviceId}`)
    const devs = await devRes.json()
    const dev = devs[0]
    const curBal = Number(dev?.credits_balance ?? dev?.location?.credits_balance ?? 0)
    const newBal = curBal + creditsToAdd
    const loc = dev?.location || {}
    const tx = {
      id: `tx-${Date.now()}`,
      device_id: deviceId,
      amount: creditsToAdd,
      balance_after: newBal,
      type: 'subscription_topup',
      description: `Subscribed to ${packageName} (Paid ৳${priceTaka})`,
      created_at: new Date().toISOString()
    }

    await this.rest(`devices?id=eq.${deviceId}`, {
      method: 'PATCH',
      body: JSON.stringify({
        credits_balance: newBal,
        location: { ...loc, credits_balance: newBal, credit_history: [tx, ...(loc.credit_history || [])].slice(0, 30) }
      })
    })

    return {
      ok: true,
      data: {
        success: true,
        creditsAdded: creditsToAdd,
        newBalance: newBal,
        message: `Added ${creditsToAdd.toLocaleString()} credits to your station account!`
      }
    }
  },

  async confirmPrintAndDeductCredits(jobId, deviceId, isSuccess = true, errorReason = null) {
    if (!isSuccess) {
      console.warn('[Safe Print Rule] Hardware execution failed:', errorReason, 'Zero credits deducted.')
      return { ok: true, data: { success: false, creditsDeducted: 0, message: 'Print failed. Zero credits were deducted.' } }
    }

    try {
      const rpcRes = await fetch(`${this.SUPABASE_URL}/rest/v1/rpc/confirm_print_and_deduct_credits`, {
        method: 'POST',
        headers: {
          apikey: this.SUPABASE_KEY,
          Authorization: `Bearer ${this.SUPABASE_KEY}`,
          'Content-Type': 'application/json'
        },
        body: JSON.stringify({ p_job_id: jobId, p_device_id: deviceId })
      })
      if (rpcRes.ok) {
        const rpcData = await rpcRes.json()
        return { ok: true, data: rpcData }
      }
    } catch (e) {}

    // Direct fallback
    const [devRes, jobRes] = await Promise.all([
      this.rest(`devices?id=eq.${deviceId}&select=*,pricing_tiers(*)`),
      this.rest(`print_jobs?id=eq.${jobId}`)
    ])
    const devs = await devRes.json()
    const jobs = await jobRes.json()
    const dev = devs[0]
    const job = jobs[0]
    if (!dev || !job) return { ok: false, data: { error: 'Device or Job not found' } }

    const tier = dev.pricing_tiers || {}
    const isColor = job.color_mode === 'color'
    const unitPrice = isColor ? Number(tier.color_price ?? 8.00) : Number(tier.bw_price ?? 2.00)
    const cost = Math.round(unitPrice * (job.page_count || 1) * (job.copies || 1) * 100) / 100
    const curBal = Number(dev.credits_balance ?? dev.location?.credits_balance ?? 10000.00)
    const newBal = Math.max(0, curBal - cost)
    const loc = dev.location || {}

    const tx = {
      id: `tx-${Date.now()}`,
      device_id: deviceId,
      amount: -cost,
      balance_after: newBal,
      type: 'print_deduction',
      description: `Print Job Completed: ${job.page_count || 1} sheet(s) ${isColor ? 'Color' : 'B&W'} × ${job.copies || 1} copy @ ৳${unitPrice}/sheet`,
      print_job_id: jobId,
      created_at: new Date().toISOString()
    }

    await Promise.all([
      this.rest(`devices?id=eq.${deviceId}`, {
        method: 'PATCH',
        body: JSON.stringify({
          credits_balance: newBal,
          location: { ...loc, credits_balance: newBal, credit_history: [tx, ...(loc.credit_history || [])].slice(0, 30) }
        })
      }),
      this.rest(`print_jobs?id=eq.${jobId}`, {
        method: 'PATCH',
        body: JSON.stringify({ status: 'completed', printed_at: new Date().toISOString(), redeemed_by_device_id: deviceId })
      })
    ])

    return {
      ok: true,
      data: {
        success: true,
        creditsDeducted: cost,
        newBalance: newBal,
        message: `Print completed successfully. ${cost} credits deducted.`
      }
    }
  }
}

const QuickInkCloud = PrintKoroCloud

// Universal API POST wrapper with transparent auto-fallback to Cloud
async function apiPost(endpoint, body, fallbackCloudFn) {
  const customUrl = state.config.apiBaseUrl?.trim()
  if (!customUrl) {
    updateConnectionBadge()
    return fallbackCloudFn()
  }

  try {
    const controller = new AbortController()
    const timer = setTimeout(() => controller.abort(), 3500)
    const res = await fetch(`${customUrl}${endpoint}`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(body),
      signal: controller.signal
    })
    clearTimeout(timer)
    const data = await res.json().catch(() => null)
    return { ok: res.ok, status: res.status, data }
  } catch (err) {
    console.warn(`[PrintKoro] API request to ${customUrl}${endpoint} failed (${err.message}). Auto-switching to PrintKoro Cloud...`)
    setConnectionStatus('cloud', 'PrintKoro Cloud: Connected (Auto-fallback)')
    return fallbackCloudFn()
  }
}

// Universal API GET wrapper with transparent auto-fallback to Cloud
async function apiGet(endpoint, fallbackCloudFn) {
  const customUrl = state.config.apiBaseUrl?.trim()
  if (!customUrl) {
    updateConnectionBadge()
    return fallbackCloudFn()
  }

  try {
    const controller = new AbortController()
    const timer = setTimeout(() => controller.abort(), 3500)
    const res = await fetch(`${customUrl}${endpoint}`, { signal: controller.signal })
    clearTimeout(timer)
    const data = await res.json().catch(() => null)
    return { ok: res.ok, status: res.status, data }
  } catch (err) {
    console.warn(`[PrintKoro] API request to ${customUrl}${endpoint} failed (${err.message}). Auto-switching to PrintKoro Cloud...`)
    setConnectionStatus('cloud', 'PrintKoro Cloud: Connected (Auto-fallback)')
    return fallbackCloudFn()
  }
}

function setConnectionStatus(type, label) {
  if (el.authConnDot) {
    if (type === 'offline') {
      el.authConnDot.classList.add('offline')
    } else {
      el.authConnDot.classList.remove('offline')
    }
  }
  if (el.authConnLabel) {
    el.authConnLabel.textContent = label
  }
}

function updateConnectionBadge() {
  if (!el.authConnDot || !el.authConnLabel) return
  const custom = state.config.apiBaseUrl?.trim()
  if (custom) {
    try {
      const urlObj = new URL(custom)
      el.authConnLabel.textContent = `Server: ${urlObj.host}`
    } catch {
      el.authConnLabel.textContent = `Server: ${custom}`
    }
    el.authConnDot.classList.remove('offline')
  } else {
    el.authConnLabel.textContent = 'PrintKoro Cloud: Connected'
    el.authConnDot.classList.remove('offline')
  }
}

// DOM Elements
const el = {
  stationSelect: document.getElementById('station-select'),
  clockDisplay: document.getElementById('clock-display'),
  btnToggleKiosk: document.getElementById('btn-toggle-kiosk'),
  btnWinMin: document.getElementById('btn-win-min'),
  btnWinMax: document.getElementById('btn-win-max'),
  btnWinClose: document.getElementById('btn-win-close'),
  navTabs: document.querySelectorAll('.nav-tab'),
  tabPanels: document.querySelectorAll('.tab-panel'),

  // Header Account Profile
  headerAvatarImg: document.getElementById('header-avatar-img'),
  headerAvatarInitials: document.getElementById('header-avatar-initials'),
  headerShopName: document.getElementById('header-shop-name'),
  headerOwnerName: document.getElementById('header-owner-name'),
  btnAccountToggle: document.getElementById('btn-account-toggle'),
  btnAccountLabel: document.getElementById('btn-account-label'),

  // Auto-Updater UI & Home Update Center
  updateBanner: document.getElementById('update-banner'),
  updateBannerIcon: document.getElementById('update-banner-icon'),
  updateBannerTitle: document.getElementById('update-banner-title'),
  updateBannerDesc: document.getElementById('update-banner-desc'),
  updateProgressContainer: document.getElementById('update-progress-container'),
  updateProgressFill: document.getElementById('update-progress-fill'),
  btnUpdateRestart: document.getElementById('btn-update-restart'),
  btnUpdateDismiss: document.getElementById('btn-update-dismiss'),

  // Home Page Live Software Update Center
  homeUpdateCard: document.getElementById('home-update-card'),
  homeUpdateStatusPill: document.getElementById('home-update-status-pill'),
  homeUpdatePillText: document.getElementById('home-update-pill-text'),
  homeCurrentVersion: document.getElementById('home-current-version'),
  homeLatestVersion: document.getElementById('home-latest-version'),
  homeReleaseTag: document.getElementById('home-release-tag'),
  homeChangelogItems: document.getElementById('home-changelog-items'),
  homeUpdateProgressWrap: document.getElementById('home-update-progress-wrap'),
  homeDownloadStatusTxt: document.getElementById('home-download-status-txt'),
  homeDownloadPercent: document.getElementById('home-download-percent'),
  homeDownloadFill: document.getElementById('home-download-fill'),
  homeDownloadSpeed: document.getElementById('home-download-speed'),
  homeDownloadSize: document.getElementById('home-download-size'),
  homeUpdateStatusMsg: document.getElementById('home-update-status-msg'),
  homeUpdateMsgText: document.getElementById('home-update-msg-text'),
  btnHomeCheckUpdate: document.getElementById('btn-home-check-update'),
  homeCheckSpinner: document.getElementById('home-check-spinner'),
  homeCheckBtnText: document.getElementById('home-check-btn-text'),
  btnHomeRestartUpdate: document.getElementById('btn-home-restart-update'),
  homeLastCheckedTime: document.getElementById('home-last-checked-time'),

  // Customer OTP Terminal
  otpBoxes: [
    document.getElementById('otp-0'),
    document.getElementById('otp-1'),
    document.getElementById('otp-2'),
    document.getElementById('otp-3'),
    document.getElementById('otp-4'),
    document.getElementById('otp-5')
  ],
  otpStatusMsg: document.getElementById('otp-status-msg'),
  btnVerifyOtp: document.getElementById('btn-verify-otp'),
  verifySpinner: document.getElementById('verify-spinner'),
  verifyBtnText: document.getElementById('verify-btn-text'),
  btnClearOtp: document.getElementById('btn-clear-otp'),
  btnBackspaceOtp: document.getElementById('btn-backspace-otp'),
  numpadBtns: document.querySelectorAll('.numpad-btn[data-val]'),

  // Hardware strip
  stripBwName: document.getElementById('strip-bw-name'),
  stripColorName: document.getElementById('strip-color-name'),

  // Printers Tab
  btnRefreshPrinters: document.getElementById('btn-refresh-printers'),
  selectBwPrinter: document.getElementById('select-bw-printer'),
  selectColorPrinter: document.getElementById('select-color-printer'),
  btnTestBw: document.getElementById('btn-test-bw'),
  btnTestColor: document.getElementById('btn-test-color'),
  btnSavePrinters: document.getElementById('btn-save-printers'),
  savePrintersStatus: document.getElementById('save-printers-status'),

  // Queue Tab
  queueSearch: document.getElementById('queue-search'),
  btnRefreshQueue: document.getElementById('btn-refresh-queue'),
  jobsTableBody: document.getElementById('jobs-table-body'),

  // Earnings Tab
  metricTotalJobs: document.getElementById('metric-total-jobs'),
  metricBwSheets: document.getElementById('metric-bw-sheets'),
  metricColorSheets: document.getElementById('metric-color-sheets'),
  metricPartnerCommission: document.getElementById('metric-partner-commission'),
  miniStatJobs: document.getElementById('mini-stat-jobs'),
  miniStatPages: document.getElementById('mini-stat-pages'),
  miniStatCommission: document.getElementById('mini-stat-commission'),

  // Job Modal
  jobModal: document.getElementById('job-modal'),
  modalDocTitle: document.getElementById('modal-doc-title'),
  modalOtp: document.getElementById('modal-otp'),
  modalColorMode: document.getElementById('modal-color-mode'),
  modalPagesCopies: document.getElementById('modal-pages-copies'),
  modalDuplex: document.getElementById('modal-duplex'),
  modalRoutedPrinter: document.getElementById('modal-routed-printer'),
  modalPaymentAlert: document.getElementById('modal-payment-alert'),
  modalPayHeading: document.getElementById('modal-pay-heading'),
  modalPayInstruction: document.getElementById('modal-pay-instruction'),
  modalPayAmount: document.getElementById('modal-pay-amount'),
  spoolingPanel: document.getElementById('spooling-panel'),
  spoolingStepLabel: document.getElementById('spooling-step-label'),
  spoolingPercentage: document.getElementById('spooling-percentage'),
  spoolingProgressBar: document.getElementById('spooling-progress-bar'),
  btnCloseModal: document.getElementById('btn-close-modal'),
  btnCancelJob: document.getElementById('btn-cancel-job'),
  btnReleasePrint: document.getElementById('btn-release-print'),
  releaseBtnText: document.getElementById('release-btn-text'),
  releaseBtnIcon: document.getElementById('release-btn-icon'),

  // Screen Views
  screenLogin: document.getElementById('screen-login'),
  screenRegister: document.getElementById('screen-register'),
  screenLockdown: document.getElementById('screen-lockdown'),
  screenWorkspace: document.getElementById('screen-workspace'),

  // Login Screen (Matching User Screenshot)
  formLogin: document.getElementById('form-login'),
  loginPhone: document.getElementById('login-phone'),
  loginPassword: document.getElementById('login-password'),
  loginStatusMsg: document.getElementById('login-status-msg'),
  btnSubmitLogin: document.getElementById('btn-submit-login'),
  loginBtnText: document.getElementById('login-btn-text'),
  btnToggleEye: document.getElementById('btn-toggle-eye'),
  eyeIconOpen: document.getElementById('eye-icon-open'),
  eyeIconClosed: document.getElementById('eye-icon-closed'),
  btnForgotPassword: document.getElementById('btn-forgot-password'),
  linkToRegister: document.getElementById('link-to-register'),
  linkToLogin: document.getElementById('link-to-login'),

  // Forgot Password Screen
  screenForgotPassword: document.getElementById('screen-forgot-password'),
  fpStep1: document.getElementById('fp-step-1'),
  fpStep2: document.getElementById('fp-step-2'),
  fpStep3: document.getElementById('fp-step-3'),
  fpStepSuccess: document.getElementById('fp-step-success'),
  fpPhone: document.getElementById('fp-phone'),
  fpStep1Status: document.getElementById('fp-step1-status'),
  fpStep2Status: document.getElementById('fp-step2-status'),
  fpStep3Status: document.getElementById('fp-step3-status'),
  btnFpSendOtp: document.getElementById('btn-fp-send-otp'),
  fpSendOtpText: document.getElementById('fp-send-otp-text'),
  fpOtpBoxes: Array.from(document.querySelectorAll('#fp-otp-boxes .otp-box')),
  btnFpVerifyOtp: document.getElementById('btn-fp-verify-otp'),
  fpVerifyOtpText: document.getElementById('fp-verify-otp-text'),
  btnFpResend: document.getElementById('btn-fp-resend'),
  fpOtpBack: document.getElementById('fp-otp-back'),
  fpOtpHint: document.getElementById('fp-otp-hint'),
  fpNewPassword: document.getElementById('fp-new-password'),
  fpConfirmPassword: document.getElementById('fp-confirm-password'),
  btnFpTogglePw: document.getElementById('btn-fp-toggle-pw'),
  fpEyeOpen: document.getElementById('fp-eye-open'),
  fpEyeClosed: document.getElementById('fp-eye-closed'),
  btnFpReset: document.getElementById('btn-fp-reset'),
  fpResetText: document.getElementById('fp-reset-text'),
  fpBackToLogin: document.getElementById('fp-back-to-login'),
  fpGoLogin: document.getElementById('fp-go-login'),

  // Administrative Lockdown Screen
  lockdownShopName: document.getElementById('lockdown-shop-name'),
  lockdownDeviceId: document.getElementById('lockdown-device-id'),
  lockdownReasonText: document.getElementById('lockdown-reason-text'),
  lockdownDateText: document.getElementById('lockdown-date-text'),
  btnLockdownCheckStatus: document.getElementById('btn-lockdown-check-status'),
  btnLockdownLogout: document.getElementById('btn-lockdown-logout'),

  // Application Pending Review Screen
  screenPending: document.getElementById('screen-pending'),
  pendingShopName: document.getElementById('pending-shop-name'),
  pendingOwnerName: document.getElementById('pending-owner-name'),
  pendingPhone: document.getElementById('pending-phone'),
  pendingType: document.getElementById('pending-type'),
  pendingHours: document.getElementById('pending-hours'),
  pendingLocation: document.getElementById('pending-location'),
  btnPendingCheckStatus: document.getElementById('btn-pending-check-status'),
  btnPendingLogout: document.getElementById('btn-pending-logout'),

  // Application Rejected Screen
  screenRejected: document.getElementById('screen-rejected'),
  rejectedShopName: document.getElementById('rejected-shop-name'),
  rejectedPhone: document.getElementById('rejected-phone'),
  rejectedReasonText: document.getElementById('rejected-reason-text'),
  btnReRegister: document.getElementById('btn-re-register'),
  btnRejectedLogout: document.getElementById('btn-rejected-logout'),

  // Stepper
  stepInd1: document.getElementById('step-ind-1'),
  stepInd2: document.getElementById('step-ind-2'),
  stepInd3: document.getElementById('step-ind-3'),
  stepLine1: document.getElementById('step-line-1'),
  stepLine2: document.getElementById('step-line-2'),

  // Step 1: Details
  regStep1: document.getElementById('reg-step-1'),
  labelModShop: document.getElementById('label-mod-shop'),
  labelModKiosk: document.getElementById('label-mod-kiosk'),
  regOwnerName: document.getElementById('reg-owner-name'),
  regShopName: document.getElementById('reg-shop-name'),
  regPhone: document.getElementById('reg-phone'),
  regOperatingHours: document.getElementById('reg-operating-hours'),
  regLocation: document.getElementById('reg-location'),
  regLogoInput: document.getElementById('reg-logo-input'),
  btnBrowseLogo: document.getElementById('btn-browse-logo'),
  logoPreviewImg: document.getElementById('logo-preview-img'),
  logoPreviewPlaceholder: document.getElementById('logo-preview-placeholder'),
  regPhotoInput: document.getElementById('reg-photo-input'),
  btnBrowsePhoto: document.getElementById('btn-browse-photo'),
  photoPreviewImg: document.getElementById('photo-preview-img'),
  photoPreviewPlaceholder: document.getElementById('photo-preview-placeholder'),
  regStep1StatusMsg: document.getElementById('reg-step1-status-msg'),
  btnToStep2: document.getElementById('btn-to-step-2'),

  // Step 2: OTP
  regStep2: document.getElementById('reg-step-2'),
  regTargetPhoneDisplay: document.getElementById('reg-target-phone-display'),
  authOtpBoxes: [
    document.getElementById('auth-otp-0'),
    document.getElementById('auth-otp-1'),
    document.getElementById('auth-otp-2'),
    document.getElementById('auth-otp-3'),
    document.getElementById('auth-otp-4'),
    document.getElementById('auth-otp-5'),
  ],
  regStep2StatusMsg: document.getElementById('reg-step2-status-msg'),
  btnBackToStep1: document.getElementById('btn-back-to-step-1'),
  btnResendMobileOtp: document.getElementById('btn-resend-mobile-otp'),
  btnVerifyMobileOtp: document.getElementById('btn-verify-mobile-otp'),

  // Step 3: Password
  regStep3: document.getElementById('reg-step-3'),
  regVerifiedPhoneTxt: document.getElementById('reg-verified-phone-txt'),
  regNewPassword: document.getElementById('reg-new-password'),
  regConfirmPassword: document.getElementById('reg-confirm-password'),
  regStep3StatusMsg: document.getElementById('reg-step3-status-msg'),
  btnFinishRegistration: document.getElementById('btn-finish-registration'),

  // Account Profile & Terminal Control Center Modal
  accountModal: document.getElementById('account-modal'),
  btnCloseAccountModal: document.getElementById('btn-close-account-modal'),
  modalAccountShopName: document.getElementById('modal-account-shop-name'),
  modalAccountOwnerName: document.getElementById('modal-account-owner-name'),
  modalAccountType: document.getElementById('modal-account-type'),
  modalAccountMemberSince: document.getElementById('modal-account-member-since'),
  modalAccountLogoImg: document.getElementById('modal-account-logo-img'),
  modalAccountLogoInitials: document.getElementById('modal-account-logo-initials'),
  modalAccountPhotoWrap: document.getElementById('modal-account-photo-wrap'),
  modalAccountPhotoImg: document.getElementById('modal-account-photo-img'),
  modalAccountPhone: document.getElementById('modal-account-phone'),
  modalAccountEmail: document.getElementById('modal-account-email'),
  modalAccountAddress: document.getElementById('modal-account-address'),
  modalAccountDeviceId: document.getElementById('modal-account-device-id'),
  btnCopyDeviceId: document.getElementById('btn-copy-device-id'),
  modalAccountCredits: document.getElementById('modal-account-credits'),
  modalAccountCreditsValue: document.getElementById('modal-account-credits-value'),
  btnAccountOpenSub: document.getElementById('btn-account-open-sub'),
  modalAccountBwDot: document.getElementById('modal-account-bw-dot'),
  modalAccountBwName: document.getElementById('modal-account-bw-name'),
  modalAccountColorDot: document.getElementById('modal-account-color-dot'),
  modalAccountColorName: document.getElementById('modal-account-color-name'),
  btnProfileTestPrint: document.getElementById('btn-profile-test-print'),
  modalAccountTierName: document.getElementById('modal-account-tier-name'),
  modalAccountBwSingle: document.getElementById('modal-account-bw-single'),
  modalAccountBwDuplex: document.getElementById('modal-account-bw-duplex'),
  modalAccountColorSingle: document.getElementById('modal-account-color-single'),
  modalAccountColorDuplex: document.getElementById('modal-account-color-duplex'),
  btnRefreshProfileSync: document.getElementById('btn-refresh-profile-sync'),
  btnSwitchAccount: document.getElementById('btn-switch-account'),
  btnLogoutAccount: document.getElementById('btn-logout-account'),

  // Wholesale Credit Subscriptions
  headerCreditAmount: document.getElementById('header-credit-amount'),
  btnOpenSubscriptions: document.getElementById('btn-open-subscriptions'),
  subscriptionModal: document.getElementById('subscription-modal'),
  btnCloseSubModal: document.getElementById('btn-close-sub-modal'),
  btnSubModalFooterClose: document.getElementById('btn-sub-modal-footer-close'),
  subCardBalance: document.getElementById('sub-card-balance'),
  subCardGrossValue: document.getElementById('sub-card-gross-value'),
  subCardBwRate: document.getElementById('sub-card-bw-rate'),
  subCardColorRate: document.getElementById('sub-card-color-rate'),
  subCardTierName: document.getElementById('sub-card-tier-name'),
  subCardBwPages: document.getElementById('sub-card-bw-pages'),
  subCardColorPages: document.getElementById('sub-card-color-pages'),
  subTabBtns: document.querySelectorAll('.sub-tab-btn'),
  subTabContents: document.querySelectorAll('.subtab-content'),
  pkgSelectBtns: document.querySelectorAll('.btn-select-pkg'),
  packageCards: document.querySelectorAll('.package-card'),
  creditCalcSlider: document.getElementById('credit-calc-slider'),
  calcSliderVal: document.getElementById('calc-slider-val'),
  calcResCost: document.getElementById('calc-res-cost'),
  calcResRevenue: document.getElementById('calc-res-revenue'),
  calcResProfit: document.getElementById('calc-res-profit'),
  calcResMargin: document.getElementById('calc-res-margin'),
  calcResBwSheets: document.getElementById('calc-res-bw-sheets'),
  calcResColorSheets: document.getElementById('calc-res-color-sheets'),
  calcResBwPrice: document.getElementById('calc-res-bw-price'),
  calcResColorPrice: document.getElementById('calc-res-color-price'),
  btnCalcApply: document.getElementById('btn-calc-apply'),
  calcCtaText: document.getElementById('calc-cta-text'),
  rechargePkgName: document.getElementById('recharge-pkg-name'),
  rechargePkgCredits: document.getElementById('recharge-pkg-credits'),
  rechargePkgAmount: document.getElementById('recharge-pkg-amount'),
  rechargePayMethodCards: document.querySelectorAll('.pay-method-card'),
  voucherFieldWrap: document.getElementById('voucher-field-wrap'),
  inputVoucherCode: document.getElementById('input-voucher-code'),
  btnApplyVoucher: document.getElementById('btn-apply-voucher'),
  rechargeStatusMsg: document.getElementById('recharge-status-msg'),
  btnSubmitRecharge: document.getElementById('btn-submit-recharge'),
  rechargeSpinner: document.getElementById('recharge-spinner'),
  rechargeBtnText: document.getElementById('recharge-btn-text'),
  ledgerTableBody: document.getElementById('ledger-table-body'),
  btnRefreshLedger: document.getElementById('btn-refresh-ledger'),

  // Job Modal Credit Elements
  modalCreditCost: document.getElementById('modal-credit-cost'),
  modalCreditTakaVal: document.getElementById('modal-credit-taka-val'),
  modalAvailCredits: document.getElementById('modal-avail-credits'),
  modalLowCreditsAlert: document.getElementById('modal-low-credits-alert'),
  modalNeededCredits: document.getElementById('modal-needed-credits'),
  modalCurrentCredits: document.getElementById('modal-current-credits'),
  btnJobModalTopup: document.getElementById('btn-job-modal-topup'),
  metricCreditsBalance: document.getElementById('metric-credits-balance'),

  // Connection Indicator & Server Settings Modal
  authConnDot: document.getElementById('auth-conn-dot'),
  authConnLabel: document.getElementById('auth-conn-label'),
  btnOpenServerModal: document.getElementById('btn-open-server-modal'),
  serverSettingsModal: document.getElementById('server-settings-modal'),
  btnCloseServerModal: document.getElementById('btn-close-server-modal'),
  connModeCloud: document.getElementById('conn-mode-cloud'),
  connModeCustom: document.getElementById('conn-mode-custom'),
  customServerField: document.getElementById('custom-server-field'),
  inputServerUrl: document.getElementById('input-server-url'),
  serverPingResult: document.getElementById('server-ping-result'),
  btnTestServerConnection: document.getElementById('btn-test-server-connection'),
  btnSaveServerSettings: document.getElementById('btn-save-server-settings'),
}

// =============================================================================
// INITIALIZATION
// =============================================================================
async function init() {
  setupClock()
  setupTabNavigation()
  setupOtpKeypad()
  setupWindowControls()
  setupAuthSystem()
  setupAutoUpdaterClient()
  setupServerSettingsModal()
  setupSubscriptionSystem()

  // Load configuration and native printers
  await loadAppConfig()
  updateConnectionBadge()
  await scanSystemPrinters()
  await fetchDevices()
  await fetchRecentJobs()
  await fetchCreditsData()

  // Load account and show correct screen (login, workspace, or lockdown)
  await loadSavedAccount()

  // Periodic heartbeat: check if admin approved, rejected, or suspended
  setInterval(() => {
    if (el.screenPending && !el.screenPending.classList.contains('hidden')) {
      checkApprovalStatus(false)
    } else if (el.screenWorkspace && !el.screenWorkspace.classList.contains('hidden')) {
      checkStationStatus()
    }
  }, 10000)

  // Auto-scan printers when window regains focus (only on workspace, not on login/register)
  window.addEventListener('focus', () => {
    const workspaceActive = el.screenWorkspace && !el.screenWorkspace.classList.contains('hidden')
    if (workspaceActive) {
      scanSystemPrinters()
    }
  })
}

// Digital Clock
function setupClock() {
  const update = () => {
    const now = new Date()
    el.clockDisplay.textContent = now.toLocaleTimeString('en-US', {
      hour: '2-digit',
      minute: '2-digit',
      second: '2-digit',
      hour12: true
    })
  }
  update()
  setInterval(update, 1000)
}

// Window Controls (Electron IPC)
function setupWindowControls() {
  if (isElectron) {
    el.btnWinMin?.addEventListener('click', () => window.quickinkDesktop.minimize())
    el.btnWinMax?.addEventListener('click', () => window.quickinkDesktop.maximize())
    el.btnWinClose?.addEventListener('click', () => window.quickinkDesktop.close())
    el.btnToggleKiosk?.addEventListener('click', () => window.quickinkDesktop.toggleKiosk())
  }
}

// Tab Navigation
function setupTabNavigation() {
  el.navTabs.forEach((tab) => {
    tab.addEventListener('click', () => {
      const targetId = tab.getAttribute('data-tab')
      el.navTabs.forEach((t) => t.classList.remove('active'))
      el.tabPanels.forEach((p) => p.classList.remove('active'))

      tab.classList.add('active')
      document.getElementById(targetId)?.classList.add('active')

      if (targetId === 'tab-keypad') {
        el.otpBoxes[0]?.focus()
      } else if (targetId === 'tab-queue') {
        fetchRecentJobs()
      }
    })
  })
}

// =============================================================================
// AUTO-UPDATER & HOME UPDATE CENTER CLIENT
// =============================================================================
function setupAutoUpdaterClient() {
  // Helper to format timestamp
  const getNowFormattedTime = () => {
    return 'Today at ' + new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })
  }

  // 1. Fetch & display app version on home page and headers
  if (isElectron && window.quickinkDesktop?.getVersion) {
    window.quickinkDesktop.getVersion().then((ver) => {
      if (ver) {
        if (el.homeCurrentVersion) el.homeCurrentVersion.textContent = `v${ver}`
        if (el.homeLatestVersion) el.homeLatestVersion.textContent = `v${ver} (Latest)`
        if (el.homeReleaseTag) el.homeReleaseTag.textContent = `v${ver} Stable`
      }
    }).catch(() => { })
  } else {
    if (el.homeCurrentVersion) el.homeCurrentVersion.textContent = 'v1.0.0'
    if (el.homeLatestVersion) el.homeLatestVersion.textContent = 'v1.0.0 (Web Mode)'
  }

  // Set initial last checked label
  if (el.homeLastCheckedTime) {
    el.homeLastCheckedTime.textContent = 'Last checked: Just now'
  }

  // 2. Dismiss top banner button
  el.btnUpdateDismiss?.addEventListener('click', () => {
    el.updateBanner?.classList.add('hidden')
  })

  // 3. Restart & Update button handlers (Both banner & Home page card)
  const triggerRestartAndInstall = () => {
    if (isElectron && window.quickinkDesktop?.restartForUpdate) {
      window.quickinkDesktop.restartForUpdate()
    } else {
      alert('Application will restart to apply the latest update.')
    }
  }
  el.btnUpdateRestart?.addEventListener('click', triggerRestartAndInstall)
  el.btnHomeRestartUpdate?.addEventListener('click', triggerRestartAndInstall)

  // 4. Interactive "Check for Updates" button on Home Page
  el.btnHomeCheckUpdate?.addEventListener('click', async () => {
    if (el.btnHomeCheckUpdate) {
      el.btnHomeCheckUpdate.disabled = true
      if (el.homeCheckBtnText) el.homeCheckBtnText.textContent = 'Checking...'
      if (el.homeCheckSpinner) el.homeCheckSpinner.classList.remove('hidden')
    }

    if (el.homeUpdateStatusPill) {
      el.homeUpdateStatusPill.innerHTML = '<span class="pill-dot">🔄</span><span>Checking...</span>'
      el.homeUpdateStatusPill.style.borderColor = 'rgba(56, 189, 248, 0.4)'
      el.homeUpdateStatusPill.style.color = '#38bdf8'
    }

    if (el.homeUpdateMsgText) {
      el.homeUpdateMsgText.textContent = 'Querying PrintKoro GitHub releases for updates...'
    }

    try {
      if (isElectron && window.quickinkDesktop?.checkForUpdates) {
        const res = await window.quickinkDesktop.checkForUpdates()
        if (res?.success) {
          if (res.isLatest) {
            if (el.homeUpdateStatusPill) {
              el.homeUpdateStatusPill.innerHTML = '<span class="pill-dot">🟢</span><span>Up to Date</span>'
              el.homeUpdateStatusPill.style.borderColor = 'rgba(16, 185, 129, 0.3)'
              el.homeUpdateStatusPill.style.color = '#34d399'
            }
            if (el.homeUpdateMsgText) {
              el.homeUpdateMsgText.textContent = `PrintKoro Station is up to date (v${res.version || '1.0.0'}). All systems, print spoolers, and credit modules are current.`
            }
            if (el.homeLatestVersion) el.homeLatestVersion.textContent = `v${res.version || '1.0.0'} (Latest)`
          } else {
            if (el.homeUpdateStatusPill) {
              el.homeUpdateStatusPill.innerHTML = '<span class="pill-dot">✨</span><span>Update Available</span>'
              el.homeUpdateStatusPill.style.borderColor = 'rgba(245, 158, 11, 0.5)'
              el.homeUpdateStatusPill.style.color = '#f59e0b'
            }
            if (el.homeLatestVersion) el.homeLatestVersion.textContent = `v${res.version || ''} (New Release)`
            if (el.homeUpdateMsgText) {
              el.homeUpdateMsgText.textContent = `New version v${res.version} found! Background download initiated.`
            }
            if (el.homeUpdateProgressWrap) el.homeUpdateProgressWrap.classList.remove('hidden')
          }
        } else {
          if (el.homeUpdateMsgText) {
            el.homeUpdateMsgText.textContent = res?.error || 'Unable to contact update server. Station is running offline normally.'
          }
        }
      } else {
        // Web preview simulation
        await new Promise(r => setTimeout(r, 700))
        if (el.homeUpdateStatusPill) {
          el.homeUpdateStatusPill.innerHTML = '<span class="pill-dot">🟢</span><span>Up to Date</span>'
          el.homeUpdateStatusPill.style.borderColor = 'rgba(16, 185, 129, 0.3)'
          el.homeUpdateStatusPill.style.color = '#34d399'
        }
        if (el.homeUpdateMsgText) {
          el.homeUpdateMsgText.textContent = 'PrintKoro Station v1.0.0 is current. (Running in Web Preview mode; in production, updates download automatically from GitHub Releases).'
        }
      }

      if (el.homeLastCheckedTime) {
        el.homeLastCheckedTime.textContent = `Last checked: ${getNowFormattedTime()}`
      }
    } catch (e) {
      console.warn('Update check error:', e)
      if (el.homeUpdateMsgText) {
        el.homeUpdateMsgText.textContent = 'Check failed. Please ensure your internet connection is active.'
      }
    } finally {
      setTimeout(() => {
        if (el.btnHomeCheckUpdate) {
          el.btnHomeCheckUpdate.disabled = false
          if (el.homeCheckBtnText) el.homeCheckBtnText.textContent = 'Check for Updates'
          if (el.homeCheckSpinner) el.homeCheckSpinner.classList.add('hidden')
        }
      }, 1000)
    }
  })

  // 5. Listen for updates from Electron main process
  if (isElectron && window.quickinkDesktop?.onUpdateStatus) {
    window.quickinkDesktop.onUpdateStatus((data) => {
      console.log('[Updater Client] Status received:', data)
      const { status } = data

      if (status === 'checking') {
        if (el.homeUpdateStatusPill) {
          el.homeUpdateStatusPill.innerHTML = '<span class="pill-dot">🔄</span><span>Checking...</span>'
          el.homeUpdateStatusPill.style.borderColor = 'rgba(56, 189, 248, 0.4)'
          el.homeUpdateStatusPill.style.color = '#38bdf8'
        }
        if (el.homeUpdateMsgText) {
          el.homeUpdateMsgText.textContent = 'Checking GitHub releases for updates...'
        }
      } else if (status === 'available') {
        if (el.updateBanner) el.updateBanner.classList.remove('hidden')
        if (el.updateBannerTitle) el.updateBannerTitle.textContent = `Update v${data.version || ''} Available`
        if (el.updateBannerDesc) el.updateBannerDesc.textContent = 'Downloading update in background...'
        el.updateProgressContainer?.classList.remove('hidden')
        el.btnUpdateRestart?.classList.add('hidden')

        // Home card updates
        if (el.homeUpdateStatusPill) {
          el.homeUpdateStatusPill.innerHTML = `<span class="pill-dot">✨</span><span>v${data.version || ''} Available</span>`
          el.homeUpdateStatusPill.style.borderColor = 'rgba(245, 158, 11, 0.5)'
          el.homeUpdateStatusPill.style.color = '#f59e0b'
        }
        if (el.homeLatestVersion) el.homeLatestVersion.textContent = `v${data.version || ''} (New Release)`
        if (el.homeUpdateMsgText) {
          el.homeUpdateMsgText.textContent = `Downloading update v${data.version || ''} in the background. You can continue taking print orders safely.`
        }
        if (el.homeUpdateProgressWrap) el.homeUpdateProgressWrap.classList.remove('hidden')
        if (el.btnHomeRestartUpdate) el.btnHomeRestartUpdate.classList.add('hidden')
      } else if (status === 'downloading') {
        const pct = data.percent || 0
        if (el.updateBanner) el.updateBanner.classList.remove('hidden')
        if (el.updateProgressContainer) el.updateProgressContainer.classList.remove('hidden')
        if (el.updateProgressFill) el.updateProgressFill.style.width = `${pct}%`
        if (el.updateBannerDesc) el.updateBannerDesc.textContent = `Downloading update: ${pct}%`

        // Home card progress
        if (el.homeUpdateProgressWrap) el.homeUpdateProgressWrap.classList.remove('hidden')
        if (el.homeDownloadFill) el.homeDownloadFill.style.width = `${pct}%`
        if (el.homeDownloadPercent) el.homeDownloadPercent.textContent = `${pct}%`
        if (el.homeDownloadStatusTxt) el.homeDownloadStatusTxt.textContent = `Downloading update package (${pct}%)...`
        if (el.homeDownloadSpeed && data.bytesPerSecond) {
          const speedMb = (data.bytesPerSecond / (1024 * 1024)).toFixed(1)
          el.homeDownloadSpeed.textContent = `Download Speed: ${speedMb} MB/s`
        }
        if (el.homeDownloadSize && data.transferred && data.total) {
          const transMb = (data.transferred / (1024 * 1024)).toFixed(1)
          const totMb = (data.total / (1024 * 1024)).toFixed(1)
          el.homeDownloadSize.textContent = `${transMb} MB / ${totMb} MB`
        }
      } else if (status === 'downloaded') {
        if (el.updateBanner) el.updateBanner.classList.remove('hidden')
        if (el.updateBannerTitle) el.updateBannerTitle.textContent = `Version ${data.version || ''} Ready`
        if (el.updateBannerDesc) el.updateBannerDesc.textContent = 'Update downloaded! Restart now to complete installation.'
        el.updateProgressContainer?.classList.add('hidden')
        el.btnUpdateRestart?.classList.remove('hidden')

        // Home card ready
        if (el.homeUpdateProgressWrap) el.homeUpdateProgressWrap.classList.add('hidden')
        if (el.homeUpdateStatusPill) {
          el.homeUpdateStatusPill.innerHTML = '<span class="pill-dot">🚀</span><span>Ready to Install</span>'
          el.homeUpdateStatusPill.style.borderColor = 'rgba(16, 185, 129, 0.6)'
          el.homeUpdateStatusPill.style.color = '#34d399'
        }
        if (el.homeUpdateMsgText) {
          el.homeUpdateMsgText.textContent = `Update v${data.version || ''} is downloaded and verified. Click "Restart & Apply" to install in seconds.`
        }
        if (el.btnHomeRestartUpdate) {
          el.btnHomeRestartUpdate.classList.remove('hidden')
          el.btnHomeRestartUpdate.textContent = `🚀 Restart & Apply Update v${data.version || ''}`
        }
        playSuccessChime()
      } else if (status === 'up-to-date') {
        if (el.homeUpdateStatusPill) {
          el.homeUpdateStatusPill.innerHTML = '<span class="pill-dot">🟢</span><span>Up to Date</span>'
        }
        if (el.homeUpdateMsgText) {
          el.homeUpdateMsgText.textContent = `PrintKoro Station is up to date (v${data.version || '1.0.0'}).`
        }
        if (el.homeLastCheckedTime) {
          el.homeLastCheckedTime.textContent = `Last checked: ${getNowFormattedTime()}`
        }
      } else if (status === 'error') {
        console.warn('[Updater UI] Error notice:', data.error)
        if (el.homeUpdateMsgText) {
          el.homeUpdateMsgText.textContent = 'Update check encountered an issue. Station operating normally.'
        }
      }
    })
  }
}

// Load App Configuration
async function loadAppConfig() {
  if (isElectron) {
    try {
      const cfg = await window.quickinkDesktop.getConfig()
      if (cfg) {
        state.config = { ...state.config, ...cfg }
        if (cfg.deviceId && el.stationSelect) {
          el.stationSelect.value = cfg.deviceId
        }
      }
    } catch (err) {
      console.warn('Failed to load desktop config:', err)
    }
  }

  if (el.stationSelect) {
    el.stationSelect.addEventListener('change', async () => {
      state.config.deviceId = el.stationSelect.value
      if (isElectron) {
        await window.quickinkDesktop.saveConfig({ deviceId: state.config.deviceId })
      }
      fetchRecentJobs()
    })
  }
}

// Server & Cloud Network Settings Modal
function setupServerSettingsModal() {
  if (!el.btnOpenServerModal || !el.serverSettingsModal) return

  const openModal = () => {
    const currentUrl = state.config.apiBaseUrl?.trim() || ''
    if (currentUrl) {
      if (el.connModeCustom) el.connModeCustom.checked = true
      if (el.customServerField) el.customServerField.classList.remove('hidden')
      if (el.inputServerUrl) el.inputServerUrl.value = currentUrl
    } else {
      if (el.connModeCloud) el.connModeCloud.checked = true
      if (el.customServerField) el.customServerField.classList.add('hidden')
      if (el.inputServerUrl) el.inputServerUrl.value = ''
    }
    if (el.serverPingResult) el.serverPingResult.innerHTML = ''
    el.serverSettingsModal.classList.remove('hidden')
  }

  const closeModal = () => {
    el.serverSettingsModal.classList.add('hidden')
  }

  el.btnOpenServerModal.addEventListener('click', openModal)
  el.btnCloseServerModal?.addEventListener('click', closeModal)
  el.serverSettingsModal.addEventListener('click', (e) => {
    if (e.target === el.serverSettingsModal) closeModal()
  })

  el.connModeCloud?.addEventListener('change', () => {
    if (el.customServerField) el.customServerField.classList.add('hidden')
  })

  el.connModeCustom?.addEventListener('change', () => {
    if (el.customServerField) {
      el.customServerField.classList.remove('hidden')
      if (el.inputServerUrl && !el.inputServerUrl.value) {
        el.inputServerUrl.value = 'http://localhost:3000'
      }
      el.inputServerUrl?.focus()
    }
  })

  el.btnTestServerConnection?.addEventListener('click', async () => {
    if (!el.serverPingResult) return
    el.serverPingResult.innerHTML = '<span style="color: #38bdf8;">Testing connection...</span>'
    const isCloud = el.connModeCloud?.checked

    if (isCloud) {
      try {
        const res = await QuickInkCloud.rest('devices?limit=1')
        if (res.ok) {
          el.serverPingResult.innerHTML = '<span style="color: #4ade80;">✓ PrintKoro Cloud is online & accessible!</span>'
        } else {
          el.serverPingResult.innerHTML = `<span style="color: #f87171;">✗ Cloud returned HTTP ${res.status}</span>`
        }
      } catch (err) {
        el.serverPingResult.innerHTML = `<span style="color: #f87171;">✗ Connection failed: ${err.message}</span>`
      }
    } else {
      const url = el.inputServerUrl?.value?.trim()
      if (!url) {
        el.serverPingResult.innerHTML = '<span style="color: #f87171;">Please enter a server URL</span>'
        return
      }
      try {
        const controller = new AbortController()
        const timer = setTimeout(() => controller.abort(), 4000)
        const res = await fetch(`${url}/api/desktop/devices`, { signal: controller.signal })
        clearTimeout(timer)
        if (res.ok) {
          el.serverPingResult.innerHTML = '<span style="color: #4ade80;">✓ Server responded successfully!</span>'
        } else {
          el.serverPingResult.innerHTML = `<span style="color: #f87171;">✗ Server returned HTTP ${res.status}</span>`
        }
      } catch (err) {
        el.serverPingResult.innerHTML = `<span style="color: #f87171;">✗ Failed to connect to ${url} (${err.message})</span>`
      }
    }
  })

  el.btnSaveServerSettings?.addEventListener('click', async () => {
    const isCloud = el.connModeCloud?.checked
    const newBaseUrl = isCloud ? '' : (el.inputServerUrl?.value?.trim() || '')

    state.config.apiBaseUrl = newBaseUrl
    if (isElectron) {
      await window.quickinkDesktop.saveConfig({ apiBaseUrl: newBaseUrl })
    }
    updateConnectionBadge()
    closeModal()
    fetchDevices()
    fetchRecentJobs()
  })
}

// Scan Installed System Printers via Electron IPC
async function scanSystemPrinters() {
  // Don't disrupt the user while they are typing in login or registration screens
  const activeEl = document.activeElement
  const isTypingInInput = activeEl && (activeEl.tagName === 'INPUT' || activeEl.tagName === 'TEXTAREA')
  if (isTypingInInput) return

  el.selectBwPrinter.innerHTML = '<option value="">Scanning installed printers...</option>'
  el.selectColorPrinter.innerHTML = '<option value="">Scanning installed printers...</option>'

  let printers = []
  if (isElectron) {
    try {
      const res = await window.quickinkDesktop.getPrinters()
      if (res.success && res.printers) {
        printers = res.printers
      }
    } catch (e) {
      console.error('Error scanning printers:', e)
    }
  }

  if (printers.length === 0) {
    el.selectBwPrinter.innerHTML = '<option value="">No printers detected on PC. Connect via USB or Wi-Fi</option>'
    el.selectColorPrinter.innerHTML = '<option value="">No printers detected on PC. Connect via USB or Wi-Fi</option>'
    el.stripBwName.textContent = 'None detected'
    el.stripColorName.textContent = 'None detected'
    const badge = document.getElementById('printers-badge-pill')
    if (badge) badge.textContent = '0 Detected'
    return
  }

  const isVirtual = (name) => /pdf|xps|onenote|fax/i.test(name)
  printers.sort((a, b) => {
    const aV = isVirtual(a.name) ? 1 : 0
    const bV = isVirtual(b.name) ? 1 : 0
    return aV - bV
  })

  state.systemPrinters = printers

  const badge = document.getElementById('printers-badge-pill')
  if (badge) badge.textContent = `${printers.length} Detected`

  el.selectBwPrinter.innerHTML = printers
    .map((p) => `<option value="${p.name}">${p.displayName || p.name} ${!isVirtual(p.name) ? '🖨️ (Hardware)' : ''}</option>`)
    .join('')

  el.selectColorPrinter.innerHTML = printers
    .map((p) => `<option value="${p.name}">${p.displayName || p.name} ${!isVirtual(p.name) ? '🎨 (Hardware)' : ''}</option>`)
    .join('')

  const physicalPrinters = printers.filter((p) => !isVirtual(p.name))
  const bestHardwarePrinter = physicalPrinters[0]?.name || printers[0]?.name || ''

  if (state.config.bwPrinterName && printers.some((p) => p.name === state.config.bwPrinterName)) {
    el.selectBwPrinter.value = state.config.bwPrinterName
  } else if (bestHardwarePrinter) {
    el.selectBwPrinter.value = bestHardwarePrinter
    state.config.bwPrinterName = bestHardwarePrinter
  }

  if (state.config.colorPrinterName && printers.some((p) => p.name === state.config.colorPrinterName)) {
    el.selectColorPrinter.value = state.config.colorPrinterName
  } else if (physicalPrinters.length > 1) {
    el.selectColorPrinter.value = physicalPrinters[1].name
    state.config.colorPrinterName = physicalPrinters[1].name
  } else if (bestHardwarePrinter) {
    el.selectColorPrinter.value = bestHardwarePrinter
    state.config.colorPrinterName = bestHardwarePrinter
  }

  updateHardwareStrip()
}

function updateHardwareStrip() {
  el.stripBwName.textContent = state.config.bwPrinterName || 'Not Selected'
  el.stripColorName.textContent = state.config.colorPrinterName || 'Not Selected'
}

// Test Print Actions
el.btnTestBw?.addEventListener('click', async () => {
  const printerName = el.selectBwPrinter.value
  if (!printerName) return alert('Please select a B&W printer first.')
  el.btnTestBw.textContent = 'Printing B&W Test...'

  if (isElectron) {
    const res = await window.quickinkDesktop.testPrint(printerName, 'bw')
    alert(res.message || res.error)
  } else {
    setTimeout(() => alert(`[Test Print] Simulated B&W test page sent to ${printerName}`), 600)
  }
  el.btnTestBw.textContent = 'Send Test Page (B&W)'
})

el.btnTestColor?.addEventListener('click', async () => {
  const printerName = el.selectColorPrinter.value
  if (!printerName) return alert('Please select a Color printer first.')
  el.btnTestColor.textContent = 'Printing Color Test...'

  if (isElectron) {
    const res = await window.quickinkDesktop.testPrint(printerName, 'color')
    alert(res.message || res.error)
  } else {
    setTimeout(() => alert(`[Test Print] Simulated Color test page sent to ${printerName}`), 600)
  }
  el.btnTestColor.textContent = 'Send Test Page (Color)'
})

el.btnSavePrinters?.addEventListener('click', async () => {
  state.config.bwPrinterName = el.selectBwPrinter.value
  state.config.colorPrinterName = el.selectColorPrinter.value

  if (isElectron) {
    await window.quickinkDesktop.saveConfig({
      bwPrinterName: state.config.bwPrinterName,
      colorPrinterName: state.config.colorPrinterName
    })
  }

  updateHardwareStrip()
  el.savePrintersStatus.textContent = '✓ Preferences saved successfully!'
  setTimeout(() => {
    el.savePrintersStatus.textContent = ''
  }, 3000)
})

el.btnRefreshPrinters?.addEventListener('click', scanSystemPrinters)

// =============================================================================
// OTP KEYPAD & INPUT BEHAVIOR
// =============================================================================
function setupOtpKeypad() {
  el.otpBoxes.forEach((box, idx) => {
    box.addEventListener('input', (e) => {
      const val = e.target.value.replace(/[^0-9]/g, '')
      e.target.value = val

      if (val.length === 1) {
        box.classList.add('filled')
        if (idx < 5) el.otpBoxes[idx + 1].focus()
      } else {
        box.classList.remove('filled')
      }

      clearOtpStatus()
      if (getEnteredOtp().length === 6) verifyAndFetchJob()
    })

    box.addEventListener('keydown', (e) => {
      if (e.key === 'Backspace' && !box.value && idx > 0) {
        el.otpBoxes[idx - 1].focus()
      } else if (e.key === 'Enter' && getEnteredOtp().length === 6) {
        verifyAndFetchJob()
      }
    })
  })

  // Touch Numpad buttons
  el.numpadBtns.forEach((btn) => {
    btn.addEventListener('click', () => {
      const val = btn.getAttribute('data-val')
      const emptyBox = el.otpBoxes.find((b) => !b.value)
      if (emptyBox) {
        emptyBox.value = val
        emptyBox.classList.add('filled')
        const nextIdx = el.otpBoxes.indexOf(emptyBox) + 1
        if (nextIdx < 6) el.otpBoxes[nextIdx].focus()
      }
      clearOtpStatus()
      if (getEnteredOtp().length === 6) verifyAndFetchJob()
    })
  })

  el.btnClearOtp?.addEventListener('click', clearOtpInputs)
  el.btnBackspaceOtp?.addEventListener('click', () => {
    const filledBoxes = el.otpBoxes.filter((b) => b.value)
    if (filledBoxes.length > 0) {
      const last = filledBoxes[filledBoxes.length - 1]
      last.value = ''
      last.classList.remove('filled')
      last.focus()
    }
    clearOtpStatus()
  })

  el.btnVerifyOtp?.addEventListener('click', verifyAndFetchJob)
}

function getEnteredOtp() {
  return el.otpBoxes.map((b) => b.value).join('')
}

function clearOtpInputs() {
  el.otpBoxes.forEach((b) => {
    b.value = ''
    b.classList.remove('filled')
  })
  el.otpBoxes[0]?.focus()
  clearOtpStatus()
}

function showOtpStatus(msg, isError = false) {
  el.otpStatusMsg.textContent = msg
  el.otpStatusMsg.className = `status-msg-box ${isError ? 'error' : 'success'}`
}

function clearOtpStatus() {
  el.otpStatusMsg.textContent = ''
  el.otpStatusMsg.className = 'status-msg-box hidden'
}

// =============================================================================
// VERIFY & FETCH JOB DETAILS
// =============================================================================
async function verifyAndFetchJob() {
  const code = getEnteredOtp()
  if (code.length !== 6) {
    showOtpStatus('Please enter all 6 numerical digits', true)
    return
  }

  el.verifySpinner.classList.remove('hidden')
  el.verifyBtnText.textContent = 'Verifying with PrintKoro Server...'
  el.btnVerifyOtp.disabled = true

  try {
    const { ok, data } = await apiPost(
      '/api/desktop/redeem',
      { code, deviceId: state.config.deviceId },
      () => QuickInkCloud.redeemOtp(code, state.config.deviceId)
    )

    if (!ok || !data?.success) {
      throw new Error(data?.error || 'Invalid OTP code')
    }

    state.activeJob = data
    openJobModal(data)
    playSuccessChime()
  } catch (err) {
    showOtpStatus(err.message, true)
  } finally {
    el.verifySpinner.classList.add('hidden')
    el.verifyBtnText.textContent = 'Verify & Fetch Print Job'
    el.btnVerifyOtp.disabled = false
  }
}

// =============================================================================
// JOB MODAL & DISPATCH TO HARDWARE
// =============================================================================
function openJobModal(jobData) {
  const job = jobData?.data?.print_job || jobData?.print_job || {}
  const isColor = job.color_mode === 'color'
  const isDuplex = Boolean(job.duplex === true || job.duplex === 'duplex' || job.duplex === 'true' || job.duplex === 'duplexlong')

  const rawUrlOrPath = job.file_url || job.file_path || ''
  let rangeFromUrl = null
  let nupFromUrl = 1
  let borderFromUrl = false

  if (rawUrlOrPath.includes('#')) {
    try {
      const hashStr = rawUrlOrPath.split('#')[1] || ''
      const parts = hashStr.split('&')
      for (const part of parts) {
        const [k, v] = part.split('=')
        if (k === 'range' && v) rangeFromUrl = decodeURIComponent(v)
        else if (k === 'nup' && v) nupFromUrl = parseInt(v, 10) || 1
        else if (k === 'border') borderFromUrl = v === '1' || v === 'true'
      }
    } catch (e) {}
  }

  const effectiveRange = job.page_range || rangeFromUrl || null
  const effectiveNup = job.pages_per_sheet || nupFromUrl || 1
  const effectiveBorder = Boolean(job.mini_border ?? borderFromUrl)

  el.modalDocTitle.textContent = job.file_name || 'Customer_Document.pdf'
  el.modalOtp.textContent = jobData?.data?.otp?.code || jobData?.otp?.code || getEnteredOtp()
  el.modalColorMode.textContent = isColor ? 'Full Color' : 'Black & White'
  const rangeNotice = effectiveRange ? ` (Range: ${effectiveRange})` : ''
  const miniNotice = effectiveNup > 1 ? ` · ${effectiveNup}-in-1 Mini Print` : ''
  el.modalPagesCopies.textContent = `${job.page_count || 1} sheet(s)${rangeNotice}${miniNotice} × ${job.copies || 1} copy`
  el.modalDuplex.textContent = isDuplex ? 'Double-Sided (Duplex)' : 'Single-Sided'

  const targetPrinter = isColor ? state.config.colorPrinterName : state.config.bwPrinterName
  el.modalRoutedPrinter.textContent = targetPrinter ? `${targetPrinter} (${isColor ? 'Color' : 'B&W'})` : 'Hardware default'

  const amountToPay = jobData?.data?.amount || job.amount || ((job.page_count || 1) * (isColor ? 8.0 : 2.0) * (job.copies || 1)).toFixed(2)

  if (job.payment_type === 'counter_cash' || job.payment_type === 'cash') {
    el.modalPaymentAlert.className = 'payment-alert cash'
    el.modalPayHeading.textContent = 'Collect Cash at Counter'
    el.modalPayInstruction.innerHTML = `Please collect <strong id="modal-pay-amount">৳${amountToPay}</strong> from customer before confirming print.`
  } else {
    el.modalPaymentAlert.className = 'payment-alert online'
    el.modalPayHeading.textContent = 'Payment Completed Online'
    el.modalPayInstruction.innerHTML = 'Customer paid digitally via bKash/Nagad/Card. You can release print directly.'
  }

  // Wholesale credit cost calculation (1 Credit = ৳1 gross print value)
  // Dynamic pricing tier assigned in admin side is authoritatively respected!
  const zoneTier = jobData?.data?.zone || state.pricingTier || {}
  const zoneRate = isColor ? Number(zoneTier.color_price ?? 8.0) : Number(zoneTier.bw_price ?? 2.0)
  const creditCost = Math.round((job.page_count || 1) * (job.copies || 1) * zoneRate * 100) / 100

  if (el.modalCreditCost) el.modalCreditCost.textContent = `${creditCost} Credits`
  if (el.modalCreditTakaVal) el.modalCreditTakaVal.textContent = `৳${creditCost.toFixed(2)}`
  if (el.modalAvailCredits) el.modalAvailCredits.textContent = (state.creditsBalance || 0).toLocaleString()

  if (state.creditsBalance < creditCost) {
    if (el.modalLowCreditsAlert) {
      el.modalLowCreditsAlert.classList.remove('hidden')
      if (el.modalNeededCredits) el.modalNeededCredits.textContent = creditCost
      if (el.modalCurrentCredits) el.modalCurrentCredits.textContent = (state.creditsBalance || 0).toLocaleString()
    }
  } else {
    if (el.modalLowCreditsAlert) el.modalLowCreditsAlert.classList.add('hidden')
  }

  el.spoolingPanel.classList.add('hidden')
  el.btnReleasePrint.disabled = false
  el.jobModal.classList.remove('hidden')
}

el.btnCloseModal?.addEventListener('click', closeJobModal)
el.btnCancelJob?.addEventListener('click', closeJobModal)

function closeJobModal() {
  el.jobModal.classList.add('hidden')
  state.activeJob = null
  clearOtpInputs()
}

// Hardware Spooling Execution & Safe Print Credit Rule
el.btnReleasePrint?.addEventListener('click', async () => {
  if (!state.activeJob) return

  el.btnReleasePrint.disabled = true
  el.spoolingPanel.classList.remove('hidden')
  el.spoolingStepLabel.textContent = 'Downloading customer document from cloud...'
  el.spoolingPercentage.textContent = '25%'
  el.spoolingProgressBar.style.width = '25%'

  const job = state.activeJob?.data?.print_job || state.activeJob?.print_job || {}
  const isColor = job.color_mode === 'color'
  const isDuplex = Boolean(job.duplex === true || job.duplex === 'duplex' || job.duplex === 'true' || job.duplex === 'duplexlong')
  const chosenPrinter = isColor ? state.config.colorPrinterName : state.config.bwPrinterName
  const fileToPrint = job.file_url || job.file_path

  const rawUrlOrPath = job.file_url || job.file_path || ''
  let rangeFromUrl = null
  let nupFromUrl = 1
  let borderFromUrl = false

  if (rawUrlOrPath.includes('#')) {
    try {
      const hashStr = rawUrlOrPath.split('#')[1] || ''
      const parts = hashStr.split('&')
      for (const part of parts) {
        const [k, v] = part.split('=')
        if (k === 'range' && v) rangeFromUrl = decodeURIComponent(v)
        else if (k === 'nup' && v) nupFromUrl = parseInt(v, 10) || 1
        else if (k === 'border') borderFromUrl = v === '1' || v === 'true'
      }
    } catch (e) {}
  }

  const effectiveRange = job.page_range || rangeFromUrl || null
  const effectiveNup = job.pages_per_sheet || nupFromUrl || 1
  const effectiveBorder = Boolean(job.mini_border ?? borderFromUrl)

  try {
    await new Promise((r) => setTimeout(r, 600))
    el.spoolingStepLabel.textContent = `Rendering pages & routing to ${chosenPrinter || 'hardware'}...`
    el.spoolingPercentage.textContent = '65%'
    el.spoolingProgressBar.style.width = '65%'

    if (isElectron) {
      const printResult = await window.quickinkDesktop.printJob({
        fileUrl: fileToPrint,
        printerName: chosenPrinter,
        color: isColor,
        duplex: isDuplex,
        copies: job.copies || 1,
        pageRange: effectiveRange,
        pagesPerSheet: effectiveNup,
        miniBorder: effectiveBorder
      })

      if (!printResult.success) {
        throw new Error(printResult.error || 'Printer communication error')
      }
    }

    // SAFE PRINT RULE: Deduct credits ONLY after physical paper prints successfully!
    const jobId = job.id || state.activeJob?.data?.print_job?.id
    if (jobId && state.config.deviceId) {
      try {
        const { data: completeRes } = await apiPost(
          '/api/desktop/jobs/complete',
          { jobId, deviceId: state.config.deviceId, hardwareSuccess: true },
          () => QuickInkCloud.confirmPrintAndDeductCredits(jobId, state.config.deviceId, true)
        )
        if (completeRes?.newBalance !== undefined) {
          state.creditsBalance = Number(completeRes.newBalance)
          updateHeaderCreditBadge()
        }
      } catch (deductErr) {
        console.warn('Post-print completion sync note:', deductErr)
      }
    }

    el.spoolingStepLabel.textContent = 'Sent to hardware spooler successfully!'
    el.spoolingPercentage.textContent = '100%'
    el.spoolingProgressBar.style.width = '100%'
    playSuccessChime()

    setTimeout(() => {
      closeJobModal()
      fetchRecentJobs()
      fetchCreditsData()
    }, 1200)
  } catch (err) {
    el.spoolingPanel.classList.add('hidden')

    // SAFE PRINT RULE: If hardware execution fails, notify backend with hardwareSuccess=false, ZERO credits cut!
    const jobId = job.id || state.activeJob?.data?.print_job?.id
    if (jobId && state.config.deviceId) {
      apiPost(
        '/api/desktop/jobs/complete',
        { jobId, deviceId: state.config.deviceId, hardwareSuccess: false, failureReason: err.message },
        () => QuickInkCloud.confirmPrintAndDeductCredits(jobId, state.config.deviceId, false, err.message)
      ).catch(() => {})
    }

    alert(`Print Execution Notice: ${err.message}\n\n🛡️ Safe-Print Zero-Risk Guarantee: Zero credits were deducted from your balance because the print did not complete successfully.`)
    el.btnReleasePrint.disabled = false
  }
})

// =============================================================================
// RECENT JOBS & AUDIT LOGS
// =============================================================================
async function fetchRecentJobs() {
  try {
    const { data } = await apiGet(
      `/api/desktop/jobs?deviceId=${state.config.deviceId}`,
      () => QuickInkCloud.fetchJobs(state.config.deviceId)
    )
    if (data?.jobs) {
      state.recentJobs = data.jobs
      renderJobsTable(data.jobs)
      computeStats(data.jobs)
    }
  } catch (err) {
    console.warn('Could not fetch jobs:', err)
  }
}

function renderJobsTable(jobs) {
  if (!el.jobsTableBody) return
  if (!jobs || jobs.length === 0) {
    el.jobsTableBody.innerHTML = '<tr><td colspan="9" class="empty-state">No print jobs processed yet today.</td></tr>'
    return
  }

  const query = (el.queueSearch?.value || '').toLowerCase().trim()
  const filtered = jobs.filter(
    (j) => !query || (j.otp_code && j.otp_code.includes(query)) || (j.file_name && j.file_name.toLowerCase().includes(query))
  )

  el.jobsTableBody.innerHTML = filtered
    .map((j) => {
      const isColor = j.color_mode === 'color'
      const timeStr = j.created_at ? new Date(j.created_at).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }) : '—'
      const amount = j.amount || (isColor ? (j.page_count || 1) * (j.copies || 1) * 8 : (j.page_count || 1) * (j.copies || 1) * 2)

      return `
        <tr>
          <td>${timeStr}</td>
          <td><strong style="color: var(--primary); font-family: monospace; font-size: 14px;">${j.otp_code || '—'}</strong></td>
          <td>${j.file_name || 'Document.pdf'}</td>
          <td><span class="tag ${isColor ? 'color' : 'bw'}">${isColor ? 'Color' : 'B&W'}</span></td>
          <td>${j.duplex ? 'Duplex' : 'Single'}</td>
          <td>${j.page_count || 1}p × ${j.copies || 1}</td>
          <td><strong>৳${amount}</strong></td>
          <td>${j.payment_type === 'online' ? '<span style="color: #10b981;">Online</span>' : '<span style="color: #f59e0b;">Cash</span>'}</td>
          <td><span class="status-pill green">${j.status === 'completed' ? 'Printed' : 'Ready'}</span></td>
        </tr>
      `
    })
    .join('')
}

el.queueSearch?.addEventListener('input', () => renderJobsTable(state.recentJobs))

// Compute daily revenue & 100% shop earnings (SaaS subscription model)
function computeStats(jobs) {
  let bwSheets = 0
  let colorSheets = 0
  let totalRevenue = 0

  jobs.forEach((j) => {
    const pages = (j.page_count || 1) * (j.copies || 1)
    if (j.color_mode === 'color') {
      colorSheets += pages
      totalRevenue += pages * 8.0
    } else {
      bwSheets += pages
      totalRevenue += pages * 2.0
    }
  })

  // Under SaaS subscription model, shop owner keeps 100% of print revenue
  const shopEarnings = totalRevenue

  if (el.metricTotalJobs) el.metricTotalJobs.textContent = jobs.length
  if (el.metricBwSheets) el.metricBwSheets.textContent = bwSheets
  if (el.metricColorSheets) el.metricColorSheets.textContent = colorSheets
  if (el.metricPartnerCommission) el.metricPartnerCommission.textContent = `৳${shopEarnings.toFixed(2)}`

  if (el.miniStatJobs) el.miniStatJobs.textContent = jobs.length
  if (el.miniStatPages) el.miniStatPages.textContent = bwSheets + colorSheets
  if (el.miniStatCommission) el.miniStatCommission.textContent = `৳${shopEarnings.toFixed(2)}`
}

// Fetch devices list for Station Selector
async function fetchDevices() {
  if (!el.stationSelect) return
  try {
    const { data } = await apiGet(
      '/api/desktop/devices',
      () => QuickInkCloud.fetchDevices()
    )
    if (data?.devices && data.devices.length > 0) {
      el.stationSelect.innerHTML = data.devices
        .map((d) => `<option value="${d.id}">${d.name}</option>`)
        .join('')

      if (state.config.deviceId) {
        el.stationSelect.value = state.config.deviceId
      }
    }
  } catch (err) {
    console.warn('Could not fetch devices:', err)
  }
}

// =============================================================================
// WHOLESALE CREDIT SUBSCRIPTION, TOP-UP & ESTIMATOR SYSTEM
// =============================================================================
function setupSubscriptionSystem() {
  // 1. Open / Close Subscription Modal
  el.btnOpenSubscriptions?.addEventListener('click', () => openSubscriptionModal('subtab-packages'))
  el.btnCloseSubModal?.addEventListener('click', closeSubscriptionModal)
  el.btnSubModalFooterClose?.addEventListener('click', closeSubscriptionModal)
  el.btnAccountOpenSub?.addEventListener('click', () => {
    el.accountModal?.classList.add('hidden')
    openSubscriptionModal('subtab-packages')
  })
  el.btnJobModalTopup?.addEventListener('click', () => {
    el.jobModal?.classList.add('hidden')
    openSubscriptionModal('subtab-recharge')
  })

  // 2. SubTab Switcher
  el.subTabBtns?.forEach((btn) => {
    btn.addEventListener('click', () => {
      const targetTab = btn.getAttribute('data-subtab')
      switchSubTab(targetTab)
    })
  })

  // 3. Package Select Buttons
  el.pkgSelectBtns?.forEach((btn) => {
    btn.addEventListener('click', () => {
      const pkgId = btn.getAttribute('data-pkg')
      selectCreditPackage(pkgId)
    })
  })

  // 4. Interactive Range Slider for Profit & Page Capacity Calculator
  el.creditCalcSlider?.addEventListener('input', (e) => {
    updateCalculator(e.target.value)
  })

  // 5. Apply Calculator amount to recharge
  el.btnCalcApply?.addEventListener('click', () => {
    const customCredits = Number(el.creditCalcSlider?.value || 25000)
    const cost = Math.round(customCredits * 0.02)
    state.selectedPackage = {
      id: 'pkg_custom',
      name: `Custom Recharge (${customCredits.toLocaleString()} Credits)`,
      credits: customCredits,
      price_taka: cost,
    }
    if (el.rechargePkgName) el.rechargePkgName.textContent = state.selectedPackage.name
    if (el.rechargePkgCredits) el.rechargePkgCredits.textContent = `+${customCredits.toLocaleString()} Credits`
    if (el.rechargePkgAmount) el.rechargePkgAmount.textContent = `৳${cost.toFixed(2)}`
    if (el.rechargeBtnText) el.rechargeBtnText.textContent = `Confirm Top-Up & Activate ${customCredits.toLocaleString()} Credits (৳${cost}) →`
    switchSubTab('subtab-recharge')
  })

  // 6. Recharge Payment Method Card Radio Toggles
  el.rechargePayMethodCards?.forEach((card) => {
    card.addEventListener('click', () => {
      el.rechargePayMethodCards.forEach((c) => c.classList.remove('active'))
      card.classList.add('active')
      const input = card.querySelector('input')
      if (input) {
        input.checked = true
        if (input.value === 'voucher') {
          el.voucherFieldWrap?.classList.remove('hidden')
        } else {
          el.voucherFieldWrap?.classList.add('hidden')
        }
      }
    })
  })

  // 7. Voucher Code Application
  el.btnApplyVoucher?.addEventListener('click', () => {
    const code = el.inputVoucherCode?.value?.trim()
    if (!code) return alert('Please enter a valid voucher or promo code.')
    alert(`Voucher "${code}" applied successfully! Proceed to confirm top-up.`)
  })

  // 8. Submit Recharge / Payment
  el.btnSubmitRecharge?.addEventListener('click', submitRecharge)

  // 9. Refresh Transaction Ledger
  el.btnRefreshLedger?.addEventListener('click', () => {
    fetchCreditsData()
  })

  // Initial calculator sync (Default: 25,000 credits for 500 taka)
  updateCalculator(25000)
}

function updateHeaderCreditBadge() {
  const bal = Number(state.creditsBalance || 0)
  if (el.headerCreditAmount) el.headerCreditAmount.textContent = bal.toLocaleString()
  if (el.modalAccountCredits) el.modalAccountCredits.textContent = bal.toLocaleString()
  if (el.metricCreditsBalance) el.metricCreditsBalance.textContent = bal.toLocaleString()
}

async function fetchCreditsData() {
  const devId = state.config.deviceId || state.account?.deviceId || '11111111-1111-1111-1111-111111111111'
  if (!devId) return

  try {
    const { data } = await apiGet(
      `/api/desktop/credits?deviceId=${devId}`,
      () => QuickInkCloud.fetchCredits(devId)
    )

    if (data?.success) {
      state.creditsBalance = Number(data.creditsBalance ?? 10000)
      if (data.tier) {
        state.pricingTier = data.tier
      }
      state.creditTransactions = data.transactions || []

      updateHeaderCreditBadge()

      if (el.subCardBalance) el.subCardBalance.textContent = state.creditsBalance.toLocaleString()
      if (el.subCardGrossValue) el.subCardGrossValue.textContent = state.creditsBalance.toLocaleString()

      const bwRate = Number(state.pricingTier.bw_price || 2.0).toFixed(2)
      const colorRate = Number(state.pricingTier.color_price || 8.0).toFixed(2)

      if (el.subCardBwRate) el.subCardBwRate.textContent = `৳${bwRate}`
      if (el.subCardColorRate) el.subCardColorRate.textContent = `৳${colorRate}`
      if (el.subCardTierName) el.subCardTierName.textContent = state.pricingTier.name || 'Standard'

      const bwPages = Number(state.pricingTier.bw_price) > 0 ? Math.floor(state.creditsBalance / Number(state.pricingTier.bw_price)) : state.creditsBalance
      const colorPages = Number(state.pricingTier.color_price) > 0 ? Math.floor(state.creditsBalance / Number(state.pricingTier.color_price)) : state.creditsBalance

      if (el.subCardBwPages) el.subCardBwPages.textContent = bwPages.toLocaleString()
      if (el.subCardColorPages) el.subCardColorPages.textContent = colorPages.toLocaleString()

      updateCalculator(Number(el.creditCalcSlider?.value || 25000))
      renderLedgerTable(state.creditTransactions)
    }
  } catch (err) {
    console.warn('Could not fetch credit data:', err)
  }
}

function openSubscriptionModal(initialTab = 'subtab-packages') {
  el.subscriptionModal?.classList.remove('hidden')
  switchSubTab(initialTab)
  fetchCreditsData()
}

function closeSubscriptionModal() {
  el.subscriptionModal?.classList.add('hidden')
}

function switchSubTab(targetTabId) {
  el.subTabBtns?.forEach((b) => {
    if (b.getAttribute('data-subtab') === targetTabId) {
      b.classList.add('active')
    } else {
      b.classList.remove('active')
    }
  })

  el.subTabContents?.forEach((c) => {
    if (c.id === targetTabId) {
      c.classList.add('active')
    } else {
      c.classList.remove('active')
    }
  })
}

function selectCreditPackage(pkgId) {
  const pkg = CREDIT_PACKAGES.find((p) => p.id === pkgId)
  if (!pkg) return
  state.selectedPackage = pkg

  if (el.rechargePkgName) el.rechargePkgName.textContent = pkg.name
  if (el.rechargePkgCredits) el.rechargePkgCredits.textContent = `+${pkg.credits.toLocaleString()} Credits`
  if (el.rechargePkgAmount) el.rechargePkgAmount.textContent = `৳${pkg.price_taka.toFixed(2)}`
  if (el.rechargeBtnText) el.rechargeBtnText.textContent = `Confirm Top-Up & Activate ${pkg.credits.toLocaleString()} Credits (৳${pkg.price_taka}) →`

  switchSubTab('subtab-recharge')
}

function updateCalculator(credits) {
  const numCredits = Number(credits) || 25000
  // Wholesale ratio: 25,000 credits = 500 taka (0.02 taka per credit)
  const wholesaleCost = Math.round(numCredits * 0.02)
  const grossRevenue = numCredits // 1 credit = 1 taka print value
  const netProfit = grossRevenue - wholesaleCost
  const marginPercent = ((netProfit / grossRevenue) * 100).toFixed(1)

  const bwRate = Number(state.pricingTier?.bw_price || 2.0)
  const colorRate = Number(state.pricingTier?.color_price || 8.0)

  const bwSheets = bwRate > 0 ? Math.floor(numCredits / bwRate) : numCredits
  const colorSheets = colorRate > 0 ? Math.floor(numCredits / colorRate) : numCredits

  if (el.calcSliderVal) el.calcSliderVal.textContent = numCredits.toLocaleString()
  if (el.calcResCost) el.calcResCost.textContent = `৳${wholesaleCost.toLocaleString()}`
  if (el.calcResRevenue) el.calcResRevenue.textContent = `৳${grossRevenue.toLocaleString()}`
  if (el.calcResProfit) el.calcResProfit.textContent = `৳${netProfit.toLocaleString()}`
  if (el.calcResMargin) el.calcResMargin.textContent = `${marginPercent}%`

  if (el.calcResBwSheets) el.calcResBwSheets.textContent = bwSheets.toLocaleString()
  if (el.calcResColorSheets) el.calcResColorSheets.textContent = colorSheets.toLocaleString()
  if (el.calcResBwPrice) el.calcResBwPrice.textContent = bwRate.toFixed(2)
  if (el.calcResColorPrice) el.calcResColorPrice.textContent = colorRate.toFixed(2)

  if (el.calcCtaText) el.calcCtaText.textContent = `${numCredits.toLocaleString()} Credits for ৳${wholesaleCost}`
}

async function submitRecharge() {
  if (!state.selectedPackage) {
    state.selectedPackage = CREDIT_PACKAGES[1] // Default: 25000 for 500
  }

  const devId = state.config.deviceId || state.account?.deviceId || '11111111-1111-1111-1111-111111111111'
  const methodInput = document.querySelector('input[name="rechargeMethod"]:checked')
  const method = methodInput ? methodInput.value : 'bkash'
  const voucherCode = el.inputVoucherCode?.value?.trim() || null

  el.btnSubmitRecharge.disabled = true
  el.rechargeSpinner?.classList.remove('hidden')
  el.rechargeBtnText.textContent = 'Processing Payment & Crediting Account...'

  if (el.rechargeStatusMsg) {
    el.rechargeStatusMsg.classList.add('hidden')
    el.rechargeStatusMsg.className = 'recharge-status-alert hidden'
  }

  try {
    const payload = {
      deviceId: devId,
      packageId: state.selectedPackage.id,
      customCredits: state.selectedPackage.credits,
      paymentMethod: method,
      promoCode: voucherCode
    }

    const { ok, data } = await apiPost(
      '/api/desktop/credits',
      payload,
      () => QuickInkCloud.topupCredits(devId, state.selectedPackage.id, state.selectedPackage.credits, payload)
    )

    if (!ok && !data?.success) {
      throw new Error(data?.error || 'Payment recharge could not be processed')
    }

    playSuccessChime()

    const addedCredits = state.selectedPackage.credits
    const newBal = Number(data.newBalance || (state.creditsBalance + addedCredits))
    state.creditsBalance = newBal
    updateHeaderCreditBadge()

    if (el.rechargeStatusMsg) {
      el.rechargeStatusMsg.textContent = `🎉 Success! Added ${addedCredits.toLocaleString()} credits to your station. New balance: ${newBal.toLocaleString()} credits.`
      el.rechargeStatusMsg.className = 'recharge-status-alert success'
      el.rechargeStatusMsg.classList.remove('hidden')
    }

    setTimeout(() => {
      fetchCreditsData()
      switchSubTab('subtab-history')
    }, 1500)
  } catch (err) {
    if (el.rechargeStatusMsg) {
      el.rechargeStatusMsg.textContent = `Payment Notice: ${err.message}`
      el.rechargeStatusMsg.className = 'recharge-status-alert error'
      el.rechargeStatusMsg.classList.remove('hidden')
    }
  } finally {
    el.btnSubmitRecharge.disabled = false
    el.rechargeSpinner?.classList.add('hidden')
    el.rechargeBtnText.textContent = `Confirm Top-Up & Activate ${state.selectedPackage.credits.toLocaleString()} Credits (৳${state.selectedPackage.price_taka}) →`
  }
}

function renderLedgerTable(transactions) {
  if (!el.ledgerTableBody) return

  if (!transactions || transactions.length === 0) {
    el.ledgerTableBody.innerHTML = '<tr><td colspan="5" class="empty-state">No credit transactions recorded yet.</td></tr>'
    return
  }

  el.ledgerTableBody.innerHTML = transactions.map((t) => {
    const dateStr = t.created_at ? new Date(t.created_at).toLocaleString([], { dateStyle: 'short', timeStyle: 'short' }) : '—'
    const amt = Number(t.amount || 0)
    const isPositive = amt > 0
    const impactClass = isPositive ? 'positive' : amt < 0 ? 'negative' : 'zero'
    const impactStr = isPositive ? `+${amt.toLocaleString()}` : `${amt.toLocaleString()}`
    const balAfter = Number(t.balance_after || 0).toLocaleString()

    let tagClass = 'deduction'
    let tagLabel = 'Print Job'
    if (t.type === 'welcome_bonus') {
      tagClass = 'welcome'
      tagLabel = 'Welcome Bonus'
    } else if (t.type === 'subscription_topup' || t.type === 'topup') {
      tagClass = 'topup'
      tagLabel = 'Top-Up'
    } else if (t.type === 'admin_adjustment') {
      tagClass = 'welcome'
      tagLabel = 'Admin Bonus'
    }

    return `
      <tr>
        <td style="color:#94a3b8; font-size:11px;">${dateStr}</td>
        <td><span class="tx-tag ${tagClass}">${tagLabel}</span></td>
        <td><div style="font-weight:600; color:#fff;">${t.description || 'Credit Transaction'}</div></td>
        <td class="tx-impact ${impactClass}">${impactStr}</td>
        <td style="font-family:monospace; font-weight:700; color:#38bdf8;">${balAfter}</td>
      </tr>
    `
  }).join('')
}

// =============================================================================
// SHOP & KIOSK REGISTRATION, OTP VERIFICATION & AUTHENTICATION SYSTEM
// =============================================================================
function setupAuthSystem() {
  // 1. Check if an account is already logged in
  loadSavedAccount()

  // 2. Header Account Chip Click
  el.btnAccountToggle?.addEventListener('click', () => {
    if (state.account) {
      openAccountProfileModal()
    } else {
      openAuthModal('signin')
    }
  })

  // 3. Close Auth Modal
  el.btnCloseAuthModal?.addEventListener('click', () => {
    el.authModal.classList.add('hidden')
  })

  // 4. Tab Switcher inside Auth Modal
  el.tabBtnSignin?.addEventListener('click', () => switchAuthTab('signin'))
  el.tabBtnSignup?.addEventListener('click', () => switchAuthTab('signup'))
  el.linkToRegister?.addEventListener('click', (e) => {
    e.preventDefault()
    switchAuthTab('signup')
  })

  // 5. Modality Options (Shop vs Kiosk)
  el.labelModShop?.addEventListener('click', () => {
    el.labelModShop.classList.add('active')
    el.labelModKiosk.classList.remove('active')
    state.regDraft.type = 'shop'
    if (el.regOperatingHours && (el.regOperatingHours.value === '24/7 Automated' || !el.regOperatingHours.value)) {
      el.regOperatingHours.value = '09:00 AM - 10:00 PM'
    }
  })
  el.labelModKiosk?.addEventListener('click', () => {
    el.labelModKiosk.classList.add('active')
    el.labelModShop.classList.remove('active')
    state.regDraft.type = 'kiosk'
    if (el.regOperatingHours && (el.regOperatingHours.value === '09:00 AM - 10:00 PM' || !el.regOperatingHours.value)) {
      el.regOperatingHours.value = '24/7 Automated'
    }
  })

  // 6. Media Pickers (Logo & Storefront Photo)
  el.btnBrowseLogo?.addEventListener('click', () => el.regLogoInput?.click())
  el.regLogoInput?.addEventListener('change', (e) => {
    const file = e.target.files[0]
    if (file) {
      const reader = new FileReader()
      reader.onload = (ev) => {
        state.regDraft.logo_url = ev.target.result
        el.logoPreviewImg.src = ev.target.result
        el.logoPreviewImg.classList.remove('hidden')
        el.logoPreviewPlaceholder.classList.add('hidden')
      }
      reader.readAsDataURL(file)
    }
  })

  el.btnBrowsePhoto?.addEventListener('click', () => el.regPhotoInput?.click())
  el.regPhotoInput?.addEventListener('change', (e) => {
    const file = e.target.files[0]
    if (file) {
      const reader = new FileReader()
      reader.onload = (ev) => {
        state.regDraft.shop_photo_url = ev.target.result
        el.photoPreviewImg.src = ev.target.result
        el.photoPreviewImg.classList.remove('hidden')
        el.photoPreviewPlaceholder.classList.add('hidden')
      }
      reader.readAsDataURL(file)
    }
  })

  // 7. Step 1 Submit & Send OTP
  el.btnToStep2?.addEventListener('click', handleSendMobileOtp)

  // 8. Step 2 OTP auto-advance & verification
  setupAuthOtpInputs()
  el.btnBackToStep1?.addEventListener('click', () => setRegStep(1))
  el.btnResendMobileOtp?.addEventListener('click', handleSendMobileOtp)
  el.btnVerifyMobileOtp?.addEventListener('click', handleVerifyMobileOtp)

  // 9. Step 3 Set Password & Finish
  el.btnFinishRegistration?.addEventListener('click', handleFinishRegistration)

  // 10. Login Screen (Screenshot design matching)
  el.formLogin?.addEventListener('submit', handleLoginSubmit)

  // Password visibility eye toggle
  el.btnToggleEye?.addEventListener('click', () => {
    if (!el.loginPassword) return
    const isPass = el.loginPassword.type === 'password'
    el.loginPassword.type = isPass ? 'text' : 'password'
    if (el.eyeIconOpen) el.eyeIconOpen.classList.toggle('hidden', isPass)
    if (el.eyeIconClosed) el.eyeIconClosed.classList.toggle('hidden', !isPass)
  })

  // Forgot password → launch the proper reset flow
  el.btnForgotPassword?.addEventListener('click', () => {
    showScreen('forgot-password')
    fpShowStep(1)
  })
  setupForgotPassword()

  // Switch between Login and Register screens
  el.linkToRegister?.addEventListener('click', () => {
    showScreen('register')
    setRegStep(1)
  })
  el.linkToLogin?.addEventListener('click', () => {
    showScreen('login')
  })

  // 11. Header Account Profile Badge in Workspace
  el.btnAccountToggle?.addEventListener('click', openAccountProfileModal)

  // 12. Account Details Modal controls
  el.btnCloseAccountModal?.addEventListener('click', () => el.accountModal?.classList.add('hidden'))
  el.btnSwitchAccount?.addEventListener('click', () => {
    el.accountModal?.classList.add('hidden')
    showScreen('register')
    setRegStep(1)
  })
  el.btnLogoutAccount?.addEventListener('click', handleLogout)

  // Copy Station Device UUID button
  el.btnCopyDeviceId?.addEventListener('click', () => {
    const uuid = el.modalAccountDeviceId?.textContent?.trim()
    if (!uuid) return
    navigator.clipboard?.writeText(uuid).then(() => {
      if (el.btnCopyDeviceId) el.btnCopyDeviceId.textContent = 'Copied!'
      setTimeout(() => {
        if (el.btnCopyDeviceId) el.btnCopyDeviceId.textContent = 'Copy'
      }, 1800)
    }).catch(() => {
      prompt('Copy Station Device UUID:', uuid)
    })
  })

  // Profile Send Test Print Page
  el.btnProfileTestPrint?.addEventListener('click', async () => {
    const printer = state.printers?.bw || 'default'
    if (el.btnProfileTestPrint) {
      el.btnProfileTestPrint.disabled = true
      el.btnProfileTestPrint.textContent = 'Sending Test Page...'
    }
    try {
      if (isElectron && window.quickinkDesktop?.testPrint) {
        await window.quickinkDesktop.testPrint(printer, 'bw')
      } else {
        await new Promise(r => setTimeout(r, 600))
      }
      if (el.btnProfileTestPrint) el.btnProfileTestPrint.textContent = '✓ Test Page Sent!'
    } catch (err) {
      if (el.btnProfileTestPrint) el.btnProfileTestPrint.textContent = 'Failed to Send'
    } finally {
      setTimeout(() => {
        if (el.btnProfileTestPrint) {
          el.btnProfileTestPrint.disabled = false
          el.btnProfileTestPrint.textContent = '🖨️ Send Test Print Page'
        }
      }, 2000)
    }
  })

  // Profile Refresh Cloud Sync
  el.btnRefreshProfileSync?.addEventListener('click', async () => {
    if (el.btnRefreshProfileSync) {
      el.btnRefreshProfileSync.disabled = true
      el.btnRefreshProfileSync.textContent = 'Syncing Cloud...'
    }
    try {
      await fetchCreditsData()
      openAccountProfileModal()
      if (el.btnRefreshProfileSync) el.btnRefreshProfileSync.textContent = '✓ Synced!'
    } catch (e) {
      if (el.btnRefreshProfileSync) el.btnRefreshProfileSync.textContent = 'Sync Error'
    } finally {
      setTimeout(() => {
        if (el.btnRefreshProfileSync) {
          el.btnRefreshProfileSync.disabled = false
          el.btnRefreshProfileSync.textContent = '🔄 Refresh Cloud Sync'
        }
      }, 1500)
    }
  })

  // 13. Administrative Lockdown Screen buttons
  el.btnLockdownCheckStatus?.addEventListener('click', async () => {
    el.btnLockdownCheckStatus.disabled = true
    el.btnLockdownCheckStatus.textContent = 'Checking Status with Server...'
    try {
      const devId = el.lockdownDeviceId?.textContent?.trim() || state.config.deviceId
      const res = await fetch(`${state.config.apiBaseUrl}/api/desktop/auth?action=check-status&deviceId=${devId}`)
      const data = await res.json()

      if (!data.suspended) {
        alert('🎉 Partnership Reinstated!\n\nYour Quick Ink partnership is active. You may now sign in.')
        showScreen('login')
      } else {
        alert(`⚠️ Station is still suspended by administration.\n\nReason: ${data.reason || 'Pending operational review'}\n\nEmergency Phone: 01733398911\nEmail: help@printkoro.com`)
      }
    } catch (e) {
      alert('Could not verify status with Quick Ink server. Please check your network connection.')
    } finally {
      el.btnLockdownCheckStatus.disabled = false
      el.btnLockdownCheckStatus.textContent = 'Check Status Again ⟳'
    }
  })

  el.btnLockdownLogout?.addEventListener('click', () => {
    showScreen('login')
  })

  // 14. Pending Approval Screen buttons
  el.btnPendingCheckStatus?.addEventListener('click', () => checkApprovalStatus(true))
  el.btnPendingLogout?.addEventListener('click', () => showScreen('login'))

  // 15. Rejected Screen buttons
  el.btnReRegister?.addEventListener('click', handleReRegister)
  el.btnRejectedLogout?.addEventListener('click', () => showScreen('login'))
}

// Show target screen (login, register, lockdown, pending, rejected, workspace)
function showScreen(screen) {
  if (el.screenLogin) el.screenLogin.classList.toggle('hidden', screen !== 'login')
  if (el.screenRegister) el.screenRegister.classList.toggle('hidden', screen !== 'register')
  if (el.screenForgotPassword) el.screenForgotPassword.classList.toggle('hidden', screen !== 'forgot-password')
  if (el.screenLockdown) el.screenLockdown.classList.toggle('hidden', screen !== 'lockdown')
  if (el.screenPending) el.screenPending.classList.toggle('hidden', screen !== 'pending')
  if (el.screenRejected) el.screenRejected.classList.toggle('hidden', screen !== 'rejected')
  if (el.screenWorkspace) el.screenWorkspace.classList.toggle('hidden', screen !== 'workspace')

  if (screen === 'login') {
    setTimeout(() => el.loginPhone?.focus(), 80)
  } else if (screen === 'workspace') {
    setTimeout(() => el.otpBoxes[0]?.focus(), 80)
  } else if (screen === 'forgot-password') {
    setTimeout(() => el.fpPhone?.focus(), 80)
  }
}

// =============================================================================
// FORGOT PASSWORD — 3-STEP OTP FLOW
// =============================================================================
let fpPhoneVerified = ''

function fpShowStep(step) {
  el.fpStep1?.classList.toggle('hidden', step !== 1)
  el.fpStep2?.classList.toggle('hidden', step !== 2)
  el.fpStep3?.classList.toggle('hidden', step !== 3)
  el.fpStepSuccess?.classList.toggle('hidden', step !== 4)
}

function fpSetStatus(el_, msg, isError = false) {
  if (!el_) return
  el_.textContent = msg
  el_.className = 'auth-status-alert ' + (isError ? 'error' : 'success')
  el_.classList.remove('hidden')
}
function fpClearStatus(el_) {
  if (!el_) return
  el_.classList.add('hidden')
  el_.textContent = ''
}

function setupForgotPassword() {
  // Back to login
  el.fpBackToLogin?.addEventListener('click', () => showScreen('login'))
  el.fpGoLogin?.addEventListener('click', () => {
    showScreen('login')
    fpPhoneVerified = ''
    if (el.fpPhone) el.fpPhone.value = ''
    if (el.fpNewPassword) el.fpNewPassword.value = ''
    if (el.fpConfirmPassword) el.fpConfirmPassword.value = ''
    el.fpOtpBoxes?.forEach(b => { b.value = '' })
    fpShowStep(1)
  })

  // STEP 1: Send OTP
  el.btnFpSendOtp?.addEventListener('click', async () => {
    const phone = el.fpPhone?.value?.trim()
    if (!phone || phone.replace(/[^0-9]/g, '').length < 10) {
      fpSetStatus(el.fpStep1Status, 'Please enter a valid 11-digit mobile number.', true)
      return
    }
    fpClearStatus(el.fpStep1Status)
    if (el.fpSendOtpText) el.fpSendOtpText.textContent = 'Sending Code...'
    if (el.btnFpSendOtp) el.btnFpSendOtp.disabled = true

    try {
      const { ok, data } = await apiPost(
        '/api/desktop/auth',
        { action: 'reset-password-send-otp', phone },
        () => QuickInkCloud.sendOtp(phone)
      )
      if (!ok || !data?.success) throw new Error(data?.error || 'Failed to send code')

      fpPhoneVerified = data.phone || phone.replace(/[^0-9]/g, '')
      if (el.fpOtpHint) el.fpOtpHint.textContent = `A 6-digit code was sent to ${fpPhoneVerified}`
      el.fpOtpBoxes?.forEach(b => { b.value = '' })
      fpShowStep(2)
      setTimeout(() => el.fpOtpBoxes?.[0]?.focus(), 100)
    } catch (err) {
      fpSetStatus(el.fpStep1Status, err.message, true)
    } finally {
      if (el.fpSendOtpText) el.fpSendOtpText.textContent = 'Send Verification Code →'
      if (el.btnFpSendOtp) el.btnFpSendOtp.disabled = false
    }
  })

  // STEP 2: OTP box keyboard navigation
  el.fpOtpBoxes?.forEach((box, i) => {
    box.addEventListener('input', () => {
      box.value = box.value.replace(/[^0-9]/g, '').slice(-1)
      if (box.value && i < el.fpOtpBoxes.length - 1) el.fpOtpBoxes[i + 1].focus()
    })
    box.addEventListener('keydown', (e) => {
      if (e.key === 'Backspace' && !box.value && i > 0) el.fpOtpBoxes[i - 1].focus()
    })
    box.addEventListener('paste', (e) => {
      e.preventDefault()
      const digits = (e.clipboardData.getData('text') || '').replace(/[^0-9]/g, '')
      digits.split('').forEach((d, j) => { if (el.fpOtpBoxes[j]) el.fpOtpBoxes[j].value = d })
      const lastFilled = Math.min(digits.length, el.fpOtpBoxes.length - 1)
      el.fpOtpBoxes[lastFilled]?.focus()
    })
  })

  // Resend code
  el.btnFpResend?.addEventListener('click', async () => {
    fpClearStatus(el.fpStep2Status)
    el.btnFpResend.textContent = 'Sending...'
    el.btnFpResend.disabled = true
    try {
      const { ok, data } = await apiPost(
        '/api/desktop/auth',
        { action: 'reset-password-send-otp', phone: fpPhoneVerified },
        () => QuickInkCloud.sendOtp(fpPhoneVerified)
      )
      if (!ok || !data?.success) throw new Error(data?.error || 'Failed to resend')
      fpSetStatus(el.fpStep2Status, 'New code sent! Check your SMS.', false)
      el.fpOtpBoxes?.forEach(b => { b.value = '' })
      el.fpOtpBoxes?.[0]?.focus()
    } catch (err) {
      fpSetStatus(el.fpStep2Status, err.message, true)
    } finally {
      el.btnFpResend.textContent = 'Resend Code'
      el.btnFpResend.disabled = false
    }
  })

  // Go back to step 1
  el.fpOtpBack?.addEventListener('click', () => {
    fpClearStatus(el.fpStep2Status)
    fpShowStep(1)
    setTimeout(() => el.fpPhone?.focus(), 80)
  })

  // Verify OTP
  el.btnFpVerifyOtp?.addEventListener('click', async () => {
    const otp = el.fpOtpBoxes?.map(b => b.value).join('')
    if (!otp || otp.length < 6) {
      fpSetStatus(el.fpStep2Status, 'Please enter the full 6-digit code.', true)
      return
    }
    fpClearStatus(el.fpStep2Status)
    if (el.fpVerifyOtpText) el.fpVerifyOtpText.textContent = 'Verifying...'
    if (el.btnFpVerifyOtp) el.btnFpVerifyOtp.disabled = true

    try {
      const { ok, data } = await apiPost(
        '/api/desktop/auth',
        { action: 'reset-verify-otp', phone: fpPhoneVerified, otp },
        () => QuickInkCloud.verifyOtp(fpPhoneVerified, otp)
      )
      if (!ok || !data?.success) throw new Error(data?.error || 'Invalid or expired code')

      fpShowStep(3)
      setTimeout(() => el.fpNewPassword?.focus(), 80)
    } catch (err) {
      fpSetStatus(el.fpStep2Status, err.message, true)
    } finally {
      if (el.fpVerifyOtpText) el.fpVerifyOtpText.textContent = 'Verify Code →'
      if (el.btnFpVerifyOtp) el.btnFpVerifyOtp.disabled = false
    }
  })

  // STEP 3: Toggle password visibility
  el.btnFpTogglePw?.addEventListener('click', () => {
    if (!el.fpNewPassword) return
    const isPass = el.fpNewPassword.type === 'password'
    el.fpNewPassword.type = isPass ? 'text' : 'password'
    el.fpEyeOpen?.classList.toggle('hidden', isPass)
    el.fpEyeClosed?.classList.toggle('hidden', !isPass)
  })

  // Set new password
  el.btnFpReset?.addEventListener('click', async () => {
    const newPw = el.fpNewPassword?.value || ''
    const confirmPw = el.fpConfirmPassword?.value || ''
    if (newPw.length < 6) {
      fpSetStatus(el.fpStep3Status, 'Password must be at least 6 characters.', true)
      return
    }
    if (newPw !== confirmPw) {
      fpSetStatus(el.fpStep3Status, 'Passwords do not match.', true)
      return
    }
    fpClearStatus(el.fpStep3Status)
    if (el.fpResetText) el.fpResetText.textContent = 'Updating Password...'
    if (el.btnFpReset) el.btnFpReset.disabled = true

    try {
      const { ok, data } = await apiPost(
        '/api/desktop/auth',
        { action: 'reset-password', phone: fpPhoneVerified, newPassword: newPw },
        () => QuickInkCloud.resetPasswordSave(fpPhoneVerified, newPw)
      )
      if (!ok || !data?.success) throw new Error(data?.error || 'Failed to update password')

      fpShowStep(4) // Show success
    } catch (err) {
      fpSetStatus(el.fpStep3Status, err.message, true)
    } finally {
      if (el.fpResetText) el.fpResetText.textContent = 'Update Password →'
      if (el.btnFpReset) el.btnFpReset.disabled = false
    }
  })
}

// Display Pending Approval Screen
function showPendingScreen(acc) {
  if (acc) {
    state.account = acc
    localStorage.setItem('quickink_shop_account', JSON.stringify(acc))
    if (el.pendingShopName) el.pendingShopName.textContent = acc.shop_name || 'Quick Ink Station'
    if (el.pendingOwnerName) el.pendingOwnerName.textContent = acc.name || 'Partner Owner'
    if (el.pendingPhone) el.pendingPhone.textContent = acc.phone || '017XXXXXXXX'
    if (el.pendingType) el.pendingType.textContent = acc.type === 'kiosk' ? 'Automated Kiosk' : 'Partner Print Shop'
    if (el.pendingHours) el.pendingHours.textContent = acc.operating_hours || (acc.type === 'kiosk' ? '24/7 Automated' : '09:00 AM - 10:00 PM')
    if (el.pendingLocation) el.pendingLocation.textContent = acc.location || 'Location Address'
  }
  showScreen('pending')
}

// Display Rejected Application Screen
function showRejectedScreen(acc, reason) {
  const updated = { ...(acc || {}), status: 'rejected', rejection_reason: reason }
  state.account = updated
  localStorage.setItem('quickink_shop_account', JSON.stringify(updated))
  if (el.rejectedShopName) el.rejectedShopName.textContent = acc?.shop_name || 'Quick Ink Station'
  if (el.rejectedPhone) el.rejectedPhone.textContent = acc?.phone || '017XXXXXXXX'
  if (el.rejectedReasonText) {
    el.rejectedReasonText.textContent = reason || 'Your application could not be verified by administration. Please re-register with accurate details.'
  }
  showScreen('rejected')
}

// Re-Register Workflow: Clears Draft & Resets Form to Step 1
function handleReRegister() {
  state.account = null
  localStorage.removeItem('quickink_shop_account')
  state.regDraft = {
    type: 'shop',
    name: '',
    shop_name: '',
    phone: '',
    location: '',
    operating_hours: '09:00 AM - 10:00 PM',
    logo_url: '',
    shop_photo_url: '',
  }
  if (el.regOwnerName) el.regOwnerName.value = ''
  if (el.regShopName) el.regShopName.value = ''
  if (el.regPhone) el.regPhone.value = ''
  if (el.regOperatingHours) el.regOperatingHours.value = '09:00 AM - 10:00 PM'
  if (el.regLocation) el.regLocation.value = ''
  if (el.regNewPassword) el.regNewPassword.value = ''
  if (el.regConfirmPassword) el.regConfirmPassword.value = ''
  if (el.logoPreviewImg) {
    el.logoPreviewImg.src = ''
    el.logoPreviewImg.classList.add('hidden')
  }
  if (el.logoPreviewPlaceholder) el.logoPreviewPlaceholder.classList.remove('hidden')
  if (el.photoPreviewImg) {
    el.photoPreviewImg.src = ''
    el.photoPreviewImg.classList.add('hidden')
  }
  if (el.photoPreviewPlaceholder) el.photoPreviewPlaceholder.classList.remove('hidden')
  setRegStep(1)
  showScreen('register')
}

// Check Real-Time Approval / Rejection Status
async function checkApprovalStatus(isManual = false) {
  const phone = state.account?.phone || state.regDraft?.phone
  const devId = state.account?.deviceId || state.config.deviceId

  if (!phone && !devId) return

  if (isManual && el.btnPendingCheckStatus) {
    el.btnPendingCheckStatus.disabled = true
    el.btnPendingCheckStatus.textContent = 'Checking Status...'
  }

  try {
    const { ok, data } = await apiGet(
      `/api/desktop/auth?action=check-status&phone=${phone || ''}&deviceId=${devId || ''}`,
      () => QuickInkCloud.checkStatus(devId, phone)
    )

    if (!ok || !data) throw new Error('Status query failed')

    if (data.approved) {
      if (state.account) {
        state.account.status = 'approved'
        if (data.deviceId) state.account.deviceId = data.deviceId
        localStorage.setItem('quickink_shop_account', JSON.stringify(state.account))
        updateHeaderProfile(state.account)
      }
      playSuccessChime()
      showScreen('workspace')
      alert('🎉 Application Approved!\n\nQuick Ink administration has verified your registration. Welcome to your terminal dashboard!')
      return
    }

    if (data.rejected) {
      showRejectedScreen(state.account, data.reason)
      return
    }

    if (isManual) {
      alert('⏳ Application Still Under Review\n\nYour application is being reviewed by Quick Ink administrators.\n\nFor emergency assistance or expedited verification, contact admin directly:\nEmergency Phone: 01733398911\nEmail: help@quickink.net')
    }
  } catch (err) {
    if (isManual) {
      alert('Could not verify status with Quick Ink server. Please check your network connection.')
    }
  } finally {
    if (isManual && el.btnPendingCheckStatus) {
      el.btnPendingCheckStatus.disabled = false
      el.btnPendingCheckStatus.textContent = 'Check Approval Status ⟳'
    }
  }
}

// Trigger Administrative Lockdown
function triggerSuspensionLockdown(shopName, deviceId, reason, date) {
  state.account = null
  localStorage.removeItem('quickink_shop_account')

  if (el.lockdownShopName) el.lockdownShopName.textContent = shopName || 'Quick Ink Station'
  if (el.lockdownDeviceId) el.lockdownDeviceId.textContent = deviceId || state.config.deviceId
  if (el.lockdownReasonText) {
    el.lockdownReasonText.textContent = reason || 'Partnership suspended by QuickInk administration due to compliance review or agreement termination.'
  }
  if (el.lockdownDateText) {
    el.lockdownDateText.textContent = date ? new Date(date).toLocaleString() : new Date().toLocaleString()
  }

  showScreen('lockdown')
}

// Heartbeat Station Status Check (Detects real-time admin cancellation)
async function checkStationStatus() {
  const devId = state.account?.deviceId || state.config.deviceId
  if (!devId) return

  try {
    const { ok, data } = await apiGet(
      `/api/desktop/auth?action=check-status&deviceId=${devId}`,
      () => QuickInkCloud.checkStatus(devId)
    )

    if (!ok || !data) return

    if (data.suspended) {
      triggerSuspensionLockdown(
        state.account?.shop_name || 'Quick Ink Station',
        devId,
        data.reason,
        data.suspended_at
      )
    } else if (state.account && el.screenLockdown && !el.screenLockdown.classList.contains('hidden')) {
      showScreen('workspace')
    }
  } catch (e) {
    // network note
  }
}

async function loadSavedAccount() {
  try {
    const stored = localStorage.getItem('quickink_shop_account')
    if (stored) {
      const acc = JSON.parse(stored)
      if (acc && acc.name && acc.phone) {
        state.account = acc

        if (acc.status === 'pending') {
          showPendingScreen(acc)
          await checkApprovalStatus(false)
          return
        }

        if (acc.status === 'rejected') {
          showRejectedScreen(acc, acc.rejection_reason)
          return
        }

        if (acc.deviceId) {
          state.config.deviceId = acc.deviceId
        }

        updateHeaderProfile(acc)

        // Check if admin suspended this account
        await checkStationStatus()
        if (!state.account) {
          // was suspended
          return
        }
        showScreen('workspace')
        return
      }
    }
  } catch (e) {
    console.warn('Error reading saved account:', e)
  }

  // If no account, show the clean login screen matching screenshot
  updateHeaderProfile(null)
  showScreen('login')
}

function updateHeaderProfile(account) {
  if (account) {
    if (el.headerShopName) el.headerShopName.textContent = account.shop_name || 'QuickInk Shop'
    if (el.headerOwnerName) el.headerOwnerName.textContent = account.name || 'Certified Owner'
    if (el.btnAccountLabel) el.btnAccountLabel.textContent = 'Station Profile'

    if (account.logo_url) {
      if (el.headerAvatarImg) {
        el.headerAvatarImg.src = account.logo_url
        el.headerAvatarImg.classList.remove('hidden')
      }
      if (el.headerAvatarInitials) el.headerAvatarInitials.classList.add('hidden')
    } else {
      const initials = (account.shop_name || 'QS')
        .split(' ')
        .map((w) => w[0])
        .slice(0, 2)
        .join('')
        .toUpperCase()
      if (el.headerAvatarInitials) {
        el.headerAvatarInitials.textContent = initials
        el.headerAvatarInitials.classList.remove('hidden')
      }
      if (el.headerAvatarImg) el.headerAvatarImg.classList.add('hidden')
    }
  } else {
    if (el.headerShopName) el.headerShopName.textContent = 'QuickInk Station'
    if (el.headerOwnerName) el.headerOwnerName.textContent = 'Not Signed In'
    if (el.btnAccountLabel) el.btnAccountLabel.textContent = 'Sign In / Register'
    if (el.headerAvatarInitials) {
      el.headerAvatarInitials.textContent = 'QI'
      el.headerAvatarInitials.classList.remove('hidden')
    }
    if (el.headerAvatarImg) el.headerAvatarImg.classList.add('hidden')
  }
}

// Stepper navigation for 3 steps
function setRegStep(step) {
  el.regStep1.classList.toggle('hidden', step !== 1)
  el.regStep2.classList.toggle('hidden', step !== 2)
  el.regStep3.classList.toggle('hidden', step !== 3)

  // Step 1 status
  el.stepInd1.className = `step-indicator ${step === 1 ? 'active' : step > 1 ? 'done' : ''}`
  el.stepLine1.className = `step-line ${step > 1 ? 'active' : ''}`

  // Step 2 status
  el.stepInd2.className = `step-indicator ${step === 2 ? 'active' : step > 2 ? 'done' : ''}`
  el.stepLine2.className = `step-line ${step > 2 ? 'active' : ''}`

  // Step 3 status
  el.stepInd3.className = `step-indicator ${step === 3 ? 'active' : ''}`

  if (step === 2) {
    el.authOtpBoxes[0]?.focus()
  } else if (step === 3) {
    el.regNewPassword?.focus()
  }
}

// Step 1: Send OTP to mobile
async function handleSendMobileOtp() {
  const name = el.regOwnerName.value.trim()
  const shop_name = el.regShopName.value.trim()
  const phone = el.regPhone.value.trim()
  const location = el.regLocation.value.trim()
  const operating_hours = el.regOperatingHours?.value.trim() || (state.regDraft.type === 'kiosk' ? '24/7 Automated' : '09:00 AM - 10:00 PM')

  if (!name || !shop_name || !phone || !location) {
    showRegMsg(el.regStep1StatusMsg, 'Please fill in all required fields (Owner Name, Shop Name, Phone, Location).', true)
    return
  }

  const cleanPhone = phone.replace(/[^0-9]/g, '')
  if (cleanPhone.length < 10) {
    showRegMsg(el.regStep1StatusMsg, 'Please enter a valid 11-digit mobile number.', true)
    return
  }

  hideRegMsg(el.regStep1StatusMsg)
  el.btnToStep2.disabled = true
  el.btnToStep2.textContent = 'Sending SMS Verification Code...'

  state.regDraft.name = name
  state.regDraft.shop_name = shop_name
  state.regDraft.phone = cleanPhone
  state.regDraft.location = location
  state.regDraft.operating_hours = operating_hours

  try {
    const { ok, data } = await apiPost(
      '/api/desktop/auth',
      { action: 'send-otp', phone: cleanPhone },
      () => QuickInkCloud.sendOtp(cleanPhone)
    )

    if (!ok || !data?.success) {
      showRegMsg(el.regStep1StatusMsg, data?.error || 'Failed to dispatch verification SMS. Please verify your phone number.', true)
      return
    }

    // Update Step 2 UI
    el.regTargetPhoneDisplay.textContent = `+880 ${cleanPhone.slice(-10)}`

    // Clear boxes & advance to Step 2
    el.authOtpBoxes.forEach((b) => (b.value = ''))
    setRegStep(2)
  } catch (e) {
    showRegMsg(el.regStep1StatusMsg, 'Unable to connect to QuickInk server. Please check your internet connection.', true)
  } finally {
    el.btnToStep2.disabled = false
    el.btnToStep2.textContent = 'Verify Mobile via OTP →'
  }
}

function setupAuthOtpInputs() {
  el.authOtpBoxes.forEach((box, idx) => {
    box.addEventListener('input', (e) => {
      const val = e.target.value.replace(/[^0-9]/g, '')
      e.target.value = val
      if (val.length === 1 && idx < 5) {
        el.authOtpBoxes[idx + 1].focus()
      }
      hideRegMsg(el.regStep2StatusMsg)
    })

    box.addEventListener('keydown', (e) => {
      if (e.key === 'Backspace' && !box.value && idx > 0) {
        el.authOtpBoxes[idx - 1].focus()
      } else if (e.key === 'Enter') {
        handleVerifyMobileOtp()
      }
    })
  })
}

// Step 2: Verify Mobile OTP
async function handleVerifyMobileOtp() {
  const code = el.authOtpBoxes.map((b) => b.value).join('')
  if (code.length !== 6) {
    showRegMsg(el.regStep2StatusMsg, 'Please enter all 6 digits of the verification code.', true)
    return
  }

  el.btnVerifyMobileOtp.disabled = true
  el.btnVerifyMobileOtp.textContent = 'Verifying...'
  hideRegMsg(el.regStep2StatusMsg)

  try {
    const { ok, data } = await apiPost(
      '/api/desktop/auth',
      { action: 'verify-otp', phone: state.regDraft.phone, otp: code },
      () => QuickInkCloud.verifyOtp(state.regDraft.phone, code)
    )

    if (ok && data?.verified) {
      el.regVerifiedPhoneTxt.textContent = `+880 ${state.regDraft.phone.slice(-10)} (Verified)`
      setRegStep(3)
      return
    } else {
      showRegMsg(el.regStep2StatusMsg, data?.error || 'Invalid or expired verification code. Please check your SMS or request a new code.', true)
    }
  } catch (err) {
    showRegMsg(el.regStep2StatusMsg, 'Unable to connect to verification server. Please check your internet connection.', true)
  } finally {
    el.btnVerifyMobileOtp.disabled = false
    el.btnVerifyMobileOtp.textContent = 'Verify & Proceed →'
  }
}

// Step 3: Set Password & Complete Registration
async function handleFinishRegistration() {
  const pass = el.regNewPassword.value
  const confirm = el.regConfirmPassword.value

  if (!pass || pass.length < 6) {
    showRegMsg(el.regStep3StatusMsg, 'Password must be at least 6 characters long.', true)
    return
  }

  if (pass !== confirm) {
    showRegMsg(el.regStep3StatusMsg, 'Passwords do not match. Please re-enter.', true)
    return
  }

  hideRegMsg(el.regStep3StatusMsg)
  el.btnFinishRegistration.disabled = true
  el.btnFinishRegistration.textContent = 'Activating Station...'

  const payload = {
    action: 'register',
    name: state.regDraft.name,
    shop_name: state.regDraft.shop_name,
    phone: state.regDraft.phone,
    location: state.regDraft.location,
    operating_hours: state.regDraft.operating_hours,
    password: pass,
    type: state.regDraft.type,
    logo_url: state.regDraft.logo_url,
    shop_photo_url: state.regDraft.shop_photo_url,
  }

  try {
    const { ok, data } = await apiPost(
      '/api/desktop/auth',
      payload,
      () => QuickInkCloud.register({ ...state.regDraft, password: pass })
    )

    if (ok && data?.account) {
      const account = data.account
      const device = data.device

      if (device?.id) {
        state.config.deviceId = device.id
        if (isElectron) {
          await window.quickinkDesktop.saveConfig({ deviceId: device.id })
        }
      }

      // Save state with status 'pending'
      showPendingScreen(account)
      playSuccessChime()
      alert(`📋 Registration Submitted!\n\nWelcome "${account.shop_name}". Your account has been submitted for administrator review.\n\nEmergency Contact: 01733398911\nSupport Email: help@quickink.net`)
      return
    }

    showRegMsg(el.regStep3StatusMsg, data?.error || 'Registration failed. Please check your information and try again.', true)
  } catch (err) {
    showRegMsg(el.regStep3StatusMsg, 'Network error. Could not connect to QuickInk registration service.', true)
  } finally {
    el.btnFinishRegistration.disabled = false
    el.btnFinishRegistration.textContent = 'Complete Registration & Submit for Approval'
  }
}

// Sign In Form Handler (Matching exact screenshot fields)
async function handleLoginSubmit(e) {
  e.preventDefault()
  const phone = el.loginPhone?.value?.trim() || ''
  const password = el.loginPassword?.value || ''

  if (!phone || !password) {
    showRegMsg(el.loginStatusMsg, 'Please enter mobile number and password.', true)
    return
  }

  if (el.btnSubmitLogin) el.btnSubmitLogin.disabled = true
  if (el.loginBtnText) el.loginBtnText.textContent = 'Verifying Credentials...'
  hideRegMsg(el.loginStatusMsg)

  try {
    const { ok, status, data } = await apiPost(
      '/api/desktop/auth',
      { action: 'login', phone, password },
      () => QuickInkCloud.login(phone, password)
    )

    // 1. Pending Approval Check
    if (status === 403 && data?.pending) {
      showPendingScreen(data.account)
      return
    }

    // 2. Rejected Application Check
    if (status === 403 && data?.rejected) {
      showRejectedScreen(data.account, data.reason)
      return
    }

    // 3. Administrative Suspension / Partnership Revocation Check
    if (status === 403 && data?.suspended) {
      triggerSuspensionLockdown(
        data.shop_name || 'Station',
        data.deviceId || state.config.deviceId,
        data.reason,
        data.suspended_at
      )
      return
    }

    if (!ok || !data?.success) {
      throw new Error(data?.error || 'Invalid credentials')
    }

    const account = data.account
    state.account = account
    localStorage.setItem('quickink_shop_account', JSON.stringify(account))

    if (data.deviceId) {
      state.config.deviceId = data.deviceId
      if (isElectron) {
        await window.quickinkDesktop.saveConfig({ deviceId: data.deviceId })
      }
    }

    updateHeaderProfile(account)
    fetchDevices()
    fetchRecentJobs()
    showScreen('workspace')
    playSuccessChime()
  } catch (err) {
    showRegMsg(el.loginStatusMsg, err.message || 'Login failed. Check mobile and password.', true)
  } finally {
    if (el.btnSubmitLogin) el.btnSubmitLogin.disabled = false
    if (el.loginBtnText) el.loginBtnText.textContent = 'Sign In →'
  }
}

// Open Account Details Modal
function openAccountProfileModal() {
  const acc = state.account
  if (!acc) return

  // Basic Identity
  if (el.modalAccountShopName) el.modalAccountShopName.textContent = acc.shop_name || 'PrintKoro Partner Station'
  if (el.modalAccountOwnerName) el.modalAccountOwnerName.textContent = acc.name || 'Certified Operator'
  if (el.modalAccountType) el.modalAccountType.textContent = acc.type === 'kiosk' ? 'Automated Kiosk' : 'Partner Print Station'
  if (el.modalAccountPhone) el.modalAccountPhone.textContent = acc.phone || '017XXXXXXXX'
  if (el.modalAccountEmail) el.modalAccountEmail.textContent = acc.email || `${(acc.phone || 'partner').replace(/\D/g, '')}@printkoro.partner`
  if (el.modalAccountAddress) el.modalAccountAddress.textContent = acc.location || 'Configured Physical Shop Address'
  if (el.modalAccountDeviceId) el.modalAccountDeviceId.textContent = acc.deviceId || state.config.deviceId || 'DEV-PK-1001'

  // Member Since Date
  if (el.modalAccountMemberSince) {
    if (acc.created_at) {
      const regDate = new Date(acc.created_at)
      el.modalAccountMemberSince.textContent = `🗓️ Partner Since ${regDate.toLocaleDateString([], { month: 'short', year: 'numeric' })}`
    } else {
      el.modalAccountMemberSince.textContent = '🗓️ Partner Since 2026'
    }
  }

  // Wholesale Credits & Subscription
  const currentCredits = Number(subState?.creditsBalance || 0)
  if (el.modalAccountCredits) el.modalAccountCredits.textContent = currentCredits.toLocaleString()
  if (el.modalAccountCreditsValue) el.modalAccountCreditsValue.textContent = '৳' + currentCredits.toLocaleString()

  // Hardware & Diagnostics
  if (el.modalAccountBwName) {
    el.modalAccountBwName.textContent = state.printers?.bw || 'Default Windows Printer'
  }
  if (el.modalAccountColorName) {
    el.modalAccountColorName.textContent = state.printers?.color || 'Default Windows Printer'
  }

  // Dynamic Area Pricing Zone
  if (el.modalAccountTierName) {
    el.modalAccountTierName.textContent = subState?.tierName || 'Standard Area Tier'
  }
  if (el.modalAccountBwSingle) {
    el.modalAccountBwSingle.textContent = '৳' + (subState?.tierRates?.b_w_single || 2.0).toFixed(2)
  }
  if (el.modalAccountBwDuplex) {
    el.modalAccountBwDuplex.textContent = '৳' + (subState?.tierRates?.b_w_duplex || 3.5).toFixed(2)
  }
  if (el.modalAccountColorSingle) {
    el.modalAccountColorSingle.textContent = '৳' + (subState?.tierRates?.color_single || 5.0).toFixed(2)
  }
  if (el.modalAccountColorDuplex) {
    el.modalAccountColorDuplex.textContent = '৳' + (subState?.tierRates?.color_duplex || 9.0).toFixed(2)
  }

  // Logo
  if (acc.logo_url) {
    if (el.modalAccountLogoImg) {
      el.modalAccountLogoImg.src = acc.logo_url
      el.modalAccountLogoImg.classList.remove('hidden')
    }
    if (el.modalAccountLogoInitials) el.modalAccountLogoInitials.classList.add('hidden')
  } else {
    if (el.modalAccountLogoImg) el.modalAccountLogoImg.classList.add('hidden')
    if (el.modalAccountLogoInitials) {
      el.modalAccountLogoInitials.classList.remove('hidden')
      el.modalAccountLogoInitials.textContent = (acc.shop_name || 'PK').slice(0, 2).toUpperCase()
    }
  }

  // Storefront Photo
  if (acc.shop_photo_url) {
    if (el.modalAccountPhotoImg) el.modalAccountPhotoImg.src = acc.shop_photo_url
    if (el.modalAccountPhotoWrap) el.modalAccountPhotoWrap.classList.remove('hidden')
  } else {
    if (el.modalAccountPhotoWrap) el.modalAccountPhotoWrap.classList.add('hidden')
  }

  el.accountModal?.classList.remove('hidden')
}

// Log Out Handler
function handleLogout() {
  if (!confirm('Log out from this terminal? You will need to sign in with your mobile number and password.')) return

  state.account = null
  localStorage.removeItem('quickink_shop_account')
  updateHeaderProfile(null)
  el.accountModal?.classList.add('hidden')
  showScreen('login')
}

function showRegMsg(elem, msg, isError = false) {
  if (!elem) return
  elem.textContent = msg
  elem.className = `status-msg-box ${isError ? 'error' : 'success'}`
}

function hideRegMsg(elem) {
  if (!elem) return
  elem.textContent = ''
  elem.className = 'status-msg-box hidden'
}

// Start application
window.addEventListener('DOMContentLoaded', init)
