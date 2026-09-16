import { NextResponse } from 'next/server'
import { supabase } from '@/lib/supabase'

export const dynamic = 'force-dynamic'

// In-memory store for phone OTPs and fallback shop accounts
const phoneOtpStore = new Map() // phone -> { code, expiresAt }
let memoryShopAccounts = []

export const ADMIN_CONTACT = {
  phone: '01733398911',
  email: 'help@quickink.net'
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
      // Generate 6-digit verification code
      const code = Math.floor(100000 + Math.random() * 900000).toString()
      phoneOtpStore.set(cleanPhone, {
        code,
        expiresAt: Date.now() + 10 * 60 * 1000, // 10 minutes
      })

      console.log(`[Desktop Auth] Mobile verification code generated for ${cleanPhone}: ${code}`)

      // Fire-and-forget: Send SMS without blocking the response
      const smsApiKey = '42fc1e917497409da3d3ffc7622e566e'
      const smsMessage = encodeURIComponent(`Your QuickInk verification code is: ${code}. Valid for 10 minutes.`)
      const smsUrl = `https://fraudchecker.link/api/v1/sms/?api_key=${smsApiKey}&number=${cleanPhone}&message=${smsMessage}`

      fetch(smsUrl)
        .then((r) => r.json())
        .then((d) => console.log(`[Desktop Auth] SMS dispatched to ${cleanPhone}:`, d))
        .catch((e) => console.warn('[Desktop Auth SMS Warning]:', e.message))

      // Return success immediately — don't wait for SMS delivery
      return NextResponse.json({
        success: true,
        message: `Verification code sent to ${cleanPhone}`,
        phone: cleanPhone,
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

      const isValid = stored && stored.code === cleanOtp && stored.expiresAt > Date.now()

      if (!isValid) {
        return NextResponse.json({ error: 'Invalid or expired verification code. Please check your SMS or request a new code.' }, { status: 400 })
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
      const reference_id = `QIK-REG-${Math.floor(100000 + Math.random() * 900000)}`
      const resolvedHours = operating_hours || (type === 'kiosk' ? '24/7 Automated' : '09:00 AM - 10:00 PM')

      // 1. Create or register Device in public.devices with 'offline' status (valid device_status enum)
      let provisionedDevice = null
      const locationObj = {
        address: location,
        phone: cleanPhone,
        owner_name: name,
        shop_name: shop_name,
        type: type === 'kiosk' ? 'kiosk' : 'shop',
        operating_hours: resolvedHours,
        password: password,
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
              name: type === 'kiosk' ? `QuickInk Kiosk — ${shop_name}` : `QuickInk Shop — ${shop_name}`,
              type: type === 'kiosk' ? 'kiosk' : 'shop',
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
                name: type === 'kiosk' ? `QuickInk Kiosk — ${shop_name}` : `QuickInk Shop — ${shop_name}`,
                type: type === 'kiosk' ? 'kiosk' : 'shop',
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
          name: type === 'kiosk' ? `QuickInk Kiosk — ${shop_name}` : `QuickInk Shop — ${shop_name}`,
          type: type === 'kiosk' ? 'kiosk' : 'shop',
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
        operating_hours: resolvedHours,
        status: 'pending', // Requires admin approval
        rejection_reason: null,
        password,
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
          operating_hours: newAccount.operating_hours,
          status: 'pending',
          logo_url: newAccount.logo_url,
          shop_photo_url: newAccount.shop_photo_url,
          created_at: newAccount.created_at,
        },
        device: provisionedDevice,
        contact: ADMIN_CONTACT,
      }, { status: 201 })
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

      // 1. Fetch Supabase devices & partners to authenticate persistently & check approvals
      let dbDevices = []
      let dbPartners = []
      try {
        const [{ data: pData }, { data: dData }] = await Promise.all([
          supabase.from('partners').select('*'),
          supabase.from('devices').select('*'),
        ])
        dbPartners = pData || []
        dbDevices = dData || []
      } catch (dbErr) {
        console.warn('DB fetch in login error:', dbErr.message)
      }

      // 2. Check in-memory store
      let account = memoryShopAccounts.find(
        (acc) => phonesMatch(acc.phone, cleanPhone) && acc.password === password
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

        // Find device that has this password
        let candidateDev = matchingPhoneDevs.find((d) => d.location?.password === password)

        // Fallback for legacy registered devices where password was only in memory:
        // If device has no password yet but user enters password >= 6 chars, assign & persist
        if (!candidateDev && matchingPhoneDevs.length > 0) {
          const legacyDev = matchingPhoneDevs.find((d) => !d.location?.password)
          if (legacyDev && password.length >= 6) {
            candidateDev = legacyDev
            const updLoc = { ...(candidateDev.location || {}), password }
            supabase.from('devices').update({ location: updLoc }).eq('id', candidateDev.id).then(() => {})
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
            operating_hours: loc.operating_hours || '09:00 AM - 10:00 PM',
            status: partnerStatus,
            rejection_reason: loc.rejection_reason || null,
            password: password,
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
            suspensionReason = dbDev.location?.suspension_reason || 'Partnership cancelled by QuickInk administration due to policy compliance or account review.'
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
    // 6. ADMIN ACTIONS (DIRECT SYNC FROM ADMIN APP)
    // -------------------------------------------------------------------------
    if (action === 'admin-approve') {
      const { phone, deviceId: approvedDevId } = body
      const cleanPhone = phone ? phone.trim().replace(/[^0-9]/g, '') : ''
      const acc = memoryShopAccounts.find((a) => a.phone === cleanPhone || (approvedDevId && a.deviceId === approvedDevId))
      if (acc) {
        acc.status = 'approved'
        if (approvedDevId) acc.deviceId = approvedDevId
      }
      return NextResponse.json({ success: true, message: 'Account approved in memory store', account: acc })
    }

    if (action === 'admin-reject') {
      const { phone, reason } = body
      const cleanPhone = phone ? phone.trim().replace(/[^0-9]/g, '') : ''
      const acc = memoryShopAccounts.find((a) => a.phone === cleanPhone)
      if (acc) {
        acc.status = 'rejected'
        acc.rejection_reason = reason || 'Requirements not fulfilled'
      }
      return NextResponse.json({ success: true, message: 'Account rejected in memory store', account: acc })
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

      // Generate & store OTP
      const code = Math.floor(100000 + Math.random() * 900000).toString()
      phoneOtpStore.set(`reset:${cleanPhone}`, {
        code,
        expiresAt: Date.now() + 10 * 60 * 1000, // 10 minutes
      })

      console.log(`[Reset OTP] Password reset code for ${cleanPhone}: ${code}`)

      // Send SMS
      const smsApiKey = '42fc1e917497409da3d3ffc7622e566e'
      const smsMessage = encodeURIComponent(`QuickInk Password Reset: Your verification code is ${code}. Valid for 10 minutes. Do NOT share this code.`)
      const smsUrl = `https://fraudchecker.link/api/v1/sms/?api_key=${smsApiKey}&number=${cleanPhone}&message=${smsMessage}`
      fetch(smsUrl)
        .then((r) => r.json())
        .then((d) => console.log(`[Reset OTP] SMS sent to ${cleanPhone}:`, d))
        .catch((e) => console.warn('[Reset OTP SMS Warning]:', e.message))

      return NextResponse.json({
        success: true,
        message: `Password reset code sent to ${cleanPhone}. Check your SMS.`,
        phone: cleanPhone,
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
      const stored = phoneOtpStore.get(`reset:${cleanPhone}`)
      const isValid = stored && stored.code === otp.trim() && stored.expiresAt > Date.now()

      if (!isValid) {
        return NextResponse.json({ error: 'Invalid or expired code. Please request a new one.' }, { status: 400 })
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

      // Update password in memory store
      const memAcc = memoryShopAccounts.find((a) => phonesMatch(a.phone, cleanPhone))
      if (memAcc) {
        memAcc.password = newPassword
      }

      // Update password in devices table (stored in location JSONB for ALL matching devices)
      try {
        const { data: dbDevices } = await supabase.from('devices').select('id, location')
        const matchingDevs = (dbDevices || []).filter((d) => phonesMatch(d.location?.phone, cleanPhone))
        for (const matchDev of matchingDevs) {
          const updatedLoc = { ...(matchDev.location || {}), password: newPassword }
          await supabase.from('devices').update({ location: updatedLoc }).eq('id', matchDev.id)
        }

        // Also update partners table if it has a password column
        await supabase.from('partners').update({ password: newPassword }).eq('phone', cleanPhone)
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
    console.error('Desktop auth error:', err)
    return NextResponse.json({ error: err.message }, { status: 500 })
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
        reason = dev.location?.suspension_reason || 'Partnership suspended by QuickInk administration'
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
      return NextResponse.json({ success: true, accounts: memoryShopAccounts })
    }

    if (action === 'check-status') {
      const result = await resolveAccountStatus(phone, deviceId)
      return NextResponse.json(result)
    }

    return NextResponse.json({ success: true, message: 'QuickInk Desktop Auth API Ready', contact: ADMIN_CONTACT })
  } catch (err) {
    return NextResponse.json({ error: err.message }, { status: 500 })
  }
}



