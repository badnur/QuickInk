const { app, BrowserWindow, ipcMain } = require('electron')
const path = require('path')
const fs = require('fs')
const child_process = require('child_process')

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
  Jimp = require('jimp')
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

// Config file path in app userData directory
const getConfigPath = () => path.join(app.getPath('userData'), 'quickink-desktop-config.json')

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

  mainWindow = new BrowserWindow({
    width: 1240,
    height: 820,
    minWidth: 1024,
    minHeight: 680,
    title: 'Quick Ink',
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

// Helper: Download a remote file to a local temp file
async function downloadToTemp(fileUrl, preferredExt = '.pdf') {
  try {
    const tempDir = app.getPath('temp')
    const fileName = `quickink_${Date.now()}_${Math.random().toString(36).substring(7)}${preferredExt}`
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
      return resolvedUrl
    }

    // 2. If it's a relative path from local dev server uploads
    if (resolvedUrl.startsWith('/uploads/')) {
      const cfg = loadConfig()
      const base = cfg.apiBaseUrl || 'http://localhost:3000'
      resolvedUrl = `${base}${resolvedUrl}`
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

// Helper: Synchronize Windows Printer Driver settings (monochrome vs color & duplex)
// Returns true if the driver change was applied successfully, false otherwise.
async function setPrinterHardwareConfig(printerName, isColor, isDuplex = false) {
  if (process.platform !== 'win32' || !printerName) return false
  return new Promise((resolve) => {
    const escapedName = printerName.replace(/"/g, '`"')
    const colorVal = isColor ? '$true' : '$false'
    const duplexVal = isDuplex ? 'TwoSidedLongEdge' : 'OneSided'
    const psCmd = `try { Set-PrintConfiguration -PrinterName "${escapedName}" -Color ${colorVal} -DuplexingMode ${duplexVal} -ErrorAction Stop } catch { try { Set-PrintConfiguration -PrinterName "${escapedName}" -Color ${colorVal} -ErrorAction SilentlyContinue } catch {} }`
    child_process.execFile(
      'powershell.exe',
      ['-NoProfile', '-NonInteractive', '-Command', psCmd],
      { timeout: 5000 },
      (err) => {
        if (err) {
          console.warn(`[PrinterConfig] Set-PrintConfiguration notice: ${err.message}`)
          resolve(false)
        } else {
          console.log(`[PrinterConfig] Driver config synchronized → "${printerName}" Color=${isColor} Duplex=${duplexVal}`)
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
      jimpImage.grayscale()
      imageBytes = await jimpImage.getBufferAsync(Jimp.MIME_JPEG)
      isPng = false
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

  page.drawText('QuickInk Print Station', {
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

  page.drawText('If this page printed, your hardware printer is communicating correctly with QuickInk.', {
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

  page.drawText('QuickInk Smart Cloud Print POS — Direct Windows Spooler Engine', {
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
            <div class="logo">QuickInk Print Station</div>
            <div class="badge">${isColor ? 'COLOR TEST PAGE' : 'BLACK & WHITE TEST PAGE'}</div>
          </div>
          <p style="font-size: 16px; margin-bottom: 5px;"><strong>Hardware Alignment & Spooler Test</strong></p>
          <p style="font-size: 13px; color: #64748b;">If you can read this document, your physical printer is communicating with QuickInk.</p>
          <table class="meta-table">
            <tr><td><strong>Target Device:</strong></td><td>${printerName}</td></tr>
            <tr><td><strong>Output Mode:</strong></td><td>${isColor ? 'Full Color (Inkjet/Laser)' : 'Black & White (Monochrome)'}</td></tr>
            <tr><td><strong>Timestamp:</strong></td><td>${new Date().toLocaleString()}</td></tr>
          </table>
          <div class="footer">QuickInk Smart Cloud Print POS</div>
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
  ipcMain.handle('printers:print-job', async (event, { printerName, fileUrl, copies = 1, color = false, duplex = false, pageRange = null }) => {
    try {
      if (!printerName) {
        return { success: false, error: 'No printer specified for this job' }
      }

      let effectivePageRange = pageRange
      if (!effectivePageRange && fileUrl && fileUrl.includes('#range=')) {
        try {
          effectivePageRange = decodeURIComponent(fileUrl.split('#range=')[1].split('&')[0])
        } catch (e) {}
      }
      if (effectivePageRange) effectivePageRange = String(effectivePageRange).trim()

      const isColor = Boolean(color)
      const isDuplex = Boolean(duplex === true || duplex === 'duplex' || duplex === 'duplexlong' || duplex === 'true')
      console.log(`[PrintJob] Preparing print to ${printerName} | Copies: ${copies} | Color: ${isColor} | Duplex: ${isDuplex} | PageRange: ${effectivePageRange || 'all'}`)

      // 1. Enforce Color and Duplex mode at the Windows driver level
      await setPrinterHardwareConfig(printerName, isColor, isDuplex)

      let tempFilePath = null
      let convertedPdfPath = null
      let slicedPdfPath = null

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

          // Exact Hardware Page-Range Slicing: If specific pages requested, physically slice PDF
          // This guarantees that ANY printer (TOSHIBA, HP, Epson) prints ONLY the requested pages.
          if (PDFLib && targetPdfPath && effectivePageRange) {
            try {
              const srcBytes = fs.readFileSync(targetPdfPath)
              const srcDoc = await PDFLib.PDFDocument.load(srcBytes)
              const totalPdfPages = srcDoc.getPageCount()
              const targetIndices = parsePageRange(effectivePageRange, totalPdfPages)

              if (targetIndices.length > 0 && targetIndices.length < totalPdfPages) {
                console.log(`[PrintJob] Slicing PDF: requested range "${effectivePageRange}" on ${totalPdfPages}-page document → extracting ${targetIndices.length} page(s) (indices: [${targetIndices.join(',')}])`)
                const slicedDoc = await PDFLib.PDFDocument.create()
                const copiedPages = await slicedDoc.copyPages(srcDoc, targetIndices)
                copiedPages.forEach((p) => slicedDoc.addPage(p))
                const slicedBytes = await slicedDoc.save()

                slicedPdfPath = path.join(app.getPath('temp'), `quickink_sliced_${Date.now()}_${Math.random().toString(36).substring(7)}.pdf`)
                fs.writeFileSync(slicedPdfPath, slicedBytes)
                targetPdfPath = slicedPdfPath
                console.log(`[PrintJob] Sliced PDF ready for hardware spooler at: ${slicedPdfPath} (page count: ${slicedDoc.getPageCount()})`)
              } else {
                console.log(`[PrintJob] Page range "${effectivePageRange}" covers all ${totalPdfPages} pages or full document.`)
              }
            } catch (sliceErr) {
              console.warn('[PrintJob] PDF page slicing error, using original document:', sliceErr.message)
            }
          }

          // Primary: Send to Windows Spooler via SumatraPDF with explicit monochrome/color flag
          if (pdfToPrinter && targetPdfPath) {
            try {
              // Map duplex value to SumatraPDF's accepted 'side' option values
              const sideValue = isDuplex ? 'duplexlong' : 'simplex'
              console.log(`[PrintJob] Using pdf-to-printer → ${printerName} | monochrome: ${!isColor} | side: ${sideValue} | scale: shrink`)

              // Build options object. scale: 'shrink' prevents zoom distortion and preserves 1:1 scale
              const ptpOptions = {
                printer: printerName,
                copies: parseInt(copies, 10) || 1,
                paperSize: 'A4',
                side: sideValue,
                scale: 'shrink',
                monochrome: !isColor    // true → SumatraPDF -print-settings includes 'monochrome'
              }

              // If explicitly printing in color, set monochrome to false so SumatraPDF
              // adds 'color' to print-settings (prevents any leftover monochrome setting)
              if (isColor) ptpOptions.monochrome = false

              // If the file was not sliced, also supply pages option as extra fallback
              if (effectivePageRange && !slicedPdfPath) {
                ptpOptions.pages = effectivePageRange
                console.log(`[PrintJob] Applying page range filter: ${ptpOptions.pages}`)
              }

              await pdfToPrinter.print(targetPdfPath, ptpOptions)

              // Schedule cleanup
              setTimeout(() => {
                try { if (tempFilePath && fs.existsSync(tempFilePath)) fs.unlinkSync(tempFilePath) } catch (e) {}
                try { if (convertedPdfPath && fs.existsSync(convertedPdfPath)) fs.unlinkSync(convertedPdfPath) } catch (e) {}
                try { if (slicedPdfPath && fs.existsSync(slicedPdfPath)) fs.unlinkSync(slicedPdfPath) } catch (e) {}
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
                  try { if (slicedPdfPath && fs.existsSync(slicedPdfPath)) fs.unlinkSync(slicedPdfPath) } catch (e) {}
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
          if (slicedPdfPath) {
            try { if (fs.existsSync(slicedPdfPath)) fs.unlinkSync(slicedPdfPath) } catch (e) {}
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
