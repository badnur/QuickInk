// =============================================================================
// QuickInk Desktop POS & Kiosk Terminal — Client Logic
// Shop & Kiosk Registration, Mobile OTP Verification & Authentication
// =============================================================================

// Default Fallback Config & Session State
const state = {
  config: {
    deviceId: '',
    apiBaseUrl: 'http://localhost:3000',
    bwPrinterName: '',
    colorPrinterName: '',
    isKiosk: false
  },
  account: null, // Logged in shop owner profile
  regDraft: {
    type: 'shop',
    name: '',
    shop_name: '',
    phone: '',
    location: '',
    operating_hours: '09:00 AM - 10:00 PM',
    logo_url: '',
    shop_photo_url: '',
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

  // Header Account Profile
  headerAvatarImg: document.getElementById('header-avatar-img'),
  headerAvatarInitials: document.getElementById('header-avatar-initials'),
  headerShopName: document.getElementById('header-shop-name'),
  headerOwnerName: document.getElementById('header-owner-name'),
  btnAccountToggle: document.getElementById('btn-account-toggle'),
  btnAccountLabel: document.getElementById('btn-account-label'),

  // Auto-Updater UI
  updateBanner: document.getElementById('update-banner'),
  updateBannerIcon: document.getElementById('update-banner-icon'),
  updateBannerTitle: document.getElementById('update-banner-title'),
  updateBannerDesc: document.getElementById('update-banner-desc'),
  updateProgressContainer: document.getElementById('update-progress-container'),
  updateProgressFill: document.getElementById('update-progress-fill'),
  btnUpdateRestart: document.getElementById('btn-update-restart'),
  btnUpdateDismiss: document.getElementById('btn-update-dismiss'),
  appVersionTxt: document.getElementById('app-version-txt'),
  btnManualCheckUpdate: document.getElementById('btn-manual-check-update'),

  // Customer OTP Terminal
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

  // Hardware strip
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
  releaseBtnIcon: document.getElementById('release-btn-icon'),

  // Screen Views
  screenLogin: document.getElementById('screen-login'),
  screenRegister: document.getElementById('screen-register'),
  screenLockdown: document.getElementById('screen-lockdown'),
  screenWorkspace: document.getElementById('screen-workspace'),

  // Login Screen (Matching User Screenshot)
  formLogin: document.getElementById('form-login'),
  loginPhone: document.getElementById('login-phone'),
  loginPassword: document.getElementById('login-password'),
  loginStatusMsg: document.getElementById('login-status-msg'),
  btnSubmitLogin: document.getElementById('btn-submit-login'),
  loginBtnText: document.getElementById('login-btn-text'),
  btnToggleEye: document.getElementById('btn-toggle-eye'),
  eyeIconOpen: document.getElementById('eye-icon-open'),
  eyeIconClosed: document.getElementById('eye-icon-closed'),
  btnForgotPassword: document.getElementById('btn-forgot-password'),
  linkToRegister: document.getElementById('link-to-register'),
  linkToLogin: document.getElementById('link-to-login'),

  // Forgot Password Screen
  screenForgotPassword: document.getElementById('screen-forgot-password'),
  fpStep1: document.getElementById('fp-step-1'),
  fpStep2: document.getElementById('fp-step-2'),
  fpStep3: document.getElementById('fp-step-3'),
  fpStepSuccess: document.getElementById('fp-step-success'),
  fpPhone: document.getElementById('fp-phone'),
  fpStep1Status: document.getElementById('fp-step1-status'),
  fpStep2Status: document.getElementById('fp-step2-status'),
  fpStep3Status: document.getElementById('fp-step3-status'),
  btnFpSendOtp: document.getElementById('btn-fp-send-otp'),
  fpSendOtpText: document.getElementById('fp-send-otp-text'),
  fpOtpBoxes: Array.from(document.querySelectorAll('#fp-otp-boxes .otp-box')),
  btnFpVerifyOtp: document.getElementById('btn-fp-verify-otp'),
  fpVerifyOtpText: document.getElementById('fp-verify-otp-text'),
  btnFpResend: document.getElementById('btn-fp-resend'),
  fpOtpBack: document.getElementById('fp-otp-back'),
  fpOtpHint: document.getElementById('fp-otp-hint'),
  fpNewPassword: document.getElementById('fp-new-password'),
  fpConfirmPassword: document.getElementById('fp-confirm-password'),
  btnFpTogglePw: document.getElementById('btn-fp-toggle-pw'),
  fpEyeOpen: document.getElementById('fp-eye-open'),
  fpEyeClosed: document.getElementById('fp-eye-closed'),
  btnFpReset: document.getElementById('btn-fp-reset'),
  fpResetText: document.getElementById('fp-reset-text'),
  fpBackToLogin: document.getElementById('fp-back-to-login'),
  fpGoLogin: document.getElementById('fp-go-login'),

  // Administrative Lockdown Screen
  lockdownShopName: document.getElementById('lockdown-shop-name'),
  lockdownDeviceId: document.getElementById('lockdown-device-id'),
  lockdownReasonText: document.getElementById('lockdown-reason-text'),
  lockdownDateText: document.getElementById('lockdown-date-text'),
  btnLockdownCheckStatus: document.getElementById('btn-lockdown-check-status'),
  btnLockdownLogout: document.getElementById('btn-lockdown-logout'),

  // Application Pending Review Screen
  screenPending: document.getElementById('screen-pending'),
  pendingShopName: document.getElementById('pending-shop-name'),
  pendingOwnerName: document.getElementById('pending-owner-name'),
  pendingPhone: document.getElementById('pending-phone'),
  pendingType: document.getElementById('pending-type'),
  pendingHours: document.getElementById('pending-hours'),
  pendingLocation: document.getElementById('pending-location'),
  btnPendingCheckStatus: document.getElementById('btn-pending-check-status'),
  btnPendingLogout: document.getElementById('btn-pending-logout'),

  // Application Rejected Screen
  screenRejected: document.getElementById('screen-rejected'),
  rejectedShopName: document.getElementById('rejected-shop-name'),
  rejectedPhone: document.getElementById('rejected-phone'),
  rejectedReasonText: document.getElementById('rejected-reason-text'),
  btnReRegister: document.getElementById('btn-re-register'),
  btnRejectedLogout: document.getElementById('btn-rejected-logout'),

  // Stepper
  stepInd1: document.getElementById('step-ind-1'),
  stepInd2: document.getElementById('step-ind-2'),
  stepInd3: document.getElementById('step-ind-3'),
  stepLine1: document.getElementById('step-line-1'),
  stepLine2: document.getElementById('step-line-2'),

  // Step 1: Details
  regStep1: document.getElementById('reg-step-1'),
  labelModShop: document.getElementById('label-mod-shop'),
  labelModKiosk: document.getElementById('label-mod-kiosk'),
  regOwnerName: document.getElementById('reg-owner-name'),
  regShopName: document.getElementById('reg-shop-name'),
  regPhone: document.getElementById('reg-phone'),
  regOperatingHours: document.getElementById('reg-operating-hours'),
  regLocation: document.getElementById('reg-location'),
  regLogoInput: document.getElementById('reg-logo-input'),
  btnBrowseLogo: document.getElementById('btn-browse-logo'),
  logoPreviewImg: document.getElementById('logo-preview-img'),
  logoPreviewPlaceholder: document.getElementById('logo-preview-placeholder'),
  regPhotoInput: document.getElementById('reg-photo-input'),
  btnBrowsePhoto: document.getElementById('btn-browse-photo'),
  photoPreviewImg: document.getElementById('photo-preview-img'),
  photoPreviewPlaceholder: document.getElementById('photo-preview-placeholder'),
  regStep1StatusMsg: document.getElementById('reg-step1-status-msg'),
  btnToStep2: document.getElementById('btn-to-step-2'),

  // Step 2: OTP
  regStep2: document.getElementById('reg-step-2'),
  regTargetPhoneDisplay: document.getElementById('reg-target-phone-display'),
  authOtpBoxes: [
    document.getElementById('auth-otp-0'),
    document.getElementById('auth-otp-1'),
    document.getElementById('auth-otp-2'),
    document.getElementById('auth-otp-3'),
    document.getElementById('auth-otp-4'),
    document.getElementById('auth-otp-5'),
  ],
  regStep2StatusMsg: document.getElementById('reg-step2-status-msg'),
  btnBackToStep1: document.getElementById('btn-back-to-step-1'),
  btnResendMobileOtp: document.getElementById('btn-resend-mobile-otp'),
  btnVerifyMobileOtp: document.getElementById('btn-verify-mobile-otp'),

  // Step 3: Password
  regStep3: document.getElementById('reg-step-3'),
  regVerifiedPhoneTxt: document.getElementById('reg-verified-phone-txt'),
  regNewPassword: document.getElementById('reg-new-password'),
  regConfirmPassword: document.getElementById('reg-confirm-password'),
  regStep3StatusMsg: document.getElementById('reg-step3-status-msg'),
  btnFinishRegistration: document.getElementById('btn-finish-registration'),

  // Account Profile Modal
  accountModal: document.getElementById('account-modal'),
  btnCloseAccountModal: document.getElementById('btn-close-account-modal'),
  modalAccountShopName: document.getElementById('modal-account-shop-name'),
  modalAccountOwnerName: document.getElementById('modal-account-owner-name'),
  modalAccountType: document.getElementById('modal-account-type'),
  modalAccountLogoImg: document.getElementById('modal-account-logo-img'),
  modalAccountLogoInitials: document.getElementById('modal-account-logo-initials'),
  modalAccountPhotoWrap: document.getElementById('modal-account-photo-wrap'),
  modalAccountPhotoImg: document.getElementById('modal-account-photo-img'),
  modalAccountPhone: document.getElementById('modal-account-phone'),
  modalAccountAddress: document.getElementById('modal-account-address'),
  modalAccountDeviceId: document.getElementById('modal-account-device-id'),
  btnSwitchAccount: document.getElementById('btn-switch-account'),
  btnLogoutAccount: document.getElementById('btn-logout-account'),
}

// =============================================================================
// INITIALIZATION
// =============================================================================
async function init() {
  setupClock()
  setupTabNavigation()
  setupOtpKeypad()
  setupWindowControls()
  setupAuthSystem()
  setupAutoUpdaterClient()

  // Load configuration and native printers
  await loadAppConfig()
  await scanSystemPrinters()
  await fetchDevices()
  await fetchRecentJobs()

  // Load account and show correct screen (login, workspace, or lockdown)
  await loadSavedAccount()

  // Periodic heartbeat: check if admin approved, rejected, or suspended
  setInterval(() => {
    if (el.screenPending && !el.screenPending.classList.contains('hidden')) {
      checkApprovalStatus(false)
    } else if (el.screenWorkspace && !el.screenWorkspace.classList.contains('hidden')) {
      checkStationStatus()
    }
  }, 10000)

  // Auto-scan printers when window regains focus (only on workspace, not on login/register)
  window.addEventListener('focus', () => {
    const workspaceActive = el.screenWorkspace && !el.screenWorkspace.classList.contains('hidden')
    if (workspaceActive) {
      scanSystemPrinters()
    }
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
    el.btnWinMin?.addEventListener('click', () => window.quickinkDesktop.minimize())
    el.btnWinMax?.addEventListener('click', () => window.quickinkDesktop.maximize())
    el.btnWinClose?.addEventListener('click', () => window.quickinkDesktop.close())
    el.btnToggleKiosk?.addEventListener('click', () => window.quickinkDesktop.toggleKiosk())
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

// =============================================================================
// AUTO-UPDATER CLIENT
// =============================================================================
function setupAutoUpdaterClient() {
  // 1. Fetch & display app version
  if (isElectron && window.quickinkDesktop?.getVersion) {
    window.quickinkDesktop.getVersion().then((ver) => {
      if (ver && el.appVersionTxt) {
        el.appVersionTxt.textContent = `v${ver}`
      }
    }).catch(() => {})
  }

  // 2. Dismiss banner button
  el.btnUpdateDismiss?.addEventListener('click', () => {
    el.updateBanner?.classList.add('hidden')
  })

  // 3. Restart & Update button
  el.btnUpdateRestart?.addEventListener('click', () => {
    if (isElectron && window.quickinkDesktop?.restartForUpdate) {
      window.quickinkDesktop.restartForUpdate()
    }
  })

  // 4. Manual check button in profile modal
  el.btnManualCheckUpdate?.addEventListener('click', async () => {
    if (!isElectron || !window.quickinkDesktop?.checkForUpdates) {
      alert('Automatic updates are active in the installed desktop version.')
      return
    }
    el.btnManualCheckUpdate.disabled = true
    el.btnManualCheckUpdate.textContent = 'Checking...'
    try {
      const res = await window.quickinkDesktop.checkForUpdates()
      if (res.success) {
        if (el.updateBanner) el.updateBanner.classList.remove('hidden')
        if (el.updateBannerTitle) el.updateBannerTitle.textContent = 'QuickInk Updater'
        if (el.updateBannerDesc) el.updateBannerDesc.textContent = res.version ? `New version v${res.version} found! Downloading...` : 'Checking GitHub releases...'
      } else {
        alert(res.error || 'Could not reach update server. Check internet connection.')
      }
    } catch (e) {
      console.warn('Manual update check error:', e)
    } finally {
      setTimeout(() => {
        if (el.btnManualCheckUpdate) {
          el.btnManualCheckUpdate.disabled = false
          el.btnManualCheckUpdate.textContent = 'Check for Update'
        }
      }, 4000)
    }
  })

  // 5. Listen for updates from Electron main process
  if (isElectron && window.quickinkDesktop?.onUpdateStatus) {
    window.quickinkDesktop.onUpdateStatus((data) => {
      console.log('[Updater Client] Status received:', data)
      const { status } = data

      if (status === 'checking') {
        // Quiet check
      } else if (status === 'available') {
        el.updateBanner?.classList.remove('hidden')
        if (el.updateBannerTitle) el.updateBannerTitle.textContent = `Update v${data.version || ''} Available`
        if (el.updateBannerDesc) el.updateBannerDesc.textContent = 'Downloading update in background...'
        el.updateProgressContainer?.classList.remove('hidden')
        el.btnUpdateRestart?.classList.add('hidden')
      } else if (status === 'downloading') {
        el.updateBanner?.classList.remove('hidden')
        if (el.updateProgressContainer) el.updateProgressContainer.classList.remove('hidden')
        if (el.updateProgressFill) el.updateProgressFill.style.width = `${data.percent || 0}%`
        if (el.updateBannerDesc) el.updateBannerDesc.textContent = `Downloading update: ${data.percent || 0}%`
      } else if (status === 'downloaded') {
        el.updateBanner?.classList.remove('hidden')
        if (el.updateBannerTitle) el.updateBannerTitle.textContent = `Version ${data.version || ''} Ready`
        if (el.updateBannerDesc) el.updateBannerDesc.textContent = 'Update downloaded! Restart now to complete installation.'
        el.updateProgressContainer?.classList.add('hidden')
        el.btnUpdateRestart?.classList.remove('hidden')
        playSuccessChime()
      } else if (status === 'up-to-date') {
        // App is latest
      } else if (status === 'error') {
        console.warn('[Updater UI] Error notice:', data.error)
      }
    })
  }
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

  if (el.stationSelect) {
    el.stationSelect.addEventListener('change', async () => {
      state.config.deviceId = el.stationSelect.value
      if (isElectron) {
        await window.quickinkDesktop.saveConfig({ deviceId: state.config.deviceId })
      }
      fetchRecentJobs()
    })
  }
}

// Scan Installed System Printers via Electron IPC
async function scanSystemPrinters() {
  // Don't disrupt the user while they are typing in login or registration screens
  const activeEl = document.activeElement
  const isTypingInInput = activeEl && (activeEl.tagName === 'INPUT' || activeEl.tagName === 'TEXTAREA')
  if (isTypingInInput) return

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

  if (printers.length === 0) {
    el.selectBwPrinter.innerHTML = '<option value="">No printers detected on PC. Connect via USB or Wi-Fi</option>'
    el.selectColorPrinter.innerHTML = '<option value="">No printers detected on PC. Connect via USB or Wi-Fi</option>'
    el.stripBwName.textContent = 'None detected'
    el.stripColorName.textContent = 'None detected'
    const badge = document.getElementById('printers-badge-pill')
    if (badge) badge.textContent = '0 Detected'
    return
  }

  const isVirtual = (name) => /pdf|xps|onenote|fax/i.test(name)
  printers.sort((a, b) => {
    const aV = isVirtual(a.name) ? 1 : 0
    const bV = isVirtual(b.name) ? 1 : 0
    return aV - bV
  })

  state.systemPrinters = printers

  const badge = document.getElementById('printers-badge-pill')
  if (badge) badge.textContent = `${printers.length} Detected`

  el.selectBwPrinter.innerHTML = printers
    .map((p) => `<option value="${p.name}">${p.displayName || p.name} ${!isVirtual(p.name) ? '🖨️ (Hardware)' : ''}</option>`)
    .join('')

  el.selectColorPrinter.innerHTML = printers
    .map((p) => `<option value="${p.name}">${p.displayName || p.name} ${!isVirtual(p.name) ? '🎨 (Hardware)' : ''}</option>`)
    .join('')

  const physicalPrinters = printers.filter((p) => !isVirtual(p.name))
  const bestHardwarePrinter = physicalPrinters[0]?.name || printers[0]?.name || ''

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
  el.stripBwName.textContent = state.config.bwPrinterName || 'Not Selected'
  el.stripColorName.textContent = state.config.colorPrinterName || 'Not Selected'
}

// Test Print Actions
el.btnTestBw?.addEventListener('click', async () => {
  const printerName = el.selectBwPrinter.value
  if (!printerName) return alert('Please select a B&W printer first.')
  el.btnTestBw.textContent = 'Printing B&W Test...'

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
  if (!printerName) return alert('Please select a Color printer first.')
  el.btnTestColor.textContent = 'Printing Color Test...'

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
  el.otpBoxes.forEach((box, idx) => {
    box.addEventListener('input', (e) => {
      const val = e.target.value.replace(/[^0-9]/g, '')
      e.target.value = val

      if (val.length === 1) {
        box.classList.add('filled')
        if (idx < 5) el.otpBoxes[idx + 1].focus()
      } else {
        box.classList.remove('filled')
      }

      clearOtpStatus()
      if (getEnteredOtp().length === 6) verifyAndFetchJob()
    })

    box.addEventListener('keydown', (e) => {
      if (e.key === 'Backspace' && !box.value && idx > 0) {
        el.otpBoxes[idx - 1].focus()
      } else if (e.key === 'Enter' && getEnteredOtp().length === 6) {
        verifyAndFetchJob()
      }
    })
  })

  // Touch Numpad buttons
  el.numpadBtns.forEach((btn) => {
    btn.addEventListener('click', () => {
      const val = btn.getAttribute('data-val')
      const emptyBox = el.otpBoxes.find((b) => !b.value)
      if (emptyBox) {
        emptyBox.value = val
        emptyBox.classList.add('filled')
        const nextIdx = el.otpBoxes.indexOf(emptyBox) + 1
        if (nextIdx < 6) el.otpBoxes[nextIdx].focus()
      }
      clearOtpStatus()
      if (getEnteredOtp().length === 6) verifyAndFetchJob()
    })
  })

  el.btnClearOtp?.addEventListener('click', clearOtpInputs)
  el.btnBackspaceOtp?.addEventListener('click', () => {
    const filledBoxes = el.otpBoxes.filter((b) => b.value)
    if (filledBoxes.length > 0) {
      const last = filledBoxes[filledBoxes.length - 1]
      last.value = ''
      last.classList.remove('filled')
      last.focus()
    }
    clearOtpStatus()
  })

  el.btnVerifyOtp?.addEventListener('click', verifyAndFetchJob)
}

function getEnteredOtp() {
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

function showOtpStatus(msg, isError = false) {
  el.otpStatusMsg.textContent = msg
  el.otpStatusMsg.className = `status-msg-box ${isError ? 'error' : 'success'}`
}

function clearOtpStatus() {
  el.otpStatusMsg.textContent = ''
  el.otpStatusMsg.className = 'status-msg-box hidden'
}

// =============================================================================
// VERIFY & FETCH JOB DETAILS
// =============================================================================
async function verifyAndFetchJob() {
  const code = getEnteredOtp()
  if (code.length !== 6) {
    showOtpStatus('Please enter all 6 numerical digits', true)
    return
  }

  el.verifySpinner.classList.remove('hidden')
  el.verifyBtnText.textContent = 'Verifying with QuickInk Server...'
  el.btnVerifyOtp.disabled = true

  try {
    const res = await fetch(`${state.config.apiBaseUrl}/api/desktop/redeem`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        code,
        deviceId: state.config.deviceId
      })
    })

    const data = await res.json()

    if (!res.ok || !data.success) {
      throw new Error(data.error || 'Invalid OTP code')
    }

    state.activeJob = data
    openJobModal(data)
    playSuccessChime()
  } catch (err) {
    showOtpStatus(err.message, true)
  } finally {
    el.verifySpinner.classList.add('hidden')
    el.verifyBtnText.textContent = 'Verify & Fetch Print Job'
    el.btnVerifyOtp.disabled = false
  }
}

// =============================================================================
// JOB MODAL & DISPATCH TO HARDWARE
// =============================================================================
function openJobModal(jobData) {
  const job = jobData.print_job
  const isColor = job.color_mode === 'color'

  el.modalDocTitle.textContent = job.file_name || 'Customer_Document.pdf'
  el.modalOtp.textContent = jobData.otp?.code || getEnteredOtp()
  el.modalColorMode.textContent = isColor ? 'Full Color' : 'Black & White'
  el.modalPagesCopies.textContent = `${job.page_count} page(s) × ${job.copies} copy`
  el.modalDuplex.textContent = job.duplex === 'duplex' ? 'Double-Sided (Duplex)' : 'Single-Sided'

  const targetPrinter = isColor ? state.config.colorPrinterName : state.config.bwPrinterName
  el.modalRoutedPrinter.textContent = targetPrinter ? `${targetPrinter} (${isColor ? 'Color' : 'B&W'})` : 'Hardware default'

  if (job.payment_type === 'counter_cash' || job.payment_type === 'cash') {
    el.modalPaymentAlert.className = 'payment-alert cash'
    el.modalPayHeading.textContent = 'Collect Cash at Counter'
    el.modalPayInstruction.innerHTML = `Please collect <strong id="modal-pay-amount">৳${job.amount || 10.0}</strong> from customer before confirming print.`
  } else {
    el.modalPaymentAlert.className = 'payment-alert online'
    el.modalPayHeading.textContent = 'Payment Completed Online'
    el.modalPayInstruction.innerHTML = 'Customer paid digitally via bKash/Nagad/Card. You can release print directly.'
  }

  el.spoolingPanel.classList.add('hidden')
  el.btnReleasePrint.disabled = false
  el.jobModal.classList.remove('hidden')
}

el.btnCloseModal?.addEventListener('click', closeJobModal)
el.btnCancelJob?.addEventListener('click', closeJobModal)

function closeJobModal() {
  el.jobModal.classList.add('hidden')
  state.activeJob = null
  clearOtpInputs()
}

// Hardware Spooling Execution
el.btnReleasePrint?.addEventListener('click', async () => {
  if (!state.activeJob) return

  el.btnReleasePrint.disabled = true
  el.spoolingPanel.classList.remove('hidden')
  el.spoolingStepLabel.textContent = 'Downloading customer document from cloud...'
  el.spoolingPercentage.textContent = '25%'
  el.spoolingProgressBar.style.width = '25%'

  const job = state.activeJob.print_job
  const isColor = job.color_mode === 'color'
  const chosenPrinter = isColor ? state.config.colorPrinterName : state.config.bwPrinterName

  try {
    await new Promise((r) => setTimeout(r, 600))
    el.spoolingStepLabel.textContent = `Rendering pages & routing to ${chosenPrinter || 'hardware'}...`
    el.spoolingPercentage.textContent = '65%'
    el.spoolingProgressBar.style.width = '65%'

    if (isElectron) {
      const printResult = await window.quickinkDesktop.printJob({
        fileUrl: job.file_path,
        printerName: chosenPrinter,
        monochrome: !isColor,
        side: job.duplex === 'duplex' ? 'duplex' : 'simplex',
        copies: job.copies || 1,
        pageRange: job.page_range || null
      })

      if (!printResult.success) {
        throw new Error(printResult.error || 'Printer communication error')
      }
    }

    el.spoolingStepLabel.textContent = 'Sent to hardware spooler successfully!'
    el.spoolingPercentage.textContent = '100%'
    el.spoolingProgressBar.style.width = '100%'
    playSuccessChime()

    setTimeout(() => {
      closeJobModal()
      fetchRecentJobs()
    }, 1200)
  } catch (err) {
    alert(`Print Execution Notice: ${err.message}`)
    el.btnReleasePrint.disabled = false
  }
})

// =============================================================================
// RECENT JOBS & AUDIT LOGS
// =============================================================================
async function fetchRecentJobs() {
  try {
    const res = await fetch(`${state.config.apiBaseUrl}/api/desktop/jobs?deviceId=${state.config.deviceId}`)
    const data = await res.json()
    if (data?.jobs) {
      state.recentJobs = data.jobs
      renderJobsTable(data.jobs)
      computeStats(data.jobs)
    }
  } catch (err) {
    console.warn('Could not fetch jobs:', err)
  }
}

function renderJobsTable(jobs) {
  if (!el.jobsTableBody) return
  if (!jobs || jobs.length === 0) {
    el.jobsTableBody.innerHTML = '<tr><td colspan="9" class="empty-state">No print jobs processed yet today.</td></tr>'
    return
  }

  const query = (el.queueSearch?.value || '').toLowerCase().trim()
  const filtered = jobs.filter(
    (j) => !query || (j.otp_code && j.otp_code.includes(query)) || (j.file_name && j.file_name.toLowerCase().includes(query))
  )

  el.jobsTableBody.innerHTML = filtered
    .map((j) => {
      const isColor = j.color_mode === 'color'
      const timeStr = j.created_at ? new Date(j.created_at).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }) : '—'
      const amount = j.amount || (isColor ? (j.page_count || 1) * (j.copies || 1) * 8 : (j.page_count || 1) * (j.copies || 1) * 2)

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

// Compute daily revenue & 100% shop earnings (SaaS subscription model)
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

  // Under SaaS subscription model, shop owner keeps 100% of print revenue
  const shopEarnings = totalRevenue

  if (el.metricTotalJobs) el.metricTotalJobs.textContent = jobs.length
  if (el.metricBwSheets) el.metricBwSheets.textContent = bwSheets
  if (el.metricColorSheets) el.metricColorSheets.textContent = colorSheets
  if (el.metricPartnerCommission) el.metricPartnerCommission.textContent = `৳${shopEarnings.toFixed(2)}`

  if (el.miniStatJobs) el.miniStatJobs.textContent = jobs.length
  if (el.miniStatPages) el.miniStatPages.textContent = bwSheets + colorSheets
  if (el.miniStatCommission) el.miniStatCommission.textContent = `৳${shopEarnings.toFixed(2)}`
}

// Fetch devices list for Station Selector
async function fetchDevices() {
  if (!el.stationSelect) return
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

// =============================================================================
// SHOP & KIOSK REGISTRATION, OTP VERIFICATION & AUTHENTICATION SYSTEM
// =============================================================================
function setupAuthSystem() {
  // 1. Check if an account is already logged in
  loadSavedAccount()

  // 2. Header Account Chip Click
  el.btnAccountToggle?.addEventListener('click', () => {
    if (state.account) {
      openAccountProfileModal()
    } else {
      openAuthModal('signin')
    }
  })

  // 3. Close Auth Modal
  el.btnCloseAuthModal?.addEventListener('click', () => {
    el.authModal.classList.add('hidden')
  })

  // 4. Tab Switcher inside Auth Modal
  el.tabBtnSignin?.addEventListener('click', () => switchAuthTab('signin'))
  el.tabBtnSignup?.addEventListener('click', () => switchAuthTab('signup'))
  el.linkToRegister?.addEventListener('click', (e) => {
    e.preventDefault()
    switchAuthTab('signup')
  })

  // 5. Modality Options (Shop vs Kiosk)
  el.labelModShop?.addEventListener('click', () => {
    el.labelModShop.classList.add('active')
    el.labelModKiosk.classList.remove('active')
    state.regDraft.type = 'shop'
    if (el.regOperatingHours && (el.regOperatingHours.value === '24/7 Automated' || !el.regOperatingHours.value)) {
      el.regOperatingHours.value = '09:00 AM - 10:00 PM'
    }
  })
  el.labelModKiosk?.addEventListener('click', () => {
    el.labelModKiosk.classList.add('active')
    el.labelModShop.classList.remove('active')
    state.regDraft.type = 'kiosk'
    if (el.regOperatingHours && (el.regOperatingHours.value === '09:00 AM - 10:00 PM' || !el.regOperatingHours.value)) {
      el.regOperatingHours.value = '24/7 Automated'
    }
  })

  // 6. Media Pickers (Logo & Storefront Photo)
  el.btnBrowseLogo?.addEventListener('click', () => el.regLogoInput?.click())
  el.regLogoInput?.addEventListener('change', (e) => {
    const file = e.target.files[0]
    if (file) {
      const reader = new FileReader()
      reader.onload = (ev) => {
        state.regDraft.logo_url = ev.target.result
        el.logoPreviewImg.src = ev.target.result
        el.logoPreviewImg.classList.remove('hidden')
        el.logoPreviewPlaceholder.classList.add('hidden')
      }
      reader.readAsDataURL(file)
    }
  })

  el.btnBrowsePhoto?.addEventListener('click', () => el.regPhotoInput?.click())
  el.regPhotoInput?.addEventListener('change', (e) => {
    const file = e.target.files[0]
    if (file) {
      const reader = new FileReader()
      reader.onload = (ev) => {
        state.regDraft.shop_photo_url = ev.target.result
        el.photoPreviewImg.src = ev.target.result
        el.photoPreviewImg.classList.remove('hidden')
        el.photoPreviewPlaceholder.classList.add('hidden')
      }
      reader.readAsDataURL(file)
    }
  })

  // 7. Step 1 Submit & Send OTP
  el.btnToStep2?.addEventListener('click', handleSendMobileOtp)

  // 8. Step 2 OTP auto-advance & verification
  setupAuthOtpInputs()
  el.btnBackToStep1?.addEventListener('click', () => setRegStep(1))
  el.btnResendMobileOtp?.addEventListener('click', handleSendMobileOtp)
  el.btnVerifyMobileOtp?.addEventListener('click', handleVerifyMobileOtp)

  // 9. Step 3 Set Password & Finish
  el.btnFinishRegistration?.addEventListener('click', handleFinishRegistration)

  // 10. Login Screen (Screenshot design matching)
  el.formLogin?.addEventListener('submit', handleLoginSubmit)

  // Password visibility eye toggle
  el.btnToggleEye?.addEventListener('click', () => {
    if (!el.loginPassword) return
    const isPass = el.loginPassword.type === 'password'
    el.loginPassword.type = isPass ? 'text' : 'password'
    if (el.eyeIconOpen) el.eyeIconOpen.classList.toggle('hidden', isPass)
    if (el.eyeIconClosed) el.eyeIconClosed.classList.toggle('hidden', !isPass)
  })

  // Forgot password → launch the proper reset flow
  el.btnForgotPassword?.addEventListener('click', () => {
    showScreen('forgot-password')
    fpShowStep(1)
  })
  setupForgotPassword()

  // Switch between Login and Register screens
  el.linkToRegister?.addEventListener('click', () => {
    showScreen('register')
    setRegStep(1)
  })
  el.linkToLogin?.addEventListener('click', () => {
    showScreen('login')
  })

  // 11. Header Account Profile Badge in Workspace
  el.btnAccountToggle?.addEventListener('click', openAccountProfileModal)

  // 12. Account Details Modal controls
  el.btnCloseAccountModal?.addEventListener('click', () => el.accountModal?.classList.add('hidden'))
  el.btnSwitchAccount?.addEventListener('click', () => {
    el.accountModal?.classList.add('hidden')
    showScreen('register')
    setRegStep(1)
  })
  el.btnLogoutAccount?.addEventListener('click', handleLogout)

  // 13. Administrative Lockdown Screen buttons
  el.btnLockdownCheckStatus?.addEventListener('click', async () => {
    el.btnLockdownCheckStatus.disabled = true
    el.btnLockdownCheckStatus.textContent = 'Checking Status with Server...'
    try {
      const devId = el.lockdownDeviceId?.textContent?.trim() || state.config.deviceId
      const res = await fetch(`${state.config.apiBaseUrl}/api/desktop/auth?action=check-status&deviceId=${devId}`)
      const data = await res.json()

      if (!data.suspended) {
        alert('🎉 Partnership Reinstated!\n\nYour Quick Ink partnership is active. You may now sign in.')
        showScreen('login')
      } else {
        alert(`⚠️ Station is still suspended by administration.\n\nReason: ${data.reason || 'Pending operational review'}\n\nEmergency Phone: 01733398911\nEmail: help@quickink.net`)
      }
    } catch (e) {
      alert('Could not verify status with Quick Ink server. Please check your network connection.')
    } finally {
      el.btnLockdownCheckStatus.disabled = false
      el.btnLockdownCheckStatus.textContent = 'Check Status Again ⟳'
    }
  })

  el.btnLockdownLogout?.addEventListener('click', () => {
    showScreen('login')
  })

  // 14. Pending Approval Screen buttons
  el.btnPendingCheckStatus?.addEventListener('click', () => checkApprovalStatus(true))
  el.btnPendingLogout?.addEventListener('click', () => showScreen('login'))

  // 15. Rejected Screen buttons
  el.btnReRegister?.addEventListener('click', handleReRegister)
  el.btnRejectedLogout?.addEventListener('click', () => showScreen('login'))
}

// Show target screen (login, register, lockdown, pending, rejected, workspace)
function showScreen(screen) {
  if (el.screenLogin) el.screenLogin.classList.toggle('hidden', screen !== 'login')
  if (el.screenRegister) el.screenRegister.classList.toggle('hidden', screen !== 'register')
  if (el.screenForgotPassword) el.screenForgotPassword.classList.toggle('hidden', screen !== 'forgot-password')
  if (el.screenLockdown) el.screenLockdown.classList.toggle('hidden', screen !== 'lockdown')
  if (el.screenPending) el.screenPending.classList.toggle('hidden', screen !== 'pending')
  if (el.screenRejected) el.screenRejected.classList.toggle('hidden', screen !== 'rejected')
  if (el.screenWorkspace) el.screenWorkspace.classList.toggle('hidden', screen !== 'workspace')

  if (screen === 'login') {
    setTimeout(() => el.loginPhone?.focus(), 80)
  } else if (screen === 'workspace') {
    setTimeout(() => el.otpBoxes[0]?.focus(), 80)
  } else if (screen === 'forgot-password') {
    setTimeout(() => el.fpPhone?.focus(), 80)
  }
}

// =============================================================================
// FORGOT PASSWORD — 3-STEP OTP FLOW
// =============================================================================
let fpPhoneVerified = ''

function fpShowStep(step) {
  el.fpStep1?.classList.toggle('hidden', step !== 1)
  el.fpStep2?.classList.toggle('hidden', step !== 2)
  el.fpStep3?.classList.toggle('hidden', step !== 3)
  el.fpStepSuccess?.classList.toggle('hidden', step !== 4)
}

function fpSetStatus(el_, msg, isError = false) {
  if (!el_) return
  el_.textContent = msg
  el_.className = 'auth-status-alert ' + (isError ? 'error' : 'success')
  el_.classList.remove('hidden')
}
function fpClearStatus(el_) {
  if (!el_) return
  el_.classList.add('hidden')
  el_.textContent = ''
}

function setupForgotPassword() {
  // Back to login
  el.fpBackToLogin?.addEventListener('click', () => showScreen('login'))
  el.fpGoLogin?.addEventListener('click', () => {
    showScreen('login')
    fpPhoneVerified = ''
    if (el.fpPhone) el.fpPhone.value = ''
    if (el.fpNewPassword) el.fpNewPassword.value = ''
    if (el.fpConfirmPassword) el.fpConfirmPassword.value = ''
    el.fpOtpBoxes?.forEach(b => { b.value = '' })
    fpShowStep(1)
  })

  // STEP 1: Send OTP
  el.btnFpSendOtp?.addEventListener('click', async () => {
    const phone = el.fpPhone?.value?.trim()
    if (!phone || phone.replace(/[^0-9]/g, '').length < 10) {
      fpSetStatus(el.fpStep1Status, 'Please enter a valid 11-digit mobile number.', true)
      return
    }
    fpClearStatus(el.fpStep1Status)
    if (el.fpSendOtpText) el.fpSendOtpText.textContent = 'Sending Code...'
    if (el.btnFpSendOtp) el.btnFpSendOtp.disabled = true

    try {
      const res = await fetch(`${state.config.apiBaseUrl}/api/desktop/auth`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ action: 'reset-password-send-otp', phone }),
      })
      const data = await res.json()
      if (!res.ok || !data.success) throw new Error(data.error || 'Failed to send code')

      fpPhoneVerified = data.phone
      if (el.fpOtpHint) el.fpOtpHint.textContent = `A 6-digit code was sent to ${fpPhoneVerified}`
      el.fpOtpBoxes?.forEach(b => { b.value = '' })
      fpShowStep(2)
      setTimeout(() => el.fpOtpBoxes?.[0]?.focus(), 100)
    } catch (err) {
      fpSetStatus(el.fpStep1Status, err.message, true)
    } finally {
      if (el.fpSendOtpText) el.fpSendOtpText.textContent = 'Send Verification Code →'
      if (el.btnFpSendOtp) el.btnFpSendOtp.disabled = false
    }
  })

  // STEP 2: OTP box keyboard navigation
  el.fpOtpBoxes?.forEach((box, i) => {
    box.addEventListener('input', () => {
      box.value = box.value.replace(/[^0-9]/g, '').slice(-1)
      if (box.value && i < el.fpOtpBoxes.length - 1) el.fpOtpBoxes[i + 1].focus()
    })
    box.addEventListener('keydown', (e) => {
      if (e.key === 'Backspace' && !box.value && i > 0) el.fpOtpBoxes[i - 1].focus()
    })
    box.addEventListener('paste', (e) => {
      e.preventDefault()
      const digits = (e.clipboardData.getData('text') || '').replace(/[^0-9]/g, '')
      digits.split('').forEach((d, j) => { if (el.fpOtpBoxes[j]) el.fpOtpBoxes[j].value = d })
      const lastFilled = Math.min(digits.length, el.fpOtpBoxes.length - 1)
      el.fpOtpBoxes[lastFilled]?.focus()
    })
  })

  // Resend code
  el.btnFpResend?.addEventListener('click', async () => {
    fpClearStatus(el.fpStep2Status)
    el.btnFpResend.textContent = 'Sending...'
    el.btnFpResend.disabled = true
    try {
      const res = await fetch(`${state.config.apiBaseUrl}/api/desktop/auth`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ action: 'reset-password-send-otp', phone: fpPhoneVerified }),
      })
      const data = await res.json()
      if (!res.ok || !data.success) throw new Error(data.error || 'Failed to resend')
      fpSetStatus(el.fpStep2Status, 'New code sent! Check your SMS.', false)
      el.fpOtpBoxes?.forEach(b => { b.value = '' })
      el.fpOtpBoxes?.[0]?.focus()
    } catch (err) {
      fpSetStatus(el.fpStep2Status, err.message, true)
    } finally {
      el.btnFpResend.textContent = 'Resend Code'
      el.btnFpResend.disabled = false
    }
  })

  // Go back to step 1
  el.fpOtpBack?.addEventListener('click', () => {
    fpClearStatus(el.fpStep2Status)
    fpShowStep(1)
    setTimeout(() => el.fpPhone?.focus(), 80)
  })

  // Verify OTP
  el.btnFpVerifyOtp?.addEventListener('click', async () => {
    const otp = el.fpOtpBoxes?.map(b => b.value).join('')
    if (!otp || otp.length < 6) {
      fpSetStatus(el.fpStep2Status, 'Please enter the full 6-digit code.', true)
      return
    }
    fpClearStatus(el.fpStep2Status)
    if (el.fpVerifyOtpText) el.fpVerifyOtpText.textContent = 'Verifying...'
    if (el.btnFpVerifyOtp) el.btnFpVerifyOtp.disabled = true

    try {
      const res = await fetch(`${state.config.apiBaseUrl}/api/desktop/auth`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ action: 'reset-verify-otp', phone: fpPhoneVerified, otp }),
      })
      const data = await res.json()
      if (!res.ok || !data.success) throw new Error(data.error || 'Invalid or expired code')

      fpShowStep(3)
      setTimeout(() => el.fpNewPassword?.focus(), 80)
    } catch (err) {
      fpSetStatus(el.fpStep2Status, err.message, true)
    } finally {
      if (el.fpVerifyOtpText) el.fpVerifyOtpText.textContent = 'Verify Code →'
      if (el.btnFpVerifyOtp) el.btnFpVerifyOtp.disabled = false
    }
  })

  // STEP 3: Toggle password visibility
  el.btnFpTogglePw?.addEventListener('click', () => {
    if (!el.fpNewPassword) return
    const isPass = el.fpNewPassword.type === 'password'
    el.fpNewPassword.type = isPass ? 'text' : 'password'
    el.fpEyeOpen?.classList.toggle('hidden', isPass)
    el.fpEyeClosed?.classList.toggle('hidden', !isPass)
  })

  // Set new password
  el.btnFpReset?.addEventListener('click', async () => {
    const newPw = el.fpNewPassword?.value || ''
    const confirmPw = el.fpConfirmPassword?.value || ''
    if (newPw.length < 6) {
      fpSetStatus(el.fpStep3Status, 'Password must be at least 6 characters.', true)
      return
    }
    if (newPw !== confirmPw) {
      fpSetStatus(el.fpStep3Status, 'Passwords do not match.', true)
      return
    }
    fpClearStatus(el.fpStep3Status)
    if (el.fpResetText) el.fpResetText.textContent = 'Updating Password...'
    if (el.btnFpReset) el.btnFpReset.disabled = true

    try {
      const res = await fetch(`${state.config.apiBaseUrl}/api/desktop/auth`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ action: 'reset-password', phone: fpPhoneVerified, newPassword: newPw }),
      })
      const data = await res.json()
      if (!res.ok || !data.success) throw new Error(data.error || 'Failed to update password')

      fpShowStep(4) // Show success
    } catch (err) {
      fpSetStatus(el.fpStep3Status, err.message, true)
    } finally {
      if (el.fpResetText) el.fpResetText.textContent = 'Update Password →'
      if (el.btnFpReset) el.btnFpReset.disabled = false
    }
  })
}

// Display Pending Approval Screen
function showPendingScreen(acc) {
  if (acc) {
    state.account = acc
    localStorage.setItem('quickink_shop_account', JSON.stringify(acc))
    if (el.pendingShopName) el.pendingShopName.textContent = acc.shop_name || 'Quick Ink Station'
    if (el.pendingOwnerName) el.pendingOwnerName.textContent = acc.name || 'Partner Owner'
    if (el.pendingPhone) el.pendingPhone.textContent = acc.phone || '017XXXXXXXX'
    if (el.pendingType) el.pendingType.textContent = acc.type === 'kiosk' ? 'Automated Kiosk' : 'Partner Print Shop'
    if (el.pendingHours) el.pendingHours.textContent = acc.operating_hours || (acc.type === 'kiosk' ? '24/7 Automated' : '09:00 AM - 10:00 PM')
    if (el.pendingLocation) el.pendingLocation.textContent = acc.location || 'Location Address'
  }
  showScreen('pending')
}

// Display Rejected Application Screen
function showRejectedScreen(acc, reason) {
  const updated = { ...(acc || {}), status: 'rejected', rejection_reason: reason }
  state.account = updated
  localStorage.setItem('quickink_shop_account', JSON.stringify(updated))
  if (el.rejectedShopName) el.rejectedShopName.textContent = acc?.shop_name || 'Quick Ink Station'
  if (el.rejectedPhone) el.rejectedPhone.textContent = acc?.phone || '017XXXXXXXX'
  if (el.rejectedReasonText) {
    el.rejectedReasonText.textContent = reason || 'Your application could not be verified by administration. Please re-register with accurate details.'
  }
  showScreen('rejected')
}

// Re-Register Workflow: Clears Draft & Resets Form to Step 1
function handleReRegister() {
  state.account = null
  localStorage.removeItem('quickink_shop_account')
  state.regDraft = {
    type: 'shop',
    name: '',
    shop_name: '',
    phone: '',
    location: '',
    operating_hours: '09:00 AM - 10:00 PM',
    logo_url: '',
    shop_photo_url: '',
  }
  if (el.regOwnerName) el.regOwnerName.value = ''
  if (el.regShopName) el.regShopName.value = ''
  if (el.regPhone) el.regPhone.value = ''
  if (el.regOperatingHours) el.regOperatingHours.value = '09:00 AM - 10:00 PM'
  if (el.regLocation) el.regLocation.value = ''
  if (el.regNewPassword) el.regNewPassword.value = ''
  if (el.regConfirmPassword) el.regConfirmPassword.value = ''
  if (el.logoPreviewImg) {
    el.logoPreviewImg.src = ''
    el.logoPreviewImg.classList.add('hidden')
  }
  if (el.logoPreviewPlaceholder) el.logoPreviewPlaceholder.classList.remove('hidden')
  if (el.photoPreviewImg) {
    el.photoPreviewImg.src = ''
    el.photoPreviewImg.classList.add('hidden')
  }
  if (el.photoPreviewPlaceholder) el.photoPreviewPlaceholder.classList.remove('hidden')
  setRegStep(1)
  showScreen('register')
}

// Check Real-Time Approval / Rejection Status
async function checkApprovalStatus(isManual = false) {
  const phone = state.account?.phone || state.regDraft?.phone
  const devId = state.account?.deviceId || state.config.deviceId

  if (!phone && !devId) return

  if (isManual && el.btnPendingCheckStatus) {
    el.btnPendingCheckStatus.disabled = true
    el.btnPendingCheckStatus.textContent = 'Checking Status...'
  }

  try {
    const res = await fetch(`${state.config.apiBaseUrl}/api/desktop/auth?action=check-status&phone=${phone || ''}&deviceId=${devId || ''}`)
    if (!res.ok) throw new Error('Status query failed')
    const data = await res.json()

    if (data.approved) {
      if (state.account) {
        state.account.status = 'approved'
        if (data.deviceId) state.account.deviceId = data.deviceId
        localStorage.setItem('quickink_shop_account', JSON.stringify(state.account))
        updateHeaderProfile(state.account)
      }
      playSuccessChime()
      showScreen('workspace')
      alert('🎉 Application Approved!\n\nQuick Ink administration has verified your registration. Welcome to your terminal dashboard!')
      return
    }

    if (data.rejected) {
      showRejectedScreen(state.account, data.reason)
      return
    }

    if (isManual) {
      alert('⏳ Application Still Under Review\n\nYour application is being reviewed by Quick Ink administrators.\n\nFor emergency assistance or expedited verification, contact admin directly:\nEmergency Phone: 01733398911\nEmail: help@quickink.net')
    }
  } catch (err) {
    if (isManual) {
      alert('Could not verify status with Quick Ink server. Please check your network connection.')
    }
  } finally {
    if (isManual && el.btnPendingCheckStatus) {
      el.btnPendingCheckStatus.disabled = false
      el.btnPendingCheckStatus.textContent = 'Check Approval Status ⟳'
    }
  }
}

// Trigger Administrative Lockdown
function triggerSuspensionLockdown(shopName, deviceId, reason, date) {
  state.account = null
  localStorage.removeItem('quickink_shop_account')

  if (el.lockdownShopName) el.lockdownShopName.textContent = shopName || 'Quick Ink Station'
  if (el.lockdownDeviceId) el.lockdownDeviceId.textContent = deviceId || state.config.deviceId
  if (el.lockdownReasonText) {
    el.lockdownReasonText.textContent = reason || 'Partnership suspended by QuickInk administration due to compliance review or agreement termination.'
  }
  if (el.lockdownDateText) {
    el.lockdownDateText.textContent = date ? new Date(date).toLocaleString() : new Date().toLocaleString()
  }

  showScreen('lockdown')
}

// Heartbeat Station Status Check (Detects real-time admin cancellation)
async function checkStationStatus() {
  const devId = state.account?.deviceId || state.config.deviceId
  if (!devId) return

  try {
    const controller = new AbortController()
    const timer = setTimeout(() => controller.abort(), 2000)
    const res = await fetch(`${state.config.apiBaseUrl}/api/desktop/auth?action=check-status&deviceId=${devId}`, {
      signal: controller.signal
    }).catch(() => null)
    clearTimeout(timer)

    if (!res || !res.ok) return
    const data = await res.json()

    if (data && data.suspended) {
      triggerSuspensionLockdown(
        state.account?.shop_name || 'Quick Ink Station',
        devId,
        data.reason,
        data.suspended_at
      )
    } else if (state.account && el.screenLockdown && !el.screenLockdown.classList.contains('hidden')) {
      showScreen('workspace')
    }
  } catch (e) {
    // network note
  }
}

async function loadSavedAccount() {
  try {
    const stored = localStorage.getItem('quickink_shop_account')
    if (stored) {
      const acc = JSON.parse(stored)
      if (acc && acc.name && acc.phone) {
        state.account = acc

        if (acc.status === 'pending') {
          showPendingScreen(acc)
          await checkApprovalStatus(false)
          return
        }

        if (acc.status === 'rejected') {
          showRejectedScreen(acc, acc.rejection_reason)
          return
        }

        if (acc.deviceId) {
          state.config.deviceId = acc.deviceId
        }

        updateHeaderProfile(acc)

        // Check if admin suspended this account
        await checkStationStatus()
        if (!state.account) {
          // was suspended
          return
        }
        showScreen('workspace')
        return
      }
    }
  } catch (e) {
    console.warn('Error reading saved account:', e)
  }

  // If no account, show the clean login screen matching screenshot
  updateHeaderProfile(null)
  showScreen('login')
}

function updateHeaderProfile(account) {
  if (account) {
    if (el.headerShopName) el.headerShopName.textContent = account.shop_name || 'QuickInk Shop'
    if (el.headerOwnerName) el.headerOwnerName.textContent = account.name || 'Certified Owner'
    if (el.btnAccountLabel) el.btnAccountLabel.textContent = 'Station Profile'

    if (account.logo_url) {
      if (el.headerAvatarImg) {
        el.headerAvatarImg.src = account.logo_url
        el.headerAvatarImg.classList.remove('hidden')
      }
      if (el.headerAvatarInitials) el.headerAvatarInitials.classList.add('hidden')
    } else {
      const initials = (account.shop_name || 'QS')
        .split(' ')
        .map((w) => w[0])
        .slice(0, 2)
        .join('')
        .toUpperCase()
      if (el.headerAvatarInitials) {
        el.headerAvatarInitials.textContent = initials
        el.headerAvatarInitials.classList.remove('hidden')
      }
      if (el.headerAvatarImg) el.headerAvatarImg.classList.add('hidden')
    }
  } else {
    if (el.headerShopName) el.headerShopName.textContent = 'QuickInk Station'
    if (el.headerOwnerName) el.headerOwnerName.textContent = 'Not Signed In'
    if (el.btnAccountLabel) el.btnAccountLabel.textContent = 'Sign In / Register'
    if (el.headerAvatarInitials) {
      el.headerAvatarInitials.textContent = 'QI'
      el.headerAvatarInitials.classList.remove('hidden')
    }
    if (el.headerAvatarImg) el.headerAvatarImg.classList.add('hidden')
  }
}

// Stepper navigation for 3 steps
function setRegStep(step) {
  el.regStep1.classList.toggle('hidden', step !== 1)
  el.regStep2.classList.toggle('hidden', step !== 2)
  el.regStep3.classList.toggle('hidden', step !== 3)

  // Step 1 status
  el.stepInd1.className = `step-indicator ${step === 1 ? 'active' : step > 1 ? 'done' : ''}`
  el.stepLine1.className = `step-line ${step > 1 ? 'active' : ''}`

  // Step 2 status
  el.stepInd2.className = `step-indicator ${step === 2 ? 'active' : step > 2 ? 'done' : ''}`
  el.stepLine2.className = `step-line ${step > 2 ? 'active' : ''}`

  // Step 3 status
  el.stepInd3.className = `step-indicator ${step === 3 ? 'active' : ''}`

  if (step === 2) {
    el.authOtpBoxes[0]?.focus()
  } else if (step === 3) {
    el.regNewPassword?.focus()
  }
}

// Step 1: Send OTP to mobile
async function handleSendMobileOtp() {
  const name = el.regOwnerName.value.trim()
  const shop_name = el.regShopName.value.trim()
  const phone = el.regPhone.value.trim()
  const location = el.regLocation.value.trim()
  const operating_hours = el.regOperatingHours?.value.trim() || (state.regDraft.type === 'kiosk' ? '24/7 Automated' : '09:00 AM - 10:00 PM')

  if (!name || !shop_name || !phone || !location) {
    showRegMsg(el.regStep1StatusMsg, 'Please fill in all required fields (Owner Name, Shop Name, Phone, Location).', true)
    return
  }

  const cleanPhone = phone.replace(/[^0-9]/g, '')
  if (cleanPhone.length < 10) {
    showRegMsg(el.regStep1StatusMsg, 'Please enter a valid 11-digit mobile number.', true)
    return
  }

  hideRegMsg(el.regStep1StatusMsg)
  el.btnToStep2.disabled = true
  el.btnToStep2.textContent = 'Sending SMS Verification Code...'

  state.regDraft.name = name
  state.regDraft.shop_name = shop_name
  state.regDraft.phone = cleanPhone
  state.regDraft.location = location
  state.regDraft.operating_hours = operating_hours

  try {
    const controller = new AbortController()
    const timer = setTimeout(() => controller.abort(), 10000) // 10 second timeout

    const res = await fetch(`${state.config.apiBaseUrl}/api/desktop/auth`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        action: 'send-otp',
        phone: cleanPhone,
      }),
      signal: controller.signal,
    })
    clearTimeout(timer)

    const data = await res.json().catch(() => null)

    if (!res.ok || !data?.success) {
      showRegMsg(el.regStep1StatusMsg, data?.error || 'Failed to dispatch verification SMS. Please verify your phone number.', true)
      return
    }

    // Update Step 2 UI
    el.regTargetPhoneDisplay.textContent = `+880 ${cleanPhone.slice(-10)}`

    // Clear boxes & advance to Step 2
    el.authOtpBoxes.forEach((b) => (b.value = ''))
    setRegStep(2)
  } catch (e) {
    if (e.name === 'AbortError') {
      showRegMsg(el.regStep1StatusMsg, 'Request timed out. Please check your internet connection and try again.', true)
    } else {
      showRegMsg(el.regStep1StatusMsg, 'Unable to connect to QuickInk server. Please check your internet connection.', true)
    }
  } finally {
    el.btnToStep2.disabled = false
    el.btnToStep2.textContent = 'Verify Mobile via OTP →'
  }
}

function setupAuthOtpInputs() {
  el.authOtpBoxes.forEach((box, idx) => {
    box.addEventListener('input', (e) => {
      const val = e.target.value.replace(/[^0-9]/g, '')
      e.target.value = val
      if (val.length === 1 && idx < 5) {
        el.authOtpBoxes[idx + 1].focus()
      }
      hideRegMsg(el.regStep2StatusMsg)
    })

    box.addEventListener('keydown', (e) => {
      if (e.key === 'Backspace' && !box.value && idx > 0) {
        el.authOtpBoxes[idx - 1].focus()
      } else if (e.key === 'Enter') {
        handleVerifyMobileOtp()
      }
    })
  })
}

// Step 2: Verify Mobile OTP
async function handleVerifyMobileOtp() {
  const code = el.authOtpBoxes.map((b) => b.value).join('')
  if (code.length !== 6) {
    showRegMsg(el.regStep2StatusMsg, 'Please enter all 6 digits of the verification code.', true)
    return
  }

  el.btnVerifyMobileOtp.disabled = true
  el.btnVerifyMobileOtp.textContent = 'Verifying...'
  hideRegMsg(el.regStep2StatusMsg)

  try {
    const res = await fetch(`${state.config.apiBaseUrl}/api/desktop/auth`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        action: 'verify-otp',
        phone: state.regDraft.phone,
        otp: code,
      }),
    })

    const data = await res.json().catch(() => null)

    if (res.ok && data?.verified) {
      el.regVerifiedPhoneTxt.textContent = `+880 ${state.regDraft.phone.slice(-10)} (Verified)`
      setRegStep(3)
      return
    } else {
      showRegMsg(el.regStep2StatusMsg, data?.error || 'Invalid or expired verification code. Please check your SMS or request a new code.', true)
    }
  } catch (err) {
    showRegMsg(el.regStep2StatusMsg, 'Unable to connect to verification server. Please check your internet connection.', true)
  } finally {
    el.btnVerifyMobileOtp.disabled = false
    el.btnVerifyMobileOtp.textContent = 'Verify & Proceed →'
  }
}

// Step 3: Set Password & Complete Registration
async function handleFinishRegistration() {
  const pass = el.regNewPassword.value
  const confirm = el.regConfirmPassword.value

  if (!pass || pass.length < 6) {
    showRegMsg(el.regStep3StatusMsg, 'Password must be at least 6 characters long.', true)
    return
  }

  if (pass !== confirm) {
    showRegMsg(el.regStep3StatusMsg, 'Passwords do not match. Please re-enter.', true)
    return
  }

  hideRegMsg(el.regStep3StatusMsg)
  el.btnFinishRegistration.disabled = true
  el.btnFinishRegistration.textContent = 'Activating Station...'

  const payload = {
    action: 'register',
    name: state.regDraft.name,
    shop_name: state.regDraft.shop_name,
    phone: state.regDraft.phone,
    location: state.regDraft.location,
    operating_hours: state.regDraft.operating_hours,
    password: pass,
    type: state.regDraft.type,
    logo_url: state.regDraft.logo_url,
    shop_photo_url: state.regDraft.shop_photo_url,
  }

  try {
    const res = await fetch(`${state.config.apiBaseUrl}/api/desktop/auth`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(payload),
    })

    const data = await res.json().catch(() => null)

    if (res.ok && data?.account) {
      const account = data.account
      const device = data.device

      if (device?.id) {
        state.config.deviceId = device.id
        if (isElectron) {
          await window.quickinkDesktop.saveConfig({ deviceId: device.id })
        }
      }

      // Save state with status 'pending'
      showPendingScreen(account)
      playSuccessChime()
      alert(`📋 Registration Submitted!\n\nWelcome "${account.shop_name}". Your account has been submitted for administrator review.\n\nEmergency Contact: 01733398911\nSupport Email: help@quickink.net`)
      return
    }

    showRegMsg(el.regStep3StatusMsg, data?.error || 'Registration failed. Please check your information and try again.', true)
  } catch (err) {
    showRegMsg(el.regStep3StatusMsg, 'Network error. Could not connect to QuickInk registration service.', true)
  } finally {
    el.btnFinishRegistration.disabled = false
    el.btnFinishRegistration.textContent = 'Complete Registration & Submit for Approval'
  }
}

// Sign In Form Handler (Matching exact screenshot fields)
async function handleLoginSubmit(e) {
  e.preventDefault()
  const phone = el.loginPhone?.value?.trim() || ''
  const password = el.loginPassword?.value || ''

  if (!phone || !password) {
    showRegMsg(el.loginStatusMsg, 'Please enter mobile number and password.', true)
    return
  }

  if (el.btnSubmitLogin) el.btnSubmitLogin.disabled = true
  if (el.loginBtnText) el.loginBtnText.textContent = 'Verifying Credentials...'
  hideRegMsg(el.loginStatusMsg)

  try {
    const res = await fetch(`${state.config.apiBaseUrl}/api/desktop/auth`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        action: 'login',
        phone,
        password,
      })
    })

    const data = await res.json()

    // 1. Pending Approval Check
    if (res.status === 403 && data.pending) {
      showPendingScreen(data.account)
      return
    }

    // 2. Rejected Application Check
    if (res.status === 403 && data.rejected) {
      showRejectedScreen(data.account, data.reason)
      return
    }

    // 3. Administrative Suspension / Partnership Revocation Check
    if (res.status === 403 && data.suspended) {
      triggerSuspensionLockdown(
        data.shop_name || 'Station',
        data.deviceId || state.config.deviceId,
        data.reason,
        data.suspended_at
      )
      return
    }

    if (!res.ok) {
      throw new Error(data.error || 'Invalid credentials')
    }

    const account = data.account
    state.account = account
    localStorage.setItem('quickink_shop_account', JSON.stringify(account))

    if (data.deviceId) {
      state.config.deviceId = data.deviceId
      if (isElectron) {
        await window.quickinkDesktop.saveConfig({ deviceId: data.deviceId })
      }
    }

    updateHeaderProfile(account)
    fetchDevices()
    fetchRecentJobs()
    showScreen('workspace')
    playSuccessChime()
  } catch (err) {
    showRegMsg(el.loginStatusMsg, err.message || 'Login failed. Check mobile and password.', true)
  } finally {
    if (el.btnSubmitLogin) el.btnSubmitLogin.disabled = false
    if (el.loginBtnText) el.loginBtnText.textContent = 'Sign In →'
  }
}

// Open Account Details Modal
function openAccountProfileModal() {
  const acc = state.account
  if (!acc) return

  if (el.modalAccountShopName) el.modalAccountShopName.textContent = acc.shop_name || 'QuickInk Shop'
  if (el.modalAccountOwnerName) el.modalAccountOwnerName.textContent = acc.name || 'Certified Owner'
  if (el.modalAccountType) el.modalAccountType.textContent = acc.type === 'kiosk' ? 'Automated Kiosk' : 'Partner Print Shop'
  if (el.modalAccountPhone) el.modalAccountPhone.textContent = acc.phone || '017XXXXXXXX'
  if (el.modalAccountAddress) el.modalAccountAddress.textContent = acc.location || 'Configured Address'
  if (el.modalAccountDeviceId) el.modalAccountDeviceId.textContent = acc.deviceId || state.config.deviceId

  // Logo
  if (acc.logo_url) {
    if (el.modalAccountLogoImg) {
      el.modalAccountLogoImg.src = acc.logo_url
      el.modalAccountLogoImg.classList.remove('hidden')
    }
    if (el.modalAccountLogoInitials) el.modalAccountLogoInitials.classList.add('hidden')
  } else {
    if (el.modalAccountLogoImg) el.modalAccountLogoImg.classList.add('hidden')
    if (el.modalAccountLogoInitials) {
      el.modalAccountLogoInitials.classList.remove('hidden')
      el.modalAccountLogoInitials.textContent = (acc.shop_name || 'QS').slice(0, 2).toUpperCase()
    }
  }

  // Storefront Photo
  if (acc.shop_photo_url) {
    if (el.modalAccountPhotoImg) el.modalAccountPhotoImg.src = acc.shop_photo_url
    if (el.modalAccountPhotoWrap) el.modalAccountPhotoWrap.classList.remove('hidden')
  } else {
    if (el.modalAccountPhotoWrap) el.modalAccountPhotoWrap.classList.add('hidden')
  }

  el.accountModal?.classList.remove('hidden')
}

// Log Out Handler
function handleLogout() {
  if (!confirm('Log out from this terminal? You will need to sign in with your mobile number and password.')) return

  state.account = null
  localStorage.removeItem('quickink_shop_account')
  updateHeaderProfile(null)
  el.accountModal?.classList.add('hidden')
  showScreen('login')
}

function showRegMsg(elem, msg, isError = false) {
  if (!elem) return
  elem.textContent = msg
  elem.className = `status-msg-box ${isError ? 'error' : 'success'}`
}

function hideRegMsg(elem) {
  if (!elem) return
  elem.textContent = ''
  elem.className = 'status-msg-box hidden'
}

// Start application
window.addEventListener('DOMContentLoaded', init)
