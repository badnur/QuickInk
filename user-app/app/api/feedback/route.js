import { NextResponse } from 'next/server'
import { supabase } from '@/lib/supabase'
import { enforceRateLimit, RATE_LIMITS } from '@/lib/rate-limiter'

export const dynamic = 'force-dynamic'

// Shared in-memory fallback buffer (holds last 100 feedbacks)
const memoryFeedbacks = []

function maskPhone(phone) {
  if (!phone || typeof phone !== 'string') return null
  const cleaned = phone.trim()
  if (cleaned.length < 7) return '***'
  return cleaned.slice(0, 3) + '****' + cleaned.slice(-4)
}

function verifyAdmin(request) {
  const authHeader = request.headers.get('authorization')
  if (!authHeader || !authHeader.startsWith('Bearer ')) return false
  const token = authHeader.substring(7).trim()
  const adminSecret = process.env.ADMIN_JWT_SECRET || process.env.JWT_SECRET
  return Boolean(adminSecret && token === adminSecret)
}

export async function POST(request) {
  try {
    const rateLimitRes = enforceRateLimit(request, 'feedback', RATE_LIMITS.FEEDBACK)
    if (rateLimitRes) return rateLimitRes

    const body = await request.json()
    const {
      jobId = null,
      otpCode = null,
      deviceId = null,
      rating = 5,
      tags = [],
      message = '',
      userPhone = null,
    } = body

    const parsedRating = Math.max(1, Math.min(5, parseInt(rating, 10) || 5))
    const cleanMessage = typeof message === 'string' ? message.slice(0, 1000).trim() : ''
    const cleanPhone = typeof userPhone === 'string' ? userPhone.slice(0, 20).trim() : null
    const cleanTags = Array.isArray(tags)
      ? tags.filter((t) => typeof t === 'string').map((t) => t.slice(0, 50)).slice(0, 10)
      : []

    const feedbackItem = {
      id: `fb_${Date.now()}_${Math.random().toString(36).substring(2, 7)}`,
      job_id: typeof jobId === 'string' ? jobId.slice(0, 64) : null,
      otp_code: typeof otpCode === 'string' ? otpCode.slice(0, 10) : null,
      device_id: typeof deviceId === 'string' ? deviceId.slice(0, 64) : null,
      rating: parsedRating,
      tags: cleanTags,
      message: cleanMessage,
      user_phone: cleanPhone,
      created_at: new Date().toISOString(),
    }

    // Keep in memory buffer
    memoryFeedbacks.unshift(feedbackItem)
    if (memoryFeedbacks.length > 200) memoryFeedbacks.pop()

    // Try persisting to Supabase customer_feedbacks table
    try {
      const { data, error } = await supabase.from('customer_feedbacks').insert([{
        job_id: feedbackItem.job_id,
        otp_code: feedbackItem.otp_code,
        device_id: feedbackItem.device_id,
        rating: parsedRating,
        tags: cleanTags,
        message: cleanMessage,
        user_phone: cleanPhone,
      }]).select().single()

      if (!error && data) {
        return NextResponse.json({
          success: true,
          feedback: {
            ...data,
            user_phone: maskPhone(data.user_phone),
          },
        })
      }
      if (error) {
        console.warn('Supabase customer_feedbacks insert notice:', error.message)
      }
    } catch (dbErr) {
      console.warn('Database insert notice, saved in fallback:', dbErr)
    }

    return NextResponse.json({
      success: true,
      feedback: {
        ...feedbackItem,
        user_phone: maskPhone(feedbackItem.user_phone),
      },
    })
  } catch (err) {
    console.error('[Feedback] POST error:', err)
    return NextResponse.json({ error: 'Failed to process feedback.' }, { status: 500 })
  }
}

export async function GET(request) {
  try {
    const { searchParams } = new URL(request.url)
    const limit = Math.max(1, Math.min(100, parseInt(searchParams.get('limit') || '50', 10)))
    const isAdmin = verifyAdmin(request)

    let feedbacks = []

    try {
      const { data, error } = await supabase
        .from('customer_feedbacks')
        .select('*')
        .order('created_at', { ascending: false })
        .limit(limit)

      if (!error && data && data.length > 0) {
        feedbacks = data
      }
    } catch (e) {
      // Fallback to memory
    }

    if (!feedbacks || feedbacks.length === 0) {
      feedbacks = memoryFeedbacks.slice(0, limit)
    }

    // Security: Mask customer phone numbers for non-admins to prevent PII scraping
    const sanitizedFeedbacks = feedbacks.map((fb) => ({
      id: fb.id,
      rating: fb.rating,
      tags: fb.tags,
      message: fb.message,
      created_at: fb.created_at,
      user_phone: isAdmin ? fb.user_phone : maskPhone(fb.user_phone),
    }))

    return NextResponse.json({ success: true, feedbacks: sanitizedFeedbacks })
  } catch (err) {
    return NextResponse.json({ error: 'Failed to fetch feedback' }, { status: 500 })
  }
}
