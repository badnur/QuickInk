import { jsPDF } from 'jspdf'

/**
 * Applies CamScanner-like image enhancement filters to a canvas
 * @param {HTMLCanvasElement} sourceCanvas 
 * @param {'original' | 'clean_bw' | 'magic_color' | 'grayscale'} filterType 
 * @returns {HTMLCanvasElement} A new canvas with filter applied
 */
export function applyFilter(sourceCanvas, filterType = 'clean_bw') {
  const outputCanvas = document.createElement('canvas')
  outputCanvas.width = sourceCanvas.width
  outputCanvas.height = sourceCanvas.height
  const ctx = outputCanvas.getContext('2d')
  ctx.drawImage(sourceCanvas, 0, 0)

  if (filterType === 'original') {
    return outputCanvas
  }

  const imageData = ctx.getImageData(0, 0, outputCanvas.width, outputCanvas.height)
  const data = imageData.data
  const len = data.length

  if (filterType === 'clean_bw') {
    // CamScanner Clean B&W Document Filter:
    // Calculates luminance, applies high-contrast thresholding with shadow removal
    // to whiten the paper background and darken text/lines.
    for (let i = 0; i < len; i += 4) {
      const r = data[i]
      const g = data[i + 1]
      const b = data[i + 2]
      // Standard perceptual luminance
      const gray = 0.299 * r + 0.587 * g + 0.114 * b

      // Dynamic curve for document paper vs ink:
      // Paper background (> 140) pushed toward pure white
      // Ink/text (< 140) pushed toward deep black
      let val
      if (gray > 145) {
        val = Math.min(255, gray * 1.35)
      } else if (gray > 90) {
        val = (gray - 90) * 2.5
      } else {
        val = Math.max(0, gray * 0.7)
      }

      data[i] = val
      data[i + 1] = val
      data[i + 2] = val
    }
  } else if (filterType === 'magic_color') {
    // CamScanner Magic Color Filter:
    // Whitens background while preserving and boosting text ink colors (blue/red/black)
    for (let i = 0; i < len; i += 4) {
      let r = data[i]
      let g = data[i + 1]
      let b = data[i + 2]

      const gray = 0.299 * r + 0.587 * g + 0.114 * b

      // If background is paper-like light, lift to pure white
      if (gray > 165) {
        r = Math.min(255, r * 1.25)
        g = Math.min(255, g * 1.25)
        b = Math.min(255, b * 1.25)
      } else {
        // Boost contrast & saturation for handwriting and color markers
        r = Math.min(255, Math.max(0, (r - 128) * 1.35 + 128))
        g = Math.min(255, Math.max(0, (g - 128) * 1.35 + 128))
        b = Math.min(255, Math.max(0, (b - 128) * 1.35 + 128))
      }

      data[i] = r
      data[i + 1] = g
      data[i + 2] = b
    }
  } else if (filterType === 'grayscale') {
    // Clean Grayscale
    for (let i = 0; i < len; i += 4) {
      const gray = 0.299 * data[i] + 0.587 * data[i + 1] + 0.114 * data[i + 2]
      // Mild contrast stretch
      const adjusted = Math.min(255, Math.max(0, (gray - 120) * 1.2 + 120))
      data[i] = adjusted
      data[i + 1] = adjusted
      data[i + 2] = adjusted
    }
  }

  ctx.putImageData(imageData, 0, 0)
  return outputCanvas
}

/**
 * Rotates a canvas by 90, 180, or 270 degrees
 * @param {HTMLCanvasElement} canvas 
 * @param {number} degrees - 90, 180, or 270
 * @returns {HTMLCanvasElement}
 */
export function rotateCanvas(canvas, degrees = 90) {
  const rad = (degrees * Math.PI) / 180
  const isSwap = degrees === 90 || degrees === 270

  const rotatedCanvas = document.createElement('canvas')
  rotatedCanvas.width = isSwap ? canvas.height : canvas.width
  rotatedCanvas.height = isSwap ? canvas.width : canvas.height

  const ctx = rotatedCanvas.getContext('2d')
  ctx.translate(rotatedCanvas.width / 2, rotatedCanvas.height / 2)
  ctx.rotate(rad)
  ctx.drawImage(canvas, -canvas.width / 2, -canvas.height / 2)

  return rotatedCanvas
}

/**
 * Compiles an array of image data URLs into an A4 PDF Blob
 * @param {string[]} dataUrls - List of JPEG/PNG base64 data URLs
 * @returns {Blob} The compiled PDF blob
 */
export async function imagesToPdfBlob(dataUrls) {
  if (!dataUrls || dataUrls.length === 0) {
    throw new Error('No images provided to compile PDF')
  }

  // Standard A4 dimensions in mm: 210 x 297
  const pdf = new jsPDF({
    orientation: 'portrait',
    unit: 'mm',
    format: 'a4',
  })

  const a4Width = 210
  const a4Height = 297
  const margin = 10
  const maxWidth = a4Width - margin * 2
  const maxHeight = a4Height - margin * 2

  for (let i = 0; i < dataUrls.length; i++) {
    if (i > 0) {
      pdf.addPage('a4', 'portrait')
    }

    const imgData = dataUrls[i]
    // Calculate aspect ratio
    const imgProps = pdf.getImageProperties(imgData)
    const imgRatio = imgProps.width / imgProps.height
    const maxRatio = maxWidth / maxHeight

    let printWidth = maxWidth
    let printHeight = maxHeight

    if (imgRatio > maxRatio) {
      printHeight = maxWidth / imgRatio
    } else {
      printWidth = maxHeight * imgRatio
    }

    const x = margin + (maxWidth - printWidth) / 2
    const y = margin + (maxHeight - printHeight) / 2

    pdf.addImage(imgData, 'JPEG', x, y, printWidth, printHeight, undefined, 'FAST')
  }

  const pdfOutput = pdf.output('blob')
  return pdfOutput
}
