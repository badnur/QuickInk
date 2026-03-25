import { NextResponse } from 'next/server'

// Mock machines data
const mockMachines = []

/**
 * GET /api/machines
 * Get all printing machines (mock data - coming soon)
 */
export async function GET(request) {
  try {
    // Return empty for now - showing "Coming Soon" in UI
    return NextResponse.json(
      {
        success: true,
        machines: mockMachines,
        count: mockMachines.length
      },
      { status: 200 }
    )
  } catch (error) {
    console.error('API error:', error)
    return NextResponse.json(
      { error: 'Internal server error', details: error.message },
      { status: 500 }
    )
  }
}
