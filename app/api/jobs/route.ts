import { NextRequest, NextResponse } from 'next/server'
import { createServerClient } from '@/lib/supabase/server'

/**
 * GET /api/jobs
 * Get all print jobs (with optional filters)
 * Admin endpoint (can be made public for demo)
 */
export async function GET(request: NextRequest) {
  try {
    const supabase = await createServerClient()

    // Optional query parameters
    const { searchParams } = new URL(request.url)
    const status = searchParams.get('status')
    const limit = searchParams.get('limit')

    let query = supabase
      .from('print_jobs')
      .select('*')
      .order('created_at', { ascending: false })

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
        { error: 'Failed to fetch print jobs', details: error.message },
        { status: 500 }
      )
    }

    return NextResponse.json(
      {
        success: true,
        jobs: data || [],
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
