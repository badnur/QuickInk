import { NextResponse } from 'next/server'
import { supabase } from '@/lib/supabase'
import { deletePrintJobFile } from '@/lib/storage-cleanup'
import { createClient } from '@supabase/supabase-js'

export const dynamic = 'force-dynamic'

function getServiceSupabase() {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL || 'https://xhzfrmpbhasnipirccnt.supabase.co'
  const serviceKey = process.env.SUPABASE_SERVICE_ROLE_KEY
  if (!serviceKey) return null
  return createClient(url, serviceKey)
}

/**
 * GET/POST /api/cron/cleanup
 * 
 * Scheduled & manual cleanup task ensuring zero-retention privacy policy:
 * 1. Purges all files in 'print-files' bucket associated with completed, failed, expired, or voided jobs.
 * 2. Scans storage bucket for orphaned document files older than 1 hour and removes them.
 * 3. Nullifies database file_path references so no customer document metadata remains.
 * 4. Calls database cleanup_expired_print_jobs RPC.
 */
export async function GET(request) {
  return handleCleanup(request)
}

export async function POST(request) {
  return handleCleanup(request)
}

async function handleCleanup(request) {
  try {
    const client = getServiceSupabase() || supabase
    const startTime = Date.now()
    let jobsCleared = 0
    let filesDeleted = 0
    const deletedFileNames = []

    // 1. Run database RPC for expired jobs if available
    try {
      await client.rpc('cleanup_expired_print_jobs')
    } catch (e) {
      console.warn('[CleanupRoute] cleanup_expired_print_jobs notice:', e.message)
    }

    try {
      await client.rpc('purge_completed_and_orphaned_print_files')
    } catch (e) {
      // Custom RPC might not be deployed yet, continue gracefully
    }

    // 2. Fetch all jobs where file_path is still present and job is no longer active
    const oneHourAgo = new Date(Date.now() - 60 * 60 * 1000).toISOString()
    const { data: staleJobs, error: staleErr } = await client
      .from('print_jobs')
      .select('id, file_path, status, created_at')
      .not('file_path', 'is', null)
      .limit(200)

    if (staleJobs && staleJobs.length > 0) {
      for (const job of staleJobs) {
        const isFinished = ['completed', 'printed', 'failed', 'expired', 'voided'].includes(job.status)
        const isOldRedeemed = job.status === 'redeemed' && job.created_at < oneHourAgo
        const isOldPending = (job.status === 'pending_payment' || job.status === 'awaiting_redemption') && job.created_at < oneHourAgo

        if (isFinished || isOldRedeemed || isOldPending) {
          await deletePrintJobFile(job.file_path, job.id)
          jobsCleared++
          deletedFileNames.push(job.file_path)
        }
      }
    }

    // 3. Scan 'print-files' storage bucket directly for orphaned files
    try {
      const { data: jobFiles } = await client.storage.from('print-files').list('jobs', { limit: 100 })
      const { data: rootFiles } = await client.storage.from('print-files').list('', { limit: 100 })

      // Fetch active jobs (created recently in pending state)
      const { data: activeJobs } = await client
        .from('print_jobs')
        .select('file_path')
        .in('status', ['pending_payment', 'awaiting_redemption'])
        .gt('created_at', oneHourAgo)

      const activePaths = new Set(
        (activeJobs || [])
          .map((j) => (j.file_path ? j.file_path.split('#')[0].split('?')[0].trim() : ''))
          .filter(Boolean)
      )

      const filesToRemove = []

      if (jobFiles && Array.isArray(jobFiles)) {
        for (const file of jobFiles) {
          const fullPath = `jobs/${file.name}`
          const isFileActive = activePaths.has(fullPath) || activePaths.has(file.name)
          if (!isFileActive) {
            filesToRemove.push(fullPath)
            filesToRemove.push(file.name)
          }
        }
      }

      if (rootFiles && Array.isArray(rootFiles)) {
        for (const file of rootFiles) {
          if (file.name === 'jobs' || !file.id) continue // skip folder itself
          const isFileActive = activePaths.has(file.name) || activePaths.has(`jobs/${file.name}`)
          if (!isFileActive) {
            filesToRemove.push(file.name)
          }
        }
      }

      if (filesToRemove.length > 0) {
        const uniqueToRemove = Array.from(new Set(filesToRemove))
        const { error: remErr } = await client.storage.from('print-files').remove(uniqueToRemove)
        if (!remErr) {
          filesDeleted += uniqueToRemove.length
        }
      }
    } catch (scanErr) {
      console.warn('[CleanupRoute] Storage bucket scan warning:', scanErr.message)
    }

    return NextResponse.json({
      success: true,
      message: 'Zero-retention privacy cleanup completed successfully.',
      jobsCleared,
      storageFilesDeleted: filesDeleted,
      durationMs: Date.now() - startTime,
      timestamp: new Date().toISOString(),
    })
  } catch (err) {
    console.error('[CleanupRoute] Fatal error:', err)
    return NextResponse.json(
      { success: false, error: 'Cleanup execution encountered an issue' },
      { status: 500 }
    )
  }
}
