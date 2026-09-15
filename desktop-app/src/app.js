// =============================================================================
// QuickInk Desktop POS & Kiosk Terminal — Client Logic
// =============================================================================

// Default Fallback Config
const state = {
  config: {
    deviceId: '11111111-1111-1111-1111-111111111111',
    apiBaseUrl: 'http://localhost:3000',
    bwPrinterName: '',
    colorPrinterName: '',
    isKiosk: false
  },
  systemPrinters: [],
  activeJob: null,
  recentJobs: [],
  todayStats: {
    totalJobs: 0,
    bwSheets: 0,
    colorSheets: 0,
    totalRevenue: 0,
    partnerCommission: 0
  }
}

// Check if running inside Electron desktop container
const isElectron = Boolean(window.quickinkDesktop)

// Audio Synthesizer Chime (Web Audio API)
function playSuccessChime() {
  try {
    const AudioContext = window.AudioContext || window.webkitAudioContext
    if (!AudioContext) return
    const ctx = new AudioContext()
    const notes = [523.25, 659.25, 783.99] // C5, E5, G5 major triad

    notes.forEach((freq, i) => {
      const osc = ctx.createOscillator()
      const gain = ctx.createGain()
      osc.type = 'sine'
      osc.frequency.setValueAtTime(freq, ctx.currentTime + i * 0.1)

      gain.gain.setValueAtTime(0, ctx.currentTime + i * 0.1)
      gain.gain.linearRampToValueAtTime(0.2, ctx.currentTime + i * 0.1 + 0.02)
      gain.gain.exponentialRampToValueAtTime(0.0001, ctx.currentTime + i * 0.1 + 0.35)

      osc.connect(gain)
      gain.connect(ctx.destination)

      osc.start(ctx.currentTime + i * 0.1)
      osc.stop(ctx.currentTime + i * 0.1 + 0.4)
    })
  } catch (e) {
    console.warn('Audio chime error:', e)
  }
}

// DOM Elements
const el = {
  stationSelect: document.getElementById('station-select'),
  clockDisplay: document.getElementById('clock-display'),
  btnToggleKiosk: document.getElementById('btn-toggle-kiosk'),
  btnWinMin: document.getElementById('btn-win-min'),
  btnWinMax: document.getElementById('btn-win-max'),
  btnWinClose: document.getElementById('btn-win-close'),
  navTabs: document.querySelectorAll('.nav-tab'),
  tabPanels: document.querySelectorAll('.tab-panel'),

  // OTP inputs
  otpBoxes: [
    document.getElementById('otp-0'),
    document.getElementById('otp-1'),
    document.getElementById('otp-2'),
    document.getElementById('otp-3'),
    document.getElementById('otp-4'),
    document.getElementById('otp-5')
  ],
  otpStatusMsg: document.getElementById('otp-status-msg'),
  btnVerifyOtp: document.getElementById('btn-verify-otp'),
  verifySpinner: document.getElementById('verify-spinner'),
  verifyBtnText: document.getElementById('verify-btn-text'),
  btnClearOtp: document.getElementById('btn-clear-otp'),
  btnBackspaceOtp: document.getElementById('btn-backspace-otp'),
  numpadBtns: document.querySelectorAll('.numpad-btn[data-val]'),

  // Bottom hardware strip
  stripBwName: document.getElementById('strip-bw-name'),
  stripColorName: document.getElementById('strip-color-name'),

  // Printers Tab
  btnRefreshPrinters: document.getElementById('btn-refresh-printers'),
  selectBwPrinter: document.getElementById('select-bw-printer'),
  selectColorPrinter: document.getElementById('select-color-printer'),
  btnTestBw: document.getElementById('btn-test-bw'),
  btnTestColor: document.getElementById('btn-test-color'),
  btnSavePrinters: document.getElementById('btn-save-printers'),
  savePrintersStatus: document.getElementById('save-printers-status'),

  // Queue Tab
  queueSearch: document.getElementById('queue-search'),
  btnRefreshQueue: document.getElementById('btn-refresh-queue'),
  jobsTableBody: document.getElementById('jobs-table-body'),

  // Earnings Tab
  metricTotalJobs: document.getElementById('metric-total-jobs'),
  metricBwSheets: document.getElementById('metric-bw-sheets'),
  metricColorSheets: document.getElementById('metric-color-sheets'),
  metricPartnerCommission: document.getElementById('metric-partner-commission'),
  miniStatJobs: document.getElementById('mini-stat-jobs'),
  miniStatPages: document.getElementById('mini-stat-pages'),
  miniStatCommission: document.getElementById('mini-stat-commission'),

  // Job Modal
  jobModal: document.getElementById('job-modal'),
  modalDocTitle: document.getElementById('modal-doc-title'),
  modalOtp: document.getElementById('modal-otp'),
  modalColorMode: document.getElementById('modal-color-mode'),
  modalPagesCopies: document.getElementById('modal-pages-copies'),
  modalDuplex: document.getElementById('modal-duplex'),
  modalRoutedPrinter: document.getElementById('modal-routed-printer'),
  modalPaymentAlert: document.getElementById('modal-payment-alert'),
  modalPayHeading: document.getElementById('modal-pay-heading'),
  modalPayInstruction: document.getElementById('modal-pay-instruction'),
  modalPayAmount: document.getElementById('modal-pay-amount'),
  spoolingPanel: document.getElementById('spooling-panel'),
  spoolingStepLabel: document.getElementById('spooling-step-label'),
  spoolingPercentage: document.getElementById('spooling-percentage'),
  spoolingProgressBar: document.getElementById('spooling-progress-bar'),
  btnCloseModal: document.getElementById('btn-close-modal'),
  btnCancelJob: document.getElementById('btn-cancel-job'),
  btnReleasePrint: document.getElementById('btn-release-print'),
  releaseBtnText: document.getElementById('release-btn-text'),
  releaseBtnIcon: document.getElementById('release-btn-icon')
}

// =============================================================================
// INITIALIZATION
// =============================================================================
async function init() {
  setupClock()
  setupTabNavigation()
  setupOtpKeypad()
  setupWindowControls()

  // Load configuration and native printers
  await loadAppConfig()
  await scanSystemPrinters()
  await fetchDevices()
  await fetchRecentJobs()

  // Auto focus first OTP slot
  el.otpBoxes[0]?.focus()

  // Auto-scan printers when window regains focus (e.g. user plugged in USB printer)
  window.addEventListener('focus', () => {
    scanSystemPrinters()
  })
}

// Digital Clock
function setupClock() {
  const update = () => {
    const now = new Date()
    el.clockDisplay.textContent = now.toLocaleTimeString('en-US', {
      hour: '2-digit',
      minute: '2-digit',
      second: '2-digit',
      hour12: true
    })
  }
  update()
  setInterval(update, 1000)
}

// Window Controls (Electron IPC)
function setupWindowControls() {
  if (isElectron) {
    el.btnWinMin.addEventListener('click', () => window.quickinkDesktop.minimize())
    el.btnWinMax.addEventListener('click', () => window.quickinkDesktop.maximize())
    el.btnWinClose.addEventListener('click', () => window.quickinkDesktop.close())
    el.btnToggleKiosk.addEventListener('click', async () => {
      const isKiosk = await window.quickinkDesktop.toggleKiosk()
      el.btnToggleKiosk.classList.toggle('active', isKiosk)
    })
  } else {
    // Web fallback
    el.btnWinMin.style.display = 'none'
    el.btnWinMax.style.display = 'none'
    el.btnWinClose.style.display = 'none'
    el.btnToggleKiosk.addEventListener('click', () => {
      if (!document.fullscreenElement) {
        document.documentElement.requestFullscreen()
      } else {
        document.exitFullscreen()
      }
    })
  }
}

// Tab Navigation
function setupTabNavigation() {
  el.navTabs.forEach((tab) => {
    tab.addEventListener('click', () => {
      const targetId = tab.getAttribute('data-tab')
      el.navTabs.forEach((t) => t.classList.remove('active'))
      el.tabPanels.forEach((p) => p.classList.remove('active'))

      tab.classList.add('active')
      document.getElementById(targetId)?.classList.add('active')

      if (targetId === 'tab-keypad') {
        el.otpBoxes[0]?.focus()
      } else if (targetId === 'tab-queue') {
        fetchRecentJobs()
      }
    })
  })
}

// Load App Configuration
async function loadAppConfig() {
  if (isElectron) {
    try {
      const cfg = await window.quickinkDesktop.getConfig()
      if (cfg) {
        state.config = { ...state.config, ...cfg }
        if (cfg.deviceId && el.stationSelect) {
          el.stationSelect.value = cfg.deviceId
        }
      }
    } catch (err) {
      console.warn('Failed to load desktop config:', err)
    }
  }

  el.stationSelect.addEventListener('change', async () => {
    state.config.deviceId = el.stationSelect.value
    if (isElectron) {
      await window.quickinkDesktop.saveConfig({ deviceId: state.config.deviceId })
    }
    fetchRecentJobs()
  })
}

// Scan Installed System Printers via Electron IPC
async function scanSystemPrinters() {
  el.selectBwPrinter.innerHTML = '<option value="">Scanning installed printers...</option>'
  el.selectColorPrinter.innerHTML = '<option value="">Scanning installed printers...</option>'

  let printers = []
  if (isElectron) {
    try {
      const res = await window.quickinkDesktop.getPrinters()
      if (res.success && res.printers) {
        printers = res.printers
      }
    } catch (e) {
      console.error('Error scanning printers:', e)
    }
  }

  // If no hardware printers found, inform user cleanly
  if (printers.length === 0) {
    el.selectBwPrinter.innerHTML = '<option value="">No printers detected on PC. Connect via USB or Wi-Fi</option>'
    el.selectColorPrinter.innerHTML = '<option value="">No printers detected on PC. Connect via USB or Wi-Fi</option>'
    el.stripBwName.textContent = 'None detected'
    el.stripColorName.textContent = 'None detected'
    const badge = document.getElementById('printers-badge-pill')
    if (badge) badge.textContent = '0 Detected'
    return
  }

  // Sort printers so real physical printers (EPSON, Canon, HP, Brother) appear first
  const isVirtual = (name) => /pdf|xps|onenote|fax/i.test(name)
  printers.sort((a, b) => {
    const aV = isVirtual(a.name) ? 1 : 0
    const bV = isVirtual(b.name) ? 1 : 0
    return aV - bV
  })

  state.systemPrinters = printers

  const badge = document.getElementById('printers-badge-pill')
  if (badge) badge.textContent = `${printers.length} Detected`

  // Populate B&W select with real detected hardware
  el.selectBwPrinter.innerHTML = printers
    .map((p) => `<option value="${p.name}">${p.displayName || p.name} ${!isVirtual(p.name) ? '🖨️ (Hardware)' : ''}</option>`)
    .join('')

  // Populate Color select with real detected hardware
  el.selectColorPrinter.innerHTML = printers
    .map((p) => `<option value="${p.name}">${p.displayName || p.name} ${!isVirtual(p.name) ? '🎨 (Hardware)' : ''}</option>`)
    .join('')

  const physicalPrinters = printers.filter((p) => !isVirtual(p.name))
  const bestHardwarePrinter = physicalPrinters[0]?.name || printers[0]?.name || ''

  // Restore saved selections or use detected hardware
  if (state.config.bwPrinterName && printers.some((p) => p.name === state.config.bwPrinterName)) {
    el.selectBwPrinter.value = state.config.bwPrinterName
  } else if (bestHardwarePrinter) {
    el.selectBwPrinter.value = bestHardwarePrinter
    state.config.bwPrinterName = bestHardwarePrinter
  }

  if (state.config.colorPrinterName && printers.some((p) => p.name === state.config.colorPrinterName)) {
    el.selectColorPrinter.value = state.config.colorPrinterName
  } else if (physicalPrinters.length > 1) {
    el.selectColorPrinter.value = physicalPrinters[1].name
    state.config.colorPrinterName = physicalPrinters[1].name
  } else if (bestHardwarePrinter) {
    el.selectColorPrinter.value = bestHardwarePrinter
    state.config.colorPrinterName = bestHardwarePrinter
  }

  updateHardwareStrip()
}

function updateHardwareStrip() {
  const bwName = el.selectBwPrinter.value || 'None Configured'
  const colorName = el.selectColorPrinter.value || 'None Configured'
  el.stripBwName.textContent = bwName
  el.stripColorName.textContent = colorName

  const bwDot = document.getElementById('bw-strip-dot')
  const colorDot = document.getElementById('color-strip-dot')
  if (bwDot) bwDot.className = `dot ${el.selectBwPrinter.value ? 'green' : 'red'}`
  if (colorDot) colorDot.className = `dot ${el.selectColorPrinter.value ? 'green' : 'red'}`
}

// Test Print Actions
el.btnTestBw?.addEventListener('click', async () => {
  const printerName = el.selectBwPrinter.value
  if (!printerName) return alert('Please select a B&W printer first')
  el.btnTestBw.textContent = 'Sending Test Page...'
  if (isElectron) {
    const res = await window.quickinkDesktop.testPrint(printerName, 'bw')
    alert(res.message || res.error)
  } else {
    setTimeout(() => alert(`[Test Print] Simulated B&W test page sent to ${printerName}`), 600)
  }
  el.btnTestBw.textContent = 'Send Test Page (B&W)'
})

el.btnTestColor?.addEventListener('click', async () => {
  const printerName = el.selectColorPrinter.value
  if (!printerName) return alert('Please select a Color printer first')
  el.btnTestColor.textContent = 'Sending Test Page...'
  if (isElectron) {
    const res = await window.quickinkDesktop.testPrint(printerName, 'color')
    alert(res.message || res.error)
  } else {
    setTimeout(() => alert(`[Test Print] Simulated Color test page sent to ${printerName}`), 600)
  }
  el.btnTestColor.textContent = 'Send Test Page (Color)'
})

el.btnSavePrinters?.addEventListener('click', async () => {
  state.config.bwPrinterName = el.selectBwPrinter.value
  state.config.colorPrinterName = el.selectColorPrinter.value

  if (isElectron) {
    await window.quickinkDesktop.saveConfig({
      bwPrinterName: state.config.bwPrinterName,
      colorPrinterName: state.config.colorPrinterName
    })
  }

  updateHardwareStrip()
  el.savePrintersStatus.textContent = '✓ Preferences saved successfully!'
  setTimeout(() => {
    el.savePrintersStatus.textContent = ''
  }, 3000)
})

el.btnRefreshPrinters?.addEventListener('click', scanSystemPrinters)

// =============================================================================
// OTP KEYPAD & INPUT BEHAVIOR
// =============================================================================
function setupOtpKeypad() {
  // Input event on individual boxes
  el.otpBoxes.forEach((box, idx) => {
    box.addEventListener('input', (e) => {
      const val = e.target.value.replace(/[^0-9]/g, '')
      e.target.value = val

      if (val.length === 1) {
        box.classList.add('filled')
        // Advance to next box
        if (idx < 5) {
          el.otpBoxes[idx + 1].focus()
        }
      } else {
        box.classList.remove('filled')
      }

      clearOtpStatus()

      // Auto submit if all 6 filled
      if (getOtpValue().length === 6) {
        verifyOtp()
      }
    })

    box.addEventListener('keydown', (e) => {
      if (e.key === 'Backspace' && !box.value && idx > 0) {
        el.otpBoxes[idx - 1].focus()
        el.otpBoxes[idx - 1].value = ''
        el.otpBoxes[idx - 1].classList.remove('filled')
      } else if (e.key === 'Enter') {
        verifyOtp()
      }
    })

    // Handle paste event (e.g. "123456")
    box.addEventListener('paste', (e) => {
      e.preventDefault()
      const pasted = (e.clipboardData || window.clipboardData).getData('text')
      const digits = pasted.replace(/[^0-9]/g, '').slice(0, 6)
      digits.split('').forEach((digit, i) => {
        if (el.otpBoxes[i]) {
          el.otpBoxes[i].value = digit
          el.otpBoxes[i].classList.add('filled')
        }
      })
      if (digits.length === 6) {
        el.otpBoxes[5].focus()
        verifyOtp()
      } else if (el.otpBoxes[digits.length]) {
        el.otpBoxes[digits.length].focus()
      }
    })
  })

  // Global physical keyboard listener for numpad when no input focused
  document.addEventListener('keydown', (e) => {
    if (el.jobModal && !el.jobModal.classList.contains('hidden')) {
      if (e.key === 'Escape') closeModal()
      if (e.key === 'Enter') releasePrintJob()
      return
    }

    // If typing digits 0-9
    if (/^[0-9]$/.test(e.key) && !e.ctrlKey && !e.altKey && !e.metaKey) {
      const activeElement = document.activeElement
      const isOtpBox = el.otpBoxes.includes(activeElement)
      if (!isOtpBox) {
        // Find first empty slot
        const emptySlot = el.otpBoxes.find((b) => !b.value) || el.otpBoxes[0]
        emptySlot.value = e.key
        emptySlot.classList.add('filled')
        const emptyIdx = el.otpBoxes.indexOf(emptySlot)
        if (emptyIdx < 5) el.otpBoxes[emptyIdx + 1].focus()
        else emptySlot.focus()

        if (getOtpValue().length === 6) verifyOtp()
      }
    }
  })

  // On-screen touch keypad buttons (1-9, 0)
  el.numpadBtns.forEach((btn) => {
    btn.addEventListener('click', () => {
      const digit = btn.getAttribute('data-val')
      const emptySlot = el.otpBoxes.find((b) => !b.value)
      if (emptySlot) {
        emptySlot.value = digit
        emptySlot.classList.add('filled')
        const idx = el.otpBoxes.indexOf(emptySlot)
        if (idx < 5) el.otpBoxes[idx + 1].focus()
        else emptySlot.focus()

        if (getOtpValue().length === 6) {
          verifyOtp()
        }
      }
    })
  })

  // Clear button
  el.btnClearOtp?.addEventListener('click', clearOtpInputs)

  // Backspace button
  el.btnBackspaceOtp?.addEventListener('click', () => {
    for (let i = 5; i >= 0; i--) {
      if (el.otpBoxes[i].value) {
        el.otpBoxes[i].value = ''
        el.otpBoxes[i].classList.remove('filled')
        el.otpBoxes[i].focus()
        break
      }
    }
    clearOtpStatus()
  })

  // Submit button
  el.btnVerifyOtp?.addEventListener('click', verifyOtp)
}

function getOtpValue() {
  return el.otpBoxes.map((b) => b.value).join('')
}

function clearOtpInputs() {
  el.otpBoxes.forEach((b) => {
    b.value = ''
    b.classList.remove('filled')
  })
  el.otpBoxes[0]?.focus()
  clearOtpStatus()
}

function showOtpStatus(msg, type = 'error') {
  el.otpStatusMsg.textContent = msg
  el.otpStatusMsg.className = `status-msg-box ${type}`
}

function clearOtpStatus() {
  el.otpStatusMsg.textContent = ''
  el.otpStatusMsg.className = 'status-msg-box hidden'
}

// =============================================================================
// VERIFY OTP (API CALL)
// =============================================================================
async function verifyOtp() {
  const code = getOtpValue()
  if (code.length !== 6) {
    showOtpStatus('Please enter a complete 6-digit numeric OTP', 'error')
    return
  }

  el.btnVerifyOtp.disabled = true
  el.verifySpinner.classList.remove('hidden')
  el.verifyBtnText.textContent = 'Verifying OTP...'
  clearOtpStatus()

  try {
    const res = await fetch(`${state.config.apiBaseUrl}/api/desktop/redeem`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        code: code,
        device_id: state.config.deviceId
      })
    })

    const data = await res.json()

    if (!res.ok || !data.success) {
      showOtpStatus(data.error || 'Invalid or expired OTP code', 'error')
      el.btnVerifyOtp.disabled = false
      el.verifySpinner.classList.add('hidden')
      el.verifyBtnText.textContent = 'Verify & Fetch Print Job'
      return
    }

    // OTP Verified Successfully!
    state.activeJob = data.data
    openJobModal(data.data)
  } catch (err) {
    console.error('Verify error:', err)
    showOtpStatus('Could not connect to QuickInk server. Check network.', 'error')
  } finally {
    el.btnVerifyOtp.disabled = false
    el.verifySpinner.classList.add('hidden')
    el.verifyBtnText.textContent = 'Verify & Fetch Print Job'
  }
}

// =============================================================================
// JOB VERIFICATION & RELEASE MODAL
// =============================================================================
function openJobModal(jobData) {
  const job = jobData.print_job || jobData
  const isColor = (job.color_mode || 'bw') === 'color'
  const isDuplex = Boolean(job.duplex)
  const isPaid = jobData.payment?.status === 'completed' || job.payment_type === 'online'
  const amount = jobData.amount || '10.00'

  // Fill details
  el.modalDocTitle.textContent = job.file_name || 'Document.pdf'
  el.modalOtp.textContent = job.otp_code || getOtpValue()
  el.modalColorMode.textContent = isColor ? 'Color Print' : 'Black & White'
  const rangeLabel = job.page_range ? ` [Pages: ${job.page_range}]` : ''
  el.modalPagesCopies.textContent = `${job.page_count || 1} pages${rangeLabel} × ${job.copies || 1} copy`
  el.modalDuplex.textContent = isDuplex ? 'Double-Sided (Duplex)' : 'Single-Sided'

  // Hardware Destination based on user-selected hardware in Printers Setup
  const assignedPrinter = isColor
    ? state.config.colorPrinterName || el.selectColorPrinter.value
    : state.config.bwPrinterName || el.selectBwPrinter.value

  el.modalRoutedPrinter.textContent = assignedPrinter
    ? `${assignedPrinter} (${isColor ? 'Color' : 'Black & White'})`
    : 'No printer selected — Please assign in Printers Setup'

  // Payment Status Alert
  if (!isPaid) {
    el.modalPaymentAlert.className = 'payment-alert cash'
    el.modalPayHeading.textContent = 'Cash Collection Required'
    el.modalPayInstruction.innerHTML = `Please collect <strong id="modal-pay-amount">৳${amount}</strong> from customer before confirming print.`
    el.releaseBtnIcon.textContent = '💰'
    el.releaseBtnText.textContent = `Confirm Cash (৳${amount}) & Print`
  } else {
    el.modalPaymentAlert.className = 'payment-alert online'
    el.modalPayHeading.textContent = 'Pre-Paid Online'
    el.modalPayInstruction.textContent = 'Customer completed payment via digital wallet. Ready for release.'
    el.releaseBtnIcon.textContent = '🖨️'
    el.releaseBtnText.textContent = 'Send to Printer / Release Now'
  }

  // Reset progress bar
  el.spoolingPanel.classList.add('hidden')
  el.spoolingProgressBar.style.width = '0%'
  el.btnReleasePrint.disabled = false
  el.btnCancelJob.disabled = false

  el.jobModal.classList.remove('hidden')
}

function closeModal() {
  el.jobModal.classList.add('hidden')
  state.activeJob = null
}

el.btnCloseModal?.addEventListener('click', closeModal)
el.btnCancelJob?.addEventListener('click', closeModal)

// =============================================================================
// PRINT RELEASE & SPOOLING EXECUTION
// =============================================================================
async function releasePrintJob() {
  if (!state.activeJob) return

  const job = state.activeJob.print_job || state.activeJob
  const isColor = (job.color_mode || 'bw') === 'color'
  const assignedPrinter = isColor
    ? state.config.colorPrinterName || el.selectColorPrinter.value
    : state.config.bwPrinterName || el.selectBwPrinter.value

  el.btnReleasePrint.disabled = true
  el.btnCancelJob.disabled = true
  el.spoolingPanel.classList.remove('hidden')

  // Spooling Animation Sequence
  const updateProgress = (pct, label) => {
    el.spoolingProgressBar.style.width = `${pct}%`
    el.spoolingPercentage.textContent = `${pct}%`
    el.spoolingStepLabel.textContent = label
  }

  updateProgress(15, 'Connecting to printer spooler...')

  setTimeout(() => {
    updateProgress(45, `Spooling ${job.page_count || 1} pages to ${assignedPrinter}...`)
  }, 400)

  setTimeout(async () => {
    updateProgress(80, 'Transferring print commands...')

    // Native print trigger if Electron
    if (isElectron && assignedPrinter) {
      try {
        const printResult = await window.quickinkDesktop.printJob({
          printerName: assignedPrinter,
          fileUrl: job.file_url,
          copies: job.copies || 1,
          color: isColor,
          duplex: Boolean(job.duplex),
          pageRange: job.page_range || null   // e.g. "1-3,5" or null for all pages
        })
        if (printResult && !printResult.success) {
          updateProgress(80, `⚠️ Notice: ${printResult.error || 'Printer error'}`)
          el.btnReleasePrint.disabled = false
          el.btnCancelJob.disabled = false
          alert(`Printer Notice:\n\n${printResult.error || 'Spooler rejected job'}\n\nTip: Ensure the printer is turned ON and not set to "Use Printer Offline" in Windows Settings.`)
          return
        }
      } catch (err) {
        console.warn('Native print error:', err)
        updateProgress(80, `⚠️ Error: ${err.message}`)
        el.btnReleasePrint.disabled = false
        el.btnCancelJob.disabled = false
        alert(`Print Error: ${err.message}`)
        return
      }
    }

    setTimeout(() => {
      updateProgress(100, '✓ Print Completed & Paper Dispensed!')
      playSuccessChime()

      setTimeout(() => {
        closeModal()
        clearOtpInputs()
        fetchRecentJobs()
      }, 1000)
    }, 700)
  }, 900)
}

el.btnReleasePrint?.addEventListener('click', releasePrintJob)

// =============================================================================
// RECENT JOBS & EARNINGS METRICS
// =============================================================================
async function fetchRecentJobs() {
  try {
    const res = await fetch(`${state.config.apiBaseUrl}/api/desktop/jobs?device_id=${state.config.deviceId}`)
    const data = await res.json()
    if (data?.jobs) {
      state.recentJobs = data.jobs
      renderJobsTable(data.jobs)
      computeStats(data.jobs)
    }
  } catch (err) {
    console.warn('Could not load recent jobs:', err)
  }
}

el.btnRefreshQueue?.addEventListener('click', fetchRecentJobs)

function renderJobsTable(jobs) {
  if (!el.jobsTableBody) return

  const filtered = jobs.filter((j) => {
    const term = (el.queueSearch?.value || '').toLowerCase().trim()
    if (!term) return true
    return (
      (j.otp_code && j.otp_code.toLowerCase().includes(term)) ||
      (j.file_name && j.file_name.toLowerCase().includes(term))
    )
  })

  if (filtered.length === 0) {
    el.jobsTableBody.innerHTML = '<tr><td colspan="9" class="empty-state">No print jobs found.</td></tr>'
    return
  }

  el.jobsTableBody.innerHTML = filtered
    .map((j) => {
      const isColor = j.color_mode === 'color'
      const timeStr = j.created_at ? new Date(j.created_at).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }) : '--:--'
      const amount = (j.total_price || (isColor ? 8 : 2) * (j.page_count || 1) * (j.copies || 1)).toFixed(2)

      return `
        <tr>
          <td>${timeStr}</td>
          <td><strong style="color: var(--primary); font-family: monospace; font-size: 14px;">${j.otp_code || '—'}</strong></td>
          <td>${j.file_name || 'Document.pdf'}</td>
          <td><span class="tag ${isColor ? 'color' : 'bw'}">${isColor ? 'Color' : 'B&W'}</span></td>
          <td>${j.duplex ? 'Duplex' : 'Single'}</td>
          <td>${j.page_count || 1}p × ${j.copies || 1}</td>
          <td><strong>৳${amount}</strong></td>
          <td>${j.payment_type === 'online' ? '<span style="color: #10b981;">Online</span>' : '<span style="color: #f59e0b;">Cash</span>'}</td>
          <td><span class="status-pill green">${j.status === 'completed' ? 'Printed' : 'Ready'}</span></td>
        </tr>
      `
    })
    .join('')
}

el.queueSearch?.addEventListener('input', () => renderJobsTable(state.recentJobs))

// Compute daily revenue & 40% commission
function computeStats(jobs) {
  let bwSheets = 0
  let colorSheets = 0
  let totalRevenue = 0

  jobs.forEach((j) => {
    const pages = (j.page_count || 1) * (j.copies || 1)
    if (j.color_mode === 'color') {
      colorSheets += pages
      totalRevenue += pages * 8.0
    } else {
      bwSheets += pages
      totalRevenue += pages * 2.0
    }
  })

  const commission = totalRevenue * 0.4

  // Update DOM metrics
  if (el.metricTotalJobs) el.metricTotalJobs.textContent = jobs.length
  if (el.metricBwSheets) el.metricBwSheets.textContent = bwSheets
  if (el.metricColorSheets) el.metricColorSheets.textContent = colorSheets
  if (el.metricPartnerCommission) el.metricPartnerCommission.textContent = `৳${commission.toFixed(2)}`

  if (el.miniStatJobs) el.miniStatJobs.textContent = jobs.length
  if (el.miniStatPages) el.miniStatPages.textContent = bwSheets + colorSheets
  if (el.miniStatCommission) el.miniStatCommission.textContent = `৳${commission.toFixed(2)}`
}

// Fetch devices list for Station Selector
async function fetchDevices() {
  try {
    const res = await fetch(`${state.config.apiBaseUrl}/api/desktop/devices`)
    const data = await res.json()
    if (data?.devices && data.devices.length > 0) {
      el.stationSelect.innerHTML = data.devices
        .map((d) => `<option value="${d.id}">${d.name}</option>`)
        .join('')

      if (state.config.deviceId) {
        el.stationSelect.value = state.config.deviceId
      }
    }
  } catch (err) {
    console.warn('Could not fetch devices:', err)
  }
}

// Start application
window.addEventListener('DOMContentLoaded', init)
