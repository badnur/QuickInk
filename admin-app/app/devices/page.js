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
  AlertCircle,
  BarChart3,
  Download,
  Store,
  SlidersHorizontal,
  Settings,
  Ban,
  Unlock,
  ShieldAlert
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
import DevicePerformanceModal from '@/components/admin/DevicePerformanceModal'

export default function AdminDevicesPage() {
  const [devices, setDevices] = useState([])
  const [loading, setLoading] = useState(true)
  const [refreshing, setRefreshing] = useState(false)
  const [isAddModalOpen, setIsAddModalOpen] = useState(false)
  
  // Modals for inspection and control
  const [selectedDeviceForQr, setSelectedDeviceForQr] = useState(null)
  const [selectedDeviceForPerformance, setSelectedDeviceForPerformance] = useState(null)
  const [editingDevice, setEditingDevice] = useState(null)
  const [copiedId, setCopiedId] = useState(null)

  // Partnership cancellation & suspension state
  const [suspendingDevice, setSuspendingDevice] = useState(null)
  const [suspensionReason, setSuspensionReason] = useState('')
  const [suspensionSubmitting, setSuspensionSubmitting] = useState(false)

  // Form state for new device
  const [name, setName] = useState('')
  const [type, setType] = useState('kiosk')
  const [address, setAddress] = useState('')
  const [phone, setPhone] = useState('')
  const [hours, setHours] = useState('24/7 Automated')
  const [formSubmitting, setFormSubmitting] = useState(false)
  const [formError, setFormError] = useState(null)

  // Edit form state
  const [editName, setEditName] = useState('')
  const [editStatus, setEditStatus] = useState('online')
  const [editType, setEditType] = useState('kiosk')
  const [editAddress, setEditAddress] = useState('')
  const [editHours, setEditHours] = useState('')
  const [editPhone, setEditPhone] = useState('')
  const [editSubPlan, setEditSubPlan] = useState('Pro SaaS')
  const [editSubStatus, setEditSubStatus] = useState('active')
  const [editSubmitting, setEditSubmitting] = useState(false)

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

  // Quick toggle status directly on card
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

  // Open edit dialog
  const openEditModal = (device) => {
    setEditingDevice(device)
    setEditName(device.name || '')
    setEditStatus(device.status || 'online')
    setEditType(device.type || 'kiosk')
    const loc = typeof device.location === 'object' ? device.location : {}
    setEditAddress(loc.address || '')
    setEditHours(loc.operating_hours || '')
    setEditPhone(loc.phone || '')
    setEditSubPlan(loc.subscription_plan || 'Pro SaaS')
    setEditSubStatus(loc.subscription_status || 'active')
  }

  // Save device updates
  const handleSaveEdit = async (e) => {
    e.preventDefault()
    if (!editingDevice) return
    setEditSubmitting(true)
    try {
      const updatedLocation = {
        ...(typeof editingDevice.location === 'object' ? editingDevice.location : {}),
        address: editAddress,
        operating_hours: editHours,
        phone: editPhone,
        subscription_plan: editSubPlan,
        subscription_status: editSubStatus,
        payout_rate: 100.0,
      }

      await fetch('/api/admin/devices', {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          id: editingDevice.id,
          name: editName,
          status: editStatus,
          type: editType,
          location: updatedLocation,
        }),
      })

      setEditingDevice(null)
      fetchDevices()
    } catch (err) {
      alert('Save error: ' + err.message)
    } finally {
      setEditSubmitting(false)
    }
  }

  const handleDeleteDevice = async (id) => {
    if (!confirm('Are you sure you want to decommission this station from the fleet?')) return
    try {
      await fetch(`/api/admin/devices?id=${id}`, { method: 'DELETE' })
      fetchDevices()
    } catch (err) {
      console.error('Delete error:', err)
    }
  }

  // Partnership cancellation / suspension
  const handleConfirmSuspension = async () => {
    if (!suspendingDevice) return
    setSuspensionSubmitting(true)
    try {
      const loc = typeof suspendingDevice.location === 'object' ? suspendingDevice.location : {}
      const updatedLocation = {
        ...loc,
        suspension_reason: suspensionReason.trim() || 'Partnership suspended by administration due to policy compliance review.',
        suspended_at: new Date().toISOString(),
      }

      const res = await fetch('/api/admin/devices', {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          id: suspendingDevice.id,
          status: 'suspended',
          location: updatedLocation,
        }),
      })

      if (!res.ok) {
        const errData = await res.json()
        throw new Error(errData.error || 'Failed to suspend')
      }

      setSuspendingDevice(null)
      setSuspensionReason('')
      fetchDevices()
    } catch (err) {
      alert('Suspension failed: ' + err.message)
    } finally {
      setSuspensionSubmitting(false)
    }
  }

  // Reinstate partnership & reactivate desktop
  const handleReinstatePartnership = async (device) => {
    if (!confirm(`Reinstate PrintKoro partnership for "${device.name}"? This will immediately reactivate their desktop app terminal.`)) return
    try {
      const loc = typeof device.location === 'object' ? device.location : {}
      const updatedLocation = {
        ...loc,
        suspension_reason: null,
        reinstated_at: new Date().toISOString(),
      }

      const res = await fetch('/api/admin/devices', {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          id: device.id,
          status: 'online',
          location: updatedLocation,
        }),
      })

      if (!res.ok) {
        const errData = await res.json()
        throw new Error(errData.error || 'Failed to reinstate')
      }

      fetchDevices()
    } catch (err) {
      alert('Reinstatement failed: ' + err.message)
    }
  }

  const handleCopy = (id) => {
    navigator.clipboard.writeText(id)
    setCopiedId(id)
    setTimeout(() => setCopiedId(null), 2000)
  }

  const handleDownloadConfig = (device) => {
    const configObj = {
      deviceId: device.id,
      apiBaseUrl: 'http://localhost:3000',
      deviceName: device.name,
      deviceType: device.type,
      isKiosk: device.type === 'kiosk',
    }
    const blob = new Blob([JSON.stringify(configObj, null, 2)], { type: 'application/json' })
    const url = URL.createObjectURL(blob)
    const a = document.createElement('a')
    a.href = url
    a.download = `quickink-config-${device.id.slice(0, 8)}.json`
    a.click()
  }

  return (
    <div className="flex-1 flex flex-col min-h-screen bg-[#090d16]">
      <AdminHeader
        title="Fleet Control & Station Performance"
        subtitle="Manage hardware terminals, watch real-time print performance, generate station QR codes, and configure desktop POS pairings"
        onRefresh={fetchDevices}
        isRefreshing={refreshing}
      />

      <main className="p-4 sm:p-6 lg:p-8 space-y-6 max-w-7xl mx-auto w-full">
        {/* Top Fleet Summary Bar */}
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 bg-[#0d131f] border border-slate-800 p-4 rounded-2xl">
          <div className="flex items-center gap-6">
            <div>
              <span className="text-xs font-semibold text-slate-400">Active Fleet:</span>
              <span className="text-base font-black text-white ml-2">{devices.length} Stations</span>
            </div>
            <div className="hidden sm:flex items-center gap-4 text-xs text-slate-400 border-l border-slate-800 pl-6">
              <span className="flex items-center gap-1.5">
                <span className="w-2 h-2 rounded-full bg-[#00bf63]"></span>
                {devices.filter((d) => d.status === 'online').length} Online
              </span>
              <span className="flex items-center gap-1.5">
                <span className="w-2 h-2 rounded-full bg-purple-400"></span>
                {devices.filter((d) => d.type === 'kiosk').length} Kiosks
              </span>
              <span className="flex items-center gap-1.5">
                <span className="w-2 h-2 rounded-full bg-blue-400"></span>
                {devices.filter((d) => d.type === 'shop').length} Shops
              </span>
            </div>
          </div>

          <Button
            onClick={() => setIsAddModalOpen(true)}
            className="bg-[#00bf63] hover:bg-[#00a656] text-slate-950 font-bold text-xs h-9 px-4 rounded-xl shadow-lg shadow-[#00bf63]/20 flex items-center gap-1.5 self-start sm:self-auto"
          >
            <Plus className="w-4 h-4" /> Provision New Station
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
                  {/* Top Row: Type & Status Control */}
                  <div className="flex items-center justify-between mb-3">
                    <span
                      className={`inline-flex items-center gap-1 text-[10px] font-bold px-2 py-0.5 rounded uppercase tracking-wider ${
                        isKiosk
                          ? 'bg-purple-500/15 text-purple-400 border border-purple-500/30'
                          : 'bg-blue-500/15 text-blue-400 border border-blue-500/30'
                      }`}
                    >
                      {isKiosk ? <HardDrive className="w-2.5 h-2.5" /> : <Store className="w-2.5 h-2.5" />}
                      {device.type}
                    </span>

                    <button
                      onClick={() => handleToggleStatus(device)}
                      className={`inline-flex items-center gap-1.5 px-2.5 py-0.5 rounded-full text-[10px] font-bold border transition-colors ${
                        isOnline
                          ? 'bg-emerald-500/10 text-[#00bf63] border-emerald-500/30 hover:bg-emerald-500/20'
                          : 'bg-red-500/10 text-red-400 border-red-500/30 hover:bg-red-500/20'
                      }`}
                      title="Click to toggle station status"
                    >
                      <span className={`w-1.5 h-1.5 rounded-full ${isOnline ? 'bg-[#00bf63]' : 'bg-red-400'}`} />
                      {device.status.toUpperCase()}
                    </button>
                  </div>

                  {/* Device Name */}
                  <div className="flex items-start justify-between gap-2 mb-2">
                    <h3 className="font-extrabold text-white text-sm tracking-tight truncate">
                      {device.name}
                    </h3>
                    <button
                      onClick={() => openEditModal(device)}
                      className="text-slate-500 hover:text-slate-300 p-1"
                      title="Edit Station Configuration"
                    >
                      <Settings className="w-3.5 h-3.5" />
                    </button>
                  </div>

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

                  {/* SaaS Subscription Info */}
                  <div className="bg-emerald-950/20 border border-emerald-800/30 rounded-xl p-2.5 mb-3 flex items-center justify-between text-xs">
                    <div>
                      <div className="text-[10px] text-slate-400 font-semibold uppercase tracking-wider">SaaS Subscription</div>
                      <div className="font-bold text-emerald-400 text-xs mt-0.5">{loc.subscription_plan || 'Pro SaaS'} · 100% Retained</div>
                    </div>
                    <span className={`text-[10px] font-bold px-2 py-0.5 rounded uppercase ${
                      (loc.subscription_status || 'active') === 'active'
                        ? 'bg-emerald-500/20 text-emerald-300 border border-emerald-500/40'
                        : 'bg-amber-500/20 text-amber-300 border border-amber-500/40'
                    }`}>
                      {loc.subscription_status || 'active'}
                    </span>
                  </div>

                  {/* Desktop Pairing Key Box */}
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

                  {/* Partnership Suspended Alert Banner */}
                  {(device.status === 'suspended' || device.status === 'cancelled') && (
                    <div className="bg-red-500/10 border border-red-500/30 rounded-xl p-2.5 mb-4 text-xs">
                      <div className="flex items-center gap-1 font-bold text-red-400 text-[11px] mb-1">
                        <Ban className="w-3.5 h-3.5" />
                        PARTNERSHIP REVOKED / SUSPENDED
                      </div>
                      <p className="text-slate-300 text-[11px] leading-snug">
                        Reason: <span className="text-red-300 font-medium">{loc.suspension_reason || 'Administrative suspension'}</span>
                      </p>
                      {loc.suspended_at && (
                        <div className="text-[10px] text-slate-500 mt-1">
                          Date: {new Date(loc.suspended_at).toLocaleString()}
                        </div>
                      )}
                    </div>
                  )}
                </div>

                {/* Card Actions & Performance Trigger */}
                <div className="pt-3 border-t border-slate-800/80 space-y-2">
                  <div className="grid grid-cols-2 gap-2">
                    {/* Watch Performance Button */}
                    <Button
                      size="sm"
                      onClick={() => setSelectedDeviceForPerformance(device)}
                      className="bg-[#00bf63]/15 hover:bg-[#00bf63]/25 text-[#00bf63] border border-[#00bf63]/30 text-xs h-8 rounded-xl font-bold flex items-center justify-center gap-1.5 shadow-none"
                    >
                      <BarChart3 className="w-3.5 h-3.5" /> Performance
                    </Button>

                    {/* Station QR Code */}
                    <Button
                      size="sm"
                      variant="outline"
                      onClick={() => setSelectedDeviceForQr(device)}
                      className="border-slate-800 bg-slate-900 text-slate-300 hover:text-white text-xs h-8 rounded-xl flex items-center justify-center gap-1.5"
                    >
                      <QrCode className="w-3.5 h-3.5 text-slate-400" /> Station QR
                    </Button>
                  </div>

                  {/* Partnership Cancellation / Reinstatement Button */}
                  {device.status === 'suspended' || device.status === 'cancelled' ? (
                    <Button
                      size="sm"
                      onClick={() => handleReinstatePartnership(device)}
                      className="w-full bg-emerald-600 hover:bg-emerald-500 text-white font-bold text-xs h-8 rounded-xl flex items-center justify-center gap-1.5 shadow-none"
                    >
                      <Unlock className="w-3.5 h-3.5" /> Reinstate Partnership (Unlock Desktop)
                    </Button>
                  ) : (
                    <Button
                      size="sm"
                      variant="outline"
                      onClick={() => {
                        setSuspendingDevice(device)
                        setSuspensionReason('Violation of partner operating guidelines or non-compliance.')
                      }}
                      className="w-full border-red-500/30 bg-red-500/5 text-red-400 hover:bg-red-500/15 hover:text-red-300 text-xs h-8 rounded-xl flex items-center justify-center gap-1.5"
                    >
                      <Ban className="w-3.5 h-3.5" /> Cancel Partnership / Lock Desktop
                    </Button>
                  )}

                  {/* Secondary Controls row */}
                  <div className="flex items-center justify-between pt-1">
                    <button
                      onClick={() => handleDownloadConfig(device)}
                      className="text-[11px] text-slate-400 hover:text-white flex items-center gap-1"
                      title="Download quickink-config JSON for desktop app"
                    >
                      <Download className="w-3 h-3 text-slate-500" /> POS Config
                    </button>

                    <button
                      onClick={() => handleDeleteDevice(device.id)}
                      className="text-[11px] text-slate-500 hover:text-red-400 flex items-center gap-1"
                      title="Decommission Station"
                    >
                      <Trash2 className="w-3 h-3" /> Decommission
                    </button>
                  </div>
                </div>
              </div>
            )
          })}
        </div>
      </main>

      {/* Watch Performance Modal */}
      {selectedDeviceForPerformance && (
        <DevicePerformanceModal
          device={selectedDeviceForPerformance}
          isOpen={Boolean(selectedDeviceForPerformance)}
          onClose={() => setSelectedDeviceForPerformance(null)}
        />
      )}

      {/* Station QR Modal */}
      {selectedDeviceForQr && (
        <DeviceQrModal
          device={selectedDeviceForQr}
          isOpen={Boolean(selectedDeviceForQr)}
          onClose={() => setSelectedDeviceForQr(null)}
        />
      )}

      {/* Edit Station Modal */}
      {editingDevice && (
        <Dialog open={Boolean(editingDevice)} onOpenChange={() => setEditingDevice(null)}>
          <DialogContent className="bg-[#0d131f] border border-slate-800 text-white max-w-md p-6 rounded-2xl shadow-2xl">
            <DialogHeader>
              <DialogTitle className="text-base font-bold text-white">Configure Hardware Station</DialogTitle>
              <DialogDescription className="text-xs text-slate-400">
                Update station parameters, status, and partner commission share.
              </DialogDescription>
            </DialogHeader>

            <form onSubmit={handleSaveEdit} className="space-y-3.5 my-2">
              <div>
                <label className="text-xs font-bold text-slate-300 block mb-1">Station Name</label>
                <Input
                  value={editName}
                  onChange={(e) => setEditName(e.target.value)}
                  className="text-xs bg-slate-900 border-slate-800 text-white h-9 rounded-xl focus-visible:border-[#00bf63]"
                  required
                />
              </div>

              <div className="grid grid-cols-2 gap-2">
                <div>
                  <label className="text-xs font-bold text-slate-300 block mb-1">Hardware Modality</label>
                  <select
                    value={editType}
                    onChange={(e) => setEditType(e.target.value)}
                    className="w-full text-xs h-9 bg-slate-900 border border-slate-800 rounded-xl text-white px-2.5 outline-none"
                  >
                    <option value="kiosk">Automated Kiosk</option>
                    <option value="shop">Partner Shop</option>
                  </select>
                </div>

                <div>
                  <label className="text-xs font-bold text-slate-300 block mb-1">Station Status</label>
                  <select
                    value={editStatus}
                    onChange={(e) => setEditStatus(e.target.value)}
                    className="w-full text-xs h-9 bg-slate-900 border border-slate-800 rounded-xl text-white px-2.5 outline-none"
                  >
                    <option value="online">Online & Ready</option>
                    <option value="offline">Offline</option>
                    <option value="maintenance">Maintenance</option>
                  </select>
                </div>
              </div>

              <div>
                <label className="text-xs font-bold text-slate-300 block mb-1">Address / Location</label>
                <Input
                  value={editAddress}
                  onChange={(e) => setEditAddress(e.target.value)}
                  className="text-xs bg-slate-900 border-slate-800 text-white h-9 rounded-xl"
                  required
                />
              </div>

              <div className="grid grid-cols-2 gap-2">
                <div>
                  <label className="text-xs font-bold text-slate-300 block mb-1">Operating Hours</label>
                  <Input
                    value={editHours}
                    onChange={(e) => setEditHours(e.target.value)}
                    className="text-xs bg-slate-900 border-slate-800 text-white h-9 rounded-xl"
                  />
                </div>
                <div>
                  <label className="text-xs font-bold text-slate-300 block mb-1">SaaS Plan (100% Payout)</label>
                  <select
                    value={editSubPlan}
                    onChange={(e) => setEditSubPlan(e.target.value)}
                    className="w-full text-xs h-9 bg-slate-900 border border-slate-800 rounded-xl text-white px-2.5 outline-none"
                  >
                    <option value="Pro SaaS">Pro SaaS (100% Retained)</option>
                    <option value="Standard SaaS">Standard SaaS</option>
                    <option value="Trial">14-Day Free Trial</option>
                  </select>
                </div>
              </div>

              <div className="grid grid-cols-2 gap-2">
                <div>
                  <label className="text-xs font-bold text-slate-300 block mb-1">Contact Phone</label>
                  <Input
                    value={editPhone}
                    onChange={(e) => setEditPhone(e.target.value)}
                    className="text-xs bg-slate-900 border-slate-800 text-white h-9 rounded-xl"
                  />
                </div>
                <div>
                  <label className="text-xs font-bold text-slate-300 block mb-1">Subscription Status</label>
                  <select
                    value={editSubStatus}
                    onChange={(e) => setEditSubStatus(e.target.value)}
                    className="w-full text-xs h-9 bg-slate-900 border border-slate-800 rounded-xl text-white px-2.5 outline-none"
                  >
                    <option value="active">Active (Full Access)</option>
                    <option value="trialing">Trial Period</option>
                    <option value="past_due">Past Due (Unpaid)</option>
                    <option value="canceled">Canceled</option>
                  </select>
                </div>
              </div>

              <div className="pt-2 flex justify-end gap-2">
                <Button
                  type="button"
                  variant="outline"
                  onClick={() => setEditingDevice(null)}
                  className="border-slate-800 text-slate-400 text-xs h-9 rounded-xl"
                >
                  Cancel
                </Button>
                <Button
                  type="submit"
                  disabled={editSubmitting}
                  className="bg-[#00bf63] hover:bg-[#00a656] text-slate-950 font-bold text-xs h-9 px-4 rounded-xl"
                >
                  {editSubmitting ? 'Saving...' : 'Save Changes'}
                </Button>
              </div>
            </form>
          </DialogContent>
        </Dialog>
      )}

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
                placeholder="e.g. PrintKoro Kiosk - Central Mall L1"
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
              <label className="text-xs font-bold text-slate-300 block mb-1">Physical Address</label>
              <Input
                placeholder="e.g. Level 1, Food Court, Central Mall, Dhanmondi"
                value={address}
                onChange={(e) => setAddress(e.target.value)}
                className="text-xs bg-slate-900 border-slate-800 text-white h-9 rounded-xl focus-visible:border-[#00bf63]"
                required
              />
            </div>

            <div className="grid grid-cols-2 gap-2">
              <div>
                <label className="text-xs font-bold text-slate-300 block mb-1">Contact Phone</label>
                <Input
                  placeholder="e.g. 01712-345678"
                  value={phone}
                  onChange={(e) => setPhone(e.target.value)}
                  className="text-xs bg-slate-900 border-slate-800 text-white h-9 rounded-xl focus-visible:border-[#00bf63]"
                />
              </div>
              <div>
                <label className="text-xs font-bold text-slate-300 block mb-1">Operating Hours</label>
                <Input
                  placeholder="e.g. 24/7 Automated"
                  value={hours}
                  onChange={(e) => setHours(e.target.value)}
                  className="text-xs bg-slate-900 border-slate-800 text-white h-9 rounded-xl focus-visible:border-[#00bf63]"
                />
              </div>
            </div>

            <Button
              type="submit"
              disabled={formSubmitting}
              className="w-full bg-[#00bf63] hover:bg-[#00a656] text-slate-950 font-bold text-xs h-10 rounded-xl mt-2"
            >
              {formSubmitting ? 'Registering Station...' : 'Create Station & Generate QR'}
            </Button>
          </form>
        </DialogContent>
      </Dialog>

      {/* Partnership Cancellation & Suspension Dialog */}
      {suspendingDevice && (
        <Dialog open={Boolean(suspendingDevice)} onOpenChange={() => setSuspendingDevice(null)}>
          <DialogContent className="bg-[#0d131f] border border-red-500/30 text-white max-w-md p-6 rounded-2xl shadow-2xl">
            <DialogHeader>
              <div className="w-10 h-10 rounded-full bg-red-500/15 border border-red-500/30 flex items-center justify-center text-red-400 mb-2">
                <Ban className="w-5 h-5" />
              </div>
              <DialogTitle className="text-base font-bold text-white">Cancel Partnership & Lock Desktop</DialogTitle>
              <DialogDescription className="text-xs text-slate-400">
                Revoking this partnership immediately halts this station. The shop owner will be locked out of the PrintKoro desktop app, and print job redemptions will be rejected.
              </DialogDescription>
            </DialogHeader>

            <div className="space-y-3.5 my-2">
              <div className="bg-slate-900 border border-slate-800 rounded-xl p-3 text-xs space-y-1">
                <div className="text-slate-400">Target Terminal:</div>
                <div className="font-bold text-white">{suspendingDevice.name}</div>
                <div className="font-mono text-[10px] text-slate-500">{suspendingDevice.id}</div>
              </div>

              <div>
                <label className="text-xs font-bold text-slate-300 block mb-1.5">
                  Reason for Partnership Cancellation *
                </label>
                <textarea
                  value={suspensionReason}
                  onChange={(e) => setSuspensionReason(e.target.value)}
                  rows={3}
                  className="w-full text-xs bg-slate-900 border border-slate-800 rounded-xl text-white p-3 focus:border-red-500 outline-none resize-none"
                  placeholder="e.g. Non-compliance with partner terms, fraudulent prints, unpaid fees..."
                  required
                />
                <span className="text-[10px] text-slate-500 block mt-1">
                  ⚠️ This explanation will be displayed directly on the shop owner's desktop screen.
                </span>
              </div>
            </div>

            <div className="flex items-center justify-end gap-2 pt-2 border-t border-slate-800">
              <Button
                type="button"
                variant="outline"
                onClick={() => setSuspendingDevice(null)}
                className="border-slate-800 text-slate-400 hover:text-white text-xs h-9 rounded-xl"
              >
                Cancel
              </Button>
              <Button
                type="button"
                onClick={handleConfirmSuspension}
                disabled={suspensionSubmitting || !suspensionReason.trim()}
                className="bg-red-600 hover:bg-red-500 text-white font-bold text-xs h-9 rounded-xl shadow-lg shadow-red-600/20"
              >
                {suspensionSubmitting ? 'Locking Station...' : 'Confirm Cancellation & Lock'}
              </Button>
            </div>
          </DialogContent>
        </Dialog>
      )}
    </div>
  )
}
