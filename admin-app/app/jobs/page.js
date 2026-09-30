'use client'

import { useState, useEffect, useCallback, useRef } from 'react'
import {
  Printer,
  Search,
  Filter,
  CheckCircle2,
  Clock,
  AlertCircle,
  FileText,
  ExternalLink,
  Eye,
  KeyRound,
  RefreshCw,
  Copy,
  Check,
  Ban,
  Download
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
import { supabase } from '@/lib/supabase'
import { useAdminData } from '@/lib/use-admin-data'

export default function AdminJobsPage() {
  const [search, setSearch] = useState('')
  const [debouncedSearch, setDebouncedSearch] = useState('')
  const [statusFilter, setStatusFilter] = useState('all')
  const [selectedJob, setSelectedJob] = useState(null)
  const [actionLoading, setActionLoading] = useState(false)
  const [copiedOtp, setCopiedOtp] = useState(false)

  // Debounce search input by 300ms to avoid constant API requests and UI stutter
  useEffect(() => {
    const handler = setTimeout(() => {
      setDebouncedSearch(search)
    }, 300)
    return () => clearTimeout(handler)
  }, [search])

  const cacheKey = `admin_jobs_${statusFilter}_50`
  const queryUrl = `/api/admin/jobs?status=${statusFilter}${debouncedSearch.trim() ? `&search=${encodeURIComponent(debouncedSearch.trim())}` : ''}`
  
  const {
    data,
    loading: swrLoading,
    refreshing,
    refetch: fetchJobs,
    mutate: mutateJobs,
  } = useAdminData(cacheKey, queryUrl)

  const jobs = data?.jobs || []
  const loading = swrLoading && jobs.length === 0

  // Realtime subscription setup ONLY once or when statusFilter changes (NOT on every keystroke)
  const fetchJobsRef = useRef(fetchJobs)
  fetchJobsRef.current = fetchJobs

  useEffect(() => {
    const channel = supabase
      .channel('admin_jobs_live_table')
      .on(
        'postgres_changes',
        { event: '*', schema: 'public', table: 'print_jobs' },
        () => {
          fetchJobsRef.current?.(false)
        }
      )
      .subscribe()

    return () => {
      supabase.removeChannel(channel)
    }
  }, [])

  const handleUpdateStatus = async (jobId, newStatus) => {
    setActionLoading(true)
    try {
      const res = await fetch('/api/admin/jobs', {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ jobId, status: newStatus }),
      })
      if (res.ok) {
        if (selectedJob && selectedJob.id === jobId) {
          setSelectedJob((prev) => ({ ...prev, status: newStatus }))
        }
        fetchJobs(true)
      }
    } catch (err) {
      console.error('Status update failed:', err)
    } finally {
      setActionLoading(false)
    }
  }

  const handleCopy = (text) => {
    navigator.clipboard.writeText(text)
    setCopiedOtp(true)
    setTimeout(() => setCopiedOtp(false), 2000)
  }

  return (
    <div className="flex-1 flex flex-col min-h-screen bg-slate-50 dark:bg-black transition-colors">
      <AdminHeader
        title="Live Print Jobs"
        subtitle="Real-time monitor of incoming print jobs, customer OTPs, and printing status"
        onRefresh={() => fetchJobs(true)}
        isRefreshing={refreshing}
      />

      <main className="p-4 sm:p-6 lg:p-8 space-y-5 max-w-7xl mx-auto w-full">
        {/* Filters & Search Toolbar */}
        <div className="bg-white dark:bg-[#0a0a0a] border border-slate-200 dark:border-slate-800/80 rounded-xl p-3 sm:p-4 flex flex-col sm:flex-row items-stretch sm:items-center justify-between gap-3 shadow-xs transition-colors">
          {/* Status Tabs */}
          <div className="flex items-center gap-1 overflow-x-auto pb-1 sm:pb-0">
            {[
              { id: 'all', label: 'All Orders' },
              { id: 'awaiting_redemption', label: 'Pending / Awaiting' },
              { id: 'redeemed', label: 'Redeemed' },
              { id: 'printed', label: 'Completed' },
              { id: 'expired', label: 'Expired' },
            ].map((tab) => (
              <button
                key={tab.id}
                onClick={() => setStatusFilter(tab.id)}
                className={`px-3 py-1.5 rounded-lg text-xs font-medium whitespace-nowrap transition-colors ${
                  statusFilter === tab.id
                    ? 'bg-slate-900 text-white dark:bg-slate-800 dark:text-white font-semibold shadow-xs'
                    : 'text-slate-600 dark:text-slate-400 hover:text-slate-900 dark:hover:text-white hover:bg-slate-100 dark:hover:bg-slate-900'
                }`}
              >
                {tab.label}
              </button>
            ))}
          </div>

          {/* Search Box */}
          <div className="relative w-full sm:w-64">
            <Search className="w-3.5 h-3.5 text-slate-400 absolute left-3 top-1/2 -translate-y-1/2" />
            <Input
              placeholder="Search OTP, Job ID, File..."
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              className="pl-8 pr-3 py-1 text-xs bg-slate-50 dark:bg-slate-900 border-slate-200 dark:border-slate-800 text-slate-900 dark:text-white placeholder:text-slate-400 dark:placeholder:text-slate-500 rounded-lg h-8 focus-visible:ring-0 focus-visible:border-slate-400 dark:focus-visible:border-slate-700"
            />
          </div>
        </div>

        {/* Jobs Table */}
        <div className="bg-white dark:bg-[#0a0a0a] border border-slate-200 dark:border-slate-800/80 rounded-xl overflow-hidden shadow-xs transition-colors">
          <div className="overflow-x-auto">
            <table className="w-full text-left text-xs">
              <thead className="bg-slate-50 dark:bg-slate-900/60 text-slate-500 dark:text-slate-400 border-b border-slate-200 dark:border-slate-800 uppercase tracking-wider text-[10px]">
                <tr>
                  <th className="py-2.5 px-4 font-semibold">Order ID & OTP</th>
                  <th className="py-2.5 px-4 font-semibold">Document</th>
                  <th className="py-2.5 px-4 font-semibold">Specifications</th>
                  <th className="py-2.5 px-4 font-semibold">Payment</th>
                  <th className="py-2.5 px-4 font-semibold">Status</th>
                  <th className="py-2.5 px-4 font-semibold">Created</th>
                  <th className="py-2.5 px-4 text-right font-semibold">Actions</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100 dark:divide-slate-800/60 font-normal">
                {jobs.length === 0 ? (
                  <tr>
                    <td colSpan={7} className="text-center py-12 text-slate-400 dark:text-slate-500">
                      {loading ? (
                        <div className="flex flex-col items-center gap-2">
                          <RefreshCw className="w-5 h-5 text-[#00bf63] animate-spin" />
                          <span>Loading print jobs...</span>
                        </div>
                      ) : (
                        'No print jobs found matching the selected filter.'
                      )}
                    </td>
                  </tr>
                ) : (
                  jobs.map((job) => {
                    const statusStyles = {
                      awaiting_redemption: 'bg-amber-50 dark:bg-amber-950/40 text-amber-700 dark:text-amber-400 border-amber-200 dark:border-amber-800/40',
                      redeemed: 'bg-blue-50 dark:bg-blue-950/40 text-blue-700 dark:text-blue-400 border-blue-200 dark:border-blue-800/40',
                      printed: 'bg-emerald-50 dark:bg-emerald-950/40 text-emerald-700 dark:text-emerald-400 border-emerald-200 dark:border-emerald-800/40',
                      expired: 'bg-slate-100 dark:bg-slate-900 text-slate-600 dark:text-slate-400 border-slate-200 dark:border-slate-800',
                      voided: 'bg-red-50 dark:bg-red-950/40 text-red-700 dark:text-red-400 border-red-200 dark:border-red-800/40',
                    }[job.status] || 'bg-slate-100 dark:bg-slate-900 text-slate-600 dark:text-slate-400 border-slate-200 dark:border-slate-800'

                    const otpCode = job.otps?.[0]?.code || job.otp?.code

                    return (
                      <tr key={job.id} className="hover:bg-slate-50/80 dark:hover:bg-slate-900/40 transition-colors">
                        <td className="py-3 px-4">
                          <div className="font-mono text-slate-700 dark:text-slate-300 font-medium">
                            #{job.id.substring(0, 8)}
                          </div>
                          {otpCode ? (
                            <span className="inline-flex items-center gap-1 font-mono text-[11px] font-semibold text-amber-700 dark:text-amber-400 bg-amber-50 dark:bg-amber-950/40 px-1.5 py-0.5 rounded border border-amber-200 dark:border-amber-800/30 mt-0.5">
                              <KeyRound className="w-2.5 h-2.5" /> {otpCode}
                            </span>
                          ) : (
                            <span className="text-[10px] text-slate-400">No OTP</span>
                          )}
                        </td>

                        <td className="py-3 px-4">
                          <div className="font-medium text-slate-900 dark:text-white truncate max-w-[200px]">
                            {job.file_name || 'Document.pdf'}
                          </div>
                          <span className="text-[10px] text-slate-500 dark:text-slate-400 uppercase">{job.file_type}</span>
                        </td>

                        <td className="py-3 px-4">
                          <span className="font-medium text-slate-800 dark:text-slate-200">
                            {job.page_count} {job.page_count === 1 ? 'page' : 'pages'}
                          </span>
                          <span className="text-[10px] text-slate-500 dark:text-slate-400 block">
                            {job.copies} {job.copies === 1 ? 'copy' : 'copies'} • {job.color_mode === 'color' ? 'Color' : 'B&W'}
                            {job.duplex ? ' • 2-Sided' : ''}
                            {job.page_range ? ` • Range: ${job.page_range}` : ''}
                          </span>
                        </td>

                        <td className="py-3 px-4">
                          <div className="font-medium text-slate-900 dark:text-white">৳{job.amount || '—'}</div>
                          <span className="text-[10px] text-slate-500 dark:text-slate-400 font-medium uppercase">
                            {job.payment_type}
                          </span>
                        </td>

                        <td className="py-3 px-4">
                          <span className={`inline-flex items-center px-2 py-0.5 rounded text-[10px] font-medium border ${statusStyles}`}>
                            {job.status?.replace('_', ' ')}
                          </span>
                        </td>

                        <td className="py-3 px-4 text-slate-600 dark:text-slate-400 text-[11px]">
                          <div>{new Date(job.created_at).toLocaleDateString()}</div>
                          <div className="text-[10px] text-slate-400 dark:text-slate-500">
                            {new Date(job.created_at).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
                          </div>
                        </td>

                        <td className="py-3 px-4 text-right">
                          <Button
                            size="sm"
                            variant="ghost"
                            onClick={() => setSelectedJob(job)}
                            className="h-7 px-2 text-xs text-emerald-600 dark:text-[#00bf63] hover:text-emerald-700 dark:hover:text-white hover:bg-slate-100 dark:hover:bg-slate-800 rounded font-medium"
                          >
                            <Eye className="w-3 h-3 mr-1" /> Inspect
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

      {/* Detailed Job Inspector Modal */}
      {selectedJob && (
        <Dialog open={Boolean(selectedJob)} onOpenChange={() => setSelectedJob(null)}>
          <DialogContent className="bg-white dark:bg-[#0a0a0a] border border-slate-200 dark:border-slate-800 text-slate-900 dark:text-white max-w-lg p-5 rounded-xl shadow-lg">
            <DialogHeader>
              <div className="flex items-center justify-between">
                <span className="text-[11px] font-mono text-slate-500 dark:text-slate-400 uppercase tracking-wider">
                  Print Job Details
                </span>
                <span className="text-xs font-mono font-medium text-slate-700 dark:text-slate-300">
                  #{selectedJob.id}
                </span>
              </div>
              <DialogTitle className="text-base font-semibold text-slate-900 dark:text-white mt-1 truncate">
                {selectedJob.file_name || 'Document.pdf'}
              </DialogTitle>
              <DialogDescription className="text-xs text-slate-500 dark:text-slate-400">
                Created on {new Date(selectedJob.created_at).toLocaleString()}
              </DialogDescription>
            </DialogHeader>

            {/* Specifications Card */}
            <div className="bg-slate-50 dark:bg-slate-900/60 border border-slate-200 dark:border-slate-800 rounded-lg p-3.5 space-y-3 my-2 text-xs">
              <div className="grid grid-cols-2 gap-3 pb-3 border-b border-slate-200 dark:border-slate-800">
                <div>
                  <span className="text-[10px] text-slate-500 dark:text-slate-400 font-medium block uppercase">Sheets / Pages</span>
                  <span className="font-semibold text-slate-900 dark:text-white text-sm">{selectedJob.page_count}</span>
                  {selectedJob.page_range && (
                    <span className="text-[10px] text-slate-500 dark:text-slate-400 block font-mono">
                      Range: {selectedJob.page_range}
                    </span>
                  )}
                </div>
                <div>
                  <span className="text-[10px] text-slate-500 dark:text-slate-400 font-medium block uppercase">Copies & Color</span>
                  <span className="font-semibold text-slate-900 dark:text-white text-sm">
                    {selectedJob.copies} {selectedJob.copies === 1 ? 'Copy' : 'Copies'}
                  </span>
                  <span className="text-[10px] text-slate-500 dark:text-slate-400 block">
                    {selectedJob.color_mode === 'color' ? 'Color' : 'B&W'}
                  </span>
                </div>
              </div>

              <div className="grid grid-cols-2 gap-3 pb-3 border-b border-slate-200 dark:border-slate-800">
                <div>
                  <span className="text-[10px] text-slate-500 dark:text-slate-400 font-medium block uppercase">Payment</span>
                  <span className="font-semibold text-slate-900 dark:text-white text-sm">
                    ৳{selectedJob.amount || '—'}
                  </span>
                  <span className="text-[10px] text-slate-500 dark:text-slate-400 block uppercase font-medium">
                    {selectedJob.payment_type}
                  </span>
                </div>

                <div>
                  <span className="text-[10px] text-slate-500 dark:text-slate-400 font-medium block uppercase">Redemption OTP</span>
                  <div className="flex items-center gap-2 mt-0.5">
                    <span className="font-mono text-sm font-bold text-amber-600 dark:text-amber-400">
                      {selectedJob.otps?.[0]?.code || 'N/A'}
                    </span>
                    {selectedJob.otps?.[0]?.code && (
                      <button
                        onClick={() => handleCopy(selectedJob.otps[0].code)}
                        className="text-slate-400 hover:text-slate-700 dark:hover:text-white"
                      >
                        {copiedOtp ? <Check className="w-3.5 h-3.5 text-emerald-500" /> : <Copy className="w-3.5 h-3.5" />}
                      </button>
                    )}
                  </div>
                </div>
              </div>

              {/* File Download / View Link */}
              {selectedJob.file_path && (
                <div className="pt-1 flex items-center justify-between">
                  <span className="text-slate-500 dark:text-slate-400 text-xs">Storage File:</span>
                  <a
                    href={selectedJob.file_path.startsWith('http') ? selectedJob.file_path : `/api/upload?path=${encodeURIComponent(selectedJob.file_path)}`}
                    target="_blank"
                    rel="noreferrer"
                    className="text-emerald-600 dark:text-[#00bf63] hover:underline flex items-center gap-1 font-medium text-xs"
                  >
                    <Download className="w-3.5 h-3.5" /> View File
                  </a>
                </div>
              )}
            </div>

            {/* Quick Action Controls */}
            <div className="pt-2 space-y-3">
              <div>
                <span className="text-[11px] font-medium text-slate-400 block mb-1.5">Support & Incident Resolution:</span>
                <div className="grid grid-cols-2 gap-2">
                  <Button
                    size="sm"
                    variant="outline"
                    disabled={actionLoading}
                    onClick={async () => {
                      setActionLoading(true)
                      try {
                        const res = await fetch('/api/admin/jobs', {
                          method: 'PATCH',
                          headers: { 'Content-Type': 'application/json' },
                          body: JSON.stringify({ jobId: selectedJob.id, action: 'EXTEND_OTP' }),
                        })
                        const data = await res.json()
                        if (res.ok && data.success) {
                          alert('OTP validity extended by 24 hours.')
                          fetchJobs(true)
                          setSelectedJob(null)
                        } else {
                          alert(data.error || 'Failed to extend OTP')
                        }
                      } finally {
                        setActionLoading(false)
                      }
                    }}
                    className="border-amber-500/30 bg-amber-500/10 text-amber-300 hover:bg-amber-500/20 text-xs h-8.5 rounded shadow-none font-medium"
                  >
                    <KeyRound className="w-3.5 h-3.5 mr-1" /> Extend OTP (+24h)
                  </Button>

                  <Button
                    size="sm"
                    variant="outline"
                    disabled={actionLoading || selectedJob.status === 'cancelled'}
                    onClick={async () => {
                      const reason = prompt('Please enter refund reason:', 'Customer requested cancel / Machine issue')
                      if (!reason) return
                      setActionLoading(true)
                      try {
                        const res = await fetch('/api/admin/jobs', {
                          method: 'PATCH',
                          headers: { 'Content-Type': 'application/json' },
                          body: JSON.stringify({ jobId: selectedJob.id, action: 'REFUND_JOB', refundReason: reason }),
                        })
                        const data = await res.json()
                        if (res.ok && data.success) {
                          alert('Job cancelled and marked as refunded.')
                          fetchJobs(true)
                          setSelectedJob(null)
                        } else {
                          alert(data.error || 'Failed to issue refund')
                        }
                      } finally {
                        setActionLoading(false)
                      }
                    }}
                    className="border-red-500/30 bg-red-500/10 text-red-400 hover:bg-red-500/20 text-xs h-8.5 rounded shadow-none font-medium"
                  >
                    <Ban className="w-3.5 h-3.5 mr-1" /> 1-Click Refund
                  </Button>
                </div>
              </div>

              <div>
                <span className="text-[11px] font-medium text-slate-400 block mb-1.5">Override Status:</span>
                <div className="grid grid-cols-3 gap-2">
                  <Button
                    size="sm"
                    disabled={actionLoading || selectedJob.status === 'printed' || selectedJob.status === 'completed'}
                    onClick={() => handleUpdateStatus(selectedJob.id, 'printed')}
                    className="bg-emerald-600 hover:bg-emerald-500 text-white font-semibold text-xs h-8 rounded shadow-none"
                  >
                    <CheckCircle2 className="w-3.5 h-3.5 mr-1" /> Mark Printed
                  </Button>
                  <Button
                    size="sm"
                    variant="outline"
                    disabled={actionLoading || selectedJob.status === 'redeemed'}
                    onClick={() => handleUpdateStatus(selectedJob.id, 'redeemed')}
                    className="border-slate-200 dark:border-slate-800 bg-slate-50 dark:bg-slate-900 text-blue-600 dark:text-blue-400 hover:text-slate-900 dark:hover:text-white text-xs h-8 rounded shadow-none"
                  >
                    Mark Redeemed
                  </Button>
                  <Button
                    size="sm"
                    variant="outline"
                    disabled={actionLoading || selectedJob.status === 'expired'}
                    onClick={() => handleUpdateStatus(selectedJob.id, 'expired')}
                    className="border-slate-200 dark:border-slate-800 bg-slate-50 dark:bg-slate-900 text-slate-600 dark:text-slate-400 hover:text-red-500 text-xs h-8 rounded shadow-none"
                  >
                    <Ban className="w-3.5 h-3.5 mr-1" /> Expire Job
                  </Button>
                </div>
              </div>
            </div>
          </DialogContent>
        </Dialog>
      )}
    </div>
  )
}
