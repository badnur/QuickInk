'use client'

import { useState, useEffect } from 'react'
import Link from 'next/link'
import { Button } from '@/components/ui/button'
import { Card, CardContent } from '@/components/ui/card'
import { Input } from '@/components/ui/input'
import { Badge } from '@/components/ui/badge'
import { MapPin, Navigation, Printer, Circle, Search, Clock, ArrowRight } from 'lucide-react'
import { useLanguage } from '@/context/LanguageContext'

export default function FindPrinterPage() {
  const { t, lang, toBengaliNumber } = useLanguage()
  const [machines, setMachines] = useState([])
  const [selectedMachine, setSelectedMachine] = useState(null)
  const [loading, setLoading] = useState(true)
  const [searchQuery, setSearchQuery] = useState('')

  useEffect(() => {
    fetchMachines()
  }, [])

  const fetchMachines = async () => {
    try {
      const response = await fetch('/api/machines')
      const data = await response.json()
      setMachines(data.machines || [])
      setLoading(false)
    } catch (error) {
      console.error('Error fetching machines:', error)
      setLoading(false)
    }
  }

  const filteredMachines = machines.filter(machine => 
    machine.name.toLowerCase().includes(searchQuery.toLowerCase()) ||
    machine.address.toLowerCase().includes(searchQuery.toLowerCase())
  )

  const onlineMachines = filteredMachines.filter(m => m.status === 'online').length

  return (
    <div className="min-h-screen bg-gray-50/50 pb-20">
      {/* Header Section */}
      <div className="bg-white border-b border-gray-200">
        <div className="container mx-auto px-4 py-10 max-w-5xl">
          <Badge className="mb-3 bg-[#00bf63]/10 text-[#00bf63] hover:bg-[#00bf63]/15 font-semibold border-none px-3 py-1">
            <MapPin className="h-3 w-3 mr-1 inline" />
            {lang === 'bn' ? `${toBengaliNumber(500)}+ লোকেশন যুক্ত হচ্ছে` : '500+ Locations'}
          </Badge>
          <h1 className="text-3xl sm:text-4xl font-extrabold text-gray-950 tracking-tight mb-2">
            {lang === 'bn' ? 'কাছের প্রিন্ট স্টেশন খুঁজুন' : 'Find Nearest Printer'}
          </h1>
          <p className="text-base text-gray-600 mb-6">
            {lang === 'bn'
              ? 'আপনার ক্যাম্পাস বা এলাকার স্মার্ট সেলফ-সার্ভিস কিয়স্ক ও পার্টনার দোকানসমূহ'
              : 'Smart self-service printing kiosks launching in your neighborhood soon.'}
          </p>

          <div className="flex flex-col sm:flex-row gap-3">
            <div className="flex-1 relative">
              <Search className="absolute left-3.5 top-1/2 transform -translate-y-1/2 h-4 w-4 text-gray-400" />
              <Input 
                placeholder={lang === 'bn' ? 'এলাকা বা ক্যাম্পাস দিয়ে খুঁজুন (যেমন: কার্জন হল, টিএসসি, ধানমন্ডি)...' : 'Search by area or location...'}
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                className="pl-10 h-11 text-sm border-gray-200 focus:border-[#00bf63] focus:ring-1 focus:ring-[#00bf63] rounded-xl"
              />
            </div>
            <Button size="default" className="bg-[#00bf63] hover:bg-[#00a656] text-white font-semibold h-11 px-5 rounded-xl shadow-none transition-colors">
              <Navigation className="mr-2 h-4 w-4" />
              {lang === 'bn' ? 'আমার লোকেশন ব্যবহার করুন' : 'Use My Location'}
            </Button>
          </div>

          {/* Stats */}
          <div className="flex gap-6 mt-4 pt-4 border-t border-gray-100">
            <div className="flex items-center gap-2">
              <div className="w-2 h-2 bg-[#00bf63] rounded-full animate-pulse"></div>
              <span className="text-xs text-gray-600">
                <strong className="text-gray-900">{toBengaliNumber(onlineMachines)}</strong>{' '}
                {lang === 'bn' ? 'টি কিয়স্ক এখন চালু আছে' : 'kiosks online now'}
              </span>
            </div>
            <div className="flex items-center gap-2">
              <Clock className="h-3.5 w-3.5 text-gray-400" />
              <span className="text-xs text-gray-500">
                {lang === 'bn' ? 'লাইভ আপডেট' : 'Updated live'}
              </span>
            </div>
          </div>
        </div>
      </div>

      <div className="container mx-auto px-4 py-8 max-w-5xl">
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
          {/* Map Section */}
          <div className="lg:col-span-2">
            <Card className="border border-gray-200 bg-white rounded-2xl overflow-hidden shadow-none h-[580px]">
              <CardContent className="p-0 h-full">
                <div className="relative h-full bg-gray-50">
                  <div className="absolute inset-0 bg-grid-pattern opacity-60"></div>

                  {/* Mock Map Center */}
                  <div className="absolute inset-0 flex items-center justify-center">
                    <div className="text-center p-6 bg-white/95 border border-gray-200 rounded-2xl max-w-sm shadow-xs backdrop-blur-xs">
                      <div className="w-12 h-12 bg-[#00bf63]/10 text-[#00bf63] rounded-full flex items-center justify-center mx-auto mb-3 font-bold">
                        <MapPin className="h-6 w-6" />
                      </div>
                      <p className="text-lg font-bold text-gray-900 mb-1">
                        {lang === 'bn' ? 'ইন্টারেক্টিভ জিপিএস ম্যাপ' : 'Interactive Map Launching Soon'}
                      </p>
                      <p className="text-xs text-gray-600 mb-3">
                        {lang === 'bn' ? 'সারা দেশের বিশ্ববিদ্যালয় ও মেট্রো স্টেশনসমূহে বিস্তার লাভ করছে' : 'Expanding nationwide across universities, metros, and markets'}
                      </p>
                      <Badge className="bg-emerald-50 text-emerald-800 border border-emerald-200 font-semibold text-xs">
                        {lang === 'bn' ? '৫০+ নতুন স্টেশন আগামী মাসে' : '50+ New Stations Next Month'}
                      </Badge>
                    </div>
                  </div>

                  {/* Mock Markers */}
                  <div className="absolute inset-0 pointer-events-none">
                    {filteredMachines.slice(0, 6).map((machine, index) => (
                      <div 
                        key={machine.id}
                        className="absolute"
                        style={{
                          left: `${22 + (index * 13)}%`,
                          top: `${26 + ((index % 3) * 22)}%`
                        }}
                      >
                        <div className="relative pointer-events-auto cursor-pointer" onClick={() => setSelectedMachine(machine)}>
                          <div className={`w-9 h-9 rounded-full flex items-center justify-center border transition-all ${
                            machine.status === 'online' 
                              ? 'bg-[#00bf63] text-white border-white shadow-sm' 
                              : 'bg-gray-400 text-white border-white'
                          } ${
                            selectedMachine?.id === machine.id ? 'ring-3 ring-emerald-500 scale-110' : ''
                          }`}>
                            <Printer className="h-4 w-4" />
                          </div>
                          {selectedMachine?.id === machine.id && (
                            <div className="absolute bottom-full left-1/2 transform -translate-x-1/2 mb-2 w-60 bg-white rounded-xl border border-gray-200 p-3 z-10 shadow-lg">
                              <p className="font-bold text-xs text-gray-900 mb-0.5">{machine.name}</p>
                              <p className="text-[11px] text-gray-500 mb-2 leading-tight">{machine.address}</p>
                              <div className="flex items-center justify-between text-[11px] mb-2">
                                <div className="flex items-center gap-1">
                                  <Circle className={`h-1.5 w-1.5 ${
                                    machine.status === 'online' ? 'fill-[#00bf63] text-[#00bf63]' : 'fill-gray-400 text-gray-400'
                                  }`} />
                                  <span className={machine.status === 'online' ? 'text-[#00bf63] font-medium' : 'text-gray-500'}>
                                    {machine.status === 'online' ? (lang === 'bn' ? 'সক্রিয়' : 'Online') : (lang === 'bn' ? 'অফলাইন' : 'Offline')}
                                  </span>
                                </div>
                                <span className="text-gray-500 font-mono">{machine.distance || '0.5 km'}</span>
                              </div>
                              <Link href={`/print?device=${machine.id}`}>
                                <Button size="sm" className="w-full bg-[#00bf63] hover:bg-[#00a656] text-white font-bold text-xs h-7 rounded-lg shadow-none">
                                  {lang === 'bn' ? 'এখানে প্রিন্ট করুন' : 'Print Here'} →
                                </Button>
                              </Link>
                            </div>
                          )}
                        </div>
                      </div>
                    ))}
                  </div>

                  {/* Map Status Badge */}
                  <div className="absolute top-4 left-4 bg-white border border-gray-200 rounded-xl px-3 py-2 shadow-xs">
                    <p className="text-[10px] uppercase tracking-wider text-gray-500 font-semibold">{lang === 'bn' ? 'মোট প্রাপ্ত' : 'Found'}</p>
                    <p className="text-lg font-bold text-gray-900 leading-none">{toBengaliNumber(filteredMachines.length)}</p>
                  </div>
                </div>
              </CardContent>
            </Card>
          </div>

          {/* Printer List */}
          <div className="lg:col-span-1">
            <Card className="border border-gray-200 bg-white rounded-2xl shadow-none sticky top-24">
              <CardContent className="p-5">
                <div className="flex items-center justify-between mb-4 pb-3 border-b border-gray-100">
                  <h2 className="text-base font-bold text-gray-900">
                    {lang === 'bn' ? 'কাছের স্টেশনসমূহ' : 'Nearby Stations'}
                  </h2>
                  <Badge className="bg-gray-100 text-gray-700 border border-gray-200 font-semibold text-xs px-2.5 py-0.5">
                    {toBengaliNumber(filteredMachines.length)}
                  </Badge>
                </div>
                <div className="space-y-3 max-h-[460px] overflow-y-auto custom-scrollbar">
                  {loading ? (
                    <div className="text-center py-10">
                      <div className="w-8 h-8 border-2 border-[#00bf63] border-t-transparent rounded-full animate-spin mx-auto mb-2"></div>
                      <p className="text-xs text-gray-500">{lang === 'bn' ? 'প্রিন্টার খোঁজা হচ্ছে...' : 'Locating printers...'}</p>
                    </div>
                  ) : filteredMachines.length > 0 ? (
                    filteredMachines.map((m) => (
                      <div 
                        key={m.id}
                        onClick={() => setSelectedMachine(m)}
                        className={`p-3.5 rounded-xl border cursor-pointer transition-colors ${
                          selectedMachine?.id === m.id
                            ? 'border-[#00bf63] bg-[#00bf63]/5'
                            : 'border-gray-200 hover:border-gray-300 bg-white'
                        }`}
                      >
                        <div className="flex justify-between items-start mb-1">
                          <h4 className="text-xs font-bold text-gray-900">{m.name}</h4>
                          <span className="text-[10px] text-gray-500 font-medium font-mono">{m.distance || '0.5 km'}</span>
                        </div>
                        <p className="text-[11px] text-gray-500 mb-2 leading-tight">{m.address}</p>
                        <div className="flex items-center justify-between text-[10px]">
                          <div className="flex items-center gap-1.5">
                            <span className={`inline-block w-1.5 h-1.5 rounded-full ${m.status === 'online' ? 'bg-[#00bf63]' : 'bg-gray-400'}`}></span>
                            <span className={m.status === 'online' ? 'text-[#00bf63] font-medium' : 'text-gray-500'}>
                              {m.status === 'online' ? (lang === 'bn' ? 'সক্রিয়' : 'Online') : (lang === 'bn' ? 'অফলাইন' : 'Offline')}
                            </span>
                          </div>
                          <Link href={`/print?device=${m.id}`} className="text-[#00bf63] hover:underline font-bold flex items-center gap-0.5">
                            <span>{lang === 'bn' ? 'প্রিন্ট' : 'Print'}</span>
                            <ArrowRight className="w-2.5 h-2.5" />
                          </Link>
                        </div>
                      </div>
                    ))
                  ) : (
                    <div className="text-center py-10">
                      <MapPin className="h-8 w-8 text-gray-300 mx-auto mb-2" />
                      <p className="text-gray-700 font-semibold text-sm mb-1">{lang === 'bn' ? 'শীঘ্রই চালু হচ্ছে' : 'Coming Soon'}</p>
                      <p className="text-gray-500 text-xs">{lang === 'bn' ? 'আপনার এলাকায় নতুন ভেন্ডিং মেশিন যুক্ত হচ্ছে' : 'Printing vending machines launching soon in your area'}</p>
                    </div>
                  )}
                </div>
              </CardContent>
            </Card>
          </div>
        </div>
      </div>
    </div>
  )
}
