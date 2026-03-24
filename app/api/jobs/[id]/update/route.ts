import { NextRequest, NextResponse } from 'next/server'
import { createAdminClient } from '@/lib/supabase/server'

/**
 * PATCH /api/jobs/[id]
 * Update print job status (admin only)
 * Requires service_role key in headers
 */
export async function PATCH(
  request: NextRequest,
  { params }: { params: { id: string } }
) {
  try {
    // Verify admin access
    const authHeader = request.headers.get('authorization')
    const serviceRoleKey = process.env.SUPABASE_SERVICE_ROLE_KEY

    if (!authHeader || !authHeader.includes(serviceRoleKey!)) {
      return NextResponse.json(
        { error: 'Unauthorized. Admin access required.' },
        { status: 401 }
      )
    }

    const body = await request.json()
    const { status, machine_id } = body

    // Validation
    const validStatuses = ['pending', 'processing', 'ready', 'printed', 'cancelled']
    if (status && !validStatuses.includes(status)) {
      return NextResponse.json(
        { error: `Invalid status. Must be one of: ${validStatuses.join(', ')}` },
        { status: 400 }
      )
    }

    // Create admin client
    const supabase = createAdminClient()

    // Build update object
    const updateData: any = {}
    if (status) updateData.status = status
    if (machine_id) updateData.machine_id = machine_id

    if (Object.keys(updateData).length === 0) {
      return NextResponse.json(
        { error: 'No valid fields to update' },
        { status: 400 }
      )
    }

    // Update print job
    const { data, error } = await supabase
      .from('print_jobs')
      .update(updateData)
      .eq('id', params.id)
      .select()
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
        { error: 'Failed to update print job', details: error.message },
        { status: 500 }
      )
    }

    return NextResponse.json(
      {
        success: true,
        message: 'Print job updated successfully',
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
