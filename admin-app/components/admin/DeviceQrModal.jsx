'use client'

import { useState, useEffect, useRef } from 'react'
import QRCode from 'qrcode'
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
} from '@/components/ui/dialog'
import { Button } from '@/components/ui/button'
import { Copy, Check, Download, Printer, ExternalLink, QrCode } from 'lucide-react'

export default function DeviceQrModal({ isOpen, onClose, device }) {
  const [qrDataUrl, setQrDataUrl] = useState(null)
  const [copied, setCopied] = useState(false)
  const printRef = useRef(null)

  const printUrl = typeof window !== 'undefined'
    ? `${window.location.origin}/print?device=${device?.id}`
    : `https://quickink.app/print?device=${device?.id}`

  useEffect(() => {
    if (!device?.id) return

    QRCode.toDataURL(printUrl, {
      width: 400,
      margin: 2,
      color: {
        dark: '#000000',
        light: '#ffffff',
      },
    })
      .then((url) => setQrDataUrl(url))
      .catch((err) => console.error('QR code generation error:', err))
  }, [device?.id, printUrl])

  const handleCopyLink = () => {
    navigator.clipboard.writeText(printUrl)
    setCopied(true)
    setTimeout(() => setCopied(false), 2000)
  }

  const handleDownload = () => {
    if (!qrDataUrl) return
    const link = document.createElement('a')
    link.download = `QuickInk_Kiosk_QR_${device?.name?.replace(/[^a-zA-Z0-9]/g, '_') || 'Device'}.png`
    link.href = qrDataUrl
    link.click()
  }

  const handlePrintFlyer = () => {
    window.print()
  }

  if (!device) return null

  return (
    <Dialog open={isOpen} onOpenChange={onClose}>
      <DialogContent className="bg-[#0d131f] border border-slate-800 text-white max-w-md p-6 rounded-2xl shadow-2xl">
        <DialogHeader>
          <div className="w-10 h-10 rounded-xl bg-[#00bf63]/15 text-[#00bf63] flex items-center justify-center mb-2 border border-[#00bf63]/30">
            <QrCode className="w-5 h-5" />
          </div>
          <DialogTitle className="text-lg font-bold text-white">
            Kiosk Print Station QR Code
          </DialogTitle>
          <DialogDescription className="text-xs text-slate-400">
            Display this QR at <strong>{device.name}</strong>. Customers scan to upload and print in 60s.
          </DialogDescription>
        </DialogHeader>

        {/* Printable Card Area */}
        <div ref={printRef} className="bg-white text-slate-900 p-5 rounded-2xl text-center shadow-inner my-2">
          <div className="flex items-center justify-center gap-1.5 mb-2">
            <div className="w-6 h-6 rounded-lg bg-[#00bf63] text-slate-950 font-black text-xs flex items-center justify-center">
              Q
            </div>
            <span className="font-extrabold text-sm tracking-tight text-slate-900">QuickInk</span>
            <span className="text-[10px] font-bold px-1.5 py-0.2 rounded bg-slate-900 text-white uppercase">
              {device.type}
            </span>
          </div>

          <h3 className="text-sm font-black text-slate-950 mb-0.5">{device.name}</h3>
          <p className="text-[11px] text-slate-500 mb-3">
            {typeof device.location === 'object' ? device.location?.address : device.location || 'Dhaka'}
          </p>

          <div className="bg-slate-50 p-2.5 rounded-xl border border-slate-200 inline-block mb-3">
            {qrDataUrl ? (
              <img src={qrDataUrl} alt="Device QR Code" className="w-48 h-48 mx-auto" />
            ) : (
              <div className="w-48 h-48 flex items-center justify-center text-xs text-slate-400">
                Generating QR...
              </div>
            )}
          </div>

          <p className="text-xs font-bold text-slate-800">Scan with Phone Camera to Print</p>
          <p className="text-[10px] text-slate-400 mt-0.5">৳2/page • Instant B&W & Color Release</p>
        </div>

        {/* URL Box */}
        <div className="bg-slate-900 border border-slate-800 rounded-xl p-2.5 flex items-center justify-between text-xs">
          <span className="text-slate-400 truncate text-[11px] max-w-[260px]">{printUrl}</span>
          <Button
            size="sm"
            variant="ghost"
            onClick={handleCopyLink}
            className="h-7 text-xs text-[#00bf63] hover:text-white hover:bg-slate-800 px-2"
          >
            {copied ? <Check className="w-3.5 h-3.5 mr-1 text-emerald-400" /> : <Copy className="w-3.5 h-3.5 mr-1" />}
            {copied ? 'Copied' : 'Copy'}
          </Button>
        </div>

        {/* Action Buttons */}
        <div className="flex items-center gap-2 pt-2">
          <Button
            onClick={handleDownload}
            className="flex-1 bg-[#00bf63] hover:bg-[#00a656] text-slate-950 font-bold text-xs h-9 rounded-xl shadow-none"
          >
            <Download className="w-3.5 h-3.5 mr-1.5" /> Download PNG
          </Button>
          <Button
            variant="outline"
            onClick={onClose}
            className="border-slate-800 bg-slate-900 text-slate-300 hover:text-white text-xs h-9 rounded-xl"
          >
            Close
          </Button>
        </div>
      </DialogContent>
    </Dialog>
  )
}
