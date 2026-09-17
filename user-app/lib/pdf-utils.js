import { PDFDocument } from 'pdf-lib'

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
 * Fast regex-based page count extractor from binary string
 */
function extractPageCountFast(binaryStr) {
  try {
    const pagesMatches = [...binaryStr.matchAll(/\/Type\s*\/Pages[\s\S]*?\/Count\s+(\d+)/g)]
    if (pagesMatches.length > 0) {
      let maxCount = 0
      for (const m of pagesMatches) {
        const count = parseInt(m[1], 10)
        if (count > maxCount) maxCount = count
      }
      if (maxCount > 0) return maxCount
    }

    const reversePagesMatches = [...binaryStr.matchAll(/\/Count\s+(\d+)[\s\S]*?\/Type\s*\/Pages/g)]
    if (reversePagesMatches.length > 0) {
      let maxCount = 0
      for (const m of reversePagesMatches) {
        const count = parseInt(m[1], 10)
        if (count > maxCount) maxCount = count
      }
      if (maxCount > 0) return maxCount
    }

    const pageMatches = binaryStr.match(/\/Type\s*\/Page(?![a-zA-Z])/g)
    if (pageMatches && pageMatches.length > 0) {
      return pageMatches.length
    }
  } catch (e) {
    console.warn('[PDFFastCount] Warning during binary scan:', e)
  }
  return null
}

/**
 * Robustly load a PDF file and return its page count and document handles for rendering.
 * Employs in-memory byte buffer loading for PDF.js to eliminate blob HTTP range-request errors,
 * alongside pure JavaScript pdf-lib parsing to guarantee accurate multi-page detection.
 */
export async function loadPdfDocument(file) {
  const objectUrl = URL.createObjectURL(file)
  let arrayBuffer = null
  try {
    arrayBuffer = await file.arrayBuffer()
  } catch (bufErr) {
    console.warn('[loadPdfDocument] arrayBuffer read notice:', bufErr)
  }

  // 1. Authoritative Page Count via pdf-lib
  // Pure JavaScript parsing of PDF catalog /Pages tree — never trips on workers, CORS, or blob range requests
  let pdfLibDoc = null
  let pdfLibPageCount = 0
  if (arrayBuffer) {
    try {
      pdfLibDoc = await PDFDocument.load(arrayBuffer, { ignoreEncryption: true })
      pdfLibPageCount = pdfLibDoc.getPageCount()
      console.log(`[loadPdfDocument] pdf-lib parsed ${pdfLibPageCount} page(s)`)
    } catch (libErr) {
      console.warn('[loadPdfDocument] pdf-lib notice:', libErr.message)
    }
  }

  // 2. High-Fidelity Visual Renderer via PDF.js
  let pdfDoc = null
  try {
    const pdfjs = await loadPdfJs()
    if (pdfjs) {
      // Primary: load from in-memory byte buffer (eliminates blob range request errors on Chrome/Edge/Firefox)
      if (arrayBuffer) {
        try {
          const loadingTask = pdfjs.getDocument({
            data: new Uint8Array(arrayBuffer),
            cMapUrl: '/pdfjs/cmaps/',
            cMapPacked: true,
          })
          pdfDoc = await loadingTask.promise
          console.log(`[loadPdfDocument] PDF.js loaded in-memory: ${pdfDoc.numPages} page(s)`)
        } catch (memErr) {
          console.warn('[loadPdfDocument] PDF.js in-memory notice, trying URL fallback:', memErr.message)
        }
      }

      // Secondary: load from blob objectUrl if in-memory wasn't available or failed
      if (!pdfDoc) {
        const loadingTask = pdfjs.getDocument({
          url: objectUrl,
        })
        pdfDoc = await loadingTask.promise
        console.log(`[loadPdfDocument] PDF.js loaded via URL: ${pdfDoc.numPages} page(s)`)
      }
    }
  } catch (pdfjsErr) {
    console.warn('[loadPdfDocument] PDF.js failed, relying on pdf-lib for pages & rendering:', pdfjsErr.message)
  }

  // 3. Fallback regex binary scan if both parsers failed
  let fastCount = null
  if (!pdfDoc && !pdfLibPageCount && file) {
    try {
      const sliceSize = Math.min(file.size, 5 * 1024 * 1024)
      const blobSlice = file.slice(0, sliceSize)
      const text = await blobSlice.text()
      fastCount = extractPageCountFast(text)
    } catch (e) {}
  }

  // Determine true authoritative page count (whichever parser found more valid pages)
  const truePageCount = Math.max(
    pdfDoc?.numPages || 0,
    pdfLibPageCount || 0,
    fastCount || 0,
    1
  )

  return {
    pdfDoc,
    pdfLibDoc,
    pageCount: truePageCount,
    objectUrl,
    source: pdfDoc ? 'pdfjs' : (pdfLibDoc ? 'pdf-lib' : 'fallback')
  }
}

/**
 * Render a specific page of a PDF document to a data URL (image/jpeg)
 * Handles both PDF.js and pdf-lib extraction fallback to ensure all pages render.
 */
export async function renderPdfPageToDataUrl(pdfDoc, pageNum, maxDimension = 800, pdfLibDoc = null) {
  // 1. Primary: If pdfDoc is loaded and has this page, render directly
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
            cMapUrl: '/pdfjs/cmaps/',
            cMapPacked: true,
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
