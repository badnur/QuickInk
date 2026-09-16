'use client'

import { useState, useEffect } from 'react'
import {
  HardDrive,
  Plus,
  QrCode,
  Copy,
  Check,
  MapPin,
  Clock,
  Phone,
  Radio,
  Trash2,
  Edit2,
  RefreshCw,
  ExternalLink,
  ShieldCheck,
  AlertCircle
} from 'lucide-react'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Badge } from '@/components/ui/badge'
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
} from '@/components/ui/dialog'
import AdminHeader from '@/components/admin/AdminHeader'
import DeviceQrModal from '@/components/admin/DeviceQrModal'

export default function AdminDevicesPage() {
  const [devices, setDevices] = useState([])
  const [loading, setLoading] = useState(true)
  const [refreshing, setRefreshing] = useState(false)
  const [isAddModalOpen, setIsAddModalOpen] = useState(false)
  const [selectedDeviceForQr, setSelectedDeviceForQr] = useState(null)
  const [copiedId, setCopiedId] = useState(null)

  // Form state for new device
  const [name, setName] = useState('')
  const [type, setType] = useState('kiosk')
  const [address, setAddress] = useState('')
  const [phone, setPhone] = useState('')
  const [hours, setHours] = useState('24/7 Automated')
  const [formSubmitting, setFormSubmitting] = useState(false)
  const [formError, setFormError] = useState(null)

  const fetchDevices = async () => {
    setRefreshing(true)
    try {
      const res = await fetch('/api/admin/devices')
      const data = await res.json()
      if (data?.devices) {
        setDevices(data.devices)
      }
    } catch (err) {
      console.error('Error fetching devices:', err)
    } finally {
      setLoading(false)
      setRefreshing(false)
    }
  }

  useEffect(() => {
    fetchDevices()
  }, [])

  const handleCreateDevice = async (e) => {
    e.preventDefault()
    setFormError(null)
    setFormSubmitting(true)

    try {
      const res = await fetch('/api/admin/devices', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          name,
          type,
          address,
          phone,
          operating_hours: hours,
        }),
      })
      const data = await res.json()
      if (!res.ok) throw new Error(data.error || 'Failed to create device')

      setIsAddModalOpen(false)
      setName('')
      setAddress('')
      setPhone('')
      setHours('24/7 Automated')
      fetchDevices()
    } catch (err) {
      setFormError(err.message)
    } finally {
      setFormSubmitting(false)
    }
  }

  const handleToggleStatus = async (device) => {
    const nextStatus = device.status === 'online' ? 'offline' : 'online'
    try {
      await fetch('/api/admin/devices', {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ id: device.id, status: nextStatus }),
      })
      fetchDevices()
    } catch (err) {
      console.error('Toggle status error:', err)
    }
  }

  const handleDeleteDevice = async (id) => {
    if (!confirm('Are you sure you want to decommission this device?')) return
    try {
      await fetch(`/api/admin/devices?id=${id}`, { method: 'DELETE' })
      fetchDevices()
    } catch (err) {
      console.error('Delete error:', err)
    }
  }

  const handleCopy = (id) => {
    navigator.clipboard.writeText(id)
    setCopiedId(id)
    setTimeout(() => setCopiedId(null), 2000)
  }

  return (
    <div className="flex-1 flex flex-col min-h-screen bg-[#090d16]">
      <AdminHeader
        title="Devices & Kiosk Fleet"
        subtitle="Manage hardware terminals, generate station QR codes, and configure desktop POS pairings"
        onRefresh={fetchDevices}
        isRefreshing={refreshing}
      />

      <main className="p-4 sm:p-6 lg:p-8 space-y-6 max-w-7xl mx-auto w-full">
        {/* Top Action Bar */}
        <div className="flex items-center justify-between">
          <div>
            <span className="text-xs font-bold text-slate-400">Total Registered Fleet:</span>
            <span className="text-base font-black text-white ml-2">{devices.length} Stations</span>
          </div>

          <Button
            onClick={() => setIsAddModalOpen(true)}
            className="bg-[#00bf63] hover:bg-[#00a656] text-slate-950 font-bold text-xs h-9 px-4 rounded-xl shadow-lg shadow-[#00bf63]/20 flex items-center gap-1.5"
          >
            <Plus className="w-4 h-4" /> Add New Station / Kiosk
          </Button>
        </div>

        {/* Devices Grid */}
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4 sm:gap-5">
          {devices.map((device) => {
            const isOnline = device.status === 'online'
            const isKiosk = device.type === 'kiosk'
            const loc = typeof device.location === 'object' ? device.location : {}

            return (
              <div
                key={device.id}
                className="bg-[#0d131f] border border-slate-800 rounded-2xl p-5 shadow-xl hover:border-slate-700 transition-all flex flex-col justify-between"
              >
                <div>
                  {/* Top Row: Type & Status */}
                  <div className="flex items-center justify-between mb-3">
                    <span
                      className={`text-[10px] font-bold px-2 py-0.5 rounded uppercase tracking-wider ${
                        isKiosk ? 'bg-purple-500/15 text-purple-400 border border-purple-500/30' : 'bg-blue-500/15 text-blue-400 border border-blue-500/30'
                      }`}
                    >
                      {device.type}
                    </span>

                    <button
                      onClick={() => handleToggleStatus(device)}
                      className={`inline-flex items-center gap-1.5 px-2 py-0.5 rounded-full text-[10px] font-bold border transition-colors ${
                        isOnline
                          ? 'bg-emerald-500/10 text-[#00bf63] border-emerald-500/30 hover:bg-emerald-500/20'
                          : 'bg-red-500/10 text-red-400 border-red-500/30 hover:bg-red-500/20'
                      }`}
                    >
                      <span className={`w-1.5 h-1.5 rounded-full ${isOnline ? 'bg-[#00bf63]' : 'bg-red-400'}`} />
                      {isOnline ? 'ONLINE' : 'OFFLINE'}
                    </button>
                  </div>

                  {/* Device Name */}
                  <h3 className="font-extrabold text-white text-sm tracking-tight mb-2 truncate">
                    {device.name}
                  </h3>

                  {/* Location & Details */}
                  <div className="space-y-1.5 text-xs text-slate-400 mb-4">
                    <div className="flex items-start gap-2">
                      <MapPin className="w-3.5 h-3.5 text-slate-500 flex-shrink-0 mt-0.5" />
                      <span className="line-clamp-2 text-[11px]">{loc.address || 'Address not configured'}</span>
                    </div>

                    {loc.operating_hours && (
                      <div className="flex items-center gap-2 text-[11px]">
                        <Clock className="w-3.5 h-3.5 text-slate-500 flex-shrink-0" />
                        <span>{loc.operating_hours}</span>
                      </div>
                    )}

                    {loc.phone && (
                      <div className="flex items-center gap-2 text-[11px]">
                        <Phone className="w-3.5 h-3.5 text-slate-500 flex-shrink-0" />
                        <span>{loc.phone}</span>
                      </div>
                    )}
                  </div>

                  {/* Pairing Key Box */}
                  <div className="bg-slate-900/90 border border-slate-800 rounded-xl p-2.5 mb-4">
                    <div className="flex items-center justify-between text-[10px] text-slate-500 mb-1">
                      <span>Desktop POS Pair UUID:</span>
                      <button
                        onClick={() => handleCopy(device.id)}
                        className="text-[#00bf63] hover:underline flex items-center gap-0.5 font-bold"
                      >
                        {copiedId === device.id ? <Check className="w-3 h-3 text-emerald-400" /> : <Copy className="w-3 h-3" />}
                        {copiedId === device.id ? 'Copied' : 'Copy'}
                      </button>
                    </div>
                    <div className="font-mono text-[11px] text-slate-300 truncate">
                      {device.id}
                    </div>
                  </div>
                </div>

                {/* Card Actions */}
                <div className="flex items-center justify-between pt-3 border-t border-slate-800/80">
                  <Button
                    size="sm"
                    variant="outline"
                    onClick={() => setSelectedDeviceForQr(device)}
                    className="border-slate-800 bg-slate-900 text-slate-300 hover:text-white text-xs h-8 rounded-xl flex items-center gap-1.5"
                  >
                    <QrCode className="w-3.5 h-3.5 text-[#00bf63]" /> Station QR
                  </Button>

                  <div className="flex items-center gap-1">
                    <Button
                      size="sm"
                      variant="ghost"
                      onClick={() => handleDeleteDevice(device.id)}
                      className="h-8 w-8 p-0 text-slate-500 hover:text-red-400 hover:bg-red-500/10 rounded-lg"
                      title="Decommission Station"
                    >
                      <Trash2 className="w-3.5 h-3.5" />
                    </Button>
                  </div>
                </div>
              </div>
            )
          })}
        </div>
      </main>

      {/* Add New Device Modal */}
      <Dialog open={isAddModalOpen} onOpenChange={setIsAddModalOpen}>
        <DialogContent className="bg-[#0d131f] border border-slate-800 text-white max-w-md p-6 rounded-2xl shadow-2xl">
          <DialogHeader>
            <DialogTitle className="text-lg font-bold text-white">Register Hardware Station</DialogTitle>
            <DialogDescription className="text-xs text-slate-400">
              Add a new automated Kiosk terminal or partner shop printer counter.
            </DialogDescription>
          </DialogHeader>

          {formError && (
            <div className="p-3 rounded-xl bg-red-500/10 border border-red-500/20 text-red-400 text-xs">
              {formError}
            </div>
          )}

          <form onSubmit={handleCreateDevice} className="space-y-3.5 my-2">
            <div>
              <label className="text-xs font-bold text-slate-300 block mb-1">Station Name</label>
              <Input
                placeholder="e.g. QuickInk Kiosk - Central Mall L1"
                value={name}
                onChange={(e) => setName(e.target.value)}
                className="text-xs bg-slate-900 border-slate-800 text-white h-9 rounded-xl focus-visible:border-[#00bf63]"
                required
              />
            </div>

            <div>
              <label className="text-xs font-bold text-slate-300 block mb-1">Device Modality</label>
              <div className="grid grid-cols-2 gap-2">
                <button
                  type="button"
                  onClick={() => setType('kiosk')}
                  className={`py-2 text-xs font-bold rounded-xl border transition-all ${
                    type === 'kiosk'
                      ? 'bg-[#00bf63] text-slate-950 border-[#00bf63]'
                      : 'bg-slate-900 text-slate-400 border-slate-800'
                  }`}
                >
                  Automated Kiosk
                </button>
                <button
                  type="button"
                  onClick={() => setType('shop')}
                  className={`py-2 text-xs font-bold rounded-xl border transition-all ${
                    type === 'shop'
                      ? 'bg-[#00bf63] text-slate-950 border-[#00bf63]'
                      : 'bg-slate-900 text-slate-400 border-slate-800'
                  }`}
                >
                  Partner Print Shop
                </button>
              </div>
            </div>

            <div>
              <label className="text-xs font-bold text-slate-300 block mb-1">Physical Location Address</label>
              <Input
                placeholder="House, Road, Area, Dhaka"
                value={address}
                onChange={(e) => setAddress(e.target.value)}
                className="text-xs bg-slate-900 border-slate-800 text-white h-9 rounded-xl focus-visible:border-[#00bf63]"
                required
              />
            </div>

            <div className="grid grid-cols-2 gap-2">
              <div>
                <label className="text-xs font-bold text-slate-300 block mb-1">Operating Hours</label>
                <Input
                  placeholder="24/7 or 09am-10pm"
                  value={hours}
                  onChange={(e) => setHours(e.target.value)}
                  className="text-xs bg-slate-900 border-slate-800 text-white h-9 rounded-xl"
                />
              </div>
              <div>
                <label className="text-xs font-bold text-slate-300 block mb-1">Operator Phone</label>
                <Input
                  placeholder="+880 1700-000000"
                  value={phone}
                  onChange={(e) => setPhone(e.target.value)}
                  className="text-xs bg-slate-900 border-slate-800 text-white h-9 rounded-xl"
                />
              </div>
            </div>

            <div className="flex items-center justify-end gap-2 pt-3">
              <Button
                type="button"
                variant="outline"
                onClick={() => setIsAddModalOpen(false)}
                className="border-slate-800 bg-slate-900 text-slate-300 h-9 rounded-xl text-xs"
              >
                Cancel
              </Button>
              <Button
                type="submit"
                disabled={formSubmitting}
                className="bg-[#00bf63] hover:bg-[#00a656] text-slate-950 font-bold h-9 rounded-xl text-xs shadow-none"
              >
                {formSubmitting ? 'Registering...' : 'Save Station'}
              </Button>
            </div>
          </form>
        </DialogContent>
      </Dialog>

      {/* Station QR Code Modal */}
      {selectedDeviceForQr && (
        <DeviceQrModal
          isOpen={Boolean(selectedDeviceForQr)}
          onClose={() => setSelectedDeviceForQr(null)}
          device={selectedDeviceForQr}
        />
      )}
    </div>
  )
}
