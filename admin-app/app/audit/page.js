'use client'

import React, { useState, useEffect } from 'react'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Badge } from '@/components/ui/badge'
import { Input } from '@/components/ui/input'
import {
  ShieldAlert,
  ShieldCheck,
  Search,
  RefreshCw,
  Clock,
  User,
  Activity,
  Layers,
  FileText,
  Lock,
  Download
} from 'lucide-react'

export default function AuditLogsPage() {
  const [logs, setLogs] = useState([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState(null)
  const [searchQuery, setSearchQuery] = useState('')

  async function fetchLogs() {
    setLoading(true)
    setError(null)
    try {
      const res = await fetch('/api/admin/audit-logs?limit=100')
      const data = await res.json()
      if (res.ok && data.success) {
        setLogs(data.logs || [])
      } else {
        setError(data.error || 'Failed to load audit trail')
      }
    } catch (err) {
      setError('Network connection error fetching audit trail')
    } finally {
      setLoading(false)
    }
  }

  useEffect(() => {
    fetchLogs()
  }, [])

  const filteredLogs = logs.filter((log) => {
    if (!searchQuery) return true
    const q = searchQuery.toLowerCase()
    return (
      (log.action && log.action.toLowerCase().includes(q)) ||
      (log.actor_email && log.actor_email.toLowerCase().includes(q)) ||
      (log.resource_type && log.resource_type.toLowerCase().includes(q)) ||
      (log.details && JSON.stringify(log.details).toLowerCase().includes(q))
    )
  })

  function getActionBadge(action) {
    if (action.includes('DELETE') || action.includes('REJECT') || action.includes('REFUND')) {
      return <Badge className="bg-red-50 text-red-700 border border-red-200 text-[10px] font-mono">{action}</Badge>
    }
    if (action.includes('CREATE') || action.includes('APPROVAL') || action.includes('PROVISION')) {
      return <Badge className="bg-emerald-50 text-emerald-800 border border-emerald-200 text-[10px] font-mono">{action}</Badge>
    }
    return <Badge className="bg-blue-50 text-blue-700 border border-blue-200 text-[10px] font-mono">{action}</Badge>
  }

  function exportCsv() {
    if (!logs.length) return
    const headers = ['Timestamp', 'Actor', 'Role', 'Action', 'Resource', 'Resource ID', 'IP']
    const rows = logs.map(l => [
      l.created_at,
      l.actor_email,
      l.actor_role,
      l.action,
      l.resource_type,
      l.resource_id || '',
      l.ip_address || '',
    ])
    const csvContent = 'data:text/csv;charset=utf-8,' + [headers.join(','), ...rows.map(e => e.join(','))].join('\n')
    const encodedUri = encodeURI(csvContent)
    const link = document.createElement('a')
    link.setAttribute('href', encodedUri)
    link.setAttribute('download', `printkoro_audit_trail_${new Date().toISOString().slice(0, 10)}.csv`)
    document.body.appendChild(link)
    link.click()
    document.body.removeChild(link)
  }

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <div className="flex items-center gap-2">
            <h1 className="text-xl font-bold text-slate-900 dark:text-white tracking-tight">Security & Audit Trail</h1>
            <Badge className="bg-slate-900 text-white dark:bg-slate-800 dark:text-slate-200 border-none text-[10px] font-mono">
              Immutable Log
            </Badge>
          </div>
          <p className="text-xs text-slate-500 dark:text-slate-400 mt-1">
            Zero-trust immutable chronological record of all administrative operations, fleet modifications, pricing changes, and customer support interventions.
          </p>
        </div>

        <div className="flex items-center gap-2">
          <Button
            variant="outline"
            size="sm"
            onClick={exportCsv}
            disabled={!logs.length}
            className="text-xs border-slate-200 dark:border-slate-800 text-slate-700 dark:text-slate-300 hover:bg-slate-100 dark:hover:bg-slate-800 h-9"
          >
            <Download className="w-3.5 h-3.5 mr-1.5" />
            Export CSV
          </Button>

          <Button
            variant="outline"
            size="sm"
            onClick={fetchLogs}
            className="text-xs border-slate-200 dark:border-slate-800 text-slate-700 dark:text-slate-300 hover:bg-slate-100 dark:hover:bg-slate-800 h-9"
          >
            <RefreshCw className={`w-3.5 h-3.5 mr-1.5 ${loading ? 'animate-spin' : ''}`} />
            Refresh
          </Button>
        </div>
      </div>

      {/* Security Health Metrics */}
      <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
        <Card className="border border-slate-200 dark:border-slate-800/80 shadow-xs bg-white dark:bg-[#0a0a0a] rounded-xl p-4">
          <div className="text-xs font-semibold text-slate-500 dark:text-slate-400 flex items-center gap-1.5">
            <ShieldCheck className="w-3.5 h-3.5 text-[#00bf63]" /> Access Control Protocol
          </div>
          <div className="text-base font-bold text-slate-900 dark:text-white mt-1">Edge HttpOnly JWT</div>
          <div className="text-[11px] text-slate-400 dark:text-slate-500 mt-0.5">XSS resistant • SameSite=Lax</div>
        </Card>

        <Card className="border border-slate-200 dark:border-slate-800/80 shadow-xs bg-white dark:bg-[#0a0a0a] rounded-xl p-4">
          <div className="text-xs font-semibold text-slate-500 dark:text-slate-400 flex items-center gap-1.5">
            <Lock className="w-3.5 h-3.5 text-blue-500" /> Rate Limiting Guard
          </div>
          <div className="text-base font-bold text-slate-900 dark:text-white mt-1">Active & Enforcing</div>
          <div className="text-[11px] text-slate-400 dark:text-slate-500 mt-0.5">Max 7 attempts per 5m per IP</div>
        </Card>

        <Card className="border border-slate-200 dark:border-slate-800/80 shadow-xs bg-white dark:bg-[#0a0a0a] rounded-xl p-4">
          <div className="text-xs font-semibold text-slate-500 dark:text-slate-400 flex items-center gap-1.5">
            <Activity className="w-3.5 h-3.5 text-amber-500" /> Logged Administrative Events
          </div>
          <div className="text-base font-bold text-slate-900 dark:text-white mt-1">{logs.length} Recorded</div>
          <div className="text-[11px] text-slate-400 dark:text-slate-500 mt-0.5">Full audit history preserved</div>
        </Card>
      </div>

      {/* Search Bar */}
      <div className="flex items-center gap-3">
        <div className="relative flex-1">
          <Search className="w-4 h-4 text-slate-400 absolute left-3 top-1/2 -translate-y-1/2" />
          <Input
            placeholder="Search by action, email, resource, or details..."
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            className="pl-9 h-9 text-xs bg-white dark:bg-[#0a0a0a] border-slate-200 dark:border-slate-800 text-slate-900 dark:text-white rounded-xl"
          />
        </div>
      </div>

      {/* Audit Log Table */}
      <Card className="border border-slate-200 dark:border-slate-800/80 shadow-xs rounded-xl bg-white dark:bg-[#0a0a0a] overflow-hidden">
        <CardHeader className="bg-slate-50/70 dark:bg-slate-900/60 border-b border-slate-200 dark:border-slate-800 py-3.5 px-5">
          <CardTitle className="text-sm font-bold text-slate-900 dark:text-white flex items-center gap-2">
            <Clock className="w-4 h-4 text-[#00bf63]" />
            Chronological Audit Events
          </CardTitle>
        </CardHeader>
        <CardContent className="p-0">
          <div className="overflow-x-auto">
            <table className="w-full text-left border-collapse text-xs">
              <thead>
                <tr className="border-b border-slate-200 dark:border-slate-800 bg-slate-50/40 dark:bg-slate-900/40 text-slate-500 dark:text-slate-400 font-semibold uppercase text-[10px] tracking-wider">
                  <th className="py-3 px-4">Timestamp</th>
                  <th className="py-3 px-4">Actor</th>
                  <th className="py-3 px-4">Action</th>
                  <th className="py-3 px-4">Target Resource</th>
                  <th className="py-3 px-4">Details / Metadata</th>
                  <th className="py-3 px-4 text-right">IP Origin</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100 dark:divide-slate-800/60">
                {filteredLogs.length === 0 ? (
                  <tr>
                    <td colSpan={6} className="py-8 text-center text-slate-400 dark:text-slate-500 text-xs">
                      {loading ? 'Fetching audit records...' : 'No audit records match query'}
                    </td>
                  </tr>
                ) : (
                  filteredLogs.map((log) => (
                    <tr key={log.id} className="hover:bg-slate-50/60 dark:hover:bg-slate-900/40 transition-colors">
                      <td className="py-3 px-4 text-slate-500 dark:text-slate-400 font-mono text-[11px] whitespace-nowrap">
                        {new Date(log.created_at).toLocaleString('en-US', {
                          month: 'short',
                          day: 'numeric',
                          hour: '2-digit',
                          minute: '2-digit',
                          second: '2-digit',
                        })}
                      </td>
                      <td className="py-3 px-4">
                        <div className="font-semibold text-slate-900 dark:text-white">{log.actor_email}</div>
                        <div className="text-[10px] text-slate-400 uppercase tracking-wider">{log.actor_role}</div>
                      </td>
                      <td className="py-3 px-4">
                        {getActionBadge(log.action)}
                      </td>
                      <td className="py-3 px-4 font-mono text-slate-600 dark:text-slate-400 text-[11px]">
                        <span className="bg-slate-100 dark:bg-slate-900 text-slate-700 dark:text-slate-300 px-1.5 py-0.5 rounded border border-slate-200 dark:border-slate-800">
                          {log.resource_type}{log.resource_id ? ` #${String(log.resource_id).slice(-6)}` : ''}
                        </span>
                      </td>
                      <td className="py-3 px-4 text-slate-600 dark:text-slate-300 max-w-xs truncate text-[11px]">
                        {typeof log.details === 'object' ? JSON.stringify(log.details) : log.details}
                      </td>
                      <td className="py-3 px-4 text-right font-mono text-slate-400 text-[11px]">
                        {log.ip_address}
                      </td>
                    </tr>
                  ))
                )}
              </tbody>
            </table>
          </div>
        </CardContent>
      </Card>
    </div>
  )
}
