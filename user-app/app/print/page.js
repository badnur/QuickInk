'use client'

import { useState, useEffect, useRef, Suspense } from 'react'
import Link from 'next/link'
import { useSearchParams } from 'next/navigation'
import { supabase } from '@/lib/supabase'
import DocumentScannerModal from '@/components/scanner/DocumentScannerModal'
import SmartScannerModal from '@/components/print/SmartScannerModal'
import PassportPhotoModal from '@/components/print/PassportPhotoModal'
import IdCardScannerModal from '@/components/print/IdCardScannerModal'
import { playCompletionChime } from '@/lib/audio-chime'
import { loadPdfDocument, renderPdfPageToDataUrl, slicePdfBlob, fastScanPdfPages, mergeFilesToPdf, applyPrintAdjustments } from '@/lib/pdf-utils'
import { useLanguage } from '@/context/LanguageContext'
import PrintFeedbackBox from '@/components/print/PrintFeedbackBox'
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
  SlidersHorizontal,
  Crop
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
    <Suspense fallback={<div className="min-h-screen flex items-center justify-center text-gray-500 font-medium">Loading PrintKoro Print Station...</div>}>
      <PrintOrderPageContent initialDeviceId={initialDeviceId} />
    </Suspense>
  )
}

function PrintOrderPageContent({ initialDeviceId }) {
  const { t, lang, toBengaliNumber } = useLanguage()
  const searchParams = useSearchParams()
  const activeDeviceId = initialDeviceId || searchParams.get('device')

  // Target device/kiosk info
  const [deviceInfo, setDeviceInfo] = useState(null)
  const [loadingDevice, setLoadingDevice] = useState(false)

  // Zone/Tier pricing — updated when a device is selected via ?device= param
  // Defaults to Standard pricing until a specific device zone is loaded
  const [zonePrices, setZonePrices] = useState({
    bw: 2.0,
    color: 8.0,
    tierName: 'Standard',
    tierId: null,
    isLoaded: false,  // false = using defaults (no device scanned yet)
  })

  // Wizard Step: 1 = Hub & Upload, 2 = Preview & Range, 3 = Options, 4 = Ticket
  const [step, setStep] = useState(1)

  // Service modality ('doc' | 'scanner' | 'mini' | 'photo4x6' | 'idCard')
  const [serviceType, setServiceType] = useState('doc')

  // Modals state
  const [isScannerOpen, setIsScannerOpen] = useState(false)
  const [scannerInitialMode, setScannerInitialMode] = useState(null)
  const [scannerInitialImage, setScannerInitialImage] = useState(null)
  const [isPassportModalOpen, setIsPassportModalOpen] = useState(false)
  const [isIdCardModalOpen, setIsIdCardModalOpen] = useState(false)

  // Document state
  const [selectedFile, setSelectedFile] = useState(null)
  const [selectedFiles, setSelectedFiles] = useState([])
  const [isMergingFiles, setIsMergingFiles] = useState(false)
  const appendModeRef = useRef(false)
  const [filePreviewUrl, setFilePreviewUrl] = useState(null)
  const [showChoiceScreen, setShowChoiceScreen] = useState(false)
  const [previewPageIndex, setPreviewPageIndex] = useState(1)
  const [pdfDoc, setPdfDoc] = useState(null)
  const [pdfLibDoc, setPdfLibDoc] = useState(null)
  const [pagePreviewUrls, setPagePreviewUrls] = useState({})
  const [isAnalyzingPdf, setIsAnalyzingPdf] = useState(false)
  const [isRenderingPage, setIsRenderingPage] = useState(false)

  // Adjustment state
  const [rotation, setRotation] = useState(0) // 0, 90, 180, 270
  const [brightness, setBrightness] = useState(0) // -50 to 50
  const [contrast, setContrast] = useState(0) // -50 to 50
  const [printScale, setPrintScale] = useState(100) // 25 to 125, default 100%
  const [showAdjustControls, setShowAdjustControls] = useState(false)

  // Print settings
  const [totalPages, setTotalPages] = useState(1)
  const [pageRangeMode, setPageRangeMode] = useState('all') // 'all' | 'custom'
  const [fromPage, setFromPage] = useState(1)
  const [toPage, setToPage] = useState(1)
  const [pagesPerSheet, setPagesPerSheet] = useState(1) // 1, 2, 4, 6, 8
  const [miniBorder, setMiniBorder] = useState(true)
  const [colorMode, setColorMode] = useState('bw') // 'bw' | 'color'
  const [copies, setCopies] = useState(1)
  const [duplex, setDuplex] = useState(false)

  // Payment & Order state (Online disabled until kiosk launch; dynamic pay-at-counter only)
  const [paymentMethod, setPaymentMethod] = useState('cash')
  const [isSubmitting, setIsSubmitting] = useState(false)
  const [uploadProgress, setUploadProgress] = useState(0)
  const [submitError, setSubmitError] = useState(null)
  const [termsAccepted, setTermsAccepted] = useState(false)
  const [termsError, setTermsError] = useState(false)

  // Generated Ticket state
  const [ticketOrder, setTicketOrder] = useState(null)
  const [ticketOtp, setTicketOtp] = useState(null)
  const [copied, setCopied] = useState(false)
  const [timeLeft, setTimeLeft] = useState(3600)
  const [liveStatus, setLiveStatus] = useState('awaiting_redemption')

  const fileInputRef = useRef(null)

  // Direct step navigation helper for preview/testing
  useEffect(() => {
    if (searchParams.get('step') === '2') {
      const sampleSvg = `<svg xmlns="http://www.w3.org/2000/svg" width="600" height="380" viewBox="0 0 600 380"><rect width="600" height="380" rx="20" fill="#0f172a"/><rect x="25" y="25" width="550" height="330" rx="15" fill="#1e293b" stroke="#334155" stroke-width="2"/><circle cx="110" cy="150" r="50" fill="#38bdf8"/><text x="110" y="162" fill="#0f172a" font-size="36" font-weight="bold" text-anchor="middle" font-family="sans-serif">ID</text><text x="190" y="115" fill="#38bdf8" font-size="16" font-weight="bold" font-family="sans-serif">PEOPLES REPUBLIC</text><text x="190" y="145" fill="#ffffff" font-size="20" font-weight="bold" font-family="sans-serif">NATIONAL IDENTITY CARD</text><text x="190" y="185" fill="#cbd5e1" font-size="15" font-family="sans-serif">Name: SHAMSUZZAMAN NUR</text><text x="190" y="215" fill="#cbd5e1" font-size="14" font-family="sans-serif">ID: 1994 2819 0021</text><rect x="190" y="240" width="340" height="12" rx="4" fill="#00bf63"/></svg>`
      const sampleImg = `data:image/svg+xml;utf8,${encodeURIComponent(sampleSvg)}`
      setSelectedFile(new File([sampleSvg], 'ID_Card_Sample.svg', { type: 'image/svg+xml' }))
      setFilePreviewUrl(sampleImg)
      setTotalPages(1)
      setServiceType('idCard')
      setStep(2)
    } else if (searchParams.get('step') === '3') {
      setSelectedFile(new File(['Sample PrintKoro Document Content'], 'PrintKoro_Sample.pdf', { type: 'application/pdf' }))
      setStep(3)
    } else if (searchParams.get('step') === '4') {
      setSelectedFile(new File(['Sample PrintKoro Document Content'], 'PrintKoro_Sample.pdf', { type: 'application/pdf' }))
      setTicketOtp({ code: '582914', otp_type: 'type_a' })
      setStep(4)
    } else if (searchParams.get('scanner') === 'test') {
      const sampleSvg = `<svg xmlns="http://www.w3.org/2000/svg" width="600" height="900"><rect width="600" height="900" fill="#f8fafc" stroke="#e2e8f0" stroke-width="4"/><rect x="40" y="40" width="520" height="80" rx="12" fill="#0f172a"/><text x="300" y="90" fill="#ffffff" font-size="24" font-weight="bold" text-anchor="middle" font-family="sans-serif">STUDENT IDENTITY CARD</text><rect x="200" y="160" width="200" height="240" rx="12" fill="#cbd5e1"/><text x="300" y="285" fill="#475569" font-size="16" text-anchor="middle" font-family="sans-serif">[ Photo ]</text><text x="300" y="450" fill="#0f172a" font-size="22" font-weight="bold" text-anchor="middle" font-family="sans-serif">MD. SHAMSUZZAMAN NUR</text><text x="300" y="490" fill="#475569" font-size="16" text-anchor="middle" font-family="sans-serif">ID No : 2025227041</text><text x="300" y="525" fill="#475569" font-size="15" text-anchor="middle" font-family="sans-serif">Department of Physics</text><rect x="80" y="620" width="440" height="50" rx="6" fill="#0f172a"/></svg>`
      const sampleImg = `data:image/svg+xml;utf8,${encodeURIComponent(sampleSvg)}`
      setScannerInitialImage(sampleImg)
      setScannerInitialMode('idCard')
      setIsScannerOpen(true)
    }
  }, [searchParams])

  // Dynamic zone pricing — falls back to Standard if no device selected
  const unitPrice = colorMode === 'color' ? zonePrices.color : zonePrices.bw

  // Build effective page range string for API/print
  // Returns null when 'all pages', else a SumatraPDF-compatible range string like "2-20"
  const clampedFrom = Math.max(1, Math.min(fromPage || 1, totalPages))
  const clampedTo   = Math.max(clampedFrom, Math.min(toPage || totalPages, totalPages))
  const effectivePageRange = pageRangeMode === 'all' ? null : `${clampedFrom}-${clampedTo}`

  // Calculate effective printed sheets based on range and multi-page layout
  const selectedPagesCount = pageRangeMode === 'all' ? totalPages : Math.max(1, clampedTo - clampedFrom + 1)
  const calculatedSheets = Math.max(1, Math.ceil(selectedPagesCount / pagesPerSheet))
  const totalPrice = (calculatedSheets * unitPrice * copies).toFixed(2)

  // Fetch device details (+ zone pricing) if visiting via kiosk QR code (?device=UUID)
  useEffect(() => {
    if (!activeDeviceId) return

    async function fetchDevice() {
      setLoadingDevice(true)
      try {
        // Use the machines API so we get the pricing tier join for free
        const res = await fetch('/api/machines')
        const json = await res.json()
        const machine = json?.machines?.find((m) => m.id === activeDeviceId)

        if (machine) {
          setDeviceInfo(machine)
          setZonePrices({
            bw: parseFloat(machine.bw_price) || 2.0,
            color: parseFloat(machine.color_price) || 8.0,
            tierName: machine.tier_name || 'Standard',
            tierId: machine.tier_id || null,
            isLoaded: true,
          })
          // Kiosk terminals only accept online payment
          if (machine.type === 'kiosk') {
            setPaymentMethod('online')
          }
        } else {
          // Fallback: direct device query (no tier info)
          const { data, error } = await supabase
            .from('devices')
            .select('*')
            .eq('id', activeDeviceId)
            .single()
          if (!error && data) {
            setDeviceInfo(data)
            if (data.type === 'kiosk') setPaymentMethod('online')
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

  // Process single or multiple selected files
  const processSelectedFiles = async (filesList) => {
    if (!filesList || filesList.length === 0) {
      setSelectedFile(null)
      setSelectedFiles([])
      setFilePreviewUrl(null)
      setTotalPages(1)
      setFromPage(1)
      setToPage(1)
      setPdfDoc(null)
      setPdfLibDoc(null)
      setPagePreviewUrls({})
      setShowChoiceScreen(false)
      return
    }

    setSubmitError(null)
    setPreviewPageIndex(1)
    setRotation(0)
    setBrightness(0)
    setContrast(0)
    setPrintScale(100)
    setPdfDoc(null)
    setPdfLibDoc(null)
    setPagePreviewUrls({})

    // If only 1 image file
    if (filesList.length === 1 && filesList[0].type.startsWith('image/')) {
      const singleImage = filesList[0]
      setSelectedFile(singleImage)
      const url = URL.createObjectURL(singleImage)
      setFilePreviewUrl(url)
      setTotalPages(1)
      setFromPage(1)
      setToPage(1)
      setShowChoiceScreen(true)
      return
    }

    // Multiple files OR single PDF
    let activeFile = filesList[0]
    if (filesList.length > 1) {
      setIsMergingFiles(true)
      setIsAnalyzingPdf(true)
      setShowChoiceScreen(true)
      try {
        const merged = await mergeFilesToPdf(filesList)
        if (merged) activeFile = merged
      } catch (mergeErr) {
        console.warn('Failed to merge files, using first file:', mergeErr)
      } finally {
        setIsMergingFiles(false)
      }
    }

    setSelectedFile(activeFile)
    const isPdf = activeFile.type === 'application/pdf' || activeFile.name.toLowerCase().endsWith('.pdf')

    if (isPdf) {
      setFilePreviewUrl(null)
      setIsAnalyzingPdf(true)
      setTotalPages(1)
      setFromPage(1)
      setToPage(1)
      setShowChoiceScreen(true)

      // Step 1: Ultra-fast binary scan (< 15ms) to immediately set multi-page count
      fastScanPdfPages(activeFile).then((instantCount) => {
        if (instantCount && instantCount > 1) {
          setTotalPages((prev) => Math.max(prev, instantCount))
          setFromPage(1)
          setToPage((prev) => Math.max(prev, instantCount))
        }
      }).catch(() => {})

      // Step 2: Full document load & high-res first page preview
      try {
        const { pdfDoc: loadedDoc, pdfLibDoc: loadedLibDoc, pageCount } = await loadPdfDocument(activeFile)
        setPdfDoc(loadedDoc)
        setPdfLibDoc(loadedLibDoc)
        const finalPages = Math.max(1, pageCount || 1)
        setTotalPages((prev) => Math.max(prev, finalPages))
        setToPage((prev) => Math.max(prev, finalPages))

        const firstPagePreview = await renderPdfPageToDataUrl(loadedDoc, 1, 800, loadedLibDoc, activeFile)
        if (firstPagePreview) {
          setPagePreviewUrls((prev) => ({ ...prev, 1: firstPagePreview }))
          setFilePreviewUrl(firstPagePreview)
        }
      } catch (err) {
        console.warn('PDF load notice:', err)
      } finally {
        setIsAnalyzingPdf(false)
      }
    } else {
      const url = URL.createObjectURL(activeFile)
      setFilePreviewUrl(url)
      setTotalPages(1)
      setFromPage(1)
      setToPage(1)
      setShowChoiceScreen(true)
    }
  }

  // Handle standard file selection (single or multi-file)
  const handleFileChange = async (e) => {
    const incomingFiles = Array.from(e.target.files || [])
    if (incomingFiles.length === 0) return

    let updatedList = []
    if (appendModeRef.current) {
      updatedList = [...selectedFiles, ...incomingFiles]
      appendModeRef.current = false
    } else {
      updatedList = incomingFiles
    }

    setSelectedFiles(updatedList)
    await processSelectedFiles(updatedList)

    if (fileInputRef.current) {
      fileInputRef.current.value = ''
    }
  }

  // Remove a specific file from the selected files list
  const handleRemoveFile = async (idxToRemove) => {
    const updated = selectedFiles.filter((_, idx) => idx !== idxToRemove)
    setSelectedFiles(updated)
    await processSelectedFiles(updated)
  }

  // Trigger file picker to append more files/pages
  const handleAddMoreFiles = () => {
    appendModeRef.current = true
    fileInputRef.current?.click()
  }

  // Trigger file picker to re-select / replace files
  const handleReselectFiles = () => {
    appendModeRef.current = false
    fileInputRef.current?.click()
  }

  // Handle switching pages in preview for multipage PDF
  const handlePdfPageChange = async (targetPage) => {
    const pageNum = Math.max(1, Math.min(targetPage, totalPages))
    setPreviewPageIndex(pageNum)

    if (pagePreviewUrls[pageNum]) {
      setFilePreviewUrl(pagePreviewUrls[pageNum])
      return
    }

    if (pdfDoc || pdfLibDoc || selectedFile) {
      setIsRenderingPage(true)
      try {
        const dataUrl = await renderPdfPageToDataUrl(pdfDoc, pageNum, 800, pdfLibDoc, selectedFile)
        if (dataUrl) {
          setPagePreviewUrls((prev) => ({ ...prev, [pageNum]: dataUrl }))
          setFilePreviewUrl(dataUrl)
        }
      } catch (err) {
        console.warn(`Failed to render page ${pageNum}:`, err)
      } finally {
        setIsRenderingPage(false)
      }
    }
  }

  // Automatically render missing preview pages for currently visible sheet or view
  useEffect(() => {
    if (!selectedFile || totalPages <= 1) return

    const currentSheetIdx = Math.floor((previewPageIndex - 1) / pagesPerSheet)
    const startPage = currentSheetIdx * pagesPerSheet + 1
    const endPage = Math.min(totalPages, startPage + pagesPerSheet - 1)

    let isMounted = true
    const loadMissingPreviews = async () => {
      for (let p = startPage; p <= endPage; p++) {
        if (!pagePreviewUrls[p]) {
          try {
            const url = await renderPdfPageToDataUrl(pdfDoc, p, 500, pdfLibDoc, selectedFile)
            if (url && isMounted) {
              setPagePreviewUrls((prev) => ({ ...prev, [p]: url }))
              if (p === previewPageIndex) {
                setFilePreviewUrl(url)
              }
            }
          } catch (e) {
            console.warn(`[renderPreview] Page ${p} notice:`, e)
          }
        }
      }
    }

    loadMissingPreviews()
    return () => {
      isMounted = false
    }
  }, [previewPageIndex, pagesPerSheet, pdfDoc, pdfLibDoc, totalPages, selectedFile])

  // Handle scanner completion
  const handleScannerComplete = ({ file, pageCount: scannedPages, previewUrl, mode }) => {
    setSelectedFile(file)
    setTotalPages(scannedPages || 1)
    setFilePreviewUrl(previewUrl)
    setSubmitError(null)
    setPreviewPageIndex(1)
    setServiceType(mode === 'idCard' ? 'idCard' : 'scanner')
    setStep(2)
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

    if (!termsAccepted) {
      setTermsError(true)
      setSubmitError(lang === 'bn' ? 'অর্ডার সম্পন্ন করতে অনুগ্রহ করে ব্যবহারের শর্তাবলী, রিফান্ড ও রিটার্ন নীতি এবং গোপনীয়তা নীতিতে টিক দিয়ে সম্মতি জানান।' : 'Please check the box to accept the Terms & Conditions, Return & Refund Policy, and Privacy Policy to proceed.')
      return
    }

    setIsSubmitting(true)
    setUploadProgress(15)
    setSubmitError(null)

    try {
      let fileToUpload = selectedFile
      const isPdf = selectedFile.type === 'application/pdf' || selectedFile.name.toLowerCase().endsWith('.pdf')

      // Pre-Upload Adjustments: Apply custom Scale (%), Rotation & Page Range slicing
      // For images (e.g. ID card scans) or scaled PDFs, this compiles a clean A4 PDF
      // with the content scaled to the exact user-specified dimensions (e.g. 50% for real ID card size).
      if (printScale !== 100 || rotation !== 0 || (isPdf && effectivePageRange) || !isPdf) {
        setUploadProgress(20)
        try {
          fileToUpload = await applyPrintAdjustments(selectedFile, {
            scale: printScale,
            rotation: rotation,
            pageRange: effectivePageRange,
          })
        } catch (adjErr) {
          console.warn('Pre-upload adjustments notice, falling back:', adjErr)
          if (isPdf && effectivePageRange) {
            try {
              fileToUpload = await slicePdfBlob(selectedFile, effectivePageRange)
            } catch (sliceErr) {
              fileToUpload = selectedFile
            }
          } else {
            fileToUpload = selectedFile
          }
        }
      }

      const fileExt = fileToUpload.name.split('.').pop() || 'pdf'
      const cleanFileName = fileToUpload.name.replace(/[^a-zA-Z0-9.-]/g, '_')
      let storagePath = `jobs/${Date.now()}_${cleanFileName}`

      setUploadProgress(45)

      // Upload document file to Supabase Storage or server fallback
      const { error: uploadError } = await supabase.storage
        .from('print-files')
        .upload(storagePath, fileToUpload, {
          contentType: fileToUpload.type || 'application/pdf',
          upsert: true,
        })

      if (uploadError) {
        console.warn('Supabase storage notice, using server upload fallback:', uploadError.message)
        try {
          const fd = new FormData()
          fd.append('file', fileToUpload)
          const upRes = await fetch('/api/upload', {
            method: 'POST',
            body: fd,
          })
          const upData = await upRes.json()
          if (upData?.file_path) {
            storagePath = upData.file_path
          }
        } catch (serverUpErr) {
          console.warn('Server upload fallback notice:', serverUpErr)
        }
      }

      setUploadProgress(75)

      // Call order creation route
      const response = await fetch('/api/print-jobs', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          file_path: storagePath,
          file_type: fileExt,
          file_name: fileToUpload.name || selectedFile.name,
          copies,
          color_mode: colorMode,
          duplex: colorMode === 'color' ? false : duplex,
          page_count: calculatedSheets,
          page_range: effectivePageRange,   // null = all pages; "1-3,5" = specific range
          pages_per_sheet: pagesPerSheet || 1,
          mini_border: Boolean(miniBorder),
          payment_type: 'cash',
          amount: 0,
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
        {/* Hidden Global File Input for single & multi-file selection */}
        <input
          ref={fileInputRef}
          type="file"
          accept=".pdf,.doc,.docx,.jpg,.jpeg,.png,.webp,.bmp"
          multiple
          onChange={handleFileChange}
          className="hidden"
        />

        {/* ========================================================================= */}
        {/* STEP PROGRESS BAR */}
        {/* ========================================================================= */}
        <div className="flex items-center justify-between px-2 mb-6">
          {[
            { num: 1, label: lang === 'bn' ? 'আপলোড' : 'Upload' },
            { num: 2, label: lang === 'bn' ? 'প্রিভিউ' : 'Preview' },
            { num: 3, label: lang === 'bn' ? 'অপশন' : 'Options' },
            { num: 4, label: lang === 'bn' ? 'টিকেট' : 'Ticket' },
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
        {/* CHOICE SCREEN MODAL (Minimal & Multi-File Aware) */}
        {/* ========================================================================= */}
        {showChoiceScreen && selectedFile && (
          <div className="space-y-4 animate-in zoom-in duration-150 mb-6">
            <Card className="bg-white border border-gray-200 rounded-2xl p-5 sm:p-6 text-center shadow-none">
              <div className="text-3xl mb-1">
                {selectedFiles.length > 1 ? '📚' : '👀'}
              </div>
              <h3 className="text-lg font-bold text-gray-900 mb-1">
                {selectedFiles.length > 1
                  ? `${selectedFiles.length} Files Ready to Print`
                  : 'File Loaded'}
              </h3>
              <p className="text-xs text-gray-500 max-w-sm mx-auto mb-3">
                {isMergingFiles ? (
                  <span className="text-[#00bf63] font-semibold flex items-center justify-center gap-1.5 animate-pulse">
                    <RefreshCw className="w-3.5 h-3.5 animate-spin" /> Merging files into unified document...
                  </span>
                ) : isAnalyzingPdf ? (
                  <span className="text-[#00bf63] font-semibold animate-pulse">
                    Analyzing pages...
                  </span>
                ) : (
                  <span>
                    <strong className="text-gray-800">{totalPages} {totalPages === 1 ? 'Page' : 'Pages'} Total</strong>
                    {' '}• {(selectedFile.size / 1024).toFixed(1)} KB
                  </span>
                )}
              </p>

              {/* Selected Files Chips List (allows reviewing & removing individual items) */}
              {selectedFiles.length > 1 && (
                <div className="flex flex-wrap gap-1.5 justify-center mb-3.5 max-h-28 overflow-y-auto p-1">
                  {selectedFiles.map((f, idx) => (
                    <div
                      key={idx}
                      className="flex items-center gap-1.5 bg-gray-100 hover:bg-gray-200 text-gray-800 text-[11px] font-medium px-2.5 py-1 rounded-lg border border-gray-200 transition-colors"
                    >
                      <span className="truncate max-w-[125px]">{f.name}</span>
                      <span className="text-[10px] text-gray-500">({(f.size / 1024).toFixed(0)}KB)</span>
                      <button
                        type="button"
                        onClick={() => handleRemoveFile(idx)}
                        className="text-gray-400 hover:text-red-500 font-bold ml-1 px-0.5"
                        title="Remove file"
                      >
                        ✕
                      </button>
                    </div>
                  ))}
                </div>
              )}

              {/* Quick Thumbnail Preview Box */}
              <div className="bg-slate-50 border border-gray-200 rounded-xl p-3 flex items-center justify-center max-h-48 mb-4 overflow-hidden relative">
                {isMergingFiles || isAnalyzingPdf ? (
                  <div className="py-6 flex flex-col items-center">
                    <RefreshCw className="w-8 h-8 text-[#00bf63] animate-spin mb-2" />
                    <span className="text-xs font-semibold text-gray-600">
                      {isMergingFiles ? 'Combining selected files...' : 'Analyzing PDF...'}
                    </span>
                  </div>
                ) : filePreviewUrl ? (
                  <div className="relative flex flex-col items-center">
                    <img
                      src={filePreviewUrl}
                      alt="Quick preview"
                      className="max-h-36 max-w-full rounded border object-contain shadow-xs"
                    />
                    {totalPages > 1 && (
                      <span className="absolute bottom-1 right-1 bg-black/75 text-white text-[10px] font-bold px-1.5 py-0.5 rounded">
                        Page 1 of {totalPages}
                      </span>
                    )}
                  </div>
                ) : (
                  <div className="py-6 flex flex-col items-center">
                    <FileCheck className="w-10 h-10 text-[#00bf63] mb-1" />
                    <span className="text-xs font-bold text-gray-700">Ready for A4 Print</span>
                  </div>
                )}
              </div>

              {/* Add More Files / Re-select Controls */}
              <div className="flex gap-2 mb-3">
                <Button
                  type="button"
                  variant="outline"
                  onClick={handleAddMoreFiles}
                  className="flex-1 bg-slate-50 hover:bg-[#00bf63]/10 hover:border-[#00bf63] hover:text-[#00bf63] border-dashed border-gray-300 text-gray-700 py-3 rounded-xl font-bold text-xs shadow-none transition-colors"
                >
                  ➕ Add More Files / Pages
                </Button>
                <Button
                  type="button"
                  variant="outline"
                  onClick={handleReselectFiles}
                  className="bg-white hover:bg-gray-50 border-gray-200 text-gray-600 py-3 px-3.5 rounded-xl font-medium text-xs shadow-none"
                  title="Re-select files"
                >
                  🔄 Re-select
                </Button>
              </div>

              {/* Proceed to Print / Edit Paths */}
              <div className="space-y-2">
                <Button
                  disabled={isMergingFiles || isAnalyzingPdf}
                  onClick={() => {
                    setShowChoiceScreen(false)
                    setStep(2)
                  }}
                  className="w-full bg-[#00bf63] hover:bg-[#00a656] text-white py-5 rounded-xl font-bold text-sm shadow-none"
                >
                  ✅ Looks Great — Proceed to Print ({totalPages} {totalPages === 1 ? 'Page' : 'Pages'})
                </Button>
                <p className="text-[11px] text-gray-400">
                  Prints in original crisp resolution with fastest upload
                </p>

                <Button
                  disabled={isMergingFiles || isAnalyzingPdf}
                  variant="outline"
                  onClick={() => {
                    setShowChoiceScreen(false)
                    setShowAdjustControls(true)
                    setStep(2)
                  }}
                  className="w-full bg-white border-gray-200 text-gray-700 hover:bg-gray-50 py-3.5 rounded-xl font-medium text-xs shadow-none"
                >
                  ✏️ Edit & Adjust (Rotate / Brightness / Range)
                </Button>

                {selectedFile?.type?.startsWith('image/') && filePreviewUrl && (
                  <Button
                    disabled={isMergingFiles || isAnalyzingPdf}
                    variant="outline"
                    onClick={() => {
                      setScannerInitialMode('auto')
                      setScannerInitialImage(filePreviewUrl)
                      setIsScannerOpen(true)
                    }}
                    className="w-full bg-[#00bf63]/10 hover:bg-[#00bf63]/20 border border-[#00bf63]/30 text-[#00bf63] py-3.5 rounded-xl font-bold text-xs shadow-none flex items-center justify-center gap-1.5"
                  >
                    <Crop className="w-3.5 h-3.5" /> 📐 Interactive Perspective Crop & Straighten
                  </Button>
                )}
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
                <b className="text-xs font-bold text-gray-900 block leading-tight">
                  {lang === 'bn' ? 'ডকুমেন্ট প্রিন্ট' : 'Document Print'}
                </b>
                <span className="text-[10px] text-gray-500 block mt-1">
                  {lang === 'bn' ? 'PDF, Word, ছবি ফাইল' : 'PDF, Word, Images'}
                </span>
              </Card>

              {/* 2. Smart Scanner */}
              <Card
                onClick={() => {
                  setServiceType('scanner')
                  setScannerInitialMode(null)
                  setIsScannerOpen(true)
                }}
                className="border border-gray-200 hover:border-[#00bf63] hover:bg-[#00bf63]/5 transition-colors cursor-pointer bg-white rounded-2xl p-4 text-center shadow-none"
              >
                <div className="w-10 h-10 rounded-xl bg-[#00bf63]/10 text-[#00bf63] flex items-center justify-center mx-auto mb-2 text-xl font-bold">
                  📸
                </div>
                <b className="text-xs font-bold text-gray-900 block leading-tight">
                  {lang === 'bn' ? 'স্মার্ট স্ক্যানার' : 'Smart Scanner'}
                </b>
                <span className="text-[10px] text-gray-500 block mt-1">
                  {lang === 'bn' ? 'অটো-ক্রপ ও ছায়া দূরীকরণ' : 'Perspective crop & auto-straighten'}
                </span>
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
                <b className="text-xs font-bold text-gray-900 block leading-tight">
                  {lang === 'bn' ? 'মিনি প্রিন্ট (N-in-1)' : 'Mini Print (N-in-1)'}
                </b>
                <span className="text-[10px] text-gray-500 block mt-1">
                  {lang === 'bn' ? '২, ৪, ৬ পেজ এক শিটে' : '2, 4, 6 pages per sheet'}
                </span>
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
                <b className="text-xs font-bold text-gray-900 block leading-tight">
                  {lang === 'bn' ? 'পাসপোর্ট ফটো গ্রিড' : 'Passport Photo Grid'}
                </b>
                <span className="text-[10px] text-gray-500 block mt-1">
                  {lang === 'bn' ? '৪, ৬, ৮ বা ১২ কপি ফটো' : '4, 6, 8, 12 photos with guides'}
                </span>
              </Card>

              {/* 5. ID Card 2-in-1 Photocopy */}
              <Card
                onClick={() => {
                  setServiceType('idCard')
                  setScannerInitialMode('idCard')
                  setIsScannerOpen(true)
                }}
                className="col-span-2 border border-gray-200 hover:border-[#00bf63] hover:bg-[#00bf63]/5 transition-colors cursor-pointer bg-white rounded-2xl p-3.5 flex items-center gap-3.5 text-left shadow-none"
              >
                <div className="w-10 h-10 rounded-xl bg-[#00bf63]/10 text-[#00bf63] flex items-center justify-center text-xl flex-shrink-0">
                  🆔
                </div>
                <div className="min-w-0 flex-1">
                  <b className="text-xs font-bold text-gray-900 block">
                    {lang === 'bn' ? 'আইডি কার্ড ২-ইন-১ ফটোকপি' : 'ID Card 2-in-1 Photocopy'}
                  </b>
                  <span className="text-[11px] text-gray-500 block mt-0.5">
                    {lang === 'bn' ? 'উভয় পিঠ সোজা করে ১টি A4 পাতায় কম্বাইন করুন' : 'Combine Front & Back with perspective crop on 1 A4 page'}
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
                <div className="w-10 h-10 rounded-xl bg-gray-100 text-gray-600 flex items-center justify-center mb-2">
                  <Upload className="h-5 w-5" />
                </div>
                <h4 className="text-sm font-bold text-gray-900 mb-0.5">
                  {lang === 'bn' ? 'অথবা সরাসরি ফাইল আপলোড করুন' : 'Or Choose Local File'}
                </h4>
                <p className="text-xs text-gray-500 mb-2.5">
                  {lang === 'bn' ? 'PDF, DOCX, JPG, PNG (সর্বোচ্চ ২০MB)' : 'PDF, DOCX, JPG, PNG up to 20MB'}
                </p>
                <span className="inline-flex items-center gap-1 bg-gray-100 text-gray-700 text-xs font-medium px-3 py-1 rounded-lg border border-gray-200">
                  {lang === 'bn' ? 'ফাইল সিলেক্ট করুন' : 'Browse Files'} <ChevronRight className="h-3 w-3" />
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
                  <div className="flex items-center gap-1.5">
                    <Button
                      variant="outline"
                      size="sm"
                      onClick={handleAddMoreFiles}
                      className="text-[11px] font-bold text-[#00bf63] hover:bg-[#00bf63]/10 border-[#00bf63]/30 h-7 px-2.5 rounded-lg shadow-none"
                    >
                      ➕ Add Files
                    </Button>
                    <Button
                      variant="ghost"
                      size="sm"
                      onClick={handleReselectFiles}
                      className="text-xs text-gray-500 hover:text-red-600 h-7 px-2"
                    >
                      Change
                    </Button>
                  </div>
                </div>

                {/* Visual Preview Box with Rotation & Filter Adjustments */}
                <div className="bg-slate-50 border border-gray-200 rounded-xl p-3 flex flex-col items-center justify-center min-h-[220px] mb-3 overflow-hidden relative">
                  {isAnalyzingPdf ? (
                    <div className="text-center py-8">
                      <RefreshCw className="h-8 w-8 text-[#00bf63] animate-spin mx-auto mb-2" />
                      <p className="text-xs font-bold text-gray-700">Analyzing Document Pages...</p>
                      <span className="text-[10px] text-gray-400">Reading PDF structure</span>
                    </div>
                  ) : (pagePreviewUrls[previewPageIndex] || filePreviewUrl) ? (
                    <div className="relative flex flex-col items-center justify-center">
                      {isRenderingPage && (
                        <div className="absolute inset-0 bg-white/70 backdrop-blur-[1px] flex items-center justify-center z-20 rounded">
                          <RefreshCw className="h-6 w-6 text-[#00bf63] animate-spin" />
                        </div>
                      )}
                      
                      {pagesPerSheet > 1 ? (
                        /* Mini Print: Authentic A4 Sheet Simulation */
                        <div
                          style={{
                            transform: `rotate(${rotation}deg)`,
                            filter: `brightness(${100 + brightness}%) contrast(${100 + contrast}%)`,
                            transition: 'transform 0.15s ease, filter 0.15s ease'
                          }}
                          className="w-[185px] h-[262px] bg-white border border-gray-300 rounded shadow-md relative p-2 flex flex-col justify-between"
                        >
                          {/* Sheet badge */}
                          <div className="absolute top-1 left-2 z-10 flex items-center gap-1">
                            <span className="bg-[#00bf63] text-white text-[8px] font-bold px-1.5 py-0.5 rounded-full shadow-xs">
                              Sheet {Math.floor((previewPageIndex - 1) / pagesPerSheet) + 1}/{Math.ceil(totalPages / pagesPerSheet)} · {pagesPerSheet}-in-1
                            </span>
                          </div>

                          {/* N-up Grid Slots */}
                          <div className={`w-full h-full pt-4 grid gap-1.5 ${
                            pagesPerSheet === 2 ? 'grid-rows-2 grid-cols-1' :
                            pagesPerSheet === 4 ? 'grid-rows-2 grid-cols-2' :
                            'grid-rows-3 grid-cols-2'
                          }`}>
                            {Array.from({ length: pagesPerSheet }).map((_, slotIdx) => {
                              const currentSheetIdx = Math.floor((previewPageIndex - 1) / pagesPerSheet)
                              const isSinglePageDoc = totalPages === 1
                              const slotPageNum = isSinglePageDoc ? 1 : (currentSheetIdx * pagesPerSheet + slotIdx + 1)
                              const hasPage = isSinglePageDoc ? true : (slotPageNum <= totalPages)
                              const slotImg = hasPage ? (pagePreviewUrls[slotPageNum] || filePreviewUrl) : null

                              return (
                                <div
                                  key={slotIdx}
                                  className={`relative rounded overflow-hidden flex items-center justify-center bg-slate-50 ${
                                    miniBorder ? 'border border-dashed border-gray-400' : 'border border-gray-200'
                                  }`}
                                >
                                  {hasPage && slotImg ? (
                                    <>
                                      <img
                                        src={slotImg}
                                        alt={`Page ${slotPageNum}`}
                                        style={pagesPerSheet === 2 ? {
                                          transform: 'rotate(90deg)',
                                          width: '106px',
                                          height: '154px',
                                          maxWidth: 'none',
                                          maxHeight: 'none',
                                        } : undefined}
                                        className={pagesPerSheet === 2 ? 'object-contain' : 'w-full h-full object-contain p-0.5'}
                                      />
                                      <span className="absolute bottom-0.5 right-0.5 bg-black/70 text-white font-mono text-[7px] px-1 py-0.2 rounded font-bold z-10">
                                        P.{slotPageNum}
                                      </span>
                                    </>
                                  ) : hasPage ? (
                                    <div className="flex flex-col items-center justify-center p-1 text-center">
                                      <RefreshCw className="w-3.5 h-3.5 text-[#00bf63] animate-spin mb-1 opacity-70" />
                                      <span className="text-[7px] font-bold text-gray-400">P.{slotPageNum}</span>
                                    </div>
                                  ) : (
                                    <span className="text-[8px] font-medium text-gray-300">Blank</span>
                                  )}
                                </div>
                              )
                            })}
                          </div>
                        </div>
                      ) : (
                        /* Standard 1-in-1 Preview with Authentic A4 Sheet Simulation & Scaling */
                        <div className="w-[190px] h-[268px] bg-white border border-gray-300 rounded shadow-md relative p-2 flex items-center justify-center overflow-hidden transition-all duration-200">
                          {/* Sheet watermark/badge */}
                          <div className="absolute top-1.5 left-2 z-10 flex items-center gap-1 pointer-events-none">
                            <span className="bg-slate-800/80 backdrop-blur-xs text-white text-[8px] font-bold px-1.5 py-0.5 rounded shadow-xs">
                              A4 Sheet · {printScale}%
                            </span>
                          </div>

                          {/* Scaled Printable Document / Card Area */}
                          <div
                            style={{
                              width: `${printScale}%`,
                              height: `${printScale}%`,
                              transform: `rotate(${rotation}deg)`,
                              filter: `brightness(${100 + brightness}%) contrast(${100 + contrast}%)`,
                              transition: 'width 0.15s ease-out, height 0.15s ease-out, transform 0.15s ease, filter 0.15s ease'
                            }}
                            className="flex items-center justify-center relative max-w-full max-h-full"
                          >
                            <img
                              src={pagePreviewUrls[previewPageIndex] || filePreviewUrl}
                              alt="Document Preview"
                              className="max-h-full max-w-full object-contain shadow-xs border border-gray-200/60 rounded-xs"
                            />
                          </div>
                        </div>
                      )}
                    </div>
                  ) : (
                    <div className="text-center py-6">
                      <FileText className="h-12 w-12 text-[#00bf63] mx-auto mb-1.5" />
                      <p className="text-xs font-bold text-gray-700">PDF Document Loaded</p>
                      <span className="text-[10px] text-gray-400">{totalPages} {totalPages === 1 ? 'page' : 'pages'} ready</span>
                    </div>
                  )}
                </div>

                {/* Multipage PDF Page/Sheet Navigation */}
                {totalPages > 1 && (
                  <div className="flex items-center justify-between bg-slate-100/90 border border-gray-200 rounded-xl px-3 py-1.5 mb-3">
                    <Button
                      size="sm"
                      variant="ghost"
                      disabled={previewPageIndex <= 1 || isRenderingPage}
                      onClick={() => {
                        const step = pagesPerSheet > 1 ? pagesPerSheet : 1
                        handlePdfPageChange(Math.max(1, previewPageIndex - step))
                      }}
                      className="h-7 px-2 text-xs font-bold text-gray-700 hover:text-[#00bf63] hover:bg-white"
                    >
                      <ChevronLeft className="w-3.5 h-3.5 mr-0.5" /> Prev {pagesPerSheet > 1 ? 'Sheet' : ''}
                    </Button>

                    <div className="text-xs font-medium text-gray-700 flex items-center gap-1.5">
                      {pagesPerSheet > 1 ? (
                        <span className="font-bold text-gray-900">
                          Sheet {Math.floor((previewPageIndex - 1) / pagesPerSheet) + 1} of {Math.ceil(totalPages / pagesPerSheet)}
                          <span className="text-gray-400 font-normal ml-1">
                            (P.{Math.floor((previewPageIndex - 1) / pagesPerSheet) * pagesPerSheet + 1}–{Math.min(totalPages, (Math.floor((previewPageIndex - 1) / pagesPerSheet) + 1) * pagesPerSheet)})
                          </span>
                        </span>
                      ) : (
                        <>
                          <span>Previewing Page</span>
                          <input
                            type="number"
                            min={1}
                            max={totalPages}
                            value={previewPageIndex}
                            onChange={(e) => {
                              const val = parseInt(e.target.value)
                              if (!isNaN(val) && val >= 1 && val <= totalPages) {
                                handlePdfPageChange(val)
                              }
                            }}
                            className="w-12 text-center font-bold text-gray-900 border border-gray-300 rounded py-0.5 text-xs bg-white focus:outline-none focus:border-[#00bf63]"
                          />
                          <span className="text-gray-400">of {totalPages}</span>
                        </>
                      )}
                    </div>

                    <Button
                      size="sm"
                      variant="ghost"
                      disabled={(pagesPerSheet > 1 ? (Math.floor((previewPageIndex - 1) / pagesPerSheet) + 1) >= Math.ceil(totalPages / pagesPerSheet) : previewPageIndex >= totalPages) || isRenderingPage}
                      onClick={() => {
                        const step = pagesPerSheet > 1 ? pagesPerSheet : 1
                        handlePdfPageChange(Math.min(totalPages, previewPageIndex + step))
                      }}
                      className="h-7 px-2 text-xs font-bold text-gray-700 hover:text-[#00bf63] hover:bg-white"
                    >
                      Next {pagesPerSheet > 1 ? 'Sheet' : ''} <ChevronRight className="w-3.5 h-3.5 ml-0.5" />
                    </Button>
                  </div>
                )}

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

                    {selectedFile?.type?.startsWith('image/') && (
                      <Button
                        size="sm"
                        variant="outline"
                        onClick={() => {
                          setScannerInitialMode('auto')
                          setScannerInitialImage(pagePreviewUrls[previewPageIndex] || filePreviewUrl)
                          setIsScannerOpen(true)
                        }}
                        className="h-7 rounded-lg text-xs flex items-center gap-1 px-2.5 border-[#00bf63]/30 text-[#00bf63] hover:bg-[#00bf63]/10 font-bold shadow-none"
                      >
                        <Crop className="w-3 h-3" /> Crop
                      </Button>
                    )}
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
                          setPrintScale(100)
                        }}
                        className="text-[10px] font-bold text-gray-500 hover:text-[#00bf63]"
                      >
                        Reset All Adjustments
                      </button>
                    </div>
                  </div>
                )}

                {/* Print Scale (%) Slider & Presets */}
                {pagesPerSheet === 1 && (
                  <div className="border border-gray-200 rounded-xl p-3 bg-white mb-3 shadow-xs">
                    <div className="flex items-center justify-between mb-2">
                      <div className="flex items-center gap-1.5">
                        <label className="text-xs font-bold text-gray-800 flex items-center gap-1">
                          📐 {lang === 'bn' ? 'প্রিন্ট স্কেল (আকার)' : 'Print Scale (%)'}
                        </label>
                        <span className="text-[10px] text-gray-400 font-normal">
                          {lang === 'bn' ? '(পাতায় সাইজ নির্ধারণ করুন)' : '(Size on page)'}
                        </span>
                      </div>
                      <div className="flex items-center gap-1.5">
                        <span className="text-xs font-extrabold text-[#00bf63] bg-[#00bf63]/10 border border-[#00bf63]/20 px-2 py-0.5 rounded-md font-mono">
                          {printScale}%
                        </span>
                        {printScale !== 100 && (
                          <button
                            type="button"
                            onClick={() => setPrintScale(100)}
                            className="text-[10px] font-bold text-gray-400 hover:text-gray-700 underline cursor-pointer"
                          >
                            {lang === 'bn' ? 'রিসেট' : 'Reset'}
                          </button>
                        )}
                      </div>
                    </div>

                    {/* Slider */}
                    <div className="space-y-1 mb-2.5">
                      <div className="relative flex items-center">
                        <input
                          type="range"
                          min="25"
                          max="125"
                          step="1"
                          value={printScale}
                          onChange={(e) => setPrintScale(parseInt(e.target.value, 10))}
                          className="w-full accent-[#00bf63] cursor-pointer h-2 bg-gray-200 rounded-lg appearance-none"
                          aria-label="Print Scale Percentage"
                        />
                      </div>
                      <div className="flex justify-between text-[10px] text-gray-400 font-semibold px-0.5">
                        <span>25% (Mini)</span>
                        <span>50% (ID Card)</span>
                        <span>75%</span>
                        <span>100% (Fit)</span>
                        <span>125%</span>
                      </div>
                    </div>

                    {/* Quick Presets */}
                    <div className="grid grid-cols-4 gap-1.5">
                      <button
                        type="button"
                        onClick={() => setPrintScale(100)}
                        className={`py-1 px-1.5 rounded-lg text-[11px] font-bold border transition-all text-center cursor-pointer ${
                          printScale === 100
                            ? 'bg-[#00bf63] text-white border-[#00bf63] shadow-xs'
                            : 'bg-gray-50 text-gray-700 border-gray-200 hover:border-[#00bf63]/50'
                        }`}
                      >
                        100% {lang === 'bn' ? '(ফুল পেজ)' : '(Fit)'}
                      </button>
                      <button
                        type="button"
                        onClick={() => setPrintScale(75)}
                        className={`py-1 px-1.5 rounded-lg text-[11px] font-bold border transition-all text-center cursor-pointer ${
                          printScale === 75
                            ? 'bg-[#00bf63] text-white border-[#00bf63] shadow-xs'
                            : 'bg-gray-50 text-gray-700 border-gray-200 hover:border-[#00bf63]/50'
                        }`}
                      >
                        75%
                      </button>
                      <button
                        type="button"
                        onClick={() => setPrintScale(50)}
                        className={`py-1 px-1.5 rounded-lg text-[11px] font-bold border transition-all text-center flex items-center justify-center gap-0.5 cursor-pointer ${
                          printScale === 50
                            ? 'bg-[#00bf63] text-white border-[#00bf63] shadow-xs'
                            : 'bg-emerald-50/60 text-emerald-800 border-emerald-200 hover:border-[#00bf63]'
                        }`}
                      >
                        <span>🪪</span> 50% {lang === 'bn' ? '(আইডি)' : '(ID Card)'}
                      </button>
                      <button
                        type="button"
                        onClick={() => setPrintScale(35)}
                        className={`py-1 px-1.5 rounded-lg text-[11px] font-bold border transition-all text-center cursor-pointer ${
                          printScale === 35
                            ? 'bg-[#00bf63] text-white border-[#00bf63] shadow-xs'
                            : 'bg-gray-50 text-gray-700 border-gray-200 hover:border-[#00bf63]/50'
                        }`}
                      >
                        35% {lang === 'bn' ? '(মিনি)' : '(Mini)'}
                      </button>
                    </div>

                    {printScale === 50 && (
                      <p className="mt-2 text-[10px] text-emerald-700 bg-emerald-50 px-2 py-1 rounded border border-emerald-100 flex items-center gap-1 font-medium">
                        <span>💡</span>
                        {lang === 'bn'
                          ? '৫০% স্কেলে আইডি কার্ড বা স্মার্ট কার্ড আসল সাইজে পেজের মাঝে প্রিন্ট হবে।'
                          : '50% scale prints your ID card or smart card at authentic physical size in the center of the sheet.'}
                      </p>
                    )}
                  </div>
                )}

                {/* Page Range — From / To Selector */}
                <div className="border border-gray-200 rounded-xl p-3 bg-gray-50/50 mb-3">
                  <div className="flex items-center justify-between mb-2">
                    <label className="text-xs font-bold text-gray-800">📄 Which Pages to Print?</label>
                    {pageRangeMode === 'custom' && (
                      <span className="text-[10px] font-bold text-[#00bf63] bg-[#00bf63]/10 px-2 py-0.5 rounded-full">
                        {selectedPagesCount} of {totalPages} pages
                      </span>
                    )}
                  </div>

                  {/* All / Custom toggle */}
                  <div className="grid grid-cols-2 gap-1.5 mb-2.5">
                    <button
                      type="button"
                      onClick={() => setPageRangeMode('all')}
                      className={`py-1.5 px-2.5 rounded-lg text-xs font-bold border transition-all ${
                        pageRangeMode === 'all'
                          ? 'bg-[#00bf63] text-white border-[#00bf63] shadow-sm'
                          : 'bg-white text-gray-600 border-gray-200 hover:border-[#00bf63] hover:text-[#00bf63]'
                      }`}
                    >
                      ✅ All Pages ({totalPages})
                    </button>
                    <button
                      type="button"
                      onClick={() => { setPageRangeMode('custom'); setFromPage(1); setToPage(totalPages) }}
                      className={`py-1.5 px-2.5 rounded-lg text-xs font-bold border transition-all ${
                        pageRangeMode === 'custom'
                          ? 'bg-[#00bf63] text-white border-[#00bf63] shadow-sm'
                          : 'bg-white text-gray-600 border-gray-200 hover:border-[#00bf63] hover:text-[#00bf63]'
                      }`}
                    >
                      🎯 Page Range
                    </button>
                  </div>

                  {pageRangeMode === 'custom' && (
                    <div className="space-y-2.5">

                      {/* From / To number inputs */}
                      <div className="flex items-center gap-2">
                        <div className="flex-1">
                          <label className="text-[10px] font-bold text-gray-500 mb-1 block">FROM</label>
                          <div className="flex items-center border border-gray-200 rounded-lg bg-white overflow-hidden focus-within:border-[#00bf63] transition-colors">
                            <button
                              type="button"
                              onClick={() => setFromPage(p => Math.max(1, (p || 1) - 1))}
                              className="px-2.5 py-2 text-gray-400 hover:text-[#00bf63] hover:bg-gray-50 font-bold text-sm transition-colors"
                            >−</button>
                            <input
                              type="number"
                              min={1}
                              max={toPage || totalPages}
                              value={fromPage}
                              onChange={e => {
                                const v = Math.max(1, Math.min(parseInt(e.target.value) || 1, toPage || totalPages))
                                setFromPage(v)
                              }}
                              className="flex-1 text-center text-sm font-bold text-gray-800 bg-transparent border-none outline-none py-2 w-0 min-w-0"
                            />
                            <button
                              type="button"
                              onClick={() => setFromPage(p => Math.min((p || 1) + 1, toPage || totalPages))}
                              className="px-2.5 py-2 text-gray-400 hover:text-[#00bf63] hover:bg-gray-50 font-bold text-sm transition-colors"
                            >+</button>
                          </div>
                        </div>

                        <div className="pt-4 text-gray-400 font-bold text-sm">→</div>

                        <div className="flex-1">
                          <label className="text-[10px] font-bold text-gray-500 mb-1 block">TO</label>
                          <div className="flex items-center border border-gray-200 rounded-lg bg-white overflow-hidden focus-within:border-[#00bf63] transition-colors">
                            <button
                              type="button"
                              onClick={() => setToPage(p => Math.max(fromPage || 1, (p || totalPages) - 1))}
                              className="px-2.5 py-2 text-gray-400 hover:text-[#00bf63] hover:bg-gray-50 font-bold text-sm transition-colors"
                            >−</button>
                            <input
                              type="number"
                              min={fromPage || 1}
                              max={totalPages}
                              value={toPage}
                              onChange={e => {
                                const v = Math.max(fromPage || 1, Math.min(parseInt(e.target.value) || totalPages, totalPages))
                                setToPage(v)
                              }}
                              className="flex-1 text-center text-sm font-bold text-gray-800 bg-transparent border-none outline-none py-2 w-0 min-w-0"
                            />
                            <button
                              type="button"
                              onClick={() => setToPage(p => Math.min((p || totalPages) + 1, totalPages))}
                              className="px-2.5 py-2 text-gray-400 hover:text-[#00bf63] hover:bg-gray-50 font-bold text-sm transition-colors"
                            >+</button>
                          </div>
                        </div>
                      </div>

                      {/* Quick preset chips */}
                      <div className="flex gap-1.5 flex-wrap">
                        <span className="text-[10px] font-bold text-gray-400 self-center">Quick:</span>
                        <button type="button"
                          onClick={() => { setFromPage(1); setToPage(totalPages) }}
                          className="text-[10px] font-bold px-2.5 py-1 rounded-full border border-gray-200 bg-white hover:bg-[#00bf63] hover:text-white hover:border-[#00bf63] transition-colors"
                        >All</button>
                        <button type="button"
                          onClick={() => { setFromPage(1); setToPage(Math.floor(totalPages / 2)) }}
                          className="text-[10px] font-bold px-2.5 py-1 rounded-full border border-gray-200 bg-white hover:bg-[#00bf63] hover:text-white hover:border-[#00bf63] transition-colors"
                        >First Half</button>
                        <button type="button"
                          onClick={() => { setFromPage(Math.ceil(totalPages / 2) + 1); setToPage(totalPages) }}
                          className="text-[10px] font-bold px-2.5 py-1 rounded-full border border-gray-200 bg-white hover:bg-[#00bf63] hover:text-white hover:border-[#00bf63] transition-colors"
                        >Last Half</button>
                        <button type="button"
                          onClick={() => { setFromPage(1); setToPage(1) }}
                          className="text-[10px] font-bold px-2.5 py-1 rounded-full border border-gray-200 bg-white hover:bg-[#00bf63] hover:text-white hover:border-[#00bf63] transition-colors"
                        >Page 1 Only</button>
                      </div>

                      {/* Live summary bar */}
                      <div className="flex items-center justify-between bg-white border border-[#00bf63]/30 rounded-lg px-3 py-2">
                        <div className="text-[11px] text-gray-500">
                          Printing pages <span className="font-bold text-gray-800">{clampedFrom}</span>
                          <span className="mx-1 text-gray-400">to</span>
                          <span className="font-bold text-gray-800">{clampedTo}</span>
                        </div>
                        <span className="text-[11px] font-bold text-[#00bf63]">
                          {selectedPagesCount} page{selectedPagesCount !== 1 ? 's' : ''}
                        </span>
                      </div>

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
            {/* Dynamic Shop Pricing Notice Banner */}
            <div className="flex items-center justify-between px-3.5 py-2.5 rounded-xl border border-emerald-200 bg-emerald-50/80 text-xs font-semibold text-emerald-900">
              <span className="flex items-center gap-1.5">
                <MapPin className="w-3.5 h-3.5 text-[#00bf63]" />
                <span>
                  {lang === 'bn'
                    ? 'দোকানে সরাসরি মূল্য পরিশোধ • রেট দোকান অনুযায়ী নির্ধারিত হবে'
                    : 'Pay Directly at Partner Shop • Dynamic pricing set by shop owner'}
                </span>
              </span>
              <span className="text-[10px] bg-white text-emerald-800 border border-emerald-300 font-bold px-2 py-0.5 rounded-full">
                {lang === 'bn' ? 'দোকানে পরিশোধ' : 'Pay at Shop'}
              </span>
            </div>

            <Card className="bg-white border border-gray-200 rounded-2xl shadow-none p-5 space-y-4">
              {/* 1. Color Mode Toggle Cards (No fixed price tags) */}
              <div>
                <label className="block text-xs font-bold text-gray-800 mb-1.5">
                  {lang === 'bn' ? 'প্রিন্ট কালার মোড' : 'Color Mode'}
                </label>
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
                    <b className="text-xs font-bold text-gray-900 block">
                      {lang === 'bn' ? 'ব্ল্যাক অ্যান্ড হোয়াইট' : 'Black & White'}
                    </b>
                    <span className="text-[11px] text-gray-500">
                      {lang === 'bn' ? 'স্ট্যান্ডার্ড একরঙা প্রিন্ট' : 'Standard Monochrome'}
                    </span>
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
                    <b className="text-xs font-bold text-gray-900 block">
                      {lang === 'bn' ? 'কালার প্রিন্ট' : 'Color Print'}
                    </b>
                    <span className="text-[11px] text-gray-500">
                      {lang === 'bn' ? 'রঙিন ছবি ও ডকুমেন্টস' : 'Full Color Output'}
                    </span>
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

              {/* 3. Payment Method: Pay at Partner Shop (Online temporarily disabled) */}
              <div className="pt-2 border-t border-gray-100">
                <label className="block text-xs font-bold text-gray-800 mb-1.5">
                  {lang === 'bn' ? 'মূল্য পরিশোধ পদ্ধতি' : 'Payment Method'}
                </label>
                <div className="w-full p-3.5 rounded-xl border-2 border-[#00bf63] bg-[#00bf63]/5 text-left flex items-start gap-3">
                  <div className="w-8 h-8 rounded-lg bg-[#00bf63]/15 text-[#00bf63] flex items-center justify-center shrink-0 mt-0.5">
                    <Banknote className="h-4 w-4" />
                  </div>
                  <div className="flex-1">
                    <div className="flex items-center justify-between">
                      <b className="text-xs font-bold text-gray-900 block">
                        {lang === 'bn' ? 'দোকানে সরাসরি মূল্য পরিশোধ (Cash / MFS)' : 'Pay Directly at Partner Shop (Cash / MFS)'}
                      </b>
                      <span className="bg-[#00bf63] text-white text-[9px] font-bold px-2 py-0.5 rounded-full">
                        {lang === 'bn' ? 'সক্রিয়' : 'Active'}
                      </span>
                    </div>
                    <p className="text-[11px] text-gray-600 mt-1 leading-relaxed">
                      {lang === 'bn'
                        ? 'অনলাইন পেমেন্ট বর্তমানে বন্ধ রয়েছে। ওটিপি কোডটি নিয়ে পার্টনার দোকানে যান; প্রিন্ট বুঝে নিয়ে সরাসরি দোকানদারের সাথে নির্ধারিত মূল্য পরিশোধ করুন।'
                        : 'Online payment is temporarily disabled. Take your OTP code to any partner shop, and settle the price directly with the shop owner upon collecting your prints.'}
                    </p>
                  </div>
                </div>
              </div>

              {/* Order Summary Breakdown (Service Price in BDT - Payment Gateway Compliance) */}
              <div className="bg-gray-50 rounded-xl p-3.5 space-y-2 text-xs text-gray-600 border border-gray-200">
                <div className="flex justify-between items-center">
                  <span>{lang === 'bn' ? 'প্রিন্ট ধরণ ও রেট:' : 'Print Type & Rate:'}</span>
                  <strong className="text-gray-900">
                    {colorMode === 'color'
                      ? (lang === 'bn' ? `কালার প্রিন্ট • ৳${toBengaliNumber(unitPrice.toFixed(2))} BDT / পাতা` : `Full Color • ৳${unitPrice.toFixed(2)} BDT / sheet`)
                      : duplex
                      ? (lang === 'bn' ? `ব্ল্যাক অ্যান্ড হোয়াইট (উভয় পিঠ) • ৳${toBengaliNumber(unitPrice.toFixed(2))} BDT / পাতা` : `B&W (Dual-Side) • ৳${unitPrice.toFixed(2)} BDT / sheet`)
                      : (lang === 'bn' ? `ব্ল্যাক অ্যান্ড হোয়াইট (এক পিঠ) • ৳${toBengaliNumber(unitPrice.toFixed(2))} BDT / পাতা` : `B&W (Single-Side) • ৳${unitPrice.toFixed(2)} BDT / sheet`)}
                  </strong>
                </div>
                <div className="flex justify-between items-center">
                  <span>{lang === 'bn' ? 'মোট প্রিন্ট হবে:' : 'Sheets to print:'}</span>
                  <strong className="text-gray-900">
                    {toBengaliNumber(calculatedSheets)} {lang === 'bn' ? 'পাতা' : 'sheets'} × {toBengaliNumber(copies)} {lang === 'bn' ? 'কপি' : 'copies'}
                  </strong>
                </div>
                {printScale !== 100 && (
                  <div className="flex justify-between items-center">
                    <span>{lang === 'bn' ? 'স্কেল (আকার):' : 'Scale (Size):'}</span>
                    <strong className="text-gray-900 text-[#00bf63] font-bold">
                      {printScale}% {printScale === 50 ? '(ID Card Size)' : ''}
                    </strong>
                  </div>
                )}
                <div className="flex justify-between items-center pt-2.5 border-t border-gray-200">
                  <div>
                    <b className="text-gray-900 text-xs sm:text-sm block">
                      {lang === 'bn' ? 'মোট আনুমানিক প্রদেয় মূল্য:' : 'Total Estimated Payable:'}
                    </b>
                    <span className="text-[10px] text-gray-500 font-medium block">
                      {lang === 'bn' ? 'মুদ্রা: বাংলাদেশি টাকা (BDT)' : 'Currency: Bangladeshi Taka (BDT)'}
                    </span>
                  </div>
                  <div className="text-right">
                    <span className="text-base sm:text-lg font-black text-[#00bf63]">
                      ৳{toBengaliNumber(totalPrice)} <span className="text-xs font-bold text-gray-700">BDT</span>
                    </span>
                    <span className="block text-[10px] text-gray-500">
                      {lang === 'bn' ? 'দোকানে বা অনলাইনে প্রদেয়' : 'Payable at Shop / Online'}
                    </span>
                  </div>
                </div>
              </div>

              {/* Mandatory Policy Acceptance Checkbox (Payment Gateway Merchant Audit Requirement) */}
              <div
                className={`p-3.5 rounded-xl border transition-colors ${
                  termsError && !termsAccepted ? 'border-red-300 bg-red-50/60' : 'border-gray-200 bg-gray-50/70'
                }`}
              >
                <div className="flex items-start gap-2.5">
                  <input
                    type="checkbox"
                    id="terms-acceptance-checkbox"
                    checked={termsAccepted}
                    onChange={(e) => {
                      setTermsAccepted(e.target.checked)
                      if (e.target.checked) {
                        setTermsError(false)
                        setSubmitError(null)
                      }
                    }}
                    className="mt-1 h-4 w-4 rounded border-gray-300 text-[#00bf63] focus:ring-[#00bf63] cursor-pointer accent-[#00bf63]"
                  />
                  <label htmlFor="terms-acceptance-checkbox" className="text-xs text-gray-700 leading-relaxed cursor-pointer select-none">
                    {lang === 'bn' ? (
                      <>
                        আমি প্রিন্টকোরোর{' '}
                        <Link href="/terms" target="_blank" className="font-bold text-[#00bf63] underline hover:text-[#00a656]">
                          শর্তাবলী (Terms & Conditions)
                        </Link>
                        ,{' '}
                        <Link href="/refund" target="_blank" className="font-bold text-[#00bf63] underline hover:text-[#00a656]">
                          রিফান্ড ও রিটার্ন নীতি (Return & Refund Policy)
                        </Link>{' '}
                        এবং{' '}
                        <Link href="/privacy" target="_blank" className="font-bold text-[#00bf63] underline hover:text-[#00a656]">
                          গোপনীয়তা নীতি (Privacy Policy)
                        </Link>{' '}
                        পড়েছি এবং এতে পূর্ণ সম্মতি জানাচ্ছি।
                      </>
                    ) : (
                      <>
                        I have read and agree to the{' '}
                        <Link href="/terms" target="_blank" className="font-bold text-[#00bf63] underline hover:text-[#00a656]">
                          Terms & Conditions
                        </Link>
                        ,{' '}
                        <Link href="/refund" target="_blank" className="font-bold text-[#00bf63] underline hover:text-[#00a656]">
                          Return & Refund Policy
                        </Link>
                        , and{' '}
                        <Link href="/privacy" target="_blank" className="font-bold text-[#00bf63] underline hover:text-[#00a656]">
                          Privacy Policy
                        </Link>
                        .
                      </>
                    )}
                  </label>
                </div>
                {termsError && !termsAccepted && (
                  <p className="text-[11px] text-red-600 font-semibold mt-1.5 ml-6">
                    {lang === 'bn'
                      ? '⚠️ অর্ডার নিশ্চিত করতে অনুগ্রহ করে শর্তাবলী ও রিফান্ড নীতিতে টিক দিয়ে সম্মতি জানান।'
                      : '⚠️ Please check the box to accept the Terms & Conditions and Refund Policy to proceed.'}
                  </p>
                )}
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
                disabled={isSubmitting || !termsAccepted}
                onClick={handleCreateOrder}
                className="flex-1 bg-[#00bf63] hover:bg-[#00a656] text-white py-5 rounded-xl font-bold text-xs shadow-none cursor-pointer disabled:opacity-50 disabled:cursor-not-allowed"
                title={!termsAccepted ? (lang === 'bn' ? 'শর্তাবলী মেনে টিক দিন' : 'Please agree to terms to proceed') : undefined}
              >
                {isSubmitting ? (
                  <>
                    <RefreshCw className="mr-2 h-4 w-4 animate-spin" /> {lang === 'bn' ? 'ওটিপি তৈরি হচ্ছে...' : 'Generating OTP...'}
                  </>
                ) : (
                  <>
                    {lang === 'bn' ? 'ওটিপি কোড নিন →' : 'Get Print OTP Code →'}
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

                <span className="inline-block text-[10px] font-bold px-3 py-1 rounded-full bg-emerald-100 text-emerald-800">
                  {lang === 'bn' ? 'পার্টনার দোকানে প্রযোজ্য • দোকানে পেমেন্ট' : 'Valid at Partner Shops • Pay at Shop'}
                </span>

                <div className="mt-4 pt-3 border-t border-gray-100 text-left space-y-2.5">
                  <div className="flex items-start gap-2 text-[11px] text-gray-600">
                    <span className="w-4 h-4 rounded-full bg-[#00bf63] text-white font-bold flex items-center justify-center text-[10px] flex-shrink-0 mt-0.5">1</span>
                    <span>{lang === 'bn' ? 'কাছের যেকোনো প্রিন্টকোরো পার্টনার দোকানে যান' : 'Go to any nearby PrintKoro partner shop'}</span>
                  </div>
                  <div className="flex items-start gap-2 text-[11px] text-gray-600">
                    <span className="w-4 h-4 rounded-full bg-[#00bf63] text-white font-bold flex items-center justify-center text-[10px] flex-shrink-0 mt-0.5">2</span>
                    <span>{lang === 'bn' ? 'দোকানদারকে এই ৬-সংখ্যার ওটিপি কোডটি বলুন' : 'Tell this 6-digit OTP code to the shop owner'}</span>
                  </div>
                  <div className="flex items-start gap-2 text-[11px] text-gray-600">
                    <span className="w-4 h-4 rounded-full bg-[#00bf63] text-white font-bold flex items-center justify-center text-[10px] flex-shrink-0 mt-0.5">3</span>
                    <span>{lang === 'bn' ? 'দোকানদারের সাথে নির্ধারিত মূল্য পরিশোধ করে প্রিন্ট বুঝে নিন' : 'Settle the price directly with the shop owner and collect your prints'}</span>
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

            {/* Customer Experience Feedback */}
            <PrintFeedbackBox
              jobId={ticketOrder?.id}
              otpCode={ticketOtp?.code}
              deviceId={ticketOrder?.redeemed_by_device_id || ticketOtp?.device_id}
              lang={lang}
            />

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
                  setSelectedFiles([])
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

      {/* Smart Scanner Modal with 4-Corner Perspective Crop, Loupe & Multi-side Chaining */}
      <SmartScannerModal
        isOpen={isScannerOpen}
        initialDocMode={scannerInitialMode}
        initialImageSrc={scannerInitialImage}
        onClose={() => {
          setIsScannerOpen(false)
          setScannerInitialImage(null)
        }}
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
