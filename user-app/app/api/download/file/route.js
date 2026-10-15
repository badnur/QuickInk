import { NextResponse } from 'next/server'
import path from 'path'
import fs from 'fs'

export const dynamic = 'force-dynamic'

const MIME_MAP = {
  '.pdf': 'application/pdf',
  '.png': 'image/png',
  '.jpg': 'image/jpeg',
  '.jpeg': 'image/jpeg',
  '.doc': 'application/msword',
  '.docx': 'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
}

export async function GET(request) {
  try {
    const { searchParams } = new URL(request.url)
    const fileName = searchParams.get('name')

    if (!fileName) {
      return NextResponse.json({ error: 'File name is required' }, { status: 400 })
    }

    // Strict validation: alphanumeric, dash, underscore, dot only (Prevents path traversal attacks)
    const baseName = path.basename(fileName)
    if (!/^[a-zA-Z0-9._-]+$/.test(baseName) || baseName.includes('..')) {
      return NextResponse.json({ error: 'Invalid file name' }, { status: 400 })
    }

    const privateUploadsDir = path.resolve(process.cwd(), '.private-uploads')
    const targetPath = path.resolve(privateUploadsDir, baseName)

    // Ensure resolved path is strictly within privateUploadsDir
    if (!targetPath.startsWith(privateUploadsDir)) {
      return NextResponse.json({ error: 'Access denied' }, { status: 403 })
    }

    if (!fs.existsSync(targetPath)) {
      return NextResponse.json({ error: 'File not found' }, { status: 404 })
    }

    const ext = path.extname(baseName).toLowerCase()
    const contentType = MIME_MAP[ext] || 'application/octet-stream'
    const fileBuffer = fs.readFileSync(targetPath)

    return new NextResponse(fileBuffer, {
      status: 200,
      headers: {
        'Content-Type': contentType,
        'Content-Disposition': `inline; filename="${baseName}"`,
        'Cache-Control': 'private, no-cache, no-store, must-revalidate',
      },
    })
  } catch (err) {
    console.error('[DownloadFile] Exception:', err)
    return NextResponse.json({ error: 'Failed to retrieve file' }, { status: 500 })
  }
}
