'use client'

import React, { useState, useEffect } from 'react'
import {
  Star,
  MessageSquare,
  MessageSquareHeart,
  TrendingUp,
  ThumbsUp,
  Filter,
  Search,
  RefreshCw,
  Download,
  Trash2,
  Calendar,
  Tag,
  HardDrive,
  KeyRound,
  Check,
  Copy,
  AlertCircle,
} from 'lucide-react'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Badge } from '@/components/ui/badge'
import AdminHeader from '@/components/admin/AdminHeader'

let clientFeedbackCache = null

export default function AdminFeedbackPage() {
  const [feedbacks, setFeedbacks] = useState(() => clientFeedbackCache?.feedbacks || [])
  const [metrics, setMetrics] = useState(() => clientFeedbackCache?.metrics || {
    totalFeedback: 0,
    averageRating: 5.0,
    positivePercentage: 100,
    ratingBreakdown: { 5: 0, 4: 0, 3: 0, 2: 0, 1: 0 },
    tagFrequencies: {},
  })
  const [loading, setLoading] = useState(() => !clientFeedbackCache)
  const [refreshing, setRefreshing] = useState(false)
  const [selectedRating, setSelectedRating] = useState('all')
  const [searchQuery, setSearchQuery] = useState('')
  const [onlyWithMessages, setOnlyWithMessages] = useState(false)
  const [copiedId, setCopiedId] = useState(null)
  const [deletingId, setDeletingId] = useState(null)

  const fetchFeedback = async () => {
    setRefreshing(true)
    try {
      const url = selectedRating === 'all'
        ? '/api/admin/feedback'
        : `/api/admin/feedback?rating=${selectedRating}`
      const res = await fetch(url)
      const data = await res.json()
      if (data?.feedbacks) {
        setFeedbacks(data.feedbacks)
      }
      if (data?.metrics) {
        setMetrics(data.metrics)
      }
      if (data) {
        clientFeedbackCache = {
          feedbacks: data.feedbacks || [],
          metrics: data.metrics || metrics,
        }
      }
    } catch (err) {
      console.error('Failed to load customer feedback:', err)
    } finally {
      setLoading(false)
      setRefreshing(false)
    }
  }

  useEffect(() => {
    fetchFeedback()
  }, [selectedRating])

  const copyToClipboard = (text, id) => {
    if (!text) return
    navigator.clipboard.writeText(text)
    setCopiedId(id)
    setTimeout(() => setCopiedId(null), 1800)
  }

  const handleDeleteFeedback = async (id) => {
    if (!confirm('Are you sure you want to remove this feedback record?')) return
    setDeletingId(id)
    try {
      const res = await fetch(`/api/admin/feedback?id=${id}`, {
        method: 'DELETE',
      })
      if (res.ok) {
        setFeedbacks((prev) => prev.filter((item) => item.id !== id))
      }
    } catch (err) {
      console.error('Failed to delete feedback:', err)
    } finally {
      setDeletingId(null)
    }
  }

  const handleExportCsv = () => {
    if (!feedbacks.length) return
    const headers = ['Feedback ID', 'Rating', 'Tags', 'Customer Message', 'OTP Code', 'Device ID', 'Job ID', 'Timestamp']
    const rows = feedbacks.map((f) => [
      `"${f.id || ''}"`,
      f.rating || 5,
      `"${(f.tags || []).join(', ')}"`,
      `"${(f.message || '').replace(/"/g, '""')}"`,
      `"${f.otp_code || ''}"`,
      `"${f.device_id || ''}"`,
      `"${f.job_id || ''}"`,
      `"${f.created_at || ''}"`,
    ])

    const csvContent = 'data:text/csv;charset=utf-8,' + [headers.join(','), ...rows.map((e) => e.join(','))].join('\n')
    const encodedUri = encodeURI(csvContent)
    const link = document.createElement('a')
    link.setAttribute('href', encodedUri)
    link.setAttribute('download', `customer_feedbacks_${new Date().toISOString().slice(0, 10)}.csv`)
    document.body.appendChild(link)
    link.click()
    document.body.removeChild(link)
  }

  // Filtered feedbacks based on search and optional message toggle
  const filteredFeedbacks = feedbacks.filter((f) => {
    if (onlyWithMessages && (!f.message || !f.message.trim())) {
      return false
    }
    if (!searchQuery.trim()) return true

    const query = searchQuery.toLowerCase()
    const matchOtp = f.otp_code && f.otp_code.toLowerCase().includes(query)
    const matchMsg = f.message && f.message.toLowerCase().includes(query)
    const matchDevice = f.device_id && f.device_id.toLowerCase().includes(query)
    const matchTags = Array.isArray(f.tags) && f.tags.some((t) => t.toLowerCase().includes(query))
    const matchJob = f.job_id && f.job_id.toLowerCase().includes(query)

    return matchOtp || matchMsg || matchDevice || matchTags || matchJob
  })

  return (
    <div className="flex-1 flex flex-col min-h-screen bg-slate-50 dark:bg-black transition-colors">
      <AdminHeader
        title="Customer Satisfaction & Feedback"
        subtitle="Review ratings, kiosk experience feedback, and optional messages submitted by customers at the OTP screen"
        onRefresh={fetchFeedback}
        isRefreshing={refreshing}
      />

      <main className="p-4 sm:p-6 lg:p-8 space-y-6 max-w-7xl mx-auto w-full">
        {/* KPI Metrics Grid */}
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
          <div className="bg-white dark:bg-[#0a0a0a] border border-slate-200 dark:border-slate-800/80 rounded-xl p-5 shadow-xs transition-colors">
            <div className="flex items-center justify-between">
              <span className="text-xs font-semibold uppercase tracking-wider text-slate-500 dark:text-slate-400">Average Rating</span>
              <div className="w-8 h-8 rounded-lg bg-amber-50 dark:bg-amber-500/10 border border-amber-200 dark:border-amber-500/20 flex items-center justify-center text-amber-500">
                <Star className="w-4 h-4 fill-amber-400 text-amber-500" />
              </div>
            </div>
            <div className="mt-3 flex items-baseline gap-2">
              <span className="text-3xl font-extrabold text-slate-900 dark:text-white">{metrics.averageRating || '5.0'}</span>
              <span className="text-sm font-medium text-slate-400">/ 5.0</span>
            </div>
            <div className="mt-2 flex items-center gap-1">
              {[1, 2, 3, 4, 5].map((s) => (
                <Star
                  key={s}
                  className={`w-3.5 h-3.5 ${
                    s <= Math.round(metrics.averageRating || 5)
                      ? 'fill-amber-400 text-amber-500'
                      : 'text-slate-300 dark:text-slate-600'
                  }`}
                />
              ))}
              <span className="text-[11px] text-slate-500 dark:text-slate-400 ml-1.5 font-medium">Customer score</span>
            </div>
          </div>

          <div className="bg-white dark:bg-[#0a0a0a] border border-slate-200 dark:border-slate-800/80 rounded-xl p-5 shadow-xs transition-colors">
            <div className="flex items-center justify-between">
              <span className="text-xs font-semibold uppercase tracking-wider text-slate-500 dark:text-slate-400">Total Feedbacks</span>
              <div className="w-8 h-8 rounded-lg bg-emerald-50 dark:bg-emerald-500/10 border border-emerald-200 dark:border-emerald-500/20 flex items-center justify-center text-[#00bf63]">
                <MessageSquareHeart className="w-4 h-4" />
              </div>
            </div>
            <div className="mt-3 flex items-baseline gap-2">
              <span className="text-3xl font-extrabold text-slate-900 dark:text-white">{feedbacks.length}</span>
              <span className="text-xs text-slate-500 dark:text-slate-400">submissions</span>
            </div>
            <p className="mt-2 text-[11px] text-slate-500 dark:text-slate-400">Post-OTP submission channel</p>
          </div>

          <div className="bg-white dark:bg-[#0a0a0a] border border-slate-200 dark:border-slate-800/80 rounded-xl p-5 shadow-xs transition-colors">
            <div className="flex items-center justify-between">
              <span className="text-xs font-semibold uppercase tracking-wider text-slate-500 dark:text-slate-400">Positive Sentiment</span>
              <div className="w-8 h-8 rounded-lg bg-blue-50 dark:bg-blue-500/10 border border-blue-200 dark:border-blue-500/20 flex items-center justify-center text-blue-500">
                <ThumbsUp className="w-4 h-4" />
              </div>
            </div>
            <div className="mt-3 flex items-baseline gap-2">
              <span className="text-3xl font-extrabold text-slate-900 dark:text-white">{metrics.positivePercentage}%</span>
              <span className="text-xs text-[#00bf63] font-semibold">4★ & 5★ ratings</span>
            </div>
            <p className="mt-2 text-[11px] text-slate-500 dark:text-slate-400">CSAT benchmark over 90%</p>
          </div>

          <div className="bg-white dark:bg-[#0a0a0a] border border-slate-200 dark:border-slate-800/80 rounded-xl p-5 shadow-xs transition-colors">
            <div className="flex items-center justify-between">
              <span className="text-xs font-semibold uppercase tracking-wider text-slate-500 dark:text-slate-400">Detailed Messages</span>
              <div className="w-8 h-8 rounded-lg bg-slate-100 dark:bg-slate-900 border border-slate-200 dark:border-slate-800 flex items-center justify-center text-slate-700 dark:text-slate-300">
                <MessageSquare className="w-4 h-4" />
              </div>
            </div>
            <div className="mt-3 flex items-baseline gap-2">
              <span className="text-3xl font-extrabold text-slate-900 dark:text-white">
                {feedbacks.filter((f) => f.message && f.message.trim()).length}
              </span>
              <span className="text-xs text-slate-500 dark:text-slate-400">reviews with text</span>
            </div>
            <p className="mt-2 text-[11px] text-slate-500 dark:text-slate-400">Direct customer commentary</p>
          </div>
        </div>

        {/* Breakdown & Tags Panel */}
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-4">
          {/* Star Distribution */}
          <div className="bg-white dark:bg-[#0a0a0a] border border-slate-200 dark:border-slate-800/80 rounded-xl p-5 shadow-xs transition-colors">
            <h3 className="text-xs font-bold uppercase tracking-wider text-slate-500 dark:text-slate-400 mb-4 flex items-center gap-2">
              <TrendingUp className="w-3.5 h-3.5 text-[#00bf63]" /> Star Rating Breakdown
            </h3>
            <div className="space-y-2">
              {[5, 4, 3, 2, 1].map((star) => {
                const count = metrics.ratingBreakdown?.[star] || 0
                const percent = metrics.totalFeedback > 0
                  ? Math.round((count / metrics.totalFeedback) * 100)
                  : 0
                return (
                  <div key={star} className="flex items-center gap-3 text-xs">
                    <span className="w-9 font-semibold text-slate-700 dark:text-slate-300 flex items-center gap-1">
                      {star} <Star className="w-3 h-3 fill-amber-400 text-amber-500 inline" />
                    </span>
                    <div className="flex-1 bg-slate-100 dark:bg-slate-900 rounded-full h-2 overflow-hidden border border-slate-200/60 dark:border-slate-800">
                      <div
                        className="bg-amber-400 h-full rounded-full transition-all duration-500"
                        style={{ width: `${percent}%` }}
                      />
                    </div>
                    <span className="w-10 text-right text-slate-500 dark:text-slate-400 font-mono text-[11px]">{count}</span>
                  </div>
                )
              })}
            </div>
          </div>

          {/* Quick Tags Cloud */}
          <div className="bg-white dark:bg-[#0a0a0a] border border-slate-200 dark:border-slate-800/80 rounded-xl p-5 lg:col-span-2 shadow-xs transition-colors">
            <h3 className="text-xs font-bold uppercase tracking-wider text-slate-500 dark:text-slate-400 mb-4 flex items-center gap-2">
              <Tag className="w-3.5 h-3.5 text-[#00bf63]" /> Frequently Selected Tags
            </h3>
            <div className="flex flex-wrap gap-2">
              {Object.keys(metrics.tagFrequencies || {}).length > 0 ? (
                Object.entries(metrics.tagFrequencies).map(([tag, count]) => (
                  <Badge
                    key={tag}
                    variant="outline"
                    className="bg-slate-50 dark:bg-slate-950 border-slate-200 dark:border-slate-800 text-slate-700 dark:text-slate-300 px-3 py-1.5 text-xs rounded-lg flex items-center gap-1.5"
                  >
                    <span>{tag}</span>
                    <span className="bg-[#00bf63]/15 text-[#00bf63] px-1.5 py-0.2 rounded font-mono font-bold text-[10px]">
                      {count}
                    </span>
                  </Badge>
                ))
              ) : (
                <div className="text-xs text-slate-400 dark:text-slate-500 italic py-2">
                  No tag selections registered yet.
                </div>
              )}
            </div>
          </div>
        </div>

        {/* Filter & Action Toolbar */}
        <div className="bg-white dark:bg-[#0a0a0a] border border-slate-200 dark:border-slate-800/80 rounded-xl p-4 flex flex-col md:flex-row items-stretch md:items-center justify-between gap-3 shadow-xs transition-colors">
          <div className="flex flex-wrap items-center gap-2">
            <div className="relative min-w-[220px]">
              <Search className="w-3.5 h-3.5 absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" />
              <Input
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                placeholder="Search OTP, device, or text..."
                className="bg-slate-50 dark:bg-slate-950 border-slate-200 dark:border-slate-800 pl-9 h-9 text-xs text-slate-900 dark:text-white placeholder:text-slate-400 rounded-lg w-full"
              />
            </div>

            {/* Rating Filter Tabs */}
            <div className="flex items-center bg-slate-100 dark:bg-slate-950 border border-slate-200 dark:border-slate-800 rounded-lg p-0.5 text-xs">
              {['all', '5', '4', '3', '2', '1'].map((r) => (
                <button
                  key={r}
                  onClick={() => setSelectedRating(r)}
                  className={`px-2.5 py-1 rounded-md font-medium transition-colors ${
                    selectedRating === r
                      ? 'bg-[#00bf63] text-slate-950 font-bold shadow-xs'
                      : 'text-slate-600 dark:text-slate-400 hover:text-slate-900 dark:hover:text-white'
                  }`}
                >
                  {r === 'all' ? 'All Stars' : `${r}★`}
                </button>
              ))}
            </div>

            {/* Message Only Toggle */}
            <button
              onClick={() => setOnlyWithMessages(!onlyWithMessages)}
              className={`px-3 py-1.5 rounded-lg border text-xs font-semibold transition-colors flex items-center gap-1.5 ${
                onlyWithMessages
                  ? 'bg-slate-900 text-white border-slate-900 dark:bg-white dark:text-black dark:border-white shadow-xs'
                  : 'bg-slate-50 dark:bg-slate-950 border-slate-200 dark:border-slate-800 text-slate-600 dark:text-slate-400 hover:text-slate-900 dark:hover:text-white'
              }`}
            >
              <MessageSquare className="w-3.5 h-3.5" />
              <span>With Messages ({feedbacks.filter((f) => f.message && f.message.trim()).length})</span>
            </button>
          </div>

          <div className="flex items-center gap-2 self-end md:self-auto">
            <Button
              onClick={handleExportCsv}
              variant="outline"
              disabled={filteredFeedbacks.length === 0}
              className="bg-white dark:bg-slate-950 hover:bg-slate-50 dark:hover:bg-slate-900 border-slate-200 dark:border-slate-800 text-slate-700 dark:text-slate-300 text-xs h-9 px-3 rounded-lg shadow-none flex items-center gap-1.5"
            >
              <Download className="w-3.5 h-3.5" /> Export CSV
            </Button>
          </div>
        </div>

        {/* Customer Feedbacks Feed / List */}
        <div className="space-y-3">
          {loading ? (
            <div className="bg-white dark:bg-[#0a0a0a] border border-slate-200 dark:border-slate-800/80 rounded-xl p-12 text-center shadow-xs">
              <RefreshCw className="w-6 h-6 animate-spin text-[#00bf63] mx-auto mb-2" />
              <p className="text-xs font-medium text-slate-500 dark:text-slate-400">Loading customer feedbacks...</p>
            </div>
          ) : filteredFeedbacks.length === 0 ? (
            <div className="bg-white dark:bg-[#0a0a0a] border border-slate-200 dark:border-slate-800/80 rounded-xl p-12 text-center shadow-xs">
              <MessageSquare className="w-10 h-10 text-slate-300 dark:text-slate-600 mx-auto mb-3" />
              <p className="text-sm font-bold text-slate-900 dark:text-white">No feedback records found</p>
              <p className="text-xs text-slate-500 dark:text-slate-400 mt-1 max-w-sm mx-auto">
                No customer ratings matched your selected star filter or search criteria.
              </p>
            </div>
          ) : (
            filteredFeedbacks.map((item) => (
              <div
                key={item.id}
                className="bg-white dark:bg-[#0a0a0a] border border-slate-200 dark:border-slate-800/80 hover:border-slate-300 dark:hover:border-slate-700 transition-colors rounded-xl p-5 text-slate-700 dark:text-slate-300 shadow-xs"
              >
                <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 pb-3 border-b border-slate-200 dark:border-slate-800">
                  <div className="flex items-center gap-3">
                    {/* Stars */}
                    <div className="flex items-center gap-1 bg-amber-50 dark:bg-amber-400/10 px-2.5 py-1 rounded-lg border border-amber-200 dark:border-amber-400/20">
                      {[1, 2, 3, 4, 5].map((s) => (
                        <Star
                          key={s}
                          className={`w-3.5 h-3.5 ${
                            s <= (item.rating || 5)
                              ? 'fill-amber-400 text-amber-500'
                              : 'text-slate-300 dark:text-slate-700'
                          }`}
                        />
                      ))}
                      <span className="text-xs font-bold text-amber-700 dark:text-amber-300 ml-1">
                        {item.rating || 5}.0
                      </span>
                    </div>

                    {/* OTP Badge */}
                    {item.otp_code && (
                      <div className="flex items-center gap-1.5 bg-slate-50 dark:bg-slate-900 px-2.5 py-1 rounded-lg border border-slate-200 dark:border-slate-700 text-xs">
                        <KeyRound className="w-3 h-3 text-[#00bf63]" />
                        <span className="text-slate-500 dark:text-slate-400">OTP:</span>
                        <span className="font-mono font-bold text-slate-900 dark:text-white">{item.otp_code}</span>
                        <button
                          onClick={() => copyToClipboard(item.otp_code, `otp_${item.id}`)}
                          className="hover:text-slate-900 dark:hover:text-white text-slate-400 ml-0.5"
                          title="Copy OTP"
                        >
                          {copiedId === `otp_${item.id}` ? (
                            <Check className="w-3 h-3 text-[#00bf63]" />
                          ) : (
                            <Copy className="w-3 h-3" />
                          )}
                        </button>
                      </div>
                    )}

                    {/* Device Identifier */}
                    {item.device_id && (
                      <div className="hidden md:flex items-center gap-1 bg-slate-50 dark:bg-slate-900 px-2.5 py-1 rounded-lg border border-slate-200 dark:border-slate-800 text-[11px] text-slate-500 dark:text-slate-400">
                        <HardDrive className="w-3 h-3 text-slate-400" />
                        <span className="font-mono">{item.device_id}</span>
                      </div>
                    )}
                  </div>

                  <div className="flex items-center gap-3 text-xs text-slate-500 dark:text-slate-400">
                    <span className="flex items-center gap-1">
                      <Calendar className="w-3.5 h-3.5 text-slate-400" />
                      {new Date(item.created_at || Date.now()).toLocaleString()}
                    </span>
                    <button
                      onClick={() => handleDeleteFeedback(item.id)}
                      disabled={deletingId === item.id}
                      className="p-1.5 hover:bg-red-50 dark:hover:bg-red-500/10 hover:text-red-500 rounded text-slate-400 transition-colors"
                      title="Delete Feedback Record"
                    >
                      <Trash2 className="w-3.5 h-3.5" />
                    </button>
                  </div>
                </div>

                {/* Feedback Message (Optional Message written by user) */}
                {item.message ? (
                  <div className="mt-3 bg-slate-50 dark:bg-slate-950 border border-slate-200 dark:border-slate-800/80 rounded-lg p-3 text-xs leading-relaxed text-slate-800 dark:text-slate-200">
                    <div className="text-[10px] font-bold uppercase tracking-wider text-slate-500 mb-1 flex items-center gap-1">
                      <MessageSquare className="w-3 h-3 text-[#00bf63]" /> Customer Comment:
                    </div>
                    &ldquo;{item.message}&rdquo;
                  </div>
                ) : (
                  <div className="mt-2 text-[11px] text-slate-400 dark:text-slate-500 italic">
                    No optional written message provided.
                  </div>
                )}

                {/* Selected Tags */}
                {Array.isArray(item.tags) && item.tags.length > 0 && (
                  <div className="mt-3 flex flex-wrap gap-1.5">
                    {item.tags.map((tag, idx) => (
                      <span
                        key={idx}
                        className="bg-slate-100 dark:bg-slate-900 border border-slate-200 dark:border-slate-800 text-slate-700 dark:text-slate-300 text-[11px] px-2.5 py-0.5 rounded-full"
                      >
                        {tag}
                      </span>
                    ))}
                  </div>
                )}
              </div>
            ))
          )}
        </div>
      </main>
    </div>
  )
}
