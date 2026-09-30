'use client'

import { useState, useEffect } from 'react'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Badge } from '@/components/ui/badge'
import {
  Tag,
  Plus,
  Edit2,
  Trash2,
  CheckCircle2,
  AlertCircle,
  RefreshCw,
  Sparkles,
  MapPin,
  DollarSign,
  Layers,
  HardDrive
} from 'lucide-react'

export default function PricingTiersPage() {
  const [tiers, setTiers] = useState([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState(null)
  const [successMsg, setSuccessMsg] = useState(null)

  // Modal state
  const [isModalOpen, setIsModalOpen] = useState(false)
  const [editingTier, setEditingTier] = useState(null)
  const [submitting, setSubmitting] = useState(false)
  const [formData, setFormData] = useState({
    name: '',
    description: '',
    bw_price: '2.00',
    color_price: '8.00',
  })

  async function fetchTiers(force = false) {
    setLoading(true)
    setError(null)
    try {
      const res = await fetch(`/api/admin/pricing-tiers${force ? '?refresh=true' : ''}`)
      const data = await res.json()
      if (res.ok && data.success) {
        setTiers(data.tiers || [])
      } else {
        setError(data.error || 'Failed to load pricing tiers')
      }
    } catch (err) {
      setError('Network connection error fetching pricing tiers')
    } finally {
      setLoading(false)
    }
  }

  useEffect(() => {
    fetchTiers()
  }, [])

  function openCreateModal() {
    setEditingTier(null)
    setFormData({
      name: '',
      description: '',
      bw_price: '2.00',
      color_price: '8.00',
    })
    setIsModalOpen(true)
  }

  function openEditModal(tier) {
    setEditingTier(tier)
    setFormData({
      name: tier.name,
      description: tier.description || '',
      bw_price: String(tier.bw_price),
      color_price: String(tier.color_price),
    })
    setIsModalOpen(true)
  }

  async function handleSubmit(e) {
    e.preventDefault()
    setSubmitting(true)
    setError(null)

    try {
      const url = '/api/admin/pricing-tiers'
      const method = editingTier ? 'PATCH' : 'POST'
      const payload = {
        ...(editingTier ? { id: editingTier.id } : {}),
        name: formData.name,
        description: formData.description,
        bw_price: parseFloat(formData.bw_price),
        color_price: parseFloat(formData.color_price),
      }

      const res = await fetch(url, {
        method,
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload),
      })

      const data = await res.json()
      if (res.ok && data.success) {
        setSuccessMsg(editingTier ? 'Pricing tier updated successfully' : 'New pricing zone created')
        setTimeout(() => setSuccessMsg(null), 3000)
        setIsModalOpen(false)
        fetchTiers(true)
      } else {
        setError(data.error || 'Failed to save pricing tier')
      }
    } catch (err) {
      setError('Network error saving pricing tier')
    } finally {
      setSubmitting(false)
    }
  }

  async function handleDelete(tier) {
    if (!confirm(`Are you sure you want to delete "${tier.name}"?`)) return
    try {
      const res = await fetch(`/api/admin/pricing-tiers?id=${tier.id}`, { method: 'DELETE' })
      const data = await res.json()
      if (res.ok && data.success) {
        setSuccessMsg(`Tier "${tier.name}" deleted`)
        setTimeout(() => setSuccessMsg(null), 3000)
        fetchTiers(true)
      } else {
        alert(data.error || 'Failed to delete tier')
      }
    } catch (err) {
      alert('Network error deleting tier')
    }
  }

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <div className="flex items-center gap-2">
            <h1 className="text-xl font-bold text-slate-900 dark:text-white tracking-tight">Dynamic Pricing & Zones</h1>
            <Badge className="bg-[#00bf63]/10 text-[#00bf63] border-none text-[10px] font-bold">
              Production Matrix
            </Badge>
          </div>
          <p className="text-xs text-slate-500 dark:text-slate-400 mt-1">
            Configure geographic rate cards, student discounts, and commercial kiosk pricing tiers across Bangladesh.
          </p>
        </div>

        <div className="flex items-center gap-2">
          <Button
            variant="outline"
            size="sm"
            onClick={() => fetchTiers(true)}
            className="text-xs border-slate-200 dark:border-slate-800 text-slate-700 dark:text-slate-300 hover:bg-slate-100 dark:hover:bg-slate-800 h-9"
          >
            <RefreshCw className={`w-3.5 h-3.5 mr-1.5 ${loading ? 'animate-spin' : ''}`} />
            Refresh
          </Button>

          <Button
            size="sm"
            onClick={openCreateModal}
            className="text-xs bg-[#00bf63] hover:bg-[#00a656] text-slate-950 font-bold h-9 shadow-sm"
          >
            <Plus className="w-3.5 h-3.5 mr-1.5" />
            Add Pricing Zone
          </Button>
        </div>
      </div>

      {/* Notifications */}
      {successMsg && (
        <div className="p-3 bg-emerald-50 dark:bg-emerald-950/40 border border-emerald-200 dark:border-emerald-800/40 text-emerald-800 dark:text-emerald-400 text-xs rounded-xl flex items-center gap-2 animate-in fade-in">
          <CheckCircle2 className="w-4 h-4 text-[#00bf63]" />
          <span>{successMsg}</span>
        </div>
      )}

      {error && (
        <div className="p-3 bg-red-50 dark:bg-red-950/40 border border-red-200 dark:border-red-800/40 text-red-700 dark:text-red-400 text-xs rounded-xl flex items-center gap-2">
          <AlertCircle className="w-4 h-4 text-red-500" />
          <span>{error}</span>
        </div>
      )}

      {/* Overview Stat Cards */}
      <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
        <Card className="border border-slate-200 dark:border-slate-800/80 shadow-xs bg-white dark:bg-[#0a0a0a] rounded-xl p-4">
          <div className="text-xs font-semibold text-slate-500 dark:text-slate-400 flex items-center gap-1.5">
            <Tag className="w-3.5 h-3.5 text-[#00bf63]" /> Active Rate Zones
          </div>
          <div className="text-2xl font-black text-slate-900 dark:text-white mt-1">{tiers.length}</div>
          <div className="text-[11px] text-slate-400 dark:text-slate-500 mt-0.5">Applied dynamically to matched kiosks</div>
        </Card>

        <Card className="border border-slate-200 dark:border-slate-800/80 shadow-xs bg-white dark:bg-[#0a0a0a] rounded-xl p-4">
          <div className="text-xs font-semibold text-slate-500 dark:text-slate-400 flex items-center gap-1.5">
            <DollarSign className="w-3.5 h-3.5 text-blue-500" /> Lowest Student Rate (B&W)
          </div>
          <div className="text-2xl font-black text-slate-900 dark:text-white mt-1">
            ৳{tiers.length > 0 ? Math.min(...tiers.map(t => t.bw_price)).toFixed(2) : '2.00'}
          </div>
          <div className="text-[11px] text-slate-400 dark:text-slate-500 mt-0.5">Nilkhet & Campus standard</div>
        </Card>

        <Card className="border border-slate-200 dark:border-slate-800/80 shadow-xs bg-white dark:bg-[#0a0a0a] rounded-xl p-4">
          <div className="text-xs font-semibold text-slate-500 dark:text-slate-400 flex items-center gap-1.5">
            <Sparkles className="w-3.5 h-3.5 text-amber-500" /> High-Gloss Color Rate
          </div>
          <div className="text-2xl font-black text-slate-900 dark:text-white mt-1">
            ৳{tiers.length > 0 ? Math.max(...tiers.map(t => t.color_price)).toFixed(2) : '8.00'}
          </div>
          <div className="text-[11px] text-slate-400 dark:text-slate-500 mt-0.5">Maximum commercial zone rate</div>
        </Card>
      </div>

      {/* Pricing Zones Table */}
      <Card className="border border-slate-200 dark:border-slate-800/80 shadow-xs rounded-xl bg-white dark:bg-[#0a0a0a] overflow-hidden">
        <CardHeader className="bg-slate-50/70 dark:bg-slate-900/60 border-b border-slate-200 dark:border-slate-800 py-3.5 px-5">
          <CardTitle className="text-sm font-bold text-slate-900 dark:text-white flex items-center gap-2">
            <Layers className="w-4 h-4 text-[#00bf63]" />
            Configured Rate Cards
          </CardTitle>
        </CardHeader>
        <CardContent className="p-0">
          <div className="overflow-x-auto">
            <table className="w-full text-left border-collapse text-xs">
              <thead>
                <tr className="border-b border-slate-200 dark:border-slate-800 bg-slate-50/40 dark:bg-slate-900/40 text-slate-500 dark:text-slate-400 font-semibold uppercase text-[10px] tracking-wider">
                  <th className="py-3 px-4">Zone / Tier Name</th>
                  <th className="py-3 px-4">Description / Target Location</th>
                  <th className="py-3 px-4 text-right">B&W (৳/Page)</th>
                  <th className="py-3 px-4 text-right">Color (৳/Page)</th>
                  <th className="py-3 px-4 text-center">Status</th>
                  <th className="py-3 px-4 text-right">Actions</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100 dark:divide-slate-800/60">
                {tiers.map((tier) => (
                  <tr key={tier.id} className="hover:bg-slate-50/60 dark:hover:bg-slate-900/40 transition-colors">
                    <td className="py-3 px-4 font-bold text-slate-900 dark:text-white">
                      <div className="flex items-center gap-1.5">
                        <span>{tier.name}</span>
                        {tier.is_default && (
                          <Badge className="bg-emerald-100 dark:bg-emerald-950/60 text-emerald-800 dark:text-emerald-400 text-[9px] font-bold border-none px-1.5 py-0">
                            Default
                          </Badge>
                        )}
                      </div>
                    </td>
                    <td className="py-3 px-4 text-slate-500 dark:text-slate-400 max-w-xs truncate">
                      {tier.description || 'Applies to unassigned stations'}
                    </td>
                    <td className="py-3 px-4 text-right font-bold text-slate-800 dark:text-slate-200">
                      ৳{Number(tier.bw_price).toFixed(2)}
                    </td>
                    <td className="py-3 px-4 text-right font-bold text-blue-600 dark:text-blue-400">
                      ৳{Number(tier.color_price).toFixed(2)}
                    </td>
                    <td className="py-3 px-4 text-center">
                      <Badge className="bg-emerald-50 dark:bg-emerald-950/40 text-emerald-700 dark:text-emerald-400 border border-emerald-200 dark:border-emerald-800/40 text-[10px]">
                        Active
                      </Badge>
                    </td>
                    <td className="py-3 px-4 text-right">
                      <div className="flex items-center justify-end gap-1">
                        <Button
                          variant="ghost"
                          size="sm"
                          onClick={() => openEditModal(tier)}
                          className="h-7 w-7 p-0 text-slate-500 dark:text-slate-400 hover:text-slate-900 dark:hover:text-white hover:bg-slate-100 dark:hover:bg-slate-800 rounded-lg"
                          title="Edit Tier"
                        >
                          <Edit2 className="w-3.5 h-3.5" />
                        </Button>
                        {!tier.is_default && (
                          <Button
                            variant="ghost"
                            size="sm"
                            onClick={() => handleDelete(tier)}
                            className="h-7 w-7 p-0 text-slate-400 hover:text-red-600 hover:bg-red-50 dark:hover:bg-red-950/40 rounded-lg"
                            title="Delete Tier"
                          >
                            <Trash2 className="w-3.5 h-3.5" />
                          </Button>
                        )}
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </CardContent>
      </Card>

      {/* Create / Edit Modal */}
      {isModalOpen && (
        <div className="fixed inset-0 z-50 bg-black/60 backdrop-blur-xs flex items-center justify-center p-4 animate-in fade-in">
          <Card className="w-full max-w-md bg-white dark:bg-[#0a0a0a] border border-slate-200 dark:border-slate-800 shadow-xl rounded-2xl overflow-hidden">
            <CardHeader className="bg-slate-50 dark:bg-slate-900/60 border-b border-slate-100 dark:border-slate-800 p-5">
              <CardTitle className="text-base font-bold text-slate-900 dark:text-white">
                {editingTier ? `Edit Zone: ${editingTier.name}` : 'Create New Pricing Zone'}
              </CardTitle>
              <p className="text-xs text-slate-500 dark:text-slate-400 mt-0.5">
                Set base B&W and Color per-page rates for this zone.
              </p>
            </CardHeader>
            <CardContent className="p-5">
              <form onSubmit={handleSubmit} className="space-y-4">
                <div>
                  <Label htmlFor="tier_name" className="text-xs font-semibold text-slate-700 dark:text-slate-300">
                    Zone Name *
                  </Label>
                  <Input
                    id="tier_name"
                    required
                    placeholder="e.g. DU Nilkhet Student, Rajshahi Campus"
                    value={formData.name}
                    onChange={(e) => setFormData({ ...formData, name: e.target.value })}
                    className="mt-1 h-9 text-xs bg-slate-50 dark:bg-slate-900 border-slate-200 dark:border-slate-800 text-slate-900 dark:text-white rounded-lg"
                  />
                </div>

                <div>
                  <Label htmlFor="tier_desc" className="text-xs font-semibold text-slate-700 dark:text-slate-300">
                    Description / Scope
                  </Label>
                  <Input
                    id="tier_desc"
                    placeholder="e.g. Subsidized student printing zone"
                    value={formData.description}
                    onChange={(e) => setFormData({ ...formData, description: e.target.value })}
                    className="mt-1 h-9 text-xs bg-slate-50 dark:bg-slate-900 border-slate-200 dark:border-slate-800 text-slate-900 dark:text-white rounded-lg"
                  />
                </div>

                <div className="grid grid-cols-2 gap-3">
                  <div>
                    <Label htmlFor="bw_price" className="text-xs font-semibold text-slate-700 dark:text-slate-300">
                      B&W Price (৳/Page) *
                    </Label>
                    <Input
                      id="bw_price"
                      type="number"
                      step="0.25"
                      min="0.5"
                      required
                      value={formData.bw_price}
                      onChange={(e) => setFormData({ ...formData, bw_price: e.target.value })}
                      className="mt-1 h-9 text-xs bg-slate-50 dark:bg-slate-900 border-slate-200 dark:border-slate-800 text-slate-900 dark:text-white rounded-lg font-mono font-bold"
                    />
                  </div>

                  <div>
                    <Label htmlFor="color_price" className="text-xs font-semibold text-slate-700 dark:text-slate-300">
                      Color Price (৳/Page) *
                    </Label>
                    <Input
                      id="color_price"
                      type="number"
                      step="0.50"
                      min="1.0"
                      required
                      value={formData.color_price}
                      onChange={(e) => setFormData({ ...formData, color_price: e.target.value })}
                      className="mt-1 h-9 text-xs bg-slate-50 dark:bg-slate-900 border-slate-200 dark:border-slate-800 text-slate-900 dark:text-white rounded-lg font-mono font-bold"
                    />
                  </div>
                </div>

                <div className="pt-2 flex items-center justify-end gap-2 border-t border-slate-100 dark:border-slate-800">
                  <Button
                    type="button"
                    variant="outline"
                    size="sm"
                    onClick={() => setIsModalOpen(false)}
                    className="text-xs border-slate-200 dark:border-slate-800 text-slate-600 dark:text-slate-400"
                  >
                    Cancel
                  </Button>
                  <Button
                    type="submit"
                    size="sm"
                    disabled={submitting}
                    className="text-xs bg-[#00bf63] hover:bg-[#00a656] text-slate-950 font-bold"
                  >
                    {submitting ? 'Saving...' : editingTier ? 'Save Changes' : 'Create Zone'}
                  </Button>
                </div>
              </form>
            </CardContent>
          </Card>
        </div>
      )}
    </div>
  )
}
