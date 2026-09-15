'use client'

import { useState, useEffect, useRef, Suspense } from 'react'
import Link from 'next/link'
import { useSearchParams } from 'next/navigation'
import QRCode from 'qrcode'
import { supabase } from '@/lib/supabase'
import DocumentScannerModal from '@/components/scanner/DocumentScannerModal'
import PassportPhotoModal from '@/components/print/PassportPhotoModal'
import IdCardScannerModal from '@/components/print/IdCardScannerModal'
import { playCompletionChime } from '@/lib/audio-chime'
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
  FileCheck,
  Scissors,
  RotateCw,
  RotateCcw,
  Sun,
  Contrast,
  SlidersHorizontal
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
    <Suspense fallback={<div className="min-h-screen flex items-center justify-center text-gray-500 font-medium">Loading QuickInk Print Station...</div>}>
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

  // Wizard Step: 1 = Hub & Upload, 2 = Preview & Range, 3 = Options, 4 = Ticket
  const [step, setStep] = useState(1)

  // Service modality ('doc' | 'scanner' | 'mini' | 'photo4x6' | 'idCard')
  const [serviceType, setServiceType] = useState('doc')

  // Modals state
  const [isScannerOpen, setIsScannerOpen] = useState(false)
  const [isPassportModalOpen, setIsPassportModalOpen] = useState(false)
  const [isIdCardModalOpen, setIsIdCardModalOpen] = useState(false)

  // Document state
  const [selectedFile, setSelectedFile] = useState(null)
  const [filePreviewUrl, setFilePreviewUrl] = useState(null)
  const [showChoiceScreen, setShowChoiceScreen] = useState(false)
  const [previewPageIndex, setPreviewPageIndex] = useState(1)

  // Adjustment state
  const [rotation, setRotation] = useState(0) // 0, 90, 180, 270
  const [brightness, setBrightness] = useState(0) // -50 to 50
  const [contrast, setContrast] = useState(0) // -50 to 50
  const [showAdjustControls, setShowAdjustControls] = useState(false)

  // Print settings
  const [totalPages, setTotalPages] = useState(1)
  const [pageRangeMode, setPageRangeMode] = useState('all') // 'all' | 'custom'
  const [customRangeStr, setCustomRangeStr] = useState('')
  const [pagesPerSheet, setPagesPerSheet] = useState(1) // 1, 2, 4, 6, 8
  const [miniBorder, setMiniBorder] = useState(true)
  const [colorMode, setColorMode] = useState('bw') // 'bw' | 'color'
  const [copies, setCopies] = useState(1)
  const [duplex, setDuplex] = useState(false)

  // Payment & Order state
  const [paymentMethod, setPaymentMethod] = useState('online') // 'online' | 'cash'
  const [isSubmitting, setIsSubmitting] = useState(false)
  const [uploadProgress, setUploadProgress] = useState(0)
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
  const calculatedSheets = Math.max(1, Math.ceil(selectedPagesCount / pagesPerSheet))
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
    setRotation(0)
    setBrightness(0)
    setContrast(0)

    if (file.type.startsWith('image/')) {
      const url = URL.createObjectURL(file)
      setFilePreviewUrl(url)
    } else {
      setFilePreviewUrl(null)
    }

    // Show Choice Screen (Inspired by QR Se Print)
    setShowChoiceScreen(true)
  }

  // Handle scanner completion
  const handleScannerComplete = ({ file, pageCount: scannedPages, previewUrl }) => {
    setSelectedFile(file)
    setTotalPages(scannedPages)
    setFilePreviewUrl(previewUrl)
    setSubmitError(null)
    setPreviewPageIndex(1)
    setServiceType('scanner')
    setShowChoiceScreen(true)
  }

  // Handle passport photo completion
  const handlePassportComplete = ({ file, previewUrl, photoCount }) => {
    setSelectedFile(file)
    setTotalPages(1)
    setFilePreviewUrl(previewUrl)
    setSubmitError(null)
    setServiceType('photo4x6')
    setColorMode('color') // Passport photos always default to color
    setStep(3) // Proceed directly to options
  }

  // Handle ID card 2-in-1 completion
  const handleIdCardComplete = ({ file, previewUrl }) => {
    setSelectedFile(file)
    setTotalPages(1)
    setFilePreviewUrl(previewUrl)
    setSubmitError(null)
    setServiceType('idCard')
    setStep(2) // Review A4 layout
  }

  // Copy OTP Code to clipboard
  const handleCopyOtp = () => {
    if (!ticketOtp?.code) return
    navigator.clipboard.writeText(ticketOtp.code)
    setCopied(true)
    setTimeout(() => setCopied(false), 2000)
  }

  // Submit and create order with simulated progress + audio chime
  const handleCreateOrder = async () => {
    if (!selectedFile) {
      setSubmitError('Please select or scan a document first.')
      return
    }

    setIsSubmitting(true)
    setUploadProgress(15)
    setSubmitError(null)

    try {
      const fileExt = selectedFile.name.split('.').pop() || 'pdf'
      const cleanFileName = selectedFile.name.replace(/[^a-zA-Z0-9.-]/g, '_')
      const storagePath = `jobs/${Date.now()}_${cleanFileName}`

      setUploadProgress(40)

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

      setUploadProgress(75)

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

      setUploadProgress(100)

      // Play pleasant completion chime!
      playCompletionChime()

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
    <div className="min-h-screen bg-slate-100/70 pt-20 pb-20 font-sans">
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
                  {deviceInfo ? deviceInfo.name : 'QuickInk Smart Print Station'}
                </h2>
                <span className="w-4 h-4 rounded-full bg-blue-500 text-white text-[10px] font-bold flex items-center justify-center">
                  ✓
                </span>
              </div>
              <p className="text-xs text-gray-400 truncate mt-0.5">
                {deviceInfo?.location?.address || 'Self-Service Print Kiosk & Partner Shop'}
              </p>
              <div className="flex items-center gap-2 mt-2 flex-wrap">
                <span className="bg-white/10 text-white border border-white/10 text-[11px] font-semibold px-2.5 py-0.5 rounded-full backdrop-blur-sm">
                  B&W: ৳{PRICE_BW}/page
                </span>
                <span className="bg-gradient-to-r from-purple-500 to-pink-500 text-white text-[11px] font-semibold px-2.5 py-0.5 rounded-full shadow-sm">
                  Color: ৳{PRICE_COLOR}/page
                </span>
                <Badge className="bg-emerald-500/20 text-emerald-400 text-[10px] border border-emerald-500/30">
                  ● Online & Ready
                </Badge>
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
        {/* CHOICE SCREEN MODAL (Inspired by QR Se Print) */}
        {/* ========================================================================= */}
        {showChoiceScreen && selectedFile && (
          <div className="space-y-4 animate-in zoom-in-95 duration-200 mb-6">
            <Card className="bg-white border-2 border-blue-500/40 rounded-3xl shadow-xl p-6 text-center">
              <div className="text-3xl mb-1">👀</div>
              <h3 className="text-xl font-extrabold text-gray-900 mb-1">File Loaded Successfully</h3>
              <p className="text-xs text-gray-500 max-w-sm mx-auto mb-4">
                <strong>{selectedFile.name}</strong> • {(selectedFile.size / 1024).toFixed(1)} KB
              </p>

              {/* Quick Thumbnail Preview */}
              <div className="bg-slate-50 border border-gray-200 rounded-2xl p-3 flex items-center justify-center max-h-48 mb-5 overflow-hidden">
                {filePreviewUrl ? (
                  <img
                    src={filePreviewUrl}
                    alt="Quick preview"
                    className="max-h-40 max-w-full rounded-lg shadow object-contain border"
                  />
                ) : (
                  <div className="py-6 flex flex-col items-center">
                    <FileCheck className="w-12 h-12 text-blue-600 mb-1.5" />
                    <span className="text-xs font-bold text-gray-700">Ready for A4 Print</span>
                  </div>
                )}
              </div>

              {/* The Two Choice Paths */}
              <div className="space-y-2.5">
                <Button
                  onClick={() => {
                    setShowChoiceScreen(false)
                    setStep(2)
                  }}
                  className="w-full bg-emerald-600 hover:bg-emerald-700 text-white py-6 rounded-2xl font-black text-sm shadow-lg shadow-emerald-600/20"
                >
                  ✅ Looks Great — Proceed to Print
                </Button>
                <p className="text-[11px] text-gray-400">
                  Prints in original crisp resolution with fastest upload
                </p>

                <Button
                  variant="outline"
                  onClick={() => {
                    setShowChoiceScreen(false)
                    setShowAdjustControls(true)
                    setStep(2)
                  }}
                  className="w-full bg-white border-gray-200 text-gray-800 hover:bg-gray-50 py-5 rounded-2xl font-bold text-xs"
                >
                  ✏️ Edit & Adjust (Rotate / Brightness / Range)
                </Button>
              </div>
            </Card>
          </div>
        )}

        {/* ========================================================================= */}
        {/* STEP 1: SERVICE CARDS HUB (Inspired by QR Se Print) */}
        {/* ========================================================================= */}
        {step === 1 && !showChoiceScreen && (
          <div className="space-y-4 animate-in fade-in duration-300">
            {/* Service Selection Grid */}
            <div className="grid grid-cols-2 gap-3">
              {/* 1. Standard Document Print */}
              <Card
                onClick={() => {
                  setServiceType('doc')
                  fileInputRef.current?.click()
                }}
                className="border-2 border-transparent hover:border-blue-500 hover:shadow-lg transition-all cursor-pointer bg-white rounded-3xl p-4 text-center group"
              >
                <div className="w-12 h-12 rounded-2xl bg-blue-50 text-blue-600 flex items-center justify-center mx-auto mb-2 text-2xl group-hover:scale-110 transition-transform">
                  📄
                </div>
                <b className="text-sm font-extrabold text-gray-900 block leading-tight">Document Print</b>
                <span className="text-[11px] text-gray-500 block mt-1">PDF, Word, Images (A4)</span>
              </Card>

              {/* 2. Smart CamScanner */}
              <Card
                onClick={() => {
                  setServiceType('scanner')
                  setIsScannerOpen(true)
                }}
                className="border-2 border-transparent hover:border-purple-500 hover:shadow-lg transition-all cursor-pointer bg-white rounded-3xl p-4 text-center group"
              >
                <div className="w-12 h-12 rounded-2xl bg-purple-50 text-purple-600 flex items-center justify-center mx-auto mb-2 text-2xl group-hover:scale-110 transition-transform">
                  📸
                </div>
                <b className="text-sm font-extrabold text-gray-900 block leading-tight">Smart CamScanner</b>
                <span className="text-[11px] text-gray-500 block mt-1">Camera snap with Clean B&W</span>
              </Card>

              {/* 3. Mini Print (N-in-1 Paper Saver) */}
              <Card
                onClick={() => {
                  setServiceType('mini')
                  fileInputRef.current?.click()
                }}
                className="border-2 border-transparent hover:border-emerald-500 hover:shadow-lg transition-all cursor-pointer bg-white rounded-3xl p-4 text-center group"
              >
                <div className="w-12 h-12 rounded-2xl bg-emerald-50 text-emerald-600 flex items-center justify-center mx-auto mb-2 text-2xl group-hover:scale-110 transition-transform">
                  🗒️
                </div>
                <b className="text-sm font-extrabold text-gray-900 block leading-tight">Mini Print (N-in-1)</b>
                <span className="text-[11px] text-gray-500 block mt-1">2, 4, 6 pages per sheet</span>
              </Card>

              {/* 4. Passport / 4×6 Photo Grid */}
              <Card
                onClick={() => {
                  setServiceType('photo4x6')
                  setIsPassportModalOpen(true)
                }}
                className="border-2 border-transparent hover:border-pink-500 hover:shadow-lg transition-all cursor-pointer bg-white rounded-3xl p-4 text-center group"
              >
                <div className="w-12 h-12 rounded-2xl bg-pink-50 text-pink-600 flex items-center justify-center mx-auto mb-2 text-2xl group-hover:scale-110 transition-transform">
                  📷
                </div>
                <b className="text-sm font-extrabold text-gray-900 block leading-tight">Passport Photo Grid</b>
                <span className="text-[11px] text-gray-500 block mt-1">4, 6, 8, 12 photos + cutting guides</span>
              </Card>

              {/* 5. ID Card 2-in-1 Photocopy */}
              <Card
                onClick={() => {
                  setServiceType('idCard')
                  setIsIdCardModalOpen(true)
                }}
                className="col-span-2 border-2 border-transparent hover:border-indigo-500 hover:shadow-lg transition-all cursor-pointer bg-white rounded-3xl p-4 flex items-center gap-4 text-left group"
              >
                <div className="w-12 h-12 rounded-2xl bg-indigo-50 text-indigo-600 flex items-center justify-center text-2xl group-hover:scale-110 transition-transform flex-shrink-0">
                  🆔
                </div>
                <div className="min-w-0 flex-1">
                  <b className="text-sm font-extrabold text-gray-900 block">ID Card 2-in-1 Photocopy</b>
                  <span className="text-xs text-gray-500 block mt-0.5">
                    Combine Front & Back of National ID or Driving License on a single A4 page
                  </span>
                </div>
                <ChevronRight className="w-5 h-5 text-gray-400 group-hover:text-indigo-600 transition-colors" />
              </Card>
            </div>

            {/* Quick Upload Drag-and-Drop Box */}
            <Card
              onClick={() => fileInputRef.current?.click()}
              className="border-2 border-dashed border-gray-300 hover:border-blue-500 hover:bg-blue-50/20 transition-all cursor-pointer bg-white rounded-3xl text-center mt-2"
            >
              <CardContent className="p-7 flex flex-col items-center">
                <input
                  ref={fileInputRef}
                  type="file"
                  accept=".pdf,.doc,.docx,.jpg,.jpeg,.png"
                  onChange={handleFileChange}
                  className="hidden"
                />
                <div className="w-12 h-12 rounded-2xl bg-blue-50 text-blue-600 flex items-center justify-center mb-2">
                  <Upload className="h-6 w-6" />
                </div>
                <h4 className="text-base font-bold text-gray-900 mb-0.5">Or Drop Document Here</h4>
                <p className="text-xs text-gray-500 mb-3">PDF, DOCX, JPG, PNG up to 20MB</p>
                <span className="inline-flex items-center gap-1.5 bg-gray-100 text-gray-800 text-xs font-semibold px-4 py-1.5 rounded-xl border border-gray-200">
                  Browse Files <ChevronRight className="h-3.5 w-3.5" />
                </span>
              </CardContent>
            </Card>

            {/* Trust Row (from QR Se Print inspiration) */}
            <div className="bg-white rounded-2xl p-3 border border-gray-200 shadow-sm flex items-center justify-between text-center divide-x divide-gray-100">
              <div className="flex-1 px-2">
                <div className="text-base mb-0.5">🛡️</div>
                <b className="text-[11px] text-gray-900 block font-bold">100% Safe</b>
                <span className="text-[10px] text-gray-500 block">Auto-erased</span>
              </div>
              <div className="flex-1 px-2">
                <div className="text-base mb-0.5">⚡</div>
                <b className="text-[11px] text-gray-900 block font-bold">Instant Release</b>
                <span className="text-[10px] text-gray-500 block">Kiosk & Shop</span>
              </div>
              <div className="flex-1 px-2">
                <div className="text-base mb-0.5">🏅</div>
                <b className="text-[11px] text-gray-900 block font-bold">Laser Sharp</b>
                <span className="text-[10px] text-gray-500 block">600+ DPI</span>
              </div>
            </div>
          </div>
        )}

        {/* ========================================================================= */}
        {/* STEP 2: PREVIEW, EDIT & ADJUST, AND RANGE */}
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
                      setShowChoiceScreen(false)
                      setStep(1)
                    }}
                    className="text-xs text-gray-500 hover:text-red-600"
                  >
                    Change
                  </Button>
                </div>

                {/* Visual Preview Box with Rotation & Filter Adjustments */}
                <div className="bg-slate-50 border border-gray-200 rounded-2xl p-4 flex flex-col items-center justify-center min-h-[220px] mb-3 overflow-hidden">
                  {filePreviewUrl ? (
                    <img
                      src={filePreviewUrl}
                      alt="Document Preview"
                      style={{
                        transform: `rotate(${rotation}deg)`,
                        filter: `brightness(${100 + brightness}%) contrast(${100 + contrast}%)`,
                        transition: 'transform 0.2s ease, filter 0.2s ease'
                      }}
                      className="max-h-56 max-w-full rounded-lg shadow-md object-contain border bg-white"
                    />
                  ) : (
                    <div className="text-center py-6">
                      <FileText className="h-16 w-16 text-blue-500/70 mx-auto mb-2" />
                      <p className="text-xs font-semibold text-gray-700">PDF Document Loaded</p>
                      <span className="text-[11px] text-gray-400">Standard A4 page format</span>
                    </div>
                  )}
                </div>

                {/* Quick Toolbar for Adjustments (Rotate & Brightness) */}
                <div className="flex items-center justify-between gap-2 mb-4">
                  <div className="flex items-center gap-1.5">
                    <Button
                      size="sm"
                      variant="outline"
                      onClick={() => setRotation((r) => (r - 90 + 360) % 360)}
                      className="h-8 rounded-xl text-xs flex items-center gap-1"
                    >
                      <RotateCcw className="w-3.5 h-3.5" /> -90°
                    </Button>
                    <Button
                      size="sm"
                      variant="outline"
                      onClick={() => setRotation((r) => (r + 90) % 360)}
                      className="h-8 rounded-xl text-xs flex items-center gap-1"
                    >
                      <RotateCw className="w-3.5 h-3.5" /> +90°
                    </Button>
                  </div>

                  <Button
                    size="sm"
                    variant={showAdjustControls ? 'default' : 'outline'}
                    onClick={() => setShowAdjustControls(!showAdjustControls)}
                    className="h-8 rounded-xl text-xs flex items-center gap-1"
                  >
                    <SlidersHorizontal className="w-3.5 h-3.5" /> Adjust
                  </Button>
                </div>

                {/* Expandable Adjust Controls Panel */}
                {showAdjustControls && (
                  <div className="bg-slate-50 border border-gray-200 rounded-2xl p-3.5 space-y-3 mb-4 animate-in fade-in duration-200">
                    <div>
                      <div className="flex justify-between text-xs font-semibold text-gray-700 mb-1">
                        <span className="flex items-center gap-1">
                          <Sun className="w-3.5 h-3.5 text-amber-500" /> Brightness
                        </span>
                        <span>{brightness > 0 ? `+${brightness}` : brightness}</span>
                      </div>
                      <input
                        type="range"
                        min="-50"
                        max="50"
                        value={brightness}
                        onChange={(e) => setBrightness(parseInt(e.target.value))}
                        className="w-full accent-blue-600 cursor-pointer h-1.5 bg-gray-200 rounded-lg"
                      />
                    </div>

                    <div>
                      <div className="flex justify-between text-xs font-semibold text-gray-700 mb-1">
                        <span className="flex items-center gap-1">
                          <Contrast className="w-3.5 h-3.5 text-indigo-500" /> Contrast
                        </span>
                        <span>{contrast > 0 ? `+${contrast}` : contrast}</span>
                      </div>
                      <input
                        type="range"
                        min="-50"
                        max="50"
                        value={contrast}
                        onChange={(e) => setContrast(parseInt(e.target.value))}
                        className="w-full accent-blue-600 cursor-pointer h-1.5 bg-gray-200 rounded-lg"
                      />
                    </div>

                    <div className="text-right">
                      <button
                        type="button"
                        onClick={() => {
                          setBrightness(0)
                          setContrast(0)
                          setRotation(0)
                        }}
                        className="text-[11px] font-bold text-gray-500 hover:text-blue-600"
                      >
                        Reset All Adjustments
                      </button>
                    </div>
                  </div>
                )}

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
                        Saves {pagesPerSheet === 2 ? '50%' : pagesPerSheet === 4 ? '75%' : '80%+'} paper!
                      </Badge>
                    )}
                  </div>
                  <div className="grid grid-cols-4 gap-1.5 text-center mb-3">
                    {[
                      { val: 1, label: '1-in-1', desc: 'Standard' },
                      { val: 2, label: '2-in-1', desc: 'Notes' },
                      { val: 4, label: '4-in-1', desc: 'Cheat Sheet' },
                      { val: 6, label: '6-in-1', desc: 'Micro' },
                    ].map((opt) => (
                      <button
                        key={opt.val}
                        type="button"
                        onClick={() => setPagesPerSheet(opt.val)}
                        className={`p-2 rounded-xl border text-center transition-all ${
                          pagesPerSheet === opt.val
                            ? 'bg-blue-50 border-blue-600 text-blue-900 font-bold shadow-sm'
                            : 'bg-white border-gray-200 text-gray-600 hover:bg-gray-50'
                        }`}
                      >
                        <b className="block text-xs leading-tight">{opt.label}</b>
                        <span className="text-[9px] text-gray-400 block">{opt.desc}</span>
                      </button>
                    ))}
                  </div>

                  {pagesPerSheet > 1 && (
                    <div className="flex items-center justify-between pt-2 border-t border-gray-200 text-xs">
                      <span className="text-gray-600">Cutting border line:</span>
                      <button
                        type="button"
                        onClick={() => setMiniBorder(!miniBorder)}
                        className={`px-2.5 py-1 rounded-lg text-xs font-bold transition-all ${
                          miniBorder ? 'bg-blue-600 text-white' : 'bg-gray-200 text-gray-700'
                        }`}
                      >
                        {miniBorder ? 'Border ON' : 'Border OFF'}
                      </button>
                    </div>
                  )}

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
            <Card className="bg-white border border-gray-200 rounded-3xl shadow-sm p-6 space-y-5">
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

              {/* Upload Progress Bar with Shimmer */}
              {isSubmitting && (
                <div className="space-y-1.5 animate-in fade-in duration-200">
                  <div className="flex justify-between text-xs font-bold text-gray-700">
                    <span>📤 Uploading & Generating Ticket...</span>
                    <span>{uploadProgress}%</span>
                  </div>
                  <div className="w-full h-2.5 bg-gray-200 rounded-full overflow-hidden relative">
                    <div
                      className="h-full bg-gradient-to-r from-blue-600 to-indigo-600 transition-all duration-300 rounded-full"
                      style={{ width: `${uploadProgress}%` }}
                    />
                  </div>
                </div>
              )}

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
                  setShowChoiceScreen(false)
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

      {/* Passport Photo Modal */}
      <PassportPhotoModal
        isOpen={isPassportModalOpen}
        onClose={() => setIsPassportModalOpen(false)}
        onComplete={handlePassportComplete}
      />

      {/* ID Card 2-in-1 Modal */}
      <IdCardScannerModal
        isOpen={isIdCardModalOpen}
        onClose={() => setIsIdCardModalOpen(false)}
        onComplete={handleIdCardComplete}
      />
    </div>
  )
}
