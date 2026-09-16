'use client'

import { useState } from 'react'
import { Button } from '@/components/ui/button'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Textarea } from '@/components/ui/textarea'
import { Badge } from '@/components/ui/badge'
import { Mail, Phone, MapPin, MessageSquare, CheckCircle, AlertCircle, Clock, Send } from 'lucide-react'
import Link from 'next/link'

export default function ContactPage() {
  const [formData, setFormData] = useState({
    name: '',
    email: '',
    subject: '',
    message: ''
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
      const response = await fetch('/api/contact', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(formData)
      })

      const data = await response.json()

      if (response.ok) {
        setSuccess(true)
        setFormData({ name: '', email: '', subject: '', message: '' })
      } else {
        setError(data.error || 'Something went wrong')
      }
    } catch (err) {
      setError('Failed to send message. Please try again.')
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
      <section className="bg-gray-900 text-white py-16 border-b border-gray-800">
        <div className="container mx-auto px-4 sm:px-6 lg:px-8 max-w-4xl text-center">
          <Badge className="mb-3 bg-[#00bf63]/15 text-[#00bf63] border border-[#00bf63]/30 font-semibold px-3 py-1">
            <MessageSquare className="h-3.5 w-3.5 mr-1.5 inline" />
            Direct Support
          </Badge>
          <h1 className="text-3xl sm:text-4xl font-extrabold tracking-tight mb-2">Get in Touch</h1>
          <p className="text-sm text-gray-300">
            Have questions about your print job, machine locations, or refunds? We are here to assist.
          </p>
        </div>
      </section>

      <section className="py-14 bg-gray-50/60 border-b border-gray-200">
        <div className="container mx-auto px-4 sm:px-6 lg:px-8 max-w-5xl">
          <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
            {/* Contact Info Cards */}
            <div className="lg:col-span-1 space-y-4">
              {/* WhatsApp Card */}
              <div className="border border-gray-200 bg-white rounded-xl p-5 shadow-none">
                <div className="flex items-center gap-3 mb-3">
                  <div className="w-10 h-10 rounded-lg bg-[#00bf63]/10 text-[#00bf63] flex items-center justify-center">
                    <MessageSquare className="h-5 w-5" />
                  </div>
                  <div>
                    <h3 className="text-sm font-bold text-gray-900">WhatsApp Support</h3>
                    <p className="text-xs text-gray-500">Fastest response</p>
                  </div>
                </div>
                <Link href="https://wa.me/8801733398911" target="_blank" className="block">
                  <Button className="w-full bg-[#00bf63] hover:bg-[#00a656] text-white font-semibold text-xs h-9 rounded-lg shadow-none">
                    Chat on WhatsApp
                  </Button>
                </Link>
              </div>

              {/* Email Card */}
              <div className="border border-gray-200 bg-white rounded-xl p-5 shadow-none">
                <div className="flex items-center gap-3 mb-2">
                  <div className="w-10 h-10 rounded-lg bg-gray-100 text-gray-700 flex items-center justify-center">
                    <Mail className="h-5 w-5" />
                  </div>
                  <div>
                    <h3 className="text-sm font-bold text-gray-900">Email</h3>
                    <a href="mailto:support@quickink.online" className="text-xs text-[#00bf63] hover:underline font-medium">
                      support@quickink.online
                    </a>
                  </div>
                </div>
                <p className="text-[11px] text-gray-500">Response within 24 business hours</p>
              </div>

              {/* Phone Card */}
              <div className="border border-gray-200 bg-white rounded-xl p-5 shadow-none">
                <div className="flex items-center gap-3 mb-2">
                  <div className="w-10 h-10 rounded-lg bg-gray-100 text-gray-700 flex items-center justify-center">
                    <Phone className="h-5 w-5" />
                  </div>
                  <div>
                    <h3 className="text-sm font-bold text-gray-900">Helpline</h3>
                    <a href="tel:+8801733398911" className="text-xs text-[#00bf63] hover:underline font-medium">
                      +880 1733-398911
                    </a>
                  </div>
                </div>
                <div className="flex items-center gap-1.5 text-[11px] text-gray-500">
                  <Clock className="h-3.5 w-3.5" />
                  <span>Sat - Thu, 9 AM - 6 PM</span>
                </div>
              </div>

              {/* Office Card */}
              <div className="border border-gray-200 bg-white rounded-xl p-5 shadow-none">
                <div className="flex items-center gap-3 mb-2">
                  <div className="w-10 h-10 rounded-lg bg-gray-100 text-gray-700 flex items-center justify-center">
                    <MapPin className="h-5 w-5" />
                  </div>
                  <div>
                    <h3 className="text-sm font-bold text-gray-900">HQ Office</h3>
                    <p className="text-xs text-gray-600">Bagha, Rajshahi, Bangladesh</p>
                  </div>
                </div>
              </div>
            </div>

            {/* Contact Form */}
            <div className="lg:col-span-2">
              <Card className="border border-gray-200 bg-white rounded-xl shadow-none">
                <CardHeader className="p-6 border-b border-gray-100">
                  <CardTitle className="text-xl font-bold text-gray-900">Send us a Message</CardTitle>
                  <p className="text-xs text-gray-500 mt-1">Leave your details and we will get back to you promptly.</p>
                </CardHeader>
                <CardContent className="p-6">
                  {success && (
                    <div className="mb-6 p-4 bg-[#00bf63]/10 border border-[#00bf63]/30 rounded-lg flex items-start gap-3">
                      <CheckCircle className="h-5 w-5 text-[#00bf63] flex-shrink-0 mt-0.5" />
                      <div>
                        <p className="text-sm font-bold text-gray-900">Message Sent Successfully</p>
                        <p className="text-xs text-gray-700 mt-0.5">Thank you for reaching out. We will reply as soon as possible.</p>
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
                    <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                      <div>
                        <Label htmlFor="name" className="text-xs font-semibold text-gray-700">Your Name *</Label>
                        <Input
                          id="name"
                          name="name"
                          value={formData.name}
                          onChange={handleChange}
                          required
                          placeholder="e.g. Ahmed Hassan"
                          className="mt-1 h-10 text-sm border-gray-200 focus:border-[#00bf63] focus:ring-1 focus:ring-[#00bf63] rounded-lg"
                        />
                      </div>

                      <div>
                        <Label htmlFor="email" className="text-xs font-semibold text-gray-700">Email or Mobile *</Label>
                        <Input
                          id="email"
                          name="email"
                          value={formData.email}
                          onChange={handleChange}
                          required
                          placeholder="e.g. ahmed@email.com / 017..."
                          className="mt-1 h-10 text-sm border-gray-200 focus:border-[#00bf63] focus:ring-1 focus:ring-[#00bf63] rounded-lg"
                        />
                      </div>
                    </div>

                    <div>
                      <Label htmlFor="subject" className="text-xs font-semibold text-gray-700">Subject *</Label>
                      <Input
                        id="subject"
                        name="subject"
                        value={formData.subject}
                        onChange={handleChange}
                        required
                        placeholder="e.g. Print Order Query / Payment Issue"
                        className="mt-1 h-10 text-sm border-gray-200 focus:border-[#00bf63] focus:ring-1 focus:ring-[#00bf63] rounded-lg"
                      />
                    </div>

                    <div>
                      <Label htmlFor="message" className="text-xs font-semibold text-gray-700">Message *</Label>
                      <Textarea
                        id="message"
                        name="message"
                        value={formData.message}
                        onChange={handleChange}
                        required
                        placeholder="Please include order code or kiosk location if relevant..."
                        className="mt-1 text-sm border-gray-200 focus:border-[#00bf63] focus:ring-1 focus:ring-[#00bf63] rounded-lg"
                        rows={5}
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
                          Sending Message...
                        </>
                      ) : (
                        <>
                          <Send className="mr-2 h-4 w-4" />
                          Send Message
                        </>
                      )}
                    </Button>
                  </form>
                </CardContent>
              </Card>
            </div>
          </div>
        </div>
      </section>

      {/* FAQ Section */}
      <section className="py-14 bg-white">
        <div className="container mx-auto px-4 sm:px-6 lg:px-8 max-w-3xl">
          <div className="text-center mb-10">
            <h2 className="text-2xl font-extrabold text-gray-900 mb-1">Frequently Asked Questions</h2>
            <p className="text-xs text-gray-500">Quick answers about our self-service kiosks</p>
          </div>
          <div className="space-y-3">
            {[{
              q: 'What are kiosk operating hours?',
              a: 'Most campus and market kiosks are operational 24/7 or matching the host store hours.'
            }, {
              q: 'What happens if a print jams or ink runs out?',
              a: 'Our smart kiosks automatically detect print jams. If incomplete, an automatic refund is processed to your original payment method or a retry code is issued.'
            }, {
              q: 'What payment methods do you accept?',
              a: 'We support all major Bangladesh payment channels: bKash, Nagad, Rocket, Upay, Visa, and Mastercard.'
            }, {
              q: 'Are my uploaded documents kept confidential?',
              a: 'All files are encrypted in transit and permanently deleted from RAM right after the physical print is ejected.'
            }].map((faq, index) => (
              <div key={index} className="p-4 rounded-xl border border-gray-200 bg-white">
                <h3 className="font-bold text-sm text-gray-900 mb-1">{faq.q}</h3>
                <p className="text-xs text-gray-600 leading-relaxed">{faq.a}</p>
              </div>
            ))}
          </div>
        </div>
      </section>
    </div>
  )
}
