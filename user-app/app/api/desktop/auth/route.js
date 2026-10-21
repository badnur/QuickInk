import { NextResponse } from 'next/server'
import { supabase } from '@/lib/supabase'
import crypto from 'crypto'
import { enforceRateLimit, RATE_LIMITS } from '@/lib/rate-limiter'

export const dynamic = 'force-dynamic'

// Security: Scrypt password hashing with per-user salt
export function hashPassword(plainPassword) {
  const salt = crypto.randomBytes(16).toString('hex')
  const hash = crypto.scryptSync(plainPassword, salt, 64).toString('hex')
  return `scrypt:${salt}:${hash}`
}

export function verifyPassword(plainPassword, storedHashOrPlain) {
  if (!storedHashOrPlain || !plainPassword) return false
  if (typeof storedHashOrPlain === 'string' && storedHashOrPlain.startsWith('scrypt:')) {
    const parts = storedHashOrPlain.split(':')
    if (parts.length !== 3) return false
    const salt = parts[1]
    const expectedHash = parts[2]
    try {
      const actualHash = crypto.scryptSync(plainPassword, salt, 64).toString('hex')
      return crypto.timingSafeEqual(Buffer.from(expectedHash, 'hex'), Buffer.from(actualHash, 'hex'))
    } catch (e) {
      return false
    }
  }
  // Support legacy plaintext stored during previous sessions with constant-time equality
  if (typeof storedHashOrPlain === 'string') {
    const bufA = Buffer.from(storedHashOrPlain)
    const bufB = Buffer.from(plainPassword)
    if (bufA.length === bufB.length) {
      return crypto.timingSafeEqual(bufA, bufB)
    }
    return false
  }
  return false
}

// Security: Verify administrative caller authorization
function verifyAdminAuth(request) {
  const authHeader = request.headers.get('authorization')
  const adminKey = request.headers.get('x-admin-key')
  const validSecret = process.env.ADMIN_JWT_SECRET || process.env.JWT_SECRET
  if (!validSecret) return false
  const bearerToken = authHeader?.startsWith('Bearer ') ? authHeader.substring(7).trim() : null
  return (adminKey && adminKey === validSecret) || (bearerToken && bearerToken === validSecret)
}

// In-memory store for phone OTPs and fallback shop accounts
const phoneOtpStore = new Map() // phone -> { code, expiresAt }
let memoryShopAccounts = []

export const ADMIN_CONTACT = {
  phone: '01733398911',
  email: 'help@printkoro.com'
}

// Dynamic Pricing Tiers Mapping for Bangladesh Partner Terminals
export const ZONE_TIERS = {
  campus: {
    id: 'aaaaaaaa-0000-0000-0000-000000000002',
    name: 'Campus',
    bw_price: 1.50,
    color_price: 6.00,
    bw_duplex: 2.70,
    color_duplex: 11.00,
    desc: 'Discounted university & student hub rate',
  },
  commercial: {
    id: 'aaaaaaaa-0000-0000-0000-000000000003',
    name: 'Commercial',
    bw_price: 3.00,
    color_price: 10.00,
    bw_duplex: 5.00,
    color_duplex: 18.00,
    desc: 'Premium corporate & shopping mall rate',
  },
  standard: {
    id: 'aaaaaaaa-0000-0000-0000-000000000001',
    name: 'Standard',
    bw_price: 2.00,
    color_price: 8.00,
    bw_duplex: 3.50,
    color_duplex: 15.00,
    desc: 'General retail & residential rate',
  },
}

export function normalizePhone(p) {
  if (!p) return ''
  const digits = String(p).replace(/[^0-9]/g, '')
  if (digits.startsWith('880') && digits.length >= 13) {
    return '0' + digits.slice(3)
  }
  return digits
}

export function phonesMatch(p1, p2) {
  if (!p1 || !p2) return false
  const c1 = String(p1).replace(/[^0-9]/g, '')
  const c2 = String(p2).replace(/[^0-9]/g, '')
  if (c1 === c2) return true
  if (c1.length >= 10 && c2.length >= 10 && c1.slice(-10) === c2.slice(-10)) return true
  return false
}

export async function POST(request) {
  try {
    const body = await request.json()
    const { action } = body

    // -------------------------------------------------------------------------
    // 1. SEND OTP
    // -------------------------------------------------------------------------
    if (action === 'send-otp') {
      const { phone } = body
      if (!phone || phone.trim().length < 10) {
        return NextResponse.json({ error: 'Valid 11-digit mobile number is required' }, { status: 400 })
      }

      const cleanPhone = phone.trim().replace(/[^0-9]/g, '')

      const rateLimitRes = enforceRateLimit(request, 'send_otp', RATE_LIMITS.OTP_SEND, cleanPhone)
      if (rateLimitRes) return rateLimitRes

      // Generate cryptographically secure 6-digit verification code
      const code = crypto.randomInt(100000, 1000000).toString()
      phoneOtpStore.set(cleanPhone, {
        code,
        expiresAt: Date.now() + 10 * 60 * 1000, // 10 minutes
      })

      console.log(`[Desktop Auth] Mobile verification code generated for ${cleanPhone}: ${code}`)

      // Dispatch SMS only if SMS_API_KEY is configured in server environment
      const smsApiKey = process.env.SMS_API_KEY
      let smsDispatched = false

      if (smsApiKey) {
        try {
          const smsMessage = encodeURIComponent(`Your PrintKoro verification code is: ${code}. Valid for 10 minutes.`)
          const smsUrl = `https://fraudchecker.link/api/v1/sms/?api_key=${smsApiKey}&number=${cleanPhone}&message=${smsMessage}`
          fetch(smsUrl)
            .then((r) => r.json())
            .then((d) => console.log(`[Desktop Auth] SMS dispatched to ${cleanPhone}:`, d))
            .catch((e) => console.warn('[Desktop Auth SMS Warning]:', e.message))
          smsDispatched = true
        } catch (e) {
          console.warn('[Desktop Auth SMS Dispatch Error]:', e.message)
        }
      } else {
        console.warn(`[Desktop Auth] SMS_API_KEY not configured. Verification code logged: ${code}`)
      }

      // Return success immediately with dev_otp if SMS gateway is not active
      return NextResponse.json({
        success: true,
        message: smsDispatched ? `Verification code sent to ${cleanPhone}` : `SMS simulated (Code: ${code})`,
        phone: cleanPhone,
        dev_otp: !smsDispatched ? code : undefined,
        sms_simulated: !smsDispatched,
      })
    }

    // -------------------------------------------------------------------------
    // 2. VERIFY OTP
    // -------------------------------------------------------------------------
    if (action === 'verify-otp') {
      const { phone, otp } = body
      if (!phone || !otp) {
        return NextResponse.json({ error: 'Phone and OTP code are required' }, { status: 400 })
      }

      const cleanPhone = phone.trim().replace(/[^0-9]/g, '')
      const cleanOtp = otp.trim()
      const stored = phoneOtpStore.get(cleanPhone)

      // Accept valid stored code or universal test fallback 123456
      const isValid = (stored && stored.code === cleanOtp && stored.expiresAt > Date.now()) || cleanOtp === '123456'

      if (!isValid) {
        return NextResponse.json({ error: 'Invalid or expired verification code. Use code 123456 or request a new code.' }, { status: 400 })
      }

      return NextResponse.json({
        success: true,
        message: 'Mobile number successfully verified!',
        phone: cleanPhone,
        verified: true,
      })
    }

    // -------------------------------------------------------------------------
    // 3. REGISTER SHOP & CREATE PASSWORD (STATUS: PENDING ADMIN APPROVAL)
    // -------------------------------------------------------------------------
    if (action === 'register') {
      const {
        name,
        shop_name,
        phone,
        location,
        operating_hours,
        password,
        type = 'shop',
        zone = 'campus',
        logo_url = '',
        shop_photo_url = '',
      } = body

      if (!name || !shop_name || !phone || !location || !password) {
        return NextResponse.json(
          { error: 'Required fields missing: owner name, shop name, phone, location, password' },
          { status: 400 }
        )
      }

      if (password.length < 6) {
        return NextResponse.json({ error: 'Password must be at least 6 characters long' }, { status: 400 })
      }

      const cleanPhone = phone.trim().replace(/[^0-9]/g, '')
      const reference_id = `QIK-REG-${crypto.randomInt(100000, 1000000)}`
      const resolvedHours = operating_hours || (type === 'kiosk' ? '24/7 Automated' : '09:00 AM - 10:00 PM')
      const targetTier = ZONE_TIERS[zone?.toLowerCase()] || ZONE_TIERS.campus
      const securePasswordHash = hashPassword(password)

      // 1. Create or register Device in public.devices with 'offline' status (valid device_status enum)
      let provisionedDevice = null
      const locationObj = {
        address: location,
        phone: cleanPhone,
        owner_name: name,
        shop_name: shop_name,
        type: type === 'kiosk' ? 'kiosk' : 'shop',
        zone: targetTier.name.toLowerCase(),
        pricing_tier_name: targetTier.name,
        pricing_tier_id: targetTier.id,
        operating_hours: resolvedHours,
        password: securePasswordHash,
        logo_url: logo_url || '',
        shop_photo_url: shop_photo_url || '',
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

      try {
        // Check if device with this phone already exists in public.devices
        const { data: existingDevs } = await supabase.from('devices').select('*')
        const match = (existingDevs || []).find(
          (d) => d.location && phonesMatch(d.location.phone, cleanPhone)
        )

        if (match) {
          const { data: upDev, error: upErr } = await supabase
            .from('devices')
            .update({
              name: type === 'kiosk' ? `PrintKoro Kiosk — ${shop_name}` : `PrintKoro Shop — ${shop_name}`,
              type: type === 'kiosk' ? 'kiosk' : 'shop',
              pricing_tier_id: targetTier.id,
              location: locationObj,
              status: 'offline',
            })
            .eq('id', match.id)
            .select()
            .single()

          if (!upErr && upDev) provisionedDevice = upDev
        } else {
          const { data: dbDev, error: devErr } = await supabase
            .from('devices')
            .insert([
              {
                name: type === 'kiosk' ? `PrintKoro Kiosk — ${shop_name}` : `PrintKoro Shop — ${shop_name}`,
                type: type === 'kiosk' ? 'kiosk' : 'shop',
                pricing_tier_id: targetTier.id,
                location: locationObj,
                status: 'offline', // Valid enum value
              }
            ])
            .select()
            .single()

          if (!devErr && dbDev) provisionedDevice = dbDev
        }
      } catch (e) {
        console.warn('Supabase device provision note:', e.message)
      }

      if (!provisionedDevice) {
        provisionedDevice = {
          id: `dev-${Date.now()}`,
          name: type === 'kiosk' ? `PrintKoro Kiosk — ${shop_name}` : `PrintKoro Shop — ${shop_name}`,
          type: type === 'kiosk' ? 'kiosk' : 'shop',
          pricing_tier_id: targetTier.id,
          location: locationObj,
          status: 'offline',
          created_at: new Date().toISOString(),
        }
      }

      // 2. Save shop account profile with status 'pending'
      const newAccount = {
        id: `account-${Date.now()}`,
        reference_id,
        deviceId: provisionedDevice.id,
        name,
        shop_name,
        phone: cleanPhone,
        location,
        type,
        zone: targetTier.name.toLowerCase(),
        pricing_tier_name: targetTier.name,
        pricing_tier_id: targetTier.id,
        operating_hours: resolvedHours,
        status: 'pending', // Requires admin approval
        rejection_reason: null,
        password: securePasswordHash,
        logo_url,
        shop_photo_url,
        verified: true,
        created_at: new Date().toISOString(),
      }

      // Remove any prior rejected / pending record for this phone to allow fresh re-registration
      memoryShopAccounts = memoryShopAccounts.filter((acc) => acc.phone !== cleanPhone)
      memoryShopAccounts.unshift(newAccount)

      // 3. Record in partners table using existing database columns only
      try {
        const { error: partErr } = await supabase.from('partners').insert([
          {
            name,
            shop_name,
            phone: cleanPhone,
            location,
            status: 'pending',
          }
        ])
        if (partErr) console.warn('Supabase partner insert note:', partErr.message)
      } catch (e) {
        console.warn('Supabase partner insert exception:', e.message)
      }

      // Security: Strip password from returned device and account
      const safeDevice = provisionedDevice ? {
        ...provisionedDevice,
        location: { ...(provisionedDevice.location || {}) }
      } : null
      if (safeDevice?.location?.password) delete safeDevice.location.password

      return NextResponse.json({
        success: true,
        pending: true,
        status: 'pending',
        message: 'Registration submitted successfully! Your application is pending admin approval.',
        account: {
          id: newAccount.id,
          reference_id: newAccount.reference_id,
          deviceId: provisionedDevice.id,
          name: newAccount.name,
          shop_name: newAccount.shop_name,
          phone: newAccount.phone,
          location: newAccount.location,
          type: newAccount.type,
          zone: newAccount.zone,
          pricing_tier_name: newAccount.pricing_tier_name,
          pricing_tier_id: newAccount.pricing_tier_id,
          operating_hours: newAccount.operating_hours,
          status: 'pending',
          logo_url: newAccount.logo_url,
          shop_photo_url: newAccount.shop_photo_url,
          created_at: newAccount.created_at,
        },
        device: safeDevice,
        contact: ADMIN_CONTACT,
      }, { status: 201 })
    }

    // -------------------------------------------------------------------------
    // 3B. UPDATE OPERATING ZONE & DYNAMIC PRICING TARIFF
    // -------------------------------------------------------------------------
    if (action === 'update-zone') {
      const { deviceId, zone = 'campus' } = body
      const targetTier = ZONE_TIERS[zone?.toLowerCase()] || ZONE_TIERS.campus

      if (deviceId) {
        try {
          const { data: dbDev } = await supabase
            .from('devices')
            .select('location')
            .eq('id', deviceId)
            .maybeSingle()

          const currentLoc = dbDev?.location || {}
          const updatedLoc = {
            ...currentLoc,
            zone: targetTier.name.toLowerCase(),
            pricing_tier_name: targetTier.name,
            pricing_tier_id: targetTier.id,
          }

          await supabase
            .from('devices')
            .update({
              pricing_tier_id: targetTier.id,
              location: updatedLoc,
            })
            .eq('id', deviceId)
        } catch (e) {
          console.warn('[update-zone supabase warning]:', e.message)
        }
      }

      return NextResponse.json({
        success: true,
        message: `Dynamic pricing zone updated to ${targetTier.name}`,
        zone: targetTier.name.toLowerCase(),
        tier: targetTier,
      })
    }

    // -------------------------------------------------------------------------
    // 4. LOGIN (MOBILE NUMBER + PASSWORD) — PERSISTENT DB FALLBACK
    // -------------------------------------------------------------------------
    if (action === 'login') {
      const { phone, password } = body
      if (!phone || !password) {
        return NextResponse.json({ error: 'Phone number and password are required' }, { status: 400 })
      }

      const cleanPhone = phone.trim().replace(/[^0-9]/g, '')

      const rateLimitRes = enforceRateLimit(request, 'login', RATE_LIMITS.LOGIN, cleanPhone)
      if (rateLimitRes) return rateLimitRes

      // 1. Fetch Supabase devices to authenticate persistently & check approvals
      let dbDevices = []
      let dbPartners = []
      try {
        const { data: dData } = await supabase
          .from('devices')
          .select('id, name, type, status, location, pricing_tier_id')
          .limit(100)
        dbDevices = dData || []
      } catch (dbErr) {
        console.warn('DB fetch in login error:', dbErr.message)
      }

      // 2. Check in-memory store
      let account = memoryShopAccounts.find(
        (acc) => phonesMatch(acc.phone, cleanPhone) && verifyPassword(password, acc.password)
      )

      // 3. Persistent Supabase devices fallback (survives dev server restarts)
      if (!account) {
        const matchingPhoneDevs = dbDevices.filter((d) => phonesMatch(d.location?.phone, cleanPhone))
        // Prioritize online / approved devices
        matchingPhoneDevs.sort((a, b) => {
          const aScore = (a.status === 'online' ? 2 : 0) + (a.location?.partner_status === 'approved' ? 2 : 0)
          const bScore = (b.status === 'online' ? 2 : 0) + (b.location?.partner_status === 'approved' ? 2 : 0)
          return bScore - aScore
        })

        // Find device that has valid password
        let candidateDev = matchingPhoneDevs.find((d) => verifyPassword(password, d.location?.password))

        // Transparently upgrade legacy plaintext password to secure scrypt hash
        if (candidateDev && candidateDev.location?.password && !candidateDev.location.password.startsWith('scrypt:')) {
          const updLoc = { ...(candidateDev.location || {}), password: hashPassword(password) }
          supabase.from('devices').update({ location: updLoc }).eq('id', candidateDev.id).catch(() => {})
        } else if (!candidateDev && matchingPhoneDevs.length > 0) {
          const legacyDev = matchingPhoneDevs.find((d) => !d.location?.password)
          if (legacyDev && password.length >= 6) {
            candidateDev = legacyDev
            const updLoc = { ...(candidateDev.location || {}), password: hashPassword(password) }
            supabase.from('devices').update({ location: updLoc }).eq('id', candidateDev.id).catch(() => {})
          }
        }

        if (candidateDev) {
          const loc = candidateDev.location || {}
          const isOnline = candidateDev.status === 'online'
          const partnerStatus = loc.partner_status || (isOnline ? 'approved' : 'pending')

          account = {
            id: candidateDev.id,
            deviceId: candidateDev.id,
            name: loc.owner_name || candidateDev.name,
            shop_name: loc.shop_name || candidateDev.name,
            phone: cleanPhone,
            location: loc.address || '',
            type: candidateDev.type || loc.type || 'shop',
            zone: loc.zone || 'campus',
            pricing_tier_name: loc.pricing_tier_name || 'Campus',
            pricing_tier_id: candidateDev.pricing_tier_id || loc.pricing_tier_id || null,
            operating_hours: loc.operating_hours || '09:00 AM - 10:00 PM',
            status: partnerStatus,
            rejection_reason: loc.rejection_reason || null,
            logo_url: loc.logo_url || '',
            shop_photo_url: loc.shop_photo_url || '',
            created_at: loc.created_at || new Date().toISOString(),
          }
          memoryShopAccounts.unshift(account)
        }
      }

      if (!account) {
        return NextResponse.json({ error: 'Invalid mobile number or password.' }, { status: 401 })
      }

      // Sync status from DB
      const matchingPhoneDevs = dbDevices.filter(
        (d) => (account.deviceId && d.id === account.deviceId) || phonesMatch(d.location?.phone, cleanPhone)
      )
      // Pick online/approved device if available
      matchingPhoneDevs.sort((a, b) => {
        const aScore = (a.status === 'online' ? 2 : 0) + (a.location?.partner_status === 'approved' ? 2 : 0)
        const bScore = (b.status === 'online' ? 2 : 0) + (b.location?.partner_status === 'approved' ? 2 : 0)
        return bScore - aScore
      })
      const matchingDev = matchingPhoneDevs[0]
      const dbPartner = dbPartners.find((p) => phonesMatch(p.phone, cleanPhone))

      const devPartnerStatus = matchingDev?.location?.partner_status
      const isOnlineApproved = matchingDev?.status === 'online' && devPartnerStatus !== 'pending' && devPartnerStatus !== 'rejected'

      if (devPartnerStatus === 'approved' || isOnlineApproved || dbPartner?.status === 'approved') {
        account.status = 'approved'
        if (matchingDev?.id) account.deviceId = matchingDev.id
      } else if (devPartnerStatus === 'rejected' || dbPartner?.status === 'rejected') {
        account.status = 'rejected'
        account.rejection_reason = matchingDev?.location?.rejection_reason || dbPartner?.rejection_reason || 'Storefront requirements not met.'
      } else if (devPartnerStatus === 'pending' || dbPartner?.status === 'pending') {
        account.status = 'pending'
      }

      // 4A: PENDING APPROVAL CHECK
      if (account.status === 'pending') {
        return NextResponse.json({
          success: false,
          pending: true,
          status: 'pending',
          error: 'Application Under Review. Quick Ink administration must approve your shop before dashboard access is granted.',
          account: {
            id: account.id,
            name: account.name,
            shop_name: account.shop_name,
            phone: account.phone,
            location: account.location,
            type: account.type,
            zone: account.zone || 'campus',
            pricing_tier_name: account.pricing_tier_name || 'Campus',
            pricing_tier_id: account.pricing_tier_id || null,
            status: 'pending',
            logo_url: account.logo_url,
            shop_photo_url: account.shop_photo_url,
            created_at: account.created_at,
          },
          contact: ADMIN_CONTACT,
        }, { status: 403 })
      }

      // 4B: REJECTED APPLICATION CHECK (MUST RE-REGISTER)
      if (account.status === 'rejected') {
        return NextResponse.json({
          success: false,
          rejected: true,
          status: 'rejected',
          error: 'Registration Not Approved. Your partner application was rejected by administration.',
          reason: account.rejection_reason || 'Application requirements not met or storefront details unverifiable.',
          account: {
            id: account.id,
            name: account.name,
            shop_name: account.shop_name,
            phone: account.phone,
            location: account.location,
            type: account.type,
            status: 'rejected',
            logo_url: account.logo_url,
            shop_photo_url: account.shop_photo_url,
          },
          contact: ADMIN_CONTACT,
        }, { status: 403 })
      }

      // 4C: SUSPENDED / CANCELLED PARTNERSHIP CHECK
      let isSuspended = account.status === 'suspended' || account.status === 'cancelled'
      let suspensionReason = account.suspension_reason || ''
      let suspendedAt = account.suspended_at || ''

      if (account.deviceId) {
        try {
          const { data: dbDev } = await supabase
            .from('devices')
            .select('*')
            .eq('id', account.deviceId)
            .maybeSingle()

          if (dbDev && (dbDev.status === 'suspended' || dbDev.status === 'cancelled')) {
            isSuspended = true
            suspensionReason = dbDev.location?.suspension_reason || 'Partnership cancelled by PrintKoro administration due to policy compliance or account review.'
            suspendedAt = dbDev.location?.suspended_at || new Date().toISOString()
          }
        } catch (e) {
          console.warn('Check device suspension note:', e.message)
        }
      }

      if (isSuspended) {
        return NextResponse.json({
          success: false,
          suspended: true,
          status: 'suspended',
          error: 'Partnership Suspended. Access to Quick Ink Terminal has been revoked by administration.',
          reason: suspensionReason || 'Administrative suspension due to policy violations or contract termination.',
          suspended_at: suspendedAt || new Date().toISOString(),
          shop_name: account.shop_name,
          deviceId: account.deviceId,
          contact: ADMIN_CONTACT,
        }, { status: 403 })
      }

      // 4D: APPROVED & ACTIVE -> GRANT ACCESS
      return NextResponse.json({
        success: true,
        status: 'approved',
        message: `Welcome back, ${account.name}!`,
        account: {
          id: account.id,
          deviceId: account.deviceId,
          name: account.name,
          shop_name: account.shop_name,
          phone: account.phone,
          location: account.location,
          type: account.type,
          zone: account.zone || 'campus',
          pricing_tier_name: account.pricing_tier_name || 'Campus',
          pricing_tier_id: account.pricing_tier_id || null,
          status: 'approved',
          logo_url: account.logo_url,
          shop_photo_url: account.shop_photo_url,
        },
        deviceId: account.deviceId,
      })
    }

    // -------------------------------------------------------------------------
    // 5. CHECK REALTIME STATUS (APPROVAL, REJECTION, OR SUSPENSION)
    // -------------------------------------------------------------------------
    if (action === 'check-status') {
      const { deviceId, phone } = body
      const result = await resolveAccountStatus(phone, deviceId)
      return NextResponse.json(result)
    }

    // -------------------------------------------------------------------------
    // 6. ADMIN ACTIONS (AUTHENTICATED SYNC FROM ADMIN APP ONLY)
    // -------------------------------------------------------------------------
    if (action === 'admin-approve') {
      if (!verifyAdminAuth(request)) {
        return NextResponse.json({ error: 'Unauthorized administrative action' }, { status: 401 })
      }
      const { phone, deviceId: approvedDevId } = body
      const cleanPhone = phone ? phone.trim().replace(/[^0-9]/g, '') : ''
      const acc = memoryShopAccounts.find((a) => a.phone === cleanPhone || (approvedDevId && a.deviceId === approvedDevId))
      if (acc) {
        acc.status = 'approved'
        if (approvedDevId) acc.deviceId = approvedDevId
      }
      const safeAcc = acc ? { ...acc } : null
      if (safeAcc) delete safeAcc.password
      return NextResponse.json({ success: true, message: 'Account approved in memory store', account: safeAcc })
    }

    if (action === 'admin-reject') {
      if (!verifyAdminAuth(request)) {
        return NextResponse.json({ error: 'Unauthorized administrative action' }, { status: 401 })
      }
      const { phone, reason } = body
      const cleanPhone = phone ? phone.trim().replace(/[^0-9]/g, '') : ''
      const acc = memoryShopAccounts.find((a) => a.phone === cleanPhone)
      if (acc) {
        acc.status = 'rejected'
        acc.rejection_reason = reason || 'Requirements not fulfilled'
      }
      const safeAcc = acc ? { ...acc } : null
      if (safeAcc) delete safeAcc.password
      return NextResponse.json({ success: true, message: 'Account rejected in memory store', account: safeAcc })
    }

    // -------------------------------------------------------------------------
    // 7. PASSWORD RESET — STEP 1: Send OTP after verifying phone exists
    // -------------------------------------------------------------------------
    if (action === 'reset-password-send-otp') {
      const { phone } = body
      if (!phone || phone.trim().length < 10) {
        return NextResponse.json({ error: 'Valid 11-digit mobile number is required' }, { status: 400 })
      }

      const cleanPhone = phone.trim().replace(/[^0-9]/g, '')

      const rateLimitRes = enforceRateLimit(request, 'reset_otp', RATE_LIMITS.PASSWORD_RESET, cleanPhone)
      if (rateLimitRes) return rateLimitRes

      // Verify the phone number belongs to a registered account
      const memAcc = memoryShopAccounts.find((a) => phonesMatch(a.phone, cleanPhone))
      let foundInDb = false

      if (!memAcc) {
        try {
          const { data: dbDevices } = await supabase.from('devices').select('id, location, status')
          foundInDb = (dbDevices || []).some((d) => phonesMatch(d.location?.phone, cleanPhone))
        } catch (e) {
          console.warn('[Reset OTP] DB check note:', e.message)
        }
      }

      if (!memAcc && !foundInDb) {
        return NextResponse.json({ error: 'No registered account found with this phone number.' }, { status: 404 })
      }

      // Generate & store cryptographically secure OTP
      const code = crypto.randomInt(100000, 1000000).toString()
      phoneOtpStore.set(`reset:${cleanPhone}`, {
        code,
        expiresAt: Date.now() + 10 * 60 * 1000, // 10 minutes
      })

      console.log(`[Reset OTP] Password reset code for ${cleanPhone}: ${code}`)

      // Dispatch SMS only if SMS_API_KEY is configured in server environment
      const smsApiKey = process.env.SMS_API_KEY
      let smsDispatched = false
      if (smsApiKey) {
        try {
          const smsMessage = encodeURIComponent(`PrintKoro Password Reset: Your verification code is ${code}. Valid for 10 minutes. Do NOT share this code.`)
          const smsUrl = `https://fraudchecker.link/api/v1/sms/?api_key=${smsApiKey}&number=${cleanPhone}&message=${smsMessage}`
          fetch(smsUrl)
            .then((r) => r.json())
            .then((d) => console.log(`[Reset OTP] SMS sent to ${cleanPhone}:`, d))
            .catch((e) => console.warn('[Reset OTP SMS Warning]:', e.message))
          smsDispatched = true
        } catch (e) {
          console.warn('[Reset OTP SMS Dispatch Error]:', e.message)
        }
      } else {
        console.warn(`[Reset OTP] SMS_API_KEY not configured. Password reset code logged: ${code}`)
      }

      return NextResponse.json({
        success: true,
        message: smsDispatched ? `Password reset code sent to ${cleanPhone}. Check your SMS.` : `SMS simulated (Code: ${code})`,
        phone: cleanPhone,
        dev_otp: !smsDispatched ? code : undefined,
        sms_simulated: !smsDispatched,
      })
    }

    // -------------------------------------------------------------------------
    // 8. PASSWORD RESET — STEP 2: Verify OTP
    // -------------------------------------------------------------------------
    if (action === 'reset-verify-otp') {
      const { phone, otp } = body
      if (!phone || !otp) {
        return NextResponse.json({ error: 'Phone and OTP are required' }, { status: 400 })
      }

      const cleanPhone = phone.trim().replace(/[^0-9]/g, '')

      const verifyRateLimitRes = enforceRateLimit(request, 'verify_reset_otp', RATE_LIMITS.OTP_VERIFY, cleanPhone)
      if (verifyRateLimitRes) return verifyRateLimitRes

      const stored = phoneOtpStore.get(`reset:${cleanPhone}`)
      const isValid = (stored && stored.code === otp.trim() && stored.expiresAt > Date.now()) || otp.trim() === '123456'

      if (!isValid) {
        return NextResponse.json({ error: 'Invalid or expired code. Use code 123456 or request a new one.' }, { status: 400 })
      }

      // Mark OTP as verified (keep it so reset-password step can confirm)
      phoneOtpStore.set(`reset-verified:${cleanPhone}`, { verified: true, expiresAt: stored.expiresAt })

      return NextResponse.json({ success: true, verified: true, phone: cleanPhone, message: 'OTP verified! You can now set a new password.' })
    }

    // -------------------------------------------------------------------------
    // 9. PASSWORD RESET — STEP 3: Set new password
    // -------------------------------------------------------------------------
    if (action === 'reset-password') {
      const { phone, newPassword } = body
      if (!phone || !newPassword) {
        return NextResponse.json({ error: 'Phone and new password are required' }, { status: 400 })
      }
      if (newPassword.length < 6) {
        return NextResponse.json({ error: 'Password must be at least 6 characters long' }, { status: 400 })
      }

      const cleanPhone = phone.trim().replace(/[^0-9]/g, '')

      // Ensure OTP was verified
      const verifiedEntry = phoneOtpStore.get(`reset-verified:${cleanPhone}`)
      if (!verifiedEntry || verifiedEntry.expiresAt < Date.now()) {
        return NextResponse.json({ error: 'OTP verification expired. Please start over.' }, { status: 400 })
      }

      const secureNewHash = hashPassword(newPassword)

      // Update password in memory store
      const memAcc = memoryShopAccounts.find((a) => phonesMatch(a.phone, cleanPhone))
      if (memAcc) {
        memAcc.password = secureNewHash
      }

      // Update password in devices table (stored as secure hash in location JSONB for matching devices)
      try {
        const { data: dbDevices } = await supabase.from('devices').select('id, location')
        const matchingDevs = (dbDevices || []).filter((d) => phonesMatch(d.location?.phone, cleanPhone))
        for (const matchDev of matchingDevs) {
          const updatedLoc = { ...(matchDev.location || {}), password: secureNewHash }
          await supabase.from('devices').update({ location: updatedLoc }).eq('id', matchDev.id)
        }
      } catch (e) {
        console.warn('[Reset Password] DB update note:', e.message)
      }

      // Clear OTP tokens
      phoneOtpStore.delete(`reset:${cleanPhone}`)
      phoneOtpStore.delete(`reset-verified:${cleanPhone}`)

      return NextResponse.json({ success: true, message: 'Password updated successfully! You can now sign in with your new password.' })
    }

    return NextResponse.json({ error: 'Unknown action specified' }, { status: 400 })
  } catch (err) {
    console.error('[DesktopAuth] POST error:', err)
    return NextResponse.json({ error: 'Authentication service error.' }, { status: 500 })
  }
}

/**
 * Shared helper to resolve account approval status from Supabase devices & partners tables
 */
async function resolveAccountStatus(phone, deviceId) {
  const cleanPhone = phone ? phone.trim().replace(/[^0-9]/g, '') : ''

  let currentStatus = 'pending'
  let reason = ''
  let suspendedAt = ''
  let provisionedDeviceId = deviceId || ''

  try {
    const [{ data: dbPartners }, { data: dbDevices }] = await Promise.all([
      supabase.from('partners').select('*'),
      supabase.from('devices').select('*'),
    ])

    const partner = (dbPartners || []).find((p) => {
      return (cleanPhone && phonesMatch(p.phone, cleanPhone)) || (deviceId && p.id === deviceId)
    })

    const dev = (dbDevices || []).find((d) => {
      return (cleanPhone && phonesMatch(d.location?.phone, cleanPhone)) || (deviceId && d.id === deviceId)
    })

    if (dev) {
      provisionedDeviceId = dev.id
      const partnerStatus = dev.location?.partner_status

      if (dev.status === 'suspended' || dev.status === 'cancelled') {
        currentStatus = 'suspended'
        reason = dev.location?.suspension_reason || 'Partnership suspended by PrintKoro administration'
        suspendedAt = dev.location?.suspended_at || ''
      } else if (partnerStatus === 'rejected') {
        currentStatus = 'rejected'
        reason = dev.location?.rejection_reason || 'Application rejected by administration.'
      } else if (partnerStatus === 'approved' || (dev.status === 'online' && partnerStatus !== 'pending')) {
        currentStatus = 'approved'
      } else if (partnerStatus === 'pending') {
        currentStatus = 'pending'
      }
    }

    if (partner && currentStatus === 'pending') {
      if (partner.status === 'approved') {
        currentStatus = 'approved'
      } else if (partner.status === 'rejected') {
        currentStatus = 'rejected'
        reason = partner.rejection_reason || reason || 'Application rejected by administration.'
      } else if (partner.status === 'pending') {
        currentStatus = 'pending'
      }
    }
  } catch (e) {
    console.warn('Status resolve note:', e.message)
  }

  // Memory store fallback/sync
  if (cleanPhone) {
    const memAcc = memoryShopAccounts.find((a) => phonesMatch(a.phone, cleanPhone))
    if (memAcc) {
      if (currentStatus !== 'pending') {
        memAcc.status = currentStatus
        if (reason) memAcc.rejection_reason = reason
        if (provisionedDeviceId) memAcc.deviceId = provisionedDeviceId
      } else if (memAcc.status) {
        currentStatus = memAcc.status
        reason = memAcc.rejection_reason || reason
      }
    }
  }

  return {
    success: true,
    status: currentStatus,
    pending: currentStatus === 'pending',
    approved: currentStatus === 'approved' || currentStatus === 'online',
    rejected: currentStatus === 'rejected',
    suspended: currentStatus === 'suspended' || currentStatus === 'cancelled',
    reason,
    suspended_at: suspendedAt,
    deviceId: provisionedDeviceId,
    contact: ADMIN_CONTACT,
  }
}

/**
 * GET /api/desktop/auth?action=check-status&deviceId=...&phone=...
 * Real-time station approval & status check for desktop app
 */
export async function GET(request) {
  try {
    const { searchParams } = new URL(request.url)
    const action = searchParams.get('action') || 'check-status'
    const deviceId = searchParams.get('deviceId')
    const phone = searchParams.get('phone')

    if (action === 'list-accounts') {
      if (!verifyAdminAuth(request)) {
        return NextResponse.json({ error: 'Unauthorized administrative access' }, { status: 401 })
      }
      const sanitized = memoryShopAccounts.map((a) => {
        const copy = { ...a }
        delete copy.password
        return copy
      })
      return NextResponse.json({ success: true, accounts: sanitized })
    }

    if (action === 'check-status') {
      const result = await resolveAccountStatus(phone, deviceId)
      return NextResponse.json(result)
    }

    return NextResponse.json({ success: true, message: 'PrintKoro Desktop Auth API Ready', contact: ADMIN_CONTACT })
  } catch (err) {
    console.error('[DesktopAuth] GET error:', err)
    return NextResponse.json({ error: 'Service error.' }, { status: 500 })
  }
}



