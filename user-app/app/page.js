'use client'

import { useState, useEffect } from 'react'
import Link from 'next/link'
import Footer from '@/components/Footer'
import { Button } from '@/components/ui/button'
import { Card, CardContent } from '@/components/ui/card'
import { Badge } from '@/components/ui/badge'
import {
  Upload,
  MapPin,
  Printer,
  Clock,
  DollarSign,
  Users,
  ArrowRight,
  Zap,
  Shield,
  TrendingUp,
  CheckCircle,
  Sparkles,
  QrCode,
  Camera,
  FileText,
  CreditCard,
  Lock,
  ChevronDown,
  ChevronUp,
  Layers,
  Star,
  Check,
  Building,
  GraduationCap
} from 'lucide-react'
import { useLanguage } from '@/context/LanguageContext'

export default function HomePage() {
  const { t, lang, toBengaliNumber } = useLanguage()
  const [isVisible, setIsVisible] = useState(false)
  
  // FAQ Accordion State
  const [openFaq, setOpenFaq] = useState(0)

  useEffect(() => {
    setIsVisible(true)
  }, [])

  const faqItems = t('faq.items', [])

  return (
    <div className="bg-white font-sans text-gray-900 overflow-x-hidden">
      {/* Hero Section */}
      <section className="relative overflow-hidden bg-gradient-to-b from-[#00bf63]/6 via-emerald-50/20 to-white pt-12 pb-20 sm:pt-20 sm:pb-28 border-b border-gray-100">
        {/* Background decorative elements */}
        <div className="absolute top-0 inset-x-0 h-96 bg-[radial-gradient(ellipse_80%_60%_at_50%_-20%,rgba(0,191,99,0.12),rgba(255,255,255,0))] pointer-events-none" />
        <div className="absolute -top-32 -left-32 w-96 h-96 bg-[#00bf63]/10 rounded-full blur-3xl pointer-events-none" />
        <div className="absolute top-1/2 -right-32 w-96 h-96 bg-emerald-400/10 rounded-full blur-3xl pointer-events-none" />

        <div className="container mx-auto px-4 sm:px-6 lg:px-8 relative z-10">
          <div className={`max-w-3xl mx-auto text-center transition-all duration-700 ${isVisible ? 'opacity-100 translate-y-0' : 'opacity-0 translate-y-6'}`}>
            
            {/* Shimmer Badge */}
            <div className="inline-flex items-center gap-2 bg-white border border-[#00bf63]/30 text-emerald-800 px-4 py-1.5 rounded-full text-xs font-bold mb-6 shadow-xs hover:border-[#00bf63] transition-colors">
              <span className="flex h-2 w-2 relative">
                <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-[#00bf63] opacity-75" />
                <span className="relative inline-flex rounded-full h-2 w-2 bg-[#00bf63]" />
              </span>
              <span>{t('hero.badge')}</span>
            </div>

            {/* Main Headline */}
            <h1 className="text-4xl sm:text-5xl lg:text-6xl font-black text-gray-950 mb-6 leading-[1.12] tracking-tight">
              {t('hero.headlineStart')}{' '}
              <span className="text-[#00bf63] relative inline-block">
                {t('hero.headlineHighlight')}
                <svg className="absolute -bottom-2 left-0 w-full h-3 text-[#00bf63]/25" viewBox="0 0 100 20" preserveAspectRatio="none">
                  <path d="M0,15 Q50,0 100,15" stroke="currentColor" strokeWidth="6" fill="none" strokeLinecap="round" />
                </svg>
              </span>
              {t('hero.headlineEnd') && ` ${t('hero.headlineEnd')}`}
            </h1>

            {/* Subtitle */}
            <p className="text-base sm:text-lg text-gray-600 mb-8 leading-relaxed max-w-2xl mx-auto">
              {t('hero.subtitle')}
            </p>

            {/* CTA Buttons */}
            <div className="flex flex-col sm:flex-row justify-center gap-3.5 mb-10">
              <Link href="/print">
                <Button size="lg" className="w-full sm:w-auto text-sm sm:text-base px-8 py-6 bg-[#00bf63] hover:bg-[#00a656] text-white font-bold rounded-xl shadow-lg shadow-[#00bf63]/20 hover:shadow-xl hover:shadow-[#00bf63]/30 transition-all duration-200 flex items-center justify-center gap-2.5 hover:scale-102">
                  <Printer className="h-5 w-5" />
                  <span>{t('hero.ctaPrint')}</span>
                  <ArrowRight className="h-4 w-4" />
                </Button>
              </Link>

              <Link href="/find-printer">
                <Button size="lg" variant="outline" className="w-full sm:w-auto text-sm sm:text-base px-7 py-6 border-2 border-gray-200 hover:border-[#00bf63] hover:bg-[#00bf63]/5 text-gray-800 font-bold rounded-xl shadow-none transition-all duration-200 flex items-center justify-center gap-2">
                  <MapPin className="h-4 w-4 text-[#00bf63]" />
                  <span>{t('hero.ctaFind')}</span>
                </Button>
              </Link>
            </div>

            {/* Key Trust Counters */}
            <div className="pt-6 border-t border-gray-200/90 grid grid-cols-3 gap-3 sm:gap-6 max-w-lg mx-auto">
              <div>
                <p className="text-xl sm:text-2xl font-black text-gray-950 flex items-baseline justify-center gap-0.5">
                  <span>{t('hero.rate')}</span>
                </p>
                <p className="text-xs text-gray-500 font-medium mt-0.5">{t('hero.rateSub')}</p>
              </div>

              <div className="border-l border-gray-200 pl-3 sm:pl-6">
                <p className="text-xl sm:text-2xl font-black text-gray-950 flex items-baseline justify-center gap-1">
                  <span>{t('hero.speed')}</span>
                </p>
                <p className="text-xs text-gray-500 font-medium mt-0.5">{t('hero.speedSub')}</p>
              </div>

              <div className="border-l border-gray-200 pl-3 sm:pl-6">
                <p className="text-xl sm:text-2xl font-black text-[#00bf63] flex items-baseline justify-center">
                  <span>{t('hero.privacy')}</span>
                </p>
                <p className="text-xs text-gray-500 font-medium mt-0.5">{t('hero.privacySub')}</p>
              </div>
            </div>

          </div>
        </div>
      </section>

      {/* How It Works Section */}
      <section className="py-20 sm:py-24 bg-white border-b border-gray-100">
        <div className="container mx-auto px-4 sm:px-6 lg:px-8">
          <div className="text-center max-w-2xl mx-auto mb-14 sm:mb-16">
            <span className="text-xs font-bold text-[#00bf63] tracking-widest uppercase mb-2 block">
              {t('howItWorks.tag')}
            </span>
            <h2 className="text-3xl sm:text-4xl font-extrabold text-gray-950 tracking-tight mb-3">
              {t('howItWorks.title')}
            </h2>
            <p className="text-sm sm:text-base text-gray-600">
              {t('howItWorks.subtitle')}
            </p>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-3 gap-6 lg:gap-8 max-w-5xl mx-auto">
            {/* Step 1 */}
            <div className="group relative bg-slate-50/70 border border-gray-200/80 hover:border-[#00bf63] rounded-2xl p-6 sm:p-7 transition-all duration-200 hover:-translate-y-1 hover:shadow-lg hover:shadow-[#00bf63]/5">
              <div className="flex items-center justify-between mb-5">
                <div className="w-12 h-12 bg-white border border-[#00bf63]/30 text-[#00bf63] rounded-xl flex items-center justify-center font-bold shadow-xs group-hover:scale-105 transition-transform">
                  <Upload className="w-5 h-5" />
                </div>
                <span className="text-xl font-black text-gray-400 font-mono">
                  {toBengaliNumber(t('howItWorks.step1Num'))}
                </span>
              </div>
              <h3 className="text-lg font-bold text-gray-950 mb-2">
                {t('howItWorks.step1Title')}
              </h3>
              <p className="text-xs sm:text-sm text-gray-600 leading-relaxed">
                {t('howItWorks.step1Desc')}
              </p>
            </div>

            {/* Step 2 */}
            <div className="group relative bg-slate-50/70 border border-gray-200/80 hover:border-[#00bf63] rounded-2xl p-6 sm:p-7 transition-all duration-200 hover:-translate-y-1 hover:shadow-lg hover:shadow-[#00bf63]/5">
              <div className="flex items-center justify-between mb-5">
                <div className="w-12 h-12 bg-white border border-[#00bf63]/30 text-[#00bf63] rounded-xl flex items-center justify-center font-bold shadow-xs group-hover:scale-105 transition-transform">
                  <QrCode className="w-5 h-5" />
                </div>
                <span className="text-xl font-black text-gray-400 font-mono">
                  {toBengaliNumber(t('howItWorks.step2Num'))}
                </span>
              </div>
              <h3 className="text-lg font-bold text-gray-950 mb-2">
                {t('howItWorks.step2Title')}
              </h3>
              <p className="text-xs sm:text-sm text-gray-600 leading-relaxed">
                {t('howItWorks.step2Desc')}
              </p>
            </div>

            {/* Step 3 */}
            <div className="group relative bg-slate-50/70 border border-gray-200/80 hover:border-[#00bf63] rounded-2xl p-6 sm:p-7 transition-all duration-200 hover:-translate-y-1 hover:shadow-lg hover:shadow-[#00bf63]/5">
              <div className="flex items-center justify-between mb-5">
                <div className="w-12 h-12 bg-white border border-[#00bf63]/30 text-[#00bf63] rounded-xl flex items-center justify-center font-bold shadow-xs group-hover:scale-105 transition-transform">
                  <Printer className="w-5 h-5" />
                </div>
                <span className="text-xl font-black text-gray-400 font-mono">
                  {toBengaliNumber(t('howItWorks.step3Num'))}
                </span>
              </div>
              <h3 className="text-lg font-bold text-gray-950 mb-2">
                {t('howItWorks.step3Title')}
              </h3>
              <p className="text-xs sm:text-sm text-gray-600 leading-relaxed">
                {t('howItWorks.step3Desc')}
              </p>
            </div>
          </div>
        </div>
      </section>


      {/* Smart Technology Features Section */}
      <section className="py-20 sm:py-24 bg-white border-b border-gray-100">
        <div className="container mx-auto px-4 sm:px-6 lg:px-8">
          <div className="text-center max-w-2xl mx-auto mb-14">
            <span className="text-xs font-bold text-[#00bf63] tracking-widest uppercase mb-2 block">
              {t('features.tag')}
            </span>
            <h2 className="text-3xl sm:text-4xl font-extrabold text-gray-950 tracking-tight mb-3">
              {t('features.title')}
            </h2>
            <p className="text-sm text-gray-600">
              {t('features.subtitle')}
            </p>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-6 max-w-5xl mx-auto">
            {/* Feature 1: Clean B&W Smart Scanner */}
            <div className="border border-gray-200 hover:border-[#00bf63] rounded-2xl p-6 sm:p-7 transition-all duration-200 hover:shadow-md bg-white">
              <div className="w-12 h-12 rounded-xl bg-emerald-50 text-[#00bf63] border border-emerald-200 flex items-center justify-center font-bold mb-4">
                <Camera className="w-6 h-6" />
              </div>
              <h3 className="text-lg font-bold text-gray-950 mb-2">
                {t('features.scannerTitle')}
              </h3>
              <p className="text-xs sm:text-sm text-gray-600 leading-relaxed mb-4">
                {t('features.scannerDesc')}
              </p>
              <Link href="/print" className="inline-flex items-center gap-1.5 text-xs font-bold text-[#00bf63] hover:underline">
                <span>{t('features.exploreFeature')}</span>
                <ArrowRight className="w-3.5 h-3.5" />
              </Link>
            </div>

            {/* Feature 2: 2-in-1 NID / ID Card */}
            <div className="border border-gray-200 hover:border-[#00bf63] rounded-2xl p-6 sm:p-7 transition-all duration-200 hover:shadow-md bg-white">
              <div className="w-12 h-12 rounded-xl bg-blue-50 text-blue-600 border border-blue-200 flex items-center justify-center font-bold mb-4">
                <Layers className="w-6 h-6" />
              </div>
              <h3 className="text-lg font-bold text-gray-950 mb-2">
                {t('features.idTitle')}
              </h3>
              <p className="text-xs sm:text-sm text-gray-600 leading-relaxed mb-4">
                {t('features.idDesc')}
              </p>
              <Link href="/print" className="inline-flex items-center gap-1.5 text-xs font-bold text-[#00bf63] hover:underline">
                <span>{t('features.exploreFeature')}</span>
                <ArrowRight className="w-3.5 h-3.5" />
              </Link>
            </div>

            {/* Feature 3: Passport Photo Generator */}
            <div className="border border-gray-200 hover:border-[#00bf63] rounded-2xl p-6 sm:p-7 transition-all duration-200 hover:shadow-md bg-white">
              <div className="w-12 h-12 rounded-xl bg-purple-50 text-purple-600 border border-purple-200 flex items-center justify-center font-bold mb-4">
                <Sparkles className="w-6 h-6" />
              </div>
              <h3 className="text-lg font-bold text-gray-950 mb-2">
                {t('features.passportTitle')}
              </h3>
              <p className="text-xs sm:text-sm text-gray-600 leading-relaxed mb-4">
                {t('features.passportDesc')}
              </p>
              <Link href="/print" className="inline-flex items-center gap-1.5 text-xs font-bold text-[#00bf63] hover:underline">
                <span>{t('features.exploreFeature')}</span>
                <ArrowRight className="w-3.5 h-3.5" />
              </Link>
            </div>

            {/* Feature 4: N-in-1 Mini Print */}
            <div className="border border-gray-200 hover:border-[#00bf63] rounded-2xl p-6 sm:p-7 transition-all duration-200 hover:shadow-md bg-white">
              <div className="w-12 h-12 rounded-xl bg-amber-50 text-amber-600 border border-amber-200 flex items-center justify-center font-bold mb-4">
                <FileText className="w-6 h-6" />
              </div>
              <h3 className="text-lg font-bold text-gray-950 mb-2">
                {t('features.miniTitle')}
              </h3>
              <p className="text-xs sm:text-sm text-gray-600 leading-relaxed mb-4">
                {t('features.miniDesc')}
              </p>
              <Link href="/print" className="inline-flex items-center gap-1.5 text-xs font-bold text-[#00bf63] hover:underline">
                <span>{t('features.exploreFeature')}</span>
                <ArrowRight className="w-3.5 h-3.5" />
              </Link>
            </div>
          </div>
        </div>
      </section>

      {/* Pricing Section */}
      <section className="py-20 sm:py-24 bg-slate-50 border-b border-gray-100">
        <div className="container mx-auto px-4 sm:px-6 lg:px-8">
          <div className="text-center max-w-2xl mx-auto mb-14">
            <span className="text-xs font-bold text-[#00bf63] tracking-widest uppercase mb-2 block">
              {t('pricing.tag')}
            </span>
            <h2 className="text-3xl sm:text-4xl font-extrabold text-gray-950 tracking-tight mb-2">
              {t('pricing.title')}
            </h2>
            <p className="text-sm text-gray-600">
              {t('pricing.subtitle')}
            </p>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-6 max-w-3xl mx-auto">
            {/* Black & White Plan */}
            <Card className="relative rounded-3xl border-2 border-[#00bf63] p-7 sm:p-8 bg-white shadow-md">
              <span className="absolute top-5 right-5 bg-emerald-100 text-[#00bf63] text-[10px] font-bold px-3 py-1 rounded-full uppercase tracking-wider">
                {t('pricing.popular')}
              </span>
              <h3 className="text-xl font-bold text-gray-950 mb-1">{t('pricing.bwTitle')}</h3>
              <p className="text-xs text-gray-500 mb-5">{t('pricing.bwDesc')}</p>
              
              <div className="mb-6 flex items-baseline gap-1">
                <span className="text-4xl sm:text-5xl font-black text-gray-950">{toBengaliNumber(t('pricing.bwPrice'))}</span>
                <span className="text-xs text-gray-500 font-medium">/ {t('pricing.bwUnit')}</span>
              </div>

              <ul className="space-y-3 mb-8 text-xs text-gray-700">
                {(t('pricing.bwFeatures', []) || []).map((feat, i) => (
                  <li key={i} className="flex items-center gap-2.5">
                    <Check className="h-4 w-4 text-[#00bf63] flex-shrink-0" />
                    <span>{feat}</span>
                  </li>
                ))}
              </ul>

              <Link href="/print">
                <Button className="w-full bg-[#00bf63] hover:bg-[#00a656] text-white font-bold py-3 text-xs sm:text-sm rounded-xl shadow-none">
                  {t('pricing.btnPrintWith')} {t('pricing.bwTitle')}
                </Button>
              </Link>
            </Card>

            {/* Color Plan */}
            <Card className="relative rounded-3xl border border-gray-200 p-7 sm:p-8 bg-white shadow-none hover:border-gray-300 transition-colors">
              <h3 className="text-xl font-bold text-gray-950 mb-1">{t('pricing.colorTitle')}</h3>
              <p className="text-xs text-gray-500 mb-5">{t('pricing.colorDesc')}</p>
              
              <div className="mb-6 flex items-baseline gap-1">
                <span className="text-4xl sm:text-5xl font-black text-gray-950">{toBengaliNumber(t('pricing.colorPrice'))}</span>
                <span className="text-xs text-gray-500 font-medium">/ {t('pricing.colorUnit')}</span>
              </div>

              <ul className="space-y-3 mb-8 text-xs text-gray-700">
                {(t('pricing.colorFeatures', []) || []).map((feat, i) => (
                  <li key={i} className="flex items-center gap-2.5">
                    <Check className="h-4 w-4 text-[#00bf63] flex-shrink-0" />
                    <span>{feat}</span>
                  </li>
                ))}
              </ul>

              <Link href="/print">
                <Button className="w-full bg-gray-100 hover:bg-gray-200 text-gray-900 font-bold py-3 text-xs sm:text-sm rounded-xl shadow-none">
                  {t('pricing.btnPrintWith')} {t('pricing.colorTitle')}
                </Button>
              </Link>
            </Card>
          </div>
        </div>
      </section>

      {/* Security & Privacy Section */}
      <section className="py-20 sm:py-24 bg-white border-b border-gray-100">
        <div className="container mx-auto px-4 sm:px-6 lg:px-8">
          <div className="max-w-4xl mx-auto text-center mb-14">
            <div className="w-12 h-12 rounded-xl bg-emerald-50 text-[#00bf63] border border-emerald-200 flex items-center justify-center mx-auto mb-4 font-bold">
              <Shield className="w-6 h-6" />
            </div>
            <span className="text-xs font-bold text-[#00bf63] tracking-widest uppercase mb-1 block">
              {t('security.tag')}
            </span>
            <h2 className="text-3xl sm:text-4xl font-extrabold text-gray-950 tracking-tight mb-3">
              {t('security.title')}
            </h2>
            <p className="text-sm sm:text-base text-gray-600 max-w-xl mx-auto">
              {t('security.subtitle')}
            </p>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-6 max-w-5xl mx-auto">
            {[
              { title: t('security.point1Title'), desc: t('security.point1Desc'), icon: Zap },
              { title: t('security.point2Title'), desc: t('security.point2Desc'), icon: Lock },
              { title: t('security.point3Title'), desc: t('security.point3Desc'), icon: Shield },
              { title: t('security.point4Title'), desc: t('security.point4Desc'), icon: CheckCircle },
            ].map((p, idx) => {
              const Icon = p.icon
              return (
                <div key={idx} className="bg-slate-50 border border-gray-200/80 rounded-2xl p-5 text-left">
                  <div className="w-9 h-9 rounded-lg bg-white border border-gray-200 text-[#00bf63] flex items-center justify-center font-bold mb-3 shadow-xs">
                    <Icon className="w-4 h-4" />
                  </div>
                  <h4 className="text-sm font-bold text-gray-900 mb-1.5">{p.title}</h4>
                  <p className="text-xs text-gray-600 leading-relaxed">{p.desc}</p>
                </div>
              )
            })}
          </div>
        </div>
      </section>

      {/* Campus Hubs & Locations */}
      <section className="py-20 sm:py-24 bg-slate-50 border-b border-gray-100">
        <div className="container mx-auto px-4 sm:px-6 lg:px-8">
          <div className="max-w-4xl mx-auto text-center mb-12">
            <span className="text-xs font-bold text-[#00bf63] tracking-widest uppercase mb-2 block">
              {t('locations.tag')}
            </span>
            <h2 className="text-3xl sm:text-4xl font-extrabold text-gray-950 tracking-tight mb-3">
              {t('locations.title')}
            </h2>
            <p className="text-sm text-gray-600">
              {t('locations.subtitle')}
            </p>
          </div>

          <div className="grid grid-cols-2 sm:grid-cols-3 gap-3.5 sm:gap-4 max-w-4xl mx-auto mb-8">
            {(t('locations.hubs', []) || []).map((hub, idx) => (
              <div key={idx} className="bg-white border border-gray-200 rounded-xl p-4 flex items-start gap-3 shadow-xs hover:border-[#00bf63] transition-colors">
                <GraduationCap className="w-5 h-5 text-[#00bf63] flex-shrink-0 mt-0.5" />
                <div>
                  <h4 className="text-xs sm:text-sm font-bold text-gray-900">{hub.name}</h4>
                  <p className="text-[11px] text-gray-500 mt-0.5">{hub.tag}</p>
                </div>
              </div>
            ))}
          </div>

          <div className="text-center">
            <Link href="/find-printer">
              <Button size="lg" className="bg-[#00bf63] hover:bg-[#00a656] text-white font-bold text-xs sm:text-sm px-6 py-3 rounded-xl shadow-none">
                <MapPin className="w-4 h-4 mr-1.5" /> {t('locations.viewAllBtn')}
              </Button>
            </Link>
            <p className="text-xs text-gray-500 mt-2">{t('locations.totalCount')}</p>
          </div>
        </div>
      </section>

      {/* User Reviews / Social Proof */}
      <section className="py-20 sm:py-24 bg-white border-b border-gray-100">
        <div className="container mx-auto px-4 sm:px-6 lg:px-8">
          <div className="max-w-2xl mx-auto text-center mb-14">
            <span className="text-xs font-bold text-[#00bf63] tracking-widest uppercase mb-2 block">
              {t('testimonials.tag')}
            </span>
            <h2 className="text-3xl sm:text-4xl font-extrabold text-gray-950 tracking-tight mb-3">
              {t('testimonials.title')}
            </h2>
            <p className="text-sm text-gray-600">
              {t('testimonials.subtitle')}
            </p>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-3 gap-6 max-w-5xl mx-auto">
            {(t('testimonials.reviews', []) || []).map((rev, idx) => (
              <div key={idx} className="bg-slate-50/70 border border-gray-200/80 rounded-2xl p-6 flex flex-col justify-between">
                <div>
                  <div className="flex gap-1 text-amber-400 mb-3">
                    {[...Array(rev.rating || 5)].map((_, i) => (
                      <Star key={i} className="w-4 h-4 fill-amber-400 text-amber-400" />
                    ))}
                  </div>
                  <p className="text-xs sm:text-sm text-gray-700 italic leading-relaxed mb-4">
                    &ldquo;{rev.quote}&rdquo;
                  </p>
                </div>
                <div className="pt-3 border-t border-gray-200/80">
                  <h4 className="text-xs font-bold text-gray-900">{rev.name}</h4>
                  <p className="text-[11px] text-gray-500">{rev.role}</p>
                </div>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* FAQ Accordion Section */}
      <section id="faq" className="py-20 sm:py-24 bg-slate-50 border-b border-gray-100">
        <div className="container mx-auto px-4 sm:px-6 lg:px-8">
          <div className="max-w-3xl mx-auto">
            <div className="text-center mb-12">
              <span className="text-xs font-bold text-[#00bf63] tracking-widest uppercase mb-2 block">
                {t('faq.tag')}
              </span>
              <h2 className="text-3xl sm:text-4xl font-extrabold text-gray-950 tracking-tight mb-2">
                {t('faq.title')}
              </h2>
              <p className="text-sm text-gray-600">
                {t('faq.subtitle')}
              </p>
            </div>

            <div className="space-y-3">
              {(Array.isArray(faqItems) ? faqItems : []).map((faq, index) => {
                const isOpen = openFaq === index
                return (
                  <div
                    key={index}
                    className="bg-white border border-gray-200 rounded-xl overflow-hidden transition-colors"
                  >
                    <button
                      type="button"
                      onClick={() => setOpenFaq(isOpen ? -1 : index)}
                      className="w-full p-4 sm:p-5 text-left flex items-center justify-between gap-4 cursor-pointer hover:bg-gray-50/50"
                    >
                      <span className="text-xs sm:text-sm font-bold text-gray-900">
                        {faq.q}
                      </span>
                      {isOpen ? (
                        <ChevronUp className="w-4 h-4 text-[#00bf63] flex-shrink-0" />
                      ) : (
                        <ChevronDown className="w-4 h-4 text-gray-400 flex-shrink-0" />
                      )}
                    </button>
                    {isOpen && (
                      <div className="px-4 pb-4 sm:px-5 sm:pb-5 text-xs text-gray-600 leading-relaxed border-t border-gray-100 pt-3 animate-in fade-in duration-200">
                        {faq.a}
                      </div>
                    )}
                  </div>
                )
              })}
            </div>
          </div>
        </div>
      </section>

      {/* Partner CTA Section */}
      <section className="py-20 sm:py-24 bg-gray-950 text-white relative overflow-hidden">
        <div className="absolute top-0 right-0 w-96 h-96 bg-[#00bf63]/10 rounded-full blur-3xl pointer-events-none" />
        <div className="container mx-auto px-4 sm:px-6 lg:px-8 relative z-10 text-center max-w-3xl">
          <span className="inline-block bg-[#00bf63]/15 text-[#00bf63] text-xs font-bold px-3.5 py-1 rounded-full mb-4 border border-[#00bf63]/30">
            {t('partner.tag')}
          </span>
          <h2 className="text-3xl sm:text-4xl font-extrabold mb-4 tracking-tight leading-tight">
            {t('partner.title')}
          </h2>
          <p className="text-sm text-gray-400 mb-8 max-w-xl mx-auto leading-relaxed">
            {t('partner.subtitle')}
          </p>

          <div className="flex flex-wrap items-center justify-center gap-4 sm:gap-6 text-xs text-gray-300 mb-8">
            <span className="flex items-center gap-1.5">
              <CheckCircle className="w-4 h-4 text-[#00bf63]" /> {t('partner.benefit1')}
            </span>
            <span className="flex items-center gap-1.5">
              <CheckCircle className="w-4 h-4 text-[#00bf63]" /> {t('partner.benefit2')}
            </span>
            <span className="flex items-center gap-1.5">
              <CheckCircle className="w-4 h-4 text-[#00bf63]" /> {t('partner.benefit3')}
            </span>
          </div>

          <Link href="/partner">
            <Button size="lg" className="bg-[#00bf63] hover:bg-[#00a656] text-slate-950 font-bold text-sm px-8 py-4 rounded-xl shadow-none">
              {t('partner.ctaBtn')} →
            </Button>
          </Link>
        </div>
      </section>

      {/* Footer */}
      <Footer />

      {/* Mobile Sticky CTA Bar */}
      <div className="md:hidden fixed bottom-0 left-0 right-0 bg-white/95 backdrop-blur-md border-t border-gray-200 p-2.5 z-50 flex gap-2">
        <Link href="/print" className="flex-1">
          <Button className="w-full bg-[#00bf63] hover:bg-[#00a656] text-white text-xs py-2.5 font-bold shadow-none rounded-xl flex items-center justify-center gap-1.5">
            <Printer className="h-4 w-4" />
            <span>{t('hero.ctaPrint')}</span>
          </Button>
        </Link>
        <Link href="/find-printer">
          <Button variant="outline" className="border-gray-300 rounded-xl px-3 py-2.5 shadow-none text-gray-700">
            <MapPin className="h-4 w-4 text-[#00bf63]" />
          </Button>
        </Link>
      </div>
    </div>
  )
}
