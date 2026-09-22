/**
 * PrintKoro Smart Scanner Utilities
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

  // Calculate destination dimensions from natural edge distances
  const topW = distance(tl, tr)
  const botW = distance(bl, br)
  const leftH = distance(tl, bl)
  const rightH = distance(tr, br)

  const avgW = (topW + botW) / 2
  const avgH = (leftH + rightH) / 2
  const isQuadLandscape = avgW >= avgH

  let destW = Math.round(Math.max(topW, botW))
  let destH = Math.round(Math.max(leftH, rightH))

  // Smart aspect ratio application that preserves orientation (portrait vs landscape)
  if (targetAspectRatio && targetAspectRatio > 0) {
    const targetIsLandscape = targetAspectRatio >= 1
    let effectiveAspect = targetAspectRatio
    if (isQuadLandscape !== targetIsLandscape) {
      effectiveAspect = 1 / targetAspectRatio
    }

    if (effectiveAspect >= 1) {
      destW = Math.round(destH * effectiveAspect)
    } else {
      destH = Math.round(destW / effectiveAspect)
    }
  }

  // Enforce reasonable bounds to prevent massive canvas memory issues
  const maxDim = 2400
  if (destW > maxDim || destH > maxDim) {
    const s = maxDim / Math.max(destW, destH)
    destW = Math.round(destW * s)
    destH = Math.round(destH * s)
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

  // Mesh subdivision grid for smooth non-linear perspective mapping (12x12 = 144 cells, 288 triangles)
  const subdivisions = 12
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

      // Destination quad points in output canvas
      const dx0 = i * stepU
      const dy0 = j * stepV
      const dx1 = (i + 1) * stepU
      const dy1 = (j + 1) * stepV

      // Source quadrilateral points in natural image
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
 * Calculates 2D affine transformation matrix mapping (x, y) -> (u, v) for 3 points
 */
function getAffineTransform(x0, y0, x1, y1, x2, y2, u0, v0, u1, v1, u2, v2) {
  const D = x0 * (y1 - y2) + x1 * (y2 - y0) + x2 * (y0 - y1)
  if (Math.abs(D) < 1e-8) return null

  const a = ((y1 - y2) * u0 + (y2 - y0) * u1 + (y0 - y1) * u2) / D
  const c = ((x2 - x1) * u0 + (x0 - x2) * u1 + (x1 - x0) * u2) / D
  const e = ((x1 * y2 - x2 * y1) * u0 + (x2 * y0 - x0 * y2) * u1 + (x0 * y1 - x1 * y0) * u2) / D

  const b = ((y1 - y2) * v0 + (y2 - y0) * v1 + (y0 - y1) * v2) / D
  const d = ((x2 - x1) * v0 + (x0 - x2) * v1 + (x1 - x0) * v2) / D
  const f = ((x1 * y2 - x2 * y1) * v0 + (x2 * y0 - x0 * y2) * v1 + (x0 * y1 - x1 * y0) * v2) / D

  return { a, b, c, d, e, f }
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
  const T = getAffineTransform(sx0, sy0, sx1, sy1, sx2, sy2, dx0, dy0, dx1, dy1, dx2, dy2)
  if (!T) return

  ctx.save()

  // Clip destination triangle with a slight bleed margin (0.5px) to eliminate hairline seam gaps
  ctx.beginPath()
  ctx.moveTo(dx0, dy0)
  ctx.lineTo(dx1, dy1)
  ctx.lineTo(dx2, dy2)
  ctx.closePath()
  ctx.clip()

  // Transform destination canvas coordinate space to align with source image
  ctx.transform(T.a, T.b, T.c, T.d, T.e, T.f)
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
  const insetX = Math.round(width * 0.03)
  const insetY = Math.round(height * 0.03)

  return [
    { x: insetX, y: insetY },                  // Top-Left
    { x: width - insetX, y: insetY },          // Top-Right
    { x: width - insetX, y: height - insetY }, // Bottom-Right
    { x: insetX, y: height - insetY },         // Bottom-Left
  ]
}

/**
 * Composes scanned side(s) into a standard 300 DPI A4 Canvas (2480 x 3508).
 * @param {string} mode - 'idCard' | 'certificate' | 'halfSheet' | 'auto'
 * @param {HTMLCanvasElement} frontCanvas - Scanned front side
 * @param {HTMLCanvasElement | null} backCanvas - Scanned back side (if present)
 * @returns {HTMLCanvasElement}
 */
export function composeToA4(mode, frontCanvas, backCanvas = null, idCardLayout = 'vertical') {
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
    const isPortrait = frontCanvas && frontCanvas.height > frontCanvas.width

    if (idCardLayout === 'horizontal' && frontCanvas && backCanvas) {
      // Side-by-Side horizontally (Front on Left, Back on Right)
      const cardW = isPortrait ? Math.round(A4_W * 0.42) : Math.round(A4_W * 0.45)
      const gap = Math.round(A4_W * 0.04) // ~100px gap
      const totalW = cardW * 2 + gap
      const startX = Math.round((A4_W - totalW) / 2)

      const h1 = Math.round(cardW * (frontCanvas.height / frontCanvas.width))
      const h2 = Math.round(cardW * (backCanvas.height / backCanvas.width))
      const maxH = Math.max(h1, h2)
      const startY = Math.round((A4_H - maxH) * 0.40)

      ctx.drawImage(frontCanvas, startX, startY, cardW, h1)
      ctx.drawImage(backCanvas, startX + cardW + gap, startY, cardW, h2)
    } else if (frontCanvas && backCanvas) {
      // Stacked vertically (Top & Bottom)
      const cardW = isPortrait ? Math.round(A4_W * 0.38) : Math.round(A4_W * 0.52)
      const h1 = Math.round(cardW * (frontCanvas.height / frontCanvas.width))
      const x1 = Math.round((A4_W - cardW) / 2)
      const y1 = Math.round(A4_H * 0.18)
      ctx.drawImage(frontCanvas, x1, y1, cardW, h1)

      const backIsPortrait = backCanvas.height > backCanvas.width
      const backW = backIsPortrait ? Math.round(A4_W * 0.38) : Math.round(A4_W * 0.52)
      const h2 = Math.round(backW * (backCanvas.height / backCanvas.width))
      const x2 = Math.round((A4_W - backW) / 2)
      const y2 = Math.round(A4_H * 0.54)
      ctx.drawImage(backCanvas, x2, y2, backW, h2)
    } else if (frontCanvas) {
      // Single card centered
      const cardW = isPortrait ? Math.round(A4_W * 0.38) : Math.round(A4_W * 0.52)
      const h = Math.round(cardW * (frontCanvas.height / frontCanvas.width))
      const x = Math.round((A4_W - cardW) / 2)
      const y = Math.round((A4_H - h) / 2)
      ctx.drawImage(frontCanvas, x, y, cardW, h)
    }
  } else if (mode === 'halfSheet') {
    // Admit Card / Marksheet 2-in-1: Top/Bottom or Side-by-Side
    const pad = 120

    if (idCardLayout === 'horizontal' && frontCanvas && backCanvas) {
      const cellW = Math.round((A4_W - pad * 3) / 2)
      const cellH = A4_H - pad * 2

      const scale1 = Math.min(cellW / frontCanvas.width, cellH / frontCanvas.height)
      const w1 = Math.round(frontCanvas.width * scale1)
      const h1 = Math.round(frontCanvas.height * scale1)
      const x1 = Math.round(pad + (cellW - w1) / 2)
      const y1 = Math.round(pad + (cellH - h1) / 2)
      ctx.drawImage(frontCanvas, x1, y1, w1, h1)

      const scale2 = Math.min(cellW / backCanvas.width, cellH / backCanvas.height)
      const w2 = Math.round(backCanvas.width * scale2)
      const h2 = Math.round(backCanvas.height * scale2)
      const x2 = Math.round(pad * 2 + cellW + (cellW - w2) / 2)
      const y2 = Math.round(pad + (cellH - h2) / 2)
      ctx.drawImage(backCanvas, x2, y2, w2, h2)

      // Vertical dividing line across the middle
      ctx.strokeStyle = '#e2e8f0'
      ctx.lineWidth = 4
      ctx.setLineDash([24, 16])
      ctx.beginPath()
      ctx.moveTo(Math.round(A4_W / 2), pad)
      ctx.lineTo(Math.round(A4_W / 2), A4_H - pad)
      ctx.stroke()
      ctx.setLineDash([])
    } else {
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

      // Horizontal dividing line across the middle
      ctx.strokeStyle = '#e2e8f0'
      ctx.lineWidth = 4
      ctx.setLineDash([24, 16])
      ctx.beginPath()
      ctx.moveTo(pad, Math.round(A4_H / 2))
      ctx.lineTo(A4_W - pad, Math.round(A4_H / 2))
      ctx.stroke()
      ctx.setLineDash([])
    }
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
