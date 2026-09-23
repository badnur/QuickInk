'use client'

import { useState, useEffect } from 'react'
import {
  Users,
  Search,
  CheckCircle2,
  XCircle,
  Phone,
  MapPin,
  Building,
  RefreshCw,
  Plus,
  ArrowRight,
  ShieldCheck,
  Store,
  HardDrive,
  Eye,
  Download,
  Clock,
  Printer,
  FileCheck,
  AlertCircle
} from 'lucide-react'
import { Button } from '@/components/ui/button'
import { Badge } from '@/components/ui/badge'
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
} from '@/components/ui/dialog'
import AdminHeader from '@/components/admin/AdminHeader'

export default function AdminPartnersPage() {
  const [partners, setPartners] = useState([])
  const [loading, setLoading] = useState(true)
  const [refreshing, setRefreshing] = useState(false)
  const [actionLoading, setActionLoading] = useState(null)
  
  // Filters
  const [filterStatus, setFilterStatus] = useState('all') // 'all' | 'pending' | 'approved' | 'rejected'
  const [filterType, setFilterType] = useState('all')     // 'all' | 'shop' | 'kiosk'
  const [searchQuery, setSearchQuery] = useState('')

  // Selected for full detail modal
  const [selectedPartner, setSelectedPartner] = useState(null)
  const [provisionResult, setProvisionResult] = useState(null)

  // Rejection modal
  const [rejectingPartner, setRejectingPartner] = useState(null)
  const [rejectionReason, setRejectionReason] = useState('')

  const fetchPartners = async () => {
    setRefreshing(true)
    try {
      const res = await fetch('/api/admin/partners')
      const data = await res.json()
      if (data?.partners) {
        setPartners(data.partners)
      }
    } catch (err) {
      console.error('Error fetching partners:', err)
    } finally {
      setLoading(false)
      setRefreshing(false)
    }
  }

  useEffect(() => {
    fetchPartners()
  }, [])

  // Approve and Provision Station in devices table
  const handleApproveAndProvision = async (partner) => {
    setActionLoading(partner.id)
    try {
      const res = await fetch('/api/admin/partners', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ partnerId: partner.id }),
      })
      const data = await res.json()
      if (!res.ok) throw new Error(data.error || 'Failed to approve')

      setProvisionResult(data)
      fetchPartners()
    } catch (err) {
      alert('Approval Error: ' + err.message)
    } finally {
      setActionLoading(null)
    }
  }

  // Reject Application
  const handleConfirmReject = async () => {
    if (!rejectingPartner) return
    setActionLoading(rejectingPartner.id)
    try {
      const res = await fetch('/api/admin/partners', {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          id: rejectingPartner.id,
          status: 'rejected',
          rejection_reason: rejectionReason || 'Location requirements not met',
        }),
      })
      if (res.ok) {
        setRejectingPartner(null)
        setRejectionReason('')
        fetchPartners()
      }
    } catch (err) {
      console.error('Reject error:', err)
    } finally {
      setActionLoading(null)
    }
  }

  // Filtered list
  const filteredPartners = partners.filter((p) => {
    if (filterStatus !== 'all' && p.status !== filterStatus) return false
    if (filterType !== 'all' && p.type !== filterType) return false
    if (searchQuery.trim()) {
      const q = searchQuery.toLowerCase()
      return (
        p.shop_name?.toLowerCase().includes(q) ||
        p.name?.toLowerCase().includes(q) ||
        p.phone?.includes(q) ||
        p.reference_id?.toLowerCase().includes(q) ||
        p.location?.toLowerCase().includes(q)
      )
    }
    return true
  })

  return (
    <div className="flex-1 flex flex-col min-h-screen bg-[#090d16]">
      <AdminHeader
        title="Shop & Kiosk Registration Center"
        subtitle="Review prospective partner print shops and host venues, approve applications, and auto-provision stations"
        onRefresh={fetchPartners}
        isRefreshing={refreshing}
      />

      <main className="p-4 sm:p-6 lg:p-8 space-y-6 max-w-7xl mx-auto w-full">
        {/* KPI Summary Strip */}
        <div className="grid grid-cols-2 sm:grid-cols-4 gap-3.5">
          <div className="bg-[#0d131f] border border-slate-800 rounded-2xl p-4 shadow-lg">
            <div className="text-xs text-slate-400 font-semibold uppercase tracking-wider">Total Applications</div>
            <div className="text-2xl font-black text-white mt-1">{partners.length}</div>
            <div className="text-[11px] text-slate-500 mt-0.5">Shops and Kiosks</div>
          </div>

          <div className="bg-[#0d131f] border border-amber-900/40 bg-amber-950/10 rounded-2xl p-4 shadow-lg">
            <div className="text-xs text-amber-400 font-semibold uppercase tracking-wider">Pending Review</div>
            <div className="text-2xl font-black text-amber-300 mt-1">
              {partners.filter((p) => p.status === 'pending').length}
            </div>
            <div className="text-[11px] text-amber-400/80 mt-0.5">Awaiting admin verification</div>
          </div>

          <div className="bg-[#0d131f] border border-emerald-900/40 bg-emerald-950/10 rounded-2xl p-4 shadow-lg">
            <div className="text-xs text-emerald-400 font-semibold uppercase tracking-wider">Approved & Active</div>
            <div className="text-2xl font-black text-[#00bf63] mt-1">
              {partners.filter((p) => p.status === 'approved' || p.status === 'onboarded').length}
            </div>
            <div className="text-[11px] text-emerald-400/80 mt-0.5">Stations provisioned in fleet</div>
          </div>

          <div className="bg-[#0d131f] border border-slate-800 rounded-2xl p-4 shadow-lg">
            <div className="text-xs text-slate-400 font-semibold uppercase tracking-wider">Automated Kiosks</div>
            <div className="text-2xl font-black text-purple-400 mt-1">
              {partners.filter((p) => p.type === 'kiosk').length}
            </div>
            <div className="text-[11px] text-slate-500 mt-0.5">Campus & Mall Host requests</div>
          </div>
        </div>

        {/* Filter Toolbar */}
        <div className="bg-[#0d131f] border border-slate-800 rounded-2xl p-4 shadow-xl flex flex-col sm:flex-row gap-3 items-stretch sm:items-center justify-between">
          <div className="flex flex-wrap items-center gap-2">
            {/* Status pills */}
            <div className="flex bg-slate-900 border border-slate-800 p-1 rounded-xl">
              {[
                { id: 'all', label: 'All Status' },
                { id: 'pending', label: 'Pending' },
                { id: 'approved', label: 'Approved' },
                { id: 'rejected', label: 'Rejected' },
              ].map((tab) => (
                <button
                  key={tab.id}
                  onClick={() => setFilterStatus(tab.id)}
                  className={`px-3 py-1 text-xs font-semibold rounded-lg transition-colors ${
                    filterStatus === tab.id
                      ? 'bg-[#00bf63] text-slate-950 font-bold'
                      : 'text-slate-400 hover:text-white'
                  }`}
                >
                  {tab.label}
                </button>
              ))}
            </div>

            {/* Type Filter */}
            <div className="flex bg-slate-900 border border-slate-800 p-1 rounded-xl">
              {[
                { id: 'all', label: 'All Modalities' },
                { id: 'shop', label: 'Shops' },
                { id: 'kiosk', label: 'Kiosks' },
              ].map((tab) => (
                <button
                  key={tab.id}
                  onClick={() => setFilterType(tab.id)}
                  className={`px-3 py-1 text-xs font-semibold rounded-lg transition-colors ${
                    filterType === tab.id
                      ? 'bg-slate-800 text-white font-bold'
                      : 'text-slate-400 hover:text-white'
                  }`}
                >
                  {tab.label}
                </button>
              ))}
            </div>
          </div>

          <div className="relative w-full sm:w-64">
            <Search className="absolute left-3 top-2.5 h-3.5 w-3.5 text-slate-500" />
            <input
              type="text"
              placeholder="Search by name, phone, ref..."
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              className="w-full bg-slate-900 border border-slate-800 text-white text-xs pl-9 pr-3 py-1.5 rounded-xl outline-none focus:border-[#00bf63]"
            />
          </div>
        </div>

        {/* Applications List */}
        <div className="bg-[#0d131f] border border-slate-800 rounded-xl overflow-hidden">
          <div className="p-4 border-b border-slate-800 flex items-center justify-between">
            <h3 className="text-xs font-bold text-white uppercase tracking-wider flex items-center gap-2">
              <FileCheck className="w-4 h-4 text-[#00bf63]" />
              Registration Applications Queue
            </h3>
            <span className="text-xs text-slate-400 font-mono">{filteredPartners.length} shown</span>
          </div>

          <div className="overflow-x-auto">
            <table className="w-full text-left text-xs">
              <thead className="bg-[#0b101b] text-slate-400 border-b border-slate-800 uppercase tracking-wider text-[10px]">
                <tr>
                  <th className="py-3 px-4">Reference & Type</th>
                  <th className="py-3 px-4">Business / Venue</th>
                  <th className="py-3 px-4">Contact Info</th>
                  <th className="py-3 px-4">Location / Area</th>
                  <th className="py-3 px-4">Status</th>
                  <th className="py-3 px-4 text-right">Review Actions</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-800/60 font-medium text-slate-300">
                {filteredPartners.length === 0 ? (
                  <tr>
                    <td colSpan={6} className="text-center py-12 text-slate-500">
                      {loading ? 'Loading applications...' : 'No matching registration applications.'}
                    </td>
                  </tr>
                ) : (
                  filteredPartners.map((partner) => {
                    const isKiosk = partner.type === 'kiosk'
                    const isPending = partner.status === 'pending'
                    const isApproved = partner.status === 'approved' || partner.status === 'onboarded'

                    return (
                      <tr key={partner.id} className="hover:bg-slate-900/50 transition-colors">
                        {/* Reference & Modality */}
                        <td className="py-3.5 px-4 whitespace-nowrap">
                          <div className="font-mono text-[11px] font-bold text-slate-300">
                            {partner.reference_id || 'QIK-REG-OLD'}
                          </div>
                          <span
                            className={`inline-flex items-center gap-1 text-[9px] font-bold px-1.5 py-0.5 rounded uppercase tracking-wider mt-1 ${
                              isKiosk
                                ? 'bg-purple-500/15 text-purple-400 border border-purple-500/30'
                                : 'bg-blue-500/15 text-blue-400 border border-blue-500/30'
                            }`}
                          >
                            {isKiosk ? <HardDrive className="w-2.5 h-2.5" /> : <Store className="w-2.5 h-2.5" />}
                            {partner.type}
                          </span>
                        </td>

                        {/* Business Name */}
                        <td className="py-3.5 px-4">
                          <div className="flex items-center gap-2.5">
                            {partner.logo_url ? (
                              <img src={partner.logo_url} alt="Logo" className="w-7 h-7 rounded-lg object-cover border border-slate-700 flex-shrink-0" />
                            ) : (
                              <div className="w-7 h-7 rounded-lg bg-slate-800 border border-slate-700 flex items-center justify-center text-[10px] font-bold text-slate-300 flex-shrink-0">
                                {partner.shop_name?.slice(0, 2).toUpperCase() || 'QI'}
                              </div>
                            )}
                            <div>
                              <div className="font-bold text-white text-sm">{partner.shop_name}</div>
                              <div className="text-[11px] text-slate-400 mt-0.5">{partner.space_type || (partner.type === 'kiosk' ? 'Automated Kiosk' : 'Print Shop')}</div>
                            </div>
                          </div>
                        </td>

                        {/* Contact */}
                        <td className="py-3.5 px-4 whitespace-nowrap">
                          <div className="font-bold text-white text-xs">{partner.name}</div>
                          <a
                            href={`tel:${partner.phone}`}
                            className="font-mono text-[11px] text-slate-400 hover:text-[#00bf63] flex items-center gap-1 mt-0.5"
                          >
                            <Phone className="w-3 h-3 text-slate-500" /> {partner.phone}
                          </a>
                        </td>

                        {/* Location */}
                        <td className="py-3.5 px-4 max-w-[220px]">
                          <div className="flex items-start gap-1 text-[11px] text-slate-300">
                            <MapPin className="w-3.5 h-3.5 text-slate-500 flex-shrink-0 mt-0.5" />
                            <span className="truncate">{partner.location}</span>
                          </div>
                        </td>

                        {/* Status */}
                        <td className="py-3.5 px-4 whitespace-nowrap">
                          <Badge
                            className={`text-[10px] font-bold capitalize ${
                              isApproved
                                ? 'bg-emerald-500/10 text-[#00bf63] border-emerald-500/30'
                                : partner.status === 'rejected'
                                ? 'bg-red-500/10 text-red-400 border-red-500/30'
                                : 'bg-amber-500/10 text-amber-400 border-amber-500/30'
                            }`}
                          >
                            {isApproved ? 'Approved & Provisioned' : partner.status}
                          </Badge>
                        </td>

                        {/* Actions */}
                        <td className="py-3.5 px-4 text-right whitespace-nowrap">
                          <div className="flex items-center justify-end gap-1.5">
                            <Button
                              size="sm"
                              variant="outline"
                              onClick={() => setSelectedPartner(partner)}
                              className="border-slate-800 bg-slate-900 text-slate-300 hover:text-white text-xs h-7 px-2 rounded-lg"
                              title="Inspect Full Application"
                            >
                              <Eye className="w-3 h-3 mr-1" /> View
                            </Button>

                            {isPending && (
                              <>
                                <Button
                                  size="sm"
                                  disabled={actionLoading === partner.id}
                                  onClick={() => handleApproveAndProvision(partner)}
                                  className="bg-[#00bf63] hover:bg-[#00a656] text-slate-950 font-bold text-xs h-7 px-2.5 rounded-lg shadow-none flex items-center gap-1"
                                >
                                  <CheckCircle2 className="w-3 h-3" /> Approve & Provision
                                </Button>

                                <Button
                                  size="sm"
                                  variant="outline"
                                  disabled={actionLoading === partner.id}
                                  onClick={() => setRejectingPartner(partner)}
                                  className="border-slate-800 bg-slate-900 text-slate-400 hover:text-red-400 text-xs h-7 px-2 rounded-lg"
                                >
                                  Reject
                                </Button>
                              </>
                            )}

                            {isApproved && (
                              <Badge className="bg-emerald-500/10 text-emerald-400 border-emerald-500/30 text-[10px] py-1">
                                <ShieldCheck className="w-3 h-3 mr-1" /> Active Fleet Terminal
                              </Badge>
                            )}
                          </div>
                        </td>
                      </tr>
                    )
                  })
                )}
              </tbody>
            </table>
          </div>
        </div>
      </main>

      {/* Inspect Partner Application Modal */}
      {selectedPartner && (
        <Dialog open={Boolean(selectedPartner)} onOpenChange={() => setSelectedPartner(null)}>
          <DialogContent className="max-w-xl bg-[#0d131f] border border-slate-800 text-white p-5 rounded-xl shadow-none">
            <DialogHeader className="border-b border-slate-800 pb-3">
              <div className="flex items-center justify-between">
                <div>
                  <span className="font-mono text-xs text-slate-500 font-bold">{selectedPartner.reference_id}</span>
                  <DialogTitle className="text-lg font-bold text-white mt-0.5">
                    {selectedPartner.shop_name}
                  </DialogTitle>
                </div>
                <Badge className="capitalize font-bold text-xs">
                  {selectedPartner.type === 'kiosk' ? 'Automated Kiosk Request' : 'Partner Print Shop'}
                </Badge>
              </div>
            </DialogHeader>

            <div className="space-y-4 py-3 text-xs text-slate-300">
              <div className="grid grid-cols-2 gap-3 bg-[#111827] border border-slate-800 p-3.5 rounded-xl">
                <div>
                  <span className="text-[10px] text-slate-500 uppercase font-semibold">Contact Person</span>
                  <div className="text-sm font-bold text-white">{selectedPartner.name}</div>
                </div>
                <div>
                  <span className="text-[10px] text-slate-500 uppercase font-semibold">Phone Number</span>
                  <div className="text-sm font-mono font-bold text-[#00bf63]">{selectedPartner.phone}</div>
                </div>
                {selectedPartner.email && (
                  <div>
                    <span className="text-[10px] text-slate-500 uppercase font-semibold">Email</span>
                    <div className="text-xs text-slate-200">{selectedPartner.email}</div>
                  </div>
                )}
                <div>
                  <span className="text-[10px] text-slate-500 uppercase font-semibold">Operating Hours</span>
                  <div className="text-xs text-slate-200">{selectedPartner.operating_hours || '09:00 AM - 10:00 PM'}</div>
                </div>
              </div>

              <div className="bg-[#111827] border border-slate-800 p-3.5 rounded-xl space-y-2">
                <span className="text-[10px] text-slate-500 uppercase font-semibold">Physical Location / Address</span>
                <div className="text-xs text-white leading-relaxed">{selectedPartner.location}</div>
              </div>

              <div className="grid grid-cols-2 gap-3 bg-[#111827] border border-slate-800 p-3.5 rounded-xl">
                <div>
                  <span className="text-[10px] text-slate-500 uppercase font-semibold">Hardware / Printer Details</span>
                  <div className="text-xs text-white font-medium">
                    {selectedPartner.printer_model || 'Self-Service Unit Provided by PrintKoro'}
                  </div>
                </div>
                <div>
                  <span className="text-[10px] text-slate-500 uppercase font-semibold">Estimated Footfall</span>
                  <div className="text-xs text-white font-medium">{selectedPartner.daily_footfall || 'Standard local traffic'}</div>
                </div>
              </div>

              {/* Uploaded Verification Media: Logo & Storefront Photo */}
              <div className="grid grid-cols-2 gap-3 bg-[#111827] border border-slate-800 p-3.5 rounded-xl">
                <div>
                  <span className="text-[10px] text-slate-500 uppercase font-semibold block mb-1">Shop Logo</span>
                  {selectedPartner.logo_url ? (
                    <div className="w-20 h-20 rounded-xl border border-slate-700 overflow-hidden bg-slate-900 shadow-inner">
                      <img src={selectedPartner.logo_url} alt="Shop Logo" className="w-full h-full object-cover" />
                    </div>
                  ) : (
                    <div className="w-20 h-20 rounded-xl border border-dashed border-slate-800 flex items-center justify-center text-[10px] text-slate-500">
                      No Logo
                    </div>
                  )}
                </div>
                <div>
                  <span className="text-[10px] text-slate-500 uppercase font-semibold block mb-1">Storefront / Kiosk Photo</span>
                  {selectedPartner.shop_photo_url ? (
                    <div className="w-full h-20 rounded-xl border border-slate-700 overflow-hidden bg-slate-900 shadow-inner">
                      <img src={selectedPartner.shop_photo_url} alt="Storefront" className="w-full h-full object-cover" />
                    </div>
                  ) : (
                    <div className="w-full h-20 rounded-xl border border-dashed border-slate-800 flex items-center justify-center text-[10px] text-slate-500">
                      No Storefront Photo
                    </div>
                  )}
                </div>
              </div>

              {selectedPartner.status === 'pending' && (
                <div className="pt-2 flex justify-end gap-2 border-t border-slate-800">
                  <Button
                    variant="outline"
                    onClick={() => {
                      setRejectingPartner(selectedPartner)
                      setSelectedPartner(null)
                    }}
                    className="border-slate-800 bg-slate-900 text-slate-400 hover:text-red-400 text-xs h-9"
                  >
                    Reject Application
                  </Button>
                  <Button
                    onClick={() => {
                      handleApproveAndProvision(selectedPartner)
                      setSelectedPartner(null)
                    }}
                    className="bg-[#00bf63] hover:bg-[#00a656] text-slate-950 font-bold text-xs h-9"
                  >
                    Approve & Provision Device
                  </Button>
                </div>
              )}
            </div>
          </DialogContent>
        </Dialog>
      )}

      {/* Provisioned Success Dialog */}
      {provisionResult && (
        <Dialog open={Boolean(provisionResult)} onOpenChange={() => setProvisionResult(null)}>
          <DialogContent className="max-w-md bg-[#0d131f] border-slate-800 text-white p-6 rounded-2xl">
            <DialogHeader className="text-center">
              <div className="w-12 h-12 rounded-full bg-emerald-500/10 text-[#00bf63] flex items-center justify-center mx-auto mb-2">
                <CheckCircle2 className="w-6 h-6" />
              </div>
              <DialogTitle className="text-lg font-bold text-white">
                Station Successfully Provisioned!
              </DialogTitle>
              <DialogDescription className="text-xs text-slate-400">
                A hardware terminal entry has been created in your fleet.
              </DialogDescription>
            </DialogHeader>

            <div className="space-y-3.5 my-3 text-xs">
              <div className="bg-[#111827] border border-slate-800 rounded-xl p-3 space-y-1">
                <div className="text-slate-400 text-[10px] uppercase font-bold">Station Name</div>
                <div className="text-white font-bold text-sm">{provisionResult.device?.name}</div>
              </div>

              <div className="bg-[#111827] border border-slate-800 rounded-xl p-3 space-y-1">
                <div className="text-slate-400 text-[10px] uppercase font-bold">Device UUID (Desktop POS ID)</div>
                <div className="font-mono text-emerald-400 font-bold text-xs break-all">{provisionResult.device?.id}</div>
              </div>

              <div className="pt-2 flex flex-col gap-2">
                <Button
                  onClick={() => {
                    const cfg = {
                      deviceId: provisionResult.device?.id,
                      apiBaseUrl: 'http://localhost:3000',
                      deviceName: provisionResult.device?.name,
                      deviceType: provisionResult.device?.type,
                      isKiosk: provisionResult.device?.type === 'kiosk',
                    }
                    const blob = new Blob([JSON.stringify(cfg, null, 2)], { type: 'application/json' })
                    const url = URL.createObjectURL(blob)
                    const a = document.createElement('a')
                    a.href = url
                    a.download = `quickink-config-${provisionResult.device?.id.slice(0, 8)}.json`
                    a.click()
                  }}
                  className="w-full bg-[#00bf63] hover:bg-[#00a656] text-slate-950 font-bold text-xs h-9"
                >
                  <Download className="w-3.5 h-3.5 mr-1.5" /> Download Desktop App Config JSON
                </Button>
                <Button
                  variant="outline"
                  onClick={() => setProvisionResult(null)}
                  className="w-full border-slate-800 text-slate-300 text-xs h-9"
                >
                  Done
                </Button>
              </div>
            </div>
          </DialogContent>
        </Dialog>
      )}

      {/* Rejection Dialog */}
      {rejectingPartner && (
        <Dialog open={Boolean(rejectingPartner)} onOpenChange={() => setRejectingPartner(null)}>
          <DialogContent className="max-w-md bg-[#0d131f] border border-slate-800 text-white p-5 rounded-xl shadow-none">
            <DialogHeader>
              <DialogTitle className="text-base font-bold text-white">Reject Application</DialogTitle>
              <DialogDescription className="text-xs text-slate-400">
                Rejecting application for &ldquo;{rejectingPartner.shop_name}&rdquo;. The shop owner will be required to re-register.
              </DialogDescription>
            </DialogHeader>

            <div className="space-y-3 my-3 text-xs">
              <div>
                <label className="text-slate-300 font-semibold block mb-1.5">Quick Reason Presets</label>
                <div className="flex flex-wrap gap-1.5 mb-2">
                  {[
                    'Storefront / kiosk photo unverifiable',
                    'Physical address incomplete or inaccessible',
                    'Location does not meet minimum clearance',
                    'Duplicate application submitted',
                  ].map((preset) => (
                    <button
                      key={preset}
                      type="button"
                      onClick={() => setRejectionReason(preset)}
                      className="text-[10px] bg-slate-900 border border-slate-700 hover:border-red-500/60 text-slate-300 hover:text-white px-2 py-1 rounded-md transition-colors"
                    >
                      {preset}
                    </button>
                  ))}
                </div>
              </div>

              <label className="text-slate-300 font-semibold block">Reason for Rejection (Displayed to Shop Owner)</label>
              <textarea
                rows={3}
                placeholder="e.g. Storefront photo was unclear, please provide a clear street-facing photo..."
                value={rejectionReason}
                onChange={(e) => setRejectionReason(e.target.value)}
                className="w-full bg-slate-900 border border-slate-800 rounded-xl p-2.5 text-xs text-white outline-none focus:border-red-500"
              />

              <div className="flex justify-end gap-2 pt-2">
                <Button
                  variant="outline"
                  onClick={() => setRejectingPartner(null)}
                  className="border-slate-800 text-slate-400 text-xs h-8"
                >
                  Cancel
                </Button>
                <Button
                  onClick={handleConfirmReject}
                  className="bg-red-600 hover:bg-red-500 text-white font-bold text-xs h-8"
                >
                  Confirm Rejection
                </Button>
              </div>
            </div>
          </DialogContent>
        </Dialog>
      )}
    </div>
  )
}
