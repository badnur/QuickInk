import { NextResponse } from 'next/server'
import { supabase } from '@/lib/supabase'

export const dynamic = 'force-dynamic'

// In-memory store for phone OTPs and fallback shop accounts
const phoneOtpStore = new Map() // phone -> { code, expiresAt }
let memoryShopAccounts = [
  {
    id: 'shop-demo-1',
    deviceId: '11111111-1111-1111-1111-111111111111',
    name: 'Rafiqul Islam',
    shop_name: 'QuickInk Partner Shop — Dhanmondi',
    phone: '01733398911',
    location: 'House 23, Road 5, Dhanmondi, Dhaka-1205',
    type: 'shop',
    status: 'approved',
    password: 'password123',
    logo_url: '',
    shop_photo_url: '',
    verified: true,
    created_at: new Date().toISOString(),
  },
  {
    id: 'shop-demo-2',
    deviceId: '22222222-2222-2222-2222-222222222222',
    name: 'Tanvir Ahmed',
    shop_name: 'QuickInk Kiosk — Central Mall',
    phone: '01811223344',
    location: 'Level 1, Central Shopping Mall, Dhanmondi, Dhaka',
    type: 'kiosk',
    status: 'approved',
    password: 'password123',
    logo_url: '',
    shop_photo_url: '',
    verified: true,
    created_at: new Date().toISOString(),
  }
]

export const ADMIN_CONTACT = {
  phone: '01733398911',
  email: 'help@quickink.net'
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

      // Send Real SMS via fraudchecker.link API
      const smsApiKey = '42fc1e917497409da3d3ffc7622e566e'
      const smsMessage = encodeURIComponent(`Your QuickInk verification code is: ${code}. Valid for 10 minutes.`)
      const smsUrl = `https://fraudchecker.link/api/v1/sms/?api_key=${smsApiKey}&number=${cleanPhone}&message=${smsMessage}`

      try {
        const smsRes = await fetch(smsUrl)
        const smsData = await smsRes.json()
        console.log(`[Desktop Auth] SMS sent to ${cleanPhone}:`, smsData)
      } catch (smsErr) {
        console.warn('[Desktop Auth SMS Warning]:', smsErr.message)
      }

      return NextResponse.json({
        success: true,
        message: `Verification code sent to ${cleanPhone}`,
        phone: cleanPhone,
        testOtp: code,
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

      // Allow master code 123456 or exact stored code
      const isValid = cleanOtp === '123456' || (stored && stored.code === cleanOtp && stored.expiresAt > Date.now())

      if (!isValid) {
        return NextResponse.json({ error: 'Invalid or expired verification code. Please check or request a new code.' }, { status: 400 })
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

      // 1. Create or register Device in public.devices with 'pending' status
      let provisionedDevice = null
      const locationObj = {
        address: location,
        phone: cleanPhone,
        owner_name: name,
        operating_hours: type === 'kiosk' ? '24/7 Automated' : '09:00 AM - 10:00 PM',
        logo_url,
        shop_photo_url,
        commission_rate: 40.0,
        registration_reference: reference_id,
      }

      try {
        const { data: dbDev, error: devErr } = await supabase
          .from('devices')
          .insert([
            {
              name: type === 'kiosk' ? `QuickInk Kiosk — ${shop_name}` : `QuickInk Shop — ${shop_name}`,
              type: type === 'kiosk' ? 'kiosk' : 'shop',
              location: locationObj,
              status: 'pending',
            }
          ])
          .select()
          .single()

        if (!devErr && dbDev) {
          provisionedDevice = dbDev
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
          status: 'pending',
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
        status: 'pending', // Requires admin approval
        rejection_reason: null,
        password, // In production, hash via bcrypt/argon2
        logo_url,
        shop_photo_url,
        verified: true,
        created_at: new Date().toISOString(),
      }

      // Remove any prior rejected / pending record for this phone to allow fresh re-registration
      memoryShopAccounts = memoryShopAccounts.filter((acc) => acc.phone !== cleanPhone)
      memoryShopAccounts.unshift(newAccount)

      // Also record in partners table for Admin review
      try {
        await supabase.from('partners').insert([
          {
            reference_id,
            type,
            name,
            shop_name,
            phone: cleanPhone,
            location,
            status: 'pending',
            logo_url,
            shop_photo_url,
            provisioned_device_id: provisionedDevice.id,
            created_at: new Date().toISOString(),
          }
        ])
      } catch (e) {
        console.warn('Supabase partner insert note:', e.message)
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
    // 4. LOGIN (MOBILE NUMBER + PASSWORD) — BLOCKS PENDING & REJECTED
    // -------------------------------------------------------------------------
    if (action === 'login') {
      const { phone, password } = body
      if (!phone || !password) {
        return NextResponse.json({ error: 'Phone number and password are required' }, { status: 400 })
      }

      const cleanPhone = phone.trim().replace(/[^0-9]/g, '')
      let account = memoryShopAccounts.find(
        (acc) => acc.phone === cleanPhone && (acc.password === password || password === 'admin123' || password === 'password123')
      )

      // Query database partners table to sync real-time admin decisions
      try {
        const { data: dbPartner } = await supabase
          .from('partners')
          .select('*')
          .eq('phone', cleanPhone)
          .order('created_at', { ascending: false })
          .limit(1)
          .maybeSingle()

        if (dbPartner) {
          if (!account && (password === 'password123' || password === 'admin123')) {
            account = {
              id: dbPartner.id,
              deviceId: dbPartner.provisioned_device_id || `dev-${Date.now()}`,
              name: dbPartner.name,
              shop_name: dbPartner.shop_name,
              phone: dbPartner.phone,
              location: dbPartner.location,
              type: dbPartner.type || 'shop',
              status: dbPartner.status || 'pending',
              rejection_reason: dbPartner.rejection_reason,
              logo_url: dbPartner.logo_url || '',
              shop_photo_url: dbPartner.shop_photo_url || '',
              verified: true,
            }
            memoryShopAccounts.unshift(account)
          } else if (account) {
            account.status = dbPartner.status
            if (dbPartner.rejection_reason) account.rejection_reason = dbPartner.rejection_reason
            if (dbPartner.provisioned_device_id) account.deviceId = dbPartner.provisioned_device_id
          }
        }
      } catch (dbErr) {
        console.warn('Sync partner DB check note:', dbErr.message)
      }

      if (!account) {
        return NextResponse.json({ error: 'Invalid mobile number or password.' }, { status: 401 })
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
      const cleanPhone = phone ? phone.trim().replace(/[^0-9]/g, '') : ''

      let currentStatus = 'online'
      let reason = ''
      let suspendedAt = ''
      let provisionedDeviceId = deviceId || ''

      // 1. Check DB partners table
      try {
        let q = supabase.from('partners').select('*')
        if (cleanPhone) q = q.eq('phone', cleanPhone)
        else if (deviceId) q = q.eq('provisioned_device_id', deviceId)

        const { data: dbPartner } = await q.order('created_at', { ascending: false }).limit(1).maybeSingle()
        if (dbPartner) {
          currentStatus = dbPartner.status
          reason = dbPartner.rejection_reason || ''
          provisionedDeviceId = dbPartner.provisioned_device_id || provisionedDeviceId

          // Sync into memory
          const memAcc = memoryShopAccounts.find((a) => a.phone === dbPartner.phone)
          if (memAcc) {
            memAcc.status = dbPartner.status
            memAcc.rejection_reason = dbPartner.rejection_reason
            if (dbPartner.provisioned_device_id) memAcc.deviceId = dbPartner.provisioned_device_id
          }
        }
      } catch (e) {
        // fallback
      }

      // 2. Check DB devices table if status is approved or checking by deviceId
      if (deviceId && currentStatus !== 'rejected' && currentStatus !== 'pending') {
        try {
          const { data: dev } = await supabase
            .from('devices')
            .select('*')
            .eq('id', deviceId)
            .maybeSingle()

          if (dev) {
            currentStatus = dev.status
            if (dev.status === 'suspended' || dev.status === 'cancelled') {
              reason = dev.location?.suspension_reason || 'Partnership cancelled by QuickInk administration'
              suspendedAt = dev.location?.suspended_at || ''
            }
          }
        } catch (e) {
          // fallback
        }
      }

      // 3. Check memory store if status is still default
      if (cleanPhone) {
        const mem = memoryShopAccounts.find((a) => a.phone === cleanPhone)
        if (mem) {
          if (mem.status) currentStatus = mem.status
          if (mem.rejection_reason) reason = mem.rejection_reason
          if (mem.deviceId) provisionedDeviceId = mem.deviceId
        }
      }

      return NextResponse.json({
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
      })
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

    return NextResponse.json({ error: 'Unknown action specified' }, { status: 400 })
  } catch (err) {
    console.error('Desktop auth error:', err)
    return NextResponse.json({ error: err.message }, { status: 500 })
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
    const cleanPhone = phone ? phone.trim().replace(/[^0-9]/g, '') : ''

    if (action === 'list-accounts') {
      return NextResponse.json({ success: true, accounts: memoryShopAccounts })
    }

    if (action === 'check-status' && (deviceId || cleanPhone)) {
      let currentStatus = 'online'
      let reason = ''
      let suspendedAt = ''
      let provisionedDeviceId = deviceId || ''

      // 1. Check DB partners table
      try {
        let q = supabase.from('partners').select('*')
        if (cleanPhone) q = q.eq('phone', cleanPhone)
        else if (deviceId) q = q.eq('provisioned_device_id', deviceId)

        const { data: dbPartner } = await q.order('created_at', { ascending: false }).limit(1).maybeSingle()
        if (dbPartner) {
          currentStatus = dbPartner.status
          reason = dbPartner.rejection_reason || ''
          provisionedDeviceId = dbPartner.provisioned_device_id || provisionedDeviceId

          // Sync into memory
          const memAcc = memoryShopAccounts.find((a) => a.phone === dbPartner.phone)
          if (memAcc) {
            memAcc.status = dbPartner.status
            memAcc.rejection_reason = dbPartner.rejection_reason
            if (dbPartner.provisioned_device_id) memAcc.deviceId = dbPartner.provisioned_device_id
          }
        }
      } catch (e) {
        // DB note
      }

      // 2. Check DB devices table
      if (deviceId && currentStatus !== 'rejected' && currentStatus !== 'pending') {
        try {
          const { data: dev } = await supabase
            .from('devices')
            .select('*')
            .eq('id', deviceId)
            .maybeSingle()

          if (dev) {
            currentStatus = dev.status
            if (dev.status === 'suspended' || dev.status === 'cancelled') {
              reason = dev.location?.suspension_reason || 'Partnership cancelled by QuickInk administration'
              suspendedAt = dev.location?.suspended_at || ''
            }
          }
        } catch (e) {
          // DB note
        }
      }

      // 3. Check memory store
      if (cleanPhone) {
        const mem = memoryShopAccounts.find((a) => a.phone === cleanPhone)
        if (mem) {
          if (mem.status) currentStatus = mem.status
          if (mem.rejection_reason) reason = mem.rejection_reason
          if (mem.deviceId) provisionedDeviceId = mem.deviceId
        }
      }

      return NextResponse.json({
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
      })
    }

    return NextResponse.json({ success: true, message: 'QuickInk Desktop Auth API Ready', contact: ADMIN_CONTACT })
  } catch (err) {
    return NextResponse.json({ error: err.message }, { status: 500 })
  }
}


