'use client'

import { useState, useRef, useEffect, useCallback } from 'react'
import { jsPDF } from 'jspdf'
import { Button } from '@/components/ui/button'
import { Badge } from '@/components/ui/badge'
import {
  Camera,
  Upload,
  X,
  Sparkles,
  CheckCircle2,
  RefreshCw,
  ArrowRight,
  ChevronLeft,
  RotateCw,
  Crop,
  Maximize2,
  FileText,
  CreditCard,
  Layers,
  Sparkle,
  Sliders
} from 'lucide-react'
import {
  perspectiveWarp,
  applyDocumentFilter,
  rotateCanvas,
  getInitialCorners,
  composeToA4
} from '@/lib/scanner-utils'

export default function SmartScannerModal({ isOpen, onClose, onComplete, initialDocMode = null }) {
  // Navigation: 'mode-select' | 'source-select' | 'camera' | 'crop' | 'review'
  const [stage, setStage] = useState('mode-select')
  const [docMode, setDocMode] = useState('idCard') // 'idCard' | 'certificate' | 'halfSheet' | 'auto'
  const [activeSide, setActiveSide] = useState('front') // 'front' | 'back'

  // Image storage
  const [rawImageSrc, setRawImageSrc] = useState(null)
  const [frontWarpedCanvas, setFrontWarpedCanvas] = useState(null)
  const [backWarpedCanvas, setBackWarpedCanvas] = useState(null)
  const [currentWarpedCanvas, setCurrentWarpedCanvas] = useState(null)

  // Review adjustments
  const [filterMode, setFilterMode] = useState('magic') // 'original' | 'magic' | 'bw' | 'grayscale'
  const [rotationDeg, setRotationDeg] = useState(0)
  const [isProcessing, setIsProcessing] = useState(false)

  // Camera state
  const videoRef = useRef(null)
  const streamRef = useRef(null)
  const [cameraError, setCameraError] = useState(null)
  const [facingMode, setFacingMode] = useState('environment') // 'environment' | 'user'

  // Crop / Corner Pin state
  const cropContainerRef = useRef(null)
  const [corners, setCorners] = useState([]) // [{x, y}, ...] in image coordinate space
  const [imageDims, setImageDims] = useState({ width: 0, height: 0 })
  const [activeCornerIdx, setActiveCornerIdx] = useState(null)
  const [loupePos, setLoupePos] = useState({ x: 0, y: 0 }) // position for magnifying glass
  const fileInputRef = useRef(null)
  const imageElementRef = useRef(null)

  // Reset modal state upon opening
  useEffect(() => {
    if (isOpen) {
      if (initialDocMode) {
        setDocMode(initialDocMode)
        setStage('source-select')
      } else {
        setDocMode('idCard')
        setStage('mode-select')
      }
      setActiveSide('front')
      setRawImageSrc(null)
      setFrontWarpedCanvas(null)
      setBackWarpedCanvas(null)
      setCurrentWarpedCanvas(null)
      setRotationDeg(0)
      setFilterMode('magic')
      stopCamera()
    } else {
      stopCamera()
    }
  }, [isOpen])

  // Stop camera helper
  const stopCamera = useCallback(() => {
    if (streamRef.current) {
      streamRef.current.getTracks().forEach((track) => track.stop())
      streamRef.current = null
    }
  }, [])

  // Start camera stream
  const startCamera = async () => {
    setCameraError(null)
    stopCamera()
    try {
      const constraints = {
        video: {
          facingMode: { ideal: facingMode },
          width: { ideal: 1920 },
          height: { ideal: 1080 }
        }
      }
      const stream = await navigator.mediaDevices.getUserMedia(constraints)
      streamRef.current = stream
      if (videoRef.current) {
        videoRef.current.srcObject = stream
        videoRef.current.play()
      }
      setStage('camera')
    } catch (err) {
      console.warn('Camera access error, fallback to file picker:', err)
      setCameraError('Camera access not granted or not supported on this device. Please select an image from files.')
      setStage('source-select')
    }
  }

  // Handle capture from live video
  const captureFromCamera = () => {
    if (!videoRef.current) return
    const video = videoRef.current
    const canvas = document.createElement('canvas')
    canvas.width = video.videoWidth || 1280
    canvas.height = video.videoHeight || 720
    const ctx = canvas.getContext('2d')
    ctx.drawImage(video, 0, 0, canvas.width, canvas.height)
    stopCamera()

    const dataUrl = canvas.toDataURL('image/jpeg', 0.95)
    loadImageForCrop(dataUrl)
  }

  // Handle image file selection
  const handleFileChange = (e) => {
    const file = e.target.files?.[0]
    if (!file) return
    const reader = new FileReader()
    reader.onload = (ev) => {
      loadImageForCrop(ev.target.result)
    }
    reader.readAsDataURL(file)
  }

  // Load selected/captured image and initialize perspective crop corners
  const loadImageForCrop = (src) => {
    setRawImageSrc(src)
    const img = new Image()
    img.onload = () => {
      imageElementRef.current = img
      setImageDims({ width: img.naturalWidth, height: img.naturalHeight })
      setCorners(getInitialCorners(img.naturalWidth, img.naturalHeight))
      setStage('crop')
    }
    img.src = src
  }

  // Convert client viewport point to image natural coordinate space
  const clientToImageCoords = (clientX, clientY) => {
    if (!cropContainerRef.current || !imageDims.width) return { x: 0, y: 0 }
    const rect = cropContainerRef.current.getBoundingClientRect()
    const scaleX = imageDims.width / rect.width
    const scaleY = imageDims.height / rect.height

    const x = Math.max(0, Math.min(imageDims.width, (clientX - rect.left) * scaleX))
    const y = Math.max(0, Math.min(imageDims.height, (clientY - rect.top) * scaleY))
    return { x: Math.round(x), y: Math.round(y) }
  }

  // Pointer down on a corner handle
  const handleCornerPointerDown = (idx, e) => {
    e.preventDefault()
    e.stopPropagation()
    setActiveCornerIdx(idx)
    setLoupePos({ x: e.clientX, y: e.clientY })
  }

  // Pointer move to update corner position
  const handleContainerPointerMove = (e) => {
    if (activeCornerIdx === null) return
    e.preventDefault()
    const pt = clientToImageCoords(e.clientX, e.clientY)
    setCorners((prev) => {
      const next = [...prev]
      next[activeCornerIdx] = pt
      return next
    })
    setLoupePos({ x: e.clientX, y: e.clientY })
  }

  // Pointer up to release handle
  const handleContainerPointerUp = () => {
    setActiveCornerIdx(null)
  }

  // Reset corners to full photo boundaries
  const handleResetCorners = () => {
    if (!imageDims.width) return
    setCorners([
      { x: 0, y: 0 },
      { x: imageDims.width, y: 0 },
      { x: imageDims.width, y: imageDims.height },
      { x: 0, y: imageDims.height }
    ])
  }

  // Execute 4-point perspective warp
  const handlePerformCrop = () => {
    if (!imageElementRef.current || corners.length !== 4) return
    setIsProcessing(true)

    setTimeout(() => {
      try {
        let targetAspect = null
        if (docMode === 'idCard') {
          targetAspect = 85.6 / 53.98 // Standard ISO/IEC 7810 ID-1 card aspect ratio (~1.586)
        } else if (docMode === 'certificate') {
          targetAspect = 210 / 297 // A4 portrait (1 / 1.414)
        } else if (docMode === 'halfSheet') {
          targetAspect = 210 / 148.5 // Half A4 landscape (1.414)
        }

        const warped = perspectiveWarp(imageElementRef.current, corners, targetAspect)
        setCurrentWarpedCanvas(warped)
        setRotationDeg(0)
        setFilterMode('magic')
        setStage('review')
      } catch (err) {
        console.error('Warp error:', err)
      } finally {
        setIsProcessing(false)
      }
    }, 50)
  }

  // Save current side into front/back storage
  const finalizeCurrentSide = () => {
    let finalCanvas = currentWarpedCanvas
    if (rotationDeg !== 0) {
      finalCanvas = rotateCanvas(finalCanvas, rotationDeg)
    }
    if (filterMode !== 'original') {
      finalCanvas = applyDocumentFilter(finalCanvas, filterMode)
    }

    if (activeSide === 'front') {
      setFrontWarpedCanvas(finalCanvas)
      return finalCanvas
    } else {
      setBackWarpedCanvas(finalCanvas)
      return finalCanvas
    }
  }

  // Start scanning back side
  const handleAddBackSide = () => {
    finalizeCurrentSide()
    setActiveSide('back')
    setRawImageSrc(null)
    setStage('source-select')
  }

  // Final PDF compilation & completion
  const handleCompleteAndPrint = async () => {
    setIsProcessing(true)
    try {
      const currentFinal = finalizeCurrentSide()
      const front = activeSide === 'front' ? currentFinal : frontWarpedCanvas
      const back = activeSide === 'back' ? currentFinal : backWarpedCanvas

      // Compose onto clean standard A4 page
      const a4Canvas = composeToA4(docMode, front, back)
      const dataUrl = a4Canvas.toDataURL('image/jpeg', 0.94)

      // Create standard A4 PDF document
      const pdf = new jsPDF({
        orientation: 'portrait',
        unit: 'mm',
        format: 'a4'
      })
      pdf.addImage(dataUrl, 'JPEG', 0, 0, 210, 297, undefined, 'FAST')
      const pdfBlob = pdf.output('blob')

      const modeTitle =
        docMode === 'idCard'
          ? 'ID_Card_2in1_Scan'
          : docMode === 'halfSheet'
          ? 'AdmitCard_2in1_Scan'
          : 'Smart_Document_Scan'

      const file = new File([pdfBlob], `${modeTitle}_${Date.now()}.pdf`, {
        type: 'application/pdf'
      })

      onComplete({
        file,
        previewUrl: dataUrl,
        mode: docMode,
        hasBackSide: Boolean(back)
      })
      onClose()
    } catch (err) {
      console.error('Finalize print PDF error:', err)
    } finally {
      setIsProcessing(false)
    }
  }

  if (!isOpen) return null

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-3 sm:p-4 bg-black/80 backdrop-blur-sm animate-in fade-in duration-200">
      <div className="bg-slate-900 border border-slate-800 rounded-3xl w-full max-w-lg overflow-hidden shadow-2xl flex flex-col max-h-[92vh]">
        {/* Modal Top Header */}
        <div className="px-5 py-4 border-b border-slate-800 flex items-center justify-between bg-slate-900/90 backdrop-blur">
          <div className="flex items-center gap-2.5">
            <div className="w-8 h-8 rounded-xl bg-[#00bf63]/20 text-[#00bf63] flex items-center justify-center font-bold text-sm">
              📸
            </div>
            <div>
              <div className="flex items-center gap-2">
                <h3 className="text-sm font-bold text-white leading-tight">Smart Scanner</h3>
                <Badge className="bg-[#00bf63] hover:bg-[#00bf63] text-black text-[9px] px-1.5 py-0 font-extrabold uppercase">
                  Auto-Align
                </Badge>
              </div>
              <p className="text-[11px] text-slate-400">
                {activeSide === 'front' ? 'Scanning Front Side' : 'Scanning Back Side'}
              </p>
            </div>
          </div>
          <button
            onClick={() => {
              stopCamera()
              onClose()
            }}
            className="w-8 h-8 rounded-full bg-slate-800 hover:bg-slate-700 text-slate-400 hover:text-white flex items-center justify-center transition-colors"
          >
            <X className="w-4 h-4" />
          </button>
        </div>

        {/* Modal Body Stages */}
        <div className="p-5 flex-1 overflow-y-auto">
          {/* ========================================================================= */}
          {/* STAGE 1: DOCUMENT TYPE SELECTION */}
          {/* ========================================================================= */}
          {stage === 'mode-select' && (
            <div className="space-y-4 animate-in fade-in duration-150">
              <div className="text-center space-y-1 mb-2">
                <h4 className="text-base font-bold text-white">What are you scanning?</h4>
                <p className="text-xs text-slate-400 max-w-xs mx-auto">
                  Selecting the right type locks ideal proportions and automatically fits your document onto standard paper.
                </p>
              </div>

              <div className="grid gap-2.5">
                {/* 1. ID Card */}
                <button
                  type="button"
                  onClick={() => {
                    setDocMode('idCard')
                    setStage('source-select')
                  }}
                  className="p-3.5 rounded-2xl bg-slate-800/80 hover:bg-slate-800 border border-slate-700/80 hover:border-[#00bf63] text-left flex items-center gap-3.5 transition-all group"
                >
                  <div className="w-12 h-10 rounded-xl bg-slate-700/60 border border-slate-600 flex items-center justify-center gap-1 flex-shrink-0 group-hover:border-[#00bf63]/50">
                    <div className="w-4 h-6 rounded bg-[#00bf63]/60" />
                    <div className="w-4 h-6 rounded bg-[#00bf63]/30" />
                  </div>
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center justify-between">
                      <b className="text-xs font-bold text-white">ID Card Photocopy</b>
                      <span className="text-[10px] text-[#00bf63] font-bold">2-on-1 A4</span>
                    </div>
                    <span className="text-[11px] text-slate-400 block mt-0.5">
                      Aadhaar, PAN, Voter, Driving License, National ID — Front & Back on one page.
                    </span>
                  </div>
                </button>

                {/* 2. Certificate / Full Document */}
                <button
                  type="button"
                  onClick={() => {
                    setDocMode('certificate')
                    setStage('source-select')
                  }}
                  className="p-3.5 rounded-2xl bg-slate-800/80 hover:bg-slate-800 border border-slate-700/80 hover:border-[#00bf63] text-left flex items-center gap-3.5 transition-all group"
                >
                  <div className="w-12 h-10 rounded-xl bg-slate-700/60 border border-slate-600 flex items-center justify-center flex-shrink-0 group-hover:border-[#00bf63]/50">
                    <div className="w-6 h-8 rounded bg-[#00bf63]/50" />
                  </div>
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center justify-between">
                      <b className="text-xs font-bold text-white">Certificate / Full Document</b>
                      <span className="text-[10px] text-slate-400 font-medium">Full A4</span>
                    </div>
                    <span className="text-[11px] text-slate-400 block mt-0.5">
                      Full-page certificate, letter, transcript, or single document page.
                    </span>
                  </div>
                </button>

                {/* 3. Admit Card / Marksheet 2-in-1 */}
                <button
                  type="button"
                  onClick={() => {
                    setDocMode('halfSheet')
                    setStage('source-select')
                  }}
                  className="p-3.5 rounded-2xl bg-slate-800/80 hover:bg-slate-800 border border-slate-700/80 hover:border-[#00bf63] text-left flex items-center gap-3.5 transition-all group"
                >
                  <div className="w-12 h-10 rounded-xl bg-slate-700/60 border border-slate-600 flex flex-col items-center justify-center gap-0.5 flex-shrink-0 group-hover:border-[#00bf63]/50">
                    <div className="w-8 h-3.5 rounded-xs bg-[#00bf63]/60" />
                    <div className="w-8 h-3.5 rounded-xs bg-[#00bf63]/30" />
                  </div>
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center justify-between">
                      <b className="text-xs font-bold text-white">Admit Card / Marksheet</b>
                      <span className="text-[10px] text-[#00bf63] font-bold">Top & Bottom</span>
                    </div>
                    <span className="text-[11px] text-slate-400 block mt-0.5">
                      Half page: Front on top, Back on bottom on a single A4 sheet.
                    </span>
                  </div>
                </button>

                {/* 4. Auto */}
                <button
                  type="button"
                  onClick={() => {
                    setDocMode('auto')
                    setStage('source-select')
                  }}
                  className="p-3.5 rounded-2xl bg-slate-800/80 hover:bg-slate-800 border border-slate-700/80 hover:border-[#00bf63] text-left flex items-center gap-3.5 transition-all group"
                >
                  <div className="w-12 h-10 rounded-xl bg-slate-700/60 border border-slate-600 border-dashed flex items-center justify-center flex-shrink-0 group-hover:border-[#00bf63]/50">
                    <span className="text-xs font-bold text-slate-400">?</span>
                  </div>
                  <div className="flex-1 min-w-0">
                    <b className="text-xs font-bold text-white">Auto / Custom Dimensions</b>
                    <span className="text-[11px] text-slate-400 block mt-0.5">
                      System automatically detects proportions and aligns cleanly on paper.
                    </span>
                  </div>
                </button>
              </div>
            </div>
          )}

          {/* ========================================================================= */}
          {/* STAGE 2: SOURCE SELECTION (CAMERA OR FILES) */}
          {/* ========================================================================= */}
          {stage === 'source-select' && (
            <div className="space-y-4 animate-in fade-in duration-150">
              <div className="text-center space-y-1 mb-2">
                <h4 className="text-base font-bold text-white">How would you like to capture?</h4>
                <p className="text-xs text-slate-400">
                  {activeSide === 'front' ? 'Capture or upload Front side' : 'Capture or upload Back side'}
                </p>
              </div>

              {cameraError && (
                <div className="p-3 bg-amber-500/10 border border-amber-500/30 rounded-xl text-amber-300 text-xs">
                  {cameraError}
                </div>
              )}

              <div className="grid gap-3">
                {/* Option 1: Live Camera */}
                <button
                  type="button"
                  onClick={startCamera}
                  className="p-4 rounded-2xl bg-slate-800 hover:bg-slate-750 border border-slate-700 hover:border-[#00bf63] text-left flex items-center gap-4 transition-colors group"
                >
                  <div className="w-12 h-12 rounded-xl bg-[#00bf63]/20 text-[#00bf63] flex items-center justify-center text-2xl flex-shrink-0 group-hover:scale-105 transition-transform">
                    📸
                  </div>
                  <div>
                    <b className="text-xs font-bold text-white block">Camera Live Capture</b>
                    <span className="text-[11px] text-slate-400 block mt-0.5">
                      Point at your document — fastest with live framing guides.
                    </span>
                  </div>
                </button>

                {/* Option 2: Upload Files / Gallery */}
                <button
                  type="button"
                  onClick={() => fileInputRef.current?.click()}
                  className="p-4 rounded-2xl bg-slate-800 hover:bg-slate-750 border border-slate-700 hover:border-[#00bf63] text-left flex items-center gap-4 transition-colors group"
                >
                  <div className="w-12 h-12 rounded-xl bg-slate-700 text-slate-200 flex items-center justify-center text-2xl flex-shrink-0 group-hover:scale-105 transition-transform">
                    📁
                  </div>
                  <div>
                    <b className="text-xs font-bold text-white block">Choose from Files / Gallery</b>
                    <span className="text-[11px] text-slate-400 block mt-0.5">
                      Select photo already saved on your phone or computer.
                    </span>
                  </div>
                </button>
              </div>

              <input
                ref={fileInputRef}
                type="file"
                accept="image/*"
                className="hidden"
                onChange={handleFileChange}
              />

              <div className="pt-3 flex justify-start">
                <Button
                  variant="ghost"
                  size="sm"
                  onClick={() => setStage('mode-select')}
                  className="text-xs text-slate-400 hover:text-white"
                >
                  <ChevronLeft className="w-4 h-4 mr-1" /> Back
                </Button>
              </div>
            </div>
          )}

          {/* ========================================================================= */}
          {/* STAGE 3: LIVE CAMERA VIEWFINDER */}
          {/* ========================================================================= */}
          {stage === 'camera' && (
            <div className="space-y-4 animate-in fade-in duration-150">
              <div className="relative w-full aspect-[4/3] bg-black rounded-2xl overflow-hidden border border-slate-700 shadow-inner flex items-center justify-center">
                <video
                  ref={videoRef}
                  autoPlay
                  playsInline
                  muted
                  className="w-full h-full object-cover"
                />

                {/* Document Viewfinder Overlay Guidelines */}
                <div className="absolute inset-6 sm:inset-8 border-2 border-[#00bf63]/80 rounded-xl pointer-events-none flex flex-col justify-between p-2">
                  <div className="flex justify-between">
                    <div className="w-4 h-4 border-t-2 border-l-2 border-[#00bf63]" />
                    <div className="w-4 h-4 border-t-2 border-r-2 border-[#00bf63]" />
                  </div>
                  <div className="text-center">
                    <span className="bg-black/70 text-[#00bf63] text-[10px] font-bold px-2 py-0.5 rounded-full backdrop-blur-xs">
                      ✓ Align document inside frame
                    </span>
                  </div>
                  <div className="flex justify-between">
                    <div className="w-4 h-4 border-b-2 border-l-2 border-[#00bf63]" />
                    <div className="w-4 h-4 border-b-2 border-r-2 border-[#00bf63]" />
                  </div>
                </div>
              </div>

              {/* Shutter & Controls */}
              <div className="flex items-center justify-between px-4 pt-1">
                <Button
                  variant="ghost"
                  size="sm"
                  onClick={() => {
                    stopCamera()
                    setStage('source-select')
                  }}
                  className="text-xs text-slate-400 hover:text-white"
                >
                  Cancel
                </Button>

                {/* Big Camera Shutter Button */}
                <button
                  type="button"
                  onClick={captureFromCamera}
                  className="w-16 h-16 rounded-full border-4 border-white bg-slate-900 p-1 flex items-center justify-center hover:scale-105 active:scale-95 transition-all shadow-lg"
                >
                  <div className="w-full h-full rounded-full bg-[#00bf63]" />
                </button>

                {/* Flip camera */}
                <Button
                  variant="ghost"
                  size="sm"
                  onClick={() => {
                    setFacingMode((prev) => (prev === 'environment' ? 'user' : 'environment'))
                    startCamera()
                  }}
                  className="text-xs text-slate-400 hover:text-white"
                >
                  <RotateCw className="w-4 h-4" />
                </Button>
              </div>
            </div>
          )}

          {/* ========================================================================= */}
          {/* STAGE 4: PERSPECTIVE CROP & 4-CORNER PINNING */}
          {/* ========================================================================= */}
          {stage === 'crop' && (
            <div className="space-y-3 animate-in fade-in duration-150 select-none">
              <div className="flex items-center justify-between">
                <div>
                  <h4 className="text-xs font-bold text-white flex items-center gap-1.5">
                    <Crop className="w-4 h-4 text-[#00bf63]" /> Perspective Crop & Straighten
                  </h4>
                  <p className="text-[11px] text-slate-400">
                    Drag the 4 corner pins to match the document's edges — even tilted photos become perfectly straight!
                  </p>
                </div>
                <Button
                  variant="outline"
                  size="sm"
                  onClick={handleResetCorners}
                  className="h-7 text-[10px] font-bold border-slate-700 bg-slate-800 text-slate-300 hover:text-white"
                >
                  Full Photo
                </Button>
              </div>

              {/* Interactive Crop Canvas Container */}
              <div
                ref={cropContainerRef}
                onPointerMove={handleContainerPointerMove}
                onPointerUp={handleContainerPointerUp}
                className="relative w-full aspect-[4/3] bg-slate-950 rounded-2xl overflow-hidden border border-slate-800 touch-none flex items-center justify-center"
              >
                {rawImageSrc && (
                  <img
                    src={rawImageSrc}
                    alt="Scan Target"
                    className="w-full h-full object-contain pointer-events-none"
                  />
                )}

                {/* SVG Polygon connecting the 4 corners */}
                {corners.length === 4 && cropContainerRef.current && (
                  <svg className="absolute inset-0 w-full h-full pointer-events-none">
                    {/* Translucent Polygon Mask */}
                    <polygon
                      points={corners
                        .map((c) => {
                          const rect = cropContainerRef.current.getBoundingClientRect()
                          const px = (c.x / imageDims.width) * rect.width
                          const py = (c.y / imageDims.height) * rect.height
                          return `${px},${py}`
                        })
                        .join(' ')}
                      fill="rgba(0, 191, 99, 0.15)"
                      stroke="#00bf63"
                      strokeWidth="2.5"
                      strokeDasharray="4 2"
                    />
                  </svg>
                )}

                {/* 4 Interactive Corner Pins */}
                {corners.map((corner, idx) => {
                  if (!cropContainerRef.current || !imageDims.width) return null
                  const rect = cropContainerRef.current.getBoundingClientRect()
                  const px = (corner.x / imageDims.width) * rect.width
                  const py = (corner.y / imageDims.height) * rect.height

                  return (
                    <div
                      key={idx}
                      onPointerDown={(e) => handleCornerPointerDown(idx, e)}
                      style={{
                        transform: `translate(${px - 14}px, ${py - 14}px)`
                      }}
                      className="absolute top-0 left-0 w-7 h-7 rounded-full bg-white border-3 border-[#00bf63] shadow-md cursor-grab active:cursor-grabbing flex items-center justify-center hover:scale-125 transition-transform z-30"
                    >
                      <div className="w-1.5 h-1.5 rounded-full bg-[#00bf63]" />
                    </div>
                  )
                })}

                {/* Corner Magnifying Loupe (Floating Zoom Bubble) */}
                {activeCornerIdx !== null && cropContainerRef.current && (
                  <div
                    style={{
                      left: Math.max(10, Math.min(cropContainerRef.current.clientWidth - 90, (corners[activeCornerIdx].x / imageDims.width) * cropContainerRef.current.clientWidth - 45)),
                      top: Math.max(10, (corners[activeCornerIdx].y / imageDims.height) * cropContainerRef.current.clientHeight - 100)
                    }}
                    className="absolute pointer-events-none z-40 w-22 h-22 rounded-full border-2 border-white shadow-2xl overflow-hidden bg-black flex items-center justify-center animate-in zoom-in-75 duration-75"
                  >
                    {/* Zoomed portion of original image */}
                    <div
                      style={{
                        width: cropContainerRef.current.clientWidth * 2.5,
                        height: cropContainerRef.current.clientHeight * 2.5,
                        transform: `translate(${
                          -(corners[activeCornerIdx].x / imageDims.width) * cropContainerRef.current.clientWidth * 2.5 + 44
                        }px, ${
                          -(corners[activeCornerIdx].y / imageDims.height) * cropContainerRef.current.clientHeight * 2.5 + 44
                        }px)`
                      }}
                      className="absolute top-0 left-0 origin-top-left"
                    >
                      <img src={rawImageSrc} alt="Zoom" className="w-full h-full object-contain" />
                    </div>
                    {/* Precision Crosshairs */}
                    <div className="absolute w-full h-[1px] bg-[#00bf63]/80" />
                    <div className="absolute h-full w-[1px] bg-[#00bf63]/80" />
                    <div className="absolute w-2 h-2 rounded-full border border-white" />
                  </div>
                )}
              </div>

              {/* Action Buttons */}
              <div className="flex gap-2 pt-1">
                <Button
                  variant="outline"
                  size="sm"
                  onClick={() => setStage('source-select')}
                  className="flex-1 text-xs border-slate-700 bg-slate-800 text-slate-300 hover:text-white"
                >
                  Cancel
                </Button>
                <Button
                  size="sm"
                  disabled={isProcessing}
                  onClick={handlePerformCrop}
                  className="flex-1 bg-[#00bf63] hover:bg-[#00a656] text-black font-extrabold text-xs shadow-none"
                >
                  {isProcessing ? (
                    <RefreshCw className="w-3.5 h-3.5 animate-spin mr-1" />
                  ) : (
                    <Crop className="w-3.5 h-3.5 mr-1" />
                  )}
                  Straighten & Crop
                </Button>
              </div>
            </div>
          )}

          {/* ========================================================================= */}
          {/* STAGE 5: REVIEW, ENHANCE & MULTI-SIDE CHAINING */}
          {/* ========================================================================= */}
          {stage === 'review' && currentWarpedCanvas && (
            <div className="space-y-4 animate-in fade-in duration-150">
              <div className="text-center">
                <h4 className="text-xs font-bold text-white">Review Straightened Document</h4>
                <p className="text-[11px] text-slate-400">
                  {docMode === 'idCard' || docMode === 'halfSheet'
                    ? activeSide === 'front'
                      ? 'Front side ready! You can now add the back side or proceed.'
                      : 'Back side ready! Both sides will be merged into standard A4.'
                    : 'Your document is straightened and ready for high-resolution printing.'}
                </p>
              </div>

              {/* Live Filter & Rotation Canvas Preview Box */}
              <div className="bg-slate-950 border border-slate-800 rounded-2xl p-3 flex items-center justify-center min-h-[220px] max-h-[280px] overflow-hidden">
                <img
                  src={
                    applyDocumentFilter(
                      rotateCanvas(currentWarpedCanvas, rotationDeg),
                      filterMode
                    ).toDataURL('image/jpeg', 0.9)
                  }
                  alt="Warped Scan Result"
                  className="max-h-[240px] max-w-full rounded shadow-lg object-contain bg-white"
                />
              </div>

              {/* Filter Chips & Rotate 90° */}
              <div className="flex items-center justify-between gap-2">
                <div className="flex items-center gap-1 overflow-x-auto py-1">
                  {[
                    { id: 'magic', label: '✨ Magic Clean', desc: 'Whitened paper' },
                    { id: 'bw', label: '⬛ B&W Copy', desc: 'High contrast' },
                    { id: 'original', label: '🌈 Original', desc: 'Natural color' },
                    { id: 'grayscale', label: '🔘 Grayscale', desc: 'Smooth B&W' }
                  ].map((f) => (
                    <button
                      key={f.id}
                      type="button"
                      onClick={() => setFilterMode(f.id)}
                      className={`px-2.5 py-1 rounded-lg text-xs font-bold transition-colors whitespace-nowrap ${
                        filterMode === f.id
                          ? 'bg-[#00bf63] text-black'
                          : 'bg-slate-800 text-slate-400 hover:text-white border border-slate-700'
                      }`}
                    >
                      {f.label}
                    </button>
                  ))}
                </div>

                <Button
                  size="sm"
                  variant="outline"
                  onClick={() => setRotationDeg((r) => (r + 90) % 360)}
                  className="h-8 rounded-lg text-xs border-slate-700 bg-slate-800 text-slate-200 hover:text-white flex-shrink-0"
                >
                  <RotateCw className="w-3.5 h-3.5 mr-1" /> 90°
                </Button>
              </div>

              {/* Action Buttons: Add Back Side or Complete */}
              <div className="space-y-2 pt-2 border-t border-slate-800">
                {(docMode === 'idCard' || docMode === 'halfSheet') && activeSide === 'front' && (
                  <Button
                    variant="outline"
                    onClick={handleAddBackSide}
                    className="w-full border-amber-500/50 bg-amber-500/10 hover:bg-amber-500/20 text-amber-300 font-bold text-xs py-5 rounded-xl flex items-center justify-center gap-2"
                  >
                    <span>➕</span> Add Back Side (Photo of reverse)
                  </Button>
                )}

                <Button
                  disabled={isProcessing}
                  onClick={handleCompleteAndPrint}
                  className="w-full bg-[#00bf63] hover:bg-[#00a656] text-black font-extrabold text-xs py-5 rounded-xl shadow-lg shadow-[#00bf63]/20 flex items-center justify-center gap-2"
                >
                  {isProcessing ? (
                    <RefreshCw className="w-4 h-4 animate-spin" />
                  ) : (
                    <CheckCircle2 className="w-4 h-4" />
                  )}
                  {activeSide === 'front' && (docMode === 'idCard' || docMode === 'halfSheet')
                    ? 'Done (Front Only) — Proceed to Print →'
                    : 'Done — Proceed to Print →'}
                </Button>
              </div>
            </div>
          )}
        </div>
      </div>
    </div>
  )
}
