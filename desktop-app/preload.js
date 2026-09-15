const { contextBridge, ipcRenderer } = require('electron')

contextBridge.exposeInMainWorld('quickinkDesktop', {
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
  toggleKiosk: () => ipcRenderer.invoke('window:toggle-kiosk')
})
