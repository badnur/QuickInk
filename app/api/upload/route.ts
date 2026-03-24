import { NextRequest, NextResponse } from 'next/server'
import { createServerClient } from '@/lib/supabase/server'
import QRCode from 'qrcode'

/**
 * POST /api/upload
 * Upload file and create print job
 * Public endpoint - anyone can create a print job
 */
export async function POST(request: NextRequest) {
  try {
    const formData = await request.formData()
    const file = formData.get('file') as File
    const colorMode = formData.get('color_mode') as string || 'bw'
    const pages = parseInt(formData.get('pages') as string) || 1

    // Validation
    if (!file) {
      return NextResponse.json(
        { error: 'No file provided' },
        { status: 400 }
      )
    }

    // Validate file type
    const allowedTypes = [
      'application/pdf',
      'image/jpeg',
      'image/png',
      'image/jpg',
      'application/msword',
      'application/vnd.openxmlformats-officedocument.wordprocessingml.document'
    ]

    if (!allowedTypes.includes(file.type)) {
      return NextResponse.json(
        { error: 'Invalid file type. Allowed: PDF, Images, Word documents' },
        { status: 400 }
      )
    }

    // Validate file size (max 10MB)
    const maxSize = 10 * 1024 * 1024 // 10MB
    if (file.size > maxSize) {
      return NextResponse.json(
        { error: 'File size exceeds 10MB limit' },
        { status: 400 }
      )
    }

    // Create Supabase client
    const supabase = await createServerClient()

    // Generate unique filename
    const timestamp = Date.now()
    const fileExt = file.name.split('.').pop()
    const fileName = `${timestamp}-${Math.random().toString(36).substring(7)}.${fileExt}`
    const filePath = `uploads/${fileName}`

    // Convert file to buffer
    const arrayBuffer = await file.arrayBuffer()
    const buffer = Buffer.from(arrayBuffer)

    // Upload to Supabase Storage
    const { data: uploadData, error: uploadError } = await supabase.storage
      .from('print-files')
      .upload(filePath, buffer, {
        contentType: file.type,
        cacheControl: '3600',
        upsert: false
      })

    if (uploadError) {
      console.error('Upload error:', uploadError)
      return NextResponse.json(
        { error: 'Failed to upload file', details: uploadError.message },
        { status: 500 }
      )
    }

    // Get public URL
    const { data: { publicUrl } } = supabase.storage
      .from('print-files')
      .getPublicUrl(uploadData.path)

    // Generate unique job ID for QR code
    const jobId = `QK-${Date.now().toString().slice(-6)}`

    // Generate QR code data URL
    const qrData = JSON.stringify({
      jobId,
      fileUrl: publicUrl,
      pages,
      colorMode
    })

    const qrCodeDataUrl = await QRCode.toDataURL(qrData, {
      errorCorrectionLevel: 'H',
      type: 'image/png',
      width: 300,
      margin: 2
    })

    // Calculate price (Bangladesh Taka)
    const pricePerPage = colorMode === 'color' ? 10 : 2
    const totalPrice = pages * pricePerPage

    // Create print job record
    const { data: jobData, error: jobError } = await supabase
      .from('print_jobs')
      .insert([
        {
          file_url: publicUrl,
          file_name: file.name,
          file_size: file.size,
          file_type: file.type,
          qr_code: qrCodeDataUrl,
          qr_data: qrData,
          status: 'pending',
          pages,
          price: totalPrice,
          color_mode: colorMode
        }
      ])
      .select()
      .single()

    if (jobError) {
      console.error('Job creation error:', jobError)
      // Try to delete uploaded file if job creation fails
      await supabase.storage.from('print-files').remove([uploadData.path])
      
      return NextResponse.json(
        { error: 'Failed to create print job', details: jobError.message },
        { status: 500 }
      )
    }

    return NextResponse.json(
      {
        success: true,
        message: 'File uploaded and print job created successfully',
        job: {
          id: jobData.id,
          file_name: jobData.file_name,
          file_url: jobData.file_url,
          qr_code: jobData.qr_code,
          status: jobData.status,
          pages: jobData.pages,
          price: jobData.price,
          color_mode: jobData.color_mode,
          created_at: jobData.created_at
        }
      },
      { status: 201 }
    )
  } catch (error: any) {
    console.error('API error:', error)
    return NextResponse.json(
      { error: 'Internal server error', details: error.message },
      { status: 500 }
    )
  }
}
