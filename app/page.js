'use client'

import { useState, useEffect } from 'react'
import Link from 'next/link'
import { Button } from '@/components/ui/button'
import { Card, CardContent } from '@/components/ui/card'
import { Badge } from '@/components/ui/badge'
import { Upload, MapPin, Printer, Clock, DollarSign, Users, Star, ArrowRight, Zap, Shield, TrendingUp, CheckCircle, Sparkles, QrCode } from 'lucide-react'

export default function HomePage() {
  const [isVisible, setIsVisible] = useState(false)

  useEffect(() => {
    setIsVisible(true)
  }, [])

  return (
    <div className="bg-white">
      {/* Hero Section */}
      <section className="relative overflow-hidden bg-gradient-to-br from-blue-50 via-white to-indigo-50 pt-20 pb-28">
        <div className="absolute inset-0 bg-grid-pattern opacity-5"></div>
        <div className="container mx-auto px-4 sm:px-6 lg:px-8 relative z-10">
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-12 items-center">
            {/* Left: Content */}
            <div className={`transition-all duration-1000 ${isVisible ? 'opacity-100 translate-y-0' : 'opacity-0 translate-y-10'}`}>
              <Badge className="mb-6 bg-blue-100 text-blue-700 hover:bg-blue-100 px-4 py-1.5 text-sm font-medium">
                <Sparkles className="h-3 w-3 mr-1.5 inline" />
                Available near campus areas
              </Badge>
              <h1 className="text-5xl md:text-7xl font-bold text-gray-900 mb-6 leading-tight">
                <span className="bg-gradient-to-r from-blue-600 to-indigo-600 bg-clip-text text-transparent">
                  From phone to paper
                </span>
              </h1>
              <p className="text-xl md:text-2xl text-gray-600 mb-4 leading-relaxed">
                Get QR Code → Upload → Print in <span className="font-semibold text-blue-600">60 seconds</span>
              </p>
              <p className="text-lg text-gray-600 mb-8">
                No need to visit a print shop. Print assignments without pen drive.
              </p>
              <div className="flex flex-col sm:flex-row gap-4">
                <Link href="/find-printer">
                  <Button size="lg" className="w-full sm:w-auto text-lg px-8 py-6 bg-blue-600 hover:bg-blue-700 shadow-lg hover:shadow-xl transition-all duration-300 hover:scale-105">
                    <MapPin className="mr-2 h-5 w-5" />
                    Find Nearest Printer
                  </Button>
                </Link>
                <Link href="/partner">
                  <Button size="lg" variant="outline" className="w-full sm:w-auto text-lg px-8 py-6 border-2 border-gray-300 hover:border-blue-600 hover:bg-blue-50 transition-all duration-300">
                    <TrendingUp className="mr-2 h-5 w-5" />
                    Become a Partner
                  </Button>
                </Link>
              </div>
              <div className="mt-10 flex items-center gap-8">
                <div>
                  <p className="text-3xl font-bold text-gray-900">Coming Soon</p>
                  <p className="text-sm text-gray-600">Expanding Nationwide</p>
                </div>
              </div>
            </div>

            {/* Right: Visual Element - Vending Machine Illustration */}
            <div className={`relative transition-all duration-1000 delay-300 ${isVisible ? 'opacity-100 translate-x-0' : 'opacity-0 translate-x-10'}`}>
              <div className="relative">
                {/* Vending Machine Mockup */}
                <div className="bg-gradient-to-br from-blue-500 to-indigo-600 rounded-3xl shadow-2xl p-12 text-white">
                  <div className="text-center mb-8">
                    <Printer className="h-32 w-32 mx-auto mb-6 text-white/90" />
                    <h3 className="text-3xl font-bold mb-2">QuickInk Vending Machine</h3>
                    <p className="text-blue-100 text-lg">Print anytime, anywhere</p>
                  </div>
                  <div className="space-y-4">
                    <div className="bg-white/10 backdrop-blur-sm rounded-xl p-4 flex items-center gap-4">
                      <div className="w-12 h-12 bg-white/20 rounded-lg flex items-center justify-center">
                        <Clock className="h-6 w-6" />
                      </div>
                      <div>
                        <p className="font-semibold text-lg">24/7 Available</p>
                        <p className="text-blue-100 text-sm">Always ready to serve</p>
                      </div>
                    </div>
                    <div className="bg-white/10 backdrop-blur-sm rounded-xl p-4 flex items-center gap-4">
                      <div className="w-12 h-12 bg-white/20 rounded-lg flex items-center justify-center">
                        <Zap className="h-6 w-6" />
                      </div>
                      <div>
                        <p className="font-semibold text-lg">Fast Printing</p>
                        <p className="text-blue-100 text-sm">Ready in 60 seconds</p>
                      </div>
                    </div>
                    <div className="bg-white/10 backdrop-blur-sm rounded-xl p-4 flex items-center gap-4">
                      <div className="w-12 h-12 bg-white/20 rounded-lg flex items-center justify-center">
                        <DollarSign className="h-6 w-6" />
                      </div>
                      <div>
                        <p className="font-semibold text-lg">Affordable</p>
                        <p className="text-blue-100 text-sm">From ৳2 per page</p>
                      </div>
                    </div>
                  </div>
                </div>
                {/* Floating elements */}
                <div className="absolute -top-6 -right-6 w-20 h-20 bg-green-400 rounded-2xl shadow-lg flex items-center justify-center animate-bounce">
                  <CheckCircle className="h-10 w-10 text-white" />
                </div>
                <div className="absolute -bottom-6 -left-6 w-16 h-16 bg-yellow-400 rounded-full shadow-lg flex items-center justify-center">
                  <Zap className="h-8 w-8 text-white" />
                </div>
              </div>
            </div>
          </div>
        </div>
      </section>

      {/* How It Works Section */}
      <section className="py-24 bg-white">
        <div className="container mx-auto px-4 sm:px-6 lg:px-8">
          <div className="text-center mb-16">
            <Badge className="mb-4 bg-blue-100 text-blue-700 hover:bg-blue-100">Simple Process</Badge>
            <h2 className="text-4xl md:text-5xl font-bold text-gray-900 mb-4">How It Works</h2>
            <p className="text-xl text-gray-600 max-w-2xl mx-auto">Fast, simple, and affordable printing in 3 steps</p>
          </div>
          <div className="grid grid-cols-1 md:grid-cols-3 gap-8 max-w-6xl mx-auto relative">
            {/* Connecting line for desktop */}
            <div className="hidden md:block absolute top-20 left-1/4 right-1/4 h-0.5 bg-gradient-to-r from-blue-200 via-blue-400 to-blue-200"></div>
            
            {[{
              step: '01',
              icon: QrCode,
              title: 'Get QR Code',
              description: 'Pay using bKash or card and receive a unique QR code instantly on your phone.',
              color: 'from-blue-500 to-blue-600'
            }, {
              step: '02',
              icon: Upload,
              title: 'Upload Your File',
              description: 'Upload your document from any device. We support PDF, Word, Images, and more.',
              color: 'from-indigo-500 to-indigo-600'
            }, {
              step: '03',
              icon: Printer,
              title: 'Print at Kiosk',
              description: 'Visit any nearby kiosk, scan your code, and collect your prints immediately.',
              color: 'from-purple-500 to-purple-600'
            }].map((item, index) => {
              const Icon = item.icon
              return (
                <Card key={index} className="relative border-none shadow-lg hover:shadow-2xl transition-all duration-500 hover:-translate-y-2 group overflow-hidden">
                  <div className={`absolute top-0 left-0 w-1 h-full bg-gradient-to-b ${item.color}`}></div>
                  <CardContent className="pt-10 pb-8 px-8">
                    <div className="relative mb-6">
                      <div className={`w-16 h-16 bg-gradient-to-br ${item.color} rounded-2xl flex items-center justify-center shadow-lg group-hover:scale-110 transition-transform duration-300`}>
                        <Icon className="h-8 w-8 text-white" />
                      </div>
                      <div className="absolute -top-3 -right-3 w-12 h-12 bg-gray-100 rounded-full flex items-center justify-center font-bold text-gray-400 text-sm">
                        {item.step}
                      </div>
                    </div>
                    <h3 className="text-2xl font-bold mb-3 text-gray-900">{item.title}</h3>
                    <p className="text-gray-600 leading-relaxed">{item.description}</p>
                  </CardContent>
                </Card>
              )
            })}
          </div>
        </div>
      </section>

      {/* Trust & Privacy Section */}
      <section className="py-20 bg-gradient-to-r from-green-50 to-blue-50">
        <div className="container mx-auto px-4 sm:px-6 lg:px-8">
          <div className="max-w-4xl mx-auto">
            <Card className="border-none shadow-xl bg-white">
              <CardContent className="p-10 text-center">
                <div className="w-16 h-16 bg-green-500 rounded-full flex items-center justify-center mx-auto mb-6">
                  <Shield className="h-8 w-8 text-white" />
                </div>
                <h2 className="text-3xl font-bold text-gray-900 mb-4">Safe & Private Printing</h2>
                <p className="text-xl text-gray-600 mb-6">
                  Your files are automatically deleted after printing. We don't store any documents.
                </p>
                <div className="flex items-center justify-center gap-8 flex-wrap">
                  <div className="flex items-center gap-2">
                    <CheckCircle className="h-5 w-5 text-green-500" />
                    <span className="text-gray-700">Auto-delete after print</span>
                  </div>
                  <div className="flex items-center gap-2">
                    <CheckCircle className="h-5 w-5 text-green-500" />
                    <span className="text-gray-700">Secure payment</span>
                  </div>
                  <div className="flex items-center gap-2">
                    <CheckCircle className="h-5 w-5 text-green-500" />
                    <span className="text-gray-700">No file storage</span>
                  </div>
                </div>
              </CardContent>
            </Card>
          </div>
        </div>
      </section>

      {/* Map Preview Section */}
      <section className="py-24 bg-white">
        <div className="container mx-auto px-4 sm:px-6 lg:px-8">
          <div className="max-w-6xl mx-auto">
            <div className="text-center mb-12">
              <Badge className="mb-4 bg-blue-100 text-blue-700 hover:bg-blue-100">
                <MapPin className="h-3 w-3 mr-1 inline" />
                Coming Soon
              </Badge>
              <h2 className="text-4xl md:text-5xl font-bold text-gray-900 mb-4">Printers Available Near You</h2>
              <p className="text-xl text-gray-600">Launching in major cities across Bangladesh</p>
            </div>
            <Link href="/find-printer">
              <Card className="border-none shadow-2xl overflow-hidden group cursor-pointer hover:shadow-3xl transition-all duration-500">
                <div className="relative h-[500px] bg-gradient-to-br from-blue-100 via-white to-indigo-100">
                  {/* Mock Map Interface */}
                  <div className="absolute inset-0 flex items-center justify-center">
                    <div className="text-center">
                      <div className="relative inline-block mb-6">
                        <div className="w-24 h-24 bg-blue-600 rounded-full flex items-center justify-center shadow-2xl group-hover:scale-110 transition-transform duration-500">
                          <MapPin className="h-12 w-12 text-white" />
                        </div>
                        <div className="absolute -top-2 -right-2 w-6 h-6 bg-green-500 rounded-full border-4 border-white animate-pulse"></div>
                      </div>
                      <p className="text-2xl font-bold text-gray-800 mb-2">Find Nearest Kiosk</p>
                      <p className="text-gray-600 mb-6">Click to see printers near you</p>
                      <Button size="lg" className="bg-white text-blue-600 hover:bg-gray-50 shadow-lg group-hover:shadow-xl transition-all duration-300">
                        Open Map
                        <ArrowRight className="ml-2 h-5 w-5 group-hover:translate-x-1 transition-transform" />
                      </Button>
                    </div>
                  </div>
                  {/* Stats overlay - removed fake data */}
                  <div className="absolute bottom-6 left-6 right-6">
                    <div className="bg-white/90 backdrop-blur-sm rounded-2xl p-6 shadow-lg text-center">
                      <p className="text-lg font-semibold text-gray-900">Launching Soon</p>
                      <p className="text-gray-600 mt-1">Check back for updates</p>
                    </div>
                  </div>
                </div>
              </Card>
            </Link>
          </div>
        </div>
      </section>

      {/* Pricing Section */}
      <section className="py-24 bg-gradient-to-br from-gray-50 to-blue-50">
        <div className="container mx-auto px-4 sm:px-6 lg:px-8">
          <div className="text-center mb-16">
            <Badge className="mb-4 bg-green-100 text-green-700 hover:bg-green-100">Student Friendly Pricing</Badge>
            <h2 className="text-4xl md:text-5xl font-bold text-gray-900 mb-4">Affordable Pricing</h2>
            <p className="text-xl text-gray-600">No hidden charges. Pay only for what you print.</p>
          </div>
          <div className="grid grid-cols-1 md:grid-cols-2 gap-8 max-w-4xl mx-auto">
            {[{
              name: 'Black & White',
              price: '৳2',
              unit: 'per page',
              description: 'Perfect for assignments',
              features: ['A4 Size', 'Single/Double sided', 'Standard paper', 'Quick printing'],
              popular: true,
              badge: 'Most Popular'
            }, {
              name: 'Color Print',
              price: '৳10',
              unit: 'per page',
              description: 'For presentations & reports',
              features: ['A4 Size', 'Vibrant colors', 'Premium paper', 'High quality'],
              popular: false
            }].map((plan, index) => (
              <Card key={index} className={`relative overflow-hidden border-2 transition-all duration-300 hover:-translate-y-2 hover:shadow-2xl ${
                plan.popular ? 'border-blue-600 shadow-xl scale-105' : 'border-gray-200 shadow-lg'
              }`}>
                {plan.popular && (
                  <div className="absolute top-0 left-0 right-0 bg-gradient-to-r from-blue-600 to-indigo-600 text-white text-center py-2 text-sm font-semibold">
                    ⭐ {plan.badge}
                  </div>
                )}
                <CardContent className={`p-8 ${plan.popular ? 'pt-16' : 'pt-8'}`}>
                  <h3 className="text-2xl font-bold text-gray-900 mb-2">{plan.name}</h3>
                  <p className="text-gray-600 mb-6">{plan.description}</p>
                  <div className="mb-6">
                    <span className="text-5xl font-bold text-gray-900">{plan.price}</span>
                    <span className="text-gray-600 ml-2">{plan.unit}</span>
                  </div>
                  <ul className="space-y-3 mb-8">
                    {plan.features.map((feature, i) => (
                      <li key={i} className="flex items-center text-gray-700">
                        <CheckCircle className="h-5 w-5 text-green-500 mr-3 flex-shrink-0" />
                        {feature}
                      </li>
                    ))}
                  </ul>
                  <Link href="/find-printer">
                    <Button className={`w-full ${plan.popular ? 'bg-blue-600 hover:bg-blue-700' : ''}`} variant={plan.popular ? 'default' : 'outline'}>
                      Find Printer
                    </Button>
                  </Link>
                </CardContent>
              </Card>
            ))}
          </div>
        </div>
      </section>

      {/* Testimonials Section - Removed */}

      {/* Partner CTA Section */}
      <section className="py-24 bg-gradient-to-r from-blue-600 via-indigo-600 to-purple-600 relative overflow-hidden">
        <div className="absolute inset-0 bg-grid-pattern opacity-10"></div>
        <div className="container mx-auto px-4 sm:px-6 lg:px-8 relative z-10">
          <div className="max-w-4xl mx-auto text-center text-white">
            <Badge className="mb-6 bg-white/20 text-white hover:bg-white/30 backdrop-blur-sm px-4 py-2">
              <TrendingUp className="h-4 w-4 mr-1.5 inline" />
              Partner Program
            </Badge>
            <h2 className="text-4xl md:text-6xl font-bold mb-6">
              Earn Extra Income from Your Shop
            </h2>
            <p className="text-xl md:text-2xl mb-4 text-blue-100">
              Get a QuickInk machine in your shop and earn ৳15,000-৳25,000 monthly
            </p>
            <p className="text-lg mb-12 text-blue-100">
              Free installation. No maintenance cost. We handle everything.
            </p>
            <div className="grid grid-cols-1 md:grid-cols-3 gap-6 mb-12">
              {[{
                icon: DollarSign,
                title: '40% Commission',
                description: 'On every print'
              }, {
                icon: Clock,
                title: 'No Maintenance',
                description: 'Fully automatic'
              }, {
                icon: Shield,
                title: 'Free Setup',
                description: 'We install for free'
              }].map((benefit, index) => {
                const Icon = benefit.icon
                return (
                  <div key={index} className="bg-white/10 backdrop-blur-sm rounded-2xl p-6 hover:bg-white/20 transition-all duration-300">
                    <Icon className="h-12 w-12 mx-auto mb-4" />
                    <p className="font-bold text-lg mb-2">{benefit.title}</p>
                    <p className="text-blue-100">{benefit.description}</p>
                  </div>
                )
              })}
            </div>
            <Link href="/partner">
              <Button size="lg" variant="secondary" className="text-lg px-10 py-7 shadow-2xl hover:scale-105 transition-transform duration-300">
                Become a Partner
                <ArrowRight className="ml-2 h-5 w-5" />
              </Button>
            </Link>
          </div>
        </div>
      </section>

      {/* Mobile Sticky CTA */}
      <div className="md:hidden fixed bottom-0 left-0 right-0 bg-white border-t border-gray-200 p-4 shadow-2xl z-50">
        <Link href="/find-printer">
          <Button size="lg" className="w-full bg-blue-600 hover:bg-blue-700 text-lg py-6">
            <MapPin className="mr-2 h-5 w-5" />
            Find Nearest Printer
          </Button>
        </Link>
      </div>
    </div>
  )
}
