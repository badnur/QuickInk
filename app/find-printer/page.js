'use client'

import { useState, useEffect } from 'react'
import { Button } from '@/components/ui/button'
import { Card, CardContent } from '@/components/ui/card'
import { Input } from '@/components/ui/input'
import { Badge } from '@/components/ui/badge'
import { MapPin, Navigation, Printer, Circle, Search, Clock } from 'lucide-react'

export default function FindPrinterPage() {
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
    <div className="min-h-screen bg-gray-50/50">
      {/* Header Section */}
      <div className="bg-white border-b border-gray-200">
        <div className="container mx-auto px-4 py-10 max-w-5xl">
          <Badge className="mb-3 bg-[#00bf63]/10 text-[#00bf63] hover:bg-[#00bf63]/15 font-semibold border-none px-3 py-1">
            <MapPin className="h-3 w-3 mr-1 inline" />
            500+ Locations
          </Badge>
          <h1 className="text-3xl sm:text-4xl font-extrabold text-gray-900 tracking-tight mb-2">
            Find Nearest Printer
          </h1>
          <p className="text-base text-gray-600 mb-6">
            Smart self-service printing kiosks launching in your neighborhood soon.
          </p>

          <div className="flex flex-col sm:flex-row gap-3">
            <div className="flex-1 relative">
              <Search className="absolute left-3.5 top-1/2 transform -translate-y-1/2 h-4 w-4 text-gray-400" />
              <Input 
                placeholder="Search by area or location..."
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                className="pl-10 h-11 text-sm border-gray-200 focus:border-[#00bf63] focus:ring-1 focus:ring-[#00bf63] rounded-lg"
              />
            </div>
            <Button size="default" className="bg-[#00bf63] hover:bg-[#00a656] text-white font-semibold h-11 px-5 rounded-lg shadow-none transition-colors">
              <Navigation className="mr-2 h-4 w-4" />
              Use My Location
            </Button>
          </div>

          {/* Stats */}
          <div className="flex gap-6 mt-4 pt-4 border-t border-gray-100">
            <div className="flex items-center gap-2">
              <div className="w-2 h-2 bg-[#00bf63] rounded-full"></div>
              <span className="text-xs text-gray-600"><strong className="text-gray-900">{onlineMachines}</strong> kiosks online now</span>
            </div>
            <div className="flex items-center gap-2">
              <Clock className="h-3.5 w-3.5 text-gray-400" />
              <span className="text-xs text-gray-500">Updated live</span>
            </div>
          </div>
        </div>
      </div>

      <div className="container mx-auto px-4 py-8 max-w-5xl">
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
          {/* Map Section */}
          <div className="lg:col-span-2">
            <Card className="border border-gray-200 bg-white rounded-xl overflow-hidden shadow-none h-[580px]">
              <CardContent className="p-0 h-full">
                <div className="relative h-full bg-gray-50">
                  {/* Subtle Grid */}
                  <div className="absolute inset-0 bg-grid-pattern opacity-60"></div>

                  {/* Mock Map Center */}
                  <div className="absolute inset-0 flex items-center justify-center">
                    <div className="text-center p-6 bg-white/90 border border-gray-200 rounded-xl max-w-sm">
                      <div className="w-12 h-12 bg-[#00bf63]/10 text-[#00bf63] rounded-full flex items-center justify-center mx-auto mb-3">
                        <MapPin className="h-6 w-6" />
                      </div>
                      <p className="text-lg font-bold text-gray-900 mb-1">Interactive Map Launching Soon</p>
                      <p className="text-xs text-gray-600 mb-3">Expanding nationwide across universities, metros, and markets</p>
                      <Badge className="bg-gray-100 text-gray-700 hover:bg-gray-100 border border-gray-200 font-medium text-xs">
                        50+ New Stations Next Month
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
                              ? 'bg-[#00bf63] text-white border-white' 
                              : 'bg-gray-400 text-white border-white'
                          } ${
                            selectedMachine?.id === machine.id ? 'ring-2 ring-gray-900' : ''
                          }`}>
                            <Printer className="h-4 w-4" />
                          </div>
                          {selectedMachine?.id === machine.id && (
                            <div className="absolute bottom-full left-1/2 transform -translate-x-1/2 mb-2 w-56 bg-white rounded-lg border border-gray-200 p-3 z-10 shadow-sm">
                              <p className="font-bold text-xs text-gray-900 mb-0.5">{machine.name}</p>
                              <p className="text-[11px] text-gray-500 mb-2 leading-tight">{machine.address}</p>
                              <div className="flex items-center justify-between text-[11px]">
                                <div className="flex items-center gap-1">
                                  <Circle className={`h-1.5 w-1.5 ${
                                    machine.status === 'online' ? 'fill-[#00bf63] text-[#00bf63]' : 'fill-gray-400 text-gray-400'
                                  }`} />
                                  <span className={machine.status === 'online' ? 'text-[#00bf63] font-medium' : 'text-gray-500'}>
                                    {machine.status === 'online' ? 'Online' : 'Offline'}
                                  </span>
                                </div>
                                <span className="text-gray-500">{machine.distance}</span>
                              </div>
                            </div>
                          )}
                        </div>
                      </div>
                    ))}
                  </div>

                  {/* Minimal Map Controls */}
                  <div className="absolute bottom-4 right-4 flex flex-col gap-1.5">
                    <button className="w-8 h-8 rounded-lg bg-white border border-gray-200 text-gray-700 hover:bg-gray-50 flex items-center justify-center text-sm font-bold">
                      +
                    </button>
                    <button className="w-8 h-8 rounded-lg bg-white border border-gray-200 text-gray-700 hover:bg-gray-50 flex items-center justify-center text-sm font-bold">
                      −
                    </button>
                  </div>

                  {/* Map Status Badge */}
                  <div className="absolute top-4 left-4 bg-white border border-gray-200 rounded-lg px-3 py-2">
                    <p className="text-[10px] uppercase tracking-wider text-gray-500 font-semibold">Found</p>
                    <p className="text-lg font-bold text-gray-900 leading-none">{filteredMachines.length}</p>
                  </div>
                </div>
              </CardContent>
            </Card>
          </div>

          {/* Printer List */}
          <div className="lg:col-span-1">
            <Card className="border border-gray-200 bg-white rounded-xl shadow-none sticky top-24">
              <CardContent className="p-5">
                <div className="flex items-center justify-between mb-4 pb-3 border-b border-gray-100">
                  <h2 className="text-base font-bold text-gray-900">Nearby Stations</h2>
                  <Badge className="bg-gray-100 text-gray-700 border border-gray-200 font-semibold text-xs px-2.5 py-0.5">
                    {filteredMachines.length}
                  </Badge>
                </div>
                <div className="space-y-3 max-h-[460px] overflow-y-auto custom-scrollbar">
                  {loading ? (
                    <div className="text-center py-10">
                      <div className="w-8 h-8 border-2 border-[#00bf63] border-t-transparent rounded-full animate-spin mx-auto mb-2"></div>
                      <p className="text-xs text-gray-500">Locating printers...</p>
                    </div>
                  ) : filteredMachines.length > 0 ? (
                    filteredMachines.map((m) => (
                      <div 
                        key={m.id}
                        onClick={() => setSelectedMachine(m)}
                        className={`p-3 rounded-lg border cursor-pointer transition-colors ${
                          selectedMachine?.id === m.id
                            ? 'border-[#00bf63] bg-[#00bf63]/5'
                            : 'border-gray-200 hover:border-gray-300 bg-white'
                        }`}
                      >
                        <div className="flex justify-between items-start mb-1">
                          <h4 className="text-xs font-bold text-gray-900">{m.name}</h4>
                          <span className="text-[10px] text-gray-500 font-medium">{m.distance || '0.5 km'}</span>
                        </div>
                        <p className="text-[11px] text-gray-500 mb-2 leading-tight">{m.address}</p>
                        <div className="flex items-center gap-1.5 text-[10px]">
                          <span className={`inline-block w-1.5 h-1.5 rounded-full ${m.status === 'online' ? 'bg-[#00bf63]' : 'bg-gray-400'}`}></span>
                          <span className={m.status === 'online' ? 'text-[#00bf63] font-medium' : 'text-gray-500'}>
                            {m.status === 'online' ? 'Online' : 'Offline'}
                          </span>
                        </div>
                      </div>
                    ))
                  ) : (
                    <div className="text-center py-10">
                      <MapPin className="h-8 w-8 text-gray-300 mx-auto mb-2" />
                      <p className="text-gray-700 font-semibold text-sm mb-1">Coming Soon</p>
                      <p className="text-gray-500 text-xs">Printing vending machines launching soon in your area</p>
                    </div>
                  )}
                </div>
              </CardContent>
            </Card>
          </div>
        </div>
      </div>

      {/* Mobile Sticky Bottom */}
      <div className="md:hidden fixed bottom-0 left-0 right-0 bg-white border-t border-gray-200 p-3 z-50">
        <Button className="w-full bg-[#00bf63] hover:bg-[#00a656] text-white font-semibold h-11 rounded-lg shadow-none">
          <MapPin className="mr-2 h-4 w-4" />
          {filteredMachines.length} Printers Found
        </Button>
      </div>
    </div>
  )
}
