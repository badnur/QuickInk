'use client'

import { useState, useRef, useEffect } from 'react'
import { jsPDF } from 'jspdf'
import { Button } from '@/components/ui/button'
import {
  CreditCard,
  Upload,
  Camera,
  X,
  CheckCircle2,
  RefreshCw,
  ArrowRight,
  RotateCw
} from 'lucide-react'

export default function IdCardScannerModal({ isOpen, onClose, onComplete }) {
  const [frontImage, setFrontImage] = useState(null)
  const [backImage, setBackImage] = useState(null)
  const [layoutMode, setLayoutMode] = useState('vertical') // 'vertical' (stacked) | 'horizontal' (side by side)
  const [isProcessing, setIsProcessing] = useState(false)
  const [previewThumbnail, setPreviewThumbnail] = useState(null)

  // Native camera & file picker refs
  const frontCameraRef = useRef(null)
  const frontGalleryRef = useRef(null)
  const backCameraRef = useRef(null)
  const backGalleryRef = useRef(null)

  // Reset state when opening/closing
  useEffect(() => {
    if (isOpen) {
      setFrontImage(null)
      setBackImage(null)
      setLayoutMode('vertical')
      setIsProcessing(false)
      setPreviewThumbnail(null)
    }
  }, [isOpen])

  if (!isOpen) return null

  const handleFrontSelect = (e) => {
    const file = e.target.files?.[0]
    if (!file) return
    const reader = new FileReader()
    reader.onload = (ev) => {
      setFrontImage(ev.target.result)
    }
    reader.readAsDataURL(file)
    e.target.value = ''
  }

  const handleBackSelect = (e) => {
    const file = e.target.files?.[0]
    if (!file) return
    const reader = new FileReader()
    reader.onload = (ev) => {
      setBackImage(ev.target.result)
    }
    reader.readAsDataURL(file)
    e.target.value = ''
  }

  // Compose both sides on a single standard A4 canvas (2480 x 3508 at 300 DPI)
  const generateMergedA4Canvas = async () => {
    const A4_W = 2480
    const A4_H = 3508
    const canvas = document.createElement('canvas')
    canvas.width = A4_W
    canvas.height = A4_H
    const ctx = canvas.getContext('2d')

    // Clean white A4 page
    ctx.fillStyle = '#ffffff'
    ctx.fillRect(0, 0, A4_W, A4_H)

    const loadImg = (src) =>
      new Promise((resolve) => {
        const im = new Image()
        im.onload = () => resolve(im)
        im.src = src
      })

    const frontImg = frontImage ? await loadImg(frontImage) : null
    const backImg = backImage ? await loadImg(backImage) : null

    if (layoutMode === 'vertical') {
      // Stacked vertically centered on the page
      const cardWidth = Math.round(A4_W * 0.52) // ~130mm standard ID card size on A4

      if (frontImg) {
        const h1 = Math.round(cardWidth * (frontImg.height / frontImg.width))
        const x1 = Math.round((A4_W - cardWidth) / 2)
        const y1 = Math.round(A4_H * 0.18)

        ctx.drawImage(frontImg, x1, y1, cardWidth, h1)
      }

      if (backImg) {
        const h2 = Math.round(cardWidth * (backImg.height / backImg.width))
        const x2 = Math.round((A4_W - cardWidth) / 2)
        const y2 = Math.round(A4_H * 0.54)

        ctx.drawImage(backImg, x2, y2, cardWidth, h2)
      }
    } else {
      // Side-by-side horizontally (Front on Left, Back on Right)
      const smallWidth = Math.round(A4_W * 0.44)
      const gap = Math.round(A4_W * 0.04)
      const totalSpan = smallWidth * 2 + gap
      const startX = Math.round((A4_W - totalSpan) / 2)

      const h1 = frontImg ? Math.round(smallWidth * (frontImg.height / frontImg.width)) : 0
      const h2 = backImg ? Math.round(smallWidth * (backImg.height / backImg.width)) : 0
      const maxH = Math.max(h1, h2)
      const startY = Math.round((A4_H - maxH) * 0.40)

      if (frontImg) {
        ctx.drawImage(frontImg, startX, startY, smallWidth, h1)
      }

      if (backImg) {
        const x2 = startX + smallWidth + gap
        ctx.drawImage(backImg, x2, startY, smallWidth, h2)
      }
    }

    return canvas
  }

  // Live A4 preview update
  useEffect(() => {
    if (!frontImage && !backImage) {
      setPreviewThumbnail(null)
      return
    }

    let isCancelled = false
    generateMergedA4Canvas().then((canvas) => {
      if (!isCancelled) {
        setPreviewThumbnail(canvas.toDataURL('image/jpeg', 0.85))
      }
    })

    return () => {
      isCancelled = true
    }
  }, [frontImage, backImage, layoutMode])

  const handleFinish = async () => {
    if (!frontImage) return
    setIsProcessing(true)

    try {
      const mergedCanvas = await generateMergedA4Canvas()
      const dataUrl = mergedCanvas.toDataURL('image/jpeg', 0.94)

      const pdf = new jsPDF({
        orientation: 'portrait',
        unit: 'mm',
        format: 'a4'
      })

      pdf.addImage(dataUrl, 'JPEG', 0, 0, 210, 297, undefined, 'FAST')
      const pdfBlob = pdf.output('blob')
      const file = new File([pdfBlob], `ID_Card_2in1_${Date.now()}.pdf`, {
        type: 'application/pdf'
      })

      onComplete({
        file,
        pageCount: 1,
        previewUrl: dataUrl,
        serviceType: 'idCard'
      })
      onClose()
    } catch (err) {
      console.error('ID card generation failed:', err)
    } finally {
      setIsProcessing(false)
    }
  }

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-3 sm:p-5 bg-black/60 backdrop-blur-md animate-in fade-in duration-200">
      <div className="bg-slate-900/85 backdrop-blur-2xl border border-white/10 rounded-3xl w-full max-w-lg overflow-hidden shadow-2xl flex flex-col max-h-[92vh] text-slate-100 shadow-[inset_0_1px_0_0_rgba(255,255,255,0.1)]">
        {/* Modal Header */}
        <div className="px-5 py-3.5 border-b border-white/[0.08] flex items-center justify-between bg-white/[0.02] backdrop-blur-md">
          <div className="flex items-center gap-3">
            <div className="w-8 h-8 rounded-xl bg-white/[0.05] border border-white/10 text-emerald-400 flex items-center justify-center text-base">
              <CreditCard className="w-4 h-4" />
            </div>
            <div>
              <div className="flex items-center gap-2">
                <h3 className="text-sm font-semibold text-white tracking-tight leading-none">
                  ID Card 2-in-1 Photography
                </h3>
                <span className="text-[10px] font-medium text-emerald-300 bg-emerald-500/10 border border-emerald-500/20 px-2 py-0.5 rounded-full backdrop-blur-sm">
                  Single A4 Sheet
                </span>
              </div>
              <p className="text-[11px] text-slate-400 mt-1">
                Front & Back photos merged cleanly on one page
              </p>
            </div>
          </div>
          <button
            onClick={onClose}
            className="w-7 h-7 rounded-full bg-white/[0.05] hover:bg-white/10 border border-white/10 text-slate-400 hover:text-white flex items-center justify-center transition-colors"
          >
            <X className="w-3.5 h-3.5" />
          </button>
        </div>

        {/* Hidden inputs for native full camera and gallery */}
        <input
          ref={frontCameraRef}
          type="file"
          accept="image/*"
          capture="environment"
          onChange={handleFrontSelect}
          className="hidden"
        />
        <input
          ref={frontGalleryRef}
          type="file"
          accept="image/*"
          onChange={handleFrontSelect}
          className="hidden"
        />
        <input
          ref={backCameraRef}
          type="file"
          accept="image/*"
          capture="environment"
          onChange={handleBackSelect}
          className="hidden"
        />
        <input
          ref={backGalleryRef}
          type="file"
          accept="image/*"
          onChange={handleBackSelect}
          className="hidden"
        />

        {/* Modal Body */}
        <div className="p-4 sm:p-5 overflow-y-auto space-y-4 flex-1">
          {/* Card Slots */}
          <div className="grid grid-cols-2 gap-3">
            {/* 1. FRONT SIDE SLOT */}
            <div className="border border-white/10 bg-white/[0.03] backdrop-blur-sm rounded-2xl p-3 flex flex-col items-center justify-between min-h-[160px] relative transition-all hover:border-white/20">
              {frontImage ? (
                <div className="w-full flex flex-col items-center flex-1 justify-between">
                  <div className="relative w-full flex items-center justify-center p-1 bg-black/40 rounded-xl max-h-24 overflow-hidden border border-white/10">
                    <img
                      src={frontImage}
                      alt="Front side"
                      className="max-h-20 max-w-full rounded object-contain"
                    />
                  </div>
                  <span className="text-[11px] font-semibold text-emerald-400 mt-1.5 flex items-center gap-1">
                    <CheckCircle2 className="w-3.5 h-3.5" /> Front Ready
                  </span>
                  <div className="grid grid-cols-2 gap-1.5 w-full mt-2">
                    <button
                      type="button"
                      onClick={() => frontCameraRef.current?.click()}
                      className="text-[10px] font-medium py-1 px-1.5 bg-white/[0.05] hover:bg-white/10 border border-white/10 rounded-lg text-slate-300 hover:text-white transition-colors flex items-center justify-center gap-1"
                    >
                      <Camera className="w-3 h-3" /> Retake
                    </button>
                    <button
                      type="button"
                      onClick={() => frontGalleryRef.current?.click()}
                      className="text-[10px] font-medium py-1 px-1.5 bg-white/[0.05] hover:bg-white/10 border border-white/10 rounded-lg text-slate-300 hover:text-white transition-colors flex items-center justify-center gap-1"
                    >
                      <Upload className="w-3 h-3" /> Files
                    </button>
                  </div>
                </div>
              ) : (
                <div className="flex flex-col items-center text-center justify-center flex-1 w-full py-1">
                  <div className="w-9 h-9 rounded-xl bg-emerald-500/10 border border-emerald-500/20 text-emerald-400 flex items-center justify-center mb-1.5">
                    <CreditCard className="w-4 h-4" />
                  </div>
                  <b className="text-xs font-semibold text-white block">1. Front Side</b>
                  <p className="text-[10px] text-slate-400 mb-2.5">Take photo or select</p>
                  <div className="grid grid-cols-1 gap-1.5 w-full">
                    <button
                      type="button"
                      onClick={() => frontCameraRef.current?.click()}
                      className="w-full text-xs font-semibold py-1.5 px-2 bg-emerald-500 hover:bg-emerald-600 text-slate-950 rounded-xl transition-all flex items-center justify-center gap-1.5"
                    >
                      <Camera className="w-3.5 h-3.5" /> Full Camera
                    </button>
                    <button
                      type="button"
                      onClick={() => frontGalleryRef.current?.click()}
                      className="w-full text-[11px] font-medium py-1 px-2 bg-white/[0.04] hover:bg-white/[0.08] border border-white/10 text-slate-300 hover:text-white rounded-xl transition-colors flex items-center justify-center gap-1.5"
                    >
                      <Upload className="w-3 h-3" /> From Gallery
                    </button>
                  </div>
                </div>
              )}
            </div>

            {/* 2. BACK SIDE SLOT */}
            <div className="border border-white/10 bg-white/[0.03] backdrop-blur-sm rounded-2xl p-3 flex flex-col items-center justify-between min-h-[160px] relative transition-all hover:border-white/20">
              {backImage ? (
                <div className="w-full flex flex-col items-center flex-1 justify-between">
                  <div className="relative w-full flex items-center justify-center p-1 bg-black/40 rounded-xl max-h-24 overflow-hidden border border-white/10">
                    <img
                      src={backImage}
                      alt="Back side"
                      className="max-h-20 max-w-full rounded object-contain"
                    />
                  </div>
                  <span className="text-[11px] font-semibold text-emerald-400 mt-1.5 flex items-center gap-1">
                    <CheckCircle2 className="w-3.5 h-3.5" /> Back Ready
                  </span>
                  <div className="grid grid-cols-2 gap-1.5 w-full mt-2">
                    <button
                      type="button"
                      onClick={() => backCameraRef.current?.click()}
                      className="text-[10px] font-medium py-1 px-1.5 bg-white/[0.05] hover:bg-white/10 border border-white/10 rounded-lg text-slate-300 hover:text-white transition-colors flex items-center justify-center gap-1"
                    >
                      <Camera className="w-3 h-3" /> Retake
                    </button>
                    <button
                      type="button"
                      onClick={() => backGalleryRef.current?.click()}
                      className="text-[10px] font-medium py-1 px-1.5 bg-white/[0.05] hover:bg-white/10 border border-white/10 rounded-lg text-slate-300 hover:text-white transition-colors flex items-center justify-center gap-1"
                    >
                      <Upload className="w-3 h-3" /> Files
                    </button>
                  </div>
                </div>
              ) : (
                <div className="flex flex-col items-center text-center justify-center flex-1 w-full py-1">
                  <div className="w-9 h-9 rounded-xl bg-white/[0.04] border border-white/10 text-slate-400 flex items-center justify-center mb-1.5">
                    <CreditCard className="w-4 h-4" />
                  </div>
                  <b className="text-xs font-semibold text-white block">2. Back Side</b>
                  <p className="text-[10px] text-slate-400 mb-2.5">Take photo or select</p>
                  <div className="grid grid-cols-1 gap-1.5 w-full">
                    <button
                      type="button"
                      onClick={() => backCameraRef.current?.click()}
                      className="w-full text-xs font-semibold py-1.5 px-2 bg-emerald-500 hover:bg-emerald-600 text-slate-950 rounded-xl transition-all flex items-center justify-center gap-1.5"
                    >
                      <Camera className="w-3.5 h-3.5" /> Full Camera
                    </button>
                    <button
                      type="button"
                      onClick={() => backGalleryRef.current?.click()}
                      className="w-full text-[11px] font-medium py-1 px-2 bg-white/[0.04] hover:bg-white/[0.08] border border-white/10 text-slate-300 hover:text-white rounded-xl transition-colors flex items-center justify-center gap-1.5"
                    >
                      <Upload className="w-3 h-3" /> From Gallery
                    </button>
                  </div>
                </div>
              )}
            </div>
          </div>

          {/* Arrangement on A4 Sheet */}
          <div className="bg-white/[0.03] backdrop-blur-sm border border-white/[0.08] rounded-2xl p-3 space-y-2">
            <div className="flex items-center justify-between px-0.5">
              <span className="text-xs font-semibold text-white">Arrangement on A4 Sheet</span>
              <span className="text-[10px] text-emerald-400 font-medium">
                {layoutMode === 'vertical' ? 'Stacked (Top & Bottom)' : 'Side-by-Side'}
              </span>
            </div>
            <div className="grid grid-cols-2 gap-2">
              <button
                type="button"
                onClick={() => setLayoutMode('vertical')}
                className={`py-2 px-3 rounded-xl text-xs font-semibold transition-all flex items-center justify-center gap-1.5 ${
                  layoutMode === 'vertical'
                    ? 'bg-emerald-500/20 text-emerald-300 border border-emerald-500/40 shadow-xs'
                    : 'bg-white/[0.04] text-slate-400 border border-white/10 hover:text-white hover:bg-white/[0.08]'
                }`}
              >
                <span>↕</span> Top & Bottom
              </button>
              <button
                type="button"
                onClick={() => setLayoutMode('horizontal')}
                className={`py-2 px-3 rounded-xl text-xs font-semibold transition-all flex items-center justify-center gap-1.5 ${
                  layoutMode === 'horizontal'
                    ? 'bg-emerald-500/20 text-emerald-300 border border-emerald-500/40 shadow-xs'
                    : 'bg-white/[0.04] text-slate-400 border border-white/10 hover:text-white hover:bg-white/[0.08]'
                }`}
              >
                <span>↔</span> Side by Side
              </button>
            </div>
          </div>

          {/* Live Composed A4 Sheet Preview */}
          {previewThumbnail && (
            <div className="bg-black/30 backdrop-blur-md border border-white/10 rounded-2xl p-3 flex flex-col items-center justify-center min-h-[160px] max-h-[220px] overflow-hidden">
              <img
                src={previewThumbnail}
                alt="A4 Layout Preview"
                className="max-h-[160px] max-w-full rounded shadow object-contain bg-white"
              />
              <span className="mt-1.5 text-[10px] text-slate-400 font-medium">
                A4 Page Preview • {layoutMode === 'vertical' ? 'Top & Bottom' : 'Side by Side'}
              </span>
            </div>
          )}
        </div>

        {/* Modal Footer */}
        <div className="p-3.5 border-t border-white/[0.08] bg-white/[0.02] backdrop-blur-md flex items-center justify-end gap-2">
          <Button
            variant="outline"
            onClick={onClose}
            className="rounded-xl text-xs border-white/10 bg-white/[0.04] hover:bg-white/[0.08] text-slate-300 hover:text-white py-1.5 h-8 font-medium shadow-none"
          >
            Cancel
          </Button>
          <Button
            disabled={!frontImage || isProcessing}
            onClick={handleFinish}
            className="bg-[#00bf63] hover:bg-[#00a656] text-slate-950 rounded-xl text-xs font-bold shadow-none py-1.5 px-4 h-8 flex items-center gap-1.5 transition-colors"
          >
            {isProcessing ? (
              <>
                <RefreshCw className="w-3.5 h-3.5 animate-spin" /> Merging...
              </>
            ) : (
              <>
                Compile & Print <ArrowRight className="w-3.5 h-3.5" />
              </>
            )}
          </Button>
        </div>
      </div>
    </div>
  )
}
