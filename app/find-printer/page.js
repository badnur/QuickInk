'use client'

import { useState, useEffect } from 'react'
import { Button } from '@/components/ui/button'
import { Card, CardContent } from '@/components/ui/card'
import { Input } from '@/components/ui/input'
import { Badge } from '@/components/ui/badge'
import { MapPin, Navigation, Printer, Circle, Search, Clock, CheckCircle } from 'lucide-react'

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
    <div className="min-h-screen bg-gradient-to-br from-gray-50 to-blue-50">
      {/* Header Section */}
      <div className="bg-white border-b shadow-sm">
        <div className="container mx-auto px-4 py-8">
          <div className="max-w-4xl mx-auto">
            <Badge className="mb-4 bg-blue-100 text-blue-700 hover:bg-blue-100">
              <MapPin className="h-3 w-3 mr-1 inline" />
              500+ Locations
            </Badge>
            <h1 className="text-4xl md:text-5xl font-bold text-gray-900 mb-4">
              Find Nearest Printer
            </h1>
            <p className="text-xl text-gray-600 mb-8">
              Locate QuickInk kiosks near you and check if they're online
            </p>
            <div className="flex flex-col sm:flex-row gap-4">
              <div className="flex-1 relative">
                <Search className="absolute left-4 top-1/2 transform -translate-y-1/2 h-5 w-5 text-gray-400" />
                <Input 
                  placeholder="Search by area or location..."
                  value={searchQuery}
                  onChange={(e) => setSearchQuery(e.target.value)}
                  className="pl-12 h-14 text-lg border-2 focus:border-blue-500 rounded-xl"
                />
              </div>
              <Button size="lg" className="bg-blue-600 hover:bg-blue-700 h-14 px-8 shadow-lg hover:shadow-xl transition-all duration-300">
                <Navigation className="mr-2 h-5 w-5" />
                Use My Location
              </Button>
            </div>
            {/* Stats */}
            <div className="flex gap-6 mt-6">
              <div className="flex items-center gap-2">
                <div className="w-3 h-3 bg-green-500 rounded-full animate-pulse"></div>
                <span className="text-sm text-gray-600"><strong>{onlineMachines}</strong> printers online now</span>
              </div>
              <div className="flex items-center gap-2">
                <Clock className="h-4 w-4 text-gray-400" />
                <span className="text-sm text-gray-600">Updated just now</span>
              </div>
            </div>
          </div>
        </div>
      </div>

      <div className="container mx-auto px-4 py-8">
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
          {/* Map Section */}
          <div className="lg:col-span-2">
            <Card className="shadow-2xl border-none h-[700px] overflow-hidden group">
              <CardContent className="p-0 h-full">
                <div className="relative h-full bg-gradient-to-br from-blue-100 via-white to-indigo-100">
                  {/* Mock Map */}
                  <div className="absolute inset-0 flex items-center justify-center">
                    <div className="text-center">
                      <div className="w-32 h-32 bg-gradient-to-br from-blue-600 to-indigo-600 rounded-full flex items-center justify-center mx-auto mb-6 shadow-2xl animate-pulse">
                        <MapPin className="h-16 w-16 text-white" />
                      </div>
                      <p className="text-2xl font-bold text-gray-800 mb-2">Find Kiosk Near You</p>
                      <p className="text-gray-600 mb-4">{filteredMachines.length} printers found nearby</p>
                      <Badge className="bg-green-100 text-green-700 hover:bg-green-100">
                        {onlineMachines} Online Now
                      </Badge>
                    </div>
                  </div>

                  {/* Mock Markers */}
                  <div className="absolute inset-0 pointer-events-none">
                    {filteredMachines.slice(0, 6).map((machine, index) => (
                      <div 
                        key={machine.id}
                        className="absolute animate-in fade-in zoom-in"
                        style={{
                          left: `${25 + (index * 12)}%`,
                          top: `${30 + ((index % 3) * 18)}%`,
                          animationDelay: `${index * 100}ms`
                        }}
                      >
                        <div className="relative pointer-events-auto cursor-pointer" onClick={() => setSelectedMachine(machine)}>
                          <div className={`w-12 h-12 rounded-full flex items-center justify-center shadow-2xl transform transition-all duration-300 hover:scale-125 ${
                            machine.status === 'online' 
                              ? 'bg-gradient-to-br from-green-400 to-green-600' 
                              : 'bg-gradient-to-br from-red-400 to-red-600'
                          } ${
                            selectedMachine?.id === machine.id ? 'scale-125 ring-4 ring-white' : ''
                          }`}>
                            <Printer className="h-6 w-6 text-white" />
                          </div>
                          {machine.status === 'online' && (
                            <div className="absolute -top-1 -right-1 w-4 h-4 bg-green-400 rounded-full border-2 border-white animate-ping"></div>
                          )}
                          {selectedMachine?.id === machine.id && (
                            <div className="absolute bottom-full left-1/2 transform -translate-x-1/2 mb-4 w-64 bg-white rounded-2xl shadow-2xl p-4 z-10 animate-in slide-in-from-bottom">
                              <p className="font-bold text-base mb-1">{machine.name}</p>
                              <p className="text-xs text-gray-600 mb-3">{machine.address}</p>
                              <div className="flex items-center justify-between text-xs">
                                <div className="flex items-center">
                                  <Circle className={`h-2 w-2 mr-1 ${
                                    machine.status === 'online' ? 'fill-green-500 text-green-500' : 'fill-red-500 text-red-500'
                                  }`} />
                                  <span className={machine.status === 'online' ? 'text-green-600 font-medium' : 'text-red-600'}>
                                    {machine.status === 'online' ? 'Online' : 'Offline'}
                                  </span>
                                </div>
                                <span className="text-gray-600 font-medium">{machine.distance}</span>
                              </div>
                            </div>
                          )}
                        </div>
                      </div>
                    ))}
                  </div>

                  {/* Map Controls */}
                  <div className="absolute bottom-6 right-6 flex flex-col gap-2">
                    <Button size="sm" className="shadow-2xl w-12 h-12 rounded-xl bg-white text-gray-700 hover:bg-gray-50">
                      <span className="text-xl">+</span>
                    </Button>
                    <Button size="sm" className="shadow-2xl w-12 h-12 rounded-xl bg-white text-gray-700 hover:bg-gray-50">
                      <span className="text-xl">−</span>
                    </Button>
                  </div>

                  {/* Map Stats */}
                  <div className="absolute top-6 left-6 bg-white/90 backdrop-blur-sm rounded-2xl p-4 shadow-lg">
                    <p className="text-sm text-gray-600 mb-1">Found</p>
                    <p className="text-2xl font-bold text-gray-900">{filteredMachines.length}</p>
                    <p className="text-xs text-gray-600">Printers</p>
                  </div>
                </div>
              </CardContent>
            </Card>
          </div>

          {/* Printer List */}
          <div className="lg:col-span-1">
            <Card className="shadow-2xl border-none sticky top-28">
              <CardContent className="p-6">
                <div className="flex items-center justify-between mb-6">
                  <h2 className="text-2xl font-bold text-gray-900">Nearby Printers</h2>
                  <Badge className="bg-blue-100 text-blue-700 hover:bg-blue-100 text-lg px-3 py-1">
                    {filteredMachines.length}
                  </Badge>
                </div>
                <div className="space-y-4 max-h-[600px] overflow-y-auto custom-scrollbar">
                  {loading ? (
                    <div className="text-center py-12">
                      <div className="w-12 h-12 border-4 border-blue-600 border-t-transparent rounded-full animate-spin mx-auto mb-4"></div>
                      <p className="text-gray-500">Loading printers...</p>
                    </div>
                  ) : filteredMachines.length === 0 ? (
                    <div className="text-center py-12">
                      <MapPin className="h-16 w-16 text-gray-300 mx-auto mb-4" />
                      <p className="text-gray-500 font-medium">No printers found</p>
                      <p className="text-gray-400 text-sm mt-2">Try different location</p>
                    </div>
                  ) : (
                    filteredMachines.map((machine) => (
                      <Card 
                        key={machine.id} 
                        className={`cursor-pointer transition-all duration-300 border-2 ${
                          selectedMachine?.id === machine.id 
                            ? 'border-blue-500 shadow-lg scale-105' 
                            : 'border-transparent hover:border-blue-200 hover:shadow-md'
                        }`}
                        onClick={() => setSelectedMachine(machine)}
                      >
                        <CardContent className="p-5">
                          <div className="flex items-start justify-between mb-3">
                            <div className="flex-1">
                              <h3 className="font-bold text-lg text-gray-900 mb-1">{machine.name}</h3>
                              <p className="text-sm text-gray-600 leading-relaxed">{machine.address}</p>
                            </div>
                          </div>
                          <div className="flex items-center justify-between">
                            <div className="flex items-center gap-3">
                              <Badge className={`${
                                machine.status === 'online' 
                                  ? 'bg-green-100 text-green-700 hover:bg-green-100' 
                                  : 'bg-red-100 text-red-700 hover:bg-red-100'
                              }`}>
                                <Circle className={`h-2 w-2 mr-1 ${
                                  machine.status === 'online' ? 'fill-green-500 text-green-500' : 'fill-red-500 text-red-500'
                                }`} />
                                {machine.status === 'online' ? 'Online' : 'Offline'}
                              </Badge>
                              {machine.paper_available && (
                                <Badge className="bg-blue-100 text-blue-700 hover:bg-blue-100">
                                  <CheckCircle className="h-3 w-3 mr-1" />
                                  Paper OK
                                </Badge>
                              )}
                            </div>
                          </div>
                          <div className="mt-3 pt-3 border-t flex items-center justify-between">
                            <span className="text-sm text-gray-600 flex items-center">
                              <MapPin className="h-3.5 w-3.5 mr-1 text-blue-600" />
                              {machine.distance}
                            </span>
                            {selectedMachine?.id === machine.id && (
                              <Button size="sm" className="bg-blue-600 hover:bg-blue-700">
                                Get Directions
                              </Button>
                            )}
                          </div>
                        </CardContent>
                      </Card>
                    ))
                  )}
                </div>
              </CardContent>
            </Card>
          </div>
        </div>
      </div>

      {/* Mobile Sticky Bottom */}
      <div className="md:hidden fixed bottom-0 left-0 right-0 bg-white border-t-2 border-gray-200 p-4 shadow-2xl z-50">
        <Button className="w-full bg-blue-600 hover:bg-blue-700 h-14">
          <MapPin className="mr-2 h-5 w-5" />
          {filteredMachines.length} Printers Found
        </Button>
      </div>
    </div>
  )
}
