import { NextResponse } from 'next/server'

// Mock data storage (in-memory for MVP)
let partners = []
let contactMessages = []

// Mock printer locations
const mockMachines = [
  {
    id: 'machine_1',
    name: 'QuickInk - Central Mall',
    latitude: 19.0760,
    longitude: 72.8777,
    address: 'Shop 12, Central Mall, Andheri West, Mumbai',
    status: 'online',
    paper_available: true,
    distance: '0.5 km'
  },
  {
    id: 'machine_2',
    name: 'QuickInk - University Campus',
    latitude: 19.1136,
    longitude: 72.8697,
    address: 'Near Library, Mumbai University, Kalina Campus',
    status: 'online',
    paper_available: true,
    distance: '1.2 km'
  },
  {
    id: 'machine_3',
    name: 'QuickInk - Business Hub',
    latitude: 19.0896,
    longitude: 72.8656,
    address: 'Ground Floor, Business Hub, BKC, Mumbai',
    status: 'online',
    paper_available: false,
    distance: '2.1 km'
  },
  {
    id: 'machine_4',
    name: 'QuickInk - Railway Station',
    latitude: 19.0545,
    longitude: 72.8428,
    address: 'Platform 1, Bandra Railway Station, Mumbai',
    status: 'offline',
    paper_available: false,
    distance: '3.5 km'
  },
  {
    id: 'machine_5',
    name: 'QuickInk - Coffee Corner',
    latitude: 19.1197,
    longitude: 72.9089,
    address: '15, Linking Road, Coffee Corner Cafe, Mumbai',
    status: 'online',
    paper_available: true,
    distance: '1.8 km'
  },
  {
    id: 'machine_6',
    name: 'QuickInk - Tech Park',
    latitude: 19.1075,
    longitude: 72.8263,
    address: 'Building A, Tech Park, Goregaon East, Mumbai',
    status: 'online',
    paper_available: true,
    distance: '4.2 km'
  },
  {
    id: 'machine_7',
    name: 'QuickInk - Medical College',
    latitude: 19.0330,
    longitude: 72.8569,
    address: 'Block 2, Medical College Campus, Parel, Mumbai',
    status: 'online',
    paper_available: true,
    distance: '2.7 km'
  },
  {
    id: 'machine_8',
    name: 'QuickInk - Shopping Plaza',
    latitude: 19.1197,
    longitude: 72.8464,
    address: 'Shop 45, Phoenix Mall, Lower Parel, Mumbai',
    status: 'online',
    paper_available: true,
    distance: '3.1 km'
  }
]

// GET /api/machines - Get all printer locations
export async function GET(request) {
  const { pathname } = new URL(request.url)
  
  if (pathname === '/api/machines') {
    return NextResponse.json({
      success: true,
      machines: mockMachines,
      count: mockMachines.length
    })
  }

  // GET /api/partners - Get all partners (for admin)
  if (pathname === '/api/partners') {
    return NextResponse.json({
      success: true,
      partners: partners,
      count: partners.length
    })
  }

  return NextResponse.json(
    { error: 'Endpoint not found' },
    { status: 404 }
  )
}

// POST /api/partners - Create new partner
// POST /api/contact - Submit contact form
export async function POST(request) {
  const { pathname } = new URL(request.url)
  
  try {
    const body = await request.json()

    // Partner registration
    if (pathname === '/api/partners') {
      const { name, shop_name, location, phone } = body

      // Validation
      if (!name || !shop_name || !location || !phone) {
        return NextResponse.json(
          { error: 'All fields are required' },
          { status: 400 }
        )
      }

      const newPartner = {
        id: `partner_${Date.now()}`,
        name,
        shop_name,
        location,
        phone,
        created_at: new Date().toISOString(),
        status: 'pending'
      }

      partners.push(newPartner)

      return NextResponse.json({
        success: true,
        message: 'Partner application submitted successfully',
        partner: newPartner
      })
    }

    // Contact form
    if (pathname === '/api/contact') {
      const { name, email, subject, message } = body

      // Validation
      if (!name || !email || !subject || !message) {
        return NextResponse.json(
          { error: 'All fields are required' },
          { status: 400 }
        )
      }

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

      return NextResponse.json({
        success: true,
        message: 'Message sent successfully',
        contact: newMessage
      })
    }

    return NextResponse.json(
      { error: 'Endpoint not found' },
      { status: 404 }
    )
  } catch (error) {
    console.error('API Error:', error)
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    )
  }
}
