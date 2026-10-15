import { NextResponse } from 'next/server'
import path from 'path'
import fs from 'fs'
import crypto from 'crypto'
import { createClient } from '@supabase/supabase-js'
import { enforceRateLimit, RATE_LIMITS } from '@/lib/rate-limiter'

export const dynamic = 'force-dynamic'

// 50 MB maximum document size
const MAX_FILE_SIZE = 50 * 1024 * 1024

// Strict whitelist of printable document types
const ALLOWED_EXTENSIONS = new Set(['.pdf', '.png', '.jpg', '.jpeg', '.doc', '.docx'])
const ALLOWED_MIMES = new Set([
  'application/pdf',
  'image/png',
  'image/jpeg',
  'image/jpg',
  'application/msword',
  'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
  'application/octet-stream',
])

function checkMagicBytes(buffer, ext) {
  if (buffer.length < 4) return false
  if (ext === '.pdf') {
    // %PDF (0x25 0x50 0x44 0x46)
    return buffer[0] === 0x25 && buffer[1] === 0x50 && buffer[2] === 0x44 && buffer[3] === 0x46
  }
  if (ext === '.png') {
    // 0x89 0x50 0x4E 0x47
    return buffer[0] === 0x89 && buffer[1] === 0x50 && buffer[2] === 0x4E && buffer[3] === 0x47
  }
  if (ext === '.jpg' || ext === '.jpeg') {
    // 0xFF 0xD8 0xFF
    return buffer[0] === 0xFF && buffer[1] === 0xD8 && buffer[2] === 0xFF
  }
  return true // Doc/Docx or standard binaries
}

// Private Supabase client with service role for server-side storage writes
function getServiceSupabase() {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL
  const serviceKey = process.env.SUPABASE_SERVICE_ROLE_KEY
  if (!url || !serviceKey) return null
  return createClient(url, serviceKey)
}

export async function POST(request) {
  try {
    const rateLimitRes = enforceRateLimit(request, 'upload', RATE_LIMITS.UPLOAD)
    if (rateLimitRes) return rateLimitRes

    const formData = await request.formData()
    const file = formData.get('file')

    if (!file) {
      return NextResponse.json({ error: 'No file provided' }, { status: 400 })
    }

    // 1. File Size Verification (Prevents server exhaustion / DoS)
    if (file.size > MAX_FILE_SIZE) {
      return NextResponse.json(
        { error: 'File exceeds maximum upload size of 50 MB.' },
        { status: 413 }
      )
    }

    // 2. Extension & MIME Validation
    const originalName = file.name || 'document.pdf'
    const ext = path.extname(originalName).toLowerCase()

    if (!ALLOWED_EXTENSIONS.has(ext)) {
      return NextResponse.json(
        { error: `File type "${ext}" is not permitted. Only PDF and image documents are accepted for printing.` },
        { status: 400 }
      )
    }

    const mime = file.type?.toLowerCase()
    if (mime && !ALLOWED_MIMES.has(mime)) {
      return NextResponse.json(
        { error: `MIME type "${mime}" is not permitted.` },
        { status: 400 }
      )
    }

    const bytes = await file.arrayBuffer()
    const buffer = Buffer.from(bytes)

    // 3. Magic Byte Verification (Prevents polyglot & disguised executable attacks)
    if (!checkMagicBytes(buffer, ext)) {
      return NextResponse.json(
        { error: 'File content does not match the declared document format.' },
        { status: 400 }
      )
    }

    // 4. Secure Random Storage Filename (Prevents path traversal & file overwriting)
    const randomSuffix = crypto.randomBytes(16).toString('hex')
    const safeDiskName = `${Date.now()}_${randomSuffix}${ext}`

    // 5a. Primary: Upload to private Supabase storage bucket (NOT publicly accessible)
    const supabaseService = getServiceSupabase()
    if (supabaseService) {
      try {
        const storagePath = `jobs/${safeDiskName}`
        const { error: storageErr } = await supabaseService.storage
          .from('print-files')
          .upload(storagePath, buffer, {
            contentType: mime || 'application/octet-stream',
            upsert: false,
          })

        if (!storageErr) {
          return NextResponse.json({
            success: true,
            file_name: path.basename(originalName).replace(/[^a-zA-Z0-9._-]/g, '_'),
            file_path: storagePath,
            file_url: storagePath,
            size: file.size,
            mime_type: file.type || 'application/pdf',
          })
        }
        // Log storage error server-side only, do not expose to client
        console.error('[Upload] Supabase storage error, falling back to local private store:', storageErr.message)
      } catch (storageException) {
        console.error('[Upload] Supabase storage exception:', storageException.message)
      }
    }

    // 5b. Local fallback: store OUTSIDE public/ (private, not HTTP-accessible)
    // Files here are only accessible via signed URL generation through /api/desktop/redeem
    const privateUploadsDir = path.join(process.cwd(), '.private-uploads')
    if (!fs.existsSync(privateUploadsDir)) {
      fs.mkdirSync(privateUploadsDir, { recursive: true })
    }

    const filePath = path.join(privateUploadsDir, safeDiskName)

    // Verify resolved path stays strictly within private uploads dir
    const resolvedPath = path.resolve(filePath)
    if (!resolvedPath.startsWith(path.resolve(privateUploadsDir))) {
      return NextResponse.json({ error: 'Invalid file path' }, { status: 400 })
    }

    fs.writeFileSync(filePath, buffer)

    // Return a non-public local path reference (not a relative URL to /public)
    const localRef = `local://${safeDiskName}`

    return NextResponse.json({
      success: true,
      file_name: path.basename(originalName).replace(/[^a-zA-Z0-9._-]/g, '_'),
      file_path: localRef,
      file_url: localRef,
      size: file.size,
      mime_type: file.type || 'application/pdf',
    })
  } catch (err) {
    console.error('[Upload] File upload error:', err)
    // SECURITY: Do not expose internal error details to client
    return NextResponse.json({ error: 'Failed to upload file.' }, { status: 500 })
  }
}
