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
  Sliders,
  Move
} from 'lucide-react'
import {
  perspectiveWarp,
  applyDocumentFilter,
  rotateCanvas,
  getInitialCorners,
  composeToA4
} from '@/lib/scanner-utils'

export default function SmartScannerModal({
  isOpen,
  onClose,
  onComplete,
  initialDocMode = null,
  initialImageSrc = null
}) {
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
  const [idCardLayout, setIdCardLayout] = useState('vertical') // 'vertical' (Top & Bottom) | 'horizontal' (Side by Side)
  const [composedPreviewUrl, setComposedPreviewUrl] = useState(null)

  // Camera state
  const videoRef = useRef(null)
  const streamRef = useRef(null)
  const [cameraError, setCameraError] = useState(null)
  const [facingMode, setFacingMode] = useState('environment') // 'environment' | 'user'

  // Crop / Corner Pin state
  const cropContainerRef = useRef(null)
  const [corners, setCorners] = useState([]) // [{x, y}, ...] in image natural pixel coordinate space
  const [imageDims, setImageDims] = useState({ width: 0, height: 0 })
  const [activeDrag, setActiveDrag] = useState(null) // null | { type: 'corner', idx } | { type: 'edge', edge } | { type: 'quad' }
  const [cropAspectPreset, setCropAspectPreset] = useState('idCard') // 'free' | 'idCard' | 'a4' | 'halfSheet' | 'square'
  const dragStartRef = useRef({ startX: 0, startY: 0, initialCorners: [] })
  const fileInputRef = useRef(null)
  const cameraInputRef = useRef(null)
  const imageElementRef = useRef(null)

  // Reset modal state upon opening
  useEffect(() => {
    if (isOpen) {
      const mode = initialDocMode || 'idCard'
      setDocMode(mode)
      setCropAspectPreset(
        mode === 'certificate' ? 'a4' : mode === 'idCard' ? 'idCard' : mode === 'halfSheet' ? 'halfSheet' : 'free'
      )
      setActiveSide('front')
      setIdCardLayout('vertical')
      setRawImageSrc(null)
      setFrontWarpedCanvas(null)
      setBackWarpedCanvas(null)
      setCurrentWarpedCanvas(null)
      setRotationDeg(0)
      setFilterMode('magic')
      setActiveDrag(null)
      setComposedPreviewUrl(null)
      stopCamera()

      if (initialImageSrc) {
        loadImageForCrop(initialImageSrc)
      } else if (initialDocMode) {
        setStage('source-select')
      } else {
        setStage('mode-select')
      }
    } else {
      stopCamera()
    }
  }, [isOpen, initialDocMode, initialImageSrc])

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
    e.target.value = '' // Reset so user can capture/select again
  }

  // Load selected/captured image and initialize perspective crop corners
  const loadImageForCrop = (src) => {
    setRawImageSrc(src)
    const img = new Image()
    img.onload = () => {
      imageElementRef.current = img
      setImageDims({ width: img.naturalWidth, height: img.naturalHeight })
      setCorners(getInitialCorners(img.naturalWidth, img.naturalHeight))
      // Explicitly enter interactive crop stage
      setStage('crop')
    }
    img.src = src
  }

  // Start dragging a corner pin, edge, or entire quad
  const startDrag = (dragType, e) => {
    e.preventDefault()
    e.stopPropagation()
    dragStartRef.current = {
      startX: e.clientX,
      startY: e.clientY,
      initialCorners: corners.map((c) => ({ ...c }))
    }
    setActiveDrag(dragType)
  }

  // Window-level drag event listener guarantees smooth, unbroken dragging across the entire viewport
  useEffect(() => {
    if (!activeDrag) return

    const handlePointerMove = (e) => {
      e.preventDefault()
      if (!cropContainerRef.current || !imageDims.width || !imageDims.height) return
      const rect = cropContainerRef.current.getBoundingClientRect()
      if (rect.width <= 0 || rect.height <= 0) return

      const deltaClientX = e.clientX - dragStartRef.current.startX
      const deltaClientY = e.clientY - dragStartRef.current.startY
      const deltaImgX = deltaClientX * (imageDims.width / rect.width)
      const deltaImgY = deltaClientY * (imageDims.height / rect.height)
      const init = dragStartRef.current.initialCorners

      if (activeDrag.type === 'corner') {
        const idx = activeDrag.idx
        const newX = Math.max(0, Math.min(imageDims.width, Math.round(init[idx].x + deltaImgX)))
        const newY = Math.max(0, Math.min(imageDims.height, Math.round(init[idx].y + deltaImgY)))
        setCorners((prev) => {
          const next = [...prev]
          next[idx] = { x: newX, y: newY }
          return next
        })
      } else if (activeDrag.type === 'edge') {
        const edge = activeDrag.edge
        const [i1, i2] = edge === 'top' ? [0, 1] : edge === 'right' ? [1, 2] : edge === 'bottom' ? [2, 3] : [3, 0]
        setCorners((prev) => {
          const next = [...prev]
          next[i1] = {
            x: Math.max(0, Math.min(imageDims.width, Math.round(init[i1].x + deltaImgX))),
            y: Math.max(0, Math.min(imageDims.height, Math.round(init[i1].y + deltaImgY)))
          }
          next[i2] = {
            x: Math.max(0, Math.min(imageDims.width, Math.round(init[i2].x + deltaImgX))),
            y: Math.max(0, Math.min(imageDims.height, Math.round(init[i2].y + deltaImgY)))
          }
          return next
        })
      } else if (activeDrag.type === 'quad') {
        let shiftX = deltaImgX
        let shiftY = deltaImgY
        init.forEach((c) => {
          if (c.x + shiftX < 0) shiftX = -c.x
          if (c.x + shiftX > imageDims.width) shiftX = imageDims.width - c.x
          if (c.y + shiftY < 0) shiftY = -c.y
          if (c.y + shiftY > imageDims.height) shiftY = imageDims.height - c.y
        })
        setCorners(
          init.map((c) => ({
            x: Math.max(0, Math.min(imageDims.width, Math.round(c.x + shiftX))),
            y: Math.max(0, Math.min(imageDims.height, Math.round(c.y + shiftY)))
          }))
        )
      }
    }

    const handlePointerUp = () => {
      setActiveDrag(null)
    }

    window.addEventListener('pointermove', handlePointerMove, { passive: false })
    window.addEventListener('pointerup', handlePointerUp)
    window.addEventListener('pointercancel', handlePointerUp)

    return () => {
      window.removeEventListener('pointermove', handlePointerMove)
      window.removeEventListener('pointerup', handlePointerUp)
      window.removeEventListener('pointercancel', handlePointerUp)
    }
  }, [activeDrag, imageDims])

  // Reset corners to full photo boundaries
  const handleResetCorners = () => {
    if (!imageDims.width || !imageDims.height) return
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
        if (cropAspectPreset === 'idCard') {
          targetAspect = 85.6 / 53.98 // Standard ISO/IEC 7810 ID-1 card aspect ratio (~1.586)
        } else if (cropAspectPreset === 'a4' || cropAspectPreset === 'certificate') {
          targetAspect = 210 / 297 // A4 standard (1 / 1.414)
        } else if (cropAspectPreset === 'halfSheet') {
          targetAspect = 210 / 148.5 // Half A4 landscape (1.414)
        } else if (cropAspectPreset === 'square') {
          targetAspect = 1.0
        } else {
          targetAspect = null // Free quad aspect
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

  // Start scanning back side via source menu
  const handleAddBackSide = () => {
    finalizeCurrentSide()
    setActiveSide('back')
    setRawImageSrc(null)
    setStage('source-select')
  }

  // Quick direct capture for Back Side via Full Camera
  const handleSnapBackSideCamera = () => {
    finalizeCurrentSide()
    setActiveSide('back')
    setRawImageSrc(null)
    if (cameraInputRef.current) {
      cameraInputRef.current.value = ''
      cameraInputRef.current.click()
    } else {
      setStage('source-select')
    }
  }

  // Quick direct capture for Back Side via Gallery / File Picker
  const handleSnapBackSideGallery = () => {
    finalizeCurrentSide()
    setActiveSide('back')
    setRawImageSrc(null)
    if (fileInputRef.current) {
      fileInputRef.current.value = ''
      fileInputRef.current.click()
    } else {
      setStage('source-select')
    }
  }

  // Live preview update for single or merged multi-side documents
  useEffect(() => {
    if (stage === 'review' && currentWarpedCanvas) {
      const processedCurrent = applyDocumentFilter(
        rotateCanvas(currentWarpedCanvas, rotationDeg),
        filterMode
      )
      if (activeSide === 'back' && frontWarpedCanvas) {
        // Live composed A4 sheet preview with both sides placed in selected layout
        const a4 = composeToA4(docMode, frontWarpedCanvas, processedCurrent, idCardLayout)
        setComposedPreviewUrl(a4.toDataURL('image/jpeg', 0.88))
      } else {
        setComposedPreviewUrl(processedCurrent.toDataURL('image/jpeg', 0.9))
      }
    }
  }, [stage, currentWarpedCanvas, rotationDeg, filterMode, activeSide, frontWarpedCanvas, docMode, idCardLayout])

  // Final PDF compilation & completion
  const handleCompleteAndPrint = async () => {
    setIsProcessing(true)
    try {
      const currentFinal = finalizeCurrentSide()
      const front = activeSide === 'front' ? currentFinal : frontWarpedCanvas
      const back = activeSide === 'back' ? currentFinal : backWarpedCanvas

      // Compose onto clean standard A4 page with chosen ID card layout
      const a4Canvas = composeToA4(docMode, front, back, idCardLayout)
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
    <div className="fixed inset-0 z-50 flex items-center justify-center p-3 sm:p-5 bg-black/60 backdrop-blur-md animate-in fade-in duration-200">
      <div className="bg-slate-900/80 backdrop-blur-2xl border border-white/10 rounded-3xl w-full max-w-lg overflow-hidden shadow-2xl flex flex-col max-h-[92vh] text-slate-100 shadow-[inset_0_1px_0_0_rgba(255,255,255,0.1)]">
        {/* Modal Top Header */}
        <div className="px-5 py-3.5 border-b border-white/[0.08] flex items-center justify-between bg-white/[0.02] backdrop-blur-md">
          <div className="flex items-center gap-3">
            <div className="w-8 h-8 rounded-xl bg-white/[0.05] border border-white/10 text-emerald-400 flex items-center justify-center">
              <Crop className="w-4 h-4" />
            </div>
            <div>
              <div className="flex items-center gap-2">
                <h3 className="text-sm font-semibold text-white tracking-tight leading-none">Smart Scanner</h3>
                <span className="text-[10px] font-medium text-emerald-300 bg-emerald-500/10 border border-emerald-500/20 px-2 py-0.5 rounded-full backdrop-blur-sm">
                  {stage === 'mode-select' ? 'Format' : stage === 'source-select' ? 'Source' : stage === 'crop' ? 'Perspective Crop' : stage === 'review' ? 'Enhance' : 'Live'}
                </span>
              </div>
              <p className="text-[11px] text-slate-400 mt-1">
                {stage === 'crop'
                  ? (activeSide === 'front' ? 'Front Side • Drag corners to fit' : 'Back Side • Drag corners to fit')
                  : (activeSide === 'front' ? 'Scanning Front Side' : 'Scanning Back Side')}
              </p>
            </div>
          </div>
          <button
            onClick={() => {
              stopCamera()
              onClose()
            }}
            className="w-7 h-7 rounded-full bg-white/[0.05] hover:bg-white/10 border border-white/10 text-slate-400 hover:text-white flex items-center justify-center transition-colors"
          >
            <X className="w-3.5 h-3.5" />
          </button>
        </div>

        {/* Modal Body Stages */}
        <div className="p-4 sm:p-5 flex-1 overflow-y-auto">
          {/* ========================================================================= */}
          {/* STAGE 1: DOCUMENT TYPE SELECTION */}
          {/* ========================================================================= */}
          {stage === 'mode-select' && (
            <div className="space-y-4 animate-in fade-in duration-150">
              <div className="text-center space-y-1 mb-2">
                <h4 className="text-base font-semibold text-white tracking-tight">What are you scanning?</h4>
                <p className="text-xs text-slate-400 max-w-xs mx-auto">
                  Selecting the right type locks ideal proportions and automatically fits your document onto standard paper.
                </p>
              </div>

              <div className="grid gap-2">
                {[
                  {
                    id: 'idCard',
                    title: 'ID Card Photocopy',
                    badge: '2-on-1 A4',
                    desc: 'Aadhaar, PAN, Voter, Driving License, National ID — Front & Back on one page',
                    icon: CreditCard
                  },
                  {
                    id: 'certificate',
                    title: 'Certificate / Full Document',
                    badge: 'Full A4',
                    desc: 'Full-page certificate, letter, transcript, or single document page',
                    icon: FileText
                  },
                  {
                    id: 'halfSheet',
                    title: 'Admit Card / Marksheet',
                    badge: 'Top & Bottom',
                    desc: 'Half page: Front on top, Back on bottom on a single A4 sheet',
                    icon: Layers
                  },
                  {
                    id: 'auto',
                    title: 'Auto / Custom Dimensions',
                    badge: 'Adaptive',
                    desc: 'System automatically detects proportions and aligns cleanly on paper',
                    icon: Sliders
                  }
                ].map((item) => {
                  const Icon = item.icon
                  return (
                    <button
                      key={item.id}
                      type="button"
                      onClick={() => {
                        setDocMode(item.id)
                        setStage('source-select')
                      }}
                      className="p-3.5 rounded-2xl bg-white/[0.03] hover:bg-white/[0.06] border border-white/[0.08] hover:border-white/20 text-left flex items-center gap-3.5 transition-all group backdrop-blur-sm"
                    >
                      <div className="w-9 h-9 rounded-xl bg-white/[0.04] border border-white/10 flex items-center justify-center flex-shrink-0 text-slate-300 group-hover:text-emerald-400 group-hover:border-emerald-500/30 transition-colors">
                        <Icon className="w-4.5 h-4.5" />
                      </div>
                      <div className="flex-1 min-w-0">
                        <div className="flex items-center justify-between gap-2">
                          <span className="text-xs font-semibold text-white group-hover:text-white transition-colors">{item.title}</span>
                          <span className="text-[10px] font-medium text-slate-300 bg-white/[0.05] border border-white/10 px-2 py-0.5 rounded-md group-hover:text-emerald-300 group-hover:bg-emerald-500/10 group-hover:border-emerald-500/20 transition-colors flex-shrink-0">
                            {item.badge}
                          </span>
                        </div>
                        <p className="text-[11px] text-slate-400 mt-0.5 truncate">
                          {item.desc}
                        </p>
                      </div>
                    </button>
                  )
                })}
              </div>
            </div>
          )}

          {/* ========================================================================= */}
          {/* STAGE 2: SOURCE SELECTION (CAMERA OR FILES) */}
          {/* ========================================================================= */}
          {stage === 'source-select' && (
            <div className="space-y-4 animate-in fade-in duration-150">
              <div className="text-center space-y-1 mb-2">
                <h4 className="text-base font-semibold text-white tracking-tight">How would you like to capture?</h4>
                <p className="text-xs text-slate-400">
                  {activeSide === 'front' ? 'Capture or upload Front side' : 'Capture or upload Back side'}
                </p>
              </div>

              {cameraError && (
                <div className="p-3 bg-amber-500/10 border border-amber-500/20 rounded-xl text-amber-300 text-xs">
                  {cameraError}
                </div>
              )}

              <div className="grid gap-2.5">
                <button
                  type="button"
                  onClick={() => {
                    if (cameraInputRef.current) {
                      cameraInputRef.current.value = ''
                      cameraInputRef.current.click()
                    } else {
                      startCamera()
                    }
                  }}
                  className="p-4 rounded-2xl bg-white/[0.03] hover:bg-white/[0.06] border border-white/[0.08] hover:border-emerald-500/30 text-left flex items-center gap-4 transition-all group backdrop-blur-sm"
                >
                  <div className="w-11 h-11 rounded-xl bg-white/[0.04] border border-white/10 text-slate-300 group-hover:text-emerald-400 flex items-center justify-center flex-shrink-0 transition-colors">
                    <Camera className="w-5 h-5" />
                  </div>
                  <div className="flex-1">
                    <div className="flex items-center gap-2">
                      <span className="text-xs font-semibold text-white block">Camera (Full Display)</span>
                      <span className="text-[9px] font-bold text-emerald-400 bg-emerald-500/10 px-1.5 py-0.5 rounded">Native</span>
                    </div>
                    <span className="text-[11px] text-slate-400 block mt-0.5">
                      Open device camera in full screen to snap {activeSide === 'front' ? 'Front side' : 'Back side'}
                    </span>
                  </div>
                </button>

                <button
                  type="button"
                  onClick={() => {
                    if (fileInputRef.current) {
                      fileInputRef.current.value = ''
                      fileInputRef.current.click()
                    }
                  }}
                  className="p-4 rounded-2xl bg-white/[0.03] hover:bg-white/[0.06] border border-white/[0.08] hover:border-white/20 text-left flex items-center gap-4 transition-all group backdrop-blur-sm"
                >
                  <div className="w-11 h-11 rounded-xl bg-white/[0.04] border border-white/10 text-slate-300 group-hover:text-emerald-400 flex items-center justify-center flex-shrink-0 transition-colors">
                    <Upload className="w-5 h-5" />
                  </div>
                  <div className="flex-1">
                    <span className="text-xs font-semibold text-white block">Choose from Files / Gallery</span>
                    <span className="text-[11px] text-slate-400 block mt-0.5">
                      Select photo already saved on device
                    </span>
                  </div>
                </button>
              </div>

              <div className="text-center pt-0.5">
                <button
                  type="button"
                  onClick={startCamera}
                  className="text-[11px] text-slate-400 hover:text-emerald-300 transition-colors inline-flex items-center gap-1.5"
                >
                  <span>💻</span> Laptop / Desktop live webcam mode
                </button>
              </div>

              {/* Native Mobile Camera Input (Full display) */}
              <input
                ref={cameraInputRef}
                type="file"
                accept="image/*"
                capture="environment"
                className="hidden"
                onChange={handleFileChange}
              />
              {/* File / Gallery Input */}
              <input
                ref={fileInputRef}
                type="file"
                accept="image/*"
                className="hidden"
                onChange={handleFileChange}
              />

              <div className="pt-2 flex justify-start">
                <button
                  type="button"
                  onClick={() => setStage('mode-select')}
                  className="text-xs text-slate-400 hover:text-white px-3 py-1.5 rounded-xl bg-white/[0.03] hover:bg-white/[0.06] border border-white/[0.08] flex items-center gap-1.5 transition-colors"
                >
                  <ChevronLeft className="w-3.5 h-3.5" /> Back
                </button>
              </div>
            </div>
          )}

          {/* ========================================================================= */}
          {/* STAGE 3: LIVE CAMERA VIEWFINDER */}
          {/* ========================================================================= */}
          {stage === 'camera' && (
            <div className="space-y-4 animate-in fade-in duration-150">
              <div className="relative w-full aspect-[4/3] bg-black rounded-2xl overflow-hidden border border-white/10 flex items-center justify-center">
                <video
                  ref={videoRef}
                  autoPlay
                  playsInline
                  muted
                  className="w-full h-full object-contain bg-black"
                />

                {/* Minimal Document Viewfinder Overlay (Spans entire sensor viewport) */}
                <div className="absolute inset-2 sm:inset-3 border border-white/20 rounded-xl pointer-events-none flex flex-col justify-between p-2">
                  <div className="flex justify-between">
                    <div className="w-4 h-4 border-t-2 border-l-2 border-emerald-400 rounded-tl-sm" />
                    <div className="w-4 h-4 border-t-2 border-r-2 border-emerald-400 rounded-tr-sm" />
                  </div>
                  <div className="text-center">
                    <span className="bg-black/70 text-white/90 text-[10px] font-medium px-2.5 py-0.5 rounded-full backdrop-blur-md border border-white/10">
                      Full Sensor View • Align document
                    </span>
                  </div>
                  <div className="flex justify-between">
                    <div className="w-4 h-4 border-b-2 border-l-2 border-emerald-400 rounded-bl-sm" />
                    <div className="w-4 h-4 border-b-2 border-r-2 border-emerald-400 rounded-br-sm" />
                  </div>
                </div>
              </div>

              {/* Shutter & Controls */}
              <div className="flex items-center justify-between px-4 pt-1">
                <button
                  type="button"
                  onClick={() => {
                    stopCamera()
                    setStage('source-select')
                  }}
                  className="text-xs text-slate-400 hover:text-white px-3 py-1.5 rounded-xl bg-white/[0.04] border border-white/10 transition-colors"
                >
                  Cancel
                </button>

                {/* Glass Shutter Button */}
                <button
                  type="button"
                  onClick={captureFromCamera}
                  className="w-14 h-14 rounded-full border border-white/40 bg-white/10 backdrop-blur-md p-1 flex items-center justify-center hover:scale-105 active:scale-95 transition-all"
                >
                  <div className="w-full h-full rounded-full bg-emerald-500" />
                </button>

                <button
                  type="button"
                  onClick={() => {
                    setFacingMode((prev) => (prev === 'environment' ? 'user' : 'environment'))
                    startCamera()
                  }}
                  className="w-9 h-9 rounded-xl bg-white/[0.04] border border-white/10 text-slate-300 hover:text-white flex items-center justify-center transition-colors"
                >
                  <RotateCw className="w-4 h-4" />
                </button>
              </div>
            </div>
          )}

          {/* ========================================================================= */}
          {/* STAGE 4: PERSPECTIVE CROP & 4-CORNER PINNING */}
          {/* ========================================================================= */}
          {stage === 'crop' && (
            <div className="space-y-3 animate-in fade-in duration-150 select-none">
              {/* Minimal Glassmorphic Presets Toolbar */}
              <div className="flex items-center justify-between gap-1.5 bg-black/40 backdrop-blur-xl px-2.5 py-1.5 rounded-xl border border-white/10 text-[11px]">
                <div className="flex items-center gap-1 overflow-x-auto [scrollbar-width:none] [-ms-overflow-style:none] [&::-webkit-scrollbar]:hidden">
                  <span className="text-[10px] text-slate-400 font-medium mr-0.5 flex-shrink-0">Proportions:</span>
                  {[
                    { id: 'free', label: 'Free' },
                    { id: 'idCard', label: 'ID Card' },
                    { id: 'a4', label: 'A4' },
                    { id: 'halfSheet', label: 'Half A4' },
                  ].map((preset) => (
                    <button
                      key={preset.id}
                      type="button"
                      onClick={() => setCropAspectPreset(preset.id)}
                      className={`px-2 py-0.5 rounded-lg text-[10px] font-medium transition-all whitespace-nowrap ${
                        cropAspectPreset === preset.id
                          ? 'bg-white/15 text-white border border-white/20 backdrop-blur-sm'
                          : 'text-slate-400 hover:text-slate-200 hover:bg-white/5 border border-transparent'
                      }`}
                    >
                      {preset.label}
                    </button>
                  ))}
                </div>

                <div className="flex items-center gap-1 flex-shrink-0">
                  <button
                    type="button"
                    onClick={handleResetCorners}
                    className="text-[10px] text-slate-400 hover:text-white px-2 py-0.5 rounded-lg hover:bg-white/5 transition-colors"
                  >
                    Full
                  </button>
                  <button
                    type="button"
                    onClick={() => setCorners(getInitialCorners(imageDims.width, imageDims.height))}
                    className="text-[10px] text-slate-400 hover:text-white px-2 py-0.5 rounded-lg hover:bg-white/5 transition-colors"
                  >
                    Auto
                  </button>
                </div>
              </div>

              {/* Image Container with Glassmorphic Frame */}
              <div className="relative w-full flex items-center justify-center bg-black/50 backdrop-blur-xl rounded-2xl p-2.5 border border-white/10 overflow-hidden min-h-[220px]">
                {rawImageSrc && imageDims.width > 0 && (
                  <div
                    ref={cropContainerRef}
                    style={{
                      aspectRatio: `${imageDims.width} / ${imageDims.height}`,
                      maxWidth: '100%',
                      maxHeight: '48vh',
                      width: imageDims.width >= imageDims.height ? '100%' : 'auto',
                      height: imageDims.height > imageDims.width ? '48vh' : 'auto',
                      position: 'relative'
                    }}
                    className="relative rounded-xl overflow-hidden touch-none mx-auto select-none flex items-center justify-center"
                  >
                    {/* Underlying Document Image */}
                    <img
                      src={rawImageSrc}
                      alt="Crop Target"
                      className="w-full h-full object-contain block pointer-events-none select-none rounded-xl"
                    />

                    {/* SVG Polygon Overlay & Clean Scrim Mask */}
                    {corners.length === 4 && (
                      (() => {
                        const svgPoints = corners
                          .map((c) => `${Math.round((c.x / imageDims.width) * 1000)},${Math.round((c.y / imageDims.height) * 1000)}`)
                          .join(' ')

                        return (
                          <svg
                            className="absolute inset-0 w-full h-full pointer-events-none z-10"
                            viewBox="0 0 1000 1000"
                            preserveAspectRatio="none"
                          >
                            <defs>
                              <mask id="smart-crop-mask">
                                <rect width="1000" height="1000" fill="#ffffff" />
                                <polygon points={svgPoints} fill="#000000" />
                              </mask>
                            </defs>
                            {/* Frosted dark scrim outside document quad */}
                            <rect width="1000" height="1000" fill="rgba(0, 0, 0, 0.45)" mask="url(#smart-crop-mask)" />
                            {/* Refined clean boundary line without glow */}
                            <polygon
                              points={svgPoints}
                              fill="transparent"
                              stroke="rgba(0, 191, 99, 0.9)"
                              strokeWidth="1.5"
                              vectorEffect="non-scaling-stroke"
                              strokeDasharray="5 3"
                            />
                            {/* Transparent interactive polygon to move whole frame on drag */}
                            <polygon
                              points={svgPoints}
                              fill="transparent"
                              className="cursor-move pointer-events-auto"
                              onPointerDown={(e) => startDrag({ type: 'quad' }, e)}
                            />
                          </svg>
                        )
                      })()
                    )}

                    {/* 4 Interactive Draggable Corner Pins */}
                    {corners.map((corner, idx) => {
                      const isBeingDragged = activeDrag?.type === 'corner' && activeDrag.idx === idx
                      const leftPct = (corner.x / imageDims.width) * 100
                      const topPct = (corner.y / imageDims.height) * 100

                      return (
                        <div
                          key={idx}
                          onPointerDown={(e) => startDrag({ type: 'corner', idx }, e)}
                          style={{
                            left: `${leftPct}%`,
                            top: `${topPct}%`,
                            touchAction: 'none'
                          }}
                          className="absolute -translate-x-1/2 -translate-y-1/2 w-10 h-10 flex items-center justify-center cursor-grab active:cursor-grabbing z-30 group"
                        >
                          {/* Sleek, minimal circular pin handle without glow */}
                          <div
                            className={`w-4.5 h-4.5 rounded-full bg-white border-[1.5px] border-[#00bf63] shadow-md transition-transform flex items-center justify-center ${
                              isBeingDragged ? 'scale-125 ring-2 ring-white/40' : 'hover:scale-110'
                            }`}
                          >
                            <div className="w-1.5 h-1.5 rounded-full bg-[#00bf63]" />
                          </div>
                        </div>
                      )
                    })}

                    {/* Minimal Circular Loupe */}
                    {activeDrag?.type === 'corner' && cropContainerRef.current && (
                      (() => {
                        const idx = activeDrag.idx
                        const activeCorner = corners[idx]
                        if (!activeCorner) return null
                        const rect = cropContainerRef.current.getBoundingClientRect()
                        const px = (activeCorner.x / imageDims.width) * rect.width
                        const py = (activeCorner.y / imageDims.height) * rect.height
                        const loupeSize = 96
                        const zoomFactor = 2.4

                        const loupeLeft = Math.max(8, Math.min(rect.width - loupeSize - 8, px - loupeSize / 2))
                        const loupeTop = py > loupeSize + 25 ? py - loupeSize - 16 : py + 24

                        return (
                          <div
                            style={{
                              left: `${loupeLeft}px`,
                              top: `${loupeTop}px`,
                              width: `${loupeSize}px`,
                              height: `${loupeSize}px`
                            }}
                            className="absolute pointer-events-none z-40 rounded-full border border-white/30 bg-black/90 shadow-2xl backdrop-blur-md overflow-hidden ring-1 ring-white/10 flex items-center justify-center animate-in zoom-in-75 duration-75"
                          >
                            <div
                              style={{
                                width: `${rect.width * zoomFactor}px`,
                                height: `${rect.height * zoomFactor}px`,
                                transform: `translate(${
                                  -px * zoomFactor + loupeSize / 2
                                }px, ${
                                  -py * zoomFactor + loupeSize / 2
                                }px)`
                              }}
                              className="absolute top-0 left-0 origin-top-left"
                            >
                              <img src={rawImageSrc} alt="Zoom" className="w-full h-full object-fill" />
                            </div>
                            <div className="absolute w-full h-[1px] bg-[#00bf63] opacity-80" />
                            <div className="absolute h-full w-[1px] bg-[#00bf63] opacity-80" />
                            <div className="absolute w-2.5 h-2.5 rounded-full border border-white/80" />
                          </div>
                        )
                      })()
                    )}
                  </div>
                )}
              </div>

              {/* Action Buttons */}
              <div className="flex gap-2.5 pt-1">
                <Button
                  variant="outline"
                  size="sm"
                  onClick={() => setStage('source-select')}
                  className="flex-1 text-xs border-white/10 bg-white/[0.04] hover:bg-white/[0.08] text-slate-300 hover:text-white py-2.5 rounded-xl shadow-none font-medium transition-colors"
                >
                  Cancel
                </Button>
                <Button
                  size="sm"
                  disabled={isProcessing}
                  onClick={handlePerformCrop}
                  className="flex-1 bg-[#00bf63] hover:bg-[#00a855] active:scale-[0.99] text-slate-950 font-bold text-xs py-2.5 rounded-xl shadow-none transition-all flex items-center justify-center gap-1.5"
                >
                  {isProcessing ? (
                    <RefreshCw className="w-4 h-4 animate-spin" />
                  ) : (
                    <Crop className="w-4 h-4" />
                  )}
                  Straighten & Crop →
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
                <h4 className="text-xs font-semibold text-white">Review Straightened Document</h4>
                <p className="text-[11px] text-slate-400 mt-0.5">
                  {docMode === 'idCard' || docMode === 'halfSheet'
                    ? activeSide === 'front'
                      ? 'Front side ready! You can now add the back side or proceed to print.'
                      : 'Back side ready! Both sides will be merged into standard A4.'
                    : 'Your document is straightened and ready for high-resolution printing.'}
                </p>
              </div>

              {/* Preview Box with Glassmorphism */}
              <div className="bg-black/30 backdrop-blur-md border border-white/10 rounded-2xl p-3 flex flex-col items-center justify-center min-h-[220px] max-h-[290px] overflow-hidden relative">
                {composedPreviewUrl ? (
                  <img
                    src={composedPreviewUrl}
                    alt="Scan Result"
                    className="max-h-[240px] max-w-full rounded-lg shadow-md object-contain bg-white"
                  />
                ) : (
                  <div className="text-xs text-slate-400 flex items-center gap-1.5">
                    <RefreshCw className="w-3.5 h-3.5 animate-spin" /> Rendering preview...
                  </div>
                )}
                {activeSide === 'back' && frontWarpedCanvas && (docMode === 'idCard' || docMode === 'halfSheet') && (
                  <span className="mt-2 text-[10px] font-medium text-emerald-400 bg-emerald-500/10 border border-emerald-500/20 px-2.5 py-0.5 rounded-full">
                    A4 Preview: {idCardLayout === 'vertical' ? 'Top & Bottom Stacked' : 'Side-by-Side'}
                  </span>
                )}
              </div>

              {/* Filter Chips & Rotate 90° */}
              <div className="flex items-center justify-between gap-2">
                <div className="flex items-center gap-1.5 overflow-x-auto py-1 [scrollbar-width:none] [-ms-overflow-style:none] [&::-webkit-scrollbar]:hidden">
                  {[
                    { id: 'magic', label: 'Magic Clean' },
                    { id: 'bw', label: 'B&W Copy' },
                    { id: 'original', label: 'Original' },
                    { id: 'grayscale', label: 'Grayscale' }
                  ].map((f) => (
                    <button
                      key={f.id}
                      type="button"
                      onClick={() => setFilterMode(f.id)}
                      className={`px-2.5 py-1 rounded-xl text-xs font-medium transition-colors whitespace-nowrap ${
                        filterMode === f.id
                          ? 'bg-white/15 text-white border border-white/20 shadow-sm backdrop-blur-md font-semibold'
                          : 'bg-white/[0.04] text-slate-300 hover:text-white border border-white/10 hover:bg-white/[0.08]'
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
                  className="h-7 rounded-xl text-xs border-white/10 bg-white/[0.04] hover:bg-white/[0.08] text-slate-200 hover:text-white flex-shrink-0 font-medium px-2.5"
                >
                  <RotateCw className="w-3.5 h-3.5 mr-1" /> 90°
                </Button>
              </div>

              {/* ID Card Arrangement on A4 Sheet */}
              {(docMode === 'idCard' || docMode === 'halfSheet') && (
                <div className="bg-white/[0.03] backdrop-blur-sm border border-white/[0.08] rounded-2xl p-3 space-y-2">
                  <div className="flex items-center justify-between px-0.5">
                    <span className="text-xs font-semibold text-white">Arrangement on A4 Sheet</span>
                    <span className="text-[10px] text-emerald-400 font-medium">
                      {idCardLayout === 'vertical' ? 'Stacked (Top & Bottom)' : 'Side-by-Side'}
                    </span>
                  </div>
                  <div className="grid grid-cols-2 gap-2">
                    <button
                      type="button"
                      onClick={() => setIdCardLayout('vertical')}
                      className={`py-2 px-3 rounded-xl text-xs font-semibold transition-all flex items-center justify-center gap-1.5 ${
                        idCardLayout === 'vertical'
                          ? 'bg-emerald-500/20 text-emerald-300 border border-emerald-500/40 shadow-xs'
                          : 'bg-white/[0.04] text-slate-400 border border-white/10 hover:text-white hover:bg-white/[0.08]'
                      }`}
                    >
                      <span>↕</span> Top & Bottom
                    </button>
                    <button
                      type="button"
                      onClick={() => setIdCardLayout('horizontal')}
                      className={`py-2 px-3 rounded-xl text-xs font-semibold transition-all flex items-center justify-center gap-1.5 ${
                        idCardLayout === 'horizontal'
                          ? 'bg-emerald-500/20 text-emerald-300 border border-emerald-500/40 shadow-xs'
                          : 'bg-white/[0.04] text-slate-400 border border-white/10 hover:text-white hover:bg-white/[0.08]'
                      }`}
                    >
                      <span>↔</span> Side by Side
                    </button>
                  </div>
                </div>
              )}

              {/* Action Buttons */}
              <div className="space-y-2 pt-2 border-t border-white/10">
                {(docMode === 'idCard' || docMode === 'halfSheet') && activeSide === 'front' && (
                  <div className="space-y-1.5">
                    <div className="grid grid-cols-2 gap-2">
                      <Button
                        type="button"
                        variant="outline"
                        onClick={handleSnapBackSideCamera}
                        className="border-emerald-500/30 bg-emerald-500/10 hover:bg-emerald-500/20 text-emerald-300 font-semibold text-xs py-2.5 rounded-xl flex items-center justify-center gap-1.5 transition-colors shadow-none"
                      >
                        <Camera className="w-3.5 h-3.5" /> Snap Back (Full Camera)
                      </Button>
                      <Button
                        type="button"
                        variant="outline"
                        onClick={handleSnapBackSideGallery}
                        className="border-white/10 bg-white/[0.04] hover:bg-white/[0.08] text-slate-200 font-medium text-xs py-2.5 rounded-xl flex items-center justify-center gap-1.5 transition-colors shadow-none"
                      >
                        <Upload className="w-3.5 h-3.5" /> Back from Files
                      </Button>
                    </div>
                  </div>
                )}

                {(docMode === 'idCard' || docMode === 'halfSheet') && activeSide === 'back' && (
                  <div className="flex justify-center pb-0.5">
                    <button
                      type="button"
                      onClick={() => setStage('source-select')}
                      className="text-[11px] text-slate-400 hover:text-slate-200 transition-colors flex items-center gap-1"
                    >
                      <RotateCw className="w-3 h-3" /> Retake back side photo
                    </button>
                  </div>
                )}

                <Button
                  disabled={isProcessing}
                  onClick={handleCompleteAndPrint}
                  className="w-full bg-[#00bf63] hover:bg-[#00a855] text-slate-950 font-bold text-xs py-2.5 rounded-xl shadow-none flex items-center justify-center gap-2 transition-colors"
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
