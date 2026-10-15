import { NextResponse } from 'next/server'
import { enforceRateLimit, RATE_LIMITS } from '@/lib/rate-limiter'

export const dynamic = 'force-dynamic'

// In-memory storage for contact messages (capped to prevent memory growth)
const contactMessages = []
const MAX_MESSAGES = 100

const EMAIL_REGEX = /^[^\s@]+@[^\s@]+\.[^\s@]+$/

/**
 * POST /api/contact
 * Submit contact form
 */
export async function POST(request) {
  try {
    const rateLimitRes = enforceRateLimit(request, 'contact_form', RATE_LIMITS.CONTACT_FORM)
    if (rateLimitRes) return rateLimitRes

    const body = await request.json()
    const { name, email, subject, message } = body

    // Validation
    if (!name || !email || !subject || !message) {
      return NextResponse.json(
        { error: 'All fields (name, email, subject, message) are required' },
        { status: 400 }
      )
    }

    const cleanName = String(name).trim().slice(0, 100)
    const cleanEmail = String(email).trim().slice(0, 100)
    const cleanSubject = String(subject).trim().slice(0, 200)
    const cleanMessage = String(message).trim().slice(0, 2000)

    if (!EMAIL_REGEX.test(cleanEmail)) {
      return NextResponse.json({ error: 'Please enter a valid email address' }, { status: 400 })
    }

    if (cleanName.length < 2 || cleanSubject.length < 2 || cleanMessage.length < 5) {
      return NextResponse.json({ error: 'Message content is too short' }, { status: 400 })
    }

    // Create message record
    const newMessage = {
      id: `msg_${Date.now()}_${Math.random().toString(36).substring(2, 7)}`,
      name: cleanName,
      email: cleanEmail,
      subject: cleanSubject,
      message: cleanMessage,
      created_at: new Date().toISOString(),
      status: 'unread'
    }

    contactMessages.unshift(newMessage)
    if (contactMessages.length > MAX_MESSAGES) {
      contactMessages.pop()
    }

    return NextResponse.json(
      {
        success: true,
        message: 'Message sent successfully. Our team will contact you shortly.',
      },
      { status: 201 }
    )
  } catch (error) {
    console.error('Contact API error:', error)
    return NextResponse.json(
      { error: 'Failed to process contact message. Please try again later.' },
      { status: 500 }
    )
  }
}

