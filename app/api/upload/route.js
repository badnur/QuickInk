import { NextResponse } from 'next/server'
import path from 'path'
import fs from 'fs'

export async function POST(request) {
  try {
    const formData = await request.formData()
    const file = formData.get('file')

    if (!file) {
      return NextResponse.json({ error: 'No file provided' }, { status: 400 })
    }

    const bytes = await file.arrayBuffer()
    const buffer = Buffer.from(bytes)

    const uploadsDir = path.join(process.cwd(), 'public', 'uploads')
    if (!fs.existsSync(uploadsDir)) {
      fs.mkdirSync(uploadsDir, { recursive: true })
    }

    const cleanFileName = file.name.replace(/[^a-zA-Z0-9.-]/g, '_')
    const fileName = `${Date.now()}_${cleanFileName}`
    const filePath = path.join(uploadsDir, fileName)

    fs.writeFileSync(filePath, buffer)

    const relativeUrl = `/uploads/${fileName}`

    return NextResponse.json({
      success: true,
      file_name: file.name,
      file_path: relativeUrl,
      file_url: relativeUrl,
      size: file.size,
      mime_type: file.type || 'application/pdf',
    })
  } catch (err) {
    console.error('File upload error:', err)
    return NextResponse.json({ error: 'Failed to upload file: ' + err.message }, { status: 500 })
  }
}
