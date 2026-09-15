'use client'

import { useState } from 'react'
import { Button } from '@/components/ui/button'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Textarea } from '@/components/ui/textarea'
import { Badge } from '@/components/ui/badge'
import { DollarSign, TrendingUp, Clock, CheckCircle, AlertCircle, Users, Shield, Zap } from 'lucide-react'

export default function PartnerPage() {
  const [formData, setFormData] = useState({
    name: '',
    shop_name: '',
    location: '',
    phone: ''
  })
  const [loading, setLoading] = useState(false)
  const [success, setSuccess] = useState(false)
  const [error, setError] = useState('')

  const handleSubmit = async (e) => {
    e.preventDefault()
    setLoading(true)
    setError('')
    setSuccess(false)

    try {
      const response = await fetch('/api/partners', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(formData)
      })

      const data = await response.json()

      if (response.ok) {
        setSuccess(true)
        setFormData({ name: '', shop_name: '', location: '', phone: '' })
      } else {
        setError(data.error || 'Something went wrong')
      }
    } catch (err) {
      setError('Failed to submit form. Please try again.')
    } finally {
      setLoading(false)
    }
  }

  const handleChange = (e) => {
    setFormData({ ...formData, [e.target.name]: e.target.value })
  }

  return (
    <div className="min-h-screen bg-white">
      {/* Hero Section */}
      <section className="bg-gray-900 text-white py-20 border-b border-gray-800">
        <div className="container mx-auto px-4 sm:px-6 lg:px-8">
          <div className="max-w-3xl mx-auto text-center">
            <Badge className="mb-4 bg-[#00bf63]/15 text-[#00bf63] border border-[#00bf63]/30 font-semibold px-3 py-1">
              <TrendingUp className="h-3.5 w-3.5 mr-1.5 inline" />
              Partner Program
            </Badge>
            <h1 className="text-4xl sm:text-5xl font-extrabold tracking-tight mb-4">
              Become a QuickInk Host Partner
            </h1>
            <p className="text-lg text-gray-300 mb-8">
              Turn your unused 2×2 ft shop corner into guaranteed passive income. Zero machine cost, zero maintenance, free installation.
            </p>
            <div className="grid grid-cols-1 sm:grid-cols-3 gap-4 max-w-xl mx-auto">
              <div className="bg-gray-800/80 border border-gray-700/80 rounded-xl p-4 text-center">
                <p className="text-2xl font-bold text-[#00bf63]">৳15K - 25K</p>
                <p className="text-xs text-gray-400 mt-0.5">Monthly Revenue Share</p>
              </div>
              <div className="bg-gray-800/80 border border-gray-700/80 rounded-xl p-4 text-center">
                <p className="text-2xl font-bold text-[#00bf63]">40%</p>
                <p className="text-xs text-gray-400 mt-0.5">Fixed Commission</p>
              </div>
              <div className="bg-gray-800/80 border border-gray-700/80 rounded-xl p-4 text-center">
                <p className="text-2xl font-bold text-[#00bf63]">৳0</p>
                <p className="text-xs text-gray-400 mt-0.5">Zero Setup Fee</p>
              </div>
            </div>
          </div>
        </div>
      </section>

      {/* Benefits Section */}
      <section className="py-16 bg-gray-50/60 border-b border-gray-200">
        <div className="container mx-auto px-4 sm:px-6 lg:px-8 max-w-5xl">
          <div className="text-center mb-12">
            <h2 className="text-2xl sm:text-3xl font-extrabold text-gray-900 mb-2">Why Partner With Us?</h2>
            <p className="text-sm text-gray-600">Pure passive revenue without operational headache</p>
          </div>
          <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
            {[{
              icon: DollarSign,
              title: 'Guaranteed Commission',
              description: 'Earn 40% payout on every black & white, color, and photo print processed at your kiosk.'
            }, {
              icon: Clock,
              title: '100% Automated',
              description: 'Users scan QR and pay on mobile. The kiosk dispenses automatically — zero staff intervention.'
            }, {
              icon: TrendingUp,
              title: 'Drive Store Footfall',
              description: 'University students, job seekers, and locals come to print and browse your store inventory.'
            }].map((benefit, index) => {
              const Icon = benefit.icon
              return (
                <Card key={index} className="border border-gray-200 bg-white rounded-xl shadow-none hover:border-gray-300 transition-colors">
                  <CardContent className="p-6">
                    <div className="w-10 h-10 bg-[#00bf63]/10 rounded-lg flex items-center justify-center mb-4 text-[#00bf63]">
                      <Icon className="h-5 w-5" />
                    </div>
                    <h3 className="text-base font-bold text-gray-900 mb-2">{benefit.title}</h3>
                    <p className="text-xs text-gray-600 leading-relaxed">{benefit.description}</p>
                  </CardContent>
                </Card>
              )
            })}
          </div>
        </div>
      </section>

      {/* How It Works */}
      <section className="py-16 bg-white border-b border-gray-200">
        <div className="container mx-auto px-4 sm:px-6 lg:px-8 max-w-3xl">
          <div className="text-center mb-12">
            <h2 className="text-2xl sm:text-3xl font-extrabold text-gray-900 mb-2">How It Works</h2>
            <p className="text-sm text-gray-600">Fast 4-step onboarding to launch your kiosk</p>
          </div>
          <div className="space-y-4">
            {[{
              step: '01',
              title: 'Submit Application',
              description: 'Fill out the simple partner interest form below. Takes less than 1 minute.'
            }, {
              step: '02',
              title: 'Space & Power Feasibility',
              description: 'Our field technician visits to verify 2×2 ft space and a standard 220V power outlet.'
            }, {
              step: '03',
              title: 'Free Machine Setup',
              description: 'We deliver, install, calibrate, and load high-yield paper & toner within 48 hours.'
            }, {
              step: '04',
              title: 'Direct Bank / bKash Payouts',
              description: 'Track real-time prints on your partner dashboard and receive automated weekly payouts.'
            }].map((item, index) => (
              <div key={index} className="flex gap-4 p-4 rounded-xl border border-gray-200 bg-white items-start">
                <div className="w-8 h-8 rounded-lg bg-[#00bf63]/10 text-[#00bf63] font-bold text-xs flex items-center justify-center flex-shrink-0">
                  {item.step}
                </div>
                <div>
                  <h4 className="text-sm font-bold text-gray-900 mb-1">{item.title}</h4>
                  <p className="text-xs text-gray-600 leading-relaxed">{item.description}</p>
                </div>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* Registration Form */}
      <section className="py-16 bg-gray-50/60">
        <div className="container mx-auto px-4 sm:px-6 lg:px-8 max-w-xl">
          <Card className="border border-gray-200 bg-white rounded-xl shadow-none">
            <CardHeader className="p-6 border-b border-gray-100">
              <CardTitle className="text-xl font-bold text-gray-900">Partner Application Form</CardTitle>
              <p className="text-xs text-gray-500 mt-1">We respond within 24 business hours.</p>
            </CardHeader>
            <CardContent className="p-6">
              {success && (
                <div className="mb-6 p-4 bg-[#00bf63]/10 border border-[#00bf63]/30 rounded-lg flex items-start gap-3">
                  <CheckCircle className="h-5 w-5 text-[#00bf63] flex-shrink-0 mt-0.5" />
                  <div>
                    <p className="text-sm font-bold text-gray-900">Application Received</p>
                    <p className="text-xs text-gray-700 mt-0.5">Thank you! Our partnership team will contact you shortly.</p>
                  </div>
                </div>
              )}

              {error && (
                <div className="mb-6 p-4 bg-red-50 border border-red-200 rounded-lg flex items-start gap-3">
                  <AlertCircle className="h-5 w-5 text-red-600 flex-shrink-0 mt-0.5" />
                  <p className="text-xs text-red-700">{error}</p>
                </div>
              )}

              <form onSubmit={handleSubmit} className="space-y-4">
                <div>
                  <Label htmlFor="name" className="text-xs font-semibold text-gray-700">Your Full Name *</Label>
                  <Input
                    id="name"
                    name="name"
                    value={formData.name}
                    onChange={handleChange}
                    required
                    placeholder="e.g. Mohammad Rahman"
                    className="mt-1 h-10 text-sm border-gray-200 focus:border-[#00bf63] focus:ring-1 focus:ring-[#00bf63] rounded-lg"
                  />
                </div>

                <div>
                  <Label htmlFor="shop_name" className="text-xs font-semibold text-gray-700">Shop / Business Name *</Label>
                  <Input
                    id="shop_name"
                    name="shop_name"
                    value={formData.shop_name}
                    onChange={handleChange}
                    required
                    placeholder="e.g. City Pharmacy / Rahman Stationery"
                    className="mt-1 h-10 text-sm border-gray-200 focus:border-[#00bf63] focus:ring-1 focus:ring-[#00bf63] rounded-lg"
                  />
                </div>

                <div>
                  <Label htmlFor="location" className="text-xs font-semibold text-gray-700">Shop Address *</Label>
                  <Textarea
                    id="location"
                    name="location"
                    value={formData.location}
                    onChange={handleChange}
                    required
                    placeholder="e.g. Shop 15, Near Central Library, University Campus"
                    className="mt-1 text-sm border-gray-200 focus:border-[#00bf63] focus:ring-1 focus:ring-[#00bf63] rounded-lg"
                    rows={3}
                  />
                </div>

                <div>
                  <Label htmlFor="phone" className="text-xs font-semibold text-gray-700">Mobile Number *</Label>
                  <Input
                    id="phone"
                    name="phone"
                    value={formData.phone}
                    onChange={handleChange}
                    required
                    placeholder="e.g. 01712-345678"
                    className="mt-1 h-10 text-sm border-gray-200 focus:border-[#00bf63] focus:ring-1 focus:ring-[#00bf63] rounded-lg"
                  />
                </div>

                <Button 
                  type="submit" 
                  className="w-full h-11 text-sm font-semibold bg-[#00bf63] hover:bg-[#00a656] text-white rounded-lg shadow-none transition-colors" 
                  disabled={loading}
                >
                  {loading ? (
                    <>
                      <div className="w-4 h-4 border-2 border-white border-t-transparent rounded-full animate-spin mr-2"></div>
                      Submitting Application...
                    </>
                  ) : (
                    'Submit Application'
                  )}
                </Button>
              </form>
            </CardContent>
          </Card>
        </div>
      </section>
    </div>
  )
}
