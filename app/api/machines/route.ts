import { NextRequest, NextResponse } from 'next/server'
import { createServerClient } from '@/lib/supabase/server'

/**
 * GET /api/machines
 * Get all printing machines/kiosks
 * Public endpoint - anyone can view available machines
 */
export async function GET(request: NextRequest) {
  try {
    const supabase = await createServerClient()

    // Optional query parameters for filtering
    const { searchParams } = new URL(request.url)
    const status = searchParams.get('status') // filter by status
    const limit = searchParams.get('limit') // limit results

    let query = supabase
      .from('machines')
      .select('*')
      .order('created_at', { ascending: false })

    // Apply filters if provided
    if (status) {
      query = query.eq('status', status)
    }

    if (limit) {
      query = query.limit(parseInt(limit))
    }

    const { data, error } = await query

    if (error) {
      console.error('Supabase error:', error)
      return NextResponse.json(
        { error: 'Failed to fetch machines', details: error.message },
        { status: 500 }
      )
    }

    return NextResponse.json(
      {
        success: true,
        machines: data || [],
        count: data?.length || 0
      },
      { status: 200 }
    )
  } catch (error: any) {
    console.error('API error:', error)
    return NextResponse.json(
      { error: 'Internal server error', details: error.message },
      { status: 500 }
    )
  }
}
