'use client'

import { useState } from 'react'
import Link from 'next/link'
import { Button } from '@/components/ui/button'
import { Card, CardContent } from '@/components/ui/card'
import { Upload, MapPin, Printer, Clock, DollarSign, Users, Star, ArrowRight } from 'lucide-react'

export default function HomePage() {
  return (
    <div className="bg-background">
      {/* Hero Section */}
      <section className="relative bg-gradient-to-br from-blue-50 to-white py-20 md:py-32">
        <div className="container mx-auto px-4 sm:px-6 lg:px-8">
          <div className="max-w-4xl mx-auto text-center">
            <h1 className="text-4xl md:text-6xl font-bold text-gray-900 mb-6">
              Print Anything, Anytime — <span className="text-blue-600">Near You</span>
            </h1>
            <p className="text-xl md:text-2xl text-gray-600 mb-8">
              Upload → Pay → Print in 60 seconds
            </p>
            <div className="flex flex-col sm:flex-row gap-4 justify-center">
              <Link href="/find-printer">
                <Button size="lg" className="w-full sm:w-auto text-lg px-8 py-6">
                  <MapPin className="mr-2 h-5 w-5" />
                  Find Printer
                </Button>
              </Link>
              <Link href="/partner">
                <Button size="lg" variant="outline" className="w-full sm:w-auto text-lg px-8 py-6">
                  <Users className="mr-2 h-5 w-5" />
                  Become a Partner
                </Button>
              </Link>
            </div>
          </div>
        </div>
      </section>

      {/* How It Works */}
      <section className="py-20 bg-white">
        <div className="container mx-auto px-4 sm:px-6 lg:px-8">
          <h2 className="text-3xl md:text-4xl font-bold text-center mb-12">How It Works</h2>
          <div className="grid grid-cols-1 md:grid-cols-3 gap-8 max-w-5xl mx-auto">
            <Card className="border-none shadow-lg hover:shadow-xl transition-shadow">
              <CardContent className="pt-8 text-center">
                <div className="w-16 h-16 bg-blue-100 rounded-full flex items-center justify-center mx-auto mb-4">
                  <Upload className="h-8 w-8 text-blue-600" />
                </div>
                <h3 className="text-xl font-semibold mb-3">1. Upload Your File</h3>
                <p className="text-gray-600">Select your document from any device. We support PDF, Word, Images, and more.</p>
              </CardContent>
            </Card>
            
            <Card className="border-none shadow-lg hover:shadow-xl transition-shadow">
              <CardContent className="pt-8 text-center">
                <div className="w-16 h-16 bg-blue-100 rounded-full flex items-center justify-center mx-auto mb-4">
                  <DollarSign className="h-8 w-8 text-blue-600" />
                </div>
                <h3 className="text-xl font-semibold mb-3">2. Pay Securely</h3>
                <p className="text-gray-600">Quick checkout with card, UPI, or wallet. Get instant confirmation.</p>
              </CardContent>
            </Card>
            
            <Card className="border-none shadow-lg hover:shadow-xl transition-shadow">
              <CardContent className="pt-8 text-center">
                <div className="w-16 h-16 bg-blue-100 rounded-full flex items-center justify-center mx-auto mb-4">
                  <Printer className="h-8 w-8 text-blue-600" />
                </div>
                <h3 className="text-xl font-semibold mb-3">3. Print Instantly</h3>
                <p className="text-gray-600">Visit the nearest kiosk, enter your code, and collect your prints.</p>
              </CardContent>
            </Card>
          </div>
        </div>
      </section>

      {/* Map Preview */}
      <section className="py-20 bg-gray-50">
        <div className="container mx-auto px-4 sm:px-6 lg:px-8">
          <div className="text-center mb-12">
            <h2 className="text-3xl md:text-4xl font-bold mb-4">Find Printers Near You</h2>
            <p className="text-xl text-gray-600">Over 500+ kiosks across the city</p>
          </div>
          <div className="max-w-4xl mx-auto">
            <Link href="/find-printer">
              <div className="relative bg-white rounded-2xl shadow-xl overflow-hidden h-96 cursor-pointer group hover:shadow-2xl transition-shadow">
                <div className="absolute inset-0 bg-gradient-to-br from-blue-100 to-blue-50 flex items-center justify-center">
                  <div className="text-center">
                    <MapPin className="h-16 w-16 text-blue-600 mx-auto mb-4" />
                    <p className="text-xl font-semibold text-gray-700">Click to view interactive map</p>
                    <p className="text-gray-500 mt-2">Find the closest QuickInk kiosk</p>
                  </div>
                </div>
                <div className="absolute bottom-4 right-4">
                  <Button size="lg" className="group-hover:scale-105 transition-transform">
                    Open Map <ArrowRight className="ml-2 h-5 w-5" />
                  </Button>
                </div>
              </div>
            </Link>
          </div>
        </div>
      </section>

      {/* Pricing */}
      <section className="py-20 bg-white">
        <div className="container mx-auto px-4 sm:px-6 lg:px-8">
          <h2 className="text-3xl md:text-4xl font-bold text-center mb-12">Simple, Transparent Pricing</h2>
          <div className="max-w-4xl mx-auto">
            <Card className="shadow-xl">
              <CardContent className="p-8">
                <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                  <div className="flex justify-between items-center py-4 border-b">
                    <div>
                      <p className="font-semibold text-lg">Black & White</p>
                      <p className="text-sm text-gray-500">Standard quality</p>
                    </div>
                    <p className="text-2xl font-bold text-blue-600">₹2/page</p>
                  </div>
                  <div className="flex justify-between items-center py-4 border-b">
                    <div>
                      <p className="font-semibold text-lg">Color Print</p>
                      <p className="text-sm text-gray-500">High quality</p>
                    </div>
                    <p className="text-2xl font-bold text-blue-600">₹8/page</p>
                  </div>
                  <div className="flex justify-between items-center py-4 border-b">
                    <div>
                      <p className="font-semibold text-lg">Photo Print</p>
                      <p className="text-sm text-gray-500">Premium glossy</p>
                    </div>
                    <p className="text-2xl font-bold text-blue-600">₹15/page</p>
                  </div>
                  <div className="flex justify-between items-center py-4 border-b">
                    <div>
                      <p className="font-semibold text-lg">Scanning</p>
                      <p className="text-sm text-gray-500">High resolution</p>
                    </div>
                    <p className="text-2xl font-bold text-blue-600">₹5/page</p>
                  </div>
                </div>
                <div className="mt-6 text-center">
                  <p className="text-gray-600">No hidden fees • Pay only for what you print</p>
                </div>
              </CardContent>
            </Card>
          </div>
        </div>
      </section>

      {/* Testimonials */}
      <section className="py-20 bg-gray-50">
        <div className="container mx-auto px-4 sm:px-6 lg:px-8">
          <h2 className="text-3xl md:text-4xl font-bold text-center mb-12">What Our Users Say</h2>
          <div className="grid grid-cols-1 md:grid-cols-3 gap-8 max-w-6xl mx-auto">
            <Card className="border-none shadow-lg">
              <CardContent className="pt-6">
                <div className="flex mb-4">
                  {[1,2,3,4,5].map(i => <Star key={i} className="h-5 w-5 fill-yellow-400 text-yellow-400" />)}
                </div>
                <p className="text-gray-700 mb-4">"Super convenient! Found a printer near my college and got my assignment printed in minutes. No more searching for cyber cafes."</p>
                <div className="flex items-center">
                  <div className="w-10 h-10 bg-blue-100 rounded-full flex items-center justify-center mr-3">
                    <span className="text-blue-600 font-semibold">RP</span>
                  </div>
                  <div>
                    <p className="font-semibold">Rahul Patel</p>
                    <p className="text-sm text-gray-500">Student</p>
                  </div>
                </div>
              </CardContent>
            </Card>

            <Card className="border-none shadow-lg">
              <CardContent className="pt-6">
                <div className="flex mb-4">
                  {[1,2,3,4,5].map(i => <Star key={i} className="h-5 w-5 fill-yellow-400 text-yellow-400" />)}
                </div>
                <p className="text-gray-700 mb-4">"As a freelancer, I need quick prints for client meetings. QuickInk saved me so many times. Great quality and fast service!"</p>
                <div className="flex items-center">
                  <div className="w-10 h-10 bg-blue-100 rounded-full flex items-center justify-center mr-3">
                    <span className="text-blue-600 font-semibold">PS</span>
                  </div>
                  <div>
                    <p className="font-semibold">Priya Sharma</p>
                    <p className="text-sm text-gray-500">Freelancer</p>
                  </div>
                </div>
              </CardContent>
            </Card>

            <Card className="border-none shadow-lg">
              <CardContent className="pt-6">
                <div className="flex mb-4">
                  {[1,2,3,4,5].map(i => <Star key={i} className="h-5 w-5 fill-yellow-400 text-yellow-400" />)}
                </div>
                <p className="text-gray-700 mb-4">"I installed a QuickInk kiosk in my shop. It's been a great passive income source and customers love the convenience!"</p>
                <div className="flex items-center">
                  <div className="w-10 h-10 bg-blue-100 rounded-full flex items-center justify-center mr-3">
                    <span className="text-blue-600 font-semibold">AK</span>
                  </div>
                  <div>
                    <p className="font-semibold">Amit Kumar</p>
                    <p className="text-sm text-gray-500">Shop Owner</p>
                  </div>
                </div>
              </CardContent>
            </Card>
          </div>
        </div>
      </section>

      {/* CTA Banner */}
      <section className="py-20 bg-gradient-to-r from-blue-600 to-blue-700">
        <div className="container mx-auto px-4 sm:px-6 lg:px-8 text-center">
          <h2 className="text-3xl md:text-4xl font-bold text-white mb-6">
            Ready to Print Smarter?
          </h2>
          <p className="text-xl text-blue-100 mb-8 max-w-2xl mx-auto">
            Join thousands of users who trust QuickInk for their printing needs
          </p>
          <Link href="/find-printer">
            <Button size="lg" variant="secondary" className="text-lg px-8 py-6">
              Find Nearest Printer <ArrowRight className="ml-2 h-5 w-5" />
            </Button>
          </Link>
        </div>
      </section>
    </div>
  )
}
