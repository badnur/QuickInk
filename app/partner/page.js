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
      <section className="relative bg-gradient-to-br from-blue-600 via-indigo-600 to-purple-600 text-white py-24 overflow-hidden">
        <div className="absolute inset-0 bg-grid-pattern opacity-10"></div>
        <div className="container mx-auto px-4 sm:px-6 lg:px-8 relative z-10">
          <div className="max-w-4xl mx-auto text-center">
            <Badge className="mb-6 bg-white/20 text-white hover:bg-white/30 backdrop-blur-sm px-4 py-2">
              <TrendingUp className="h-4 w-4 mr-1.5 inline" />
              Partner Program
            </Badge>
            <h1 className="text-5xl md:text-6xl font-bold mb-6 leading-tight">
              Become a QuickInk Partner
            </h1>
            <p className="text-2xl text-blue-100 mb-4">
              Earn extra income from your shop space
            </p>
            <p className="text-xl text-blue-100 mb-8">
              Get <span className="font-bold text-white">৳15,000-৳25,000</span> monthly. Free installation. No effort needed.
            </p>
            <div className="flex flex-col sm:flex-row gap-6 justify-center">
              <div className="bg-white/10 backdrop-blur-sm rounded-2xl px-8 py-4">
                <p className="text-3xl font-bold mb-1">৳18,000</p>
                <p className="text-blue-100 text-sm">Avg Monthly Income</p>
              </div>
              <div className="bg-white/10 backdrop-blur-sm rounded-2xl px-8 py-4">
                <p className="text-3xl font-bold mb-1">40%</p>
                <p className="text-blue-100 text-sm">Your Commission</p>
              </div>
              <div className="bg-white/10 backdrop-blur-sm rounded-2xl px-8 py-4">
                <p className="text-3xl font-bold mb-1">Free</p>
                <p className="text-blue-100 text-sm">Installation Cost</p>
              </div>
            </div>
          </div>
        </div>
      </section>

      {/* Benefits Section */}
      <section className="py-20 bg-gradient-to-br from-gray-50 to-blue-50">
        <div className="container mx-auto px-4 sm:px-6 lg:px-8">
          <div className="text-center mb-16">
            <Badge className="mb-4 bg-green-100 text-green-700 hover:bg-green-100">Why Partner?</Badge>
            <h2 className="text-4xl md:text-5xl font-bold text-gray-900 mb-4">Simple Benefits</h2>
            <p className="text-xl text-gray-600">Everything you need for extra income</p>
          </div>
          <div className="grid grid-cols-1 md:grid-cols-3 gap-8 max-w-6xl mx-auto">
            {[{
              icon: DollarSign,
              title: 'Earn ৳15K-৳25K/month',
              description: 'Get 40% commission on every print. Our average partner earns ৳18k monthly with small space.',
              gradient: 'from-green-500 to-green-600'
            }, {
              icon: Clock,
              title: 'No Effort Needed',
              description: 'Machine works automatically. No maintenance, no supervision. We handle technical issues.',
              gradient: 'from-blue-500 to-blue-600'
            }, {
              icon: TrendingUp,
              title: 'More Customers',
              description: 'Students and office workers visit for printing. They also buy from your shop.',
              gradient: 'from-purple-500 to-purple-600'
            }].map((benefit, index) => {
              const Icon = benefit.icon
              return (
                <Card key={index} className="border-none shadow-xl hover:shadow-2xl transition-all duration-500 hover:-translate-y-2 group overflow-hidden">
                  <div className={`h-2 w-full bg-gradient-to-r ${benefit.gradient}`}></div>
                  <CardContent className="pt-10 pb-8 px-8 text-center">
                    <div className={`w-20 h-20 bg-gradient-to-br ${benefit.gradient} rounded-2xl flex items-center justify-center mx-auto mb-6 shadow-lg group-hover:scale-110 transition-transform duration-300`}>
                      <Icon className="h-10 w-10 text-white" />
                    </div>
                    <h3 className="text-2xl font-bold mb-4 text-gray-900">{benefit.title}</h3>
                    <p className="text-gray-600 leading-relaxed">{benefit.description}</p>
                  </CardContent>
                </Card>
              )
            })}
          </div>
        </div>
      </section>

      {/* How It Works */}
      <section className="py-20 bg-white">
        <div className="container mx-auto px-4 sm:px-6 lg:px-8">
          <div className="text-center mb-16">
            <Badge className="mb-4 bg-blue-100 text-blue-700 hover:bg-blue-100">Simple Process</Badge>
            <h2 className="text-4xl md:text-5xl font-bold text-gray-900 mb-4">How to Get Started</h2>
            <p className="text-xl text-gray-600">Four simple steps to start earning</p>
          </div>
          <div className="max-w-4xl mx-auto space-y-6">
            {[{
              step: '01',
              title: 'Apply Online',
              description: 'Fill the form below. Takes 2 minutes. We review within 24 hours and call you.',
              icon: Users
            }, {
              step: '02',
              title: 'Visit Your Shop',
              description: 'Our team visits to check space and discuss details. Need only 2x2 feet space.',
              icon: CheckCircle
            }, {
              step: '03',
              title: 'Free Installation',
              description: 'We install machine for free. Takes 2 hours. We test everything before leaving.',
              icon: Shield
            }, {
              step: '04',
              title: 'Start Earning',
              description: 'Machine starts working immediately. Check your daily earnings through SMS or app.',
              icon: Zap
            }].map((item, index) => {
              const Icon = item.icon
              return (
                <Card key={index} className="border-2 border-gray-200 hover:border-blue-500 hover:shadow-xl transition-all duration-300 group">
                  <CardContent className="p-8">
                    <div className="flex gap-6 items-start">
                      <div className="flex-shrink-0">
                        <div className="w-16 h-16 bg-gradient-to-br from-blue-600 to-indigo-600 text-white rounded-2xl flex items-center justify-center font-bold text-2xl shadow-lg group-hover:scale-110 transition-transform">
                          {item.step}
                        </div>
                      </div>
                      <div className="flex-1">
                        <div className="flex items-center gap-3 mb-3">
                          <h3 className="text-2xl font-bold text-gray-900">{item.title}</h3>
                          <Icon className="h-6 w-6 text-blue-600" />
                        </div>
                        <p className="text-gray-600 text-lg leading-relaxed">{item.description}</p>
                      </div>
                    </div>
                  </CardContent>
                </Card>
              )
            })}
          </div>
        </div>
      </section>

      {/* Registration Form */}
      <section className="py-20 bg-gradient-to-br from-gray-50 to-blue-50">
        <div className="container mx-auto px-4 sm:px-6 lg:px-8">
          <Card className="max-w-3xl mx-auto shadow-2xl border-none">
            <CardHeader className="bg-gradient-to-r from-blue-600 to-indigo-600 text-white rounded-t-xl p-8">
              <CardTitle className="text-3xl font-bold mb-2">Apply to Become Partner</CardTitle>
              <p className="text-blue-100 text-lg">Join 500+ shop owners earning extra income</p>
            </CardHeader>
            <CardContent className="p-8">
              {success && (
                <div className="mb-8 p-6 bg-green-50 border-2 border-green-200 rounded-2xl flex items-start gap-4 animate-in slide-in-from-top">
                  <div className="w-12 h-12 bg-green-500 rounded-full flex items-center justify-center flex-shrink-0">
                    <CheckCircle className="h-6 w-6 text-white" />
                  </div>
                  <div>
                    <p className="text-green-900 font-bold text-lg mb-1">Application Received!</p>
                    <p className="text-green-700">Thank you! We will call you within 24 hours to discuss next steps.</p>
                  </div>
                </div>
              )}

              {error && (
                <div className="mb-8 p-6 bg-red-50 border-2 border-red-200 rounded-2xl flex items-start gap-4">
                  <AlertCircle className="h-6 w-6 text-red-600 flex-shrink-0 mt-1" />
                  <p className="text-red-800 font-medium">{error}</p>
                </div>
              )}

              <form onSubmit={handleSubmit} className="space-y-6">
                <div>
                  <Label htmlFor="name" className="text-base font-semibold text-gray-900">Your Full Name *</Label>
                  <Input
                    id="name"
                    name="name"
                    value={formData.name}
                    onChange={handleChange}
                    required
                    placeholder="e.g. Mohammad Rahman"
                    className="mt-2 h-14 text-lg border-2 focus:border-blue-500 rounded-xl"
                  />
                </div>

                <div>
                  <Label htmlFor="shop_name" className="text-base font-semibold text-gray-900">Shop/Business Name *</Label>
                  <Input
                    id="shop_name"
                    name="shop_name"
                    value={formData.shop_name}
                    onChange={handleChange}
                    required
                    placeholder="e.g. Rahman Store / City Pharmacy"
                    className="mt-2 h-14 text-lg border-2 focus:border-blue-500 rounded-xl"
                  />
                </div>

                <div>
                  <Label htmlFor="location" className="text-base font-semibold text-gray-900">Shop Address *</Label>
                  <Textarea
                    id="location"
                    name="location"
                    value={formData.location}
                    onChange={handleChange}
                    required
                    placeholder="e.g. Shop 15, Gulshan Avenue, Dhaka-1212"
                    className="mt-2 text-lg border-2 focus:border-blue-500 rounded-xl"
                    rows={4}
                  />
                </div>

                <div>
                  <Label htmlFor="phone" className="text-base font-semibold text-gray-900">Mobile Number *</Label>
                  <Input
                    id="phone"
                    name="phone"
                    value={formData.phone}
                    onChange={handleChange}
                    required
                    placeholder="e.g. 01712-345678"
                    className="mt-2 h-14 text-lg border-2 focus:border-blue-500 rounded-xl"
                  />
                </div>

                <Button 
                  type="submit" 
                  className="w-full h-16 text-lg bg-gradient-to-r from-blue-600 to-indigo-600 hover:from-blue-700 hover:to-indigo-700 shadow-lg hover:shadow-xl transition-all duration-300" 
                  disabled={loading}
                >
                  {loading ? (
                    <>
                      <div className="w-5 h-5 border-2 border-white border-t-transparent rounded-full animate-spin mr-2"></div>
                      Submitting...
                    </>
                  ) : (
                    'Submit Application'
                  )}
                </Button>

                <p className="text-sm text-gray-500 text-center mt-4">
                  We'll call you within 24 hours after reviewing
                </p>
              </form>
            </CardContent>
          </Card>
        </div>
      </section>
    </div>
  )
}
