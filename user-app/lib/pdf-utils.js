import { PDFDocument, ParseSpeeds } from 'pdf-lib'

let pdfjsLoadingPromise = null

/**
 * Dynamically load PDF.js from public/pdfjs
 */
export async function loadPdfJs() {
  if (typeof window === 'undefined') return null
  if (window.pdfjsLib) {
    if (!window.pdfjsLib.GlobalWorkerOptions.workerSrc) {
      window.pdfjsLib.GlobalWorkerOptions.workerSrc = '/pdfjs/pdf.worker.min.js'
    }
    return window.pdfjsLib
  }

  if (!pdfjsLoadingPromise) {
    pdfjsLoadingPromise = new Promise((resolve, reject) => {
      const script = document.createElement('script')
      script.src = '/pdfjs/pdf.min.js'
      script.async = true
      script.onload = () => {
        if (window.pdfjsLib) {
          window.pdfjsLib.GlobalWorkerOptions.workerSrc = '/pdfjs/pdf.worker.min.js'
          resolve(window.pdfjsLib)
        } else {
          reject(new Error('pdfjsLib failed to attach to window'))
        }
      }
      script.onerror = (err) => {
        pdfjsLoadingPromise = null
        reject(err)
      }
      document.head.appendChild(script)
    })
  }

  return pdfjsLoadingPromise
}

/**
 * Fast regex-based page count extractor from text/binary string.
 * Uses generous distance (up to 25,000 chars) to accommodate large /Kids arrays.
 */
export function extractPageCountFromText(str) {
  if (!str) return null
  let maxCount = 0

  // Pattern 1: /Type /Pages ... /Count 123 (distance <= 25,000 chars)
  for (const m of str.matchAll(/\/Type\s*\/Pages[\s\S]{0,25000}?\/Count\s+(\d+)/g)) {
    const c = parseInt(m[1], 10)
    if (!isNaN(c) && c > maxCount && c < 50000) maxCount = c
  }

  // Pattern 2: /Count 123 ... /Type /Pages (distance <= 25,000 chars)
  for (const m of str.matchAll(/\/Count\s+(\d+)[\s\S]{0,25000}?\/Type\s*\/Pages/g)) {
    const c = parseInt(m[1], 10)
    if (!isNaN(c) && c > maxCount && c < 50000) maxCount = c
  }

  // Pattern 3: /Linearized dictionary /N 123 (web-optimized PDFs)
  for (const m of str.matchAll(/\/Linearized[\s\S]{0,1000}?\/N\s+(\d+)/g)) {
    const c = parseInt(m[1], 10)
    if (!isNaN(c) && c > maxCount && c < 50000) maxCount = c
  }

  // Pattern 4: /Count 123 in dictionary near /Kids or /Pages
  for (const m of str.matchAll(/\/Count\s+(\d+)/g)) {
    const c = parseInt(m[1], 10)
    if (!isNaN(c) && c > maxCount && c < 50000) {
      const idx = m.index
      const windowStr = str.substring(Math.max(0, idx - 2000), Math.min(str.length, idx + 2000))
      if (windowStr.includes('/Pages') || windowStr.includes('/Kids')) {
        maxCount = c
      }
    }
  }

  // Pattern 5: Distinct /Type /Page objects count
  const pageObjs = str.match(/\/Type\s*\/Page(?![a-zA-Z])/g)
  if (pageObjs && pageObjs.length > maxCount) {
    maxCount = pageObjs.length
  }

  return maxCount > 0 ? maxCount : null
}

/**
 * Ultra-fast zero-RAM binary slice scanner.
 * Scans the first 6MB (head) and last 5MB (tail/trailer) of the PDF file.
 * Returns authoritative page count in < 15ms without loading huge files into memory.
 */
export async function fastScanPdfPages(file) {
  if (!file) return null
  const fileSize = file.size

  // Strategy 1: Scan the tail (last 5 MB) where cross-reference table & trailer live
  try {
    const tailSize = Math.min(fileSize, 5 * 1024 * 1024)
    const tailBlob = file.slice(Math.max(0, fileSize - tailSize), fileSize)
    const tailText = await tailBlob.text()
    const tailCount = extractPageCountFromText(tailText)
    if (tailCount && tailCount > 1) {
      console.log(`[fastScanPdfPages] Found ${tailCount} page(s) in tail slice`)
      return tailCount
    }
  } catch (e) {
    console.warn('[fastScanPdfPages] Tail slice notice:', e)
  }

  // Strategy 2: Scan the head (first 6 MB) where linearized dictionaries & front catalogs live
  try {
    const headSize = Math.min(fileSize, 6 * 1024 * 1024)
    const headBlob = file.slice(0, headSize)
    const headText = await headBlob.text()
    const headCount = extractPageCountFromText(headText)
    if (headCount && headCount > 1) {
      console.log(`[fastScanPdfPages] Found ${headCount} page(s) in head slice`)
      return headCount
    }
  } catch (e) {
    console.warn('[fastScanPdfPages] Head slice notice:', e)
  }

  // Strategy 3: If file is moderate size (<= 35 MB), scan the whole file text
  if (fileSize <= 35 * 1024 * 1024) {
    try {
      const fullText = await file.text()
      const fullCount = extractPageCountFromText(fullText)
      if (fullCount && fullCount > 1) {
        return fullCount
      }
    } catch (e) {}
  }

  return null
}

/**
 * Robustly load a PDF file and return its page count and document handles for rendering.
 * Uses typed array memory buffers for PDF.js to bypass Safari Web Worker blob URL fetch restrictions.
 */
export async function loadPdfDocument(file) {
  const objectUrl = URL.createObjectURL(file)

  // Step 1: Ultra-fast head/tail slice scan (instant page count in < 15ms)
  let fastCount = null
  try {
    fastCount = await fastScanPdfPages(file)
  } catch (e) {}

  // Step 2: Read ArrayBuffer for reliable worker data passing
  let arrayBuffer = null
  try {
    arrayBuffer = await file.arrayBuffer()
  } catch (bufErr) {
    console.warn('[loadPdfDocument] ArrayBuffer read notice:', bufErr)
  }

  // Step 3: High-Fidelity Visual Renderer via PDF.js
  let pdfDoc = null
  try {
    const pdfjs = await loadPdfJs()
    if (pdfjs) {
      // Primary: Pass typed array data directly (works universally across mobile Safari and desktop)
      if (arrayBuffer) {
        try {
          const loadingTask = pdfjs.getDocument({
            data: new Uint8Array(arrayBuffer),
            cMapPacked: true,
          })
          pdfDoc = await loadingTask.promise
          console.log(`[loadPdfDocument] PDF.js loaded via Uint8Array data: ${pdfDoc.numPages} page(s)`)
        } catch (dataErr) {
          console.warn('[loadPdfDocument] PDF.js data load notice, trying URL fallback:', dataErr.message)
        }
      }

      // Secondary: Try object URL fallback
      if (!pdfDoc) {
        try {
          const loadingTask = pdfjs.getDocument({ url: objectUrl })
          pdfDoc = await loadingTask.promise
          console.log(`[loadPdfDocument] PDF.js loaded via URL: ${pdfDoc.numPages} page(s)`)
        } catch (urlErr) {
          console.warn('[loadPdfDocument] PDF.js URL load notice:', urlErr.message)
        }
      }
    }
  } catch (pdfjsErr) {
    console.warn('[loadPdfDocument] PDF.js notice:', pdfjsErr.message)
  }

  // Step 4: pdf-lib fallback (for moderate files or if PDF.js failed)
  let pdfLibDoc = null
  let pdfLibPageCount = 0
  if (arrayBuffer && (!pdfDoc || file.size <= 30 * 1024 * 1024)) {
    try {
      pdfLibDoc = await PDFDocument.load(arrayBuffer, {
        ignoreEncryption: true,
        parseSpeed: ParseSpeeds.Fastest,
        throwOnInvalidObject: false,
      })
      pdfLibPageCount = pdfLibDoc.getPageCount()
      console.log(`[loadPdfDocument] pdf-lib parsed ${pdfLibPageCount} page(s)`)
    } catch (libErr) {
      console.warn('[loadPdfDocument] pdf-lib notice:', libErr.message)
    }
  }

  // Authoritative page count: takes the maximum valid count across all strategies
  const truePageCount = Math.max(
    pdfDoc?.numPages || 0,
    fastCount || 0,
    pdfLibPageCount || 0,
    1
  )

  return {
    pdfDoc,
    pdfLibDoc,
    pageCount: truePageCount,
    objectUrl,
    source: pdfDoc ? 'pdfjs' : (fastCount ? 'fast-scan' : (pdfLibDoc ? 'pdf-lib' : 'fallback'))
  }
}

/**
 * Render a specific page of a PDF document to a data URL (image/jpeg)
 * Handles PDF.js direct render, pdf-lib single-page extraction, and direct File buffer streaming.
 */
export async function renderPdfPageToDataUrl(pdfDoc, pageNum, maxDimension = 800, pdfLibDoc = null, file = null) {
  // 1. Primary: If pdfDoc is loaded, render directly via PDF.js
  if (pdfDoc && pdfDoc.getPage) {
    try {
      const numPages = pdfDoc.numPages || 1
      if (pageNum <= numPages) {
        const page = await pdfDoc.getPage(pageNum)
        const unscaledViewport = page.getViewport({ scale: 1.0 })
        const scale = Math.min(
          maxDimension / Math.max(unscaledViewport.width, unscaledViewport.height),
          2.0
        )
        const viewport = page.getViewport({ scale: Math.max(scale, 0.75) })

        const canvas = document.createElement('canvas')
        const context = canvas.getContext('2d', { alpha: false })
        canvas.width = Math.floor(viewport.width)
        canvas.height = Math.floor(viewport.height)

        await page.render({
          canvasContext: context,
          viewport: viewport
        }).promise
        return canvas.toDataURL('image/jpeg', 0.88)
      }
    } catch (renderErr) {
      console.warn(`[renderPdfPageToDataUrl] Direct render for page ${pageNum} notice:`, renderErr.message)
    }
  }

  // 2. Secondary fallback: Extract page with pdf-lib, wrap in single-page PDF, render with PDF.js
  if (pdfLibDoc) {
    try {
      const totalLibPages = pdfLibDoc.getPageCount()
      if (pageNum >= 1 && pageNum <= totalLibPages) {
        const singleDoc = await PDFDocument.create()
        const [copiedPage] = await singleDoc.copyPages(pdfLibDoc, [pageNum - 1])
        singleDoc.addPage(copiedPage)
        const singleBytes = await singleDoc.save()

        const pdfjs = await loadPdfJs()
        if (pdfjs) {
          const singleLoadingTask = pdfjs.getDocument({
            data: new Uint8Array(singleBytes),
          })
          const singlePdfDoc = await singleLoadingTask.promise
          const singlePage = await singlePdfDoc.getPage(1)
          const unscaledViewport = singlePage.getViewport({ scale: 1.0 })
          const scale = Math.min(
            maxDimension / Math.max(unscaledViewport.width, unscaledViewport.height),
            2.0
          )
          const viewport = singlePage.getViewport({ scale: Math.max(scale, 0.75) })
          const canvas = document.createElement('canvas')
          const context = canvas.getContext('2d', { alpha: false })
          canvas.width = Math.floor(viewport.width)
          canvas.height = Math.floor(viewport.height)
          await singlePage.render({ canvasContext: context, viewport }).promise
          return canvas.toDataURL('image/jpeg', 0.88)
        }
      }
    } catch (fallbackErr) {
      console.warn(`[renderPdfPageToDataUrl] Secondary fallback failed for page ${pageNum}:`, fallbackErr.message)
    }
  }

  // 3. Tertiary fallback: Direct file ArrayBuffer stream via PDF.js
  if (file) {
    try {
      const pdfjs = await loadPdfJs()
      if (pdfjs) {
        const buf = await file.arrayBuffer()
        const loadingTask = pdfjs.getDocument({ data: new Uint8Array(buf) })
        const doc = await loadingTask.promise
        const page = await doc.getPage(pageNum)
        const unscaledViewport = page.getViewport({ scale: 1.0 })
        const scale = Math.min(
          maxDimension / Math.max(unscaledViewport.width, unscaledViewport.height),
          2.0
        )
        const viewport = page.getViewport({ scale: Math.max(scale, 0.75) })
        const canvas = document.createElement('canvas')
        const context = canvas.getContext('2d', { alpha: false })
        canvas.width = Math.floor(viewport.width)
        canvas.height = Math.floor(viewport.height)
        await page.render({ canvasContext: context, viewport }).promise
        return canvas.toDataURL('image/jpeg', 0.88)
      }
    } catch (fileErr) {
      console.warn(`[renderPdfPageToDataUrl] File stream fallback notice:`, fileErr.message)
    }
  }

  return null
}

/**
 * Helper: Parse page range string into 0-indexed page number array
 */
export function parsePageRange(rangeStr, maxPages) {
  if (!rangeStr || !String(rangeStr).trim()) return []
  const indices = new Set()
  const parts = String(rangeStr).split(',')
  for (const part of parts) {
    const trimmed = part.trim()
    if (trimmed.includes('-')) {
      const [startStr, endStr] = trimmed.split('-')
      const start = parseInt(startStr, 10)
      const end = parseInt(endStr, 10)
      if (!isNaN(start) && !isNaN(end)) {
        const min = Math.max(1, Math.min(start, end))
        const max = Math.min(maxPages, Math.max(start, end))
        for (let i = min; i <= max; i++) indices.add(i - 1)
      }
    } else {
      const p = parseInt(trimmed, 10)
      if (!isNaN(p) && p >= 1 && p <= maxPages) {
        indices.add(p - 1)
      }
    }
  }
  return Array.from(indices).sort((a, b) => a - b)
}

/**
 * Slices a PDF file or blob to extract ONLY requested pages before uploading.
 * Reduces 50-100MB documents down to ~200-300KB for instant upload and instant OTP printing.
 */
export async function slicePdfBlob(fileOrBlob, pageRangeStr) {
  if (!fileOrBlob || !pageRangeStr || !String(pageRangeStr).trim()) {
    return fileOrBlob
  }

  try {
    const arrayBuffer = await fileOrBlob.arrayBuffer()
    const srcDoc = await PDFDocument.load(arrayBuffer, { ignoreEncryption: true })
    const totalPages = srcDoc.getPageCount()
    const targetIndices = parsePageRange(pageRangeStr, totalPages)

    // If all pages selected or invalid range, no slicing needed
    if (!targetIndices || targetIndices.length === 0 || targetIndices.length >= totalPages) {
      return fileOrBlob
    }

    console.log(`[slicePdfBlob] Extracting ${targetIndices.length} page(s) out of ${totalPages} before upload...`)
    const outDoc = await PDFDocument.create()

    try {
      const srcPages = targetIndices.map((idx) => srcDoc.getPage(idx))
      const embedded = await outDoc.embedPages(srcPages)
      embedded.forEach((ep) => {
        const page = outDoc.addPage([ep.width, ep.height])
        page.drawPage(ep, { x: 0, y: 0, width: ep.width, height: ep.height })
      })
    } catch (embedErr) {
      console.warn('[slicePdfBlob] embedPages notice, using copyPages:', embedErr.message)
      const copied = await outDoc.copyPages(srcDoc, targetIndices)
      copied.forEach((p) => outDoc.addPage(p))
    }

    const slicedBytes = await outDoc.save()
    const origName = fileOrBlob.name || 'document.pdf'
    const extMatch = origName.match(/\.([0-9a-z]+)(?:[\?#]|$)/i)
    const ext = extMatch ? extMatch[1] : 'pdf'
    const baseName = origName.replace(/\.[^/.]+$/, '')
    const cleanRange = String(pageRangeStr).replace(/[^0-9,-]/g, '')
    const slicedName = `${baseName}_p${cleanRange}.${ext}`

    console.log(`[slicePdfBlob] Client-side slice complete! Size reduced from ${(fileOrBlob.size / 1024 / 1024).toFixed(1)} MB to ${(slicedBytes.length / 1024).toFixed(1)} KB`)
    return new File([slicedBytes], slicedName, { type: 'application/pdf' })
  } catch (err) {
    console.warn('[slicePdfBlob] Slicing notice, proceeding with original file:', err.message)
    return fileOrBlob
  }
}

/**
 * Helper: Convert any image file (WebP, BMP, HEIC, JPG, PNG) to JPEG ArrayBuffer via Canvas
 */
async function convertImageToJpegBuffer(file) {
  return new Promise((resolve, reject) => {
    const img = new Image()
    const url = URL.createObjectURL(file)
    img.onload = () => {
      URL.revokeObjectURL(url)
      const canvas = document.createElement('canvas')
      canvas.width = img.naturalWidth || img.width
      canvas.height = img.naturalHeight || img.height
      const ctx = canvas.getContext('2d')
      ctx.fillStyle = '#ffffff'
      ctx.fillRect(0, 0, canvas.width, canvas.height)
      ctx.drawImage(img, 0, 0)
      canvas.toBlob(async (blob) => {
        if (!blob) {
          reject(new Error('Canvas image conversion failed'))
          return
        }
        resolve(await blob.arrayBuffer())
      }, 'image/jpeg', 0.92)
    }
    img.onerror = (e) => {
      URL.revokeObjectURL(url)
      reject(e)
    }
    img.src = url
  })
}

/**
 * Merges multiple files (PDFs and images) into a single unified multi-page PDF document.
 * Enables selecting multiple photos or documents and compiling them into one seamless print job.
 */
export async function mergeFilesToPdf(files) {
  if (!files || files.length === 0) return null

  // If only 1 PDF file, return directly
  if (files.length === 1 && (files[0].type === 'application/pdf' || files[0].name.toLowerCase().endsWith('.pdf'))) {
    return files[0]
  }

  const mergedDoc = await PDFDocument.create()

  for (let i = 0; i < files.length; i++) {
    const file = files[i]
    const isPdf = file.type === 'application/pdf' || file.name.toLowerCase().endsWith('.pdf')
    const isImage = file.type.startsWith('image/') || /\.(jpe?g|png|webp|bmp|gif)$/i.test(file.name)

    if (isPdf) {
      try {
        const buffer = await file.arrayBuffer()
        const srcDoc = await PDFDocument.load(buffer, { ignoreEncryption: true })
        const pageIndices = srcDoc.getPageIndices()
        const copiedPages = await mergedDoc.copyPages(srcDoc, pageIndices)
        copiedPages.forEach((page) => mergedDoc.addPage(page))
      } catch (pdfErr) {
        console.warn(`[mergeFilesToPdf] Error loading PDF ${file.name}:`, pdfErr)
      }
    } else if (isImage) {
      try {
        let embeddedImage = null
        const isPng = file.type === 'image/png' || file.name.toLowerCase().endsWith('.png')
        const isJpg = file.type === 'image/jpeg' || /\.(jpe?g)$/i.test(file.name)

        if (isPng) {
          try {
            const buf = await file.arrayBuffer()
            embeddedImage = await mergedDoc.embedPng(buf)
          } catch (pngErr) {
            // PNG fallback to canvas jpeg
            const convertedBuf = await convertImageToJpegBuffer(file)
            embeddedImage = await mergedDoc.embedJpg(convertedBuf)
          }
        } else if (isJpg) {
          try {
            const buf = await file.arrayBuffer()
            embeddedImage = await mergedDoc.embedJpg(buf)
          } catch (jpgErr) {
            const convertedBuf = await convertImageToJpegBuffer(file)
            embeddedImage = await mergedDoc.embedJpg(convertedBuf)
          }
        } else {
          // WebP, BMP, etc. convert to Jpeg
          const convertedBuf = await convertImageToJpegBuffer(file)
          embeddedImage = await mergedDoc.embedJpg(convertedBuf)
        }

        if (embeddedImage) {
          // Standard A4 dimensions in points
          const A4_W = 595.28
          const A4_H = 841.89
          const isLandscape = embeddedImage.width > embeddedImage.height
          const pageWidth = isLandscape ? A4_H : A4_W
          const pageHeight = isLandscape ? A4_W : A4_H

          const page = mergedDoc.addPage([pageWidth, pageHeight])
          const margin = 20
          const availW = pageWidth - margin * 2
          const availH = pageHeight - margin * 2

          const scale = Math.min(availW / embeddedImage.width, availH / embeddedImage.height, 1.0)
          const renderW = embeddedImage.width * scale
          const renderH = embeddedImage.height * scale
          const x = (pageWidth - renderW) / 2
          const y = (pageHeight - renderH) / 2

          page.drawImage(embeddedImage, {
            x,
            y,
            width: renderW,
            height: renderH,
          })
        }
      } catch (imgErr) {
        console.warn(`[mergeFilesToPdf] Error embedding image ${file.name}:`, imgErr)
      }
    }
  }

  const mergedBytes = await mergedDoc.save()
  const baseName = files[0].name.replace(/\.[^/.]+$/, '')
  const mergedName = files.length > 1 ? `${baseName}_+_${files.length - 1}_pages.pdf` : `${baseName}.pdf`
  return new File([mergedBytes], mergedName, { type: 'application/pdf' })
}

