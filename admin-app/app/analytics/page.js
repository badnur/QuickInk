'use client'

import { useState, useEffect } from 'react'
import {
  BarChart3,
  TrendingUp,
  Banknote,
  Printer,
  PieChart,
  Calendar,
  Download,
  FileCheck,
  CreditCard,
  DollarSign,
  Store,
  HardDrive,
  ExternalLink,
  Award
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

  const fetchStats = async () => {
    setRefreshing(true)
    try {
      const res = await fetch('/api/admin/stats')
      const json = await res.json()
      if (json?.success) setData(json)
    } catch (e) {
      console.error('Analytics fetch error:', e)
    } finally {
      setLoading(false)
      setRefreshing(false)
    }
  }

  useEffect(() => {
    fetchStats()
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
        onRefresh={fetchStats}
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
          <div className="bg-[#0d131f] border border-slate-800 rounded-2xl p-5 shadow-xl">
            <div className="flex items-center justify-between mb-4">
              <div>
                <h3 className="text-sm font-bold text-white flex items-center gap-2">
                  <TrendingUp className="w-4 h-4 text-[#00bf63]" /> Daily Revenue (৳)
                </h3>
                <p className="text-xs text-slate-400">7-day gross sales</p>
              </div>
            </div>

            <div className="h-44 pt-4 flex items-end justify-between gap-3 px-2 border-b border-slate-800/80">
              {chartData.map((d, i) => {
                const pct = Math.max(10, Math.round((d.revenue / maxRevenue) * 100))
                return (
                  <div key={i} className="flex-1 flex flex-col items-center h-full justify-end group relative">
                    <div className="absolute -top-8 opacity-0 group-hover:opacity-100 transition-opacity bg-slate-900 border border-slate-700 text-white text-[10px] font-bold px-2 py-1 rounded z-20">
                      ৳{d.revenue}
                    </div>
                    <div
                      style={{ height: `${pct}%` }}
                      className="w-full max-w-[36px] bg-gradient-to-t from-[#00bf63]/30 to-[#00bf63] rounded-t-lg transition-all"
                    />
                    <span className="text-[10px] text-slate-400 mt-2 font-semibold">
                      {d.date.split(',')[0]}
                    </span>
                  </div>
                )
              })}
            </div>
          </div>

          {/* Paper Sheets Volume */}
          <div className="bg-[#0d131f] border border-slate-800 rounded-2xl p-5 shadow-xl">
            <div className="flex items-center justify-between mb-4">
              <div>
                <h3 className="text-sm font-bold text-white flex items-center gap-2">
                  <Printer className="w-4 h-4 text-purple-400" /> Daily Print Sheets
                </h3>
                <p className="text-xs text-slate-400">Total paper throughput across all printers</p>
              </div>
            </div>

            <div className="h-44 pt-4 flex items-end justify-between gap-3 px-2 border-b border-slate-800/80">
              {chartData.map((d, i) => {
                const pct = Math.max(10, Math.round((d.sheets / maxSheets) * 100))
                return (
                  <div key={i} className="flex-1 flex flex-col items-center h-full justify-end group relative">
                    <div className="absolute -top-8 opacity-0 group-hover:opacity-100 transition-opacity bg-slate-900 border border-slate-700 text-white text-[10px] font-bold px-2 py-1 rounded z-20">
                      {d.sheets} sheets
                    </div>
                    <div
                      style={{ height: `${pct}%` }}
                      className="w-full max-w-[36px] bg-gradient-to-t from-purple-500/30 to-purple-400 rounded-t-lg transition-all"
                    />
                    <span className="text-[10px] text-slate-400 mt-2 font-semibold">
                      {d.date.split(',')[0]}
                    </span>
                  </div>
                )
              })}
            </div>
          </div>
        </div>

        {/* Payment Channel Breakdown Card */}
        <div className="bg-[#0d131f] border border-slate-800 rounded-2xl p-6 shadow-xl">
          <h3 className="text-sm font-bold text-white mb-1">Payment Method Distribution</h3>
          <p className="text-xs text-slate-400 mb-4">Channel share between contactless digital checkout and cashier OTP redemption</p>

          <div className="w-full h-4 bg-slate-900 rounded-full overflow-hidden flex border border-slate-800 mb-4">
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

          <div className="grid grid-cols-2 gap-4">
            <div className="p-3.5 rounded-xl bg-slate-900/80 border border-slate-800 flex items-center justify-between">
              <div>
                <span className="text-xs font-bold text-white block">Digital (bKash / Card / Online)</span>
                <span className="text-[11px] text-slate-400">Automatic kiosk instant release</span>
              </div>
              <div className="text-right">
                <span className="font-mono text-base font-bold text-[#00bf63]">{onlinePercent}%</span>
                <span className="text-[10px] text-slate-400 block">৳{stats.onlineRevenue}</span>
              </div>
            </div>

            <div className="p-3.5 rounded-xl bg-slate-900/80 border border-slate-800 flex items-center justify-between">
              <div>
                <span className="text-xs font-bold text-white block">Cash at Counter</span>
                <span className="text-[11px] text-slate-400">Paid directly to shop operator</span>
              </div>
              <div className="text-right">
                <span className="font-mono text-base font-bold text-amber-400">{cashPercent}%</span>
                <span className="text-[10px] text-slate-400 block">৳{stats.cashRevenue}</span>
              </div>
            </div>
          </div>
        </div>

        {/* Shop Print Volumes & Earnings Leaderboard (SaaS Subscription Model) */}
        <div className="bg-[#0d131f] border border-slate-800 rounded-2xl overflow-hidden shadow-xl">
          <div className="p-5 border-b border-slate-800 flex flex-col sm:flex-row sm:items-center justify-between gap-3">
            <div>
              <h3 className="text-sm font-bold text-white flex items-center gap-2">
                <Award className="w-4 h-4 text-[#00bf63]" /> Shop Print Volumes & Earnings Leaderboard
              </h3>
              <p className="text-xs text-slate-400 mt-0.5">
                SaaS model: Shop partners keep 100% of their print customer revenue. Track copies printed and shop payouts.
              </p>
            </div>
            <div className="text-xs text-slate-400 bg-slate-900 border border-slate-800 px-3 py-1.5 rounded-xl font-medium self-start sm:self-auto">
              {(data?.shopLeaderboard || []).length} Active Hardware Stations
            </div>
          </div>

          <div className="overflow-x-auto">
            <table className="w-full text-left text-xs">
              <thead className="bg-[#090d16] text-slate-400 border-b border-slate-800">
                <tr>
                  <th className="py-3 px-4 font-semibold">Rank / Station</th>
                  <th className="py-3 px-4 font-semibold">Hardware Type</th>
                  <th className="py-3 px-4 font-semibold">SaaS Subscription</th>
                  <th className="py-3 px-4 font-semibold text-center">Jobs</th>
                  <th className="py-3 px-4 font-semibold">Copies / Sheets</th>
                  <th className="py-3 px-4 font-semibold text-right">Shop Earnings (100%)</th>
                  <th className="py-3 px-4 font-semibold text-right">Telemetry</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-800/60 text-slate-300">
                {(data?.shopLeaderboard || []).length === 0 ? (
                  <tr>
                    <td colSpan={7} className="py-8 text-center text-slate-500 text-xs">
                      No active stations or print history found.
                    </td>
                  </tr>
                ) : (
                  (data?.shopLeaderboard || []).map((shop, index) => {
                    const isKiosk = shop.type === 'kiosk'
                    return (
                      <tr key={shop.id} className="hover:bg-slate-800/20 transition-colors">
                        <td className="py-3 px-4">
                          <div className="flex items-center gap-2.5">
                            <span className={`w-5 h-5 rounded-full flex items-center justify-center text-[10px] font-bold ${
                              index === 0
                                ? 'bg-amber-500/20 text-amber-300 border border-amber-500/40'
                                : index === 1
                                ? 'bg-slate-400/20 text-slate-300 border border-slate-400/40'
                                : index === 2
                                ? 'bg-orange-500/20 text-orange-300 border border-orange-500/40'
                                : 'bg-slate-900 text-slate-500 border border-slate-800'
                            }`}>
                              {index + 1}
                            </span>
                            <div>
                              <div className="font-bold text-white text-xs flex items-center gap-1.5">
                                {shop.name}
                                {shop.status === 'online' && (
                                  <span className="w-1.5 h-1.5 rounded-full bg-[#00bf63]" title="Online" />
                                )}
                              </div>
                              <div className="text-[11px] text-slate-400 truncate max-w-[220px]">
                                {shop.address}
                              </div>
                            </div>
                          </div>
                        </td>

                        <td className="py-3 px-4">
                          <span className={`inline-flex items-center gap-1 text-[10px] font-bold px-2 py-0.5 rounded uppercase tracking-wider ${
                            isKiosk
                              ? 'bg-purple-500/15 text-purple-400 border border-purple-500/30'
                              : 'bg-blue-500/15 text-blue-400 border border-blue-500/30'
                          }`}>
                            {isKiosk ? <HardDrive className="w-2.5 h-2.5" /> : <Store className="w-2.5 h-2.5" />}
                            {shop.type}
                          </span>
                        </td>

                        <td className="py-3 px-4">
                          <div className="flex flex-col">
                            <span className="font-medium text-emerald-400 text-xs">
                              {shop.subscriptionPlan || 'Pro SaaS'}
                            </span>
                            <span className="text-[10px] text-slate-400">
                              Status: <span className="capitalize text-slate-300 font-semibold">{shop.subscriptionStatus || 'Active'}</span> (0% fee)
                            </span>
                          </div>
                        </td>

                        <td className="py-3 px-4 text-center font-mono font-bold text-white">
                          {shop.totalJobs}
                        </td>

                        <td className="py-3 px-4">
                          <div className="font-bold text-white text-sm font-mono">
                            {shop.totalSheets.toLocaleString()}{' '}
                            <span className="text-[10px] font-normal text-slate-400 font-sans">copies</span>
                          </div>
                          <div className="text-[10px] text-slate-400">
                            <span>{shop.bwSheets} B&W</span> · <span className="text-[#00bf63]">{shop.colorSheets} Color</span>
                          </div>
                        </td>

                        <td className="py-3 px-4 text-right">
                          <div className="font-extrabold text-base text-[#00bf63] font-mono">
                            ৳{(shop.shopEarnings || 0).toLocaleString()}
                          </div>
                          <span className="text-[10px] text-slate-500 font-medium">
                            100% full payout
                          </span>
                        </td>

                        <td className="py-3 px-4 text-right">
                          <Button
                            size="sm"
                            variant="outline"
                            onClick={() => setSelectedDeviceForModal(shop)}
                            className="h-7 px-2.5 text-[11px] bg-slate-900 border-slate-800 text-slate-300 hover:text-white hover:border-slate-700"
                          >
                            <ExternalLink className="w-3 h-3 mr-1 text-[#00bf63]" />
                            View Ledger
                          </Button>
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

      {/* Station Performance Telemetry Modal */}
      {selectedDeviceForModal && (
        <DevicePerformanceModal
          isOpen={Boolean(selectedDeviceForModal)}
          onClose={() => setSelectedDeviceForModal(null)}
          device={selectedDeviceForModal}
        />
      )}
    </div>
  )
}
