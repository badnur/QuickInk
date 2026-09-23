'use client'

import { useState, useEffect } from 'react'
import {
  TrendingUp,
  Banknote,
  Printer,
  CreditCard,
  DollarSign,
  Award,
  ExternalLink,
} from 'lucide-react'
import { Button } from '@/components/ui/button'
import { Badge } from '@/components/ui/badge'
import AdminHeader from '@/components/admin/AdminHeader'
import StatCard from '@/components/admin/StatCard'
import DevicePerformanceModal from '@/components/admin/DevicePerformanceModal'

export default function AdminAnalyticsPage() {
  const [data, setData] = useState(null)
  const [loading, setLoading] = useState(true)
  const [refreshing, setRefreshing] = useState(false)
  const [selectedDeviceForModal, setSelectedDeviceForModal] = useState(null)

  const fetchStats = async (isManual = false) => {
    if (isManual) setRefreshing(true)
    try {
      const url = isManual ? '/api/admin/stats?refresh=true' : '/api/admin/stats'
      const res = await fetch(url)
      const json = await res.json()
      if (json?.success) setData(json)
    } catch (e) {
      console.error('Analytics fetch error:', e)
    } finally {
      setLoading(false)
      if (isManual) setRefreshing(false)
    }
  }

  useEffect(() => {
    fetchStats(false)
  }, [])

  const stats = data?.stats || {
    totalRevenue: 0,
    onlineRevenue: 0,
    cashRevenue: 0,
    totalJobs: 0,
    totalSheets: 0,
    printedJobs: 0,
  }

  const chartData = data?.chartData || []
  const maxRevenue = Math.max(...chartData.map((d) => d.revenue), 50)
  const maxSheets = Math.max(...chartData.map((d) => d.sheets), 20)

  // Ratios
  const onlinePercent = stats.totalRevenue > 0
    ? Math.round((stats.onlineRevenue / stats.totalRevenue) * 100)
    : 50
  const cashPercent = 100 - onlinePercent

  return (
    <div className="flex-1 flex flex-col min-h-screen bg-[#090d16]">
      <AdminHeader
        title="Revenue & Volume Analytics"
        subtitle="Financial performance, payment breakdowns, and kiosk print sheet volume"
        onRefresh={() => fetchStats(true)}
        isRefreshing={refreshing}
      />

      <main className="p-4 sm:p-6 lg:p-8 space-y-6 max-w-7xl mx-auto w-full">
        {/* KPI Top Row */}
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
          <StatCard
            title="Gross Volume"
            value={`৳${stats.totalRevenue.toLocaleString()}`}
            subtitle="Platform-wide earnings"
            icon={Banknote}
            color="green"
          />

          <StatCard
            title="Digital / Online"
            value={`৳${stats.onlineRevenue.toLocaleString()}`}
            subtitle={`${onlinePercent}% of total revenue`}
            icon={CreditCard}
            color="blue"
          />

          <StatCard
            title="Cash at Counter"
            value={`৳${stats.cashRevenue.toLocaleString()}`}
            subtitle={`${cashPercent}% of total revenue`}
            icon={DollarSign}
            color="amber"
          />

          <StatCard
            title="Total Paper Sheets"
            value={stats.totalSheets}
            subtitle={`Across ${stats.totalJobs} completed jobs`}
            icon={Printer}
            color="purple"
          />
        </div>

        {/* Charts Grid */}
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
          {/* Revenue Trends */}
          <div className="bg-[#0d131f] border border-slate-800 rounded-xl p-5">
            <div className="flex items-center justify-between mb-4">
              <div>
                <h3 className="text-sm font-semibold text-white flex items-center gap-2">
                  <TrendingUp className="w-4 h-4 text-[#00bf63]" /> Daily Revenue (৳)
                </h3>
                <p className="text-xs text-slate-400">7-day gross sales</p>
              </div>
            </div>

            <div className="h-44 pt-4 flex items-end justify-between gap-3 px-2 border-b border-slate-800">
              {chartData.map((d, i) => {
                const pct = Math.max(10, Math.round((d.revenue / maxRevenue) * 100))
                return (
                  <div key={i} className="flex-1 flex flex-col items-center h-full justify-end group relative">
                    <div className="absolute -top-8 opacity-0 group-hover:opacity-100 transition-opacity bg-slate-950 border border-slate-800 text-white text-[10px] font-medium px-2 py-0.5 rounded z-20">
                      ৳{d.revenue}
                    </div>
                    <div
                      style={{ height: `${pct}%` }}
                      className="w-full max-w-[32px] bg-[#00bf63] hover:bg-[#00a656] rounded-t transition-colors"
                    />
                    <span className="text-[10px] text-slate-400 mt-2 font-medium">
                      {d.date.split(',')[0]}
                    </span>
                  </div>
                )
              })}
            </div>
          </div>

          {/* Paper Sheets Volume */}
          <div className="bg-[#0d131f] border border-slate-800 rounded-xl p-5">
            <div className="flex items-center justify-between mb-4">
              <div>
                <h3 className="text-sm font-semibold text-white flex items-center gap-2">
                  <Printer className="w-4 h-4 text-purple-400" /> Daily Print Sheets
                </h3>
                <p className="text-xs text-slate-400">Total paper throughput across all printers</p>
              </div>
            </div>

            <div className="h-44 pt-4 flex items-end justify-between gap-3 px-2 border-b border-slate-800">
              {chartData.map((d, i) => {
                const pct = Math.max(10, Math.round((d.sheets / maxSheets) * 100))
                return (
                  <div key={i} className="flex-1 flex flex-col items-center h-full justify-end group relative">
                    <div className="absolute -top-8 opacity-0 group-hover:opacity-100 transition-opacity bg-slate-950 border border-slate-800 text-white text-[10px] font-medium px-2 py-0.5 rounded z-20">
                      {d.sheets} sheets
                    </div>
                    <div
                      style={{ height: `${pct}%` }}
                      className="w-full max-w-[32px] bg-purple-500 hover:bg-purple-400 rounded-t transition-colors"
                    />
                    <span className="text-[10px] text-slate-400 mt-2 font-medium">
                      {d.date.split(',')[0]}
                    </span>
                  </div>
                )
              })}
            </div>
          </div>
        </div>

        {/* Payment Channel Breakdown Card */}
        <div className="bg-[#0d131f] border border-slate-800 rounded-xl p-5">
          <h3 className="text-sm font-semibold text-white mb-1">Payment Method Distribution</h3>
          <p className="text-xs text-slate-400 mb-4">Channel share between contactless digital checkout and counter redemption</p>

          <div className="w-full h-3 bg-slate-900 rounded-full overflow-hidden flex border border-slate-800 mb-4">
            <div
              style={{ width: `${onlinePercent}%` }}
              className="bg-[#00bf63] transition-all"
              title={`Online: ${onlinePercent}%`}
            />
            <div
              style={{ width: `${cashPercent}%` }}
              className="bg-amber-400 transition-all"
              title={`Cash: ${cashPercent}%`}
            />
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
            <div className="p-3 rounded-lg bg-slate-900 border border-slate-800 flex items-center justify-between">
              <div>
                <span className="text-xs font-semibold text-white block">Digital (Online / Card)</span>
                <span className="text-[11px] text-slate-400">Automatic kiosk release</span>
              </div>
              <div className="text-right">
                <span className="font-mono text-sm font-bold text-[#00bf63]">{onlinePercent}%</span>
                <span className="text-[10px] text-slate-400 block">৳{stats.onlineRevenue}</span>
              </div>
            </div>

            <div className="p-3 rounded-lg bg-slate-900 border border-slate-800 flex items-center justify-between">
              <div>
                <span className="text-xs font-semibold text-white block">Cash at Counter</span>
                <span className="text-[11px] text-slate-400">Paid directly to shop operator</span>
              </div>
              <div className="text-right">
                <span className="font-mono text-sm font-bold text-amber-400">{cashPercent}%</span>
                <span className="text-[10px] text-slate-400 block">৳{stats.cashRevenue}</span>
              </div>
            </div>
          </div>
        </div>

        {/* Shop Print Volumes & Earnings Leaderboard */}
        <div className="bg-[#0d131f] border border-slate-800 rounded-xl overflow-hidden">
          <div className="p-4 border-b border-slate-800 flex flex-col sm:flex-row sm:items-center justify-between gap-3">
            <div>
              <h3 className="text-sm font-semibold text-white flex items-center gap-2">
                <Award className="w-4 h-4 text-[#00bf63]" /> Shop Print Volumes & Earnings Leaderboard
              </h3>
              <p className="text-xs text-slate-400 mt-0.5">
                Copies printed and shop earnings per hardware station
              </p>
            </div>
            <div className="text-xs text-slate-400 bg-slate-900 border border-slate-800 px-2.5 py-1 rounded font-medium self-start sm:self-auto">
              {(data?.shopLeaderboard || []).length} Stations
            </div>
          </div>

          <div className="overflow-x-auto">
            <table className="w-full text-left text-xs">
              <thead className="bg-slate-900 text-slate-400 border-b border-slate-800 uppercase tracking-wider text-[10px]">
                <tr>
                  <th className="py-2.5 px-3">Station</th>
                  <th className="py-2.5 px-3">Modality</th>
                  <th className="py-2.5 px-3">Orders</th>
                  <th className="py-2.5 px-3">Sheets Printed</th>
                  <th className="py-2.5 px-3">B&W / Color Split</th>
                  <th className="py-2.5 px-3">Gross Revenue</th>
                  <th className="py-2.5 px-3 text-right">Actions</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-800 font-normal">
                {(data?.shopLeaderboard || []).length === 0 ? (
                  <tr>
                    <td colSpan={7} className="text-center py-8 text-slate-500">
                      No station leaderboard telemetry recorded yet.
                    </td>
                  </tr>
                ) : (
                  data.shopLeaderboard.map((shop, idx) => (
                    <tr key={shop.id} className="hover:bg-slate-900/50 transition-colors">
                      <td className="py-3 px-3">
                        <div className="font-semibold text-white flex items-center gap-1.5">
                          <span className="text-slate-500 text-[11px] font-mono">#{idx + 1}</span>
                          {shop.name}
                        </div>
                        <span className="text-[10px] text-slate-400 truncate max-w-[200px] block">
                          {shop.address}
                        </span>
                      </td>
                      <td className="py-3 px-3">
                        <span className={`inline-flex items-center px-2 py-0.5 rounded text-[10px] font-medium border ${
                          shop.type === 'kiosk'
                            ? 'bg-purple-950/40 text-purple-400 border-purple-800/40'
                            : 'bg-blue-950/40 text-blue-400 border-blue-800/40'
                        }`}>
                          {shop.type}
                        </span>
                      </td>
                      <td className="py-3 px-3 font-medium text-slate-300">
                        {shop.totalJobs} jobs
                      </td>
                      <td className="py-3 px-3">
                        <span className="font-semibold text-white">{shop.totalSheets}</span>
                        <span className="text-[10px] text-slate-400 block">sheets</span>
                      </td>
                      <td className="py-3 px-3 text-[11px] text-slate-300">
                        <span>{shop.bwSheets} B&W</span>
                        <span className="text-slate-500 mx-1">•</span>
                        <span>{shop.colorSheets} Color</span>
                      </td>
                      <td className="py-3 px-3 font-semibold text-white">
                        ৳{shop.shopEarnings.toLocaleString()}
                      </td>
                      <td className="py-3 px-3 text-right">
                        <Button
                          size="sm"
                          variant="ghost"
                          onClick={() => setSelectedDeviceForModal(shop)}
                          className="h-7 px-2 text-xs text-[#00bf63] hover:text-white hover:bg-slate-800 rounded"
                        >
                          Inspect <ExternalLink className="w-3 h-3 ml-1" />
                        </Button>
                      </td>
                    </tr>
                  ))
                )}
              </tbody>
            </table>
          </div>
        </div>
      </main>

      {/* Device Telemetry Modal */}
      {selectedDeviceForModal && (
        <DevicePerformanceModal
          device={selectedDeviceForModal}
          isOpen={Boolean(selectedDeviceForModal)}
          onClose={() => setSelectedDeviceForModal(null)}
        />
      )}
    </div>
  )
}
