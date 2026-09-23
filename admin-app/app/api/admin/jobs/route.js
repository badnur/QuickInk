import { NextResponse } from 'next/server'
import { supabase } from '@/lib/supabase'
import { getCache, setCache, invalidateCache } from '@/lib/admin-cache'

export const dynamic = 'force-dynamic'

/**
 * GET /api/admin/jobs
 * List print jobs with filtering, search, and pagination.
 * Fixed relation join on redeemed_by_device_id and valid columns.
 */
export async function GET(request) {
  try {
    const { searchParams } = new URL(request.url)
    const status = searchParams.get('status') || 'all'
    const search = (searchParams.get('search') || '').trim()
    const limit = parseInt(searchParams.get('limit') || '50', 10)
    const forceRefresh = searchParams.get('refresh') === 'true'

    const cacheKey = `admin_jobs_${status}_${limit}`
    if (!search && !forceRefresh) {
      const cached = getCache(cacheKey)
      if (cached) {
        return NextResponse.json(cached)
      }
    }

    let query = supabase
      .from('print_jobs')
      .select(`
        id,
        user_id,
        file_path,
        file_type,
        copies,
        color_mode,
        duplex,
        page_count,
        status,
        payment_type,
        created_at,
        expires_at,
        redeemed_at,
        redeemed_by_device_id,
        printed_at,
        devices:redeemed_by_device_id (
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

    if (status !== 'all') {
      query = query.eq('status', status)
    }

    const { data: jobs, error } = await query

    if (error) {
      console.warn('Admin jobs query warning, falling back:', error.message)
      const fallbackQuery = supabase
        .from('print_jobs')
        .select('id, user_id, file_path, file_type, copies, color_mode, duplex, page_count, status, payment_type, created_at, expires_at, redeemed_at, redeemed_by_device_id, printed_at')
        .order('created_at', { ascending: false })
        .limit(limit)
      const { data: simpleJobs } = await fallbackQuery
      const formatted = (simpleJobs || []).map((j) => ({
        ...j,
        file_name: j.file_path ? j.file_path.split('/').pop().replace(/^[0-9]+_/, '') : 'Document.pdf',
        amount: (j.page_count || 1) * (j.color_mode === 'color' ? 8 : 2) * (j.copies || 1),
      }))
      return NextResponse.json({ success: true, jobs: formatted, count: formatted.length })
    }

    const formattedJobs = (jobs || []).map((j) => {
      const fileName = j.file_path ? j.file_path.split('/').pop().replace(/^[0-9]+_/, '') : 'Document.pdf'
      const amount = (j.page_count || 1) * (j.color_mode === 'color' ? 8 : 2) * (j.copies || 1)
      return {
        ...j,
        file_name: fileName,
        amount,
      }
    })

    let filtered = formattedJobs

    if (search) {
      const q = search.toLowerCase()
      filtered = filtered.filter((j) => {
        return (
          (j.id && j.id.toLowerCase().includes(q)) ||
          (j.file_path && j.file_path.toLowerCase().includes(q)) ||
          (j.file_name && j.file_name.toLowerCase().includes(q)) ||
          (j.otps && j.otps.some((o) => o.code && o.code.toLowerCase().includes(q)))
        )
      })
    }

    const payload = { success: true, jobs: filtered, count: filtered.length }
    if (!search) {
      setCache(cacheKey, payload, 5)
    }

    return NextResponse.json(payload)
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

    // Invalidate caches
    invalidateCache('admin_jobs')
    invalidateCache('admin_stats')

    return NextResponse.json({ success: true, job: data })
  } catch (err) {
    console.error('Error updating job:', err)
    return NextResponse.json({ error: 'Failed to update job', details: err.message }, { status: 500 })
  }
}
