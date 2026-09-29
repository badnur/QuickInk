import { NextResponse } from 'next/server'
import { supabase } from '@/lib/supabase'

export const dynamic = 'force-dynamic'

// Shared in-memory fallback buffer (holds last 100 feedbacks)
const memoryFeedbacks = []

export async function POST(request) {
  try {
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
    const feedbackItem = {
      id: `fb_${Date.now()}_${Math.random().toString(36).substring(2, 7)}`,
      job_id: jobId,
      otp_code: otpCode,
      device_id: deviceId,
      rating: parsedRating,
      tags: Array.isArray(tags) ? tags : [],
      message: (message || '').trim(),
      user_phone: userPhone,
      created_at: new Date().toISOString(),
    }

    // Keep in memory buffer
    memoryFeedbacks.unshift(feedbackItem)
    if (memoryFeedbacks.length > 200) memoryFeedbacks.pop()

    // Try persisting to Supabase customer_feedbacks table
    try {
      const { data, error } = await supabase.from('customer_feedbacks').insert([{
        job_id: jobId,
        otp_code: otpCode,
        device_id: deviceId,
        rating: parsedRating,
        tags: feedbackItem.tags,
        message: feedbackItem.message,
        user_phone: userPhone,
      }]).select().single()

      if (!error && data) {
        return NextResponse.json({ success: true, feedback: data })
      }
      if (error) {
        console.warn('Supabase customer_feedbacks insert notice:', error.message)
      }
    } catch (dbErr) {
      console.warn('Database insert notice, saved in fallback:', dbErr)
    }

    return NextResponse.json({ success: true, feedback: feedbackItem })
  } catch (err) {
    return NextResponse.json({ error: 'Failed to process feedback', details: err.message }, { status: 500 })
  }
}

export async function GET(request) {
  try {
    const { searchParams } = new URL(request.url)
    const limit = parseInt(searchParams.get('limit') || '50', 10)

    try {
      const { data, error } = await supabase
        .from('customer_feedbacks')
        .select('*')
        .order('created_at', { ascending: false })
        .limit(limit)

      if (!error && data && data.length > 0) {
        return NextResponse.json({ success: true, feedbacks: data })
      }
    } catch (e) {
      // Fallback
    }

    return NextResponse.json({ success: true, feedbacks: memoryFeedbacks.slice(0, limit) })
  } catch (err) {
    return NextResponse.json({ error: 'Failed to fetch feedback' }, { status: 500 })
  }
}
