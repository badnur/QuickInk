'use client'

import { useState, useEffect } from 'react'
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

export default function AdminJobsPage() {
  const [jobs, setJobs] = useState([])
  const [loading, setLoading] = useState(true)
  const [refreshing, setRefreshing] = useState(false)
  const [search, setSearch] = useState('')
  const [statusFilter, setStatusFilter] = useState('all')
  const [selectedJob, setSelectedJob] = useState(null)
  const [actionLoading, setActionLoading] = useState(false)
  const [copiedOtp, setCopiedOtp] = useState(false)

  const fetchJobs = async () => {
    setRefreshing(true)
    try {
      let url = `/api/admin/jobs?status=${statusFilter}`
      if (search.trim()) url += `&search=${encodeURIComponent(search.trim())}`
      const res = await fetch(url)
      const data = await res.json()
      if (data?.jobs) {
        setJobs(data.jobs)
      }
    } catch (err) {
      console.error('Error fetching jobs:', err)
    } finally {
      setLoading(false)
      setRefreshing(false)
    }
  }

  useEffect(() => {
    fetchJobs()
  }, [statusFilter])

  // Realtime subscription for instant table updates
  useEffect(() => {
    const channel = supabase
      .channel('admin_jobs_live_table')
      .on(
        'postgres_changes',
        { event: '*', schema: 'public', table: 'print_jobs' },
        () => {
          fetchJobs()
        }
      )
      .subscribe()

    return () => {
      supabase.removeChannel(channel)
    }
  }, [statusFilter, search])

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
        fetchJobs()
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
    <div className="flex-1 flex flex-col min-h-screen bg-[#090d16]">
      <AdminHeader
        title="Live Print Jobs"
        subtitle="Monitor, inspect, and manually manage customer print orders across all kiosks"
        onRefresh={fetchJobs}
        isRefreshing={refreshing}
      />

      <main className="p-4 sm:p-6 lg:p-8 space-y-5 max-w-7xl mx-auto w-full">
        {/* Filter and Search Bar */}
        <div className="bg-[#0d131f] border border-slate-800 rounded-2xl p-4 flex flex-col sm:flex-row items-center justify-between gap-3 shadow-xl">
          {/* Status Tabs */}
          <div className="flex items-center gap-1.5 overflow-x-auto w-full sm:w-auto pb-1 sm:pb-0">
            {[
              { id: 'all', label: 'All Jobs' },
              { id: 'awaiting_redemption', label: 'Awaiting OTP' },
              { id: 'redeemed', label: 'Redeemed' },
              { id: 'printed', label: 'Printed' },
              { id: 'expired', label: 'Expired' },
            ].map((tab) => (
              <button
                key={tab.id}
                onClick={() => setStatusFilter(tab.id)}
                className={`px-3 py-1.5 rounded-xl text-xs font-bold transition-all whitespace-nowrap ${
                  statusFilter === tab.id
                    ? 'bg-[#00bf63] text-slate-950 shadow-md'
                    : 'text-slate-400 hover:text-white hover:bg-slate-800'
                }`}
              >
                {tab.label}
              </button>
            ))}
          </div>

          {/* Search Input */}
          <form
            onSubmit={(e) => { e.preventDefault(); fetchJobs() }}
            className="relative w-full sm:w-72"
          >
            <Search className="w-4 h-4 text-slate-500 absolute left-3 top-1/2 -translate-y-1/2" />
            <Input
              placeholder="Search OTP, Job ID, File..."
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              className="pl-9 pr-3 py-1.5 text-xs bg-slate-900 border-slate-800 text-white placeholder:text-slate-500 rounded-xl h-9 focus-visible:border-[#00bf63]"
            />
          </form>
        </div>

        {/* Jobs Table */}
        <div className="bg-[#0d131f] border border-slate-800 rounded-2xl overflow-hidden shadow-2xl">
          <div className="overflow-x-auto">
            <table className="w-full text-left text-xs">
              <thead className="bg-slate-900/90 text-slate-400 border-b border-slate-800 uppercase tracking-wider text-[10px]">
                <tr>
                  <th className="py-3 px-4">Order ID & OTP</th>
                  <th className="py-3 px-4">Document</th>
                  <th className="py-3 px-4">Specifications</th>
                  <th className="py-3 px-4">Payment</th>
                  <th className="py-3 px-4">Status</th>
                  <th className="py-3 px-4">Created</th>
                  <th className="py-3 px-4 text-right">Actions</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-800/60 font-medium">
                {jobs.length === 0 ? (
                  <tr>
                    <td colSpan={7} className="text-center py-12 text-slate-500">
                      {loading ? (
                        <div className="flex flex-col items-center gap-2">
                          <RefreshCw className="w-6 h-6 text-[#00bf63] animate-spin" />
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
                      awaiting_redemption: 'bg-amber-500/15 text-amber-400 border-amber-500/30',
                      redeemed: 'bg-blue-500/15 text-blue-400 border-blue-500/30',
                      printed: 'bg-emerald-500/15 text-[#00bf63] border-emerald-500/30',
                      expired: 'bg-slate-500/15 text-slate-400 border-slate-500/30',
                      voided: 'bg-red-500/15 text-red-400 border-red-500/30',
                    }[job.status] || 'bg-slate-500/15 text-slate-400 border-slate-500/30'

                    const otpCode = job.otps?.[0]?.code || job.otp?.code

                    return (
                      <tr key={job.id} className="hover:bg-slate-900/50 transition-colors">
                        <td className="py-3 px-4">
                          <div className="font-mono text-slate-300 font-bold">
                            #{job.id.substring(0, 8)}
                          </div>
                          {otpCode ? (
                            <span className="inline-flex items-center gap-1 font-mono text-[11px] font-bold text-amber-400 bg-amber-400/10 px-1.5 py-0.5 rounded border border-amber-400/20 mt-0.5">
                              <KeyRound className="w-2.5 h-2.5" /> {otpCode}
                            </span>
                          ) : (
                            <span className="text-[10px] text-slate-500">No OTP attached</span>
                          )}
                        </td>

                        <td className="py-3 px-4">
                          <div className="font-bold text-white truncate max-w-[200px]">
                            {job.file_name || job.file_path?.split('_').slice(1).join('_') || 'Document.pdf'}
                          </div>
                          <span className="text-[10px] text-slate-500 uppercase">{job.file_type}</span>
                        </td>

                        <td className="py-3 px-4">
                          <span className="font-bold text-slate-200">
                            {job.page_count} {job.page_count === 1 ? 'page' : 'pages'}
                          </span>
                          <span className="text-[10px] text-slate-400 block">
                            {job.copies} {job.copies === 1 ? 'copy' : 'copies'} • {job.color_mode === 'color' ? '🎨 Color' : '⬛ B&W'}
                            {job.duplex ? ' • 2-Sided' : ''}
                            {job.page_range ? ` • Range: ${job.page_range}` : ''}
                          </span>
                        </td>

                        <td className="py-3 px-4">
                          <div className="font-bold text-white">৳{job.amount || '—'}</div>
                          <span className="text-[10px] text-slate-400 font-semibold uppercase">
                            {job.payment_type}
                          </span>
                        </td>

                        <td className="py-3 px-4">
                          <span className={`inline-flex items-center px-2 py-0.5 rounded-full text-[10px] font-bold border ${statusStyles}`}>
                            {job.status?.replace('_', ' ')}
                          </span>
                        </td>

                        <td className="py-3 px-4 text-slate-400 text-[11px]">
                          <div>{new Date(job.created_at).toLocaleDateString()}</div>
                          <div className="text-[10px] text-slate-500">
                            {new Date(job.created_at).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
                          </div>
                        </td>

                        <td className="py-3 px-4 text-right">
                          <Button
                            size="sm"
                            variant="ghost"
                            onClick={() => setSelectedJob(job)}
                            className="h-8 px-2.5 text-xs text-[#00bf63] hover:text-white hover:bg-slate-800 rounded-lg"
                          >
                            <Eye className="w-3.5 h-3.5 mr-1" /> Inspect
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
          <DialogContent className="bg-[#0d131f] border border-slate-800 text-white max-w-lg p-6 rounded-2xl shadow-2xl">
            <DialogHeader>
              <div className="flex items-center justify-between">
                <span className="text-[11px] font-mono text-slate-400 uppercase tracking-wider">
                  Print Job Details
                </span>
                <span className="text-xs font-mono font-bold text-slate-300">
                  #{selectedJob.id}
                </span>
              </div>
              <DialogTitle className="text-lg font-bold text-white mt-1 truncate">
                {selectedJob.file_name || selectedJob.file_path?.split('_').slice(1).join('_') || 'Document.pdf'}
              </DialogTitle>
              <DialogDescription className="text-xs text-slate-400">
                Created on {new Date(selectedJob.created_at).toLocaleString()}
              </DialogDescription>
            </DialogHeader>

            {/* Specifications Card */}
            <div className="bg-slate-900/90 border border-slate-800 rounded-xl p-4 space-y-3 my-2 text-xs">
              <div className="grid grid-cols-2 gap-3 pb-3 border-b border-slate-800/80">
                <div>
                  <span className="text-[10px] text-slate-500 font-bold block uppercase">Sheets / Pages</span>
                  <span className="font-bold text-white text-sm">{selectedJob.page_count}</span>
                  {selectedJob.page_range && (
                    <span className="text-[10px] text-slate-400 block font-mono">
                      Range: {selectedJob.page_range}
                    </span>
                  )}
                </div>
                <div>
                  <span className="text-[10px] text-slate-500 font-bold block uppercase">Copies & Color</span>
                  <span className="font-bold text-white text-sm">
                    {selectedJob.copies} {selectedJob.copies === 1 ? 'Copy' : 'Copies'}
                  </span>
                  <span className="text-[10px] text-slate-400 block">
                    {selectedJob.color_mode === 'color' ? '🎨 Full Color' : '⬛ Black & White'}
                  </span>
                </div>
              </div>

              <div className="grid grid-cols-2 gap-3 pb-3 border-b border-slate-800/80">
                <div>
                  <span className="text-[10px] text-slate-500 font-bold block uppercase">Payment Method</span>
                  <span className="font-bold text-white text-sm">
                    ৳{selectedJob.amount || '—'}
                  </span>
                  <span className="text-[10px] text-slate-400 block uppercase font-semibold">
                    {selectedJob.payment_type}
                  </span>
                </div>

                <div>
                  <span className="text-[10px] text-slate-500 font-bold block uppercase">Redemption OTP</span>
                  <div className="flex items-center gap-2 mt-0.5">
                    <span className="font-mono text-base font-black text-amber-400">
                      {selectedJob.otps?.[0]?.code || 'N/A'}
                    </span>
                    {selectedJob.otps?.[0]?.code && (
                      <button
                        onClick={() => handleCopy(selectedJob.otps[0].code)}
                        className="text-slate-400 hover:text-white"
                      >
                        {copiedOtp ? <Check className="w-3.5 h-3.5 text-emerald-400" /> : <Copy className="w-3.5 h-3.5" />}
                      </button>
                    )}
                  </div>
                </div>
              </div>

              {/* File Download / View Link */}
              {selectedJob.file_path && (
                <div className="pt-1 flex items-center justify-between">
                  <span className="text-slate-400 text-xs">File in Storage:</span>
                  <a
                    href={selectedJob.file_path.startsWith('http') ? selectedJob.file_path : `/api/upload?path=${encodeURIComponent(selectedJob.file_path)}`}
                    target="_blank"
                    rel="noreferrer"
                    className="text-[#00bf63] hover:underline flex items-center gap-1 font-bold text-xs"
                  >
                    <Download className="w-3.5 h-3.5" /> Download / View File
                  </a>
                </div>
              )}
            </div>

            {/* Quick Action Controls */}
            <div className="pt-2">
              <span className="text-[11px] font-bold text-slate-400 block mb-2">Override Status:</span>
              <div className="grid grid-cols-3 gap-2">
                <Button
                  size="sm"
                  disabled={actionLoading || selectedJob.status === 'printed'}
                  onClick={() => handleUpdateStatus(selectedJob.id, 'printed')}
                  className="bg-emerald-600 hover:bg-emerald-500 text-white font-bold text-xs h-8 rounded-xl shadow-none"
                >
                  <CheckCircle2 className="w-3.5 h-3.5 mr-1" /> Mark Printed
                </Button>
                <Button
                  size="sm"
                  variant="outline"
                  disabled={actionLoading || selectedJob.status === 'redeemed'}
                  onClick={() => handleUpdateStatus(selectedJob.id, 'redeemed')}
                  className="border-slate-800 bg-slate-900 text-blue-400 hover:text-white text-xs h-8 rounded-xl"
                >
                  Mark Redeemed
                </Button>
                <Button
                  size="sm"
                  variant="outline"
                  disabled={actionLoading || selectedJob.status === 'expired'}
                  onClick={() => handleUpdateStatus(selectedJob.id, 'expired')}
                  className="border-slate-800 bg-slate-900 text-slate-400 hover:text-red-400 text-xs h-8 rounded-xl"
                >
                  <Ban className="w-3.5 h-3.5 mr-1" /> Expire Job
                </Button>
              </div>
            </div>
          </DialogContent>
        </Dialog>
      )}
    </div>
  )
}
