'use client'

import { useState, useEffect, useRef, Suspense } from 'react'
import Link from 'next/link'
import { useSearchParams } from 'next/navigation'
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
  const [copied, setCopied] = useState(false)
  const [timeLeft, setTimeLeft] = useState(3600)
  const [liveStatus, setLiveStatus] = useState('awaiting_redemption')

  const fileInputRef = useRef(null)

  // Direct step navigation helper for preview/testing
  useEffect(() => {
    if (searchParams.get('step') === '3') {
      setSelectedFile(new File(['Sample QuickInk Document Content'], 'QuickInk_Sample.pdf', { type: 'application/pdf' }))
      setStep(3)
    } else if (searchParams.get('step') === '4') {
      setSelectedFile(new File(['Sample QuickInk Document Content'], 'QuickInk_Sample.pdf', { type: 'application/pdf' }))
      setTicketOtp({ code: '582914', otp_type: 'type_a' })
      setStep(4)
    }
  }, [searchParams])

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

    // Show Choice Screen
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
    setColorMode('color')
    setDuplex(false)
    setStep(3)
  }

  // Handle ID card 2-in-1 completion
  const handleIdCardComplete = ({ file, previewUrl }) => {
    setSelectedFile(file)
    setTotalPages(1)
    setFilePreviewUrl(previewUrl)
    setSubmitError(null)
    setServiceType('idCard')
    setStep(2)
  }

  // Copy OTP Code to clipboard
  const handleCopyOtp = () => {
    if (!ticketOtp?.code) return
    navigator.clipboard.writeText(ticketOtp.code)
    setCopied(true)
    setTimeout(() => setCopied(false), 2000)
  }

  // Submit and create order with minimal progress + audio chime
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
          duplex: colorMode === 'color' ? false : duplex,
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

      // Play completion chime
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
    <div className="min-h-screen bg-slate-50 pt-20 pb-20 font-sans text-gray-900">
      <div className="container mx-auto px-4 sm:px-6 max-w-lg sm:max-w-xl">


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
                    className={`absolute top-4 left-1/2 w-full h-[1.5px] -z-0 transition-colors duration-150 ${
                      step > s.num ? 'bg-[#00bf63]' : 'bg-gray-200'
                    }`}
                  />
                )}
                <div
                  className={`w-8 h-8 rounded-full flex items-center justify-center text-xs font-bold transition-colors z-10 ${
                    isActive
                      ? 'bg-[#00bf63] text-white'
                      : isDone
                      ? 'bg-[#00bf63] text-white'
                      : 'bg-white text-gray-400 border border-gray-300'
                  }`}
                >
                  {isDone ? '✓' : s.num}
                </div>
                <span className={`text-[11px] font-semibold mt-1.5 ${isActive ? 'text-[#00bf63]' : 'text-gray-500'}`}>
                  {s.label}
                </span>
              </div>
            )
          })}
        </div>

        {/* ========================================================================= */}
        {/* CHOICE SCREEN MODAL (Minimal) */}
        {/* ========================================================================= */}
        {showChoiceScreen && selectedFile && (
          <div className="space-y-4 animate-in zoom-in duration-150 mb-6">
            <Card className="bg-white border border-gray-200 rounded-2xl p-6 text-center shadow-none">
              <div className="text-3xl mb-1">👀</div>
              <h3 className="text-lg font-bold text-gray-900 mb-1">File Loaded</h3>
              <p className="text-xs text-gray-500 max-w-sm mx-auto mb-4">
                <strong>{selectedFile.name}</strong> • {(selectedFile.size / 1024).toFixed(1)} KB
              </p>

              {/* Quick Thumbnail Preview */}
              <div className="bg-slate-50 border border-gray-200 rounded-xl p-3 flex items-center justify-center max-h-44 mb-5 overflow-hidden">
                {filePreviewUrl ? (
                  <img
                    src={filePreviewUrl}
                    alt="Quick preview"
                    className="max-h-36 max-w-full rounded border object-contain"
                  />
                ) : (
                  <div className="py-6 flex flex-col items-center">
                    <FileCheck className="w-10 h-10 text-[#00bf63] mb-1" />
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
                  className="w-full bg-[#00bf63] hover:bg-[#00a656] text-white py-5 rounded-xl font-bold text-sm shadow-none"
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
                  className="w-full bg-white border-gray-200 text-gray-700 hover:bg-gray-50 py-4 rounded-xl font-medium text-xs shadow-none"
                >
                  ✏️ Edit & Adjust (Rotate / Brightness / Range)
                </Button>
              </div>
            </Card>
          </div>
        )}

        {/* ========================================================================= */}
        {/* STEP 1: SERVICE CARDS HUB (Minimal) */}
        {/* ========================================================================= */}
        {step === 1 && !showChoiceScreen && (
          <div className="space-y-3 animate-in fade-in duration-200">
            {/* Service Selection Grid */}
            <div className="grid grid-cols-2 gap-2.5">
              {/* 1. Standard Document Print */}
              <Card
                onClick={() => {
                  setServiceType('doc')
                  fileInputRef.current?.click()
                }}
                className="border border-gray-200 hover:border-[#00bf63] hover:bg-[#00bf63]/5 transition-colors cursor-pointer bg-white rounded-2xl p-4 text-center shadow-none"
              >
                <div className="w-10 h-10 rounded-xl bg-[#00bf63]/10 text-[#00bf63] flex items-center justify-center mx-auto mb-2 text-xl font-bold">
                  📄
                </div>
                <b className="text-xs font-bold text-gray-900 block leading-tight">Document Print</b>
                <span className="text-[10px] text-gray-500 block mt-1">PDF, Word, Images</span>
              </Card>

              {/* 2. Smart CamScanner */}
              <Card
                onClick={() => {
                  setServiceType('scanner')
                  setIsScannerOpen(true)
                }}
                className="border border-gray-200 hover:border-[#00bf63] hover:bg-[#00bf63]/5 transition-colors cursor-pointer bg-white rounded-2xl p-4 text-center shadow-none"
              >
                <div className="w-10 h-10 rounded-xl bg-[#00bf63]/10 text-[#00bf63] flex items-center justify-center mx-auto mb-2 text-xl font-bold">
                  📸
                </div>
                <b className="text-xs font-bold text-gray-900 block leading-tight">Smart CamScanner</b>
                <span className="text-[10px] text-gray-500 block mt-1">Camera snap with Clean B&W</span>
              </Card>

              {/* 3. Mini Print (N-in-1 Paper Saver) */}
              <Card
                onClick={() => {
                  setServiceType('mini')
                  fileInputRef.current?.click()
                }}
                className="border border-gray-200 hover:border-[#00bf63] hover:bg-[#00bf63]/5 transition-colors cursor-pointer bg-white rounded-2xl p-4 text-center shadow-none"
              >
                <div className="w-10 h-10 rounded-xl bg-[#00bf63]/10 text-[#00bf63] flex items-center justify-center mx-auto mb-2 text-xl font-bold">
                  🗒️
                </div>
                <b className="text-xs font-bold text-gray-900 block leading-tight">Mini Print (N-in-1)</b>
                <span className="text-[10px] text-gray-500 block mt-1">2, 4, 6 pages per sheet</span>
              </Card>

              {/* 4. Passport / 4×6 Photo Grid */}
              <Card
                onClick={() => {
                  setServiceType('photo4x6')
                  setIsPassportModalOpen(true)
                }}
                className="border border-gray-200 hover:border-[#00bf63] hover:bg-[#00bf63]/5 transition-colors cursor-pointer bg-white rounded-2xl p-4 text-center shadow-none"
              >
                <div className="w-10 h-10 rounded-xl bg-[#00bf63]/10 text-[#00bf63] flex items-center justify-center mx-auto mb-2 text-xl font-bold">
                  📷
                </div>
                <b className="text-xs font-bold text-gray-900 block leading-tight">Passport Photo Grid</b>
                <span className="text-[10px] text-gray-500 block mt-1">4, 6, 8, 12 photos with guides</span>
              </Card>

              {/* 5. ID Card 2-in-1 Photocopy */}
              <Card
                onClick={() => {
                  setServiceType('idCard')
                  setIsIdCardModalOpen(true)
                }}
                className="col-span-2 border border-gray-200 hover:border-[#00bf63] hover:bg-[#00bf63]/5 transition-colors cursor-pointer bg-white rounded-2xl p-3.5 flex items-center gap-3.5 text-left shadow-none"
              >
                <div className="w-10 h-10 rounded-xl bg-[#00bf63]/10 text-[#00bf63] flex items-center justify-center text-xl flex-shrink-0">
                  🆔
                </div>
                <div className="min-w-0 flex-1">
                  <b className="text-xs font-bold text-gray-900 block">ID Card 2-in-1 Photocopy</b>
                  <span className="text-[11px] text-gray-500 block mt-0.5">
                    Combine Front & Back of ID on a single A4 page
                  </span>
                </div>
                <ChevronRight className="w-4 h-4 text-gray-400" />
              </Card>
            </div>

            {/* Quick Upload Drag-and-Drop Box */}
            <Card
              onClick={() => fileInputRef.current?.click()}
              className="border border-dashed border-gray-300 hover:border-[#00bf63] hover:bg-[#00bf63]/5 transition-colors cursor-pointer bg-white rounded-2xl text-center shadow-none mt-2"
            >
              <CardContent className="p-6 flex flex-col items-center">
                <input
                  ref={fileInputRef}
                  type="file"
                  accept=".pdf,.doc,.docx,.jpg,.jpeg,.png"
                  onChange={handleFileChange}
                  className="hidden"
                />
                <div className="w-10 h-10 rounded-xl bg-gray-100 text-gray-600 flex items-center justify-center mb-2">
                  <Upload className="h-5 w-5" />
                </div>
                <h4 className="text-sm font-bold text-gray-900 mb-0.5">Or Choose Local File</h4>
                <p className="text-xs text-gray-500 mb-2.5">PDF, DOCX, JPG, PNG up to 20MB</p>
                <span className="inline-flex items-center gap-1 bg-gray-100 text-gray-700 text-xs font-medium px-3 py-1 rounded-lg border border-gray-200">
                  Browse Files <ChevronRight className="h-3 w-3" />
                </span>
              </CardContent>
            </Card>

            {/* Trust Row */}
            <div className="bg-white rounded-xl p-2.5 border border-gray-200 shadow-none flex items-center justify-between text-center divide-x divide-gray-100">
              <div className="flex-1 px-1.5">
                <div className="text-sm mb-0.5">🛡️</div>
                <b className="text-[10px] text-gray-900 block font-bold">100% Safe</b>
                <span className="text-[9px] text-gray-500 block">Auto-erased</span>
              </div>
              <div className="flex-1 px-1.5">
                <div className="text-sm mb-0.5">⚡</div>
                <b className="text-[10px] text-gray-900 block font-bold">Instant Release</b>
                <span className="text-[9px] text-gray-500 block">Kiosk & Shop</span>
              </div>
              <div className="flex-1 px-1.5">
                <div className="text-sm mb-0.5">🏅</div>
                <b className="text-[10px] text-gray-900 block font-bold">Laser Sharp</b>
                <span className="text-[9px] text-gray-500 block">600+ DPI</span>
              </div>
            </div>
          </div>
        )}

        {/* ========================================================================= */}
        {/* STEP 2: PREVIEW, EDIT & ADJUST, AND RANGE */}
        {/* ========================================================================= */}
        {step === 2 && selectedFile && (
          <div className="space-y-3 animate-in fade-in duration-200">
            <Card className="bg-white border border-gray-200 rounded-2xl shadow-none overflow-hidden">
              <CardContent className="p-4 sm:p-5">
                <div className="flex items-center justify-between mb-3">
                  <div className="flex items-center gap-2.5">
                    <div className="p-2 bg-[#00bf63]/10 text-[#00bf63] rounded-lg">
                      <FileCheck className="h-5 w-5" />
                    </div>
                    <div>
                      <h4 className="font-bold text-gray-900 text-xs truncate max-w-[190px] sm:max-w-xs">
                        {selectedFile.name}
                      </h4>
                      <p className="text-[11px] text-gray-500">
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
                    className="text-xs text-gray-500 hover:text-red-600 h-7 px-2"
                  >
                    Change
                  </Button>
                </div>

                {/* Visual Preview Box with Rotation & Filter Adjustments */}
                <div className="bg-slate-50 border border-gray-200 rounded-xl p-3 flex flex-col items-center justify-center min-h-[200px] mb-3 overflow-hidden">
                  {filePreviewUrl ? (
                    <img
                      src={filePreviewUrl}
                      alt="Document Preview"
                      style={{
                        transform: `rotate(${rotation}deg)`,
                        filter: `brightness(${100 + brightness}%) contrast(${100 + contrast}%)`,
                        transition: 'transform 0.15s ease, filter 0.15s ease'
                      }}
                      className="max-h-52 max-w-full rounded border object-contain bg-white"
                    />
                  ) : (
                    <div className="text-center py-6">
                      <FileText className="h-12 w-12 text-[#00bf63] mx-auto mb-1.5" />
                      <p className="text-xs font-bold text-gray-700">PDF Document Loaded</p>
                      <span className="text-[10px] text-gray-400">Standard A4 page format</span>
                    </div>
                  )}
                </div>

                {/* Quick Toolbar for Adjustments */}
                <div className="flex items-center justify-between gap-2 mb-3">
                  <div className="flex items-center gap-1.5">
                    <Button
                      size="sm"
                      variant="outline"
                      onClick={() => setRotation((r) => (r - 90 + 360) % 360)}
                      className="h-7 rounded-lg text-xs flex items-center gap-1 px-2.5 border-gray-200 shadow-none"
                    >
                      <RotateCcw className="w-3 h-3" /> -90°
                    </Button>
                    <Button
                      size="sm"
                      variant="outline"
                      onClick={() => setRotation((r) => (r + 90) % 360)}
                      className="h-7 rounded-lg text-xs flex items-center gap-1 px-2.5 border-gray-200 shadow-none"
                    >
                      <RotateCw className="w-3 h-3" /> +90°
                    </Button>
                  </div>

                  <Button
                    size="sm"
                    variant={showAdjustControls ? 'default' : 'outline'}
                    onClick={() => setShowAdjustControls(!showAdjustControls)}
                    className={`h-7 rounded-lg text-xs flex items-center gap-1 px-2.5 shadow-none ${
                      showAdjustControls ? 'bg-[#00bf63] hover:bg-[#00a656] text-white' : 'border-gray-200'
                    }`}
                  >
                    <SlidersHorizontal className="w-3 h-3" /> Adjust
                  </Button>
                </div>

                {/* Expandable Adjust Controls Panel */}
                {showAdjustControls && (
                  <div className="bg-slate-50 border border-gray-200 rounded-xl p-3 space-y-2.5 mb-3 animate-in fade-in duration-150">
                    <div>
                      <div className="flex justify-between text-[11px] font-semibold text-gray-700 mb-1">
                        <span className="flex items-center gap-1">
                          <Sun className="w-3 h-3 text-gray-500" /> Brightness
                        </span>
                        <span>{brightness > 0 ? `+${brightness}` : brightness}</span>
                      </div>
                      <input
                        type="range"
                        min="-50"
                        max="50"
                        value={brightness}
                        onChange={(e) => setBrightness(parseInt(e.target.value))}
                        className="w-full accent-[#00bf63] cursor-pointer h-1.5 bg-gray-200 rounded-lg"
                      />
                    </div>

                    <div>
                      <div className="flex justify-between text-[11px] font-semibold text-gray-700 mb-1">
                        <span className="flex items-center gap-1">
                          <Contrast className="w-3 h-3 text-gray-500" /> Contrast
                        </span>
                        <span>{contrast > 0 ? `+${contrast}` : contrast}</span>
                      </div>
                      <input
                        type="range"
                        min="-50"
                        max="50"
                        value={contrast}
                        onChange={(e) => setContrast(parseInt(e.target.value))}
                        className="w-full accent-[#00bf63] cursor-pointer h-1.5 bg-gray-200 rounded-lg"
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
                        className="text-[10px] font-bold text-gray-500 hover:text-[#00bf63]"
                      >
                        Reset All Adjustments
                      </button>
                    </div>
                  </div>
                )}

                {/* Page Range Selection Box */}
                <div className="border border-gray-200 rounded-xl p-3 bg-gray-50/50 mb-3">
                  <label className="block text-xs font-bold text-gray-800 mb-1.5">
                    📄 Which Pages to Print?
                  </label>
                  <div className="grid grid-cols-2 gap-2 mb-1.5">
                    <button
                      type="button"
                      onClick={() => setPageRangeMode('all')}
                      className={`py-1.5 px-2.5 rounded-lg text-xs font-bold border transition-colors ${
                        pageRangeMode === 'all'
                          ? 'bg-[#00bf63] text-white border-[#00bf63]'
                          : 'bg-white text-gray-700 border-gray-200 hover:bg-gray-100'
                      }`}
                    >
                      All Pages ({totalPages})
                    </button>
                    <button
                      type="button"
                      onClick={() => setPageRangeMode('custom')}
                      className={`py-1.5 px-2.5 rounded-lg text-xs font-bold border transition-colors ${
                        pageRangeMode === 'custom'
                          ? 'bg-[#00bf63] text-white border-[#00bf63]'
                          : 'bg-white text-gray-700 border-gray-200 hover:bg-gray-100'
                      }`}
                    >
                      Specific Range
                    </button>
                  </div>

                  {pageRangeMode === 'custom' && (
                    <div className="mt-1.5">
                      <Input
                        value={customRangeStr}
                        onChange={(e) => setCustomRangeStr(e.target.value)}
                        placeholder="e.g. 1, 3, 5-8"
                        className="bg-white text-xs h-8 border-gray-200 focus:border-[#00bf63]"
                      />
                      <span className="text-[10px] text-gray-500 mt-1 block">
                        Printing <strong>{selectedPagesCount}</strong> of {totalPages} pages
                      </span>
                    </div>
                  )}
                </div>

                {/* Mini Print: Pages Per Sheet */}
                <div className="border border-gray-200 rounded-xl p-3 bg-gray-50/50">
                  <div className="flex items-center justify-between mb-1.5">
                    <label className="text-xs font-bold text-gray-800 flex items-center gap-1">
                      <Layers className="h-3.5 w-3.5 text-[#00bf63]" /> Mini Print (Pages Per Sheet)
                    </label>
                    {pagesPerSheet > 1 && (
                      <span className="text-[#00bf63] text-[10px] font-bold">
                        Saves {pagesPerSheet === 2 ? '50%' : pagesPerSheet === 4 ? '75%' : '80%+'} paper
                      </span>
                    )}
                  </div>
                  <div className="grid grid-cols-4 gap-1.5 text-center mb-2">
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
                        className={`p-1.5 rounded-lg border text-center transition-colors ${
                          pagesPerSheet === opt.val
                            ? 'bg-[#00bf63]/10 border-[#00bf63] text-gray-900 font-bold'
                            : 'bg-white border-gray-200 text-gray-600 hover:bg-gray-50'
                        }`}
                      >
                        <b className="block text-xs leading-tight">{opt.label}</b>
                        <span className="text-[9px] text-gray-400 block">{opt.desc}</span>
                      </button>
                    ))}
                  </div>

                  {pagesPerSheet > 1 && (
                    <div className="flex items-center justify-between pt-1.5 border-t border-gray-200 text-xs">
                      <span className="text-gray-600 text-[11px]">Cutting border line:</span>
                      <button
                        type="button"
                        onClick={() => setMiniBorder(!miniBorder)}
                        className={`px-2 py-0.5 rounded text-[10px] font-bold transition-colors ${
                          miniBorder ? 'bg-[#00bf63] text-white' : 'bg-gray-200 text-gray-700'
                        }`}
                      >
                        {miniBorder ? 'Border ON' : 'Border OFF'}
                      </button>
                    </div>
                  )}

                  <span className="text-[10px] text-gray-500 mt-1.5 block text-center">
                    Total Sheets to print: <strong>{calculatedSheets}</strong>
                  </span>
                </div>
              </CardContent>
            </Card>

            {/* Navigation Buttons */}
            <div className="flex gap-2.5">
              <Button
                variant="outline"
                onClick={() => setStep(1)}
                className="flex-1 bg-white border-gray-300 py-5 rounded-xl font-bold text-xs shadow-none"
              >
                ← Back
              </Button>
              <Button
                onClick={() => setStep(3)}
                className="flex-1 bg-[#00bf63] hover:bg-[#00a656] text-white py-5 rounded-xl font-bold text-xs shadow-none"
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
          <div className="space-y-3 animate-in fade-in duration-200">
            <Card className="bg-white border border-gray-200 rounded-2xl shadow-none p-5 space-y-4">
              {/* 1. Color Mode Toggle Cards */}
              <div>
                <label className="block text-xs font-bold text-gray-800 mb-1.5">Color Mode</label>
                <div className="grid grid-cols-2 gap-2.5">
                  <div
                    onClick={() => setColorMode('bw')}
                    className={`p-3.5 rounded-xl border-2 cursor-pointer transition-colors ${
                      colorMode === 'bw'
                        ? 'border-[#00bf63] bg-[#00bf63]/5'
                        : 'border-gray-200 hover:border-gray-300'
                    }`}
                  >
                    <div className="text-xl mb-0.5">⬛</div>
                    <b className="text-xs font-bold text-gray-900 block">Black & White</b>
                    <span className="text-[11px] text-gray-500">৳{PRICE_BW.toFixed(2)}/page</span>
                  </div>

                  <div
                    onClick={() => {
                      setColorMode('color')
                      setDuplex(false)
                    }}
                    className={`p-3.5 rounded-xl border-2 cursor-pointer transition-colors ${
                      colorMode === 'color'
                        ? 'border-[#00bf63] bg-[#00bf63]/5'
                        : 'border-gray-200 hover:border-gray-300'
                    }`}
                  >
                    <div className="text-xl mb-0.5">🌈</div>
                    <b className="text-xs font-bold text-gray-900 block">Color Print</b>
                    <span className="text-[11px] text-gray-500">৳{PRICE_COLOR.toFixed(2)}/page</span>
                  </div>
                </div>
              </div>

              {/* 2. Copies & Duplex */}
              <div className="flex items-center justify-between py-2.5 border-t border-b border-gray-100">
                <span className="text-xs font-bold text-gray-900">📑 Copies</span>
                <div className="flex items-center gap-2">
                  <Button
                    size="icon"
                    variant="outline"
                    className="h-7 w-7 rounded-lg border-gray-200 shadow-none text-xs"
                    onClick={() => setCopies((c) => Math.max(1, c - 1))}
                    disabled={copies <= 1}
                  >
                    -
                  </Button>
                  <span className="font-bold text-sm min-w-[20px] text-center">{copies}</span>
                  <Button
                    size="icon"
                    variant="outline"
                    className="h-7 w-7 rounded-lg border-gray-200 shadow-none text-xs"
                    onClick={() => setCopies((c) => c + 1)}
                  >
                    +
                  </Button>
                </div>
              </div>

              <div className="flex items-center justify-between py-0.5">
                <div>
                  <div className="flex items-center gap-1.5">
                    <b className={`text-xs font-bold block ${colorMode === 'color' ? 'text-gray-400' : 'text-gray-900'}`}>
                      Dual-Side (Duplex)
                    </b>
                    {colorMode === 'color' && (
                      <span className="bg-gray-100 text-gray-500 text-[9px] font-semibold px-1.5 py-0.5 rounded border border-gray-200">
                        B&W Only
                      </span>
                    )}
                  </div>
                  <span className={`text-[10px] block ${colorMode === 'color' ? 'text-gray-400' : 'text-gray-500'}`}>
                    {colorMode === 'color' ? 'Color print supports single-side only' : 'Prints front and back'}
                  </span>
                </div>
                <button
                  type="button"
                  disabled={colorMode === 'color'}
                  onClick={() => {
                    if (colorMode !== 'color') {
                      setDuplex(!duplex)
                    }
                  }}
                  className={`w-11 h-6 rounded-full transition-colors relative p-0.5 ${
                    colorMode === 'color'
                      ? 'bg-gray-100 cursor-not-allowed opacity-40'
                      : duplex
                      ? 'bg-[#00bf63] cursor-pointer'
                      : 'bg-gray-200 cursor-pointer'
                  }`}
                  title={colorMode === 'color' ? 'Dual-side printing is only supported for Black & White' : undefined}
                >
                  <span
                    className={`block w-5 h-5 rounded-full bg-white transition-transform ${
                      duplex && colorMode !== 'color' ? 'translate-x-5' : 'translate-x-0'
                    }`}
                  />
                </button>
              </div>

              {/* 3. Payment Method */}
              <div className="pt-2 border-t border-gray-100">
                <label className="block text-xs font-bold text-gray-800 mb-1.5">Select Payment</label>
                <div className="space-y-2">
                  <button
                    type="button"
                    onClick={() => setPaymentMethod('online')}
                    className={`w-full p-3 rounded-xl border-2 text-left flex items-center justify-between transition-colors ${
                      paymentMethod === 'online'
                        ? 'border-[#00bf63] bg-[#00bf63]/5'
                        : 'border-gray-200 hover:border-gray-300'
                    }`}
                  >
                    <div className="flex items-center gap-2.5">
                      <CreditCard className="h-4 w-4 text-[#00bf63]" />
                      <div>
                        <b className="text-xs font-bold text-gray-900 block">💳 Pay Online (bKash / Card)</b>
                        <span className="text-[10px] text-gray-500">Type A OTP — Valid at ALL Kiosks & Shops</span>
                      </div>
                    </div>
                    <span className="bg-[#00bf63]/10 text-[#00bf63] text-[9px] font-bold px-2 py-0.5 rounded">
                      Universal
                    </span>
                  </button>

                  <button
                    type="button"
                    onClick={() => setPaymentMethod('cash')}
                    disabled={deviceInfo?.type === 'kiosk'}
                    className={`w-full p-3 rounded-xl border-2 text-left flex items-center justify-between transition-colors ${
                      deviceInfo?.type === 'kiosk'
                        ? 'opacity-40 cursor-not-allowed bg-gray-50 border-gray-200'
                        : paymentMethod === 'cash'
                        ? 'border-[#00bf63] bg-[#00bf63]/5'
                        : 'border-gray-200 hover:border-gray-300'
                    }`}
                  >
                    <div className="flex items-center gap-2.5">
                      <Banknote className="h-4 w-4 text-gray-600" />
                      <div>
                        <b className="text-xs font-bold text-gray-900 block">💵 Pay at Counter (Cash)</b>
                        <span className="text-[10px] text-gray-500">
                          {deviceInfo?.type === 'kiosk'
                            ? 'Not available at unattended kiosk'
                            : 'Type B OTP — Valid at Partner Shops ONLY'}
                        </span>
                      </div>
                    </div>
                    <span className="border border-gray-300 text-gray-700 text-[9px] font-medium px-2 py-0.5 rounded">
                      Shop Only
                    </span>
                  </button>
                </div>
              </div>

              {/* Price Summary Breakdown */}
              <div className="bg-gray-50 rounded-xl p-3.5 space-y-1 text-xs text-gray-600 border border-gray-200">
                <div className="flex justify-between">
                  <span>Print Type:</span>
                  <strong className="text-gray-900">
                    {colorMode === 'color'
                      ? 'Full Color (Single-Side)'
                      : duplex
                      ? 'Black & White (Dual-Side)'
                      : 'Black & White (Single-Side)'}
                  </strong>
                </div>
                <div className="flex justify-between">
                  <span>Sheets to print:</span>
                  <strong className="text-gray-900">{calculatedSheets} sheets × {copies} copies</strong>
                </div>
                <div className="flex justify-between items-baseline pt-2 border-t border-gray-200 text-sm">
                  <b className="text-gray-900">Total Payable:</b>
                  <strong className="text-xl font-black text-[#00bf63]">৳{totalPrice}</strong>
                </div>
              </div>

              {/* Upload Progress Bar */}
              {isSubmitting && (
                <div className="space-y-1 animate-in fade-in duration-150">
                  <div className="flex justify-between text-[11px] font-bold text-gray-700">
                    <span>Uploading document...</span>
                    <span>{uploadProgress}%</span>
                  </div>
                  <div className="w-full h-2 bg-gray-200 rounded-full overflow-hidden">
                    <div
                      className="h-full bg-[#00bf63] transition-all duration-200"
                      style={{ width: `${uploadProgress}%` }}
                    />
                  </div>
                </div>
              )}

              {submitError && (
                <div className="p-2.5 bg-red-50 text-red-700 rounded-lg text-xs flex items-center gap-2">
                  <AlertCircle className="h-4 w-4 flex-shrink-0" />
                  <span>{submitError}</span>
                </div>
              )}
            </Card>

            {/* Navigation & Submit Button */}
            <div className="flex gap-2.5">
              <Button
                variant="outline"
                onClick={() => setStep(2)}
                className="flex-1 bg-white border-gray-300 py-5 rounded-xl font-bold text-xs shadow-none"
              >
                ← Back
              </Button>
              <Button
                disabled={isSubmitting}
                onClick={handleCreateOrder}
                className="flex-1 bg-[#00bf63] hover:bg-[#00a656] text-white py-5 rounded-xl font-bold text-xs shadow-none"
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
        {/* STEP 4: PRINT TICKET & 6-DIGIT OTP SCREEN (Minimal) */}
        {/* ========================================================================= */}
        {step === 4 && ticketOtp && (
          <div className="space-y-3 animate-in zoom-in duration-200">
            <Card className="bg-[#111827] text-white rounded-2xl p-6 sm:p-7 text-center border border-gray-800 shadow-none">
              <div className="text-3xl mb-1">🎉</div>
              <h2 className="text-xl font-bold text-white mb-0.5">
                Print Order Placed!
              </h2>
              <p className="text-xs text-gray-400 mb-5">
                Enter this 6-digit code on the machine keypad to release your print.
              </p>

              {/* Main 6-Digit Numerical OTP Box */}
              <div className="bg-white text-gray-900 rounded-2xl p-6 max-w-xs mx-auto border border-gray-200">
                <span className="text-[10px] uppercase tracking-wider font-bold text-gray-400 block mb-2">
                  Redemption OTP Code
                </span>
                <div className="flex items-center justify-center gap-2 mb-3">
                  <span className="text-4xl sm:text-5xl font-mono font-black tracking-widest text-[#00bf63]">
                    {ticketOtp.code}
                  </span>
                  <button
                    onClick={handleCopyOtp}
                    className="p-1.5 text-gray-400 hover:text-[#00bf63] hover:bg-gray-100 rounded-lg transition-colors"
                    title="Copy 6-Digit OTP"
                  >
                    {copied ? <Check className="h-5 w-5 text-[#00bf63]" /> : <Copy className="h-5 w-5" />}
                  </button>
                </div>

                <span className={`inline-block text-[10px] font-bold px-3 py-1 rounded-full ${
                  ticketOtp.otp_type === 'type_a'
                    ? 'bg-[#00bf63]/10 text-[#00bf63]'
                    : 'bg-amber-100 text-amber-800'
                }`}>
                  {ticketOtp.otp_type === 'type_a' ? 'Valid at Kiosks & Shops' : 'Valid at Partner Shops Only'}
                </span>

                <div className="mt-4 pt-3 border-t border-gray-100 text-left space-y-2">
                  <div className="flex items-center gap-2 text-[11px] text-gray-600">
                    <span className="w-4 h-4 rounded-full bg-gray-100 text-gray-700 font-bold flex items-center justify-center text-[10px] flex-shrink-0">1</span>
                    <span>Go to any nearby QuickInk station</span>
                  </div>
                  <div className="flex items-center gap-2 text-[11px] text-gray-600">
                    <span className="w-4 h-4 rounded-full bg-gray-100 text-gray-700 font-bold flex items-center justify-center text-[10px] flex-shrink-0">2</span>
                    <span>Type this 6-digit code on keypad</span>
                  </div>
                  <div className="flex items-center gap-2 text-[11px] text-gray-600">
                    <span className="w-4 h-4 rounded-full bg-gray-100 text-gray-700 font-bold flex items-center justify-center text-[10px] flex-shrink-0">3</span>
                    <span>Collect your printed pages</span>
                  </div>
                </div>
              </div>

              {/* Countdown & Realtime Status */}
              <div className="flex items-center justify-center gap-3 mt-5 text-xs text-gray-300">
                <div className="flex items-center gap-1.5 bg-black/40 px-3 py-1 rounded-full border border-gray-800">
                  <Clock className="h-3.5 w-3.5 text-[#00bf63]" />
                  <span>Expires in: <strong>{formatTime(timeLeft)}</strong></span>
                </div>
                <div className="flex items-center gap-1.5 bg-black/40 px-3 py-1 rounded-full border border-gray-800">
                  <span className="w-1.5 h-1.5 rounded-full bg-[#00bf63]" />
                  <span className="capitalize">{liveStatus.replace('_', ' ')}</span>
                </div>
              </div>
            </Card>

            <div className="flex gap-2.5">
              <Link href="/find-printer" className="flex-1">
                <Button className="w-full bg-[#00bf63] hover:bg-[#00a656] py-5 rounded-xl font-bold text-xs text-white shadow-none">
                  <MapPin className="mr-1 h-3.5 w-3.5" /> Find Nearest Kiosk
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
                className="bg-white border-gray-300 py-5 rounded-xl font-bold text-xs shadow-none text-gray-700"
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
