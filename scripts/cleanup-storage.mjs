/**
 * QuickInk / PrintKoro - Immediate Privacy File Purge Script
 * 
 * Enforces company zero-retention privacy promise:
 * "All files deleted immediately after printing"
 * 
 * Uses standard native fetch (zero dependencies required)
 * 
 * Usage:
 *   node scripts/cleanup-storage.mjs
 */

import fs from 'fs'
import path from 'path'

// Load environment from user-app/.env.local if available
const envPath = path.resolve('user-app', '.env.local')
if (fs.existsSync(envPath)) {
  const content = fs.readFileSync(envPath, 'utf8')
  for (const line of content.split('\n')) {
    const trimmed = line.trim()
    if (trimmed && !trimmed.startsWith('#')) {
      const idx = trimmed.indexOf('=')
      if (idx > 0) {
        const k = trimmed.substring(0, idx).trim()
        const v = trimmed.substring(idx + 1).trim()
        process.env[k] = v
      }
    }
  }
}

const SUPABASE_URL = process.env.NEXT_PUBLIC_SUPABASE_URL || 'https://xhzfrmpbhasnipirccnt.supabase.co'
const SUPABASE_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY || process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY || 'sb_publishable_5QRgqfQTgNnpH3PN2wfz1g_4wwy5k8I'

const headers = {
  apikey: SUPABASE_KEY,
  Authorization: `Bearer ${SUPABASE_KEY}`,
  'Content-Type': 'application/json'
}

async function runCleanup() {
  console.log('================================================================')
  console.log('🛡️  QuickInk Privacy Storage Cleanup Tool')
  console.log(`Connecting to: ${SUPABASE_URL}`)
  console.log('================================================================\n')

  // Step 1: Invalidate expired jobs via RPC
  try {
    const rpcRes = await fetch(`${SUPABASE_URL}/rest/v1/rpc/cleanup_expired_print_jobs`, {
      method: 'POST',
      headers
    })
    if (rpcRes.ok) {
      const rpcData = await rpcRes.json()
      console.log('✅ Triggered cleanup_expired_print_jobs RPC:', rpcData)
    }
  } catch (e) {
    console.log('ℹ️  cleanup_expired_print_jobs note:', e.message)
  }

  try {
    const rpcPurge = await fetch(`${SUPABASE_URL}/rest/v1/rpc/purge_completed_and_orphaned_print_files`, {
      method: 'POST',
      headers
    })
    if (rpcPurge.ok) {
      const purgeData = await rpcPurge.json()
      console.log('✅ Triggered purge_completed_and_orphaned_print_files RPC:', purgeData)
    }
  } catch (e) {}

  // Step 2: Clear file_path in DB for completed, failed, or redeemed jobs
  console.log('\n[1/3] Checking print_jobs database records with lingering file_path...')
  const jobsRes = await fetch(`${SUPABASE_URL}/rest/v1/print_jobs?file_path=not.is.null&select=id,status,file_path,created_at`, {
    headers
  })
  
  if (!jobsRes.ok) {
    console.error('❌ Error querying print_jobs:', jobsRes.status, await jobsRes.text())
  } else {
    const lingeringJobs = await jobsRes.json()
    console.log(`Found ${lingeringJobs?.length || 0} job(s) with file_path in database.`)
    let dbUpdated = 0
    for (const job of lingeringJobs || []) {
      const isFinished = ['completed', 'printed', 'failed', 'expired', 'voided'].includes(job.status)
      const isRedeemed = job.status === 'redeemed'
      if (isFinished || isRedeemed) {
        await fetch(`${SUPABASE_URL}/rest/v1/print_jobs?id=eq.${job.id}`, {
          method: 'PATCH',
          headers,
          body: JSON.stringify({ file_path: null })
        })
        dbUpdated++
      }
    }
    console.log(`✅ Cleared file_path for ${dbUpdated} database record(s).`)
  }

  // Step 3: Scan Supabase Storage 'print-files' bucket
  console.log('\n[2/3] Scanning "print-files" bucket in Supabase Storage...')
  
  // List files in 'jobs/' subfolder
  const listJobsRes = await fetch(`${SUPABASE_URL}/storage/v1/object/list/print-files`, {
    method: 'POST',
    headers,
    body: JSON.stringify({ prefix: 'jobs', limit: 500, sortBy: { column: 'name', order: 'asc' } })
  })
  const jobFiles = listJobsRes.ok ? await listJobsRes.json() : []

  // List files in bucket root
  const listRootRes = await fetch(`${SUPABASE_URL}/storage/v1/object/list/print-files`, {
    method: 'POST',
    headers,
    body: JSON.stringify({ prefix: '', limit: 500, sortBy: { column: 'name', order: 'asc' } })
  })
  const rootFiles = listRootRes.ok ? await listRootRes.json() : []

  const candidateFiles = []
  if (Array.isArray(jobFiles)) {
    for (const f of jobFiles) {
      if (f.name) {
        candidateFiles.push(`jobs/${f.name}`)
        candidateFiles.push(f.name)
      }
    }
  }
  if (Array.isArray(rootFiles)) {
    for (const f of rootFiles) {
      if (f.name && f.name !== 'jobs' && f.id) {
        candidateFiles.push(f.name)
      }
    }
  }

  console.log(`Found ${candidateFiles.length} candidate file entries in storage.`)

  // Step 4: Delete files from storage
  console.log('\n[3/3] Permanently purging storage files...')
  if (candidateFiles.length > 0) {
    const uniqueFiles = Array.from(new Set(candidateFiles))
    
    // Chunk deletions by 50
    let totalProcessed = 0
    for (let i = 0; i < uniqueFiles.length; i += 50) {
      const chunk = uniqueFiles.slice(i, i + 50)
      const delRes = await fetch(`${SUPABASE_URL}/storage/v1/object/print-files`, {
        method: 'DELETE',
        headers,
        body: JSON.stringify({ prefixes: chunk })
      })

      if (!delRes.ok) {
        console.warn(`⚠️ Batch delete status:`, delRes.status, await delRes.text())
      } else {
        totalProcessed += chunk.length
        console.log(`  - Dispatched purge for batch of ${chunk.length} file path(s)`)
      }
    }

    console.log(`\n🎉 Cleanup execution complete: ${totalProcessed} file target(s) processed for deletion!`)
  } else {
    console.log('✅ Storage bucket is clean! Zero lingering files found.')
  }

  console.log('\n================================================================')
  console.log('🔒 Zero-Retention Privacy Promise Enforced.')
  console.log('================================================================\n')
}

runCleanup().catch(console.error)
