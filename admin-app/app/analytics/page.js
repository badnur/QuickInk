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
  DollarSign
} from 'lucide-react'
import { Button } from '@/components/ui/button'
import AdminHeader from '@/components/admin/AdminHeader'
import StatCard from '@/components/admin/StatCard'

export default function AdminAnalyticsPage() {
  const [data, setData] = useState(null)
  const [loading, setLoading] = useState(true)
  const [refreshing, setRefreshing] = useState(false)

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
      </main>
    </div>
  )
}
