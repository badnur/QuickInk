'use client'

import { useState, useEffect, useRef, Suspense } from 'react'
import Link from 'next/link'
import { useSearchParams } from 'next/navigation'
import QRCode from 'qrcode'
import { supabase } from '@/lib/supabase'
import DocumentScannerModal from '@/components/scanner/DocumentScannerModal'
import { Button } from '@/components/ui/button'
import { Card, CardContent } from '@/components/ui/card'
import { Badge } from '@/components/ui/badge'
import { Input } from '@/components/ui/input'
import {
  Upload,
  Camera,
  FileText,
  Printer,
  Sparkles,
  CheckCircle2,
  AlertCircle,
  Copy,
  Check,
  MapPin,
  Clock,
  ArrowRight,
  RefreshCw,
  CreditCard,
  Banknote,
  ShieldCheck,
  ChevronRight,
  ChevronLeft,
  Sliders,
  Layers,
  Zap,
  Award,
  Shield,
  Eye,
  FileCheck
} from 'lucide-react'

// Helper to parse page range expressions like "1, 3, 5-8"
function parsePageRange(rangeStr, totalPages) {
  if (!rangeStr || rangeStr.trim() === '') return totalPages
  const parts = rangeStr.split(',')
  const pages = new Set()
  for (const part of parts) {
    const trimmed = part.trim()
    if (trimmed.includes('-')) {
      const [startStr, endStr] = trimmed.split('-')
      const start = parseInt(startStr)
      const end = parseInt(endStr)
      if (!isNaN(start) && !isNaN(end)) {
        for (let i = Math.max(1, start); i <= Math.min(totalPages, end); i++) {
          pages.add(i)
        }
      }
    } else {
      const num = parseInt(trimmed)
      if (!isNaN(num) && num >= 1 && num <= totalPages) {
        pages.add(num)
      }
    }
  }
  return pages.size > 0 ? pages.size : totalPages
}

export default function PrintOrderPage({ initialDeviceId = null }) {
  return (
    <Suspense fallback={<div className="min-h-screen flex items-center justify-center text-gray-500">Loading QuickInk Print Station...</div>}>
      <PrintOrderPageContent initialDeviceId={initialDeviceId} />
    </Suspense>
  )
}

function PrintOrderPageContent({ initialDeviceId }) {
  const searchParams = useSearchParams()
  const activeDeviceId = initialDeviceId || searchParams.get('device')

  // Target device/kiosk info
  const [deviceInfo, setDeviceInfo] = useState(null)
  const [loadingDevice, setLoadingDevice] = useState(false)

  // Wizard Step: 1 = Upload, 2 = Preview & Range, 3 = Options, 4 = Ticket
  const [step, setStep] = useState(1)

  // Document state
  const [selectedFile, setSelectedFile] = useState(null)
  const [filePreviewUrl, setFilePreviewUrl] = useState(null)
  const [isScannerOpen, setIsScannerOpen] = useState(false)
  const [previewPageIndex, setPreviewPageIndex] = useState(1)

  // Print settings
  const [totalPages, setTotalPages] = useState(1)
  const [pageRangeMode, setPageRangeMode] = useState('all') // 'all' | 'custom'
  const [customRangeStr, setCustomRangeStr] = useState('')
  const [pagesPerSheet, setPagesPerSheet] = useState(1) // 1, 2, or 4
  const [colorMode, setColorMode] = useState('bw') // 'bw' | 'color'
  const [copies, setCopies] = useState(1)
  const [duplex, setDuplex] = useState(false)

  // Payment & Order state
  const [paymentMethod, setPaymentMethod] = useState('online') // 'online' | 'cash'
  const [isSubmitting, setIsSubmitting] = useState(false)
  const [submitError, setSubmitError] = useState(null)

  // Generated Ticket state
  const [ticketOrder, setTicketOrder] = useState(null)
  const [ticketOtp, setTicketOtp] = useState(null)
  const [qrCodeDataUrl, setQrCodeDataUrl] = useState('')
  const [copied, setCopied] = useState(false)
  const [timeLeft, setTimeLeft] = useState(3600)
  const [liveStatus, setLiveStatus] = useState('awaiting_redemption')

  const fileInputRef = useRef(null)

  // Pricing constants (in BDT ৳)
  const PRICE_BW = 2.0
  const PRICE_COLOR = 8.0
  const unitPrice = colorMode === 'color' ? PRICE_COLOR : PRICE_BW

  // Calculate effective printed sheets based on range and multi-page layout
  const selectedPagesCount = pageRangeMode === 'all' ? totalPages : parsePageRange(customRangeStr, totalPages)
  const calculatedSheets = Math.ceil(selectedPagesCount / pagesPerSheet)
  const totalPrice = (calculatedSheets * unitPrice * copies).toFixed(2)

  // Fetch device details if visiting via kiosk QR code (?device=UUID)
  useEffect(() => {
    if (!activeDeviceId) return

    async function fetchDevice() {
      setLoadingDevice(true)
      try {
        const { data, error } = await supabase
          .from('devices')
          .select('*')
          .eq('id', activeDeviceId)
          .single()

        if (!error && data) {
          setDeviceInfo(data)
          // If kiosk terminal, force online payment (kiosk doesn't take cash)
          if (data.type === 'kiosk') {
            setPaymentMethod('online')
          }
        }
      } catch (err) {
        console.warn('Could not fetch device details:', err)
      } finally {
        setLoadingDevice(false)
      }
    }
    fetchDevice()
  }, [activeDeviceId])

  // Countdown timer for active ticket
  useEffect(() => {
    if (step !== 4 || !ticketOtp) return

    const timer = setInterval(() => {
      setTimeLeft((prev) => (prev <= 1 ? 0 : prev - 1))
    }, 1000)

    return () => clearInterval(timer)
  }, [step, ticketOtp])

  // Supabase Realtime subscription for print job status changes
  useEffect(() => {
    if (!ticketOrder?.id) return

    const channel = supabase
      .channel(`print_job_${ticketOrder.id}`)
      .on(
        'postgres_changes',
        {
          event: 'UPDATE',
          schema: 'public',
          table: 'print_jobs',
          filter: `id=eq.${ticketOrder.id}`,
        },
        (payload) => {
          if (payload.new?.status) {
            setLiveStatus(payload.new.status)
          }
        }
      )
      .subscribe()

    return () => {
      supabase.removeChannel(channel)
    }
  }, [ticketOrder?.id])

  // Generate QR Code when ticket is ready
  useEffect(() => {
    if (ticketOtp?.code) {
      QRCode.toDataURL(ticketOtp.code, {
        width: 260,
        margin: 2,
        color: {
          dark: '#1e1b4b',
          light: '#ffffff',
        },
      })
        .then((url) => setQrCodeDataUrl(url))
        .catch((err) => console.error('QR code generation error:', err))
    }
  }, [ticketOtp])

  // Handle standard file selection
  const handleFileChange = (e) => {
    const file = e.target.files?.[0]
    if (!file) return

    setSelectedFile(file)
    setSubmitError(null)
    setTotalPages(1)
    setPreviewPageIndex(1)

    if (file.type.startsWith('image/')) {
      const url = URL.createObjectURL(file)
      setFilePreviewUrl(url)
    } else {
      setFilePreviewUrl(null)
    }

    setStep(2)
  }

  // Handle scanner completion
  const handleScannerComplete = ({ file, pageCount: scannedPages, previewUrl }) => {
    setSelectedFile(file)
    setTotalPages(scannedPages)
    setFilePreviewUrl(previewUrl)
    setSubmitError(null)
    setPreviewPageIndex(1)
    setStep(2)
  }

  // Copy OTP Code to clipboard
  const handleCopyOtp = () => {
    if (!ticketOtp?.code) return
    navigator.clipboard.writeText(ticketOtp.code)
    setCopied(true)
    setTimeout(() => setCopied(false), 2000)
  }

  // Submit and create order
  const handleCreateOrder = async () => {
    if (!selectedFile) {
      setSubmitError('Please select or scan a document first.')
      return
    }

    setIsSubmitting(true)
    setSubmitError(null)

    try {
      const fileExt = selectedFile.name.split('.').pop() || 'pdf'
      const cleanFileName = selectedFile.name.replace(/[^a-zA-Z0-9.-]/g, '_')
      const storagePath = `jobs/${Date.now()}_${cleanFileName}`

      // Upload document file to Supabase Storage
      const { error: uploadError } = await supabase.storage
        .from('print-files')
        .upload(storagePath, selectedFile, {
          contentType: selectedFile.type || 'application/pdf',
          upsert: true,
        })

      if (uploadError) {
        console.warn('Storage upload notice (continuing with relative path):', uploadError.message)
      }

      // Call order creation route
      const response = await fetch('/api/print-jobs', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          file_path: storagePath,
          file_type: fileExt,
          file_name: selectedFile.name,
          copies,
          color_mode: colorMode,
          duplex,
          page_count: calculatedSheets,
          payment_type: paymentMethod,
          amount: parseFloat(totalPrice),
        }),
      })

      const data = await response.json()

      if (!response.ok) {
        throw new Error(data.error || 'Failed to submit print job')
      }

      setTicketOrder(data.order)
      setTicketOtp(data.otp)
      setLiveStatus(data.order.status || 'awaiting_redemption')
      setTimeLeft(3600)
      setStep(4)
    } catch (err) {
      console.error('Order creation error:', err)
      setSubmitError(err.message || 'An unexpected error occurred while placing order')
    } finally {
      setIsSubmitting(false)
    }
  }

  const formatTime = (seconds) => {
    const mins = Math.floor(seconds / 60)
    const secs = seconds % 60
    return `${mins.toString().padStart(2, '0')}:${secs.toString().padStart(2, '0')}`
  }

  return (
    <div className="min-h-screen bg-slate-100/70 pt-24 pb-20">
      <div className="container mx-auto px-4 sm:px-6 max-w-lg sm:max-w-xl">

        {/* ========================================================================= */}
        {/* SHOP / KIOSK HEADER (Inspired by QR Se Print) */}
        {/* ========================================================================= */}
        <div className="bg-gradient-to-br from-slate-900 via-gray-900 to-indigo-950 text-white rounded-3xl p-5 mb-5 shadow-xl relative overflow-hidden border border-gray-800">
          <div className="absolute top-0 right-0 w-36 h-36 bg-blue-500/10 rounded-full blur-2xl pointer-events-none"></div>

          <div className="flex items-center gap-4 relative z-10">
            <div className="w-14 h-14 rounded-2xl bg-white flex items-center justify-center text-3xl shadow-lg flex-shrink-0 text-slate-900">
              🖨️
            </div>
            <div className="min-w-0 flex-1">
              <div className="flex items-center gap-1.5 flex-wrap">
                <h2 className="font-bold text-lg text-white truncate">
                  {deviceInfo ? deviceInfo.name : 'QuickInk Smart Print Hub'}
                </h2>
                <span className="w-4 h-4 rounded-full bg-blue-500 text-white text-[10px] font-bold flex items-center justify-center">
                  ✓
                </span>
              </div>
              <p className="text-xs text-gray-400 truncate mt-0.5">
                {deviceInfo?.location?.address || 'Instant Self-Service Kiosks & Partner Shops'}
              </p>
              <div className="flex items-center gap-2 mt-2">
                <span className="bg-white/10 text-white border border-white/10 text-[11px] font-semibold px-2.5 py-0.5 rounded-full backdrop-blur-sm">
                  B&W: ৳{PRICE_BW}/page
                </span>
                <span className="bg-gradient-to-r from-purple-500 to-pink-500 text-white text-[11px] font-semibold px-2.5 py-0.5 rounded-full shadow-sm">
                  Color: ৳{PRICE_COLOR}/page
                </span>
              </div>
            </div>
          </div>
        </div>

        {/* ========================================================================= */}
        {/* STEP PROGRESS BAR */}
        {/* ========================================================================= */}
        <div className="flex items-center justify-between px-2 mb-6">
          {[
            { num: 1, label: 'Upload' },
            { num: 2, label: 'Preview' },
            { num: 3, label: 'Options' },
            { num: 4, label: 'Ticket' },
          ].map((s, idx, arr) => {
            const isDone = step > s.num
            const isActive = step === s.num
            return (
              <div key={s.num} className="flex-1 flex flex-col items-center relative">
                {idx < arr.length - 1 && (
                  <div
                    className={`absolute top-4 left-1/2 w-full h-[2px] -z-0 transition-colors duration-300 ${
                      step > s.num ? 'bg-blue-600' : 'bg-gray-200'
                    }`}
                  />
                )}
                <div
                  className={`w-8 h-8 rounded-full flex items-center justify-center text-xs font-bold transition-all z-10 ${
                    isActive
                      ? 'bg-gradient-to-r from-blue-600 to-indigo-600 text-white shadow-md ring-4 ring-blue-100 scale-110'
                      : isDone
                      ? 'bg-blue-600 text-white'
                      : 'bg-white text-gray-400 border border-gray-300'
                  }`}
                >
                  {isDone ? '✓' : s.num}
                </div>
                <span className={`text-[11px] font-semibold mt-1.5 ${isActive ? 'text-blue-600' : 'text-gray-500'}`}>
                  {s.label}
                </span>
              </div>
            )
          })}
        </div>

        {/* ========================================================================= */}
        {/* STEP 1: UPLOAD & CAMSCANNER */}
        {/* ========================================================================= */}
        {step === 1 && (
          <div className="space-y-4 animate-in fade-in duration-300">
            {/* CamScanner Mode Card */}
            <Card
              onClick={() => setIsScannerOpen(true)}
              className="border-2 border-blue-500/30 hover:border-blue-600 hover:shadow-xl transition-all cursor-pointer bg-white rounded-3xl overflow-hidden group"
            >
              <CardContent className="p-6 text-center flex flex-col items-center">
                <div className="w-16 h-16 rounded-2xl bg-blue-50 text-blue-600 flex items-center justify-center mb-3 group-hover:scale-110 group-hover:bg-blue-600 group-hover:text-white transition-all shadow-sm">
                  <Camera className="h-8 w-8" />
                </div>
                <div className="inline-flex items-center gap-1 text-[11px] font-bold text-blue-600 bg-blue-50 px-2.5 py-0.5 rounded-full mb-1">
                  <Sparkles className="h-3 w-3" /> CamScanner Mode
                </div>
                <h3 className="text-xl font-extrabold text-gray-900 mb-1">Scan with Camera</h3>
                <p className="text-xs text-gray-500 max-w-xs mb-4">
                  Snap photos of notes, assignments, forms, or IDs with auto-clean enhancement filters.
                </p>
                <Button className="bg-gradient-to-r from-blue-600 to-indigo-600 hover:from-blue-700 hover:to-indigo-700 text-white rounded-xl text-sm font-bold shadow-md">
                  Open Camera Scanner <ArrowRight className="ml-1.5 h-4 w-4" />
                </Button>
              </CardContent>
            </Card>

            {/* Upload File Box */}
            <Card
              onClick={() => fileInputRef.current?.click()}
              className="border-2 border-dashed border-gray-300 hover:border-indigo-500 hover:bg-indigo-50/20 transition-all cursor-pointer bg-white rounded-3xl text-center"
            >
              <CardContent className="p-8 flex flex-col items-center">
                <input
                  ref={fileInputRef}
                  type="file"
                  accept=".pdf,.doc,.docx,.jpg,.jpeg,.png"
                  onChange={handleFileChange}
                  className="hidden"
                />
                <div className="w-14 h-14 rounded-2xl bg-indigo-50 text-indigo-600 flex items-center justify-center mb-3">
                  <Upload className="h-7 w-7" />
                </div>
                <h3 className="text-lg font-bold text-gray-900 mb-1">Or Upload Existing File</h3>
                <p className="text-xs text-gray-500 mb-3">PDF, Word, JPG, PNG supported</p>
                <span className="inline-flex items-center gap-1.5 bg-gray-100 text-gray-800 text-xs font-semibold px-4 py-2 rounded-xl border border-gray-200">
                  Browse Device Files <ChevronRight className="h-3.5 w-3.5" />
                </span>
              </CardContent>
            </Card>

            {/* Trust Row (from QR Se Print inspiration) */}
            <div className="bg-white rounded-2xl p-3 border border-gray-200 shadow-sm flex items-center justify-between text-center divide-x divide-gray-100">
              <div className="flex-1 px-2">
                <div className="text-base mb-0.5">🛡️</div>
                <b className="text-[11px] text-gray-900 block font-bold">100% Secure</b>
                <span className="text-[10px] text-gray-500 block">Auto-deleted</span>
              </div>
              <div className="flex-1 px-2">
                <div className="text-base mb-0.5">⚡</div>
                <b className="text-[11px] text-gray-900 block font-bold">60s Speed</b>
                <span className="text-[10px] text-gray-500 block">Instant print</span>
              </div>
              <div className="flex-1 px-2">
                <div className="text-base mb-0.5">🏅</div>
                <b className="text-[11px] text-gray-900 block font-bold">Laser Print</b>
                <span className="text-[10px] text-gray-500 block">Sharp & clear</span>
              </div>
            </div>
          </div>
        )}

        {/* ========================================================================= */}
        {/* STEP 2: PREVIEW & PAGE RANGE */}
        {/* ========================================================================= */}
        {step === 2 && selectedFile && (
          <div className="space-y-4 animate-in fade-in duration-300">
            <Card className="bg-white border border-gray-200 rounded-3xl shadow-sm overflow-hidden">
              <CardContent className="p-5">
                <div className="flex items-center justify-between mb-4">
                  <div className="flex items-center gap-3">
                    <div className="p-2.5 bg-blue-50 text-blue-600 rounded-xl">
                      <FileCheck className="h-6 w-6" />
                    </div>
                    <div>
                      <h4 className="font-bold text-gray-900 text-sm truncate max-w-[200px] sm:max-w-xs">
                        {selectedFile.name}
                      </h4>
                      <p className="text-xs text-gray-500">
                        {totalPages} {totalPages === 1 ? 'Page' : 'Pages'} • {(selectedFile.size / 1024).toFixed(1)} KB
                      </p>
                    </div>
                  </div>
                  <Button
                    variant="ghost"
                    size="sm"
                    onClick={() => {
                      setSelectedFile(null)
                      setStep(1)
                    }}
                    className="text-xs text-gray-500 hover:text-red-600"
                  >
                    Change
                  </Button>
                </div>

                {/* Visual Preview Box */}
                <div className="bg-slate-50 border border-gray-200 rounded-2xl p-4 flex flex-col items-center justify-center min-h-[220px] mb-4">
                  {filePreviewUrl ? (
                    <img
                      src={filePreviewUrl}
                      alt="Scanned Document Preview"
                      className="max-h-56 max-w-full rounded-lg shadow-md object-contain border"
                    />
                  ) : (
                    <div className="text-center py-6">
                      <FileText className="h-16 w-16 text-blue-500/70 mx-auto mb-2" />
                      <p className="text-xs font-semibold text-gray-700">PDF Document Ready</p>
                      <span className="text-[11px] text-gray-400">All pages formatted for standard A4 printing</span>
                    </div>
                  )}
                </div>

                {/* Page Range Selection Box (Inspired by QR Se Print) */}
                <div className="border border-gray-100 rounded-2xl p-4 bg-gray-50/50 mb-4">
                  <label className="block text-xs font-bold text-gray-800 mb-2">
                    📄 Which Pages to Print?
                  </label>
                  <div className="grid grid-cols-2 gap-2 mb-2">
                    <button
                      type="button"
                      onClick={() => setPageRangeMode('all')}
                      className={`py-2 px-3 rounded-xl text-xs font-bold border transition-all ${
                        pageRangeMode === 'all'
                          ? 'bg-blue-600 text-white border-blue-600 shadow-sm'
                          : 'bg-white text-gray-700 border-gray-200 hover:bg-gray-100'
                      }`}
                    >
                      All Pages ({totalPages})
                    </button>
                    <button
                      type="button"
                      onClick={() => setPageRangeMode('custom')}
                      className={`py-2 px-3 rounded-xl text-xs font-bold border transition-all ${
                        pageRangeMode === 'custom'
                          ? 'bg-blue-600 text-white border-blue-600 shadow-sm'
                          : 'bg-white text-gray-700 border-gray-200 hover:bg-gray-100'
                      }`}
                    >
                      Specific Range
                    </button>
                  </div>

                  {pageRangeMode === 'custom' && (
                    <div className="mt-2">
                      <Input
                        value={customRangeStr}
                        onChange={(e) => setCustomRangeStr(e.target.value)}
                        placeholder="e.g. 1, 3, 5-8"
                        className="bg-white text-xs h-9"
                      />
                      <span className="text-[11px] text-gray-500 mt-1 block">
                        Printing <strong>{selectedPagesCount}</strong> of {totalPages} pages
                      </span>
                    </div>
                  )}
                </div>

                {/* Mini Print: Pages Per Sheet (Inspired by QR Se Print) */}
                <div className="border border-gray-100 rounded-2xl p-4 bg-gray-50/50">
                  <div className="flex items-center justify-between mb-2">
                    <label className="text-xs font-bold text-gray-800 flex items-center gap-1.5">
                      <Layers className="h-3.5 w-3.5 text-blue-600" /> Mini Print (Pages Per Sheet)
                    </label>
                    {pagesPerSheet > 1 && (
                      <Badge className="bg-emerald-100 text-emerald-800 text-[10px]">
                        Saves {pagesPerSheet === 2 ? '50%' : '75%'} paper!
                      </Badge>
                    )}
                  </div>
                  <div className="grid grid-cols-3 gap-2 text-center">
                    {[
                      { val: 1, label: '1-in-1', desc: 'Normal' },
                      { val: 2, label: '2-in-1', desc: '2 slides/page' },
                      { val: 4, label: '4-in-1', desc: 'Cheat Sheet' },
                    ].map((opt) => (
                      <button
                        key={opt.val}
                        type="button"
                        onClick={() => setPagesPerSheet(opt.val)}
                        className={`p-2.5 rounded-xl border text-center transition-all ${
                          pagesPerSheet === opt.val
                            ? 'bg-blue-50 border-blue-600 text-blue-900 font-bold shadow-sm'
                            : 'bg-white border-gray-200 text-gray-600 hover:bg-gray-50'
                        }`}
                      >
                        <b className="block text-sm leading-tight">{opt.label}</b>
                        <span className="text-[10px] text-gray-400 block">{opt.desc}</span>
                      </button>
                    ))}
                  </div>
                  <span className="text-[11px] text-gray-500 mt-2 block text-center">
                    Total Sheets to print: <strong>{calculatedSheets}</strong>
                  </span>
                </div>
              </CardContent>
            </Card>

            {/* Navigation Buttons */}
            <div className="flex gap-3">
              <Button
                variant="outline"
                onClick={() => setStep(1)}
                className="flex-1 bg-white border-gray-300 py-6 rounded-2xl font-bold"
              >
                ← Back
              </Button>
              <Button
                onClick={() => setStep(3)}
                className="flex-1 bg-gradient-to-r from-blue-600 to-indigo-600 text-white py-6 rounded-2xl font-bold shadow-lg"
              >
                Next: Print Options →
              </Button>
            </div>
          </div>
        )}

        {/* ========================================================================= */}
        {/* STEP 3: PRINT OPTIONS & PAYMENT */}
        {/* ========================================================================= */}
        {step === 3 && selectedFile && (
          <div className="space-y-4 animate-in fade-in duration-300">
            <Card className="bg-white border border-gray-200 rounded-3xl shadow-sm p-6 space-y-6">
              {/* 1. Color Mode Toggle Cards */}
              <div>
                <label className="block text-xs font-bold text-gray-800 mb-2">Color Mode</label>
                <div className="grid grid-cols-2 gap-3">
                  <div
                    onClick={() => setColorMode('bw')}
                    className={`p-4 rounded-2xl border-2 cursor-pointer transition-all ${
                      colorMode === 'bw'
                        ? 'border-blue-600 bg-blue-50/50 shadow-sm'
                        : 'border-gray-200 hover:border-gray-300'
                    }`}
                  >
                    <div className="text-2xl mb-1">⬛</div>
                    <b className="text-sm font-bold text-gray-900 block">Black & White</b>
                    <span className="text-xs text-gray-500">৳{PRICE_BW.toFixed(2)}/page</span>
                  </div>

                  <div
                    onClick={() => setColorMode('color')}
                    className={`p-4 rounded-2xl border-2 cursor-pointer transition-all ${
                      colorMode === 'color'
                        ? 'border-purple-600 bg-purple-50/50 shadow-sm'
                        : 'border-gray-200 hover:border-gray-300'
                    }`}
                  >
                    <div className="text-2xl mb-1">🌈</div>
                    <b className="text-sm font-bold text-gray-900 block">Color Print</b>
                    <span className="text-xs text-gray-500">৳{PRICE_COLOR.toFixed(2)}/page</span>
                  </div>
                </div>
              </div>

              {/* 2. Copies & Duplex */}
              <div className="flex items-center justify-between py-3 border-t border-b border-gray-100">
                <span className="text-sm font-bold text-gray-900">📑 Copies</span>
                <div className="flex items-center gap-3">
                  <Button
                    size="icon"
                    variant="outline"
                    className="h-8 w-8 rounded-lg"
                    onClick={() => setCopies((c) => Math.max(1, c - 1))}
                    disabled={copies <= 1}
                  >
                    -
                  </Button>
                  <span className="font-bold text-base min-w-[20px] text-center">{copies}</span>
                  <Button
                    size="icon"
                    variant="outline"
                    className="h-8 w-8 rounded-lg"
                    onClick={() => setCopies((c) => c + 1)}
                  >
                    +
                  </Button>
                </div>
              </div>

              <div className="flex items-center justify-between">
                <div>
                  <b className="text-sm font-bold text-gray-900 block">Dual-Side (Duplex)</b>
                  <span className="text-xs text-gray-500">Prints front and back</span>
                </div>
                <button
                  type="button"
                  onClick={() => setDuplex(!duplex)}
                  className={`w-12 h-6 rounded-full transition-colors relative p-0.5 ${
                    duplex ? 'bg-blue-600' : 'bg-gray-200'
                  }`}
                >
                  <span
                    className={`block w-5 h-5 rounded-full bg-white transition-transform ${
                      duplex ? 'translate-x-6' : 'translate-x-0'
                    }`}
                  />
                </button>
              </div>

              {/* 3. Payment Method */}
              <div className="pt-2 border-t border-gray-100">
                <label className="block text-xs font-bold text-gray-800 mb-2">Select Payment</label>
                <div className="space-y-2">
                  <button
                    type="button"
                    onClick={() => setPaymentMethod('online')}
                    className={`w-full p-3.5 rounded-2xl border-2 text-left flex items-center justify-between transition-all ${
                      paymentMethod === 'online'
                        ? 'border-blue-600 bg-blue-50/50'
                        : 'border-gray-200 hover:border-gray-300'
                    }`}
                  >
                    <div className="flex items-center gap-3">
                      <CreditCard className="h-5 w-5 text-blue-600" />
                      <div>
                        <b className="text-xs font-bold text-gray-900 block">💳 Pay Online (bKash / Card)</b>
                        <span className="text-[11px] text-gray-500">Type A OTP — Valid at ALL Kiosks & Shops</span>
                      </div>
                    </div>
                    <Badge className="bg-emerald-100 text-emerald-800 text-[10px]">Universal</Badge>
                  </button>

                  <button
                    type="button"
                    onClick={() => setPaymentMethod('cash')}
                    disabled={deviceInfo?.type === 'kiosk'}
                    className={`w-full p-3.5 rounded-2xl border-2 text-left flex items-center justify-between transition-all ${
                      deviceInfo?.type === 'kiosk'
                        ? 'opacity-40 cursor-not-allowed bg-gray-50 border-gray-200'
                        : paymentMethod === 'cash'
                        ? 'border-amber-600 bg-amber-50/50'
                        : 'border-gray-200 hover:border-gray-300'
                    }`}
                  >
                    <div className="flex items-center gap-3">
                      <Banknote className="h-5 w-5 text-amber-600" />
                      <div>
                        <b className="text-xs font-bold text-gray-900 block">💵 Pay at Counter (Cash)</b>
                        <span className="text-[11px] text-gray-500">
                          {deviceInfo?.type === 'kiosk'
                            ? 'Not available at unattended kiosk'
                            : 'Type B OTP — Valid at Partner Shops ONLY'}
                        </span>
                      </div>
                    </div>
                    <Badge variant="outline" className="border-amber-300 text-amber-700 text-[10px]">
                      Shop Only
                    </Badge>
                  </button>
                </div>
              </div>

              {/* Price Summary Breakdown (Inspired by QR Se Print) */}
              <div className="bg-gray-50 rounded-2xl p-4 space-y-1.5 text-xs text-gray-600 border border-gray-200/70">
                <div className="flex justify-between">
                  <span>Print Type:</span>
                  <strong className="text-gray-900">{colorMode === 'color' ? 'Full Color' : 'Black & White'}</strong>
                </div>
                <div className="flex justify-between">
                  <span>Sheets to print:</span>
                  <strong className="text-gray-900">{calculatedSheets} sheets × {copies} copies</strong>
                </div>
                <div className="flex justify-between items-baseline pt-2 border-t border-gray-200 text-sm">
                  <b className="text-gray-900">Total Payable:</b>
                  <strong className="text-2xl font-black text-blue-600">৳{totalPrice}</strong>
                </div>
              </div>

              {submitError && (
                <div className="p-3 bg-red-50 text-red-700 rounded-xl text-xs flex items-center gap-2">
                  <AlertCircle className="h-4 w-4 flex-shrink-0" />
                  <span>{submitError}</span>
                </div>
              )}
            </Card>

            {/* Navigation & Submit Button */}
            <div className="flex gap-3">
              <Button
                variant="outline"
                onClick={() => setStep(2)}
                className="flex-1 bg-white border-gray-300 py-6 rounded-2xl font-bold"
              >
                ← Back
              </Button>
              <Button
                disabled={isSubmitting}
                onClick={handleCreateOrder}
                className="flex-1 bg-gradient-to-r from-blue-600 to-indigo-600 text-white py-6 rounded-2xl font-bold shadow-lg shadow-blue-500/30"
              >
                {isSubmitting ? (
                  <>
                    <RefreshCw className="mr-2 h-4 w-4 animate-spin" /> Preparing Ticket...
                  </>
                ) : (
                  <>
                    Confirm & Get Code →
                  </>
                )}
              </Button>
            </div>
          </div>
        )}

        {/* ========================================================================= */}
        {/* STEP 4: PRINT TICKET & QR SCREEN (Inspired by QR Se Print Success Screen) */}
        {/* ========================================================================= */}
        {step === 4 && ticketOtp && (
          <div className="space-y-4 animate-in zoom-in-95 duration-300">
            <Card className="bg-gradient-to-br from-slate-900 via-indigo-950 to-purple-950 text-white rounded-3xl p-6 sm:p-8 shadow-2xl text-center relative overflow-hidden border border-slate-800">
              <div className="text-4xl mb-1">🎉</div>
              <h2 className="text-2xl font-black bg-gradient-to-r from-blue-300 to-indigo-200 bg-clip-text text-transparent mb-1">
                Print Order Placed!
              </h2>
              <p className="text-xs text-gray-300 mb-6">
                Enter code on the machine screen or scan QR code at the scanner.
              </p>

              {/* Main OTP Box */}
              <div className="bg-white text-gray-900 rounded-3xl p-6 shadow-2xl max-w-xs mx-auto border border-gray-100">
                <span className="text-[11px] uppercase tracking-wider font-bold text-gray-400 block mb-1">
                  Redemption OTP
                </span>
                <div className="flex items-center justify-center gap-2 mb-3">
                  <span className="text-4xl sm:text-5xl font-mono font-black tracking-widest text-blue-600">
                    {ticketOtp.code}
                  </span>
                  <button
                    onClick={handleCopyOtp}
                    className="p-1.5 text-gray-400 hover:text-blue-600 rounded-lg"
                    title="Copy OTP"
                  >
                    {copied ? <Check className="h-5 w-5 text-emerald-600" /> : <Copy className="h-5 w-5" />}
                  </button>
                </div>

                <Badge
                  className={`text-[10px] mb-4 ${
                    ticketOtp.otp_type === 'type_a'
                      ? 'bg-emerald-100 text-emerald-800 hover:bg-emerald-100'
                      : 'bg-amber-100 text-amber-800 hover:bg-amber-100'
                  }`}
                >
                  {ticketOtp.otp_type === 'type_a' ? 'Valid at Kiosks & Shops' : 'Valid at Partner Shops Only'}
                </Badge>

                {qrCodeDataUrl && (
                  <div className="pt-3 border-t border-gray-100 flex flex-col items-center">
                    <img src={qrCodeDataUrl} alt="Print Ticket QR" className="w-44 h-44 rounded-xl border p-2" />
                    <span className="text-[10px] text-gray-400 mt-1">Scan at kiosk QR camera</span>
                  </div>
                )}
              </div>

              {/* Countdown & Realtime Status */}
              <div className="flex items-center justify-center gap-4 mt-6 text-xs text-gray-300">
                <div className="flex items-center gap-1.5 bg-black/30 px-3 py-1.5 rounded-full">
                  <Clock className="h-3.5 w-3.5 text-blue-400" />
                  <span>Expires in: <strong>{formatTime(timeLeft)}</strong></span>
                </div>
                <div className="flex items-center gap-1.5 bg-black/30 px-3 py-1.5 rounded-full">
                  <span className="w-2 h-2 rounded-full bg-emerald-400 animate-pulse"></span>
                  <span className="capitalize">{liveStatus.replace('_', ' ')}</span>
                </div>
              </div>
            </Card>

            <div className="flex gap-3">
              <Link href="/find-printer" className="flex-1">
                <Button className="w-full bg-blue-600 hover:bg-blue-700 py-6 rounded-2xl font-bold shadow-md">
                  <MapPin className="mr-1.5 h-4 w-4" /> Find Nearest Kiosk
                </Button>
              </Link>
              <Button
                variant="outline"
                onClick={() => {
                  setSelectedFile(null)
                  setTicketOrder(null)
                  setTicketOtp(null)
                  setStep(1)
                }}
                className="bg-white border-gray-300 py-6 rounded-2xl font-bold"
              >
                Print Another
              </Button>
            </div>
          </div>
        )}
      </div>

      {/* CamScanner Camera Modal */}
      <DocumentScannerModal
        isOpen={isScannerOpen}
        onClose={() => setIsScannerOpen(false)}
        onComplete={handleScannerComplete}
      />
    </div>
  )
}
