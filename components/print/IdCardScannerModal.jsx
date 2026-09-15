'use client'

import { useState, useRef } from 'react'
import { jsPDF } from 'jspdf'
import { Button } from '@/components/ui/button'
import { Badge } from '@/components/ui/badge'
import {
  CreditCard,
  Upload,
  Camera,
  X,
  Sparkles,
  CheckCircle2,
  RefreshCw,
  ArrowRight,
  FileCheck
} from 'lucide-react'

export default function IdCardScannerModal({ isOpen, onClose, onComplete }) {
  const [frontImage, setFrontImage] = useState(null)
  const [backImage, setBackImage] = useState(null)
  const [activeSide, setActiveSide] = useState('front') // 'front' | 'back'
  const [layoutMode, setLayoutMode] = useState('vertical') // 'vertical' (stacked) | 'horizontal'
  const [isProcessing, setIsProcessing] = useState(false)

  const frontInputRef = useRef(null)
  const backInputRef = useRef(null)

  if (!isOpen) return null

  const handleFrontSelect = (e) => {
    const file = e.target.files?.[0]
    if (!file) return
    const reader = new FileReader()
    reader.onload = (ev) => {
      setFrontImage(ev.target.result)
      setActiveSide('back')
    }
    reader.readAsDataURL(file)
  }

  const handleBackSelect = (e) => {
    const file = e.target.files?.[0]
    if (!file) return
    const reader = new FileReader()
    reader.onload = (ev) => {
      setBackImage(ev.target.result)
    }
    reader.readAsDataURL(file)
  }

  // Compose both sides on a single standard A4 canvas (2480 x 3508 at 300 DPI)
  const generateMergedA4Canvas = async () => {
    const A4_W = 2480
    const A4_H = 3508
    const canvas = document.createElement('canvas')
    canvas.width = A4_W
    canvas.height = A4_H
    const ctx = canvas.getContext('2d')

    // Clean white page
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

    const cardWidth = Math.round(A4_W * 0.55) // Standard card width on A4 (~11.5 cm)

    if (layoutMode === 'vertical') {
      // Stacked vertically centered on the page
      if (frontImg) {
        const h1 = Math.round(cardWidth * (frontImg.height / frontImg.width))
        const x1 = Math.round((A4_W - cardWidth) / 2)
        const y1 = Math.round(A4_H * 0.22)

        ctx.drawImage(frontImg, x1, y1, cardWidth, h1)
        ctx.strokeStyle = '#cccccc'
        ctx.lineWidth = 3
        ctx.strokeRect(x1, y1, cardWidth, h1)
      }

      if (backImg) {
        const h2 = Math.round(cardWidth * (backImg.height / backImg.width))
        const x2 = Math.round((A4_W - cardWidth) / 2)
        const y2 = Math.round(A4_H * 0.52)

        ctx.drawImage(backImg, x2, y2, cardWidth, h2)
        ctx.strokeStyle = '#cccccc'
        ctx.lineWidth = 3
        ctx.strokeRect(x2, y2, cardWidth, h2)
      }
    } else {
      // Side-by-side horizontally
      const smallWidth = Math.round(A4_W * 0.42)
      const gap = Math.round(A4_W * 0.05)
      const totalSpan = smallWidth * 2 + gap
      const startX = Math.round((A4_W - totalSpan) / 2)
      const startY = Math.round(A4_H * 0.35)

      if (frontImg) {
        const h1 = Math.round(smallWidth * (frontImg.height / frontImg.width))
        ctx.drawImage(frontImg, startX, startY, smallWidth, h1)
        ctx.strokeStyle = '#cccccc'
        ctx.lineWidth = 3
        ctx.strokeRect(startX, startY, smallWidth, h1)
      }

      if (backImg) {
        const h2 = Math.round(smallWidth * (backImg.height / backImg.width))
        const x2 = startX + smallWidth + gap
        ctx.drawImage(backImg, x2, startY, smallWidth, h2)
        ctx.strokeStyle = '#cccccc'
        ctx.lineWidth = 3
        ctx.strokeRect(x2, startY, smallWidth, h2)
      }
    }

    return canvas
  }

  const handleFinish = async () => {
    if (!frontImage) return
    setIsProcessing(true)

    try {
      const mergedCanvas = await generateMergedA4Canvas()
      const dataUrl = mergedCanvas.toDataURL('image/jpeg', 0.92)

      const pdf = new jsPDF({
        orientation: 'portrait',
        unit: 'mm',
        format: 'a4'
      })

      pdf.addImage(dataUrl, 'JPEG', 0, 0, 210, 297)
      const pdfBlob = pdf.output('blob')
      const file = new File([pdfBlob], 'ID_Card_Front_Back_A4.pdf', {
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
    <div className="fixed inset-0 z-50 bg-black/80 flex items-center justify-center p-3 sm:p-4">
      <div className="bg-white rounded-2xl max-w-lg w-full overflow-hidden border border-gray-200 flex flex-col max-h-[90vh] animate-in zoom-in duration-150">
        {/* Modal Header */}
        <div className="p-4 border-b border-gray-100 flex items-center justify-between bg-slate-50">
          <div className="flex items-center gap-2.5">
            <div className="w-8 h-8 rounded-lg bg-[#00bf63]/10 text-[#00bf63] flex items-center justify-center text-base">
              🆔
            </div>
            <div>
              <h3 className="font-bold text-gray-900 text-sm flex items-center gap-2">
                ID Card 2-in-1 Photocopy
                <span className="bg-[#00bf63]/10 text-[#00bf63] text-[10px] font-bold px-2 py-0.5 rounded">
                  Single A4 Sheet
                </span>
              </h3>
              <p className="text-[11px] text-gray-500">
                Front & Back printed cleanly on the same page
              </p>
            </div>
          </div>
          <button
            onClick={onClose}
            className="w-7 h-7 rounded-lg bg-gray-100 hover:bg-gray-200 text-gray-600 flex items-center justify-center transition-colors"
          >
            <X className="w-4 h-4" />
          </button>
        </div>

        {/* Content Body */}
        <div className="p-4 sm:p-5 overflow-y-auto space-y-3.5 flex-1">
          {/* Card Slots */}
          <div className="grid grid-cols-2 gap-2.5">
            {/* 1. FRONT SIDE SLOT */}
            <div
              onClick={() => frontInputRef.current?.click()}
              className={`border rounded-xl p-3.5 text-center cursor-pointer transition-colors flex flex-col items-center justify-center min-h-[150px] ${
                frontImage
                  ? 'border-[#00bf63] bg-[#00bf63]/5'
                  : 'border-dashed border-gray-300 hover:border-[#00bf63] bg-gray-50/50'
              }`}
            >
              <input
                ref={frontInputRef}
                type="file"
                accept="image/*"
                onChange={handleFrontSelect}
                className="hidden"
              />
              {frontImage ? (
                <div className="relative w-full flex flex-col items-center">
                  <img
                    src={frontImage}
                    alt="Front side"
                    className="max-h-20 max-w-full rounded border object-contain bg-white"
                  />
                  <span className="text-[10px] font-bold text-[#00bf63] mt-1.5 flex items-center gap-1">
                    <CheckCircle2 className="w-3 h-3" /> Front Ready
                  </span>
                  <span className="text-[9px] text-gray-400">Tap to retake</span>
                </div>
              ) : (
                <>
                  <div className="w-9 h-9 rounded-lg bg-[#00bf63]/10 text-[#00bf63] flex items-center justify-center mb-1.5">
                    <CreditCard className="w-4 h-4" />
                  </div>
                  <b className="text-xs font-bold text-gray-800 block">1. Front Side</b>
                  <span className="text-[10px] text-gray-400 mt-0.5">Upload or Snap</span>
                </>
              )}
            </div>

            {/* 2. BACK SIDE SLOT */}
            <div
              onClick={() => backInputRef.current?.click()}
              className={`border rounded-xl p-3.5 text-center cursor-pointer transition-colors flex flex-col items-center justify-center min-h-[150px] ${
                backImage
                  ? 'border-[#00bf63] bg-[#00bf63]/5'
                  : 'border-dashed border-gray-300 hover:border-[#00bf63] bg-gray-50/50'
              }`}
            >
              <input
                ref={backInputRef}
                type="file"
                accept="image/*"
                onChange={handleBackSelect}
                className="hidden"
              />
              {backImage ? (
                <div className="relative w-full flex flex-col items-center">
                  <img
                    src={backImage}
                    alt="Back side"
                    className="max-h-20 max-w-full rounded border object-contain bg-white"
                  />
                  <span className="text-[10px] font-bold text-[#00bf63] mt-1.5 flex items-center gap-1">
                    <CheckCircle2 className="w-3 h-3" /> Back Ready
                  </span>
                  <span className="text-[9px] text-gray-400">Tap to retake</span>
                </div>
              ) : (
                <>
                  <div className="w-9 h-9 rounded-lg bg-gray-100 text-gray-500 flex items-center justify-center mb-1.5">
                    <CreditCard className="w-4 h-4" />
                  </div>
                  <b className="text-xs font-bold text-gray-800 block">2. Back Side</b>
                  <span className="text-[10px] text-gray-400 mt-0.5">Upload or Snap</span>
                </>
              )}
            </div>
          </div>

          {/* Layout Orientation */}
          <div>
            <label className="block text-xs font-bold text-gray-800 mb-1">
              Arrangement on A4 Sheet
            </label>
            <div className="grid grid-cols-2 gap-2">
              <button
                type="button"
                onClick={() => setLayoutMode('vertical')}
                className={`p-2 rounded-lg border text-xs font-bold transition-colors ${
                  layoutMode === 'vertical'
                    ? 'bg-[#00bf63] text-white border-[#00bf63]'
                    : 'bg-white text-gray-700 border-gray-200 hover:bg-gray-50'
                }`}
              >
                Stacked (Top & Bottom)
              </button>
              <button
                type="button"
                onClick={() => setLayoutMode('horizontal')}
                className={`p-2 rounded-lg border text-xs font-bold transition-colors ${
                  layoutMode === 'horizontal'
                    ? 'bg-[#00bf63] text-white border-[#00bf63]'
                    : 'bg-white text-gray-700 border-gray-200 hover:bg-gray-50'
                }`}
              >
                Side-by-Side
              </button>
            </div>
          </div>
        </div>

        {/* Modal Footer */}
        <div className="p-3.5 border-t border-gray-100 bg-slate-50 flex items-center justify-end gap-2">
          <Button variant="outline" onClick={onClose} className="rounded-lg text-xs font-medium py-1.5 h-8">
            Cancel
          </Button>
          <Button
            disabled={!frontImage || isProcessing}
            onClick={handleFinish}
            className="bg-[#00bf63] hover:bg-[#00a656] text-white rounded-lg text-xs font-bold shadow-none py-1.5 px-3.5 h-8"
          >
            {isProcessing ? (
              <>
                <RefreshCw className="mr-1.5 w-3 h-3 animate-spin" /> Merging...
              </>
            ) : (
              <>
                Compile & Print <ArrowRight className="ml-1 w-3 h-3" />
              </>
            )}
          </Button>
        </div>
      </div>
    </div>
  )
}
