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
 * Robustly load a PDF file and return its page count and a document handle for rendering.
 */
export async function loadPdfDocument(file) {
  const objectUrl = URL.createObjectURL(file)

  // 1. Try PDF.js (fastest and supports streaming range requests for huge files)
  try {
    const pdfjs = await loadPdfJs()
    if (pdfjs) {
      const loadingTask = pdfjs.getDocument({
        url: objectUrl,
        disableAutoFetch: true,
        disableStream: false
      })
      const pdfDoc = await loadingTask.promise
      return {
        pdfDoc,
        pageCount: pdfDoc.numPages || 1,
        objectUrl,
        source: 'pdfjs'
      }
    }
  } catch (pdfjsErr) {
    console.warn('[loadPdfDocument] PDF.js failed, falling back to pdf-lib:', pdfjsErr)
  }

  // 2. Fallback to pdf-lib
  try {
    const arrayBuffer = await file.arrayBuffer()
    const pdfLibDoc = await PDFDocument.load(arrayBuffer, { ignoreEncryption: true })
    const pageCount = pdfLibDoc.getPageCount()
    return {
      pdfDoc: null,
      pdfLibDoc,
      pageCount: pageCount || 1,
      objectUrl,
      source: 'pdf-lib'
    }
  } catch (pdfLibErr) {
    console.warn('[loadPdfDocument] pdf-lib failed, falling back to fast scan:', pdfLibErr)
  }

  // 3. Last fallback: Fast text/binary regex
  try {
    const sliceSize = Math.min(file.size, 5 * 1024 * 1024)
    const blobSlice = file.slice(0, sliceSize)
    const text = await blobSlice.text()
    const fastCount = extractPageCountFast(text)
    if (fastCount && fastCount > 0) {
      return {
        pdfDoc: null,
        pageCount: fastCount,
        objectUrl,
        source: 'fast-scan'
      }
    }
  } catch (e) {
    console.warn('[loadPdfDocument] Fast scan failed:', e)
  }

  // Safe default
  return {
    pdfDoc: null,
    pageCount: 1,
    objectUrl,
    source: 'fallback'
  }
}

/**
 * Render a specific page of a PDF document to a data URL (image/jpeg)
 */
export async function renderPdfPageToDataUrl(pdfDoc, pageNum, maxDimension = 800) {
  if (!pdfDoc || !pdfDoc.getPage) return null

  try {
    const page = await pdfDoc.getPage(pageNum)
    const unscaledViewport = page.getViewport({ scale: 1.0 })
    
    // Scale to fit inside maxDimension
    const scale = Math.min(
      maxDimension / Math.max(unscaledViewport.width, unscaledViewport.height),
      2.0
    )
    const viewport = page.getViewport({ scale: Math.max(scale, 0.75) })

    const canvas = document.createElement('canvas')
    const context = canvas.getContext('2d', { alpha: false })
    canvas.width = Math.floor(viewport.width)
    canvas.height = Math.floor(viewport.height)

    const renderContext = {
      canvasContext: context,
      viewport: viewport
    }

    await page.render(renderContext).promise
    return canvas.toDataURL('image/jpeg', 0.88)
  } catch (renderErr) {
    console.warn(`[renderPdfPageToDataUrl] Error rendering page ${pageNum}:`, renderErr)
    return null
  }
}
