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
  ShieldCheck
} from 'lucide-react'
import { Button } from '@/components/ui/button'
import { Badge } from '@/components/ui/badge'
import AdminHeader from '@/components/admin/AdminHeader'
import { supabase } from '@/lib/supabase'

export default function AdminPartnersPage() {
  const [partners, setPartners] = useState([])
  const [loading, setLoading] = useState(true)
  const [refreshing, setRefreshing] = useState(false)
  const [actionLoading, setActionLoading] = useState(null)

  const fetchPartners = async () => {
    setRefreshing(true)
    try {
      const { data, error } = await supabase
        .from('partners')
        .select('*')
        .order('created_at', { ascending: false })

      if (!error && data) {
        setPartners(data)
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

  const handleUpdateStatus = async (partnerId, newStatus) => {
    setActionLoading(partnerId)
    try {
      const { error } = await supabase
        .from('partners')
        .update({ status: newStatus })
        .eq('id', partnerId)

      if (!error) {
        setPartners((prev) =>
          prev.map((p) => (p.id === partnerId ? { ...p, status: newStatus } : p))
        )
      }
    } catch (err) {
      console.error('Error updating partner status:', err)
    } finally {
      setActionLoading(null)
    }
  }

  const handleConvertApprovedToDevice = async (partner) => {
    setActionLoading(partner.id)
    try {
      // 1. Create a device from partner data
      await fetch('/api/admin/devices', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          name: `QuickInk Shop - ${partner.shop_name}`,
          type: 'shop',
          address: partner.location,
          phone: partner.phone,
          operating_hours: '09:00 AM - 10:00 PM',
        }),
      })

      // 2. Mark partner as onboarded
      await supabase
        .from('partners')
        .update({ status: 'onboarded' })
        .eq('id', partner.id)

      fetchPartners()
      alert(`Station provisioned for "${partner.shop_name}"! Check the Devices page.`)
    } catch (err) {
      alert('Error provisioning station: ' + err.message)
    } finally {
      setActionLoading(null)
    }
  }

  return (
    <div className="flex-1 flex flex-col min-h-screen bg-[#090d16]">
      <AdminHeader
        title="Partner Shop Applications"
        subtitle="Review printer shop owners applying to become certified QuickInk stations"
        onRefresh={fetchPartners}
        isRefreshing={refreshing}
      />

      <main className="p-4 sm:p-6 lg:p-8 space-y-6 max-w-7xl mx-auto w-full">
        <div className="bg-[#0d131f] border border-slate-800 rounded-2xl overflow-hidden shadow-2xl">
          <div className="p-5 border-b border-slate-800/80 flex items-center justify-between">
            <div>
              <h3 className="text-sm font-bold text-white flex items-center gap-2">
                <Users className="w-4 h-4 text-[#00bf63]" />
                Incoming Partner Leads
              </h3>
              <p className="text-xs text-slate-400">Applications received via /partner registration form</p>
            </div>
            <Badge className="bg-[#00bf63]/15 text-[#00bf63] border-none font-bold text-xs">
              {partners.filter((p) => p.status === 'pending').length} Pending
            </Badge>
          </div>

          <div className="overflow-x-auto">
            <table className="w-full text-left text-xs">
              <thead className="bg-slate-900/90 text-slate-400 border-b border-slate-800 uppercase tracking-wider text-[10px]">
                <tr>
                  <th className="py-3 px-4">Applicant & Shop</th>
                  <th className="py-3 px-4">Contact Phone</th>
                  <th className="py-3 px-4">Shop Location</th>
                  <th className="py-3 px-4">Status</th>
                  <th className="py-3 px-4">Applied Date</th>
                  <th className="py-3 px-4 text-right">Actions</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-800/60 font-medium">
                {partners.length === 0 ? (
                  <tr>
                    <td colSpan={6} className="text-center py-12 text-slate-500">
                      {loading ? 'Loading applications...' : 'No partner applications received yet.'}
                    </td>
                  </tr>
                ) : (
                  partners.map((partner) => {
                    const statusStyles = {
                      pending: 'bg-amber-500/15 text-amber-400 border-amber-500/30',
                      approved: 'bg-emerald-500/15 text-[#00bf63] border-emerald-500/30',
                      onboarded: 'bg-blue-500/15 text-blue-400 border-blue-500/30',
                      rejected: 'bg-red-500/15 text-red-400 border-red-500/30',
                    }[partner.status] || 'bg-slate-500/15 text-slate-400 border-slate-500/30'

                    return (
                      <tr key={partner.id} className="hover:bg-slate-900/50 transition-colors">
                        <td className="py-3.5 px-4">
                          <div className="font-bold text-white text-sm">{partner.shop_name}</div>
                          <span className="text-[11px] text-slate-400 flex items-center gap-1 mt-0.5">
                            <Building className="w-3 h-3 text-slate-500" /> {partner.name}
                          </span>
                        </td>

                        <td className="py-3.5 px-4">
                          <a
                            href={`tel:${partner.phone}`}
                            className="font-mono text-slate-300 hover:text-[#00bf63] flex items-center gap-1 font-bold"
                          >
                            <Phone className="w-3 h-3 text-slate-500" /> {partner.phone}
                          </a>
                        </td>

                        <td className="py-3.5 px-4">
                          <div className="flex items-start gap-1 text-slate-300">
                            <MapPin className="w-3.5 h-3.5 text-slate-500 flex-shrink-0 mt-0.5" />
                            <span className="line-clamp-2">{partner.location}</span>
                          </div>
                        </td>

                        <td className="py-3.5 px-4">
                          <span className={`inline-flex items-center px-2.5 py-0.5 rounded-full text-[10px] font-bold border ${statusStyles} uppercase tracking-wider`}>
                            {partner.status}
                          </span>
                        </td>

                        <td className="py-3.5 px-4 text-slate-400 text-[11px]">
                          {new Date(partner.created_at).toLocaleDateString()}
                        </td>

                        <td className="py-3.5 px-4 text-right">
                          <div className="flex items-center justify-end gap-1.5">
                            {partner.status === 'pending' && (
                              <>
                                <Button
                                  size="sm"
                                  disabled={actionLoading === partner.id}
                                  onClick={() => handleUpdateStatus(partner.id, 'approved')}
                                  className="bg-emerald-600 hover:bg-emerald-500 text-white font-bold text-xs h-7 px-2.5 rounded-lg shadow-none"
                                >
                                  Approve
                                </Button>
                                <Button
                                  size="sm"
                                  variant="outline"
                                  disabled={actionLoading === partner.id}
                                  onClick={() => handleUpdateStatus(partner.id, 'rejected')}
                                  className="border-slate-800 bg-slate-900 text-slate-400 hover:text-red-400 text-xs h-7 px-2.5 rounded-lg"
                                >
                                  Reject
                                </Button>
                              </>
                            )}

                            {partner.status === 'approved' && (
                              <Button
                                size="sm"
                                disabled={actionLoading === partner.id}
                                onClick={() => handleConvertApprovedToDevice(partner)}
                                className="bg-[#00bf63] hover:bg-[#00a656] text-slate-950 font-bold text-xs h-7 px-2.5 rounded-lg shadow-none flex items-center gap-1"
                              >
                                <Plus className="w-3 h-3" /> Provision Station
                              </Button>
                            )}

                            {partner.status === 'onboarded' && (
                              <span className="text-[11px] font-bold text-emerald-400 flex items-center gap-1">
                                <ShieldCheck className="w-3.5 h-3.5" /> Hardware Active
                              </span>
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
    </div>
  )
}
