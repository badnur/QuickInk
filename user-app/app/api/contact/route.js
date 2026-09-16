import { NextResponse } from 'next/server'

// In-memory storage for contact messages
let contactMessages = []

/**
 * POST /api/contact
 * Submit contact form (mock - no database)
 */
export async function POST(request) {
  try {
    const body = await request.json()
    const { name, email, subject, message } = body

    // Validation
    if (!name || !email || !subject || !message) {
      return NextResponse.json(
        { error: 'All fields are required' },
        { status: 400 }
      )
    }

    // Create mock message
    const newMessage = {
      id: `message_${Date.now()}`,
      name,
      email,
      subject,
      message,
      created_at: new Date().toISOString(),
      status: 'unread'
    }

    contactMessages.push(newMessage)

    return NextResponse.json(
      {
        success: true,
        message: 'Message sent successfully',
        contact: newMessage
      },
      { status: 201 }
    )
  } catch (error) {
    console.error('API error:', error)
    return NextResponse.json(
      { error: 'Internal server error', details: error.message },
      { status: 500 }
    )
  }
}
