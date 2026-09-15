'use client'

import { useState, useRef, useEffect } from 'react'
import { Button } from '@/components/ui/button'
import { Badge } from '@/components/ui/badge'
import { applyFilter, rotateCanvas, imagesToPdfBlob } from '@/lib/image-filters'
import {
  Camera,
  RotateCw,
  Trash2,
  Plus,
  Check,
  X,
  Sparkles,
  FileText,
  Layers,
  RefreshCw,
  SunMedium
} from 'lucide-react'

export default function DocumentScannerModal({ isOpen, onClose, onComplete }) {
  const [stream, setStream] = useState(null)
  const [pages, setPages] = useState([]) // Array of { originalCanvas, processedUrl, filter: 'clean_bw', rotation: 0 }
  const [currentPageIndex, setCurrentPageIndex] = useState(null)
  const [isCameraActive, setIsCameraActive] = useState(true)
  const [cameraError, setCameraError] = useState(null)
  const [isProcessing, setIsProcessing] = useState(false)
  const [facingMode, setFacingMode] = useState('environment') // 'environment' or 'user'

  const videoRef = useRef(null)

  // Start camera stream when modal opens
  useEffect(() => {
    if (isOpen) {
      startCamera()
    } else {
      stopCamera()
      setPages([])
      setCurrentPageIndex(null)
      setCameraError(null)
    }
    return () => {
      stopCamera()
    }
  }, [isOpen, facingMode])

  const startCamera = async () => {
    try {
      setCameraError(null)
      if (stream) {
        stream.getTracks().forEach((track) => track.stop())
      }

      const mediaStream = await navigator.mediaDevices.getUserMedia({
        video: {
          facingMode: { ideal: facingMode },
          width: { ideal: 1920 },
          height: { ideal: 1080 },
        },
        audio: false,
      })

      setStream(mediaStream)
      if (videoRef.current) {
        videoRef.current.srcObject = mediaStream
      }
      setIsCameraActive(true)
    } catch (err) {
      console.error('Camera access error:', err)
      setCameraError(
        'Unable to access camera. Please allow camera permissions in your browser or upload a file instead.'
      )
    }
  }

  const stopCamera = () => {
    if (stream) {
      stream.getTracks().forEach((track) => track.stop())
      setStream(null)
    }
  }

  // Snap photo from video feed
  const capturePhoto = () => {
    if (!videoRef.current) return

    const video = videoRef.current
    const canvas = document.createElement('canvas')
    canvas.width = video.videoWidth || 1280
    canvas.height = video.videoHeight || 720
    const ctx = canvas.getContext('2d')
    ctx.drawImage(video, 0, 0, canvas.width, canvas.height)

    // Default to 'clean_bw' for high-contrast document scanning
    const processedCanvas = applyFilter(canvas, 'clean_bw')
    const processedUrl = processedCanvas.toDataURL('image/jpeg', 0.9)

    const newPage = {
      originalCanvas: canvas,
      processedUrl,
      filter: 'clean_bw',
      rotation: 0,
    }

    const updatedPages = [...pages, newPage]
    setPages(updatedPages)
    setCurrentPageIndex(updatedPages.length - 1)
    setIsCameraActive(false)
  }

  // Update filter for active page
  const setPageFilter = (filterType) => {
    if (currentPageIndex === null || !pages[currentPageIndex]) return

    const page = pages[currentPageIndex]
    let baseCanvas = page.originalCanvas

    // Apply rotation if needed
    if (page.rotation > 0) {
      baseCanvas = rotateCanvas(baseCanvas, page.rotation)
    }

    const filteredCanvas = applyFilter(baseCanvas, filterType)
    const newUrl = filteredCanvas.toDataURL('image/jpeg', 0.9)

    const updated = [...pages]
    updated[currentPageIndex] = {
      ...page,
      filter: filterType,
      processedUrl: newUrl,
    }
    setPages(updated)
  }

  // Rotate active page by 90 degrees
  const rotateActivePage = () => {
    if (currentPageIndex === null || !pages[currentPageIndex]) return

    const page = pages[currentPageIndex]
    const newRotation = (page.rotation + 90) % 360
    let rotated = rotateCanvas(page.originalCanvas, newRotation)
    let filtered = applyFilter(rotated, page.filter)

    const updated = [...pages]
    updated[currentPageIndex] = {
      ...page,
      rotation: newRotation,
      processedUrl: filtered.toDataURL('image/jpeg', 0.9),
    }
    setPages(updated)
  }

  // Retake current page
  const retakeCurrentPage = () => {
    if (currentPageIndex !== null) {
      const updated = pages.filter((_, idx) => idx !== currentPageIndex)
      setPages(updated)
      setCurrentPageIndex(null)
    }
    setIsCameraActive(true)
  }

  // Delete page
  const deletePage = (index, e) => {
    e.stopPropagation()
    const updated = pages.filter((_, i) => i !== index)
    setPages(updated)
    if (updated.length === 0) {
      setIsCameraActive(true)
      setCurrentPageIndex(null)
    } else {
      setCurrentPageIndex(Math.max(0, index - 1))
    }
  }

  // Finish and compile multi-page document into a single PDF
  const handleFinish = async () => {
    if (pages.length === 0) return

    setIsProcessing(true)
    try {
      const dataUrls = pages.map((p) => p.processedUrl)
      const pdfBlob = await imagesToPdfBlob(dataUrls)

      const file = new File(
        [pdfBlob],
        `QuickInk_Scan_${new Date().toISOString().slice(0, 10)}.pdf`,
        { type: 'application/pdf' }
      )

      stopCamera()
      onComplete({
        file,
        pageCount: pages.length,
        previewUrl: pages[0]?.processedUrl,
      })
      onClose()
    } catch (err) {
      console.error('Error compiling scanned document:', err)
      alert('Failed to generate document. Please try again.')
    } finally {
      setIsProcessing(false)
    }
  }

  if (!isOpen) return null

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/80 p-2 sm:p-4 overflow-y-auto">
      <div className="relative w-full max-w-2xl bg-gray-900 border border-gray-800 rounded-2xl overflow-hidden flex flex-col max-h-[90vh]">
        {/* Header Bar */}
        <div className="flex items-center justify-between px-5 py-3.5 border-b border-gray-800 bg-gray-950">
          <div className="flex items-center gap-2">
            <div className="p-1.5 rounded-lg bg-[#00bf63]/10 text-[#00bf63]">
              <Camera className="h-5 w-5" />
            </div>
            <div>
              <h3 className="text-base font-bold text-white flex items-center gap-2">
                CamScanner Mode
                <Badge variant="outline" className="border-[#00bf63]/40 text-[#00bf63] text-xs">
                  {pages.length} {pages.length === 1 ? 'Page' : 'Pages'}
                </Badge>
              </h3>
              <p className="text-[11px] text-gray-400">Scan documents, notes, or IDs with auto-clean</p>
            </div>
          </div>
          <button
            onClick={() => {
              stopCamera()
              onClose()
            }}
            className="p-1.5 rounded-lg text-gray-400 hover:text-white hover:bg-gray-800 transition-colors"
          >
            <X className="h-5 w-5" />
          </button>
        </div>

        {/* Camera / Preview Viewport */}
        <div className="relative flex-1 bg-black flex items-center justify-center overflow-hidden min-h-[340px] sm:min-h-[400px]">
          {cameraError ? (
            <div className="p-8 text-center max-w-sm">
              <Camera className="h-10 w-10 mx-auto text-red-400 mb-2.5 opacity-80" />
              <p className="text-white font-medium mb-1 text-sm">Camera Unavailable</p>
              <p className="text-xs text-gray-400 mb-4">{cameraError}</p>
              <Button onClick={startCamera} variant="outline" className="border-gray-700 text-white hover:bg-gray-800 text-xs py-1.5 h-8">
                <RefreshCw className="mr-1.5 h-3.5 w-3.5" /> Try Again
              </Button>
            </div>
          ) : isCameraActive ? (
            /* Live Camera Feed */
            <div className="relative w-full h-full flex items-center justify-center">
              <video
                ref={videoRef}
                autoPlay
                playsInline
                muted
                className="w-full h-full object-cover max-h-[440px]"
              />

              {/* Document Alignment Frame Guides */}
              <div className="absolute inset-6 sm:inset-10 border border-dashed border-[#00bf63]/50 rounded-xl pointer-events-none flex flex-col justify-between p-3">
                <div className="flex justify-between">
                  <div className="w-4 h-4 border-t-2 border-l-2 border-[#00bf63] rounded-tl-sm"></div>
                  <div className="w-4 h-4 border-t-2 border-r-2 border-[#00bf63] rounded-tr-sm"></div>
                </div>
                <div className="text-center">
                  <span className="bg-black/70 text-white/90 text-xs px-2.5 py-1 rounded-md font-medium">
                    Align document inside frame
                  </span>
                </div>
                <div className="flex justify-between">
                  <div className="w-4 h-4 border-b-2 border-l-2 border-[#00bf63] rounded-bl-sm"></div>
                  <div className="w-4 h-4 border-b-2 border-r-2 border-[#00bf63] rounded-br-sm"></div>
                </div>
              </div>

              {/* Camera Controls Bar */}
              <div className="absolute bottom-4 inset-x-0 flex items-center justify-around px-6">
                <Button
                  type="button"
                  variant="ghost"
                  size="icon"
                  onClick={() => setFacingMode((prev) => (prev === 'environment' ? 'user' : 'environment'))}
                  className="rounded-full bg-gray-900/80 text-white hover:bg-gray-800"
                  title="Switch Camera"
                >
                  <RefreshCw className="h-5 w-5" />
                </Button>

                {/* Main Shutter Button */}
                <button
                  type="button"
                  onClick={capturePhoto}
                  className="w-16 h-16 rounded-full border-2 border-white bg-[#00bf63] hover:bg-[#00a656] active:scale-95 transition-all flex items-center justify-center group"
                >
                  <div className="w-12 h-12 rounded-full bg-white group-hover:scale-90 transition-transform"></div>
                </button>

                <div className="w-10"></div>
              </div>
            </div>
          ) : (
            /* Processed Scanned Page Preview */
            <div className="relative w-full h-full flex flex-col items-center justify-center p-4">
              <div className="relative max-h-[360px] sm:max-h-[400px] max-w-full rounded-lg overflow-hidden border border-gray-700 bg-white">
                <img
                  src={pages[currentPageIndex]?.processedUrl}
                  alt={`Page ${currentPageIndex + 1}`}
                  className="object-contain max-h-[360px] sm:max-h-[400px]"
                />
              </div>

              {/* Action Floating Buttons */}
              <div className="absolute top-4 right-4 flex gap-2">
                <Button
                  size="sm"
                  variant="secondary"
                  onClick={rotateActivePage}
                  className="bg-gray-900/90 text-white border border-gray-700 hover:bg-gray-800 text-xs h-8"
                  title="Rotate 90°"
                >
                  <RotateCw className="h-3.5 w-3.5 mr-1" /> Rotate
                </Button>
                <Button
                  size="sm"
                  variant="destructive"
                  onClick={retakeCurrentPage}
                  className="bg-red-900/90 hover:bg-red-800 text-xs h-8"
                >
                  <RefreshCw className="h-3.5 w-3.5 mr-1" /> Retake
                </Button>
              </div>
            </div>
          )}
        </div>

        {/* Filter Selection Tabs (Visible when previewing a snapped page) */}
        {!isCameraActive && pages[currentPageIndex] && (
          <div className="bg-gray-950 px-4 py-2.5 border-t border-gray-800 flex items-center justify-center gap-2 overflow-x-auto">
            <span className="text-xs text-gray-400 font-medium mr-1 hidden sm:inline">Filter:</span>
            {[
              { id: 'clean_bw', label: 'Clean B&W', icon: FileText, desc: 'Best for ৳2 B&W prints' },
              { id: 'magic_color', label: 'Magic Color', icon: Sparkles, desc: 'Vibrant text & white paper' },
              { id: 'grayscale', label: 'Grayscale', icon: Layers, desc: 'Neutral tones' },
              { id: 'original', label: 'Original', icon: SunMedium, desc: 'No filter' },
            ].map((f) => {
              const Icon = f.icon
              const isActive = pages[currentPageIndex].filter === f.id
              return (
                <button
                  key={f.id}
                  onClick={() => setPageFilter(f.id)}
                  className={`flex items-center gap-1.5 px-3 py-1 rounded-full text-xs font-semibold transition-colors ${
                    isActive
                      ? 'bg-[#00bf63] text-white'
                      : 'bg-gray-900 text-gray-400 hover:text-white hover:bg-gray-800 border border-gray-800'
                  }`}
                >
                  <Icon className="h-3 w-3" />
                  {f.label}
                </button>
              )
            })}
          </div>
        )}

        {/* Multi-Page Tray & Bottom Controls */}
        <div className="p-3.5 bg-gray-950 border-t border-gray-800">
          {/* Thumbnails Row */}
          {pages.length > 0 && (
            <div className="flex items-center gap-2 overflow-x-auto pb-2.5 mb-2.5 custom-scrollbar">
              {pages.map((p, idx) => (
                <div
                  key={idx}
                  onClick={() => {
                    setCurrentPageIndex(idx)
                    setIsCameraActive(false)
                  }}
                  className={`relative flex-shrink-0 w-14 h-18 rounded-lg overflow-hidden border-2 cursor-pointer transition-colors ${
                    !isCameraActive && currentPageIndex === idx
                      ? 'border-[#00bf63]'
                      : 'border-gray-700 opacity-70 hover:opacity-100'
                  }`}
                >
                  <img src={p.processedUrl} alt={`Thumb ${idx + 1}`} className="w-full h-full object-cover" />
                  <span className="absolute bottom-0 inset-x-0 bg-black/80 text-[9px] text-center text-white py-0.5 font-bold">
                    P{idx + 1}
                  </span>
                  <button
                    onClick={(e) => deletePage(idx, e)}
                    className="absolute top-0.5 right-0.5 p-0.5 bg-red-600 text-white rounded-full hover:bg-red-700"
                    title="Delete page"
                  >
                    <Trash2 className="h-2.5 w-2.5" />
                  </button>
                </div>
              ))}

              {/* Add Another Page Button */}
              <button
                onClick={() => {
                  setIsCameraActive(true)
                  setCurrentPageIndex(null)
                  startCamera()
                }}
                className={`flex-shrink-0 w-14 h-18 rounded-lg border border-dashed border-gray-700 hover:border-[#00bf63] flex flex-col items-center justify-center text-gray-400 hover:text-white transition-colors ${
                  isCameraActive ? 'border-[#00bf63] bg-[#00bf63]/10' : ''
                }`}
                title="Scan next page"
              >
                <Plus className="h-4 w-4 mb-0.5 text-[#00bf63]" />
                <span className="text-[9px] font-bold">+ Page</span>
              </button>
            </div>
          )}

          {/* Action Row */}
          <div className="flex items-center justify-between gap-3">
            <div className="text-xs text-gray-400">
              {pages.length > 0 ? (
                <span>
                  <strong className="text-white">{pages.length}</strong> {pages.length === 1 ? 'page' : 'pages'}{' '}
                  ready
                </span>
              ) : (
                <span>Snap document to begin</span>
              )}
            </div>

            <div className="flex items-center gap-2">
              {pages.length > 0 && isCameraActive && (
                <Button
                  type="button"
                  variant="outline"
                  size="sm"
                  onClick={() => {
                    setIsCameraActive(false)
                    setCurrentPageIndex(pages.length - 1)
                  }}
                  className="border-gray-700 text-gray-300 hover:bg-gray-800 text-xs h-8"
                >
                  Review ({pages.length})
                </Button>
              )}

              <Button
                type="button"
                disabled={pages.length === 0 || isProcessing}
                onClick={handleFinish}
                className="bg-[#00bf63] hover:bg-[#00a656] text-white px-4 h-8 text-xs font-bold shadow-none"
              >
                {isProcessing ? (
                  <>
                    <RefreshCw className="mr-1.5 h-3.5 w-3.5 animate-spin" /> Compiling...
                  </>
                ) : (
                  <>
                    <Check className="mr-1.5 h-3.5 w-3.5" /> Use Document ({pages.length})
                  </>
                )}
              </Button>
            </div>
          </div>
        </div>
      </div>
    </div>
  )
}
