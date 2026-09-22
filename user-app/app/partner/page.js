'use client'

import { useState } from 'react'
import { Button } from '@/components/ui/button'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Textarea } from '@/components/ui/textarea'
import { Badge } from '@/components/ui/badge'
import {
  DollarSign,
  TrendingUp,
  Clock,
  CheckCircle,
  AlertCircle,
  Users,
  Shield,
  Zap,
  Store,
  HardDrive,
  Search,
  ArrowRight,
  Printer,
  Sparkles,
  MapPin,
  Phone,
  FileCheck,
  Download
} from 'lucide-react'

export default function PartnerPage() {
  const [activeTab, setActiveTab] = useState('shop') // 'shop' | 'kiosk' | 'track'
  
  // Shop form data
  const [shopForm, setShopForm] = useState({
    name: '',
    shop_name: '',
    phone: '',
    email: '',
    location: '',
    city: 'Dhaka',
    operating_hours: '09:00 AM - 10:00 PM',
    printer_model: '',
    daily_footfall: '',
  })

  // Kiosk form data
  const [kioskForm, setKioskForm] = useState({
    name: '',
    shop_name: '',
    phone: '',
    email: '',
    location: '',
    city: 'Dhaka',
    space_type: 'University / Campus',
    daily_footfall: '',
    power_backup: true,
  })

  // Status tracking state
  const [trackQuery, setTrackQuery] = useState('')
  const [trackResult, setTrackResult] = useState(null)
  const [trackLoading, setTrackLoading] = useState(false)
  const [trackError, setTrackError] = useState('')

  const [loading, setLoading] = useState(false)
  const [submittedRef, setSubmittedRef] = useState(null)
  const [error, setError] = useState('')

  const handleShopSubmit = async (e) => {
    e.preventDefault()
    setLoading(true)
    setError('')
    setSubmittedRef(null)

    try {
      const res = await fetch('/api/partners', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          ...shopForm,
          type: 'shop',
        }),
      })

      const data = await res.json()
      if (res.ok && data.success) {
        setSubmittedRef(data.reference_id || 'QIK-REG-NEW')
        setShopForm({
          name: '',
          shop_name: '',
          phone: '',
          email: '',
          location: '',
          city: 'Dhaka',
          operating_hours: '09:00 AM - 10:00 PM',
          printer_model: '',
          daily_footfall: '',
        })
      } else {
        setError(data.error || 'Failed to submit application.')
      }
    } catch (err) {
      setError('Network error. Please try again.')
    } finally {
      setLoading(false)
    }
  }

  const handleKioskSubmit = async (e) => {
    e.preventDefault()
    setLoading(true)
    setError('')
    setSubmittedRef(null)

    try {
      const res = await fetch('/api/partners', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          ...kioskForm,
          type: 'kiosk',
        }),
      })

      const data = await res.json()
      if (res.ok && data.success) {
        setSubmittedRef(data.reference_id || 'QIK-REG-NEW')
        setKioskForm({
          name: '',
          shop_name: '',
          phone: '',
          email: '',
          location: '',
          city: 'Dhaka',
          space_type: 'University / Campus',
          daily_footfall: '',
          power_backup: true,
        })
      } else {
        setError(data.error || 'Failed to submit application.')
      }
    } catch (err) {
      setError('Network error. Please try again.')
    } finally {
      setLoading(false)
    }
  }

  const handleTrackSearch = async (e) => {
    e.preventDefault()
    if (!trackQuery.trim()) return
    setTrackLoading(true)
    setTrackError('')
    setTrackResult(null)

    try {
      const isRef = trackQuery.trim().toUpperCase().startsWith('QIK-')
      const param = isRef ? `ref=${encodeURIComponent(trackQuery.trim())}` : `phone=${encodeURIComponent(trackQuery.trim())}`
      const res = await fetch(`/api/partners?${param}`)
      const data = await res.json()

      if (res.ok && data.partner) {
        setTrackResult(data.partner)
      } else {
        setTrackError(data.error || 'No application found with that reference ID or phone number.')
      }
    } catch (err) {
      setTrackError('Error querying status. Please check your connection.')
    } finally {
      setTrackLoading(false)
    }
  }

  return (
    <div className="min-h-screen bg-slate-50">
      {/* Hero Header */}
      <section className="bg-[#090d16] text-white py-16 sm:py-20 border-b border-slate-800">
        <div className="container mx-auto px-4 sm:px-6 lg:px-8 max-w-5xl text-center">
          <Badge className="mb-4 bg-[#00bf63]/15 text-[#00bf63] border border-[#00bf63]/30 font-semibold px-3 py-1 text-xs">
            <Sparkles className="h-3.5 w-3.5 mr-1.5 inline" />
            PrintKoro Network Expansion
          </Badge>
          <h1 className="text-3xl sm:text-5xl font-extrabold tracking-tight mb-4 text-white">
            Register Your Shop or Host a Kiosk
          </h1>
          <p className="text-base sm:text-lg text-slate-300 max-w-2xl mx-auto mb-8 leading-relaxed">
            Turn your store or empty 2×2 ft space into guaranteed recurring income with Bangladesh’s premier self-service cloud printing network.
          </p>

          <div className="grid grid-cols-1 sm:grid-cols-3 gap-4 max-w-2xl mx-auto text-left">
            <div className="bg-[#111827] border border-slate-800 rounded-xl p-4">
              <div className="text-xs text-slate-400">Shop Earnings</div>
              <div className="text-2xl font-bold text-[#00bf63]">100% Retained</div>
              <div className="text-[11px] text-slate-500 mt-0.5">Keep full customer print revenue</div>
            </div>
            <div className="bg-[#111827] border border-slate-800 rounded-xl p-4">
              <div className="text-xs text-slate-400">Terminal Software</div>
              <div className="text-2xl font-bold text-white">Desktop POS</div>
              <div className="text-[11px] text-slate-500 mt-0.5">Pairs directly with counter printers</div>
            </div>
            <div className="bg-[#111827] border border-slate-800 rounded-xl p-4">
              <div className="text-xs text-slate-400">Approval Time</div>
              <div className="text-2xl font-bold text-white">Instant / 24h</div>
              <div className="text-[11px] text-slate-500 mt-0.5">Quick verification & provisioning</div>
            </div>
          </div>

          {/* Direct Download Call to Action */}
          <div className="mt-8 flex flex-col sm:flex-row items-center justify-center gap-3">
            <a
              href="/api/download/desktop"
              className="inline-flex items-center justify-center gap-2.5 px-6 py-3.5 rounded-xl bg-[#00bf63] hover:bg-[#00a855] text-black font-extrabold text-sm shadow-xl shadow-[#00bf63]/20 transition-all hover:scale-[1.02]"
            >
              <Download className="w-5 h-5 text-black" />
              <span>Download PrintKoro Desktop App (.exe)</span>
            </a>
            <span className="text-xs text-slate-400">Windows 10 / 11 • Version 1.0.0 • Auto-Updating</span>
          </div>
        </div>
      </section>

      {/* Main Registration & Tracking Section */}
      <section className="py-12 sm:py-16">
        <div className="container mx-auto px-4 sm:px-6 lg:px-8 max-w-4xl">
          
          {/* Already Registered / Counter PC Setup Banner */}
          <div className="mb-8 p-5 bg-gradient-to-r from-slate-900 to-slate-800 border border-slate-700/80 rounded-2xl flex flex-col sm:flex-row items-center justify-between gap-4 shadow-md text-left">
            <div className="flex items-center gap-3.5">
              <div className="w-10 h-10 rounded-xl bg-[#00bf63]/15 border border-[#00bf63]/30 flex items-center justify-center text-[#00bf63] shrink-0">
                <HardDrive className="w-5 h-5" />
              </div>
              <div>
                <h3 className="text-sm font-bold text-white">Already Approved or Setting Up Your Counter PC?</h3>
                <p className="text-xs text-slate-400 mt-0.5">
                  Download the PrintKoro Desktop Terminal on your shop computer and log in with your registered phone number.
                </p>
              </div>
            </div>
            <a
              href="/api/download/desktop"
              className="shrink-0 inline-flex items-center gap-2 px-4 py-2.5 rounded-xl bg-[#00bf63] hover:bg-[#00a855] text-black font-bold text-xs shadow-sm transition-all hover:scale-[1.02]"
            >
              <Download className="w-4 h-4 text-black" />
              <span>Download Installer (.exe)</span>
            </a>
          </div>

          {/* Segmented Selector Tabs */}
          <div className="flex bg-slate-200/80 p-1.5 rounded-2xl mb-8 max-w-xl mx-auto border border-slate-300">
            <button
              onClick={() => { setActiveTab('shop'); setSubmittedRef(null); setError(''); }}
              className={`flex-1 py-2.5 px-4 rounded-xl text-xs sm:text-sm font-semibold flex items-center justify-center gap-2 transition-all ${
                activeTab === 'shop'
                  ? 'bg-white text-slate-900 shadow-sm'
                  : 'text-slate-600 hover:text-slate-900'
              }`}
            >
              <Store className="w-4 h-4 text-[#00bf63]" />
              <span>Partner Shop</span>
            </button>

            <button
              onClick={() => { setActiveTab('kiosk'); setSubmittedRef(null); setError(''); }}
              className={`flex-1 py-2.5 px-4 rounded-xl text-xs sm:text-sm font-semibold flex items-center justify-center gap-2 transition-all ${
                activeTab === 'kiosk'
                  ? 'bg-white text-slate-900 shadow-sm'
                  : 'text-slate-600 hover:text-slate-900'
              }`}
            >
              <HardDrive className="w-4 h-4 text-[#00bf63]" />
              <span>Host a Kiosk</span>
            </button>

            <button
              onClick={() => { setActiveTab('track'); setSubmittedRef(null); setError(''); }}
              className={`flex-1 py-2.5 px-4 rounded-xl text-xs sm:text-sm font-semibold flex items-center justify-center gap-2 transition-all ${
                activeTab === 'track'
                  ? 'bg-white text-slate-900 shadow-sm'
                  : 'text-slate-600 hover:text-slate-900'
              }`}
            >
              <Search className="w-4 h-4 text-[#00bf63]" />
              <span>Track Status</span>
            </button>
          </div>

          {/* Submission Success Banner */}
          {submittedRef && (
            <div className="mb-8 p-6 bg-emerald-50 border border-emerald-200 rounded-2xl flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4">
              <div className="flex items-start gap-3">
                <CheckCircle className="w-6 h-6 text-[#00bf63] flex-shrink-0 mt-0.5" />
                <div>
                  <h3 className="text-base font-bold text-slate-900">Application Submitted Successfully!</h3>
                  <p className="text-xs text-slate-600 mt-1">
                    Your registration has been forwarded to the PrintKoro Admin Team for verification and provisioning.
                  </p>
                  <div className="mt-2.5 flex items-center gap-2">
                    <span className="text-xs text-slate-500 font-medium">Your Reference ID:</span>
                    <span className="font-mono text-sm font-bold bg-emerald-100 text-emerald-900 px-2.5 py-0.5 rounded border border-emerald-300">
                      {submittedRef}
                    </span>
                  </div>
                </div>
              </div>
              <Button
                variant="outline"
                size="sm"
                onClick={() => {
                  setTrackQuery(submittedRef)
                  setActiveTab('track')
                }}
                className="text-xs font-semibold text-emerald-800 border-emerald-300 hover:bg-emerald-100"
              >
                Track Status Now
              </Button>
            </div>
          )}

          {/* Error Message */}
          {error && (
            <div className="mb-6 p-4 bg-red-50 border border-red-200 rounded-xl flex items-center gap-3 text-red-700 text-xs">
              <AlertCircle className="w-4 h-4 flex-shrink-0" />
              <span>{error}</span>
            </div>
          )}

          {/* ------------------------------------------------------------- */}
          {/* TAB 1: PARTNER SHOP REGISTRATION                              */}
          {/* ------------------------------------------------------------- */}
          {activeTab === 'shop' && (
            <Card className="border border-slate-200 shadow-sm rounded-2xl bg-white overflow-hidden">
              <CardHeader className="bg-slate-50/70 border-b border-slate-100 p-6">
                <div className="flex items-center justify-between">
                  <div>
                    <CardTitle className="text-lg font-bold text-slate-900 flex items-center gap-2">
                      <Store className="w-5 h-5 text-[#00bf63]" />
                      Partner Print Shop Registration
                    </CardTitle>
                    <p className="text-xs text-slate-500 mt-1">
                      For print shop, stationery store, and cyber café owners with physical storefronts.
                    </p>
                  </div>
                  <Badge className="bg-emerald-100 text-emerald-800 font-bold text-[11px] border-emerald-200">
                    40% Payout
                  </Badge>
                </div>
              </CardHeader>
              <CardContent className="p-6">
                <form onSubmit={handleShopSubmit} className="space-y-4">
                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                    <div>
                      <Label htmlFor="shop_name" className="text-xs font-semibold text-slate-700">Shop / Store Name *</Label>
                      <Input
                        id="shop_name"
                        required
                        placeholder="e.g. Modern Xerox & Stationery"
                        value={shopForm.shop_name}
                        onChange={(e) => setShopForm({ ...shopForm, shop_name: e.target.value })}
                        className="mt-1 text-xs sm:text-sm h-10 border-slate-200 rounded-lg"
                      />
                    </div>
                    <div>
                      <Label htmlFor="owner_name" className="text-xs font-semibold text-slate-700">Owner / Manager Name *</Label>
                      <Input
                        id="owner_name"
                        required
                        placeholder="e.g. Rafiqul Islam"
                        value={shopForm.name}
                        onChange={(e) => setShopForm({ ...shopForm, name: e.target.value })}
                        className="mt-1 text-xs sm:text-sm h-10 border-slate-200 rounded-lg"
                      />
                    </div>
                  </div>

                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                    <div>
                      <Label htmlFor="phone" className="text-xs font-semibold text-slate-700">Mobile / WhatsApp Number *</Label>
                      <Input
                        id="phone"
                        required
                        placeholder="e.g. 01712345678"
                        value={shopForm.phone}
                        onChange={(e) => setShopForm({ ...shopForm, phone: e.target.value })}
                        className="mt-1 text-xs sm:text-sm h-10 border-slate-200 rounded-lg"
                      />
                    </div>
                    <div>
                      <Label htmlFor="email" className="text-xs font-semibold text-slate-700">Email Address (Optional)</Label>
                      <Input
                        id="email"
                        type="email"
                        placeholder="e.g. shop@gmail.com"
                        value={shopForm.email}
                        onChange={(e) => setShopForm({ ...shopForm, email: e.target.value })}
                        className="mt-1 text-xs sm:text-sm h-10 border-slate-200 rounded-lg"
                      />
                    </div>
                  </div>

                  <div>
                    <Label htmlFor="location" className="text-xs font-semibold text-slate-700">Shop Physical Address *</Label>
                    <Textarea
                      id="location"
                      required
                      placeholder="e.g. Shop 4B, Central Super Market, Dhanmondi 27, Dhaka"
                      rows={2}
                      value={shopForm.location}
                      onChange={(e) => setShopForm({ ...shopForm, location: e.target.value })}
                      className="mt-1 text-xs sm:text-sm border-slate-200 rounded-lg"
                    />
                  </div>

                  <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
                    <div>
                      <Label htmlFor="city" className="text-xs font-semibold text-slate-700">City / District *</Label>
                      <Input
                        id="city"
                        required
                        value={shopForm.city}
                        onChange={(e) => setShopForm({ ...shopForm, city: e.target.value })}
                        className="mt-1 text-xs sm:text-sm h-10 border-slate-200 rounded-lg"
                      />
                    </div>
                    <div>
                      <Label htmlFor="operating_hours" className="text-xs font-semibold text-slate-700">Operating Hours</Label>
                      <Input
                        id="operating_hours"
                        placeholder="09:00 AM - 10:00 PM"
                        value={shopForm.operating_hours}
                        onChange={(e) => setShopForm({ ...shopForm, operating_hours: e.target.value })}
                        className="mt-1 text-xs sm:text-sm h-10 border-slate-200 rounded-lg"
                      />
                    </div>
                    <div>
                      <Label htmlFor="daily_footfall" className="text-xs font-semibold text-slate-700">Estimated Daily Customers</Label>
                      <Input
                        id="daily_footfall"
                        placeholder="e.g. 100 - 200 / day"
                        value={shopForm.daily_footfall}
                        onChange={(e) => setShopForm({ ...shopForm, daily_footfall: e.target.value })}
                        className="mt-1 text-xs sm:text-sm h-10 border-slate-200 rounded-lg"
                      />
                    </div>
                  </div>

                  <div>
                    <Label htmlFor="printer_model" className="text-xs font-semibold text-slate-700">Existing Connected Printers (Optional)</Label>
                    <Input
                      id="printer_model"
                      placeholder="e.g. Epson L130, Canon LBP2900, HP LaserJet Pro"
                      value={shopForm.printer_model}
                      onChange={(e) => setShopForm({ ...shopForm, printer_model: e.target.value })}
                      className="mt-1 text-xs sm:text-sm h-10 border-slate-200 rounded-lg"
                    />
                    <p className="text-[11px] text-slate-500 mt-1">If you already have printers, our desktop software pairs directly with them.</p>
                  </div>

                  <Button
                    type="submit"
                    disabled={loading}
                    className="w-full h-11 text-sm font-semibold bg-[#00bf63] hover:bg-[#00a656] text-white rounded-xl mt-4"
                  >
                    {loading ? 'Submitting Registration...' : 'Submit Shop Application'}
                  </Button>
                </form>
              </CardContent>
            </Card>
          )}

          {/* ------------------------------------------------------------- */}
          {/* TAB 2: AUTOMATED KIOSK HOST REQUEST                           */}
          {/* ------------------------------------------------------------- */}
          {activeTab === 'kiosk' && (
            <Card className="border border-slate-200 shadow-sm rounded-2xl bg-white overflow-hidden">
              <CardHeader className="bg-slate-50/70 border-b border-slate-100 p-6">
                <div className="flex items-center justify-between">
                  <div>
                    <CardTitle className="text-lg font-bold text-slate-900 flex items-center gap-2">
                      <HardDrive className="w-5 h-5 text-[#00bf63]" />
                      Self-Service Kiosk Host Station Request
                    </CardTitle>
                    <p className="text-xs text-slate-500 mt-1">
                      For universities, commercial malls, hospitals, tech parks, and co-working spaces.
                    </p>
                  </div>
                  <Badge className="bg-blue-100 text-blue-800 font-bold text-[11px] border-blue-200">
                    Zero Hardware Cost
                  </Badge>
                </div>
              </CardHeader>
              <CardContent className="p-6">
                <form onSubmit={handleKioskSubmit} className="space-y-4">
                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                    <div>
                      <Label htmlFor="venue_name" className="text-xs font-semibold text-slate-700">Venue / Institution Name *</Label>
                      <Input
                        id="venue_name"
                        required
                        placeholder="e.g. North South University Cafeteria"
                        value={kioskForm.shop_name}
                        onChange={(e) => setKioskForm({ ...kioskForm, shop_name: e.target.value })}
                        className="mt-1 text-xs sm:text-sm h-10 border-slate-200 rounded-lg"
                      />
                    </div>
                    <div>
                      <Label htmlFor="kiosk_contact" className="text-xs font-semibold text-slate-700">Contact Person & Title *</Label>
                      <Input
                        id="kiosk_contact"
                        required
                        placeholder="e.g. Tanvir Ahmed (Facilities Manager)"
                        value={kioskForm.name}
                        onChange={(e) => setKioskForm({ ...kioskForm, name: e.target.value })}
                        className="mt-1 text-xs sm:text-sm h-10 border-slate-200 rounded-lg"
                      />
                    </div>
                  </div>

                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                    <div>
                      <Label htmlFor="kiosk_phone" className="text-xs font-semibold text-slate-700">Official Mobile Number *</Label>
                      <Input
                        id="kiosk_phone"
                        required
                        placeholder="e.g. 01811223344"
                        value={kioskForm.phone}
                        onChange={(e) => setKioskForm({ ...kioskForm, phone: e.target.value })}
                        className="mt-1 text-xs sm:text-sm h-10 border-slate-200 rounded-lg"
                      />
                    </div>
                    <div>
                      <Label htmlFor="kiosk_email" className="text-xs font-semibold text-slate-700">Official Email *</Label>
                      <Input
                        id="kiosk_email"
                        type="email"
                        required
                        placeholder="e.g. admin@nsu.edu.bd"
                        value={kioskForm.email}
                        onChange={(e) => setKioskForm({ ...kioskForm, email: e.target.value })}
                        className="mt-1 text-xs sm:text-sm h-10 border-slate-200 rounded-lg"
                      />
                    </div>
                  </div>

                  <div>
                    <Label htmlFor="kiosk_location" className="text-xs font-semibold text-slate-700">Exact Placement Location & Address *</Label>
                    <Textarea
                      id="kiosk_location"
                      required
                      placeholder="e.g. Ground Floor, Building 8, Main Student Lounge, Bashundhara R/A, Dhaka"
                      rows={2}
                      value={kioskForm.location}
                      onChange={(e) => setKioskForm({ ...kioskForm, location: e.target.value })}
                      className="mt-1 text-xs sm:text-sm border-slate-200 rounded-lg"
                    />
                  </div>

                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                    <div>
                      <Label htmlFor="space_type" className="text-xs font-semibold text-slate-700">Venue Category *</Label>
                      <select
                        id="space_type"
                        className="mt-1 w-full text-xs sm:text-sm h-10 px-3 bg-white border border-slate-200 rounded-lg outline-none focus:border-[#00bf63]"
                        value={kioskForm.space_type}
                        onChange={(e) => setKioskForm({ ...kioskForm, space_type: e.target.value })}
                      >
                        <option value="University / Campus">University / Campus</option>
                        <option value="Shopping Mall / Retail Hub">Shopping Mall / Retail Hub</option>
                        <option value="Hospital / Diagnostic Center">Hospital / Diagnostic Center</option>
                        <option value="Commercial Tech Park / Coworking">Commercial Tech Park / Coworking</option>
                        <option value="Government / Public Service Center">Government / Public Service Center</option>
                      </select>
                    </div>

                    <div>
                      <Label htmlFor="kiosk_footfall" className="text-xs font-semibold text-slate-700">Estimated Daily Footfall</Label>
                      <Input
                        id="kiosk_footfall"
                        placeholder="e.g. 1,000+ daily visitors"
                        value={kioskForm.daily_footfall}
                        onChange={(e) => setKioskForm({ ...kioskForm, daily_footfall: e.target.value })}
                        className="mt-1 text-xs sm:text-sm h-10 border-slate-200 rounded-lg"
                      />
                    </div>
                  </div>

                  <div className="p-4 bg-slate-50 border border-slate-200 rounded-xl space-y-2">
                    <div className="flex items-center gap-3">
                      <input
                        type="checkbox"
                        id="kiosk_power"
                        checked={kioskForm.power_backup}
                        onChange={(e) => setKioskForm({ ...kioskForm, power_backup: e.target.checked })}
                        className="w-4 h-4 text-[#00bf63] rounded border-slate-300 focus:ring-[#00bf63]"
                      />
                      <label htmlFor="kiosk_power" className="text-xs font-medium text-slate-700 cursor-pointer">
                        Standard 220V power socket and reliable Wi-Fi / 4G coverage available at installation spot.
                      </label>
                    </div>
                  </div>

                  <Button
                    type="submit"
                    disabled={loading}
                    className="w-full h-11 text-sm font-semibold bg-[#00bf63] hover:bg-[#00a656] text-white rounded-xl mt-4"
                  >
                    {loading ? 'Submitting Kiosk Request...' : 'Submit Kiosk Location Request'}
                  </Button>
                </form>
              </CardContent>
            </Card>
          )}

          {/* ------------------------------------------------------------- */}
          {/* TAB 3: TRACK APPLICATION STATUS                               */}
          {/* ------------------------------------------------------------- */}
          {activeTab === 'track' && (
            <div className="space-y-6">
              <Card className="border border-slate-200 shadow-sm rounded-2xl bg-white overflow-hidden">
                <CardHeader className="bg-slate-50/70 border-b border-slate-100 p-6">
                  <CardTitle className="text-lg font-bold text-slate-900 flex items-center gap-2">
                    <FileCheck className="w-5 h-5 text-[#00bf63]" />
                    Track Registration Progress
                  </CardTitle>
                  <p className="text-xs text-slate-500 mt-1">
                    Enter your application reference code (e.g. QIK-REG-849201) or registered mobile number.
                  </p>
                </CardHeader>
                <CardContent className="p-6">
                  <form onSubmit={handleTrackSearch} className="flex flex-col sm:flex-row gap-3">
                    <div className="relative flex-1">
                      <Search className="absolute left-3.5 top-3 h-4 w-4 text-slate-400" />
                      <Input
                        required
                        placeholder="Enter Reference ID (QIK-REG-...) or Phone (017...)"
                        value={trackQuery}
                        onChange={(e) => setTrackQuery(e.target.value)}
                        className="pl-10 text-xs sm:text-sm h-11 border-slate-200 rounded-xl"
                      />
                    </div>
                    <Button
                      type="submit"
                      disabled={trackLoading}
                      className="h-11 px-6 bg-slate-900 hover:bg-slate-800 text-white font-semibold text-xs sm:text-sm rounded-xl"
                    >
                      {trackLoading ? 'Searching...' : 'Check Status'}
                    </Button>
                  </form>

                  {trackError && (
                    <div className="mt-4 p-4 bg-amber-50 border border-amber-200 rounded-xl flex items-center gap-3 text-amber-800 text-xs">
                      <AlertCircle className="w-4 h-4 flex-shrink-0" />
                      <span>{trackError}</span>
                    </div>
                  )}
                </CardContent>
              </Card>

              {/* Found Application Details */}
              {trackResult && (
                <Card className="border border-slate-200 shadow-sm rounded-2xl bg-white overflow-hidden">
                  <div className="p-6 border-b border-slate-100 flex flex-col sm:flex-row sm:items-center justify-between gap-3">
                    <div>
                      <div className="flex items-center gap-2">
                        <span className="font-mono text-xs font-bold text-slate-500">{trackResult.reference_id}</span>
                        <Badge className={`capitalize font-bold text-[10px] ${
                          trackResult.status === 'approved' || trackResult.status === 'onboarded'
                            ? 'bg-emerald-100 text-emerald-800 border-emerald-300'
                            : trackResult.status === 'rejected'
                            ? 'bg-red-100 text-red-800 border-red-300'
                            : 'bg-amber-100 text-amber-800 border-amber-300'
                        }`}>
                          {trackResult.status === 'approved' ? 'Approved & Ready' : trackResult.status}
                        </Badge>
                      </div>
                      <h3 className="text-xl font-bold text-slate-900 mt-1">{trackResult.shop_name}</h3>
                      <p className="text-xs text-slate-500 mt-0.5">{trackResult.location}</p>
                    </div>
                    <div className="text-right">
                      <div className="text-xs text-slate-400">Application Type</div>
                      <div className="text-sm font-bold text-slate-800 uppercase tracking-wide">
                        {trackResult.type === 'kiosk' ? 'Automated Kiosk' : 'Partner Shop'}
                      </div>
                    </div>
                  </div>

                  <div className="p-6 space-y-6">
                    {/* Status Progress Stepper */}
                    <div className="grid grid-cols-3 gap-2 sm:gap-4 text-center">
                      <div className="p-3 bg-emerald-50 border border-emerald-200 rounded-xl">
                        <div className="w-6 h-6 mx-auto rounded-full bg-[#00bf63] text-white flex items-center justify-center text-xs font-bold mb-1">
                          ✓
                        </div>
                        <div className="text-xs font-bold text-slate-900">Application Received</div>
                        <div className="text-[10px] text-slate-500 mt-0.5">Submitted via web</div>
                      </div>

                      <div className={`p-3 rounded-xl border ${
                        trackResult.status !== 'pending'
                          ? 'bg-emerald-50 border-emerald-200'
                          : 'bg-amber-50 border-amber-200'
                      }`}>
                        <div className={`w-6 h-6 mx-auto rounded-full flex items-center justify-center text-xs font-bold mb-1 ${
                          trackResult.status !== 'pending'
                            ? 'bg-[#00bf63] text-white'
                            : 'bg-amber-500 text-white animate-pulse'
                        }`}>
                          {trackResult.status !== 'pending' ? '✓' : '2'}
                        </div>
                        <div className="text-xs font-bold text-slate-900">Admin Review</div>
                        <div className="text-[10px] text-slate-500 mt-0.5">
                          {trackResult.status === 'pending' ? 'Under verification' : 'Verified'}
                        </div>
                      </div>

                      <div className={`p-3 rounded-xl border ${
                        trackResult.status === 'approved' || trackResult.status === 'onboarded'
                          ? 'bg-emerald-50 border-emerald-200'
                          : trackResult.status === 'rejected'
                          ? 'bg-red-50 border-red-200'
                          : 'bg-slate-50 border-slate-200 opacity-60'
                      }`}>
                        <div className={`w-6 h-6 mx-auto rounded-full flex items-center justify-center text-xs font-bold mb-1 ${
                          trackResult.status === 'approved' || trackResult.status === 'onboarded'
                            ? 'bg-[#00bf63] text-white'
                            : trackResult.status === 'rejected'
                            ? 'bg-red-500 text-white'
                            : 'bg-slate-300 text-slate-600'
                        }`}>
                          {trackResult.status === 'approved' ? '✓' : trackResult.status === 'rejected' ? '✕' : '3'}
                        </div>
                        <div className="text-xs font-bold text-slate-900">Station Provisioned</div>
                        <div className="text-[10px] text-slate-500 mt-0.5">
                          {trackResult.status === 'approved'
                            ? 'Ready for Desktop POS'
                            : trackResult.status === 'rejected'
                            ? 'Not approved'
                            : 'Awaiting decision'}
                        </div>
                      </div>
                    </div>

                    {/* Next Steps Card */}
                    {trackResult.status === 'approved' && (
                      <div className="p-4 bg-emerald-500/10 border border-emerald-500/30 rounded-xl space-y-2">
                        <div className="flex items-center gap-2 text-emerald-900 font-bold text-sm">
                          <CheckCircle className="w-4 h-4 text-[#00bf63]" />
                          Congratulations! Your Station has been Approved & Provisioned
                        </div>
                        <p className="text-xs text-slate-700 leading-relaxed">
                          Your PrintKoro Desktop terminal profile has been set up. Our operations team is contacting you at{' '}
                          <strong>{trackResult.phone}</strong> to deliver your pairing key or dispatch our field technician with the self-service hardware.
                        </p>
                        <div className="pt-2">
                          <a
                            href="/api/download/desktop"
                            className="inline-flex items-center gap-2 px-4 py-2 bg-[#00bf63] hover:bg-[#00a855] text-white font-semibold text-xs rounded-lg transition-colors shadow-sm"
                          >
                            <Download className="w-4 h-4" />
                            Download PrintKoro Desktop App (.exe)
                          </a>
                        </div>
                      </div>
                    )}

                    {trackResult.status === 'pending' && (
                      <div className="p-4 bg-slate-50 border border-slate-200 rounded-xl space-y-1">
                        <div className="text-xs font-bold text-slate-800">Next Step: Field Verification</div>
                        <p className="text-xs text-slate-500 leading-relaxed">
                          Our operations manager will call you within 24 hours to verify space feasibility and schedule installation.
                        </p>
                      </div>
                    )}
                  </div>
                </Card>
              )}
            </div>
          )}

        </div>
      </section>
    </div>
  )
}
