import { NextRequest, NextResponse } from 'next/server'
import { createServerClient } from '@/lib/supabase/server'

/**
 * GET /api/jobs/[id]
 * Get print job details by ID
 * Public endpoint - anyone with job ID can view
 */
export async function GET(
  request: NextRequest,
  { params }: { params: { id: string } }
) {
  try {
    const supabase = await createServerClient()

    const { data, error } = await supabase
      .from('print_jobs')
      .select('*')
      .eq('id', params.id)
      .single()

    if (error) {
      console.error('Supabase error:', error)
      
      if (error.code === 'PGRST116') {
        return NextResponse.json(
          { error: 'Print job not found' },
          { status: 404 }
        )
      }

      return NextResponse.json(
        { error: 'Failed to fetch print job', details: error.message },
        { status: 500 }
      )
    }

    return NextResponse.json(
      {
        success: true,
        job: data
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
