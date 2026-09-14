'use client'

import { useState, useEffect, useRef } from 'react'
import Link from 'next/link'
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
  Layers
} from 'lucide-react'

export default function PrintOrderPage() {
  // Wizard steps: 'upload' | 'customize' | 'payment' | 'ticket'
  const [step, setStep] = useState('upload')

  // Document state
  const [selectedFile, setSelectedFile] = useState(null)
  const [filePreviewUrl, setFilePreviewUrl] = useState(null)
  const [isScannerOpen, setIsScannerOpen] = useState(false)

  // Print settings
  const [pageCount, setPageCount] = useState(1)
  const [copies, setCopies] = useState(1)
  const [colorMode, setColorMode] = useState('bw') // 'bw' | 'color'
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
  const [timeLeft, setTimeLeft] = useState(3600) // 60 minutes countdown
  const [liveStatus, setLiveStatus] = useState('awaiting_redemption')

  const fileInputRef = useRef(null)

  // Pricing constants (in BDT ৳)
  const PRICE_BW = 2.0
  const PRICE_COLOR = 8.0
  const unitPrice = colorMode === 'color' ? PRICE_COLOR : PRICE_BW
  const totalPrice = (unitPrice * pageCount * copies).toFixed(2)

  // Countdown timer for active ticket
  useEffect(() => {
    if (step !== 'ticket' || !ticketOtp) return

    const timer = setInterval(() => {
      setTimeLeft((prev) => {
        if (prev <= 1) {
          clearInterval(timer)
          return 0
        }
        return prev - 1
      })
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
          dark: '#1e3a8a',
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

    // Rough page count estimation for demo or default 1
    if (file.type.includes('pdf')) {
      setPageCount(1)
    } else {
      setPageCount(1)
    }

    if (file.type.startsWith('image/')) {
      const url = URL.createObjectURL(file)
      setFilePreviewUrl(url)
    } else {
      setFilePreviewUrl(null)
    }
    setStep('customize')
  }

  // Handle scanner completion
  const handleScannerComplete = ({ file, pageCount: scannedPages, previewUrl }) => {
    setSelectedFile(file)
    setPageCount(scannedPages)
    setFilePreviewUrl(previewUrl)
    setSubmitError(null)
    setStep('customize')
  }

  // Copy OTP Code to clipboard
  const handleCopyOtp = () => {
    if (!ticketOtp?.code) return
    navigator.clipboard.writeText(ticketOtp.code)
    setCopied(true)
    setTimeout(() => setCopied(false), 2000)
  }

  // Submit and upload order
  const handleCreateOrder = async () => {
    if (!selectedFile) {
      setSubmitError('Please select or scan a document first.')
      return
    }

    setIsSubmitting(true)
    setSubmitError(null)

    try {
      // 1. Upload document file to Supabase Storage 'print-files'
      const fileExt = selectedFile.name.split('.').pop() || 'pdf'
      const cleanFileName = selectedFile.name.replace(/[^a-zA-Z0-9.-]/g, '_')
      const storagePath = `jobs/${Date.now()}_${cleanFileName}`

      const { error: uploadError } = await supabase.storage
        .from('print-files')
        .upload(storagePath, selectedFile, {
          contentType: selectedFile.type || 'application/pdf',
          upsert: true,
        })

      if (uploadError) {
        console.warn('Storage upload error (proceeding with relative path):', uploadError.message)
      }

      // 2. Call server-side order creation route
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
          page_count: pageCount,
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
      setStep('ticket')
    } catch (err) {
      console.error('Order creation error:', err)
      setSubmitError(err.message || 'An unexpected error occurred while placing order')
    } finally {
      setIsSubmitting(false)
    }
  }

  // Helper formatting for countdown
  const formatTime = (seconds) => {
    const mins = Math.floor(seconds / 60)
    const secs = seconds % 60
    return `${mins.toString().padStart(2, '0')}:${secs.toString().padStart(2, '0')}`
  }

  return (
    <div className="min-h-screen bg-gradient-to-br from-slate-50 via-blue-50/40 to-indigo-50/30 pt-24 pb-16">
      <div className="container mx-auto px-4 sm:px-6 lg:px-8 max-w-4xl">
        {/* Header Title */}
        <div className="text-center mb-10">
          <Badge className="mb-3 bg-blue-100 text-blue-700 hover:bg-blue-100 px-4 py-1.5 font-medium">
            <Sparkles className="h-3.5 w-3.5 mr-1.5 inline" />
            Upload → Pay → Print in 60s
          </Badge>
          <h1 className="text-3xl sm:text-5xl font-extrabold text-gray-900 tracking-tight mb-3">
            Print Your Documents
          </h1>
          <p className="text-base sm:text-lg text-gray-600 max-w-xl mx-auto">
            Scan notes with your phone camera or upload PDFs. Pick up at any nearby QuickInk kiosk or partner shop.
          </p>
        </div>

        {/* ========================================================================= */}
        {/* STEP 1: UPLOAD OR SCAN WITH CAMERA */}
        {/* ========================================================================= */}
        {step === 'upload' && (
          <div className="space-y-6">
            <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
              {/* Option 1: CamScanner Mobile Camera */}
              <Card
                onClick={() => setIsScannerOpen(true)}
                className="group relative overflow-hidden border-2 border-blue-500/30 hover:border-blue-600 hover:shadow-xl transition-all duration-300 cursor-pointer bg-white"
              >
                <div className="absolute top-0 right-0 bg-blue-600 text-white text-[11px] font-semibold px-3 py-1 rounded-bl-xl uppercase tracking-wider flex items-center gap-1">
                  <Sparkles className="h-3 w-3" /> CamScanner Mode
                </div>
                <CardContent className="p-8 text-center flex flex-col items-center justify-center min-h-[260px]">
                  <div className="w-16 h-16 rounded-2xl bg-blue-50 text-blue-600 flex items-center justify-center mb-5 group-hover:scale-110 group-hover:bg-blue-600 group-hover:text-white transition-all duration-300 shadow-sm">
                    <Camera className="h-8 w-8" />
                  </div>
                  <h3 className="text-xl font-bold text-gray-900 mb-2">Scan with Camera</h3>
                  <p className="text-sm text-gray-500 mb-5 max-w-xs">
                    Snap photos of physical documents, notes, or IDs. Includes auto-enhancement filters.
                  </p>
                  <Button className="bg-blue-600 hover:bg-blue-700 text-white group-hover:shadow-md">
                    Open Camera Scanner <ArrowRight className="ml-2 h-4 w-4" />
                  </Button>
                </CardContent>
              </Card>

              {/* Option 2: Upload File */}
              <Card
                onClick={() => fileInputRef.current?.click()}
                className="group relative overflow-hidden border-2 border-gray-200 hover:border-indigo-500 hover:shadow-xl transition-all duration-300 cursor-pointer bg-white"
              >
                <CardContent className="p-8 text-center flex flex-col items-center justify-center min-h-[260px]">
                  <input
                    ref={fileInputRef}
                    type="file"
                    accept=".pdf,.doc,.docx,.jpg,.jpeg,.png"
                    onChange={handleFileChange}
                    className="hidden"
                  />
                  <div className="w-16 h-16 rounded-2xl bg-indigo-50 text-indigo-600 flex items-center justify-center mb-5 group-hover:scale-110 group-hover:bg-indigo-600 group-hover:text-white transition-all duration-300 shadow-sm">
                    <Upload className="h-8 w-8" />
                  </div>
                  <h3 className="text-xl font-bold text-gray-900 mb-2">Upload Existing File</h3>
                  <p className="text-sm text-gray-500 mb-5 max-w-xs">
                    Drop your PDF, Word document, or images directly from your device.
                  </p>
                  <Button variant="outline" className="border-gray-300 text-gray-700 group-hover:border-indigo-600">
                    Browse Files <ChevronRight className="ml-1 h-4 w-4" />
                  </Button>
                </CardContent>
              </Card>
            </div>

            {/* Price Banner */}
            <div className="bg-white rounded-2xl p-5 border border-gray-200/80 shadow-sm flex flex-col sm:flex-row items-center justify-between gap-4">
              <div className="flex items-center gap-4">
                <div className="p-3 bg-blue-50 text-blue-600 rounded-xl">
                  <Printer className="h-6 w-6" />
                </div>
                <div>
                  <h4 className="font-semibold text-gray-900">Affordable & Transparent Rates</h4>
                  <p className="text-xs sm:text-sm text-gray-500">
                    Black & White from <strong className="text-gray-800">৳2/page</strong> • Full Color from{' '}
                    <strong className="text-gray-800">৳8/page</strong>
                  </p>
                </div>
              </div>
              <div className="flex items-center gap-2 text-xs text-gray-500">
                <ShieldCheck className="h-4 w-4 text-green-600" /> Files auto-deleted after printing
              </div>
            </div>
          </div>
        )}

        {/* ========================================================================= */}
        {/* STEP 2: CUSTOMIZATION & PAYMENT WIZARD */}
        {/* ========================================================================= */}
        {step === 'customize' && selectedFile && (
          <div className="space-y-6">
            {/* Selected File Card */}
            <div className="bg-white rounded-2xl p-5 border border-gray-200 shadow-sm flex flex-col sm:flex-row items-center justify-between gap-4">
              <div className="flex items-center gap-4">
                <div className="p-3 bg-blue-100 text-blue-700 rounded-xl flex-shrink-0">
                  <FileText className="h-7 w-7" />
                </div>
                <div className="min-w-0">
                  <h4 className="font-bold text-gray-900 truncate max-w-xs sm:max-w-md">{selectedFile.name}</h4>
                  <p className="text-xs text-gray-500">
                    {(selectedFile.size / 1024).toFixed(1)} KB • {pageCount} {pageCount === 1 ? 'Page' : 'Pages'}
                  </p>
                </div>
              </div>

              <div className="flex items-center gap-2">
                <Button
                  variant="outline"
                  size="sm"
                  onClick={() => {
                    setSelectedFile(null)
                    setStep('upload')
                  }}
                  className="text-xs"
                >
                  Change Document
                </Button>
              </div>
            </div>

            {/* Settings & Calculator Card */}
            <Card className="border border-gray-200 shadow-md bg-white">
              <CardContent className="p-6 sm:p-8 space-y-8">
                {/* 1. Color Mode Selection */}
                <div>
                  <label className="block text-sm font-bold text-gray-900 mb-3">Color Mode</label>
                  <div className="grid grid-cols-2 gap-4">
                    <button
                      type="button"
                      onClick={() => setColorMode('bw')}
                      className={`p-4 rounded-xl border-2 text-left transition-all ${
                        colorMode === 'bw'
                          ? 'border-blue-600 bg-blue-50/50 shadow-sm'
                          : 'border-gray-200 hover:border-gray-300'
                      }`}
                    >
                      <div className="flex items-center justify-between mb-1">
                        <span className="font-bold text-gray-900">Black & White</span>
                        <Badge className="bg-gray-200 text-gray-800 hover:bg-gray-200 text-xs">৳2.00 / page</Badge>
                      </div>
                      <p className="text-xs text-gray-500">Ideal for assignments, articles, and text notes</p>
                    </button>

                    <button
                      type="button"
                      onClick={() => setColorMode('color')}
                      className={`p-4 rounded-xl border-2 text-left transition-all ${
                        colorMode === 'color'
                          ? 'border-blue-600 bg-blue-50/50 shadow-sm'
                          : 'border-gray-200 hover:border-gray-300'
                      }`}
                    >
                      <div className="flex items-center justify-between mb-1">
                        <span className="font-bold text-gray-900">Full Color</span>
                        <Badge className="bg-indigo-100 text-indigo-700 hover:bg-indigo-100 text-xs">
                          ৳8.00 / page
                        </Badge>
                      </div>
                      <p className="text-xs text-gray-500">Ideal for presentations, photos, and certificates</p>
                    </button>
                  </div>
                </div>

                {/* 2. Page Count & Copies */}
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-6">
                  {/* Page Count */}
                  <div>
                    <label className="block text-sm font-bold text-gray-900 mb-2">Total Document Pages</label>
                    <div className="flex items-center gap-3">
                      <Button
                        type="button"
                        variant="outline"
                        size="icon"
                        onClick={() => setPageCount((prev) => Math.max(1, prev - 1))}
                        disabled={pageCount <= 1}
                      >
                        -
                      </Button>
                      <span className="text-xl font-bold w-12 text-center text-gray-900">{pageCount}</span>
                      <Button
                        type="button"
                        variant="outline"
                        size="icon"
                        onClick={() => setPageCount((prev) => prev + 1)}
                      >
                        +
                      </Button>
                    </div>
                    <p className="text-xs text-gray-400 mt-1.5">Adjust if your PDF has more pages</p>
                  </div>

                  {/* Copies */}
                  <div>
                    <label className="block text-sm font-bold text-gray-900 mb-2">Number of Copies</label>
                    <div className="flex items-center gap-3">
                      <Button
                        type="button"
                        variant="outline"
                        size="icon"
                        onClick={() => setCopies((prev) => Math.max(1, prev - 1))}
                        disabled={copies <= 1}
                      >
                        -
                      </Button>
                      <span className="text-xl font-bold w-12 text-center text-gray-900">{copies}</span>
                      <Button type="button" variant="outline" size="icon" onClick={() => setCopies((prev) => prev + 1)}>
                        +
                      </Button>
                    </div>
                    <p className="text-xs text-gray-400 mt-1.5">Total copies to print</p>
                  </div>
                </div>

                {/* 3. Duplex / 2-Sided Printing */}
                <div className="pt-2 border-t border-gray-100">
                  <div className="flex items-center justify-between">
                    <div>
                      <h4 className="text-sm font-bold text-gray-900">Double-Sided Printing (Duplex)</h4>
                      <p className="text-xs text-gray-500">Prints on both sides of the sheet (Eco-friendly)</p>
                    </div>
                    <button
                      type="button"
                      onClick={() => setDuplex(!duplex)}
                      className={`relative inline-flex h-6 w-11 flex-shrink-0 cursor-pointer rounded-full border-2 border-transparent transition-colors duration-200 ease-in-out focus:outline-none ${
                        duplex ? 'bg-blue-600' : 'bg-gray-200'
                      }`}
                    >
                      <span
                        className={`pointer-events-none inline-block h-5 w-5 transform rounded-full bg-white shadow ring-0 transition duration-200 ease-in-out ${
                          duplex ? 'translate-x-5' : 'translate-x-0'
                        }`}
                      />
                    </button>
                  </div>
                </div>

                {/* 4. Payment Method Choice */}
                <div className="pt-2 border-t border-gray-100">
                  <label className="block text-sm font-bold text-gray-900 mb-3">Payment Method & Pickup</label>
                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                    {/* Option Online -> Type A OTP */}
                    <button
                      type="button"
                      onClick={() => setPaymentMethod('online')}
                      className={`p-4 rounded-xl border-2 text-left transition-all ${
                        paymentMethod === 'online'
                          ? 'border-blue-600 bg-blue-50/50 shadow-sm'
                          : 'border-gray-200 hover:border-gray-300'
                      }`}
                    >
                      <div className="flex items-center gap-2 mb-2">
                        <CreditCard className="h-5 w-5 text-blue-600" />
                        <span className="font-bold text-gray-900">Pay Online</span>
                        <Badge className="bg-emerald-100 text-emerald-800 text-[10px] ml-auto">Kiosk + Shop</Badge>
                      </div>
                      <p className="text-xs text-gray-500">
                        Pay via bKash, Nagad, or Card. Generates <strong>Type A OTP</strong> valid at{' '}
                        <strong className="text-blue-700">both Kiosks and Shops</strong>.
                      </p>
                    </button>

                    {/* Option Cash -> Type B OTP */}
                    <button
                      type="button"
                      onClick={() => setPaymentMethod('cash')}
                      className={`p-4 rounded-xl border-2 text-left transition-all ${
                        paymentMethod === 'cash'
                          ? 'border-amber-600 bg-amber-50/40 shadow-sm'
                          : 'border-gray-200 hover:border-gray-300'
                      }`}
                    >
                      <div className="flex items-center gap-2 mb-2">
                        <Banknote className="h-5 w-5 text-amber-600" />
                        <span className="font-bold text-gray-900">Pay Cash at Counter</span>
                        <Badge variant="outline" className="border-amber-400 text-amber-800 text-[10px] ml-auto">
                          Shop ONLY
                        </Badge>
                      </div>
                      <p className="text-xs text-amber-700">
                        Generates <strong>Type B OTP</strong>. Valid at{' '}
                        <strong>Partner Print Shops only</strong> (Unattended kiosks cannot accept cash).
                      </p>
                    </button>
                  </div>
                </div>

                {/* 5. Summary & Total Price Card */}
                <div className="bg-slate-900 text-white rounded-2xl p-6 flex flex-col sm:flex-row items-center justify-between gap-4 shadow-lg">
                  <div>
                    <span className="text-xs uppercase tracking-wider text-slate-400">Total Price</span>
                    <div className="text-3xl font-extrabold text-white flex items-baseline gap-1">
                      ৳{totalPrice}
                      <span className="text-xs text-slate-400 font-normal">
                        ({pageCount} pgs × {copies} copy × ৳{unitPrice})
                      </span>
                    </div>
                  </div>

                  <Button
                    size="lg"
                    disabled={isSubmitting}
                    onClick={handleCreateOrder}
                    className="w-full sm:w-auto px-8 py-6 bg-blue-600 hover:bg-blue-500 text-white text-lg font-bold shadow-xl shadow-blue-500/30 transition-all hover:scale-105"
                  >
                    {isSubmitting ? (
                      <>
                        <RefreshCw className="mr-2 h-5 w-5 animate-spin" /> Preparing Ticket...
                      </>
                    ) : (
                      <>
                        Confirm & Get OTP <ArrowRight className="ml-2 h-5 w-5" />
                      </>
                    )}
                  </Button>
                </div>

                {submitError && (
                  <div className="p-4 rounded-xl bg-red-50 border border-red-200 text-red-700 text-sm flex items-center gap-2">
                    <AlertCircle className="h-5 w-5 flex-shrink-0" />
                    <span>{submitError}</span>
                  </div>
                )}
              </CardContent>
            </Card>
          </div>
        )}

        {/* ========================================================================= */}
        {/* STEP 3: TICKET & LIVE REDEMPTION SCREEN */}
        {/* ========================================================================= */}
        {step === 'ticket' && ticketOtp && (
          <div className="space-y-6 animate-in fade-in zoom-in duration-500">
            {/* Success Celebration Card */}
            <div className="bg-gradient-to-br from-blue-600 via-indigo-600 to-purple-700 rounded-3xl p-6 sm:p-10 text-white shadow-2xl relative overflow-hidden text-center">
              <div className="absolute top-0 right-0 w-64 h-64 bg-white/10 rounded-full blur-3xl pointer-events-none"></div>

              <div className="inline-flex items-center gap-2 bg-white/20 backdrop-blur-md px-4 py-1.5 rounded-full text-xs font-semibold mb-4">
                <CheckCircle2 className="h-4 w-4 text-emerald-300" />
                <span>Ready for Instant Printing</span>
              </div>

              <h2 className="text-2xl sm:text-4xl font-extrabold mb-2">Here is Your Print Ticket</h2>
              <p className="text-blue-100 text-sm sm:text-base max-w-md mx-auto mb-8">
                Type this code on the kiosk touch screen or show the QR code to print in 60 seconds.
              </p>

              {/* Main OTP Code Box */}
              <div className="max-w-md mx-auto bg-white rounded-3xl p-6 sm:p-8 text-gray-900 shadow-2xl">
                <span className="text-xs uppercase tracking-wider font-semibold text-gray-400 block mb-2">
                  Redemption OTP Code
                </span>

                <div className="flex items-center justify-center gap-3 mb-4">
                  <span className="text-4xl sm:text-5xl font-mono font-black tracking-wider text-blue-600">
                    {ticketOtp.code}
                  </span>
                  <Button
                    size="icon"
                    variant="ghost"
                    onClick={handleCopyOtp}
                    className="rounded-full hover:bg-blue-50 text-gray-500 hover:text-blue-600"
                    title="Copy Code"
                  >
                    {copied ? <Check className="h-5 w-5 text-green-600" /> : <Copy className="h-5 w-5" />}
                  </Button>
                </div>

                {/* OTP Type Eligibility Badge */}
                <div className="mb-6">
                  {ticketOtp.otp_type === 'type_a' ? (
                    <Badge className="bg-emerald-100 text-emerald-800 hover:bg-emerald-100 px-3 py-1 text-xs">
                      Type A: Valid at ALL Kiosks & Partner Shops
                    </Badge>
                  ) : (
                    <Badge className="bg-amber-100 text-amber-800 hover:bg-amber-100 px-3 py-1 text-xs border border-amber-300">
                      Type B: Valid at Partner Shops ONLY (Cash on Delivery)
                    </Badge>
                  )}
                </div>

                {/* QR Code */}
                {qrCodeDataUrl && (
                  <div className="flex flex-col items-center justify-center pt-4 border-t border-gray-100">
                    <div className="p-3 bg-white border border-gray-200 rounded-2xl shadow-inner mb-2">
                      <img src={qrCodeDataUrl} alt="QuickInk Redemption QR Code" className="w-48 h-48 sm:w-52 sm:h-52" />
                    </div>
                    <span className="text-xs text-gray-400">Scan at kiosk QR scanner</span>
                  </div>
                )}
              </div>

              {/* Countdown & Live Status Row */}
              <div className="mt-8 flex flex-wrap items-center justify-center gap-4 text-xs sm:text-sm">
                <div className="bg-black/20 backdrop-blur-sm px-4 py-2 rounded-xl flex items-center gap-2">
                  <Clock className="h-4 w-4 text-blue-200" />
                  <span>Expires in: <strong>{formatTime(timeLeft)}</strong></span>
                </div>

                <div className="bg-black/20 backdrop-blur-sm px-4 py-2 rounded-xl flex items-center gap-2">
                  <span className="w-2 h-2 rounded-full bg-emerald-400 animate-ping"></span>
                  <span>
                    Status:{' '}
                    <strong className="capitalize text-emerald-300">
                      {liveStatus === 'awaiting_redemption'
                        ? 'Awaiting pickup'
                        : liveStatus === 'redeemed'
                        ? 'Printing now...'
                        : liveStatus}
                    </strong>
                  </span>
                </div>
              </div>
            </div>

            {/* Actions Bar */}
            <div className="flex flex-col sm:flex-row items-center justify-center gap-4">
              <Link href="/find-printer" className="w-full sm:w-auto">
                <Button size="lg" className="w-full bg-blue-600 hover:bg-blue-700 text-white px-8 py-6 text-base font-bold shadow-lg">
                  <MapPin className="mr-2 h-5 w-5" /> Find Nearest Kiosk / Shop
                </Button>
              </Link>
              <Button
                size="lg"
                variant="outline"
                onClick={() => {
                  setSelectedFile(null)
                  setTicketOrder(null)
                  setTicketOtp(null)
                  setStep('upload')
                }}
                className="w-full sm:w-auto border-gray-300 hover:bg-gray-100 py-6 text-base"
              >
                Print Another Document
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
