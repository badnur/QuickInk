'use client'

import { useState, useEffect } from 'react'
import { Button } from '@/components/ui/button'
import { Card, CardContent } from '@/components/ui/card'
import { Input } from '@/components/ui/input'
import { MapPin, Navigation, Printer, Circle, Search } from 'lucide-react'

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

  return (
    <div className="min-h-screen bg-gray-50">
      {/* Header */}
      <div className="bg-white border-b">
        <div className="container mx-auto px-4 py-6">
          <h1 className="text-3xl font-bold mb-4">Find a Printer Near You</h1>
          <div className="flex gap-4 max-w-2xl">
            <div className="flex-1 relative">
              <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 h-5 w-5 text-gray-400" />
              <Input 
                placeholder="Search by location or name..."
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                className="pl-10"
              />
            </div>
            <Button>
              <Navigation className="mr-2 h-4 w-4" />
              Use My Location
            </Button>
          </div>
        </div>
      </div>

      <div className="container mx-auto px-4 py-8">
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
          {/* Map Section */}
          <div className="lg:col-span-2">
            <Card className="shadow-lg h-[600px]">
              <CardContent className="p-0 h-full">
                <div className="relative h-full bg-gradient-to-br from-blue-50 to-gray-100 rounded-lg overflow-hidden">
                  {/* Mock Map */}
                  <div className="absolute inset-0 flex items-center justify-center">
                    <div className="text-center">
                      <MapPin className="h-20 w-20 text-blue-600 mx-auto mb-4" />
                      <p className="text-xl font-semibold text-gray-700">Interactive Map View</p>
                      <p className="text-gray-500 mt-2">Showing {filteredMachines.length} printers nearby</p>
                    </div>
                  </div>

                  {/* Mock Markers */}
                  <div className="absolute inset-0 pointer-events-none">
                    {filteredMachines.slice(0, 5).map((machine, index) => (
                      <div 
                        key={machine.id}
                        className="absolute"
                        style={{
                          left: `${30 + index * 12}%`,
                          top: `${40 + (index % 2) * 20}%`
                        }}
                      >
                        <div className="relative pointer-events-auto cursor-pointer" onClick={() => setSelectedMachine(machine)}>
                          <div className={`w-8 h-8 rounded-full flex items-center justify-center shadow-lg transform transition-transform hover:scale-110 ${
                            machine.status === 'online' ? 'bg-green-500' : 'bg-red-500'
                          }`}>
                            <Printer className="h-4 w-4 text-white" />
                          </div>
                          {selectedMachine?.id === machine.id && (
                            <div className="absolute bottom-full left-1/2 transform -translate-x-1/2 mb-2 w-48 bg-white rounded-lg shadow-xl p-3 z-10">
                              <p className="font-semibold text-sm">{machine.name}</p>
                              <p className="text-xs text-gray-600 mt-1">{machine.address}</p>
                              <div className="flex items-center mt-2 text-xs">
                                <Circle className={`h-2 w-2 mr-1 ${
                                  machine.status === 'online' ? 'fill-green-500 text-green-500' : 'fill-red-500 text-red-500'
                                }`} />
                                <span>{machine.status === 'online' ? 'Online' : 'Offline'}</span>
                              </div>
                            </div>
                          )}
                        </div>
                      </div>
                    ))}
                  </div>

                  {/* Map Controls */}
                  <div className="absolute bottom-4 right-4 flex flex-col gap-2">
                    <Button size="sm" variant="secondary" className="shadow-lg">
                      +
                    </Button>
                    <Button size="sm" variant="secondary" className="shadow-lg">
                      −
                    </Button>
                  </div>
                </div>
              </CardContent>
            </Card>
          </div>

          {/* Printer List */}
          <div className="lg:col-span-1">
            <Card className="shadow-lg">
              <CardContent className="p-4">
                <h2 className="text-xl font-bold mb-4">Nearby Printers ({filteredMachines.length})</h2>
                <div className="space-y-4 max-h-[540px] overflow-y-auto">
                  {loading ? (
                    <p className="text-center text-gray-500 py-8">Loading printers...</p>
                  ) : filteredMachines.length === 0 ? (
                    <p className="text-center text-gray-500 py-8">No printers found</p>
                  ) : (
                    filteredMachines.map((machine) => (
                      <Card 
                        key={machine.id} 
                        className={`cursor-pointer transition-all hover:shadow-md ${
                          selectedMachine?.id === machine.id ? 'border-blue-500 border-2' : ''
                        }`}
                        onClick={() => setSelectedMachine(machine)}
                      >
                        <CardContent className="p-4">
                          <div className="flex items-start justify-between">
                            <div className="flex-1">
                              <h3 className="font-semibold text-lg">{machine.name}</h3>
                              <p className="text-sm text-gray-600 mt-1">{machine.address}</p>
                              <div className="flex items-center gap-4 mt-3">
                                <div className="flex items-center text-sm">
                                  <Circle className={`h-2 w-2 mr-1 ${
                                    machine.status === 'online' ? 'fill-green-500 text-green-500' : 'fill-red-500 text-red-500'
                                  }`} />
                                  <span className="text-gray-700">{machine.status === 'online' ? 'Online' : 'Offline'}</span>
                                </div>
                                <div className="text-sm text-gray-600">
                                  <MapPin className="h-3 w-3 inline mr-1" />
                                  {machine.distance}
                                </div>
                              </div>
                              {machine.paper_available && (
                                <div className="mt-2 text-xs text-green-600 bg-green-50 px-2 py-1 rounded inline-block">
                                  Paper Available
                                </div>
                              )}
                            </div>
                          </div>
                          {selectedMachine?.id === machine.id && (
                            <div className="mt-4 pt-4 border-t">
                              <Button className="w-full" size="sm">
                                Get Directions
                              </Button>
                            </div>
                          )}
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
    </div>
  )
}
