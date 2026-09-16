'use client'

import { useState, useRef, useEffect } from 'react'
import { jsPDF } from 'jspdf'
import { renderPassportSheet, PASSPORT_PLANS } from '@/lib/passport-sheet'
import { Button } from '@/components/ui/button'
import { Badge } from '@/components/ui/badge'
import {
  Camera,
  Upload,
  X,
  Sparkles,
  Scissors,
  CheckCircle2,
  ZoomIn,
  RefreshCw,
  Layers,
  ArrowRight
} from 'lucide-react'

export default function PassportPhotoModal({ isOpen, onClose, onComplete }) {
  const [photoSrc, setPhotoSrc] = useState(null)
  const [photoCount, setPhotoCount] = useState(6)
  const [withBorder, setWithBorder] = useState(true)
  const [zoom, setZoom] = useState(1.0)
  const [pan, setPan] = useState({ x: 0, y: 0 })
  const [isDragging, setIsDragging] = useState(false)
  const [dragStart, setDragStart] = useState({ x: 0, y: 0 })
  const [previewSheetUrl, setPreviewSheetUrl] = useState(null)
  const [isProcessing, setIsProcessing] = useState(false)

  const fileInputRef = useRef(null)
  const imageRef = useRef(null)

  // Reset state when modal opens
  useEffect(() => {
    if (!isOpen) {
      setPhotoSrc(null)
      setPreviewSheetUrl(null)
      setZoom(1.0)
      setPan({ x: 0, y: 0 })
    }
  }, [isOpen])

  // Generate preview sheet when photo, count, or border changes
  useEffect(() => {
    if (!photoSrc) return

    const img = new Image()
    img.crossOrigin = 'anonymous'
    img.onload = () => {
      // 1. Render cropped passport frame from user's pan/zoom
      const cropW = 350
      const cropH = Math.round(cropW * (37 / 28))
      const cropCanvas = document.createElement('canvas')
      cropCanvas.width = cropW
      cropCanvas.height = cropH
      const ctx = cropCanvas.getContext('2d')

      ctx.fillStyle = '#ffffff'
      ctx.fillRect(0, 0, cropW, cropH)

      // Draw user image with zoom and pan
      const scale = (cropW / img.width) * zoom
      const drawW = img.width * scale
      const drawH = img.height * scale
      const drawX = (cropW - drawW) / 2 + pan.x
      const drawY = (cropH - drawH) / 2 + pan.y

      ctx.drawImage(img, drawX, drawY, drawW, drawH)

      // 2. Generate multi-photo sheet
      const sheetCanvas = renderPassportSheet(cropCanvas, photoCount, withBorder)
      setPreviewSheetUrl(sheetCanvas.toDataURL('image/jpeg', 0.9))
    }
    img.src = photoSrc
  }, [photoSrc, photoCount, withBorder, zoom, pan])

  if (!isOpen) return null

  const handleFileSelect = (e) => {
    const file = e.target.files?.[0]
    if (!file) return

    const reader = new FileReader()
    reader.onload = (event) => {
      setPhotoSrc(event.target.result)
      setZoom(1.0)
      setPan({ x: 0, y: 0 })
    }
    reader.readAsDataURL(file)
  }

  // Pointer drag to pan photo inside the frame
  const handlePointerDown = (e) => {
    setIsDragging(true)
    setDragStart({ x: e.clientX - pan.x, y: e.clientY - pan.y })
  }

  const handlePointerMove = (e) => {
    if (!isDragging) return
    setPan({
      x: e.clientX - dragStart.x,
      y: e.clientY - dragStart.y
    })
  }

  const handlePointerUp = () => {
    setIsDragging(false)
  }

  // Finalize passport sheet into a PDF and pass back to parent
  const handleConfirmSheet = async () => {
    if (!previewSheetUrl) return
    setIsProcessing(true)

    try {
      const img = new Image()
      img.onload = () => {
        // Standard 4x6" photo page format (or A4)
        const isLandscape = photoCount === 8
        const pdf = new jsPDF({
          orientation: isLandscape ? 'landscape' : 'portrait',
          unit: 'in',
          format: isLandscape ? [6, 4] : [4, 6]
        })

        pdf.addImage(previewSheetUrl, 'JPEG', 0, 0, isLandscape ? 6 : 4, isLandscape ? 4 : 6)
        const pdfBlob = pdf.output('blob')
        const file = new File([pdfBlob], `Passport_${photoCount}_Photos.pdf`, {
          type: 'application/pdf'
        })

        onComplete({
          file,
          pageCount: 1,
          previewUrl: previewSheetUrl,
          serviceType: 'photo4x6',
          photoCount
        })
        onClose()
      }
      img.src = previewSheetUrl
    } catch (err) {
      console.error('Passport sheet generation error:', err)
    } finally {
      setIsProcessing(false)
    }
  }

  return (
    <div className="fixed inset-0 z-50 bg-black/80 flex items-center justify-center p-3 sm:p-4">
      <div className="bg-white rounded-2xl max-w-lg w-full overflow-hidden border border-gray-200 flex flex-col max-h-[90vh] animate-in zoom-in duration-150">
        {/* Header */}
        <div className="p-4 border-b border-gray-100 flex items-center justify-between bg-slate-50">
          <div className="flex items-center gap-2.5">
            <div className="w-8 h-8 rounded-lg bg-[#00bf63]/10 text-[#00bf63] flex items-center justify-center text-base">
              📷
            </div>
            <div>
              <h3 className="font-bold text-gray-900 text-sm flex items-center gap-2">
                Passport Photo Maker
                <span className="bg-[#00bf63]/10 text-[#00bf63] text-[10px] font-bold px-2 py-0.5 rounded">
                  35×45mm
                </span>
              </h3>
              <p className="text-[11px] text-gray-500">Auto-arranged with cutting guidelines</p>
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
          {!photoSrc ? (
            /* Upload Initial Photo */
            <div
              onClick={() => fileInputRef.current?.click()}
              className="border border-dashed border-gray-300 hover:border-[#00bf63] bg-gray-50/50 hover:bg-[#00bf63]/5 rounded-2xl p-6 text-center cursor-pointer transition-colors flex flex-col items-center justify-center min-h-[220px]"
            >
              <input
                ref={fileInputRef}
                type="file"
                accept="image/*"
                onChange={handleFileSelect}
                className="hidden"
              />
              <div className="w-12 h-12 rounded-xl bg-[#00bf63]/10 text-[#00bf63] flex items-center justify-center mb-2.5">
                <Upload className="w-6 h-6" />
              </div>
              <h4 className="font-bold text-gray-900 text-sm mb-0.5">Select Portrait Photo</h4>
              <p className="text-xs text-gray-500 max-w-xs mb-3">
                Select a passport photo, selfie, or portrait picture from your gallery.
              </p>
              <Button className="bg-[#00bf63] hover:bg-[#00a656] text-white rounded-lg text-xs font-bold shadow-none py-1.5 px-3">
                Browse Photo <Upload className="ml-1.5 w-3 h-3" />
              </Button>
            </div>
          ) : (
            /* Framing and Adjustment View */
            <div className="space-y-3">
              {/* Interactive Framing Viewport */}
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 items-center">
                {/* 1. Passport Cropping Box */}
                <div className="flex flex-col items-center">
                  <span className="text-[10px] font-bold text-gray-500 mb-1 flex items-center gap-1">
                    ✂️ Drag to position face
                  </span>
                  <div
                    onPointerDown={handlePointerDown}
                    onPointerMove={handlePointerMove}
                    onPointerUp={handlePointerUp}
                    className="relative w-[140px] h-[185px] rounded-lg border-2 border-[#00bf63] overflow-hidden bg-gray-900 cursor-grab active:cursor-grabbing touch-none select-none"
                  >
                    <img
                      ref={imageRef}
                      src={photoSrc}
                      alt="Crop preview"
                      draggable={false}
                      className="absolute max-w-none pointer-events-none"
                      style={{
                        transform: `translate(${pan.x}px, ${pan.y}px) scale(${zoom})`,
                        transformOrigin: 'center center'
                      }}
                    />
                    {/* Head/Face Alignment Guide Oval */}
                    <div className="absolute inset-x-3 inset-y-5 border border-dashed border-white/40 rounded-[50%] pointer-events-none" />
                  </div>

                  {/* Zoom Slider */}
                  <div className="w-full max-w-[150px] mt-2 flex items-center gap-1.5">
                    <ZoomIn className="w-3 h-3 text-gray-400 flex-shrink-0" />
                    <input
                      type="range"
                      min="0.6"
                      max="2.5"
                      step="0.05"
                      value={zoom}
                      onChange={(e) => setZoom(parseFloat(e.target.value))}
                      className="w-full accent-[#00bf63] cursor-pointer h-1.5 bg-gray-200 rounded-lg"
                    />
                  </div>
                </div>

                {/* 2. Live Sheet Preview with Dashed Lines */}
                <div className="flex flex-col items-center">
                  <span className="text-[10px] font-bold text-gray-500 mb-1 flex items-center gap-1">
                    <Scissors className="w-3 h-3 text-[#00bf63]" /> Live Print Sheet ({photoCount} Photos)
                  </span>
                  <div className="w-[150px] h-[190px] bg-slate-100 rounded-lg border border-gray-200 p-1.5 flex items-center justify-center">
                    {previewSheetUrl ? (
                      <img
                        src={previewSheetUrl}
                        alt="Sheet preview"
                        className="max-h-full max-w-full rounded border object-contain bg-white"
                      />
                    ) : (
                      <RefreshCw className="w-5 h-5 text-gray-400 animate-spin" />
                    )}
                  </div>
                </div>
              </div>

              {/* Photo Count Selector (4, 6, 8, 10, 12) */}
              <div>
                <label className="block text-xs font-bold text-gray-800 mb-1">
                  How many photos on sheet?
                </label>
                <div className="grid grid-cols-5 gap-1">
                  {[4, 6, 8, 10, 12].map((cnt) => (
                    <button
                      key={cnt}
                      type="button"
                      onClick={() => setPhotoCount(cnt)}
                      className={`py-1.5 px-1 rounded-lg text-center border font-bold text-xs transition-colors ${
                        photoCount === cnt
                          ? 'bg-[#00bf63] text-white border-[#00bf63]'
                          : 'bg-white text-gray-700 border-gray-200 hover:bg-gray-50'
                      }`}
                    >
                      <b className="block text-xs">{cnt}</b>
                      <span className="text-[9px] opacity-80 block">Photos</span>
                    </button>
                  ))}
                </div>
              </div>

              {/* Options Row: Border Toggle & Retake */}
              <div className="flex items-center justify-between pt-1.5 border-t border-gray-100">
                <label className="flex items-center gap-1.5 cursor-pointer text-xs font-medium text-gray-700">
                  <input
                    type="checkbox"
                    checked={withBorder}
                    onChange={(e) => setWithBorder(e.target.checked)}
                    className="rounded accent-[#00bf63] w-3.5 h-3.5"
                  />
                  <span>Black cutting border on photos</span>
                </label>

                <button
                  type="button"
                  onClick={() => setPhotoSrc(null)}
                  className="text-xs font-bold text-gray-500 hover:text-red-600"
                >
                  Change Photo
                </button>
              </div>
            </div>
          )}
        </div>

        {/* Modal Footer */}
        <div className="p-3.5 border-t border-gray-100 bg-slate-50 flex items-center justify-end gap-2">
          <Button variant="outline" onClick={onClose} className="rounded-lg text-xs font-medium py-1.5 h-8">
            Cancel
          </Button>
          {photoSrc && (
            <Button
              disabled={isProcessing}
              onClick={handleConfirmSheet}
              className="bg-[#00bf63] hover:bg-[#00a656] text-white rounded-lg text-xs font-bold shadow-none py-1.5 px-3.5 h-8"
            >
              {isProcessing ? (
                <>
                  <RefreshCw className="mr-1.5 w-3 h-3 animate-spin" /> Generating...
                </>
              ) : (
                <>
                  Use This Sheet <ArrowRight className="ml-1 w-3 h-3" />
                </>
              )}
            </Button>
          )}
        </div>
      </div>
    </div>
  )
}
