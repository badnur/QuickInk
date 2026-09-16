import { NextResponse } from 'next/server'
import { supabase } from '@/lib/supabase'

export const dynamic = 'force-dynamic'

/**
 * GET /api/admin/jobs
 * List print jobs with filtering, search, and pagination
 */
export async function GET(request) {
  try {
    const { searchParams } = new URL(request.url)
    const status = searchParams.get('status')
    const search = searchParams.get('search')
    const limit = parseInt(searchParams.get('limit') || '50', 10)

    let query = supabase
      .from('print_jobs')
      .select(`
        *,
        devices (
          id,
          name,
          type
        ),
        otps (
          code,
          otp_type,
          used,
          expires_at
        )
      `)
      .order('created_at', { ascending: false })
      .limit(limit)

    if (status && status !== 'all') {
      query = query.eq('status', status)
    }

    const { data: jobs, error } = await query

    if (error) {
      console.warn('Admin jobs query warning:', error.message)
      // Fallback simple query without joins
      const fallbackQuery = supabase
        .from('print_jobs')
        .select('*')
        .order('created_at', { ascending: false })
        .limit(limit)
      const { data: simpleJobs } = await fallbackQuery
      return NextResponse.json({ success: true, jobs: simpleJobs || [] })
    }

    let filtered = jobs || []

    if (search && search.trim()) {
      const q = search.trim().toLowerCase()
      filtered = filtered.filter((j) => {
        return (
          (j.id && j.id.toLowerCase().includes(q)) ||
          (j.file_path && j.file_path.toLowerCase().includes(q)) ||
          (j.file_name && j.file_name.toLowerCase().includes(q)) ||
          (j.otps && j.otps.some((o) => o.code && o.code.toLowerCase().includes(q)))
        )
      })
    }

    return NextResponse.json({ success: true, jobs: filtered, count: filtered.length })
  } catch (err) {
    console.error('Error fetching admin jobs:', err)
    return NextResponse.json({ error: 'Failed to fetch jobs', details: err.message }, { status: 500 })
  }
}

/**
 * PATCH /api/admin/jobs
 * Update print job status or details
 */
export async function PATCH(request) {
  try {
    const body = await request.json()
    const { jobId, status } = body

    if (!jobId || !status) {
      return NextResponse.json({ error: 'jobId and status are required' }, { status: 400 })
    }

    const updateData = { status }
    if (status === 'printed') {
      updateData.printed_at = new Date().toISOString()
    } else if (status === 'redeemed') {
      updateData.redeemed_at = new Date().toISOString()
    }

    const { data, error } = await supabase
      .from('print_jobs')
      .update(updateData)
      .eq('id', jobId)
      .select()
      .single()

    if (error) {
      return NextResponse.json({ error: error.message }, { status: 500 })
    }

    return NextResponse.json({ success: true, job: data })
  } catch (err) {
    console.error('Error updating job:', err)
    return NextResponse.json({ error: 'Failed to update job', details: err.message }, { status: 500 })
  }
}
