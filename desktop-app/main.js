const { app, BrowserWindow, ipcMain, shell } = require('electron')
const path = require('path')
const fs = require('fs')
const child_process = require('child_process')
const http = require('http')

// Load environment variables from .env.local if present
function loadLocalEnv() {
  const envCandidates = [
    path.resolve(__dirname, '..', '.env.local'),
    path.resolve(__dirname, '..', 'user-app', '.env.local'),
    path.resolve(__dirname, '.env.local'),
    path.resolve(process.cwd(), '.env.local'),
    path.resolve(process.cwd(), '..', '.env.local'),
    path.resolve(process.cwd(), 'user-app', '.env.local'),
    path.resolve(__dirname, '..', '.env'),
    path.resolve(__dirname, '..', 'user-app', '.env')
  ]
  for (const envPath of envCandidates) {
    if (fs.existsSync(envPath)) {
      try {
        const content = fs.readFileSync(envPath, 'utf8')
        content.split(/\r?\n/).forEach(line => {
          const match = line.match(/^\s*([A-Za-z0-9_]+)\s*=\s*(.*)?\s*$/)
          if (match) {
            const key = match[1]
            let val = (match[2] || '').trim()
            if ((val.startsWith('"') && val.endsWith('"')) || (val.startsWith("'") && val.endsWith("'"))) {
              val = val.slice(1, -1)
            }
            if (!process.env[key]) {
              process.env[key] = val
            }
          }
        })
      } catch (e) {}
    }
  }
}
loadLocalEnv()

let pdfToPrinter = null
try {
  pdfToPrinter = require('pdf-to-printer')
} catch (e) {
  console.warn('pdf-to-printer load notice:', e.message)
}

let PDFLib = null
try {
  PDFLib = require('pdf-lib')
} catch (e) {
  console.warn('pdf-lib load notice:', e.message)
}

let Jimp = null
try {
  const jimpMod = require('jimp')
  Jimp = jimpMod.Jimp || jimpMod
} catch (e) {
  console.warn('jimp load notice:', e.message)
}

let autoUpdater = null
try {
  const updaterModule = require('electron-updater')
  autoUpdater = updaterModule.autoUpdater
} catch (e) {
  console.warn('electron-updater load notice:', e.message)
}

let mainWindow = null

// In development, watch main.js and src directory so edits take effect immediately
if (!app.isPackaged) {
  try {
    let reloadDebounce = null
    const triggerRestart = (target) => {
      clearTimeout(reloadDebounce)
      reloadDebounce = setTimeout(() => {
        console.log(`[Dev] ${target} modified, restarting Electron app...`)
        app.relaunch()
        app.exit(0)
      }, 300)
    }

    fs.watch(__filename, () => triggerRestart('main.js'))

    const srcDir = path.join(__dirname, 'src')
    if (fs.existsSync(srcDir)) {
      fs.watch(srcDir, { recursive: true }, (eventType, filename) => {
        if (!filename) return
        const normalized = filename.replace(/\\/g, '/')
        if (normalized.includes('assets/') || normalized.endsWith('.ico') || normalized.endsWith('.png') || normalized === 'assets') {
          return
        }
        const ext = path.extname(filename).toLowerCase()
        if (['.js', '.html', '.css'].includes(ext)) {
          triggerRestart(filename)
        }
      })
    }
  } catch (e) {}
}

// Config file path in app userData directory (supports PrintKoro with legacy migration)
const getConfigPath = () => {
  const primaryPath = path.join(app.getPath('userData'), 'printkoro-desktop-config.json')
  const legacyPath = path.join(app.getPath('userData'), 'quickink-desktop-config.json')
  if (!fs.existsSync(primaryPath) && fs.existsSync(legacyPath)) {
    try {
      fs.copyFileSync(legacyPath, primaryPath)
    } catch (e) {}
  }
  return primaryPath
}

// Read saved config
function loadConfig() {
  try {
    const configPath = getConfigPath()
    if (fs.existsSync(configPath)) {
      const data = fs.readFileSync(configPath, 'utf8')
      return JSON.parse(data)
    }
  } catch (err) {
    console.error('Error reading desktop config:', err)
  }
  return {
    deviceId: '11111111-1111-1111-1111-111111111111',
    apiBaseUrl: '',
    bwPrinterName: '',
    colorPrinterName: '',
    isKiosk: false,
    autoPrintCash: false
  }
}

// Save config
function saveConfig(newConfig) {
  try {
    const configPath = getConfigPath()
    const current = loadConfig()
    const merged = { ...current, ...newConfig }
    fs.writeFileSync(configPath, JSON.stringify(merged, null, 2), 'utf8')
    return { success: true, config: merged }
  } catch (err) {
    console.error('Error saving desktop config:', err)
    return { success: false, error: err.message }
  }
}

function createWindow() {
  const savedConfig = loadConfig()

  const iconPath = path.join(__dirname, 'build', 'icon.ico')
  const fallbackIco = path.join(__dirname, 'src', 'assets', 'icon.ico')
  const fallbackPng = path.join(__dirname, 'src', 'assets', 'printkoro-master.png')
  const appIcon = fs.existsSync(iconPath) ? iconPath : (fs.existsSync(fallbackIco) ? fallbackIco : (fs.existsSync(fallbackPng) ? fallbackPng : undefined))

  mainWindow = new BrowserWindow({
    width: 1240,
    height: 820,
    minWidth: 1024,
    minHeight: 680,
    title: 'PrintKoro Station',
    icon: appIcon,
    backgroundColor: '#09090b',
    autoHideMenuBar: true,
    show: true,
    webPreferences: {
      preload: path.join(__dirname, 'preload.js'),
      contextIsolation: true,
      nodeIntegration: false,
      sandbox: false
    }
  })

  mainWindow.loadFile(path.join(__dirname, 'src', 'index.html'))

  mainWindow.once('ready-to-show', () => {
    if (savedConfig.isKiosk) {
      mainWindow.setKiosk(true)
    }
    mainWindow.show()
    mainWindow.focus()
  })

  // Security: Prevent untrusted popups/windows; route external links to OS default browser
  mainWindow.webContents.setWindowOpenHandler(({ url }) => {
    if (url.startsWith('https:') || url.startsWith('http:')) {
      shell.openExternal(url).catch(() => {})
    }
    return { action: 'deny' }
  })

  // Security: Prevent in-app navigation away from local file origins
  mainWindow.webContents.on('will-navigate', (event, navigationUrl) => {
    if (!navigationUrl.startsWith('file://')) {
      event.preventDefault()
      if (navigationUrl.startsWith('https:') || navigationUrl.startsWith('http:')) {
        shell.openExternal(navigationUrl).catch(() => {})
      }
    }
  })

  mainWindow.on('closed', () => {
    mainWindow = null
  })
}

app.whenReady().then(() => {
  registerIpcHandlers()
  createWindow()
  setupAutoUpdater()

  app.on('activate', () => {
    if (BrowserWindow.getAllWindows().length === 0) createWindow()
  })
})

app.on('window-all-closed', () => {
  if (process.platform !== 'darwin') {
    app.quit()
  }
})

// Helper: Parse page range string into 0-indexed page number array
function parsePageRange(rangeStr, maxPages) {
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

function isSafeDownloadUrl(urlStr) {
  try {
    const u = new URL(urlStr)
    if (u.protocol !== 'http:' && u.protocol !== 'https:') return false
    const host = u.hostname.toLowerCase()
    // Disallow cloud metadata endpoints & private link-local IPs
    if (host === '169.254.169.254' || host === 'metadata.google.internal' || host === 'fd00::') return false
    // Disallow internal RFC1918 private subnets for remote fetch
    if (/^10\./.test(host) || /^172\.(1[6-9]|2[0-9]|3[0-1])\./.test(host) || /^192\.168\./.test(host)) {
      return false
    }
    return true
  } catch (e) {
    return false
  }
}

// Helper: Download a remote file to a local temp file
async function downloadToTemp(fileUrl, preferredExt = '.pdf') {
  try {
    const tempDir = app.getPath('temp')
    const fileName = `printkoro_${Date.now()}_${Math.random().toString(36).substring(7)}${preferredExt}`
    const tempFilePath = path.join(tempDir, fileName)

    if (!fileUrl) {
      throw new Error('Document file path or URL is missing')
    }

    let resolvedUrl = String(fileUrl).trim()
    if (resolvedUrl.includes('#')) {
      resolvedUrl = resolvedUrl.split('#')[0]
    }

    // 1. If it's already a valid local file on disk
    if (fs.existsSync(resolvedUrl)) {
      const ext = path.extname(resolvedUrl).toLowerCase()
      if (!['.pdf', '.png', '.jpg', '.jpeg'].includes(ext)) {
        throw new Error('Unsupported document format for hardware printing')
      }
      return resolvedUrl
    }

    // 2. If it's a relative path from local dev server uploads or APIs
    if (resolvedUrl.startsWith('/uploads/') || resolvedUrl.startsWith('/api/')) {
      const cfg = loadConfig()
      const base = cfg.apiBaseUrl || 'http://localhost:3000'
      resolvedUrl = `${base}${resolvedUrl}`
    }
    // 2b. If it's a local:// storage reference
    else if (resolvedUrl.startsWith('local://')) {
      const cfg = loadConfig()
      const base = cfg.apiBaseUrl || 'http://localhost:3000'
      const fileName = resolvedUrl.replace('local://', '')
      resolvedUrl = `${base}/api/download/file?name=${encodeURIComponent(fileName)}`
    }
    // 3. If it's a path starting with slash
    else if (resolvedUrl.startsWith('/')) {
      resolvedUrl = `https://xhzfrmpbhasnipirccnt.supabase.co/storage/v1/object/public/print-files${resolvedUrl}`
    }
    // 4. If it's a Supabase storage path like "jobs/..." or "1789..." (not starting with http and not local)
    else if (!resolvedUrl.startsWith('http://') && !resolvedUrl.startsWith('https://')) {
      resolvedUrl = `https://xhzfrmpbhasnipirccnt.supabase.co/storage/v1/object/public/print-files/${resolvedUrl}`
    }

    console.log(`[DownloadToTemp] Fetching document from: ${resolvedUrl}`)

    if (resolvedUrl.startsWith('http://') || resolvedUrl.startsWith('https://')) {
      if (!isSafeDownloadUrl(resolvedUrl)) {
        throw new Error('Blocked untrusted or private network URL for document download')
      }
      const response = await fetch(resolvedUrl)
      if (!response.ok) {
        throw new Error(`Failed to download document from storage (HTTP ${response.status})`)
      }
      const arrayBuffer = await response.arrayBuffer()
      fs.writeFileSync(tempFilePath, Buffer.from(arrayBuffer))
      console.log(`[DownloadToTemp] Downloaded ${arrayBuffer.byteLength} bytes to ${tempFilePath}`)
      return tempFilePath
    }

    throw new Error(`Invalid file URL or path: ${fileUrl}`)
  } catch (err) {
    console.error('Download to temp error:', err)
    throw err
  }
}

// Register IPC Handlers for Native Windows Hardware
function registerIpcHandlers() {
  // 1. Get real system printers via Electron native API + pdf-to-printer
  ipcMain.handle('printers:get-all', async () => {
    try {
      let printersList = []

      // Method A: Native Electron getPrintersAsync
      if (mainWindow) {
        try {
          const electronPrinters = await mainWindow.webContents.getPrintersAsync()
          if (Array.isArray(electronPrinters) && electronPrinters.length > 0) {
            printersList = electronPrinters.map((p) => ({
              name: p.name,
              displayName: p.displayName || p.name,
              description: p.description || '',
              status: p.status,
              isDefault: Boolean(p.isDefault),
              paperSizes: []
            }))
          }
        } catch (e) {
          console.warn('Electron getPrintersAsync failed:', e)
        }
      }

      // Method B: Enhance with pdf-to-printer metadata (paper sizes, detailed Windows spooler info)
      if (pdfToPrinter) {
        try {
          const ptpPrinters = await pdfToPrinter.getPrinters()
          if (Array.isArray(ptpPrinters) && ptpPrinters.length > 0) {
            ptpPrinters.forEach((ptp) => {
              const existing = printersList.find((p) => p.name === ptp.name || p.name === ptp.deviceId)
              if (existing) {
                existing.paperSizes = ptp.paperSizes || []
              } else {
                printersList.push({
                  name: ptp.name || ptp.deviceId,
                  displayName: ptp.name || ptp.deviceId,
                  description: '',
                  status: 0,
                  isDefault: false,
                  paperSizes: ptp.paperSizes || []
                })
              }
            })
          }
        } catch (e) {
          console.warn('pdf-to-printer getPrinters failed:', e)
        }
      }

      // Auto-mark default if none marked
      if (printersList.length > 0 && !printersList.some((p) => p.isDefault)) {
        printersList[0].isDefault = true
      }

      return { success: true, printers: printersList }
    } catch (err) {
      console.error('Failed to get system printers:', err)
      return { success: false, error: err.message }
    }
  })

// Helper: HTML-escape untrusted strings
function escapeHtml(str) {
  if (!str) return ''
  return String(str)
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#039;')
}

// Helper: Synchronize Windows Printer Driver settings (monochrome vs color & duplex)
// Returns true if the driver change was applied successfully, false otherwise.
async function setPrinterHardwareConfig(printerName, isColor, isDuplex = false) {
  if (process.platform !== 'win32' || !printerName) return false
  
  // Security: Strict validation of printerName against injection characters
  const trimmedName = String(printerName).trim()
  if (!trimmedName || !/^[\w\s\-\.\(\)\\\/]+$/u.test(trimmedName)) {
    console.warn(`[PrinterConfig] Rejected invalid printer name: ${printerName}`)
    return false
  }

  return new Promise((resolve) => {
    const duplexVal = isDuplex ? 'TwoSidedLongEdge' : 'OneSided'
    // Security: Parameterized script block prevents PowerShell string interpolation injection
    const scriptBlock = [
      'param([string]$name, [string]$clr, [string]$dup)',
      'try {',
      '  Set-PrintConfiguration -PrinterName $name -Color ($clr -eq "1") -DuplexingMode $dup -ErrorAction Stop',
      '} catch {',
      '  try {',
      '    Set-PrintConfiguration -PrinterName $name -Color ($clr -eq "1") -ErrorAction SilentlyContinue',
      '  } catch {}',
      '}'
    ].join(' ')

    child_process.execFile(
      'powershell.exe',
      [
        '-NoProfile',
        '-NonInteractive',
        '-Command',
        `& { ${scriptBlock} }`,
        '-name',
        trimmedName,
        '-clr',
        isColor ? '1' : '0',
        '-dup',
        duplexVal
      ],
      { timeout: 5000 },
      (err) => {
        if (err) {
          console.warn(`[PrinterConfig] Set-PrintConfiguration notice: ${err.message}`)
          resolve(false)
        } else {
          console.log(`[PrinterConfig] Driver config synchronized → "${trimmedName}" Color=${isColor} Duplex=${duplexVal}`)
          resolve(true)
        }
      }
    )
  })
}

const setPrinterColorMode = (name, isColor) => setPrinterHardwareConfig(name, isColor, false)

// Helper: Convert Image file (PNG, JPG, etc) to standard A4 PDF via pdf-lib and jimp
async function convertImageToA4Pdf(imagePath, isColor = true) {
  if (!PDFLib) throw new Error('pdf-lib engine not available')
  const { PDFDocument } = PDFLib
  const tempDir = app.getPath('temp')
  const outPdfPath = path.join(tempDir, `converted_${Date.now()}_${Math.random().toString(36).substring(7)}.pdf`)

  const pdfDoc = await PDFDocument.create()
  // Standard A4 dimensions in points (72 DPI): 595.28 x 841.89
  const page = pdfDoc.addPage([595.28, 841.89])
  
  let imageBytes = fs.readFileSync(imagePath)
  let isPng = path.extname(imagePath).toLowerCase() === '.png'

  // If customer selected B&W, convert image pixels to true grayscale so no color ink is used
  if (!isColor && Jimp) {
    try {
      const jimpImage = await Jimp.read(imagePath)
      if (typeof jimpImage.greyscale === 'function') {
        jimpImage.greyscale()
      } else if (typeof jimpImage.grayscale === 'function') {
        jimpImage.grayscale()
      }
      if (typeof jimpImage.getBuffer === 'function') {
        imageBytes = await jimpImage.getBuffer('image/jpeg')
        isPng = false
      } else if (typeof jimpImage.getBufferAsync === 'function') {
        imageBytes = await jimpImage.getBufferAsync('image/jpeg')
        isPng = false
      }
    } catch (jimpErr) {
      console.warn('[convertImageToA4Pdf] Jimp grayscale notice:', jimpErr.message)
    }
  }

  const image = isPng ? await pdfDoc.embedPng(imageBytes) : await pdfDoc.embedJpg(imageBytes)

  // Margins: 20 points on all sides, available width 555.28, height 801.89
  const { width, height } = image.scaleToFit(555.28, 801.89)
  page.drawImage(image, {
    x: (595.28 - width) / 2,
    y: (841.89 - height) / 2,
    width,
    height
  })

  const pdfBytes = await pdfDoc.save()
  fs.writeFileSync(outPdfPath, pdfBytes)
  return outPdfPath
}

// Helper: Generate a crisp hardware Test Page PDF using pdf-lib
async function generateTestPdf(printerName, isColor) {
  if (!PDFLib) throw new Error('pdf-lib engine not available')
  const { PDFDocument, StandardFonts, rgb } = PDFLib
  const tempDir = app.getPath('temp')
  const testPdfPath = path.join(tempDir, `test_page_${Date.now()}.pdf`)

  const pdfDoc = await PDFDocument.create()
  const page = pdfDoc.addPage([595.28, 841.89])
  const boldFont = await pdfDoc.embedFont(StandardFonts.HelveticaBold)
  const regFont = await pdfDoc.embedFont(StandardFonts.Helvetica)

  page.drawText('PrintKoro Print Station', {
    x: 50,
    y: 780,
    size: 22,
    font: boldFont,
    color: rgb(0, 0.75, 0.39)
  })

  page.drawText(isColor ? 'COLOR HARDWARE TEST PAGE' : 'BLACK & WHITE TEST PAGE', {
    x: 50,
    y: 755,
    size: 12,
    font: boldFont,
    color: isColor ? rgb(0, 0.75, 0.39) : rgb(0.12, 0.16, 0.23)
  })

  page.drawLine({
    start: { x: 50, y: 742 },
    end: { x: 545, y: 742 },
    thickness: 1.5,
    color: rgb(0, 0.75, 0.39)
  })

  page.drawText('Hardware Spooler & Alignment Verification', {
    x: 50,
    y: 715,
    size: 14,
    font: boldFont,
    color: rgb(0.07, 0.09, 0.15)
  })

  page.drawText('If this page printed, your hardware printer is communicating correctly with PrintKoro.', {
    x: 50,
    y: 695,
    size: 10,
    font: regFont,
    color: rgb(0.39, 0.45, 0.55)
  })

  const infoY = 650
  page.drawText(`Target Printer: ${printerName}`, { x: 50, y: infoY, size: 11, font: boldFont, color: rgb(0.2, 0.25, 0.33) })
  page.drawText(`Mode: ${isColor ? 'Full Color (Inkjet/Laser)' : 'Black & White (Monochrome)'}`, { x: 50, y: infoY - 20, size: 11, font: regFont, color: rgb(0.2, 0.25, 0.33) })
  page.drawText('Engine: Windows Spooler Native GDI / DEVMODE', { x: 50, y: infoY - 40, size: 11, font: regFont, color: rgb(0.2, 0.25, 0.33) })
  page.drawText(`Timestamp: ${new Date().toLocaleString()}`, { x: 50, y: infoY - 60, size: 11, font: regFont, color: rgb(0.2, 0.25, 0.33) })

  if (isColor) {
    const boxY = 540
    const colors = [
      rgb(0, 0.75, 0.39),
      rgb(0.94, 0.27, 0.27),
      rgb(0.23, 0.51, 0.96),
      rgb(0.92, 0.7, 0.03),
      rgb(0.06, 0.09, 0.16)
    ]
    colors.forEach((c, idx) => {
      page.drawRectangle({
        x: 50 + idx * 45,
        y: boxY,
        width: 38,
        height: 22,
        color: c
      })
    })
  }

  page.drawText('PrintKoro Smart Cloud Print POS — Direct Windows Spooler Engine', {
    x: 50,
    y: 50,
    size: 9,
    font: regFont,
    color: rgb(0.58, 0.64, 0.72)
  })

  const pdfBytes = await pdfDoc.save()
  fs.writeFileSync(testPdfPath, pdfBytes)
  return testPdfPath
}

// Helper: Normalize any PDF to standard A4 (scaling oversized scans/documents down proportionally
// with safe printable margins), tile pages for Mini Print (2-in-1, 4-in-1, 6-in-1), and compile
// requested page range into a single hardware-ready PDF.
async function prepareDocumentForPrinting(srcPdfPath, effectivePageRange, nup = 1, hasBorder = false) {
  if (!PDFLib || !srcPdfPath) return { finalPdfPath: srcPdfPath, wasModified: false }

  try {
    const parsedNup = [1, 2, 4, 6].includes(parseInt(nup, 10)) ? parseInt(nup, 10) : 1
    const drawBorder = Boolean(hasBorder)

    const srcBytes = fs.readFileSync(srcPdfPath)
    let srcDoc = null
    try {
      srcDoc = await PDFLib.PDFDocument.load(srcBytes, {
        ignoreEncryption: true,
        parseSpeed: PDFLib.ParseSpeeds ? PDFLib.ParseSpeeds.Fast : 1500
      })
    } catch (fastErr) {
      console.warn('[PDFCompiler] Fast load failed, falling back to standard load:', fastErr.message)
      srcDoc = await PDFLib.PDFDocument.load(srcBytes, { ignoreEncryption: true })
    }

    const totalPdfPages = srcDoc.getPageCount()
    let targetIndices = []

    if (effectivePageRange && String(effectivePageRange).trim()) {
      const parsedFull = parsePageRange(effectivePageRange, 999999)
      const maxPageRequested = parsedFull.length > 0 ? Math.max(...parsedFull.map((idx) => idx + 1)) : 0

      // If document was already pre-sliced (e.g. client-side before upload):
      // totalPdfPages matches the requested range page count, or is less than maxPageRequested
      if (
        parsedFull.length > 0 &&
        (totalPdfPages === parsedFull.length || (maxPageRequested > totalPdfPages && parsedFull.length <= totalPdfPages))
      ) {
        console.log(`[PDFCompiler] Document was pre-sliced (${totalPdfPages} page(s) matching range ${effectivePageRange}). Printing all pages in document.`)
        targetIndices = Array.from({ length: totalPdfPages }, (_, i) => i)
      } else {
        targetIndices = parsePageRange(effectivePageRange, totalPdfPages)
      }
    }
    if (!targetIndices || targetIndices.length === 0) {
      targetIndices = Array.from({ length: totalPdfPages }, (_, i) => i)
    }

    console.log(`[PDFCompiler] Total document pages: ${totalPdfPages}. Target print indices: [${targetIndices.join(',')}] | Mini Print N-up: ${parsedNup} | Border: ${drawBorder}`)

    const isSubset = targetIndices.length < totalPdfPages
    const a4W = 595.28
    const a4H = 841.89
    const margin = 18 // 18pt (~6.35mm) hardware printable safe margin

    // Check if any page to print exceeds standard A4 dimensions or has non-standard aspect ratio
    let needsNormalization = isSubset || parsedNup > 1
    if (!needsNormalization) {
      for (const idx of targetIndices) {
        const p = srcDoc.getPage(idx)
        const pw = p.getWidth()
        const ph = p.getHeight()
        const isLandscape = pw > ph
        const maxW = isLandscape ? a4H : a4W
        const maxH = isLandscape ? a4W : a4H
        if (pw > maxW + 5 || ph > maxH + 5 || Math.abs(pw - maxW) > 20 || Math.abs(ph - maxH) > 20) {
          needsNormalization = true
          break
        }
      }
    }

    if (!needsNormalization) {
      console.log(`[PDFCompiler] PDF is already standard A4, 1-in-1, and covers all pages. Using directly.`)
      return { finalPdfPath: srcPdfPath, wasModified: false }
    }

    // Compile into standard A4 document
    const outDoc = await PDFLib.PDFDocument.create()

    // Primary Engine: embedPages (XObject vector encapsulation — avoids font/object AST corruption)
    try {
      const srcPagesToEmbed = targetIndices.map((idx) => srcDoc.getPage(idx))
      const embeddedPages = await outDoc.embedPages(srcPagesToEmbed)

      if (parsedNup > 1) {
        // Mini Print N-up Layout:
        // For 2-in-1: 1 col x 2 rows (Top & Bottom halves), rotated 90° so portrait pages fill each half without cutoff
        // For 4-in-1: 2 cols x 2 rows (2x2 grid)
        // For 6-in-1: 2 cols x 3 rows (2x3 grid)
        const cols = parsedNup === 2 ? 1 : 2
        const rows = parsedNup === 2 ? 2 : parsedNup === 4 ? 2 : 3
        const gap = parsedNup === 6 ? 6 : 8

        const availW = a4W - margin * 2
        const availH = a4H - margin * 2
        const cellW = (availW - (cols - 1) * gap) / cols
        const cellH = (availH - (rows - 1) * gap) / rows

        // If a single page is targeted in Mini Print (e.g. 1-page document with 2-in-1),
        // tile that single page across all slots of the sheet (e.g. 2 copies per sheet, matching Image 1)
        const pagesToTile = (embeddedPages.length === 1)
          ? Array(parsedNup).fill(embeddedPages[0])
          : embeddedPages

        const totalSheets = Math.ceil(pagesToTile.length / parsedNup)
        for (let sh = 0; sh < totalSheets; sh++) {
          const page = outDoc.addPage([a4W, a4H])
          const sheetPages = pagesToTile.slice(sh * parsedNup, sh * parsedNup + parsedNup)

          sheetPages.forEach((ep, slotIdx) => {
            const col = slotIdx % cols
            const row = Math.floor(slotIdx / cols)
            const cellX = margin + col * (cellW + gap)
            const cellY = a4H - margin - (row + 1) * cellH - row * gap

            const padding = 4
            const innerW = cellW - padding * 2
            const innerH = cellH - padding * 2

            // If 2-in-1 and page is portrait, rotate 90° to fill the horizontal half-sheet cell perfectly
            if (parsedNup === 2 && ep.height >= ep.width) {
              const scale = Math.min(innerW / ep.height, innerH / ep.width)
              const finalW = ep.width * scale
              const finalH = ep.height * scale
              const centerX = cellX + cellW / 2
              const centerY = cellY + cellH / 2

              const x = centerX - finalH / 2
              const y = centerY + finalW / 2

              page.drawPage(ep, {
                x,
                y,
                width: finalW,
                height: finalH,
                rotate: PDFLib.degrees(270)
              })
            } else {
              const scale = Math.min(innerW / ep.width, innerH / ep.height)
              const w = ep.width * scale
              const h = ep.height * scale
              const drawX = cellX + (cellW - w) / 2
              const drawY = cellY + (cellH - h) / 2

              page.drawPage(ep, { x: drawX, y: drawY, width: w, height: h })
            }
          })

          // Draw optional thin dividing cutting borders
          if (drawBorder) {
            const lineColor = PDFLib.rgb(0.75, 0.75, 0.75)
            // Vertical dividing lines
            for (let c = 1; c < cols; c++) {
              const lineX = margin + c * cellW + (c - 0.5) * gap
              page.drawLine({
                start: { x: lineX, y: margin },
                end: { x: lineX, y: a4H - margin },
                thickness: 0.75,
                color: lineColor
              })
            }
            // Horizontal dividing lines
            for (let r = 1; r < rows; r++) {
              const lineY = a4H - margin - r * cellH - (r - 0.5) * gap
              page.drawLine({
                start: { x: margin, y: lineY },
                end: { x: a4W - margin, y: lineY },
                thickness: 0.75,
                color: lineColor
              })
            }
          }
        }
      } else {
        // Standard 1-in-1 A4 Canvas Layout
        embeddedPages.forEach((ep) => {
          const isLandscape = ep.width > ep.height
          const canvasW = isLandscape ? a4H : a4W
          const canvasH = isLandscape ? a4W : a4H
          const availW = canvasW - (margin * 2)
          const availH = canvasH - (margin * 2)

          const isExactA4 = Math.abs(ep.width - canvasW) <= 5 && Math.abs(ep.height - canvasH) <= 5

          let finalW, finalH, x, y
          if (isExactA4) {
            finalW = canvasW
            finalH = canvasH
            x = 0
            y = 0
          } else {
            const scale = Math.min(availW / ep.width, availH / ep.height, 1.0)
            finalW = ep.width * scale
            finalH = ep.height * scale
            x = (canvasW - finalW) / 2
            y = (canvasH - finalH) / 2
          }

          const page = outDoc.addPage([canvasW, canvasH])
          page.drawPage(ep, { x, y, width: finalW, height: finalH })
        })
      }

      const compiledBytes = await outDoc.save()
      const compiledPdfPath = path.join(
        app.getPath('temp'),
        `printkoro_compiled_${Date.now()}_${Math.random().toString(36).substring(7)}.pdf`
      )
      fs.writeFileSync(compiledPdfPath, compiledBytes)
      console.log(`[PDFCompiler] Standard A4 PDF compiled successfully: ${compiledPdfPath} (${outDoc.getPageCount()} sheet(s), ${compiledBytes.length} bytes, nup: ${parsedNup})`)
      return { finalPdfPath: compiledPdfPath, wasModified: true }
    } catch (embedErr) {
      console.warn('[PDFCompiler] embedPages method notice, attempting copyPages fallback:', embedErr.message)

      // Fallback Engine: copyPages
      const copyDoc = await PDFLib.PDFDocument.create()
      const copiedPages = await copyDoc.copyPages(srcDoc, targetIndices)
      copiedPages.forEach((p) => copyDoc.addPage(p))
      const copiedBytes = await copyDoc.save()
      const copiedPdfPath = path.join(
        app.getPath('temp'),
        `printkoro_copied_${Date.now()}_${Math.random().toString(36).substring(7)}.pdf`
      )
      fs.writeFileSync(copiedPdfPath, copiedBytes)
      console.log(`[PDFCompiler] copyPages fallback succeeded: ${copiedPdfPath}`)
      return { finalPdfPath: copiedPdfPath, wasModified: true }
    }
  } catch (err) {
    console.error('[PDFCompiler] PDF compilation error, will use original PDF directly:', err.message)
    return { finalPdfPath: srcPdfPath, wasModified: false, error: err.message }
  }
}

  // 2. Test Print to Physical Printer
  ipcMain.handle('printers:print-test', async (event, { printerName, mode = 'bw' }) => {
    try {
      if (!printerName) {
        return { success: false, error: 'Please select a valid printer' }
      }

      const isColor = mode === 'color'

      // Synchronize Windows printer driver color setting
      await setPrinterColorMode(printerName, isColor)

      // Method A: Direct Windows Spooler via SumatraPDF (Bypasses Chromium driver bugs)
      if (pdfToPrinter && PDFLib) {
        try {
          const testPdfPath = await generateTestPdf(printerName, isColor)
          console.log(`[TestPrint] Spooling native PDF to ${printerName} | color=${isColor} | monochrome=${!isColor}`)
          await pdfToPrinter.print(testPdfPath, {
            printer: printerName,
            paperSize: 'A4',
            // Explicitly set monochrome: false for color prints so SumatraPDF
            // adds 'color' to -print-settings and overrides any leftover driver setting
            monochrome: isColor ? false : true
          })

          setTimeout(() => {
            try { if (fs.existsSync(testPdfPath)) fs.unlinkSync(testPdfPath) } catch (e) {}
          }, 15000)

          return { success: true, message: `Test page successfully sent to ${printerName}!` }
        } catch (ptpError) {
          console.warn('[TestPrint] Native pdf-to-printer error, trying fallback:', ptpError)
        }
      }

      // Method B: Fallback via offscreen BrowserWindow with proper dimensions & timeout
      const printWindow = new BrowserWindow({
        show: false,
        webPreferences: {
          contextIsolation: true,
          nodeIntegration: false
        }
      })

      const testHtml = `
        <!DOCTYPE html>
        <html>
        <head>
          <meta charset="utf-8">
          <style>
            @page { size: A4; margin: 15mm; }
            body { font-family: -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, sans-serif; color: #111; margin: 0; padding: 20px; }
            .header { border-bottom: 3px solid #00bf63; padding-bottom: 12px; margin-bottom: 20px; display: flex; justify-content: space-between; align-items: center; }
            .logo { font-size: 24px; font-weight: 800; color: #00bf63; }
            .badge { display: inline-block; padding: 6px 12px; background: ${isColor ? '#00bf63' : '#1e293b'}; color: #fff; border-radius: 6px; font-weight: bold; font-size: 14px; }
            .meta-table { width: 100%; border-collapse: collapse; margin-top: 20px; }
            .meta-table td { padding: 10px 0; border-bottom: 1px solid #e2e8f0; font-size: 14px; }
            .meta-table td strong { color: #334155; }
            .footer { margin-top: 40px; padding-top: 15px; border-top: 1px solid #cbd5e1; font-size: 11px; color: #64748b; text-align: center; }
          </style>
        </head>
        <body>
          <div class="header">
            <div class="logo">PrintKoro Print Station</div>
            <div class="badge">TEST RECEIPT</div>
          </div>
          <p style="font-size: 13px; color: #64748b;">If you can read this document, your physical printer is communicating with PrintKoro.</p>
          <div class="kv-row"><span>TERMINAL:</span> <b>${escapeHtml(printerName)}</b></div>
          <div class="kv-row"><span>MODE:</span> <b>${mode === 'color' ? 'Color Driver' : 'Monochrome (B&W)'}</b></div>
          <div class="kv-row"><span>TIMESTAMP:</span> <b>${escapeHtml(new Date().toLocaleString())}</b></div>
          <div class="divider"></div>
          <div class="footer">PrintKoro Smart Cloud Print POS</div>
        </body>
        </html>
      `

      await printWindow.loadURL(`data:text/html;charset=utf-8,${encodeURIComponent(testHtml)}`)
      await new Promise((r) => setTimeout(r, 400))

      return new Promise((resolve) => {
        let finished = false
        const timer = setTimeout(() => {
          if (!finished) {
            finished = true
            try { printWindow.close() } catch (e) {}
            resolve({ success: false, error: 'Printer driver timed out. Please check printer power/connection.' })
          }
        }, 10000)

        printWindow.webContents.print(
          {
            silent: true,
            deviceName: printerName,
            color: isColor,
            copies: 1,
            pageSize: 'A4',
            printBackground: true,
            margins: { marginType: 'printableArea' }
          },
          (success, failureReason) => {
            if (finished) return
            finished = true
            clearTimeout(timer)
            try { printWindow.close() } catch (e) {}
            if (success) {
              resolve({ success: true, message: `Test page successfully sent to ${printerName}!` })
            } else {
              resolve({ success: false, error: failureReason || 'Printer rejected test print job' })
            }
          }
        )
      })
    } catch (err) {
      console.error('Test print error:', err)
      return { success: false, error: err.message }
    }
  })

  // 3. Print Actual Customer Document to Hardware Printer
  ipcMain.handle('printers:print-job', async (event, { printerName, fileUrl, copies = 1, color = false, duplex = false, pageRange = null, pagesPerSheet = 1, miniBorder = false }) => {
    try {
      if (!printerName) {
        return { success: false, error: 'No printer specified for this job' }
      }

      let effectivePageRange = pageRange
      let effectiveNup = parseInt(pagesPerSheet, 10) || 1
      let effectiveBorder = Boolean(miniBorder)

      // Parse hash parameters from fileUrl if present (#range=1-2&nup=2&border=1)
      if (fileUrl && fileUrl.includes('#')) {
        try {
          const hashStr = fileUrl.split('#')[1] || ''
          const parts = hashStr.split('&')
          for (const part of parts) {
            const [k, v] = part.split('=')
            if (k === 'range' && !effectivePageRange && v) {
              effectivePageRange = decodeURIComponent(v)
            } else if (k === 'nup' && v) {
              const parsed = parseInt(v, 10)
              if ([1, 2, 4, 6].includes(parsed)) effectiveNup = parsed
            } else if (k === 'border') {
              effectiveBorder = v === '1' || v === 'true'
            }
          }
        } catch (e) {}
      }

      if (effectivePageRange) effectivePageRange = String(effectivePageRange).trim()

      const isColor = Boolean(color)
      const isDuplex = Boolean(duplex === true || duplex === 'duplex' || duplex === 'duplexlong' || duplex === 'true')
      console.log(`[PrintJob] Preparing print to ${printerName} | Copies: ${copies} | Color: ${isColor} | Duplex: ${isDuplex} | PageRange: ${effectivePageRange || 'all'} | MiniPrint N-up: ${effectiveNup} | Border: ${effectiveBorder}`)

      // 1. Enforce Color and Duplex mode at the Windows driver level
      await setPrinterHardwareConfig(printerName, isColor, isDuplex)

      let tempFilePath = null
      let convertedPdfPath = null
      let compiledPdfPath = null

      if (fileUrl) {
        try {
          const isPdf = fileUrl.toLowerCase().includes('.pdf')
          const isPng = fileUrl.toLowerCase().includes('.png')
          const isJpg = fileUrl.toLowerCase().includes('.jpg') || fileUrl.toLowerCase().includes('.jpeg')
          const ext = isPdf ? '.pdf' : isPng ? '.png' : isJpg ? '.jpg' : '.pdf'

          tempFilePath = await downloadToTemp(fileUrl, ext)
          console.log(`[PrintJob] Document cached locally at: ${tempFilePath}`)

          let targetPdfPath = null

          if (tempFilePath.toLowerCase().endsWith('.pdf')) {
            targetPdfPath = tempFilePath
          } else if (PDFLib) {
            // Convert images (PNG, JPG) to standard A4 PDF (and apply grayscale if B&W selected)
            console.log(`[PrintJob] Converting image to standard A4 PDF (isColor: ${isColor})...`)
            convertedPdfPath = await convertImageToA4Pdf(tempFilePath, isColor)
            targetPdfPath = convertedPdfPath
            console.log(`[PrintJob] A4 PDF ready at: ${convertedPdfPath}`)
          }

          // Exact Hardware Normalization, N-up Tiling & Page-Range Slicing:
          // Scales oversized/scanned pages down to standard A4 so text is never cut off,
          // arranges multiple pages per sheet for Mini Print (2, 4, 6 in 1),
          // and extracts exact page range (e.g. 1-2) so printer prints only requested pages.
          let compilationSucceeded = false
          if (PDFLib && targetPdfPath) {
            const prepResult = await prepareDocumentForPrinting(targetPdfPath, effectivePageRange, effectiveNup, effectiveBorder)
            if (prepResult.wasModified) {
              compiledPdfPath = prepResult.finalPdfPath
              targetPdfPath = compiledPdfPath
              compilationSucceeded = true
              console.log(`[PrintJob] Dispatched file normalized to standard A4 at: ${compiledPdfPath} (nup: ${effectiveNup})`)
            } else if (!prepResult.error) {
              // File is already standard A4 and covers all pages
              compilationSucceeded = true
            }
          }

          // Primary: Send to Windows Spooler via SumatraPDF with explicit monochrome/color flag
          if (pdfToPrinter && targetPdfPath) {
            try {
              // Map duplex value to SumatraPDF's accepted 'side' option values
              const sideValue = isDuplex ? 'duplexlong' : 'simplex'
              console.log(`[PrintJob] Using pdf-to-printer → ${printerName} | monochrome: ${!isColor} | side: ${sideValue} | scale: shrink`)

              // Build options object. scale: 'shrink' preserves 1:1 scale on standard A4
              const ptpOptions = {
                printer: printerName,
                copies: parseInt(copies, 10) || 1,
                paperSize: 'A4',
                side: sideValue,
                scale: compilationSucceeded ? 'shrink' : 'fit',
                monochrome: !isColor    // true → SumatraPDF -print-settings includes 'monochrome'
              }

              // If explicitly printing in color, set monochrome to false so SumatraPDF
              // adds 'color' to print-settings (prevents any leftover monochrome setting)
              if (isColor) ptpOptions.monochrome = false

              // If compilation was not performed, supply pages option as extra fallback
              if (effectivePageRange && !compiledPdfPath) {
                ptpOptions.pages = effectivePageRange
                console.log(`[PrintJob] Applying fallback page range filter: ${ptpOptions.pages}`)
              }

              await pdfToPrinter.print(targetPdfPath, ptpOptions)

              // Schedule cleanup
              setTimeout(() => {
                try { if (tempFilePath && fs.existsSync(tempFilePath)) fs.unlinkSync(tempFilePath) } catch (e) {}
                try { if (convertedPdfPath && fs.existsSync(convertedPdfPath)) fs.unlinkSync(convertedPdfPath) } catch (e) {}
                try { if (compiledPdfPath && fs.existsSync(compiledPdfPath)) fs.unlinkSync(compiledPdfPath) } catch (e) {}
              }, 20000)

              return { success: true, message: `Document successfully dispatched to ${printerName}` }
            } catch (ptpError) {
              console.warn('[PrintJob] pdf-to-printer error, falling back to renderer print:', ptpError)
            }
          }

          // Fallback: Offscreen Electron window with proper pageSize and timeout
          const printWindow = new BrowserWindow({
            show: false,
            webPreferences: {
              contextIsolation: true,
              nodeIntegration: false,
              webSecurity: false
            }
          })

          const filePathToLoad = targetPdfPath || tempFilePath
          await printWindow.loadFile(filePathToLoad).catch(async () => {
            await printWindow.loadURL(`file://${filePathToLoad}`)
          })
          await new Promise((r) => setTimeout(r, 600))

          return new Promise((resolve) => {
            let finished = false
            const timer = setTimeout(() => {
              if (!finished) {
                finished = true
                try { printWindow.close() } catch (e) {}
                resolve({ success: false, error: 'Printer driver timed out. Check printer status.' })
              }
            }, 10000)

            printWindow.webContents.print(
              {
                silent: true,
                deviceName: printerName,
                copies: parseInt(copies, 10) || 1,
                color: Boolean(color),
                pageSize: 'A4',
                printBackground: true,
                margins: { marginType: 'printableArea' },
                duplexMode: isDuplex ? 'longEdge' : 'simplex'
              },
              (success, failureReason) => {
                if (finished) return
                finished = true
                clearTimeout(timer)
                try { printWindow.close() } catch (e) {}
                setTimeout(() => {
                  try { if (tempFilePath && fs.existsSync(tempFilePath)) fs.unlinkSync(tempFilePath) } catch (e) {}
                  try { if (convertedPdfPath && fs.existsSync(convertedPdfPath)) fs.unlinkSync(convertedPdfPath) } catch (e) {}
                  try { if (compiledPdfPath && fs.existsSync(compiledPdfPath)) fs.unlinkSync(compiledPdfPath) } catch (e) {}
                }, 10000)

                if (success) {
                  resolve({ success: true, message: `Print job dispatched to ${printerName}` })
                } else {
                  resolve({ success: false, error: failureReason || 'Windows spooler rejected print job' })
                }
              }
            )
          })
        } catch (downloadErr) {
          console.warn('[PrintJob] File process failed:', downloadErr)
          if (tempFilePath) {
            try { if (fs.existsSync(tempFilePath)) fs.unlinkSync(tempFilePath) } catch (e) {}
          }
          if (convertedPdfPath) {
            try { if (fs.existsSync(convertedPdfPath)) fs.unlinkSync(convertedPdfPath) } catch (e) {}
          }
          if (compiledPdfPath) {
            try { if (fs.existsSync(compiledPdfPath)) fs.unlinkSync(compiledPdfPath) } catch (e) {}
          }
          return { success: false, error: `Document preparation failed: ${downloadErr.message}` }
        }
      }

      // Case C: Fallback to printing main window with timeout
      return new Promise((resolve) => {
        let finished = false
        const timer = setTimeout(() => {
          if (!finished) {
            finished = true
            resolve({ success: false, error: 'Printer spooler response timed out' })
          }
        }, 10000)

        mainWindow.webContents.print(
          {
            silent: true,
            deviceName: printerName,
            copies: parseInt(copies, 10) || 1,
            color: Boolean(color),
            pageSize: 'A4',
            printBackground: true,
            margins: { marginType: 'printableArea' },
            duplexMode: duplex ? 'longEdge' : 'simplex'
          },
          (success, failureReason) => {
            if (finished) return
            finished = true
            clearTimeout(timer)
            if (success) {
              resolve({ success: true, message: `Print command sent to ${printerName}` })
            } else {
              resolve({ success: false, error: failureReason || 'Hardware spooler rejected job' })
            }
          }
        )
      })
    } catch (err) {
      console.error('Native print error:', err)
      return { success: false, error: err.message }
    }
  })

  // 4. Config management
  ipcMain.handle('config:get', async () => {
    return loadConfig()
  })

  ipcMain.handle('config:save', async (event, newConfig) => {
    return saveConfig(newConfig)
  })

  // 5. Window controls
  ipcMain.handle('window:minimize', () => {
    if (mainWindow) mainWindow.minimize()
  })

  ipcMain.handle('window:maximize', () => {
    if (mainWindow) {
      if (mainWindow.isMaximized()) mainWindow.unmaximize()
      else mainWindow.maximize()
    }
  })

  ipcMain.handle('window:close', () => {
    if (mainWindow) mainWindow.close()
  })

  ipcMain.handle('window:toggle-kiosk', () => {
    if (mainWindow) {
      const isKiosk = !mainWindow.isKiosk()
      mainWindow.setKiosk(isKiosk)
      saveConfig({ isKiosk })
      return isKiosk
    }
    return false
  })

  // 6. Application Version & Auto-Updater Controls
  ipcMain.handle('app:get-version', () => {
    return app.getVersion()
  })

  ipcMain.handle('updater:check', async () => {
    if (!autoUpdater) return { success: false, error: 'Auto-updater not available in this environment' }
    try {
      const result = await autoUpdater.checkForUpdates()
      const newVersion = result?.updateInfo?.version
      const currentVersion = app.getVersion()
      if (!newVersion || newVersion === currentVersion) {
        return { success: true, isLatest: true, version: currentVersion }
      }
      return { success: true, isLatest: false, version: newVersion }
    } catch (err) {
      console.warn('[AutoUpdater] Manual check error:', err?.message || err)
      const msg = err?.message || ''
      if (msg.includes('404') || msg.includes('latest.yml')) {
        return { success: true, isLatest: true, version: app.getVersion() }
      }
      return { success: false, error: 'Unable to reach update server. Please check your internet connection.' }
    }
  })

  ipcMain.handle('updater:restart', () => {
    if (autoUpdater) {
      autoUpdater.quitAndInstall(false, true)
    }
  })

  // 7. PayStation Gateway IPC Handlers (Hosted Checkout directly from Desktop)
  let activePaymentPoll = null
  let localCallbackServer = null
  const localCallbackPort = 49152

  function startLocalPaymentCallbackServer() {
    if (localCallbackServer) return
    try {
      localCallbackServer = http.createServer(async (req, res) => {
        try {
          const reqUrl = new URL(req.url, `http://127.0.0.1:${localCallbackPort}`)
          if (reqUrl.pathname === '/payment-callback') {
            const invoiceNumber = reqUrl.searchParams.get('invoice_number') || reqUrl.searchParams.get('invoice')
            const trxId = reqUrl.searchParams.get('trx_id') || reqUrl.searchParams.get('transaction_id')
            const status = (reqUrl.searchParams.get('status') || '').toLowerCase()

            let isPaid = status === 'successful' || status === 'success' || status === 'completed'
            let finalTrx = trxId || 'VERIFIED'
            let finalMethod = 'PayStation'

            if (invoiceNumber) {
              try {
                const check = await checkPayStationStatus(invoiceNumber)
                if (check.success) {
                  isPaid = true
                  finalTrx = check.trx_id || finalTrx
                  finalMethod = check.payment_method || finalMethod
                }
              } catch (e) {
                console.warn('[PayStation Callback Server] Status check error:', e)
              }
            }

            if (isPaid && invoiceNumber) {
              mainWindow?.webContents?.send('paystation:payment-completed', {
                invoiceNumber,
                trx_id: finalTrx,
                payment_method: finalMethod
              })
            }

            res.writeHead(200, { 'Content-Type': 'text/html; charset=utf-8' })
            res.end(`
              <!DOCTYPE html>
              <html lang="bn">
              <head>
                <meta charset="UTF-8">
                <meta name="viewport" content="width=device-width, initial-scale=1">
                <title>পেমেন্ট সফল — PrintKoro Station</title>
                <style>
                  * { box-sizing: border-box; margin: 0; padding: 0; }
                  body {
                    font-family: -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, sans-serif;
                    background: #09090b;
                    color: #ffffff;
                    display: flex;
                    align-items: center;
                    justify-content: center;
                    min-height: 100vh;
                    padding: 20px;
                  }
                  .card {
                    background: #121215;
                    border: 1px solid #27272a;
                    border-radius: 20px;
                    max-width: 440px;
                    width: 100%;
                    padding: 36px 28px;
                    text-align: center;
                    box-shadow: 0 20px 40px rgba(0,0,0,0.6);
                  }
                  .icon {
                    width: 68px;
                    height: 68px;
                    border-radius: 50%;
                    background: rgba(16, 185, 129, 0.15);
                    color: #10b981;
                    display: flex;
                    align-items: center;
                    justify-content: center;
                    font-size: 34px;
                    margin: 0 auto 18px;
                    border: 2px solid rgba(16, 185, 129, 0.35);
                  }
                  h1 { font-size: 22px; font-weight: 700; margin-bottom: 8px; color: #10b981; }
                  p.sub { font-size: 14px; color: #a1a1aa; margin-bottom: 22px; line-height: 1.5; }
                  .details {
                    background: #18181b;
                    border: 1px solid #27272a;
                    border-radius: 12px;
                    padding: 16px;
                    margin-bottom: 22px;
                    text-align: left;
                    font-size: 13px;
                  }
                  .row { display: flex; justify-content: space-between; margin-bottom: 8px; }
                  .row:last-child { margin-bottom: 0; }
                  .row .label { color: #71717a; }
                  .row .val { font-weight: 600; color: #f4f4f5; font-family: monospace; }
                  .btn {
                    display: inline-block;
                    width: 100%;
                    background: #10b981;
                    color: #000;
                    font-weight: 700;
                    font-size: 14.5px;
                    padding: 12px;
                    border-radius: 8px;
                    border: none;
                    cursor: pointer;
                  }
                </style>
              </head>
              <body>
                <div class="card">
                  <div class="icon">✓</div>
                  <h1>পেমেন্ট সফল হয়েছে!</h1>
                  <p class="sub">টার্মিনাল স্টেশনে ক্রেডিট স্বয়ংক্রিয়ভাবে যুক্ত হয়েছে। এই উইন্ডোটি এখন বন্ধ করতে পারেন।</p>
                  <div class="details">
                    <div class="row"><span class="label">ইনভয়েস:</span><span class="val">\${invoiceNumber || '—'}</span></div>
                    <div class="row"><span class="label">TrxID:</span><span class="val">\${finalTrx}</span></div>
                    <div class="row"><span class="label">মেথড:</span><span class="val">\${finalMethod}</span></div>
                    <div class="row"><span class="label">স্ট্যাটাস:</span><span class="val" style="color:#10b981;">SUCCESS</span></div>
                  </div>
                  <button class="btn" onclick="window.close()">উইন্ডো বন্ধ করুন</button>
                </div>
                <script>
                  setTimeout(() => { try { window.close(); } catch(e){} }, 4000);
                </script>
              </body>
              </html>
            `)
            return
          }
        } catch (e) {
          console.warn('[PayStation Callback Server] Request error:', e)
        }
        res.writeHead(404, { 'Content-Type': 'text/plain' })
        res.end('Not Found')
      })

      localCallbackServer.listen(localCallbackPort, '127.0.0.1', () => {
        console.log(`[PayStation] Local callback server running on http://127.0.0.1:\${localCallbackPort}`)
      })
      localCallbackServer.on('error', (err) => {
        console.warn('[PayStation] Callback server error:', err.message)
      })
    } catch (e) {
      console.warn('[PayStation] Failed to init callback server:', e)
    }
  }

  startLocalPaymentCallbackServer()

  async function checkPayStationStatus(invoiceNumber) {
    const storeId = process.env.PAYSTATION_STORE_ID || '6817-1790658194'
    const baseUrl = process.env.PAYSTATION_BASE_URL || 'https://api.paystation.com.bd'

    if (!storeId || !invoiceNumber) {
      return { success: false, error: 'Missing storeId or invoiceNumber' }
    }

    try {
      const statusRes = await fetch(`${baseUrl}/transaction-status`, {
        method: 'POST',
        headers: {
          'merchantId': storeId,
          'Content-Type': 'application/json'
        },
        body: JSON.stringify({
          invoice_number: invoiceNumber
        })
      })

      const statusData = await statusRes.json().catch(() => null)
      const dataObj = statusData?.data || statusData
      const statusText = (dataObj?.trx_status || statusData?.trx_status || '').toLowerCase()
      const isSuccess = statusText === 'success' || statusText === 'successful' || statusText === 'completed'

      return {
        success: isSuccess,
        trx_status: dataObj?.trx_status || statusData?.trx_status || 'Pending',
        trx_id: dataObj?.trx_id || null,
        amount: dataObj?.payment_amount || null,
        payment_method: dataObj?.payment_method || 'PayStation'
      }
    } catch (err) {
      return { success: false, error: err.message }
    }
  }

  ipcMain.handle('paystation:create-session', async (event, { purpose = 'credit_recharge', deviceId, packageId, amount, customCredits, customerName, customerPhone, openInBrowser = true }) => {
    try {
      const storeId = process.env.PAYSTATION_STORE_ID || '6817-1790658194'
      const password = process.env.PAYSTATION_PASSWORD || 'ku6d@RY6x4y'
      const baseUrl = process.env.PAYSTATION_BASE_URL || 'https://api.paystation.com.bd'

      if (!storeId || !password) {
        return { success: false, error: 'PayStation credentials not found in local environment' }
      }

      // 1. Grant Token (PayStation returns status_code as string '200')
      const tokenRes = await fetch(`${baseUrl}/grant-token`, {
        method: 'POST',
        headers: {
          'merchantId': storeId,
          'password': password,
          'Content-Type': 'application/json'
        }
      })
      const tokenData = await tokenRes.json().catch(() => null)
      if (!tokenRes.ok || !tokenData || String(tokenData.status_code) !== '200' || !tokenData.token) {
        return { success: false, error: tokenData?.message || 'Failed to authenticate with PayStation Gateway' }
      }

      const invoiceNumber = `PK-CR-${Date.now()}`
      const numAmount = Number(amount ?? 250)
      const ref = `PK-CR|${deviceId || 'device'}|${packageId || 'custom'}|${customCredits || 100}`
      const callbackUrl = `http://127.0.0.1:${localCallbackPort}/payment-callback`

      // 2. Create Payment
      const payRes = await fetch(`${baseUrl}/create-payment`, {
        method: 'POST',
        headers: {
          'token': tokenData.token,
          'Content-Type': 'application/json'
        },
        body: JSON.stringify({
          invoice_number: invoiceNumber,
          currency: 'BDT',
          payment_amount: numAmount,
          reference: ref,
          cust_name: customerName || 'QuickInk Station Partner',
          cust_phone: customerPhone || '01700000000',
          cust_email: 'partner@printkoro.com',
          cust_address: 'Partner Station Terminal, Bangladesh',
          callback_url: callbackUrl
        })
      })

      const payData = await payRes.json().catch(() => null)
      if (!payRes.ok || !payData || String(payData.status_code) !== '200' || !payData.payment_url) {
        return { success: false, error: payData?.message || 'PayStation could not generate checkout session' }
      }

      // Always launch gateway directly in system's default browser (e.g. Chrome/Edge)
      try {
        await shell.openExternal(payData.payment_url)
      } catch (browserErr) {
        console.warn('[PayStation Desktop IPC] Failed to open default browser:', browserErr)
      }

      // Start background status poller in main process to push event to renderer when user completes payment in browser
      if (activePaymentPoll) {
        clearInterval(activePaymentPoll)
        activePaymentPoll = null
      }

      let checkCount = 0
      activePaymentPoll = setInterval(async () => {
        checkCount++
        try {
          const status = await checkPayStationStatus(invoiceNumber)
          if (status.success) {
            clearInterval(activePaymentPoll)
            activePaymentPoll = null
            mainWindow?.webContents?.send('paystation:payment-completed', {
              invoiceNumber,
              trx_id: status.trx_id,
              amount: status.amount,
              payment_method: status.payment_method,
              deviceId,
              packageId,
              customCredits
            })
          } else if (checkCount >= 100) {
            clearInterval(activePaymentPoll)
            activePaymentPoll = null
          }
        } catch (e) {
          // Continue polling
        }
      }, 3000)

      return {
        success: true,
        payment_url: payData.payment_url,
        invoice_number: invoiceNumber
      }
    } catch (err) {
      console.warn('[PayStation Desktop IPC] Error creating session:', err)
      return { success: false, error: err.message }
    }
  })

  ipcMain.handle('paystation:check-status', async (event, { invoiceNumber }) => {
    return checkPayStationStatus(invoiceNumber)
  })

  ipcMain.handle('shell:open-external', async (event, url) => {
    if (url) {
      await shell.openExternal(url)
      return true
    }
    return false
  })
}

// Background Auto-Updater Service
function setupAutoUpdater() {
  if (!autoUpdater) return

  autoUpdater.autoDownload = true
  autoUpdater.autoInstallOnAppQuit = true

  function sendStatusToWindow(status, payload = {}) {
    if (mainWindow && mainWindow.webContents) {
      mainWindow.webContents.send('updater:status', { status, ...payload })
    }
  }

  autoUpdater.on('checking-for-update', () => {
    console.log('[AutoUpdater] Checking for updates on GitHub...')
    sendStatusToWindow('checking')
  })

  autoUpdater.on('update-available', (info) => {
    console.log('[AutoUpdater] New update available:', info.version)
    sendStatusToWindow('available', {
      version: info.version,
      releaseDate: info.releaseDate,
      releaseNotes: info.releaseNotes
    })
  })

  autoUpdater.on('update-not-available', (info) => {
    console.log('[AutoUpdater] App is up to date (version ' + info.version + ')')
    sendStatusToWindow('up-to-date', { version: info.version })
  })

  autoUpdater.on('download-progress', (progressObj) => {
    sendStatusToWindow('downloading', {
      percent: Math.round(progressObj.percent),
      bytesPerSecond: progressObj.bytesPerSecond,
      transferred: progressObj.transferred,
      total: progressObj.total
    })
  })

  autoUpdater.on('update-downloaded', (info) => {
    console.log('[AutoUpdater] Update successfully downloaded:', info.version)
    sendStatusToWindow('downloaded', {
      version: info.version,
      message: `Version ${info.version} downloaded and ready to install.`
    })
  })

  autoUpdater.on('error', (err) => {
    console.warn('[AutoUpdater] Update error:', err?.message || err)
    sendStatusToWindow('error', { error: err?.message || 'Failed to check for updates' })
  })

  // Start checking only when running as a packaged app (production)
  if (app.isPackaged) {
    // Initial check 5 seconds after startup
    setTimeout(() => {
      autoUpdater.checkForUpdates().catch((e) => console.warn('[AutoUpdater] Initial check error:', e.message))
    }, 5000)

    // Recurring check every 2 hours
    setInterval(() => {
      autoUpdater.checkForUpdates().catch((e) => console.warn('[AutoUpdater] Recurring check error:', e.message))
    }, 2 * 60 * 60 * 1000)
  }
}
