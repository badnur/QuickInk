'use client'

import { useState, useEffect } from 'react'
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
} from '@/components/ui/dialog'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import {
  BarChart3,
  Printer,
  FileText,
  DollarSign,
  TrendingUp,
  Clock,
  MapPin,
  Phone,
  HardDrive,
  Store,
  RefreshCw,
  CreditCard,
  Banknote,
  CheckCircle2
} from 'lucide-react'

export default function DevicePerformanceModal({ device, isOpen, onClose }) {
  const [loading, setLoading] = useState(true)
  const [data, setData] = useState(null)
  const [error, setError] = useState(null)

  const fetchPerformance = async () => {
    if (!device?.id) return
    setLoading(true)
    setError(null)
    try {
      const res = await fetch(`/api/admin/devices/${device.id}/performance`)
      const json = await res.json()
      if (res.ok && json.success) {
        setData(json)
      } else {
        setError(json.error || 'Failed to load telemetry')
      }
    } catch (err) {
      setError(err.message)
    } finally {
      setLoading(false)
    }
  }

  useEffect(() => {
    if (isOpen && device?.id) {
      fetchPerformance()
    }
  }, [isOpen, device?.id])

  if (!device) return null

  const isKiosk = device.type === 'kiosk'
  const kpis = data?.kpis
  const jobs = data?.jobs || []

  return (
    <Dialog open={isOpen} onOpenChange={onClose}>
      <DialogContent className="max-w-4xl max-h-[90vh] overflow-y-auto bg-[#0d131f] border-slate-800 text-slate-100 p-6 rounded-2xl">
        <DialogHeader className="border-b border-slate-800/80 pb-4">
          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
            <div className="flex items-center gap-3">
              <div className="w-10 h-10 rounded-xl bg-[#00bf63]/10 text-[#00bf63] flex items-center justify-center flex-shrink-0">
                {isKiosk ? <HardDrive className="w-5 h-5" /> : <Store className="w-5 h-5" />}
              </div>
              <div>
                <DialogTitle className="text-lg font-bold text-white flex items-center gap-2">
                  <span>{device.name}</span>
                  <Badge className={`text-[10px] uppercase font-bold ${
                    device.status === 'online'
                      ? 'bg-emerald-500/10 text-emerald-400 border-emerald-500/30'
                      : 'bg-amber-500/10 text-amber-400 border-amber-500/30'
                  }`}>
                    {device.status}
                  </Badge>
                </DialogTitle>
                <DialogDescription className="text-xs text-slate-400 flex items-center gap-3 mt-1">
                  <span className="flex items-center gap-1">
                    <MapPin className="w-3 h-3 text-slate-500" />
                    {device.location?.address || 'Address configured'}
                  </span>
                  <span className="flex items-center gap-1">
                    <Clock className="w-3 h-3 text-slate-500" />
                    {device.location?.operating_hours || 'Operating'}
                  </span>
                </DialogDescription>
              </div>
            </div>

            <Button
              variant="outline"
              size="sm"
              onClick={fetchPerformance}
              disabled={loading}
              className="h-8 text-xs font-semibold bg-slate-900 border-slate-700 text-slate-300 hover:text-white"
            >
              <RefreshCw className={`w-3.5 h-3.5 mr-1.5 ${loading ? 'animate-spin' : ''}`} />
              Refresh Telemetry
            </Button>
          </div>
        </DialogHeader>

        {loading ? (
          <div className="py-16 text-center text-slate-400 text-sm">
            <div className="w-8 h-8 mx-auto border-2 border-[#00bf63] border-t-transparent rounded-full animate-spin mb-3"></div>
            Fetching real-time station KPIs and telemetry...
          </div>
        ) : error ? (
          <div className="py-8 text-center text-red-400 text-xs">{error}</div>
        ) : (
          <div className="space-y-6 pt-2">
            {/* KPI Metric Cards */}
            <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
              <div className="bg-[#111827] border border-slate-800 rounded-xl p-3.5">
                <div className="text-[11px] font-semibold text-slate-400 uppercase tracking-wider">Total Print Jobs</div>
                <div className="text-2xl font-black text-white mt-1">{kpis?.totalJobs || 0}</div>
                <div className="text-[10px] text-slate-500 mt-0.5">Dispatched to station</div>
              </div>

              <div className="bg-[#111827] border border-slate-800 rounded-xl p-3.5">
                <div className="text-[11px] font-semibold text-slate-400 uppercase tracking-wider">Total Sheets</div>
                <div className="text-2xl font-black text-white mt-1">{kpis?.totalPages || 0}</div>
                <div className="text-[10px] text-slate-400 mt-0.5">
                  <span className="text-slate-300 font-medium">{kpis?.bwSheets || 0} B&W</span> ·{' '}
                  <span className="text-[#00bf63] font-medium">{kpis?.colorSheets || 0} Color</span>
                </div>
              </div>

              <div className="bg-[#111827] border border-slate-800 rounded-xl p-3.5">
                <div className="text-[11px] font-semibold text-slate-400 uppercase tracking-wider">Gross Revenue</div>
                <div className="text-2xl font-black text-white mt-1">৳{kpis?.totalRevenue?.toFixed(2) || '0.00'}</div>
                <div className="text-[10px] text-slate-400 mt-0.5">
                  Counter ৳{kpis?.cashCollected || 0} · Online ৳{kpis?.digitalCollected || 0}
                </div>
              </div>

              <div className="bg-[#111827] border border-emerald-900/40 bg-emerald-950/20 rounded-xl p-3.5">
                <div className="text-[11px] font-semibold text-emerald-400 uppercase tracking-wider flex items-center justify-between">
                  <span>Shop Earnings</span>
                  <span className="text-[10px] bg-emerald-900/60 px-1.5 py-0.5 rounded font-bold">
                    100% Retained
                  </span>
                </div>
                <div className="text-2xl font-black text-[#00bf63] mt-1">৳{(kpis?.shopEarnings ?? kpis?.totalRevenue ?? 0).toFixed(2)}</div>
                <div className="text-[10px] text-slate-400 mt-0.5 flex items-center justify-between">
                  <span>Plan: {kpis?.subscriptionPlan || 'Pro SaaS'}</span>
                  <span className="capitalize text-emerald-400 font-medium">({kpis?.subscriptionStatus || 'Active'})</span>
                </div>
              </div>
            </div>

            {/* Print Jobs Ledger Table */}
            <div className="bg-[#111827] border border-slate-800 rounded-xl overflow-hidden">
              <div className="p-4 border-b border-slate-800 flex items-center justify-between">
                <div>
                  <h4 className="text-xs font-bold text-white uppercase tracking-wider flex items-center gap-2">
                    <Printer className="w-3.5 h-3.5 text-[#00bf63]" />
                    Station Print Execution Ledger
                  </h4>
                  <p className="text-[11px] text-slate-400 mt-0.5">Recent orders retrieved and printed at this terminal</p>
                </div>
                <span className="text-[11px] font-mono text-slate-400">{jobs.length} records</span>
              </div>

              {jobs.length === 0 ? (
                <div className="p-8 text-center text-slate-500 text-xs">
                  No print jobs redeemed at this station yet.
                </div>
              ) : (
                <div className="overflow-x-auto">
                  <table className="w-full text-left text-xs">
                    <thead className="bg-[#0b101b] text-slate-400 border-b border-slate-800">
                      <tr>
                        <th className="py-2.5 px-4 font-semibold">Time</th>
                        <th className="py-2.5 px-4 font-semibold">Document</th>
                        <th className="py-2.5 px-4 font-semibold">Pages</th>
                        <th className="py-2.5 px-4 font-semibold">Mode</th>
                        <th className="py-2.5 px-4 font-semibold">Payment</th>
                        <th className="py-2.5 px-4 font-semibold">Amount</th>
                        <th className="py-2.5 px-4 font-semibold">Status</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-slate-800/60 text-slate-300">
                      {jobs.map((job) => (
                        <tr key={job.id} className="hover:bg-slate-800/30">
                          <td className="py-2.5 px-4 font-mono text-[11px] text-slate-400 whitespace-nowrap">
                            {new Date(job.created_at).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
                          </td>
                          <td className="py-2.5 px-4 max-w-[200px] truncate font-medium text-white">
                            {job.file_name || 'Document.pdf'}
                          </td>
                          <td className="py-2.5 px-4 whitespace-nowrap">
                            {job.page_count} pg × {job.copies} cp
                          </td>
                          <td className="py-2.5 px-4 whitespace-nowrap">
                            <span className={`text-[10px] font-bold px-2 py-0.5 rounded ${
                              job.color_mode === 'color'
                                ? 'bg-emerald-950 text-emerald-400 border border-emerald-800'
                                : 'bg-slate-800 text-slate-300 border border-slate-700'
                            }`}>
                              {job.color_mode === 'color' ? 'Color' : 'B&W'}
                            </span>
                          </td>
                          <td className="py-2.5 px-4 whitespace-nowrap">
                            <span className="flex items-center gap-1.5 text-slate-300 text-[11px]">
                              {job.payment_type === 'counter_cash' ? (
                                <>
                                  <Banknote className="w-3 h-3 text-amber-400" />
                                  <span>Cash</span>
                                </>
                              ) : (
                                <>
                                  <CreditCard className="w-3 h-3 text-emerald-400" />
                                  <span>Online</span>
                                </>
                              )}
                            </span>
                          </td>
                          <td className="py-2.5 px-4 font-bold text-white whitespace-nowrap">
                            ৳{job.amount || (job.color_mode === 'color' ? job.page_count * job.copies * 8 : job.page_count * job.copies * 2)}
                          </td>
                          <td className="py-2.5 px-4 whitespace-nowrap">
                            <span className="flex items-center gap-1 text-[11px] text-emerald-400 font-semibold">
                              <CheckCircle2 className="w-3 h-3 text-[#00bf63]" />
                              Printed
                            </span>
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              )}
            </div>

            {/* Station Pairing & Device Credentials */}
            <div className="p-4 bg-[#111827] border border-slate-800 rounded-xl flex flex-col sm:flex-row items-start sm:items-center justify-between gap-3 text-xs">
              <div>
                <span className="text-slate-400">Desktop Terminal Device ID:</span>{' '}
                <span className="font-mono text-white font-bold">{device.id}</span>
              </div>
              <div className="flex gap-2">
                <Button
                  size="sm"
                  variant="outline"
                  onClick={() => {
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
                  }}
                  className="h-8 text-xs font-semibold bg-slate-800 border-slate-700 text-slate-200 hover:text-white"
                >
                  Download POS Config
                </Button>
              </div>
            </div>
          </div>
        )}
      </DialogContent>
    </Dialog>
  )
}
