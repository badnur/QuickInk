'use client'

import { useState, useEffect } from 'react'
import Link from 'next/link'
import { Button } from '@/components/ui/button'
import { Card, CardContent } from '@/components/ui/card'
import { Badge } from '@/components/ui/badge'
import { Upload, MapPin, Printer, Clock, DollarSign, Users, ArrowRight, Zap, Shield, TrendingUp, CheckCircle, Sparkles, QrCode } from 'lucide-react'

export default function HomePage() {
  const [isVisible, setIsVisible] = useState(false)

  useEffect(() => {
    setIsVisible(true)
  }, [])

  return (
    <div className="bg-white font-sans text-gray-900">
      {/* Hero Section */}
      <section className="relative overflow-hidden bg-slate-50/60 pt-24 pb-24 border-b border-gray-100">
        <div className="container mx-auto px-4 sm:px-6 lg:px-8 relative z-10">
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-12 items-center">
            {/* Left: Content */}
            <div className={`transition-all duration-500 ${isVisible ? 'opacity-100 translate-y-0' : 'opacity-0 translate-y-4'}`}>
              <div className="inline-flex items-center gap-1.5 bg-[#00bf63]/10 text-[#00bf63] px-3.5 py-1 rounded-full text-xs font-bold mb-6">
                <Sparkles className="h-3.5 w-3.5" />
                Next-Gen Print Network
              </div>
              <h1 className="text-4xl sm:text-6xl font-extrabold text-gray-900 mb-5 leading-tight tracking-tight">
                From phone to paper in{' '}
                <span className="text-[#00bf63]">60 seconds</span>
              </h1>
              <p className="text-lg sm:text-xl text-gray-600 mb-6 leading-relaxed max-w-lg">
                Self-service cloud printing at automated kiosks and partner shops. No queues, no pen drives.
              </p>
              <div className="flex flex-col sm:flex-row gap-3">
                <Link href="/print">
                  <Button size="lg" className="w-full sm:w-auto text-sm px-7 py-5 bg-[#00bf63] hover:bg-[#00a656] text-white font-bold rounded-xl shadow-none transition-colors">
                    <Printer className="mr-2 h-4 w-4" />
                    Print Document Now
                  </Button>
                </Link>
                <Link href="/find-printer">
                  <Button size="lg" variant="outline" className="w-full sm:w-auto text-sm px-7 py-5 border border-gray-200 hover:border-[#00bf63] hover:bg-[#00bf63]/5 text-gray-800 rounded-xl shadow-none transition-colors">
                    <MapPin className="mr-2 h-4 w-4" />
                    Find Nearest Kiosk
                  </Button>
                </Link>
              </div>
              <div className="mt-8 pt-8 border-t border-gray-200/80 flex items-center gap-8 text-xs text-gray-500">
                <div>
                  <p className="text-xl font-extrabold text-gray-900">৳2/page</p>
                  <p className="text-gray-500 mt-0.5">Affordable student pricing</p>
                </div>
                <div className="h-8 w-px bg-gray-200" />
                <div>
                  <p className="text-xl font-extrabold text-gray-900">100% Private</p>
                  <p className="text-gray-500 mt-0.5">Auto-erased after print</p>
                </div>
              </div>
            </div>

            {/* Right: Minimal Kiosk Mockup Card */}
            <div className={`relative transition-all duration-500 delay-150 ${isVisible ? 'opacity-100 translate-y-0' : 'opacity-0 translate-y-4'}`}>
              <div className="bg-[#111827] border border-gray-800 rounded-2xl p-8 text-white">
                <div className="flex items-center justify-between mb-8 pb-4 border-b border-gray-800">
                  <div className="flex items-center gap-3">
                    <div className="w-10 h-10 rounded-xl bg-[#00bf63]/10 text-[#00bf63] flex items-center justify-center font-bold text-lg">
                      🖨️
                    </div>
                    <div>
                      <h3 className="font-bold text-sm text-white">QuickInk Terminal</h3>
                      <p className="text-xs text-gray-400">Self-Service Station</p>
                    </div>
                  </div>
                  <span className="text-[11px] font-bold text-[#00bf63] flex items-center gap-1.5 bg-[#00bf63]/10 px-2.5 py-0.5 rounded-full">
                    <span className="w-1.5 h-1.5 rounded-full bg-[#00bf63]" /> Live
                  </span>
                </div>

                <div className="space-y-3">
                  <div className="bg-gray-900/90 border border-gray-800 rounded-xl p-3.5 flex items-center gap-3.5">
                    <div className="w-9 h-9 bg-gray-800 text-[#00bf63] rounded-lg flex items-center justify-center flex-shrink-0">
                      <Clock className="h-4 w-4" />
                    </div>
                    <div>
                      <p className="font-bold text-xs text-white">24/7 Available</p>
                      <p className="text-gray-400 text-[11px]">Print day or night on campus</p>
                    </div>
                  </div>

                  <div className="bg-gray-900/90 border border-gray-800 rounded-xl p-3.5 flex items-center gap-3.5">
                    <div className="w-9 h-9 bg-gray-800 text-[#00bf63] rounded-lg flex items-center justify-center flex-shrink-0">
                      <Zap className="h-4 w-4" />
                    </div>
                    <div>
                      <p className="font-bold text-xs text-white">Instant QR Release</p>
                      <p className="text-gray-400 text-[11px]">Prints in 60 seconds with one scan</p>
                    </div>
                  </div>

                  <div className="bg-gray-900/90 border border-gray-800 rounded-xl p-3.5 flex items-center gap-3.5">
                    <div className="w-9 h-9 bg-gray-800 text-[#00bf63] rounded-lg flex items-center justify-center flex-shrink-0">
                      <DollarSign className="h-4 w-4" />
                    </div>
                    <div>
                      <p className="font-bold text-xs text-white">Paper Saver Options</p>
                      <p className="text-gray-400 text-[11px]">B&W, Color, and N-in-1 Mini Print</p>
                    </div>
                  </div>
                </div>
              </div>
            </div>
          </div>
        </div>
      </section>

      {/* How It Works Section */}
      <section className="py-20 bg-white">
        <div className="container mx-auto px-4 sm:px-6 lg:px-8">
          <div className="text-center mb-14">
            <span className="text-xs font-bold text-[#00bf63] tracking-wider uppercase mb-1 block">Simple 3-Step Process</span>
            <h2 className="text-3xl sm:text-4xl font-extrabold text-gray-900 mb-2">How It Works</h2>
            <p className="text-sm text-gray-600 max-w-lg mx-auto">Fast, secure, and hassle-free printing from any device</p>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-3 gap-6 max-w-5xl mx-auto">
            {[{
              step: '01',
              icon: Upload,
              title: 'Upload or Scan',
              description: 'Upload PDF, DOCX, or snap physical documents with the Clean B&W camera scanner.'
            }, {
              step: '02',
              icon: QrCode,
              title: 'Get 6-Digit OTP & QR',
              description: 'Choose color or B&W, copies, and pay online or at the counter to receive your redemption ticket.'
            }, {
              step: '03',
              icon: Printer,
              title: 'Collect Your Print',
              description: 'Visit the kiosk or shop, scan your QR code or type your code, and receive your crisp print in 60s.'
            }].map((item, index) => {
              const Icon = item.icon
              return (
                <Card key={index} className="border border-gray-200 hover:border-[#00bf63] rounded-2xl shadow-none transition-colors p-6 bg-white">
                  <div className="flex items-center justify-between mb-5">
                    <div className="w-11 h-11 bg-[#00bf63]/10 text-[#00bf63] rounded-xl flex items-center justify-center font-bold">
                      <Icon className="h-5 w-5" />
                    </div>
                    <span className="text-xs font-bold text-gray-400 font-mono">
                      {item.step}
                    </span>
                  </div>
                  <h3 className="text-base font-bold text-gray-900 mb-2">{item.title}</h3>
                  <p className="text-xs text-gray-600 leading-relaxed">{item.description}</p>
                </Card>
              )
            })}
          </div>
        </div>
      </section>

      {/* Trust & Privacy Section */}
      <section className="py-16 bg-slate-50 border-t border-b border-gray-100">
        <div className="container mx-auto px-4 sm:px-6 lg:px-8">
          <div className="max-w-3xl mx-auto text-center">
            <div className="w-12 h-12 bg-[#00bf63]/10 text-[#00bf63] rounded-xl flex items-center justify-center mx-auto mb-4">
              <Shield className="h-6 w-6" />
            </div>
            <h2 className="text-2xl sm:text-3xl font-bold text-gray-900 mb-3">Safe & Private Printing</h2>
            <p className="text-sm text-gray-600 mb-8 max-w-xl mx-auto">
              Your documents are strictly encrypted and permanently deleted immediately after printing. No logs, no residual files.
            </p>
            <div className="flex items-center justify-center gap-6 flex-wrap text-xs text-gray-700">
              <div className="flex items-center gap-2">
                <CheckCircle className="h-4 w-4 text-[#00bf63]" />
                <span className="font-medium">Auto-erased on print</span>
              </div>
              <div className="flex items-center gap-2">
                <CheckCircle className="h-4 w-4 text-[#00bf63]" />
                <span className="font-medium">Direct secure storage</span>
              </div>
              <div className="flex items-center gap-2">
                <CheckCircle className="h-4 w-4 text-[#00bf63]" />
                <span className="font-medium">Kiosk hardware sandbox</span>
              </div>
            </div>
          </div>
        </div>
      </section>

      {/* Pricing Section */}
      <section className="py-20 bg-white">
        <div className="container mx-auto px-4 sm:px-6 lg:px-8">
          <div className="text-center mb-14">
            <span className="text-xs font-bold text-[#00bf63] tracking-wider uppercase mb-1 block">Transparent Rates</span>
            <h2 className="text-3xl sm:text-4xl font-extrabold text-gray-900 mb-2">Affordable Student Pricing</h2>
            <p className="text-sm text-gray-600">No hidden fees. Pay only for the pages you print.</p>
          </div>
          <div className="grid grid-cols-1 md:grid-cols-2 gap-6 max-w-3xl mx-auto">
            {[{
              name: 'Black & White',
              price: '৳2',
              unit: 'per page',
              description: 'Assignments, lecture notes, study materials',
              features: ['Standard A4', 'Single or Dual-Sided (Duplex)', 'Fast 600 DPI laser printing', 'Mini Print (N-in-1) support'],
              popular: true
            }, {
              name: 'Full Color',
              price: '৳8',
              unit: 'per page',
              description: 'Presentations, diagrams, certificates, and photos',
              features: ['Standard A4 & 4×6 Photo', 'Vibrant crisp color reproduction', 'Passport Photo Grid generator', 'Clean edge finishing'],
              popular: false
            }].map((plan, index) => (
              <Card key={index} className={`relative rounded-2xl border p-6 bg-white shadow-none transition-colors ${
                plan.popular ? 'border-[#00bf63]' : 'border-gray-200'
              }`}>
                {plan.popular && (
                  <span className="absolute top-4 right-4 bg-[#00bf63]/10 text-[#00bf63] text-[10px] font-bold px-2.5 py-0.5 rounded-full">
                    Most Popular
                  </span>
                )}
                <h3 className="text-lg font-bold text-gray-900 mb-1">{plan.name}</h3>
                <p className="text-xs text-gray-500 mb-4">{plan.description}</p>
                <div className="mb-6 flex items-baseline gap-1">
                  <span className="text-4xl font-black text-gray-900">{plan.price}</span>
                  <span className="text-xs text-gray-500">{plan.unit}</span>
                </div>
                <ul className="space-y-2.5 mb-6 text-xs text-gray-700">
                  {plan.features.map((feature, i) => (
                    <li key={i} className="flex items-center gap-2">
                      <CheckCircle className="h-3.5 w-3.5 text-[#00bf63] flex-shrink-0" />
                      <span>{feature}</span>
                    </li>
                  ))}
                </ul>
                <Link href="/print">
                  <Button className={`w-full text-xs font-bold py-2 rounded-xl shadow-none ${
                    plan.popular
                      ? 'bg-[#00bf63] hover:bg-[#00a656] text-white'
                      : 'bg-gray-100 hover:bg-gray-200 text-gray-800'
                  }`}>
                    Print with {plan.name}
                  </Button>
                </Link>
              </Card>
            ))}
          </div>
        </div>
      </section>

      {/* Partner CTA Section */}
      <section className="py-20 bg-[#111827] text-white border-t border-gray-800">
        <div className="container mx-auto px-4 sm:px-6 lg:px-8 text-center max-w-3xl">
          <span className="inline-block bg-[#00bf63]/10 text-[#00bf63] text-xs font-bold px-3 py-1 rounded-full mb-4">
            Partner Program
          </span>
          <h2 className="text-3xl sm:text-4xl font-extrabold mb-3">
            Host a QuickInk Station in Your Shop
          </h2>
          <p className="text-sm text-gray-400 mb-8 max-w-xl mx-auto">
            Zero equipment cost, automatic maintenance, and revenue share on every print order placed at your location.
          </p>
          <Link href="/partner">
            <Button className="bg-[#00bf63] hover:bg-[#00a656] text-white font-bold text-xs px-6 py-2.5 rounded-xl shadow-none">
              Apply as Partner <ArrowRight className="ml-1.5 h-3.5 w-3.5" />
            </Button>
          </Link>
        </div>
      </section>

      {/* Mobile Sticky CTA */}
      <div className="md:hidden fixed bottom-0 left-0 right-0 bg-white border-t border-gray-200 p-3 z-50 flex gap-2">
        <Link href="/print" className="flex-1">
          <Button className="w-full bg-[#00bf63] hover:bg-[#00a656] text-white text-xs py-2.5 font-bold shadow-none rounded-xl">
            <Printer className="mr-1.5 h-4 w-4" /> Print Document Now
          </Button>
        </Link>
        <Link href="/find-printer">
          <Button variant="outline" className="border-gray-300 rounded-xl px-3 py-2.5 shadow-none">
            <MapPin className="h-4 w-4 text-gray-700" />
          </Button>
        </Link>
      </div>
    </div>
  )
}
