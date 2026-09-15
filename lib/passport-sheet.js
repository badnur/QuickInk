/**
 * Passport Photo Sheet Generator
 * Generates standard 300 DPI passport sheets with dashed scissor-cutting lines,
 * consistent aspect ratio (28:37 / 35×45mm standard), and optional photo borders.
 */

const PHOTO_AR = 28 / 37 // Standard passport photo ratio (~0.756)
const SHEET_MARGIN_MM = 2.0
const SHEET_GAP_MM = 2.0

export const PASSPORT_PLANS = {
  4: { count: 4, cols: 2, rows: 2, land: false, label: '4 Photos' },
  6: { count: 6, cols: 2, rows: 3, land: false, label: '6 Photos' },
  8: { count: 8, cols: 4, rows: 2, land: true, label: '8 Photos' },
  10: { count: 10, cols: 3, rows: 2, land: false, mixed: true, label: '10 Photos' },
  12: { count: 12, cols: 3, rows: 4, land: false, label: '12 Photos' },
}

/**
 * Calculates layout dimensions for a given photo count on a 4x6" photo sheet at 300 DPI.
 */
export function getSheetGeometry(count = 6) {
  const plan = PASSPORT_PLANS[count] || PASSPORT_PLANS[6]
  const dpi = 300
  const mm = dpi / 25.4

  // 4x6 inches in pixels
  const W = Math.round((plan.land ? 6 : 4) * dpi)
  const H = Math.round((plan.land ? 4 : 6) * dpi)
  const M = SHEET_MARGIN_MM * mm
  const gap = Math.round(SHEET_GAP_MM * mm)
  const availW = W - 2 * M
  const availH = H - 2 * M

  let pw, ph
  if (plan.mixed) {
    // 3+3 portrait + 2+2 landscape
    const byH = (availH - 3 * gap) / (2 / PHOTO_AR + 2)
    const byW = Math.min((availW - 2 * gap) / 3, ((availW - gap) / 2) * PHOTO_AR)
    pw = Math.floor(Math.min(byH, byW))
    ph = Math.round(pw / PHOTO_AR)
  } else {
    const byW = (availW - (plan.cols - 1) * gap) / plan.cols
    const byH = ((availH - (plan.rows - 1) * gap) / plan.rows) * PHOTO_AR
    pw = Math.floor(Math.min(byW, byH))
    ph = Math.round(pw / PHOTO_AR)
  }

  const blockH = plan.mixed
    ? 2 * ph + 2 * pw + 3 * gap
    : plan.rows * ph + (plan.rows - 1) * gap
  const top = Math.round((H - blockH) / 2)

  return { plan, W, H, pw, ph, gap, top, dpi, mm }
}

/**
 * Renders a complete passport photo sheet onto an HTML5 Canvas.
 *
 * @param {HTMLImageElement | HTMLCanvasElement} sourceImage - Cropped passport photo
 * @param {number} count - 4, 6, 8, 10, or 12
 * @param {boolean} withBorder - whether to draw a fine 1px black border around each photo
 * @returns {HTMLCanvasElement}
 */
export function renderPassportSheet(sourceImage, count = 6, withBorder = true) {
  const geom = getSheetGeometry(count)
  const { W, H, pw, ph, gap, top, dpi, plan } = geom

  const canvas = document.createElement('canvas')
  canvas.width = W
  canvas.height = H
  const ctx = canvas.getContext('2d')

  ctx.imageSmoothingEnabled = true
  ctx.imageSmoothingQuality = 'high'

  // Clean white paper background
  ctx.fillStyle = '#ffffff'
  ctx.fillRect(0, 0, W, H)

  const rows = []

  // Draw portrait photo
  const drawPhoto = (x, y) => {
    ctx.drawImage(sourceImage, x, y, pw, ph)
    if (withBorder) {
      ctx.strokeStyle = '#000000'
      ctx.lineWidth = 2
      ctx.strokeRect(x, y, pw, ph)
    }
  }

  // Draw rotated landscape photo (for mixed 10-pack)
  const drawRotated = (x, y) => {
    ctx.save()
    ctx.translate(x + ph / 2, y + pw / 2)
    ctx.rotate(Math.PI / 2)
    ctx.drawImage(sourceImage, -pw / 2, -ph / 2, pw, ph)
    ctx.restore()
    if (withBorder) {
      ctx.strokeStyle = '#000000'
      ctx.lineWidth = 2
      ctx.strokeRect(x, y, ph, pw)
    }
  }

  const drawPortraitRow = (n, y) => {
    const x0 = Math.round((W - (n * pw + (n - 1) * gap)) / 2)
    const items = []
    for (let i = 0; i < n; i++) {
      const x = x0 + i * (pw + gap)
      drawPhoto(x, y)
      items.push({ x, w: pw })
    }
    rows.push({ y, h: ph, items })
  }

  const drawLandscapeRow = (n, y) => {
    const x0 = Math.round((W - (n * ph + (n - 1) * gap)) / 2)
    const items = []
    for (let i = 0; i < n; i++) {
      const x = x0 + i * (ph + gap)
      drawRotated(x, y)
      items.push({ x, w: ph })
    }
    rows.push({ y, h: pw, items })
  }

  if (plan.mixed) {
    // 10 count: 3 + 3 portrait, then 2 + 2 landscape
    drawPortraitRow(3, top)
    drawPortraitRow(3, top + ph + gap)
    const yL = top + 2 * (ph + gap)
    drawLandscapeRow(2, yL)
    drawLandscapeRow(2, yL + pw + gap)
  } else {
    for (let r = 0; r < plan.rows; r++) {
      drawPortraitRow(plan.cols, top + r * (ph + gap))
    }
  }

  // Draw dashed scissor-cutting lines
  ctx.save()
  ctx.strokeStyle = 'rgba(0, 0, 0, 0.45)'
  ctx.lineWidth = Math.max(1, Math.round(dpi / 150))
  const dash = Math.max(4, Math.round(dpi / 25))
  ctx.setLineDash([dash, dash])

  // Vertical cut lines between photos in each row
  rows.forEach((r) => {
    for (let i = 1; i < r.items.length; i++) {
      const a = r.items[i - 1]
      const b = r.items[i]
      const cx = Math.round((a.x + a.w + b.x) / 2)
      ctx.beginPath()
      ctx.moveTo(cx, r.y)
      ctx.lineTo(cx, r.y + r.h)
      ctx.stroke()
    }
  })

  // Horizontal cut lines between rows
  for (let i = 1; i < rows.length; i++) {
    const a = rows[i - 1]
    const b = rows[i]
    const cy = Math.round((a.y + a.h + b.y) / 2)
    const minX = a.items[0].x
    const maxX = a.items[a.items.length - 1].x + a.items[a.items.length - 1].w
    ctx.beginPath()
    ctx.moveTo(minX, cy)
    ctx.lineTo(maxX, cy)
    ctx.stroke()
  }

  // Outer boundary trimming line
  let minX = Infinity, minY = Infinity, maxX = 0, maxY = 0
  rows.forEach((r) => {
    r.items.forEach((it) => {
      if (it.x < minX) minX = it.x
      if (it.x + it.w > maxX) maxX = it.x + it.w
    })
    if (r.y < minY) minY = r.y
    if (r.y + r.h > maxY) maxY = r.y + r.h
  })

  if (minX !== Infinity) {
    const pad = Math.round(SHEET_MARGIN_MM * geom.mm * 0.5)
    ctx.strokeRect(minX - pad, minY - pad, (maxX - minX) + 2 * pad, (maxY - minY) + 2 * pad)
  }

  ctx.restore()

  return canvas
}
