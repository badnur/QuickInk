'use client'

import React, { useState, useEffect, useMemo } from 'react'
import Link from 'next/link'
import {
  ShieldCheck,
  RotateCcw,
  FileLock,
  Scale,
  Search,
  Printer,
  Share2,
  Check,
  Info,
  AlertTriangle,
  ChevronRight,
  BookOpen,
  ArrowRight,
  HelpCircle,
  FileText,
  Globe,
  Sparkles,
  Phone,
  Mail,
  Columns,
  Square
} from 'lucide-react'
import { termsData } from '@/lib/terms-data'
import { useLanguage } from '@/context/LanguageContext'
import Footer from '@/components/Footer'

const ICON_MAP = {
  ShieldCheck,
  RotateCcw,
  FileLock,
  Scale
}

export default function TermsClient() {
  const { lang: globalLang, setLang: setGlobalLang } = useLanguage()
  
  // View mode: 'current' (follows active language) or 'parallel' (side-by-side both bn & en)
  const [viewMode, setViewMode] = useState('current')
  // Active single language if in 'current' mode: defaults to globalLang ('bn' or 'en')
  const [activeLang, setActiveLang] = useState(globalLang || 'bn')
  const [searchQuery, setSearchQuery] = useState('')
  const [activeSectionId, setActiveSectionId] = useState('acceptance')
  const [copied, setCopied] = useState(false)

  // Keep activeLang in sync if globalLang changes and user hasn't explicitly diverged
  useEffect(() => {
    if (globalLang) {
      setActiveLang(globalLang)
    }
  }, [globalLang])

  // Get current language data
  const currentData = termsData[activeLang] || termsData.bn
  const bnData = termsData.bn
  const enData = termsData.en

  // Filter sections based on search query
  const filteredSections = useMemo(() => {
    if (!searchQuery.trim()) {
      return currentData.sections
    }
    const q = searchQuery.toLowerCase()
    return currentData.sections.filter((sec) => {
      const titleMatch = sec.title.toLowerCase().includes(q)
      const contentMatch = sec.content.some((p) => p.toLowerCase().includes(q))
      const calloutMatch = sec.callout ? (sec.callout.title + sec.callout.text).toLowerCase().includes(q) : false
      return titleMatch || contentMatch || calloutMatch
    })
  }, [currentData, searchQuery])

  // Scroll spy to highlight active section in table of contents
  useEffect(() => {
    const handleScroll = () => {
      const sections = currentData.sections
      const scrollPosition = window.scrollY + 200

      for (let i = sections.length - 1; i >= 0; i--) {
        const el = document.getElementById(sections[i].id)
        if (el && el.offsetTop <= scrollPosition) {
          setActiveSectionId(sections[i].id)
          break
        }
      }
    }

    window.addEventListener('scroll', handleScroll, { passive: true })
    return () => window.removeEventListener('scroll', handleScroll)
  }, [currentData])

  const scrollToSection = (id) => {
    setActiveSectionId(id)
    const el = document.getElementById(id)
    if (el) {
      const yOffset = -90
      const y = el.getBoundingClientRect().top + window.pageYOffset + yOffset
      window.scrollTo({ top: y, behavior: 'smooth' })
    }
  }

  const handlePrint = () => {
    window.print()
  }

  const handleCopyLink = () => {
    if (typeof window !== 'undefined') {
      navigator.clipboard.writeText(window.location.href)
      setCopied(true)
      setTimeout(() => setCopied(false), 2500)
    }
  }

  const handleLanguageChange = (newLang) => {
    setActiveLang(newLang)
    setGlobalLang(newLang)
    setViewMode('current')
  }

  return (
    <div className="min-h-screen bg-slate-50 text-slate-800">
      {/* Top Banner / Hero Header */}
      <section className="bg-gray-950 text-white pt-12 pb-16 border-b border-gray-900 relative overflow-hidden">
        {/* Subtle background glow */}
        <div className="absolute top-0 right-1/4 w-96 h-96 bg-[#00bf63]/10 rounded-full blur-3xl pointer-events-none" />
        <div className="absolute -bottom-10 left-1/3 w-80 h-80 bg-emerald-600/10 rounded-full blur-3xl pointer-events-none" />

        <div className="container mx-auto px-4 sm:px-6 lg:px-8 max-w-6xl relative z-10">
          {/* Breadcrumb */}
          <nav className="flex items-center gap-2 text-xs text-gray-400 mb-6 font-medium">
            <Link href="/" className="hover:text-[#00bf63] transition-colors">
              {activeLang === 'bn' ? 'হোম' : 'Home'}
            </Link>
            <ChevronRight className="w-3.5 h-3.5 text-gray-600" />
            <span className="text-gray-200">
              {activeLang === 'bn' ? 'শর্তাবলী ও নীতিমালা' : 'Terms & Conditions'}
            </span>
          </nav>

          <div className="flex flex-col lg:flex-row lg:items-end justify-between gap-6 pb-6 border-b border-gray-800/80">
            <div>
              <div className="inline-flex items-center gap-2 px-3 py-1 rounded-full bg-[#00bf63]/15 border border-[#00bf63]/30 text-[#00bf63] text-xs font-semibold mb-3">
                <Scale className="w-3.5 h-3.5" />
                <span>
                  {activeLang === 'bn' ? 'আইনি সম্মতি ও স্বচ্ছতা' : 'Legal Compliance & Transparency'}
                </span>
              </div>
              <h1 className="text-3xl sm:text-4xl lg:text-5xl font-extrabold tracking-tight text-white mb-3">
                {currentData.meta.title}
              </h1>
              <p className="text-sm sm:text-base text-gray-300 max-w-2xl leading-relaxed">
                {currentData.meta.subtitle}
              </p>
            </div>

            {/* Quick Actions (Print & Share) */}
            <div className="flex items-center gap-2.5 print:hidden">
              <button
                type="button"
                onClick={handlePrint}
                className="inline-flex items-center gap-1.5 px-3.5 py-2 rounded-xl text-xs font-semibold bg-gray-900 hover:bg-gray-800 text-gray-200 border border-gray-700 hover:border-gray-600 transition-all shadow-xs cursor-pointer"
                title={activeLang === 'bn' ? 'প্রিন্ট বা PDF হিসেবে সেভ করুন' : 'Print or Save as PDF'}
              >
                <Printer className="w-4 h-4 text-[#00bf63]" />
                <span>{activeLang === 'bn' ? 'প্রিন্ট কপি' : 'Print / PDF'}</span>
              </button>

              <button
                type="button"
                onClick={handleCopyLink}
                className="inline-flex items-center gap-1.5 px-3.5 py-2 rounded-xl text-xs font-semibold bg-gray-900 hover:bg-gray-800 text-gray-200 border border-gray-700 hover:border-gray-600 transition-all shadow-xs cursor-pointer"
                title="Copy URL"
              >
                {copied ? (
                  <>
                    <Check className="w-4 h-4 text-[#00bf63]" />
                    <span className="text-[#00bf63]">
                      {activeLang === 'bn' ? 'লিংক কপি হয়েছে!' : 'Copied!'}
                    </span>
                  </>
                ) : (
                  <>
                    <Share2 className="w-4 h-4 text-[#00bf63]" />
                    <span>{activeLang === 'bn' ? 'লিংক শেয়ার' : 'Share'}</span>
                  </>
                )}
              </button>
            </div>
          </div>

          {/* Metadata bar */}
          <div className="mt-6 flex flex-wrap items-center gap-y-3 gap-x-6 text-xs text-gray-400">
            <div>
              <span className="text-gray-500 mr-1.5">{activeLang === 'bn' ? 'সংস্করণ:' : 'Version:'}</span>
              <span className="font-semibold text-gray-200">{currentData.meta.version}</span>
            </div>
            <div className="hidden sm:block text-gray-700">•</div>
            <div>
              <span className="text-gray-500 mr-1.5">{activeLang === 'bn' ? 'সর্বশেষ পরিমার্জন:' : 'Last Updated:'}</span>
              <span className="font-semibold text-gray-200">{currentData.meta.lastUpdated}</span>
            </div>
            <div className="hidden sm:block text-gray-700">•</div>
            <div>
              <span className="text-gray-500 mr-1.5">{activeLang === 'bn' ? 'কার্যকর তারিখ:' : 'Effective:'}</span>
              <span className="font-semibold text-emerald-400">{currentData.meta.effectiveDate}</span>
            </div>
            <div className="hidden sm:block text-gray-700">•</div>
            <div>
              <span className="text-gray-500 mr-1.5">{activeLang === 'bn' ? 'এখতিয়ার:' : 'Jurisdiction:'}</span>
              <span className="font-semibold text-gray-200">{activeLang === 'bn' ? 'বাংলাদেশ (Dhaka)' : 'Bangladesh (Dhaka)'}</span>
            </div>
          </div>
        </div>
      </section>

      {/* Language Switcher Bar & Mode Selector (Sticky under Navbar) */}
      <section className="bg-white border-b border-slate-200 shadow-xs sticky top-20 z-40 print:hidden">
        <div className="container mx-auto px-4 sm:px-6 lg:px-8 max-w-6xl py-3">
          <div className="flex flex-col sm:flex-row items-center justify-between gap-3">
            {/* Language Selector Buttons */}
            <div className="flex items-center gap-1.5 w-full sm:w-auto">
              <span className="text-xs font-semibold text-slate-500 mr-1 hidden sm:inline">
                {activeLang === 'bn' ? 'ভাষা নির্বাচন:' : 'Select Language:'}
              </span>
              
              <div className="inline-flex p-1 bg-slate-100 rounded-xl border border-slate-200 w-full sm:w-auto">
                <button
                  type="button"
                  onClick={() => handleLanguageChange('bn')}
                  className={`flex-1 sm:flex-initial flex items-center justify-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-bold transition-all cursor-pointer ${
                    viewMode === 'current' && activeLang === 'bn'
                      ? 'bg-[#00bf63] text-white shadow-xs'
                      : 'text-slate-600 hover:text-slate-900 hover:bg-slate-200/60'
                  }`}
                >
                  <span>🇧🇩</span>
                  <span>বাংলা</span>
                </button>

                <button
                  type="button"
                  onClick={() => handleLanguageChange('en')}
                  className={`flex-1 sm:flex-initial flex items-center justify-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-bold transition-all cursor-pointer ${
                    viewMode === 'current' && activeLang === 'en'
                      ? 'bg-[#00bf63] text-white shadow-xs'
                      : 'text-slate-600 hover:text-slate-900 hover:bg-slate-200/60'
                  }`}
                >
                  <span>🇬🇧</span>
                  <span>English</span>
                </button>

                <button
                  type="button"
                  onClick={() => setViewMode('parallel')}
                  className={`flex-1 sm:flex-initial flex items-center justify-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-bold transition-all cursor-pointer ${
                    viewMode === 'parallel'
                      ? 'bg-slate-900 text-white shadow-xs'
                      : 'text-slate-600 hover:text-slate-900 hover:bg-slate-200/60'
                  }`}
                  title={activeLang === 'bn' ? 'বাংলা ও ইংরেজি পাশাপাশি দেখুন' : 'Compare Bangla & English side-by-side'}
                >
                  <Columns className="w-3.5 h-3.5 text-[#00bf63]" />
                  <span>{activeLang === 'bn' ? 'উভয় ভাষা (পাশাপাশি)' : 'Side-by-Side'}</span>
                </button>
              </div>
            </div>

            {/* In-page search bar */}
            <div className="relative w-full sm:w-72">
              <Search className="w-4 h-4 text-slate-400 absolute left-3 top-1/2 -translate-y-1/2" />
              <input
                type="text"
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                placeholder={activeLang === 'bn' ? 'শর্তাবলীতে সার্চ করুন...' : 'Search within terms...'}
                className="w-full pl-9 pr-3 py-1.5 text-xs bg-slate-50 border border-slate-200 rounded-xl focus:outline-none focus:ring-2 focus:ring-[#00bf63] focus:bg-white text-slate-800 placeholder-slate-400 transition-all"
              />
              {searchQuery && (
                <button
                  onClick={() => setSearchQuery('')}
                  className="absolute right-2.5 top-1/2 -translate-y-1/2 text-slate-400 hover:text-slate-600 text-xs px-1"
                >
                  ✕
                </button>
              )}
            </div>
          </div>
        </div>
      </section>

      {/* Main Content Area */}
      <div className="container mx-auto px-4 sm:px-6 lg:px-8 max-w-6xl py-10">
        
        {/* Key Highlights / TL;DR Banner */}
        <div className="mb-10">
          <div className="flex items-center gap-2 mb-4">
            <Sparkles className="w-4 h-4 text-[#00bf63]" />
            <h2 className="text-sm font-bold uppercase tracking-wider text-slate-600">
              {activeLang === 'bn' ? 'এক নজরে প্রধান অঙ্গীকারসমূহ (Key Commitments)' : 'Key Commitments & Guarantees at a Glance'}
            </h2>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
            {currentData.keyHighlights.map((hl, idx) => {
              const IconComponent = ICON_MAP[hl.icon] || ShieldCheck
              return (
                <div
                  key={idx}
                  className="p-4 bg-white rounded-2xl border border-slate-200/90 shadow-xs hover:border-[#00bf63]/50 transition-all group"
                >
                  <div className="w-9 h-9 rounded-xl bg-[#00bf63]/10 text-[#00bf63] flex items-center justify-center mb-3 group-hover:scale-105 transition-transform">
                    <IconComponent className="w-5 h-5" />
                  </div>
                  <h3 className="font-bold text-sm text-slate-900 mb-1.5 leading-snug">
                    {hl.title}
                  </h3>
                  <p className="text-xs text-slate-600 leading-relaxed">
                    {hl.desc}
                  </p>
                </div>
              )
            })}
          </div>
        </div>

        {/* Search Results Notification */}
        {searchQuery && (
          <div className="mb-6 p-3 bg-emerald-50 border border-emerald-200 rounded-xl text-xs text-emerald-900 flex items-center justify-between">
            <span>
              {activeLang === 'bn'
                ? `"${searchQuery}" এর জন্য ${filteredSections.length} টি প্রাসঙ্গিক ধারা পাওয়া গেছে`
                : `Found ${filteredSections.length} section(s) matching "${searchQuery}"`}
            </span>
            <button
              onClick={() => setSearchQuery('')}
              className="text-[#00bf63] font-bold hover:underline"
            >
              {activeLang === 'bn' ? 'ফিল্টার মুছুন' : 'Clear search'}
            </button>
          </div>
        )}

        {/* Side-by-Side (Parallel Bilingual View) */}
        {viewMode === 'parallel' ? (
          <div className="space-y-8">
            <div className="p-4 bg-slate-900 text-white rounded-2xl flex flex-col sm:flex-row items-start sm:items-center justify-between gap-3">
              <div>
                <h3 className="text-sm font-bold flex items-center gap-2">
                  <Columns className="w-4 h-4 text-[#00bf63]" />
                  <span>দ্বিভাষিক সমান্তরাল প্রদর্শন (Bilingual Parallel View)</span>
                </h3>
                <p className="text-xs text-slate-400 mt-0.5">
                  বাংলা ও ইংরেজি সংস্করণ পাশাপাশি মিলিয়ে দেখার জন্য প্রদর্শিত হচ্ছে।
                </p>
              </div>
              <button
                onClick={() => setViewMode('current')}
                className="px-3 py-1.5 bg-slate-800 hover:bg-slate-700 text-xs font-semibold rounded-lg border border-slate-700 transition-colors"
              >
                একক ভিউতে ফিরুন (Single View)
              </button>
            </div>

            <div className="space-y-8">
              {bnData.sections.map((secBn, idx) => {
                const secEn = enData.sections[idx] || {}
                return (
                  <div
                    key={secBn.id}
                    id={secBn.id}
                    className="bg-white rounded-2xl border border-slate-200 shadow-xs overflow-hidden"
                  >
                    {/* Section Header */}
                    <div className="p-4 bg-slate-50/80 border-b border-slate-200 flex items-center gap-3">
                      <span className="w-7 h-7 rounded-lg bg-[#00bf63] text-white text-xs font-extrabold flex items-center justify-center">
                        {secBn.number}
                      </span>
                      <div className="flex-1 grid grid-cols-1 md:grid-cols-2 gap-4">
                        <h2 className="font-bold text-base text-slate-900">
                          {secBn.title}
                        </h2>
                        <h2 className="font-bold text-base text-slate-700 hidden md:block">
                          {secEn.title}
                        </h2>
                      </div>
                    </div>

                    {/* Parallel Columns */}
                    <div className="grid grid-cols-1 md:grid-cols-2 divide-y md:divide-y-0 md:divide-x divide-slate-100 p-6 gap-6">
                      {/* Bangla Column */}
                      <div className="space-y-3 font-bangla">
                        <div className="text-[11px] font-bold text-emerald-700 uppercase tracking-wider flex items-center gap-1.5 pb-2 border-b border-slate-100">
                          <span>🇧🇩</span>
                          <span>বাংলা সংস্করণ</span>
                        </div>
                        {secBn.content.map((p, pIdx) => (
                          <p key={pIdx} className="text-xs sm:text-sm text-slate-700 leading-relaxed">
                            {p}
                          </p>
                        ))}
                        {secBn.callout && (
                          <div className={`mt-3 p-3.5 rounded-xl border text-xs leading-relaxed ${
                            secBn.callout.type === 'warning'
                              ? 'bg-amber-50 border-amber-200 text-amber-900'
                              : secBn.callout.type === 'success'
                              ? 'bg-emerald-50 border-emerald-200 text-emerald-900'
                              : 'bg-blue-50 border-blue-200 text-blue-900'
                          }`}>
                            <div className="font-bold mb-1 flex items-center gap-1.5">
                              {secBn.callout.type === 'warning' ? <AlertTriangle className="w-3.5 h-3.5 text-amber-600" /> : <Info className="w-3.5 h-3.5" />}
                              <span>{secBn.callout.title}</span>
                            </div>
                            <p>{secBn.callout.text}</p>
                          </div>
                        )}
                      </div>

                      {/* English Column */}
                      <div className="space-y-3 pt-6 md:pt-0">
                        <div className="text-[11px] font-bold text-slate-500 uppercase tracking-wider flex items-center gap-1.5 pb-2 border-b border-slate-100">
                          <span>🇬🇧</span>
                          <span>English Version</span>
                        </div>
                        {secEn.content?.map((p, pIdx) => (
                          <p key={pIdx} className="text-xs sm:text-sm text-slate-700 leading-relaxed">
                            {p}
                          </p>
                        ))}
                        {secEn.callout && (
                          <div className={`mt-3 p-3.5 rounded-xl border text-xs leading-relaxed ${
                            secEn.callout.type === 'warning'
                              ? 'bg-amber-50 border-amber-200 text-amber-900'
                              : secEn.callout.type === 'success'
                              ? 'bg-emerald-50 border-emerald-200 text-emerald-900'
                              : 'bg-blue-50 border-blue-200 text-blue-900'
                          }`}>
                            <div className="font-bold mb-1 flex items-center gap-1.5">
                              {secEn.callout.type === 'warning' ? <AlertTriangle className="w-3.5 h-3.5 text-amber-600" /> : <Info className="w-3.5 h-3.5" />}
                              <span>{secEn.callout.title}</span>
                            </div>
                            <p>{secEn.callout.text}</p>
                          </div>
                        )}
                      </div>
                    </div>
                  </div>
                )
              })}
            </div>
          </div>
        ) : (
          /* Standard Layout: Sidebar Table of Contents + Main Articles */
          <div className="grid grid-cols-1 lg:grid-cols-12 gap-8 items-start">
            {/* Sticky Table of Contents (Desktop Sidebar) */}
            <aside className="hidden lg:block lg:col-span-4 sticky top-36">
              <div className="bg-white rounded-2xl border border-slate-200/90 p-5 shadow-xs">
                <div className="flex items-center gap-2 pb-3 mb-3 border-b border-slate-100">
                  <BookOpen className="w-4 h-4 text-[#00bf63]" />
                  <h3 className="font-bold text-xs uppercase tracking-wider text-slate-900">
                    {activeLang === 'bn' ? 'ধারা ও বিষয়বস্তু' : 'Table of Contents'}
                  </h3>
                </div>

                <nav className="space-y-1 max-h-[calc(100vh-220px)] overflow-y-auto pr-1">
                  {currentData.sections.map((sec) => {
                    const isActive = activeSectionId === sec.id
                    return (
                      <button
                        key={sec.id}
                        type="button"
                        onClick={() => scrollToSection(sec.id)}
                        className={`w-full text-left px-3 py-2 rounded-xl text-xs font-medium transition-all flex items-center gap-2.5 cursor-pointer ${
                          isActive
                            ? 'bg-[#00bf63]/10 text-[#00bf63] font-bold shadow-xs'
                            : 'text-slate-600 hover:text-slate-900 hover:bg-slate-50'
                        }`}
                      >
                        <span
                          className={`w-5 h-5 rounded-md flex items-center justify-center text-[10px] font-bold shrink-0 ${
                            isActive
                              ? 'bg-[#00bf63] text-white'
                              : 'bg-slate-100 text-slate-500'
                          }`}
                        >
                          {sec.number}
                        </span>
                        <span className="truncate">{sec.title}</span>
                      </button>
                    )
                  })}
                </nav>

                <div className="mt-5 pt-4 border-t border-slate-100 text-xs text-slate-500 flex flex-col gap-2">
                  <div className="flex items-center gap-2">
                    <ShieldCheck className="w-4 h-4 text-[#00bf63]" />
                    <span>{activeLang === 'bn' ? 'বাংলাদেশ সাইবার নিরাপত্তা আইন ২০২৩' : 'Cyber Security Act 2023 Compliant'}</span>
                  </div>
                </div>
              </div>
            </aside>

            {/* Articles Column */}
            <main className="lg:col-span-8 space-y-6">
              {filteredSections.map((sec) => (
                <article
                  key={sec.id}
                  id={sec.id}
                  className="bg-white rounded-2xl border border-slate-200/90 p-6 sm:p-7 shadow-xs scroll-mt-28 transition-all hover:border-slate-300"
                >
                  {/* Section Title */}
                  <div className="flex items-start gap-3.5 mb-4">
                    <span className="w-8 h-8 rounded-xl bg-slate-900 text-white font-extrabold text-xs flex items-center justify-center shrink-0 mt-0.5">
                      {sec.number}
                    </span>
                    <div>
                      <h2 className="text-lg sm:text-xl font-extrabold text-slate-900 leading-snug">
                        {sec.title}
                      </h2>
                    </div>
                  </div>

                  {/* Section Content Paragraphs */}
                  <div className="space-y-3.5 text-xs sm:text-sm text-slate-700 leading-relaxed pl-0 sm:pl-11">
                    {sec.content.map((paragraph, pIdx) => (
                      <p key={pIdx}>
                        {paragraph}
                      </p>
                    ))}

                    {/* Callout Box if exists */}
                    {sec.callout && (
                      <div
                        className={`mt-4 p-4 rounded-xl border text-xs sm:text-sm leading-relaxed ${
                          sec.callout.type === 'warning'
                            ? 'bg-amber-50 border-amber-200/90 text-amber-950'
                            : sec.callout.type === 'success'
                            ? 'bg-emerald-50 border-emerald-200/90 text-emerald-950'
                            : 'bg-blue-50 border-blue-200/90 text-blue-950'
                        }`}
                      >
                        <div className="font-bold mb-1.5 flex items-center gap-2">
                          {sec.callout.type === 'warning' ? (
                            <AlertTriangle className="w-4 h-4 text-amber-600 shrink-0" />
                          ) : sec.callout.type === 'success' ? (
                            <ShieldCheck className="w-4 h-4 text-emerald-600 shrink-0" />
                          ) : (
                            <Info className="w-4 h-4 text-blue-600 shrink-0" />
                          )}
                          <span className="font-bold">{sec.callout.title}</span>
                        </div>
                        <p className="text-xs sm:text-xs leading-relaxed opacity-95">
                          {sec.callout.text}
                        </p>
                      </div>
                    )}
                  </div>
                </article>
              ))}

              {filteredSections.length === 0 && (
                <div className="text-center py-16 bg-white rounded-2xl border border-slate-200 p-8">
                  <HelpCircle className="w-12 h-12 text-slate-300 mx-auto mb-3" />
                  <h3 className="font-bold text-base text-slate-800 mb-1">
                    {activeLang === 'bn' ? 'কোনো ফলাফল পাওয়া যায়নি' : 'No matching sections found'}
                  </h3>
                  <p className="text-xs text-slate-500 mb-4">
                    {activeLang === 'bn'
                      ? 'ভিন্ন কোনো কী-ওয়ার্ড দিয়ে চেষ্টা করুন অথবা ফিল্টার বাতিল করুন।'
                      : 'Try different search keywords or reset the filter.'}
                  </p>
                  <button
                    onClick={() => setSearchQuery('')}
                    className="px-4 py-2 bg-[#00bf63] text-white rounded-xl text-xs font-bold"
                  >
                    {activeLang === 'bn' ? 'সব ধারা প্রদর্শন করুন' : 'Show All Sections'}
                  </button>
                </div>
              )}
            </main>
          </div>
        )}

        {/* Bottom Support / Grievance Contact Card */}
        <div className="mt-12 bg-white rounded-2xl border border-slate-200 p-6 sm:p-8 shadow-xs">
          <div className="flex flex-col md:flex-row items-start md:items-center justify-between gap-6">
            <div>
              <div className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-md bg-[#00bf63]/10 text-[#00bf63] text-xs font-semibold mb-2">
                <HelpCircle className="w-3.5 h-3.5" />
                <span>{activeLang === 'bn' ? 'প্রশ্ন বা অভিযোগ?' : 'Questions or Complaints?'}</span>
              </div>
              <h3 className="text-lg sm:text-xl font-bold text-slate-900 mb-1">
                {activeLang === 'bn' ? 'কোনো ধারা সম্পর্কে আরও জানতে চান?' : 'Need clarification on any policy clause?'}
              </h3>
              <p className="text-xs sm:text-sm text-slate-600 max-w-xl">
                {activeLang === 'bn'
                  ? 'আমাদের লিগ্যাল ও সাপোর্ট টিম আপনার যেকোনো প্রশ্নের উত্তর দিতে সর্বদা প্রস্তুত।'
                  : 'Our legal and customer support team is available to assist you with inquiries, refunds, and partner guidelines.'}
              </p>
            </div>

            <div className="flex flex-wrap items-center gap-3">
              <a
                href="https://wa.me/8801733398911"
                target="_blank"
                rel="noopener noreferrer"
                className="inline-flex items-center gap-2 px-4 py-2.5 rounded-xl bg-[#00bf63] hover:bg-[#00a656] text-white font-bold text-xs transition-all shadow-xs"
              >
                <Phone className="w-4 h-4" />
                <span>{activeLang === 'bn' ? 'হোয়াটসঅ্যাপে যোগাযোগ' : 'WhatsApp Support'}</span>
              </a>

              <Link
                href="/contact"
                className="inline-flex items-center gap-2 px-4 py-2.5 rounded-xl bg-slate-900 hover:bg-slate-800 text-white font-bold text-xs transition-all shadow-xs"
              >
                <Mail className="w-4 h-4" />
                <span>{activeLang === 'bn' ? 'যোগাযোগ পেজ' : 'Contact Us'}</span>
              </Link>
            </div>
          </div>
        </div>

      </div>

      {/* Footer */}
      <Footer />
    </div>
  )
}
