'use client'

import { useState } from 'react'
import { Button } from '@/components/ui/button'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Badge } from '@/components/ui/badge'
import { Upload as UploadIcon, FileText, CheckCircle, AlertCircle, Download, Printer } from 'lucide-react'
import Image from 'next/image'
import Link from 'next/link'

export default function UploadPage() {
  const [file, setFile] = useState(null)
  const [colorMode, setColorMode] = useState('bw')
  const [pages, setPages] = useState(1)
  const [loading, setLoading] = useState(false)
  const [success, setSuccess] = useState(false)
  const [error, setError] = useState('')
  const [jobData, setJobData] = useState(null)

  const handleFileChange = (e) => {
    const selectedFile = e.target.files[0]
    if (selectedFile) {
      // Validate file size (10MB)
      if (selectedFile.size > 10 * 1024 * 1024) {
        setError('File size must be less than 10MB')
        return
      }
      setFile(selectedFile)
      setError('')
    }
  }

  const handleSubmit = async (e) => {
    e.preventDefault()
    
    if (!file) {
      setError('Please select a file to upload')
      return
    }

    setLoading(true)
    setError('')
    setSuccess(false)

    try {
      const formData = new FormData()
      formData.append('file', file)
      formData.append('color_mode', colorMode)
      formData.append('pages', pages.toString())

      const response = await fetch('/api/upload', {
        method: 'POST',
        body: formData
      })

      const data = await response.json()

      if (response.ok) {
        setSuccess(true)
        setJobData(data.job)
        setFile(null)
        // Reset form
        document.getElementById('file-upload').value = ''
      } else {
        setError(data.error || 'Failed to upload file')
      }
    } catch (err) {
      setError('Failed to upload file. Please try again.')
    } finally {
      setLoading(false)
    }
  }

  const pricePerPage = colorMode === 'color' ? 10 : 2
  const totalPrice = pages * pricePerPage

  return (
    <div className="min-h-screen bg-gradient-to-br from-gray-50 to-blue-50 py-12">
      <div className="container mx-auto px-4 sm:px-6 lg:px-8">
        {!success ? (
          // Upload Form
          <div className="max-w-3xl mx-auto">
            <div className="text-center mb-8">
              <Badge className="mb-4 bg-blue-100 text-blue-700 hover:bg-blue-100">
                <UploadIcon className="h-3 w-3 mr-1 inline" />
                Upload & Print
              </Badge>
              <h1 className="text-4xl md:text-5xl font-bold text-gray-900 mb-4">
                Upload Your Document
              </h1>
              <p className="text-xl text-gray-600">
                Upload your file, get QR code, and print at any nearby kiosk
              </p>
            </div>

            <Card className="shadow-2xl border-none">
              <CardHeader className="bg-gradient-to-r from-blue-600 to-indigo-600 text-white rounded-t-xl p-8">
                <CardTitle className="text-2xl font-bold">Upload Document</CardTitle>
                <p className="text-blue-100 mt-2">Supported: PDF, Word, Images (Max 10MB)</p>
              </CardHeader>
              <CardContent className="p-8">
                {error && (
                  <div className="mb-6 p-4 bg-red-50 border-2 border-red-200 rounded-xl flex items-start gap-3">
                    <AlertCircle className="h-5 w-5 text-red-600 flex-shrink-0 mt-0.5" />
                    <p className="text-red-800">{error}</p>
                  </div>
                )}

                <form onSubmit={handleSubmit} className="space-y-6">
                  {/* File Upload */}
                  <div>
                    <Label htmlFor="file-upload" className="text-base font-semibold text-gray-900">Select File *</Label>
                    <div className="mt-2">
                      <Input
                        id="file-upload"
                        type="file"
                        accept=".pdf,.doc,.docx,.jpg,.jpeg,.png"
                        onChange={handleFileChange}
                        required
                        className="h-14 text-lg border-2 focus:border-blue-500 rounded-xl file:mr-4 file:py-2 file:px-4 file:rounded-lg file:border-0 file:text-sm file:font-semibold file:bg-blue-50 file:text-blue-700 hover:file:bg-blue-100"
                      />
                    </div>
                    {file && (
                      <div className="mt-3 flex items-center gap-2 text-sm text-green-600">
                        <FileText className="h-4 w-4" />
                        <span>{file.name} ({(file.size / 1024 / 1024).toFixed(2)} MB)</span>
                      </div>
                    )}
                  </div>

                  {/* Number of Pages */}
                  <div>
                    <Label htmlFor="pages" className="text-base font-semibold text-gray-900">Number of Pages *</Label>
                    <Input
                      id="pages"
                      type="number"
                      min="1"
                      max="100"
                      value={pages}
                      onChange={(e) => setPages(parseInt(e.target.value) || 1)}
                      required
                      className="mt-2 h-14 text-lg border-2 focus:border-blue-500 rounded-xl"
                    />
                  </div>

                  {/* Color Mode */}
                  <div>
                    <Label className="text-base font-semibold text-gray-900 mb-3 block">Print Mode *</Label>
                    <div className="grid grid-cols-2 gap-4">
                      <div
                        onClick={() => setColorMode('bw')}
                        className={`p-4 border-2 rounded-xl cursor-pointer transition-all ${
                          colorMode === 'bw'
                            ? 'border-blue-600 bg-blue-50'
                            : 'border-gray-200 hover:border-blue-300'
                        }`}
                      >
                        <div className="flex items-center justify-between mb-2">
                          <span className="font-semibold text-lg">Black & White</span>
                          {colorMode === 'bw' && <CheckCircle className="h-5 w-5 text-blue-600" />}
                        </div>
                        <p className="text-sm text-gray-600">৳2 per page</p>
                      </div>

                      <div
                        onClick={() => setColorMode('color')}
                        className={`p-4 border-2 rounded-xl cursor-pointer transition-all ${
                          colorMode === 'color'
                            ? 'border-blue-600 bg-blue-50'
                            : 'border-gray-200 hover:border-blue-300'
                        }`}
                      >
                        <div className="flex items-center justify-between mb-2">
                          <span className="font-semibold text-lg">Color Print</span>
                          {colorMode === 'color' && <CheckCircle className="h-5 w-5 text-blue-600" />}
                        </div>
                        <p className="text-sm text-gray-600">৳10 per page</p>
                      </div>
                    </div>
                  </div>

                  {/* Price Summary */}
                  <Card className="bg-gray-50 border-2 border-gray-200">
                    <CardContent className="p-6">
                      <div className="flex items-center justify-between">
                        <div>
                          <p className="text-sm text-gray-600">Total Price</p>
                          <p className="text-3xl font-bold text-gray-900">৳{totalPrice}</p>
                          <p className="text-sm text-gray-500 mt-1">
                            {pages} page{pages > 1 ? 's' : ''} × ৳{pricePerPage}
                          </p>
                        </div>
                        <Printer className="h-12 w-12 text-blue-600" />
                      </div>
                    </CardContent>
                  </Card>

                  {/* Submit Button */}
                  <Button
                    type="submit"
                    className="w-full h-16 text-lg bg-gradient-to-r from-blue-600 to-indigo-600 hover:from-blue-700 hover:to-indigo-700 shadow-lg hover:shadow-xl transition-all duration-300"
                    disabled={loading}
                  >
                    {loading ? (
                      <>
                        <div className="w-5 h-5 border-2 border-white border-t-transparent rounded-full animate-spin mr-2"></div>
                        Uploading...
                      </>
                    ) : (
                      <>
                        <UploadIcon className="mr-2 h-5 w-5" />
                        Upload & Get QR Code
                      </>
                    )}
                  </Button>
                </form>
              </CardContent>
            </Card>
          </div>
        ) : (
          // Success Screen with QR Code
          <div className="max-w-2xl mx-auto">
            <Card className="shadow-2xl border-none">
              <CardHeader className="bg-gradient-to-r from-green-500 to-green-600 text-white rounded-t-xl p-8 text-center">
                <div className="w-16 h-16 bg-white rounded-full flex items-center justify-center mx-auto mb-4">
                  <CheckCircle className="h-10 w-10 text-green-600" />
                </div>
                <CardTitle className="text-3xl font-bold mb-2">Upload Successful!</CardTitle>
                <p className="text-green-100 text-lg">Your document is ready to print</p>
              </CardHeader>
              <CardContent className="p-8">
                {jobData && (
                  <>
                    {/* QR Code */}
                    <div className="text-center mb-8">
                      <div className="bg-white p-6 rounded-2xl shadow-lg inline-block">
                        <img
                          src={jobData.qr_code}
                          alt="Print QR Code"
                          className="w-64 h-64 mx-auto"
                        />
                      </div>
                      <p className="text-sm text-gray-600 mt-4">Scan this QR code at any QuickInk kiosk</p>
                    </div>

                    {/* Job Details */}
                    <div className="space-y-4 mb-8">
                      <div className="flex justify-between items-center p-4 bg-gray-50 rounded-lg">
                        <span className="text-gray-600">File Name:</span>
                        <span className="font-semibold text-gray-900">{jobData.file_name}</span>
                      </div>
                      <div className="flex justify-between items-center p-4 bg-gray-50 rounded-lg">
                        <span className="text-gray-600">Pages:</span>
                        <span className="font-semibold text-gray-900">{jobData.pages}</span>
                      </div>
                      <div className="flex justify-between items-center p-4 bg-gray-50 rounded-lg">
                        <span className="text-gray-600">Print Mode:</span>
                        <span className="font-semibold text-gray-900">
                          {jobData.color_mode === 'bw' ? 'Black & White' : 'Color'}
                        </span>
                      </div>
                      <div className="flex justify-between items-center p-4 bg-blue-50 rounded-lg border-2 border-blue-200">
                        <span className="text-gray-900 font-semibold">Total Price:</span>
                        <span className="font-bold text-2xl text-blue-600">৳{jobData.price}</span>
                      </div>
                    </div>

                    {/* Actions */}
                    <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                      <a href={jobData.qr_code} download="quickink-qr-code.png">
                        <Button variant="outline" className="w-full h-12 border-2">
                          <Download className="mr-2 h-4 w-4" />
                          Download QR Code
                        </Button>
                      </a>
                      <Link href="/find-printer">
                        <Button className="w-full h-12 bg-blue-600 hover:bg-blue-700">
                          <Printer className="mr-2 h-4 w-4" />
                          Find Nearest Kiosk
                        </Button>
                      </Link>
                    </div>

                    <div className="mt-6 text-center">
                      <button
                        onClick={() => {
                          setSuccess(false)
                          setJobData(null)
                        }}
                        className="text-blue-600 hover:text-blue-700 font-medium"
                      >
                        Upload Another Document
                      </button>
                    </div>
                  </>
                )}
              </CardContent>
            </Card>
          </div>
        )}
      </div>
    </div>
  )
}
