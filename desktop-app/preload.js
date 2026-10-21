const { contextBridge, ipcRenderer } = require('electron')

const desktopBridge = {
  // System Printers
  getPrinters: () => ipcRenderer.invoke('printers:get-all'),
  testPrint: (printerName, mode) => ipcRenderer.invoke('printers:print-test', { printerName, mode }),
  printJob: (options) => ipcRenderer.invoke('printers:print-job', options),

  // Configuration (Persisted locally on this PC)
  getConfig: () => ipcRenderer.invoke('config:get'),
  saveConfig: (config) => ipcRenderer.invoke('config:save', config),

  // Window & Kiosk controls
  minimize: () => ipcRenderer.invoke('window:minimize'),
  maximize: () => ipcRenderer.invoke('window:maximize'),
  close: () => ipcRenderer.invoke('window:close'),
  toggleKiosk: () => ipcRenderer.invoke('window:toggle-kiosk'),

  // Auto Updater & App Version
  getVersion: () => ipcRenderer.invoke('app:get-version'),
  checkForUpdates: () => ipcRenderer.invoke('updater:check'),
  restartForUpdate: () => ipcRenderer.invoke('updater:restart'),
  onUpdateStatus: (callback) => {
    const handler = (_event, data) => callback(data)
    ipcRenderer.on('updater:status', handler)
    return () => ipcRenderer.removeListener('updater:status', handler)
  },

  // Shell & External URL
  openExternal: (url) => ipcRenderer.invoke('shell:open-external', url),

  // PayStation Gateway Native IPC
  createPayStationSession: (options) => ipcRenderer.invoke('paystation:create-session', options),
  checkPayStationStatus: (options) => ipcRenderer.invoke('paystation:check-status', options),
  onPayStationCompleted: (callback) => {
    const handler = (_event, data) => callback(data)
    ipcRenderer.on('paystation:payment-completed', handler)
    return () => ipcRenderer.removeListener('paystation:payment-completed', handler)
  }
}

contextBridge.exposeInMainWorld('printkoroDesktop', desktopBridge)
contextBridge.exposeInMainWorld('quickinkDesktop', desktopBridge)
