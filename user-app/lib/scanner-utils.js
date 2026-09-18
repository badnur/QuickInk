/**
 * QuickInk Smart Scanner Utilities
 * - 4-Point Perspective Transform (homography/triangle warp without heavy external libs)
 * - Document Image Clean & Enhancement Filters
 * - Multi-side Template Layout Compositors (ID Card, Admit Card 2-in-1, Full A4)
 */

// Distance between two points
export function distance(p1, p2) {
  return Math.hypot(p2.x - p1.x, p2.y - p1.y)
}

/**
 * Performs a 4-point perspective warp on an image given 4 corner points.
 * @param {HTMLImageElement | HTMLCanvasElement} sourceImg - The input source image
 * @param {Array<{x: number, y: number}>} corners - [tl, tr, br, bl] in image pixel coordinates
 * @param {number} [targetAspectRatio] - Optional aspect ratio (width / height). If omitted, derived from corners.
 * @returns {HTMLCanvasElement} - Clean, straightened rectangular canvas
 */
export function perspectiveWarp(sourceImg, corners, targetAspectRatio = null) {
  const [tl, tr, br, bl] = corners

  // Calculate destination dimensions
  const topW = distance(tl, tr)
  const botW = distance(bl, br)
  const leftH = distance(tl, bl)
  const rightH = distance(tr, br)

  let destW = Math.round(Math.max(topW, botW))
  let destH = Math.round(Math.max(leftH, rightH))

  // Enforce reasonable bounds to prevent massive canvas memory issues
  const maxDim = 2400
  if (destW > maxDim || destH > maxDim) {
    const s = maxDim / Math.max(destW, destH)
    destW = Math.round(destW * s)
    destH = Math.round(destH * s)
  }

  if (targetAspectRatio && targetAspectRatio > 0) {
    destW = Math.round(destH * targetAspectRatio)
  }

  destW = Math.max(100, destW)
  destH = Math.max(100, destH)

  const outputCanvas = document.createElement('canvas')
  outputCanvas.width = destW
  outputCanvas.height = destH
  const ctx = outputCanvas.getContext('2d', { willReadFrequently: true })
  if (!ctx) return outputCanvas

  // High quality image smoothing
  ctx.imageSmoothingEnabled = true
  ctx.imageSmoothingQuality = 'high'

  // Mesh subdivision grid for smooth non-linear perspective mapping
  const subdivisions = 16
  const stepU = destW / subdivisions
  const stepV = destH / subdivisions

  // Bilinear interpolation function to map (u, v) in [0..1] to quadrilateral (tl, tr, br, bl)
  function mapUV(u, v) {
    const topX = tl.x + (tr.x - tl.x) * u
    const topY = tl.y + (tr.y - tl.y) * u
    const botX = bl.x + (br.x - bl.x) * u
    const botY = bl.y + (br.y - bl.y) * u

    return {
      x: topX + (botX - topX) * v,
      y: topY + (botY - topY) * v,
    }
  }

  // Draw two affine-transformed triangles for each quad cell in the mesh
  for (let i = 0; i < subdivisions; i++) {
    for (let j = 0; j < subdivisions; j++) {
      const u0 = i / subdivisions
      const u1 = (i + 1) / subdivisions
      const v0 = j / subdivisions
      const v1 = (j + 1) / subdivisions

      // Destination quad points
      const dx0 = i * stepU
      const dy0 = j * stepV
      const dx1 = (i + 1) * stepU
      const dy1 = (j + 1) * stepV

      // Source quadrilateral points
      const p00 = mapUV(u0, v0)
      const p10 = mapUV(u1, v0)
      const p11 = mapUV(u1, v1)
      const p01 = mapUV(u0, v1)

      // Render upper-left triangle: (0,0) -> (1,0) -> (0,1)
      drawAffineTriangle(
        ctx,
        sourceImg,
        p00.x, p00.y,
        p10.x, p10.y,
        p01.x, p01.y,
        dx0, dy0,
        dx1, dy0,
        dx0, dy1
      )

      // Render lower-right triangle: (1,0) -> (1,1) -> (0,1)
      drawAffineTriangle(
        ctx,
        sourceImg,
        p10.x, p10.y,
        p11.x, p11.y,
        p01.x, p01.y,
        dx1, dy0,
        dx1, dy1,
        dx0, dy1
      )
    }
  }

  return outputCanvas
}

/**
 * Maps a textured source triangle to a destination triangle using canvas 2D affine transform.
 */
function drawAffineTriangle(
  ctx,
  img,
  sx0, sy0,
  sx1, sy1,
  sx2, sy2,
  dx0, dy0,
  dx1, dy1,
  dx2, dy2
) {
  ctx.save()

  // Clip destination triangle with a slight bleed margin (0.5px) to eliminate hairline seam gaps
  ctx.beginPath()
  ctx.moveTo(dx0, dy0)
  ctx.lineTo(dx1, dy1)
  ctx.lineTo(dx2, dy2)
  ctx.closePath()
  ctx.clip()

  // Calculate 2D affine matrix mapping (sx, sy) -> (dx, dy)
  const denom = (sx0 * (sy1 - sy2) - sx1 * sy0 + sx2 * sy0 + sx1 * sy2 - sx2 * sy1)
  if (Math.abs(denom) < 1e-8) {
    ctx.restore()
    return
  }

  const m11 = - (sy0 * (dx1 - dx2) - sy1 * dx0 + sy2 * dx0 + sy1 * dx2 - sy2 * dx1) / denom
  const m12 = (sy1 * dy0 - sy2 * dy0 - sy0 * dy1 + sy2 * dy1 + sy0 * dy2 - sy1 * dy2) / denom
  const m21 = (sx0 * (dx1 - dx2) - sx1 * dx0 + sx2 * dx0 + sx1 * dx2 - sx2 * dx1) / denom
  const m22 = - (sx1 * dy0 - sx2 * dy0 - sx0 * dy1 + sx2 * dy1 + sx0 * dy2 - sx1 * dy2) / denom
  const dx = (sx0 * (sy2 * dx1 - sy1 * dx2) + sy0 * (sx1 * dx2 - sx2 * dx1) + (sx2 * sy1 - sx1 * sy2) * dx0) / denom
  const dy = (sx0 * (sy2 * dy1 - sy1 * dy2) + sy0 * (sx1 * dy2 - sx2 * dy1) + (sx2 * sy1 - sx1 * sy2) * dy0) / denom

  ctx.transform(m11, m12, m21, m22, dx, dy)
  ctx.drawImage(img, 0, 0)
  ctx.restore()
}

/**
 * Applies document enhancement filters (Magic Clean, B&W High Contrast, Grayscale)
 * @param {HTMLCanvasElement} canvas
 * @param {'original' | 'magic' | 'bw' | 'grayscale'} filterMode
 * @returns {HTMLCanvasElement}
 */
export function applyDocumentFilter(canvas, filterMode) {
  if (filterMode === 'original') return canvas

  const out = document.createElement('canvas')
  out.width = canvas.width
  out.height = canvas.height
  const ctx = out.getContext('2d')
  if (!ctx) return canvas

  ctx.drawImage(canvas, 0, 0)
  const imgData = ctx.getImageData(0, 0, out.width, out.height)
  const d = imgData.data

  if (filterMode === 'grayscale') {
    for (let i = 0; i < d.length; i += 4) {
      const gray = 0.299 * d[i] + 0.587 * d[i + 1] + 0.114 * d[i + 2]
      d[i] = gray
      d[i + 1] = gray
      d[i + 2] = gray
    }
  } else if (filterMode === 'magic') {
    // Magic Clean: whiten paper background, boost dark text/details, preserve color
    for (let i = 0; i < d.length; i += 4) {
      let r = d[i]
      let g = d[i + 1]
      let b = d[i + 2]
      const luminance = 0.299 * r + 0.587 * g + 0.114 * b

      // If light (paper/table shadow), boost to white
      if (luminance > 140) {
        const factor = 1 + (luminance - 140) / 70
        r = Math.min(255, r * factor)
        g = Math.min(255, g * factor)
        b = Math.min(255, b * factor)
      } else {
        // If dark (ink/text/photos), deepen black
        const factor = Math.max(0.6, luminance / 140)
        r = Math.max(0, r * factor)
        g = Math.max(0, g * factor)
        b = Math.max(0, b * factor)
      }

      d[i] = r
      d[i + 1] = g
      d[i + 2] = b
    }
  } else if (filterMode === 'bw') {
    // High-contrast clean black & white photocopy
    for (let i = 0; i < d.length; i += 4) {
      const gray = 0.299 * d[i] + 0.587 * d[i + 1] + 0.114 * d[i + 2]
      // Dynamic threshold
      const val = gray < 135 ? Math.max(0, gray * 0.4) : 255
      d[i] = val
      d[i + 1] = val
      d[i + 2] = val
    }
  }

  ctx.putImageData(imgData, 0, 0)
  return out
}

/**
 * Rotates a canvas by 90-degree increments
 */
export function rotateCanvas(canvas, degrees) {
  const normDeg = ((degrees % 360) + 360) % 360
  if (normDeg === 0) return canvas

  const out = document.createElement('canvas')
  const is90or270 = normDeg === 90 || normDeg === 270
  out.width = is90or270 ? canvas.height : canvas.width
  out.height = is90or270 ? canvas.width : canvas.height
  const ctx = out.getContext('2d')
  if (!ctx) return canvas

  ctx.translate(out.width / 2, out.height / 2)
  ctx.rotate((normDeg * Math.PI) / 180)
  ctx.drawImage(canvas, -canvas.width / 2, -canvas.height / 2)

  return out
}

/**
 * Automatically estimates the initial document corner points [tl, tr, br, bl]
 * with a safe inset margin inside the image frame.
 */
export function getInitialCorners(width, height) {
  const insetX = width * 0.08
  const insetY = height * 0.08

  return [
    { x: Math.round(insetX), y: Math.round(insetY) },                       // Top-Left
    { x: Math.round(width - insetX), y: Math.round(insetY) },               // Top-Right
    { x: Math.round(width - insetX), y: Math.round(height - insetY) },      // Bottom-Right
    { x: Math.round(insetX), y: Math.round(height - insetY) },              // Bottom-Left
  ]
}

/**
 * Composes scanned side(s) into a standard 300 DPI A4 Canvas (2480 x 3508).
 * @param {string} mode - 'idCard' | 'certificate' | 'halfSheet' | 'auto'
 * @param {HTMLCanvasElement} frontCanvas - Scanned front side
 * @param {HTMLCanvasElement | null} backCanvas - Scanned back side (if present)
 * @returns {HTMLCanvasElement}
 */
export function composeToA4(mode, frontCanvas, backCanvas = null) {
  const A4_W = 2480
  const A4_H = 3508
  const out = document.createElement('canvas')
  out.width = A4_W
  out.height = A4_H
  const ctx = out.getContext('2d')
  if (!ctx) return out

  // Clean pure white A4 background
  ctx.fillStyle = '#ffffff'
  ctx.fillRect(0, 0, A4_W, A4_H)

  if (mode === 'idCard') {
    // ID Card: Standard card dimensions ~85.6mm x 53.98mm
    const cardW = Math.round(A4_W * 0.52) // ~11 cm on A4

    if (frontCanvas && backCanvas) {
      // Front on upper center, Back on lower center
      const h1 = Math.round(cardW * (frontCanvas.height / frontCanvas.width))
      const x1 = Math.round((A4_W - cardW) / 2)
      const y1 = Math.round(A4_H * 0.22)
      ctx.drawImage(frontCanvas, x1, y1, cardW, h1)

      const h2 = Math.round(cardW * (backCanvas.height / backCanvas.width))
      const x2 = Math.round((A4_W - cardW) / 2)
      const y2 = Math.round(A4_H * 0.52)
      ctx.drawImage(backCanvas, x2, y2, cardW, h2)
    } else if (frontCanvas) {
      // Single card centered
      const h = Math.round(cardW * (frontCanvas.height / frontCanvas.width))
      const x = Math.round((A4_W - cardW) / 2)
      const y = Math.round((A4_H - h) / 2)
      ctx.drawImage(frontCanvas, x, y, cardW, h)
    }
  } else if (mode === 'halfSheet') {
    // Admit Card / Marksheet 2-in-1: Top Half and Bottom Half
    const pad = 120
    const cellW = A4_W - pad * 2
    const cellH = Math.round((A4_H - pad * 3) / 2)

    if (frontCanvas) {
      const scale1 = Math.min(cellW / frontCanvas.width, cellH / frontCanvas.height)
      const w1 = Math.round(frontCanvas.width * scale1)
      const h1 = Math.round(frontCanvas.height * scale1)
      const x1 = Math.round(pad + (cellW - w1) / 2)
      const y1 = Math.round(pad + (cellH - h1) / 2)
      ctx.drawImage(frontCanvas, x1, y1, w1, h1)
    }

    if (backCanvas) {
      const scale2 = Math.min(cellW / backCanvas.width, cellH / backCanvas.height)
      const w2 = Math.round(backCanvas.width * scale2)
      const h2 = Math.round(backCanvas.height * scale2)
      const x2 = Math.round(pad + (cellW - w2) / 2)
      const y2 = Math.round(pad * 2 + cellH + (cellH - h2) / 2)
      ctx.drawImage(backCanvas, x2, y2, w2, h2)
    }

    // Optional dividing line across the middle
    ctx.strokeStyle = '#e2e8f0'
    ctx.lineWidth = 4
    ctx.setLineDash([24, 16])
    ctx.beginPath()
    ctx.moveTo(pad, Math.round(A4_H / 2))
    ctx.lineTo(A4_W - pad, Math.round(A4_H / 2))
    ctx.stroke()
    ctx.setLineDash([])
  } else {
    // Certificate / Full Document / Auto: Fill the A4 page with clean margins
    const pad = 90
    const availW = A4_W - pad * 2
    const availH = A4_H - pad * 2

    const activeCanvas = frontCanvas || backCanvas
    if (activeCanvas) {
      const scale = Math.min(availW / activeCanvas.width, availH / activeCanvas.height)
      const w = Math.round(activeCanvas.width * scale)
      const h = Math.round(activeCanvas.height * scale)
      const x = Math.round((A4_W - w) / 2)
      const y = Math.round((A4_H - h) / 2)
      ctx.drawImage(activeCanvas, x, y, w, h)
    }
  }

  return out
}
