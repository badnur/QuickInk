'use client'

import { useState, useEffect } from 'react'
import Link from 'next/link'
import {
  Banknote,
  Printer,
  HardDrive,
  FileText,
  TrendingUp,
  ExternalLink,
  ChevronRight,
  QrCode,
  ArrowUpRight,
} from 'lucide-react'
import { Button } from '@/components/ui/button'
import { Badge } from '@/components/ui/badge'
import AdminHeader from '@/components/admin/AdminHeader'
import StatCard from '@/components/admin/StatCard'
import DeviceQrModal from '@/components/admin/DeviceQrModal'

export default function AdminDashboardPage() {
  const [data, setData] = useState(null)
  const [loading, setLoading] = useState(true)
  const [refreshing, setRefreshing] = useState(false)
  const [selectedDeviceForQr, setSelectedDeviceForQr] = useState(null)

  const fetchStats = async (isManual = false) => {
    if (isManual) setRefreshing(true)
    try {
      const url = isManual ? '/api/admin/stats?refresh=true' : '/api/admin/stats'
      const res = await fetch(url)
      const json = await res.json()
      if (json?.success) {
        setData(json)
      }
    } catch (err) {
      console.error('Error fetching admin dashboard stats:', err)
    } finally {
      setLoading(false)
      if (isManual) setRefreshing(false)
    }
  }

  useEffect(() => {
    fetchStats(false)
    // Refresh periodically (45 seconds)
    const interval = setInterval(() => fetchStats(false), 45000)
    return () => clearInterval(interval)
  }, [])

  const stats = data?.stats || {
    totalRevenue: 0,
    onlineRevenue: 0,
    cashRevenue: 0,
    totalJobs: 0,
    awaitingJobs: 0,
    printedJobs: 0,
    totalSheets: 0,
    totalDevices: 0,
    onlineDevices: 0,
    pendingPartners: 0,
    kioskCount: 0,
    shopCount: 0,
  }

  const chartData = data?.chartData || []
  const recentJobs = data?.recentJobs || []
  const devices = data?.devices || []

  const maxRevenue = Math.max(...chartData.map((d) => d.revenue), 50)

  return (
    <div className="flex-1 flex flex-col min-h-screen bg-[#090d16]">
      <AdminHeader
        title="PrintKoro Executive Dashboard"
        subtitle="Platform metrics, station fleet status, and print volumes"
        onRefresh={() => fetchStats(true)}
        isRefreshing={refreshing}
      />

      <main className="p-4 sm:p-6 lg:p-8 space-y-6 max-w-7xl mx-auto w-full">
        {/* KPI Row */}
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
          <StatCard
            title="Total Revenue"
            value={`৳${stats.totalRevenue.toLocaleString()}`}
            subtitle={`Online: ৳${stats.onlineRevenue} • Cash: ৳${stats.cashRevenue}`}
            icon={Banknote}
            trend="+24% this week"
            color="green"
          />

          <StatCard
            title="Active Print Jobs"
            value={stats.awaitingJobs}
            subtitle={`${stats.totalJobs} total jobs created`}
            icon={Printer}
            color="blue"
          />

          <StatCard
            title="Pages Printed"
            value={stats.totalSheets}
            subtitle={`${stats.printedJobs} jobs successfully collected`}
            icon={FileText}
            color="purple"
          />

          <StatCard
            title="Station Fleet"
            value={`${stats.onlineDevices}/${stats.totalDevices}`}
            subtitle={`${stats.kioskCount || 0} Kiosks • ${stats.shopCount || 0} Shops`}
            icon={HardDrive}
            color="amber"
          />
        </div>

        {/* Charts & Overview Grid */}
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
          {/* Revenue Bar Chart (2 cols) */}
          <div className="lg:col-span-2 bg-[#0d131f] border border-slate-800 rounded-xl p-5">
            <div className="flex items-center justify-between mb-4">
              <div>
                <h3 className="text-sm font-semibold text-white flex items-center gap-2">
                  <TrendingUp className="w-4 h-4 text-[#00bf63]" />
                  7-Day Revenue Trends (৳ BDT)
                </h3>
                <p className="text-xs text-slate-400">Daily earnings across all kiosks & partner shops</p>
              </div>
              <Badge className="bg-slate-900 border border-slate-800 text-slate-400 font-mono text-[10px]">
                LIVE UPDATES
              </Badge>
            </div>

            {/* Flat Minimal Bar Chart */}
            <div className="h-48 pt-6 flex items-end justify-between gap-2 sm:gap-4 px-2 border-b border-slate-800">
              {chartData.map((day, idx) => {
                const heightPercent = Math.max(10, Math.round((day.revenue / maxRevenue) * 100))
                return (
                  <div key={idx} className="flex-1 flex flex-col items-center h-full justify-end group relative">
                    {/* Tooltip */}
                    <div className="absolute -top-9 opacity-0 group-hover:opacity-100 transition-opacity bg-slate-950 border border-slate-800 text-white text-[10px] font-medium px-2 py-0.5 rounded pointer-events-none whitespace-nowrap z-20">
                      ৳{day.revenue} • {day.jobs} jobs
                    </div>

                    {/* Bar - Clean solid without glow or blurry gradient */}
                    <div
                      style={{ height: `${heightPercent}%` }}
                      className="w-full max-w-[36px] rounded-t bg-[#00bf63] hover:bg-[#00a656] transition-colors relative"
                    />

                    {/* Date label */}
                    <span className="text-[10px] text-slate-400 mt-2 font-medium truncate w-full text-center">
                      {day.date.split(',')[0]}
                    </span>
                  </div>
                )
              })}
            </div>

            <div className="flex items-center justify-between text-xs text-slate-400 pt-3">
              <span>Standard Pricing: ৳2 B&W • ৳8 Color</span>
              <Link
                href="/analytics"
                className="text-[#00bf63] hover:underline font-medium flex items-center gap-1 text-xs"
              >
                Detailed Analytics <ArrowUpRight className="w-3.5 h-3.5" />
              </Link>
            </div>
          </div>

          {/* Quick Fleet Health & Partner Leads */}
          <div className="bg-[#0d131f] border border-slate-800 rounded-xl p-5 flex flex-col justify-between">
            <div>
              <div className="flex items-center justify-between mb-3">
                <h3 className="text-sm font-semibold text-white flex items-center gap-2">
                  <HardDrive className="w-4 h-4 text-amber-400" />
                  Kiosk & Shop Health
                </h3>
                <Link
                  href="/devices"
                  className="text-xs text-slate-400 hover:text-white"
                >
                  Manage All
                </Link>
              </div>

              <div className="space-y-2">
                {devices.slice(0, 4).map((d) => (
                  <div
                    key={d.id}
                    className="p-2.5 rounded-lg bg-slate-900 border border-slate-800 flex items-center justify-between hover:border-slate-700 transition-colors"
                  >
                    <div className="min-w-0 flex-1 pr-2">
                      <div className="flex items-center gap-1.5">
                        <span className={`w-2 h-2 rounded-full ${d.status === 'online' ? 'bg-[#00bf63]' : 'bg-red-400'}`} />
                        <span className="text-xs font-semibold text-white truncate">{d.name}</span>
                      </div>
                      <p className="text-[10px] text-slate-400 truncate pl-3.5">
                        {typeof d.location === 'object' ? d.location?.address : d.location}
                      </p>
                    </div>

                    <Button
                      size="sm"
                      variant="ghost"
                      onClick={() => setSelectedDeviceForQr(d)}
                      title="View Kiosk QR Code"
                      className="h-7 w-7 p-0 text-slate-400 hover:text-[#00bf63] hover:bg-slate-800 rounded"
                    >
                      <QrCode className="w-3.5 h-3.5" />
                    </Button>
                  </div>
                ))}
              </div>
            </div>

            {/* Partner Leads banner */}
            <div className="mt-4 pt-3 border-t border-slate-800">
              <div className="bg-slate-900 p-3 rounded-lg border border-slate-800 flex items-center justify-between">
                <div>
                  <span className="text-xs font-semibold text-emerald-400 block">
                    {stats.pendingPartners} Partner Application{stats.pendingPartners === 1 ? '' : 's'}
                  </span>
                  <span className="text-[10px] text-slate-400">Shop owners awaiting review</span>
                </div>
                <Link href="/partners">
                  <Button size="sm" className="bg-[#00bf63] hover:bg-[#00a656] text-slate-950 font-bold text-xs h-7 px-2.5 rounded shadow-none">
                    Review
                  </Button>
                </Link>
              </div>
            </div>
          </div>
        </div>

        {/* Live Print Jobs Table Section */}
        <div className="bg-[#0d131f] border border-slate-800 rounded-xl p-5">
          <div className="flex items-center justify-between mb-4">
            <div>
              <h3 className="text-sm font-semibold text-white flex items-center gap-2">
                <Printer className="w-4 h-4 text-[#00bf63]" />
                Recent Print Orders
              </h3>
              <p className="text-xs text-slate-400">Incoming uploads from mobile, kiosks, and counter shops</p>
            </div>
            <Link href="/jobs">
              <Button
                variant="outline"
                size="sm"
                className="bg-slate-900 border-slate-800 text-slate-300 hover:text-white text-xs h-7 rounded shadow-none"
              >
                View All Jobs <ChevronRight className="w-3 h-3 ml-1" />
              </Button>
            </Link>
          </div>

          <div className="overflow-x-auto">
            <table className="w-full text-left text-xs">
              <thead className="bg-slate-900 text-slate-400 border-y border-slate-800 uppercase tracking-wider text-[10px]">
                <tr>
                  <th className="py-2.5 px-3">Job ID</th>
                  <th className="py-2.5 px-3">File</th>
                  <th className="py-2.5 px-3">Specs</th>
                  <th className="py-2.5 px-3">Payment</th>
                  <th className="py-2.5 px-3">Status</th>
                  <th className="py-2.5 px-3">Created</th>
                  <th className="py-2.5 px-3 text-right">Station</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-800 font-normal">
                {recentJobs.length === 0 ? (
                  <tr>
                    <td colSpan={7} className="text-center py-8 text-slate-500">
                      No print jobs recorded yet. Place an order on /print to test live sync.
                    </td>
                  </tr>
                ) : (
                  recentJobs.map((job) => {
                    const statusStyles = {
                      awaiting_redemption: 'bg-amber-950/40 text-amber-400 border-amber-800/40',
                      redeemed: 'bg-blue-950/40 text-blue-400 border-blue-800/40',
                      printed: 'bg-emerald-950/40 text-emerald-400 border-emerald-800/40',
                      expired: 'bg-slate-900 text-slate-400 border-slate-800',
                    }[job.status] || 'bg-slate-900 text-slate-400 border-slate-800'

                    return (
                      <tr key={job.id} className="hover:bg-slate-900/60 transition-colors">
                        <td className="py-3 px-3 font-mono text-slate-400">
                          #{job.id.substring(0, 8)}
                        </td>
                        <td className="py-3 px-3">
                          <div className="font-semibold text-white truncate max-w-[180px]">
                            {job.file_name || 'Document.pdf'}
                          </div>
                          <span className="text-[10px] text-slate-400 uppercase">{job.file_type}</span>
                        </td>
                        <td className="py-3 px-3">
                          <span className="font-medium text-slate-300">
                            {job.page_count} {job.page_count === 1 ? 'pg' : 'pgs'}
                          </span>
                          <span className="text-[10px] text-slate-400 block">
                            {job.copies} {job.copies === 1 ? 'copy' : 'copies'} • {job.color_mode === 'color' ? 'Color' : 'B&W'}
                          </span>
                        </td>
                        <td className="py-3 px-3">
                          <div className="font-semibold text-white">৳{job.amount || '—'}</div>
                          <span className="text-[10px] text-slate-400 uppercase">
                            {job.payment_type}
                          </span>
                        </td>
                        <td className="py-3 px-3">
                          <span className={`inline-flex items-center px-2 py-0.5 rounded text-[10px] font-medium border ${statusStyles}`}>
                            {job.status?.replace('_', ' ')}
                          </span>
                        </td>
                        <td className="py-3 px-3 text-slate-400 text-[11px]">
                          {new Date(job.created_at).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
                        </td>
                        <td className="py-3 px-3 text-right text-slate-400 text-[11px] truncate max-w-[150px]">
                          {job.device_name}
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

      {/* Device QR Code Modal */}
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
