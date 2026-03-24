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
      <section className="relative bg-gradient-to-br from-blue-600 via-indigo-600 to-purple-600 text-white py-24 overflow-hidden">
        <div className="absolute inset-0 bg-grid-pattern opacity-10"></div>
        <div className="container mx-auto px-4 sm:px-6 lg:px-8 relative z-10">
          <div className="max-w-3xl mx-auto text-center">
            <Badge className="mb-6 bg-white/20 text-white hover:bg-white/30 backdrop-blur-sm px-4 py-2">
              <MessageSquare className="h-4 w-4 mr-1.5 inline" />
              We're Here to Help
            </Badge>
            <h1 className="text-5xl md:text-6xl font-bold mb-6">Get in Touch</h1>
            <p className="text-2xl text-blue-100">
              Have questions? We're here to help.
            </p>
          </div>
        </div>
      </section>

      <section className="py-20 bg-gradient-to-br from-gray-50 to-blue-50">
        <div className="container mx-auto px-4 sm:px-6 lg:px-8">
          <div className="grid grid-cols-1 lg:grid-cols-3 gap-8 max-w-7xl mx-auto">
            {/* Contact Info Cards */}
            <div className="lg:col-span-1 space-y-6">
              {/* Email Card */}
              <Card className="border-none shadow-xl hover:shadow-2xl transition-all duration-300 hover:-translate-y-1 overflow-hidden group">
                <div className="h-2 w-full bg-gradient-to-r from-blue-500 to-blue-600"></div>
                <CardContent className="pt-8 pb-6 px-6">
                  <div className="w-16 h-16 bg-gradient-to-br from-blue-500 to-blue-600 rounded-2xl flex items-center justify-center mb-6 shadow-lg group-hover:scale-110 transition-transform">
                    <Mail className="h-8 w-8 text-white" />
                  </div>
                  <h3 className="font-bold text-xl mb-4 text-gray-900">Email Us</h3>
                  <div className="space-y-2">
                    <a href="mailto:support@quickink.com" className="block text-gray-700 hover:text-blue-600 transition-colors font-medium">
                      support@quickink.com
                    </a>
                    <a href="mailto:partner@quickink.com" className="block text-gray-700 hover:text-blue-600 transition-colors font-medium">
                      partner@quickink.com
                    </a>
                  </div>
                  <p className="text-sm text-gray-500 mt-4">We reply within 24 hours</p>
                </CardContent>
              </Card>

              {/* Phone Card */}
              <Card className="border-none shadow-xl hover:shadow-2xl transition-all duration-300 hover:-translate-y-1 overflow-hidden group">
                <div className="h-2 w-full bg-gradient-to-r from-green-500 to-green-600"></div>
                <CardContent className="pt-8 pb-6 px-6">
                  <div className="w-16 h-16 bg-gradient-to-br from-green-500 to-green-600 rounded-2xl flex items-center justify-center mb-6 shadow-lg group-hover:scale-110 transition-transform">
                    <Phone className="h-8 w-8 text-white" />
                  </div>
                  <h3 className="font-bold text-xl mb-4 text-gray-900">Call Us</h3>
                  <a href="tel:+8801812345678" className="block text-gray-700 hover:text-green-600 transition-colors font-medium text-lg mb-2">
                    +880 1812-345678
                  </a>
                  <div className="flex items-center gap-2 text-sm text-gray-600 mt-4">
                    <Clock className="h-4 w-4" />
                    <span>Sat-Thu, 9AM-6PM</span>
                  </div>
                </CardContent>
              </Card>

              {/* Office Card */}
              <Card className="border-none shadow-xl hover:shadow-2xl transition-all duration-300 hover:-translate-y-1 overflow-hidden group">
                <div className="h-2 w-full bg-gradient-to-r from-purple-500 to-purple-600"></div>
                <CardContent className="pt-8 pb-6 px-6">
                  <div className="w-16 h-16 bg-gradient-to-br from-purple-500 to-purple-600 rounded-2xl flex items-center justify-center mb-6 shadow-lg group-hover:scale-110 transition-transform">
                    <MapPin className="h-8 w-8 text-white" />
                  </div>
                  <h3 className="font-bold text-xl mb-4 text-gray-900">Visit Us</h3>
                  <p className="text-gray-700 leading-relaxed">
                    House 123, Road 5,<br />
                    Dhanmondi, Dhaka-1205<br />
                    Bangladesh
                  </p>
                </CardContent>
              </Card>

              {/* WhatsApp Card */}
              <Card className="border-none shadow-xl bg-gradient-to-br from-green-500 to-green-600 text-white hover:shadow-2xl transition-all duration-300 hover:-translate-y-1 hover:scale-105">
                <CardContent className="pt-8 pb-8 px-6">
                  <div className="flex items-center gap-4 mb-6">
                    <div className="w-16 h-16 bg-white/20 rounded-2xl flex items-center justify-center backdrop-blur-sm">
                      <MessageSquare className="h-8 w-8" />
                    </div>
                    <div>
                      <h3 className="font-bold text-xl">WhatsApp</h3>
                      <p className="text-green-100 text-sm">Quick help available</p>
                    </div>
                  </div>
                  <Link href="https://wa.me/8801812345678" target="_blank">
                    <Button variant="secondary" className="w-full h-14 text-lg font-semibold shadow-lg hover:scale-105 transition-transform">
                      Chat on WhatsApp
                    </Button>
                  </Link>
                </CardContent>
              </Card>
            </div>

            {/* Contact Form */}
            <div className="lg:col-span-2">
              <Card className="shadow-2xl border-none">
                <CardHeader className="bg-gradient-to-r from-blue-600 to-indigo-600 text-white rounded-t-xl p-8">
                  <CardTitle className="text-3xl font-bold mb-2">Send us a Message</CardTitle>
                  <p className="text-blue-100 text-lg">We'll reply within 24 hours</p>
                </CardHeader>
                <CardContent className="p-8">
                  {success && (
                    <div className="mb-8 p-6 bg-green-50 border-2 border-green-200 rounded-2xl flex items-start gap-4 animate-in slide-in-from-top">
                      <div className="w-12 h-12 bg-green-500 rounded-full flex items-center justify-center flex-shrink-0">
                        <CheckCircle className="h-6 w-6 text-white" />
                      </div>
                      <div>
                        <p className="text-green-900 font-bold text-lg mb-1">Message Sent!</p>
                        <p className="text-green-700">Thank you for contacting us. We'll respond soon.</p>
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
                    <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                      <div>
                        <Label htmlFor="name" className="text-base font-semibold text-gray-900">Your Name *</Label>
                        <Input
                          id="name"
                          name="name"
                          value={formData.name}
                          onChange={handleChange}
                          required
                          placeholder="e.g. Ahmed Hassan"
                          className="mt-2 h-14 text-lg border-2 focus:border-blue-500 rounded-xl"
                        />
                      </div>

                      <div>
                        <Label htmlFor="email" className="text-base font-semibold text-gray-900">Email or Mobile *</Label>
                        <Input
                          id="email"
                          name="email"
                          type="email"
                          value={formData.email}
                          onChange={handleChange}
                          required
                          placeholder="e.g. ahmed@email.com"
                          className="mt-2 h-14 text-lg border-2 focus:border-blue-500 rounded-xl"
                        />
                      </div>
                    </div>

                    <div>
                      <Label htmlFor="subject" className="text-base font-semibold text-gray-900">Subject *</Label>
                      <Input
                        id="subject"
                        name="subject"
                        value={formData.subject}
                        onChange={handleChange}
                        required
                        placeholder="How can we help?"
                        className="mt-2 h-14 text-lg border-2 focus:border-blue-500 rounded-xl"
                      />
                    </div>

                    <div>
                      <Label htmlFor="message" className="text-base font-semibold text-gray-900">Your Message *</Label>
                      <Textarea
                        id="message"
                        name="message"
                        value={formData.message}
                        onChange={handleChange}
                        required
                        placeholder="Tell us more about your question..."
                        className="mt-2 text-lg border-2 focus:border-blue-500 rounded-xl"
                        rows={8}
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
                          Sending...
                        </>
                      ) : (
                        <>
                          <Send className="mr-2 h-5 w-5" />
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
      <section className="py-20 bg-white">
        <div className="container mx-auto px-4 sm:px-6 lg:px-8">
          <div className="max-w-4xl mx-auto">
            <div className="text-center mb-16">
              <Badge className="mb-4 bg-blue-100 text-blue-700 hover:bg-blue-100">Common Questions</Badge>
              <h2 className="text-4xl md:text-5xl font-bold text-gray-900 mb-4">Frequently Asked</h2>
            </div>
            <div className="space-y-4">
              {[{
                q: 'What are your kiosk operating hours?',
                a: 'Most kiosks are available 24/7. Customer support available Sat-Thu, 9AM-6PM.'
              }, {
                q: 'How long does installation take for partners?',
                a: 'Installation takes 2 hours. We handle everything from setup to testing. Free of cost.'
              }, {
                q: 'What payment methods do you accept?',
                a: 'We accept bKash, Nagad, Rocket, cards, and mobile banking. All methods are secure.'
              }, {
                q: 'Is my file safe? Do you store documents?',
                a: 'Your files are automatically deleted after printing. We don\'t store any documents. Safe and private.'
              }].map((faq, index) => (
                <Card key={index} className="border-2 border-gray-200 hover:border-blue-500 hover:shadow-lg transition-all duration-300">
                  <CardContent className="p-6">
                    <h3 className="font-bold text-lg text-gray-900 mb-2">{faq.q}</h3>
                    <p className="text-gray-600 leading-relaxed">{faq.a}</p>
                  </CardContent>
                </Card>
              ))}
            </div>
          </div>
        </div>
      </section>
    </div>
  )
}
