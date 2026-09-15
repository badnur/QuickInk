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
    <div className="fixed inset-0 z-50 bg-black/85 backdrop-blur-sm flex items-center justify-center p-3 sm:p-5">
      <div className="bg-white rounded-3xl max-w-lg w-full overflow-hidden shadow-2xl flex flex-col max-h-[92vh] animate-in zoom-in-95 duration-200">
        {/* Header */}
        <div className="p-4 sm:p-5 border-b border-gray-100 flex items-center justify-between bg-slate-50">
          <div className="flex items-center gap-2.5">
            <div className="w-9 h-9 rounded-xl bg-purple-100 text-purple-600 flex items-center justify-center text-lg">
              📷
            </div>
            <div>
              <h3 className="font-extrabold text-gray-900 text-base flex items-center gap-2">
                Passport Photo Maker
                <Badge className="bg-purple-100 text-purple-700 text-[10px] border-none">
                  Standard 35×45mm
                </Badge>
              </h3>
              <p className="text-xs text-gray-500">Auto-arranged with dashed cutting guidelines</p>
            </div>
          </div>
          <button
            onClick={onClose}
            className="w-8 h-8 rounded-full bg-gray-100 hover:bg-gray-200 text-gray-600 flex items-center justify-center transition-colors"
          >
            <X className="w-4 h-4" />
          </button>
        </div>

        {/* Content Body */}
        <div className="p-4 sm:p-6 overflow-y-auto space-y-4 flex-1">
          {!photoSrc ? (
            /* Upload Initial Photo */
            <div
              onClick={() => fileInputRef.current?.click()}
              className="border-2 border-dashed border-purple-300 hover:border-purple-500 bg-purple-50/30 rounded-3xl p-8 text-center cursor-pointer transition-all flex flex-col items-center justify-center min-h-[260px]"
            >
              <input
                ref={fileInputRef}
                type="file"
                accept="image/*"
                onChange={handleFileSelect}
                className="hidden"
              />
              <div className="w-16 h-16 rounded-2xl bg-purple-100 text-purple-600 flex items-center justify-center mb-3">
                <Upload className="w-8 h-8" />
              </div>
              <h4 className="font-bold text-gray-900 text-base mb-1">Choose Portrait Photo</h4>
              <p className="text-xs text-gray-500 max-w-xs mb-4">
                Select a passport photo, selfie, or portrait picture from your gallery or files.
              </p>
              <Button className="bg-purple-600 hover:bg-purple-700 text-white rounded-xl text-xs font-bold shadow-md">
                Browse Photo <Upload className="ml-1.5 w-3.5 h-3.5" />
              </Button>
            </div>
          ) : (
            /* Framing and Adjustment View */
            <div className="space-y-4">
              {/* Interactive Framing Viewport */}
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 items-center">
                {/* 1. Passport Cropping Box */}
                <div className="flex flex-col items-center">
                  <span className="text-[11px] font-bold text-gray-500 mb-1.5 flex items-center gap-1">
                    ✂️ Drag to position face
                  </span>
                  <div
                    onPointerDown={handlePointerDown}
                    onPointerMove={handlePointerMove}
                    onPointerUp={handlePointerUp}
                    className="relative w-[154px] h-[203px] rounded-xl border-2 border-purple-600 overflow-hidden bg-gray-950 cursor-grab active:cursor-grabbing shadow-md touch-none select-none"
                  >
                    <img
                      ref={imageRef}
                      src={photoSrc}
                      alt="Crop preview"
                      draggable={false}
                      className="absolute max-w-none transition-transform pointer-events-none"
                      style={{
                        transform: `translate(${pan.x}px, ${pan.y}px) scale(${zoom})`,
                        transformOrigin: 'center center'
                      }}
                    />
                    {/* Head/Face Alignment Guide Oval */}
                    <div className="absolute inset-x-4 inset-y-6 border border-dashed border-white/50 rounded-[50%] pointer-events-none" />
                  </div>

                  {/* Zoom Slider */}
                  <div className="w-full max-w-[170px] mt-3 flex items-center gap-2">
                    <ZoomIn className="w-3.5 h-3.5 text-gray-400 flex-shrink-0" />
                    <input
                      type="range"
                      min="0.6"
                      max="2.5"
                      step="0.05"
                      value={zoom}
                      onChange={(e) => setZoom(parseFloat(e.target.value))}
                      className="w-full accent-purple-600 cursor-pointer h-1.5 bg-gray-200 rounded-lg"
                    />
                  </div>
                </div>

                {/* 2. Live Sheet Preview with Dashed Lines */}
                <div className="flex flex-col items-center">
                  <span className="text-[11px] font-bold text-gray-500 mb-1.5 flex items-center gap-1">
                    <Scissors className="w-3 h-3 text-purple-600" /> Live Print Sheet ({photoCount} Photos)
                  </span>
                  <div className="w-[170px] h-[210px] bg-slate-100 rounded-xl border border-gray-200 p-2 flex items-center justify-center shadow-inner">
                    {previewSheetUrl ? (
                      <img
                        src={previewSheetUrl}
                        alt="Sheet preview"
                        className="max-h-full max-w-full rounded shadow-sm object-contain"
                      />
                    ) : (
                      <RefreshCw className="w-6 h-6 text-gray-400 animate-spin" />
                    )}
                  </div>
                </div>
              </div>

              {/* Photo Count Selector (4, 6, 8, 10, 12) */}
              <div>
                <label className="block text-xs font-bold text-gray-800 mb-1.5">
                  How many photos on sheet?
                </label>
                <div className="grid grid-cols-5 gap-1.5">
                  {[4, 6, 8, 10, 12].map((cnt) => (
                    <button
                      key={cnt}
                      type="button"
                      onClick={() => setPhotoCount(cnt)}
                      className={`py-2 px-1 rounded-xl text-center border font-bold text-xs transition-all ${
                        photoCount === cnt
                          ? 'bg-purple-600 text-white border-purple-600 shadow-sm'
                          : 'bg-white text-gray-700 border-gray-200 hover:bg-gray-50'
                      }`}
                    >
                      <b className="block text-sm">{cnt}</b>
                      <span className="text-[9px] opacity-80 block">Photos</span>
                    </button>
                  ))}
                </div>
              </div>

              {/* Options Row: Border Toggle & Retake */}
              <div className="flex items-center justify-between pt-2 border-t border-gray-100">
                <label className="flex items-center gap-2 cursor-pointer text-xs font-semibold text-gray-700">
                  <input
                    type="checkbox"
                    checked={withBorder}
                    onChange={(e) => setWithBorder(e.target.checked)}
                    className="rounded accent-purple-600 w-4 h-4"
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
        <div className="p-4 border-t border-gray-100 bg-slate-50 flex items-center justify-end gap-2.5">
          <Button variant="outline" onClick={onClose} className="rounded-xl text-xs font-bold py-2">
            Cancel
          </Button>
          {photoSrc && (
            <Button
              disabled={isProcessing}
              onClick={handleConfirmSheet}
              className="bg-gradient-to-r from-purple-600 to-indigo-600 hover:from-purple-700 hover:to-indigo-700 text-white rounded-xl text-xs font-bold shadow-md py-2 px-4"
            >
              {isProcessing ? (
                <>
                  <RefreshCw className="mr-1.5 w-3.5 h-3.5 animate-spin" /> Generating Sheet...
                </>
              ) : (
                <>
                  Use This Sheet <ArrowRight className="ml-1.5 w-3.5 h-3.5" />
                </>
              )}
            </Button>
          )}
        </div>
      </div>
    </div>
  )
}
