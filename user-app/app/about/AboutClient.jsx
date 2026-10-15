'use client'

import React from 'react'
import Link from 'next/link'
import {
  Printer,
  ShieldCheck,
  Zap,
  Building2,
  FileText,
  Phone,
  Mail,
  MapPin,
  Clock,
  Award,
  Users,
  CheckCircle2,
  ArrowRight,
  ExternalLink,
  ShieldAlert,
  Coins
} from 'lucide-react'
import { useLanguage } from '@/context/LanguageContext'
import { Button } from '@/components/ui/button'
import { Badge } from '@/components/ui/badge'
import { COMPANY_INFO } from '@/lib/company-info'

export default function AboutClient() {
  const { lang, toBengaliNumber } = useLanguage()
  const isBn = lang === 'bn'

  return (
    <div className="min-h-screen bg-gray-50/50">
      {/* Hero Section */}
      <section className="bg-gray-950 text-white pt-28 pb-16 border-b border-gray-900 relative overflow-hidden">
        <div className="absolute inset-0 bg-[radial-gradient(circle_at_top_right,rgba(0,191,99,0.12),transparent_50%)]" />
        <div className="container mx-auto px-4 sm:px-6 lg:px-8 max-w-5xl relative z-10 text-center">
          <Badge className="mb-4 bg-[#00bf63]/15 text-[#00bf63] border border-[#00bf63]/30 font-semibold px-3 py-1">
            <Printer className="h-3.5 w-3.5 mr-1.5 inline" />
            {isBn ? 'আমাদের গল্প ও পরিচিতি' : 'Our Story & Company Profile'}
          </Badge>
          <h1 className="text-3xl sm:text-5xl font-black tracking-tight mb-4">
            {isBn ? (
              <>
                প্রিন্ট হবে সহজ, নিরাপদ ও <span className="text-[#00bf63]">৬০ সেকেন্ডে</span>
              </>
            ) : (
              <>
                Revolutionizing Printing Across Bangladesh in <span className="text-[#00bf63]">60 Seconds</span>
              </>
            )}
          </h1>
          <p className="text-sm sm:text-base text-gray-300 max-w-2xl mx-auto leading-relaxed">
            {isBn
              ? 'প্রিন্টকোরো (কুইকইংক টেকনোলজিস) হলো বাংলাদেশের প্রথম আধুনিক সেলফ-সার্ভিস ক্লাউড প্রিন্টিং নেটওয়ার্ক। পেনড্রাইভ বা দীর্ঘ লাইনের ঝামেলা ছাড়াই যেকোনো মোবাইল থেকে তাৎক্ষণিক নিরাপদ প্রিন্ট।'
              : 'PrintKoro (operated by QuickInk Technologies) is Bangladesh’s pioneering smart cloud printing network. Zero flash drives, zero privacy leaks, and zero queueing—just fast, secure printing right from your phone.'}
          </p>
        </div>
      </section>

      {/* Story of the Company */}
      <section className="py-14 sm:py-16">
        <div className="container mx-auto px-4 sm:px-6 lg:px-8 max-w-5xl">
          <div className="grid grid-cols-1 lg:grid-cols-12 gap-10 items-center">
            <div className="lg:col-span-7 space-y-4">
              <span className="text-xs font-bold uppercase tracking-wider text-[#00bf63]">
                {isBn ? 'কীভাবে শুরু হলো আমাদের যাত্রা' : 'How It All Began'}
              </span>
              <h2 className="text-2xl sm:text-3xl font-extrabold text-gray-900 tracking-tight">
                {isBn
                  ? 'নীলক্ষেতের দীর্ঘ লাইন ও পেনড্রাইভের ভাইরাসের সমাধান'
                  : 'Solving Campus Printing Frustrations with Modern Cloud Tech'}
              </h2>
              <div className="space-y-3.5 text-xs sm:text-sm text-gray-600 leading-relaxed">
                <p>
                  {isBn
                    ? 'বাংলাদেশের যেকোনো বিশ্ববিদ্যালয় ক্যাম্পাস, নিলক্ষেত বা বাজারের ফটোকপির দোকানে গেলে একটি দৃশ্য খুব সাধারণ: দোকানে ভিড়, পেনড্রাইভে শর্টকাট ভাইরাস আক্রান্ত হওয়া, ঘণ্টার পর ঘণ্টা অপেক্ষা এবং নিজের ব্যক্তিগত ফাইল অন্য কারও কম্পিউটারে উন্মুক্ত করে দেওয়ার অস্বস্তিকর অভিজ্ঞতা।'
                    : 'Every university campus and commercial hub in Bangladesh shares the same painful story: crowded photocopy shops, pendrives getting corrupted with computer shortcut viruses, lost academic deadlines, and exposing personal confidential documents on public cyber-cafe monitors.'}
                </p>
                <p>
                  {isBn
                    ? 'এই মৌলিক সমস্যার স্থায়ী সমাধানের লক্ষ্যেই জন্ম নেয় প্রিন্টকোরো (PrintKoro)। আমরা একটি ক্লাউড-ইন্টিগ্রেটেড সেলফ-সার্ভিস প্ল্যাটফর্ম তৈরি করেছি যা শিক্ষার্থীদের স্মার্টফোনকে একটি রিমোট প্রিন্ট কমান্ড সেন্টারে পরিণত করে। ব্যবহারকারী মাত্র কয়েকটি ক্লিকে নিজের ফাইল আপলোড করেন, বিকাশ বা নগদে নিরাপদে পেমেন্ট করেন এবং ৬ সংখ্যার ওটিপি কোড দিয়ে কিয়স্ক বা পার্টনার দোকান থেকে মাত্র ৬০ সেকেন্ডে প্রিন্ট সংগ্রহ করেন।'
                    : 'PrintKoro was built by QuickInk Technologies to fundamentally transform this dated ritual. By connecting modern high-speed laser printers with an ultra-secure cloud routing system, we turned any smartphone into a personal print manager. Users upload files in seconds, choose color/duplex settings, settle payments seamlessly in BDT, and release their copies in under a minute with a private 6-digit OTP ticket.'}
                </p>
                <p>
                  {isBn
                    ? 'আজ প্রিন্টকোরো শুধু শিক্ষার্থীদের নয়, শত শত স্থানীয় প্রিন্টশপ ও উদ্যোক্তাদের স্মার্ট পার্টনার টার্মিনাল সফটওয়্যারের মাধ্যমে স্বাবলম্বী করে আধুনিক ফিনটেক ও প্রিন্ট কমার্সে যুক্ত করছে।'
                    : 'Today, PrintKoro is not just empowering students—it is also modernizing traditional micro-printing entrepreneurs across Bangladesh with our zero-hardware-cost desktop station suite.'}
                </p>
              </div>
            </div>

            {/* Quick Metrics Card */}
            <div className="lg:col-span-5 bg-white border border-gray-200 rounded-2xl p-6 sm:p-7 shadow-xs">
              <h3 className="text-base font-bold text-gray-900 mb-5 flex items-center gap-2">
                <Award className="h-5 w-5 text-[#00bf63]" />
                {isBn ? 'প্রিন্টকোরো এক নজরে' : 'PrintKoro at a Glance'}
              </h3>
              <div className="grid grid-cols-2 gap-4">
                <div className="bg-gray-50 border border-gray-100 rounded-xl p-4 text-center">
                  <span className="block text-2xl sm:text-3xl font-black text-[#00bf63]">
                    {isBn ? '৬০ সেকেন্ড' : '60 Sec'}
                  </span>
                  <span className="text-[11px] text-gray-500 font-medium">
                    {isBn ? 'গড় প্রিন্ট স্পিড' : 'Average Turnaround'}
                  </span>
                </div>
                <div className="bg-gray-50 border border-gray-100 rounded-xl p-4 text-center">
                  <span className="block text-2xl sm:text-3xl font-black text-gray-900">
                    {isBn ? '১০০%' : '100%'}
                  </span>
                  <span className="text-[11px] text-gray-500 font-medium">
                    {isBn ? 'অটো মেমরি ওয়াইপ' : 'RAM Auto-Wipe'}
                  </span>
                </div>
                <div className="bg-gray-50 border border-gray-100 rounded-xl p-4 text-center">
                  <span className="block text-2xl sm:text-3xl font-black text-gray-900">
                    {isBn ? '০ পেনড্রাইভ' : 'Zero'}
                  </span>
                  <span className="text-[11px] text-gray-500 font-medium">
                    {isBn ? 'পেনড্রাইভ মুক্ত ব্যবস্থা' : 'Pendrives / Cables'}
                  </span>
                </div>
                <div className="bg-gray-50 border border-gray-100 rounded-xl p-4 text-center">
                  <span className="block text-2xl sm:text-3xl font-black text-[#00bf63]">
                    {isBn ? '৳ BDT' : 'BDT ৳'}
                  </span>
                  <span className="text-[11px] text-gray-500 font-medium">
                    {isBn ? 'স্বচ্ছ লোকাল রেট' : 'Transparent Pricing'}
                  </span>
                </div>
              </div>
              <div className="mt-5 pt-4 border-t border-gray-100 flex items-center justify-between text-xs text-gray-600">
                <span className="font-semibold">{isBn ? 'সার্ভিস এরিয়া:' : 'Coverage:'}</span>
                <span className="font-bold text-gray-900">{isBn ? 'ঢাকা, রাজশাহী ও সমগ্র বাংলাদেশ' : 'Dhaka, Rajshahi & Nationwide'}</span>
              </div>
            </div>
          </div>
        </div>
      </section>

      {/* Core Values & Pillars */}
      <section className="py-12 bg-white border-y border-gray-200">
        <div className="container mx-auto px-4 sm:px-6 lg:px-8 max-w-5xl">
          <div className="text-center max-w-2xl mx-auto mb-10">
            <span className="text-xs font-bold uppercase tracking-wider text-[#00bf63]">
              {isBn ? 'আমাদের মূল স্তম্ভ' : 'Our Guiding Principles'}
            </span>
            <h2 className="text-2xl sm:text-3xl font-extrabold text-gray-900 tracking-tight mt-1">
              {isBn ? 'কেন প্রিন্টকোরো শিক্ষার্থীদের বিশ্বস্ত?' : 'Built Around Privacy, Fair Pricing, and Speed'}
            </h2>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
            <div className="border border-gray-200 rounded-xl p-6 bg-gray-50/50 hover:bg-white transition-colors">
              <div className="w-10 h-10 rounded-lg bg-[#00bf63]/10 text-[#00bf63] flex items-center justify-center mb-4">
                <ShieldCheck className="h-5 w-5" />
              </div>
              <h3 className="text-base font-bold text-gray-900 mb-2">
                {isBn ? '১০০% ফাইল গোপনীয়তা' : 'Zero-Trace Confidentiality'}
              </h3>
              <p className="text-xs text-gray-600 leading-relaxed">
                {isBn
                  ? 'প্রিন্ট পেপার বের হওয়া মাত্রই আমাদের সার্ভার ও কিয়স্কের মেমরি থেকে ফাইল স্থায়ীভাবে স্বয়ংক্রিয়ভাবে মুছে ফেলা হয়। কোনো ফাইল কখনও থার্ড-পার্টির হাতে যায় না।'
                  : 'Files are processed in encrypted volatile memory and wiped irrevocably the instant paper ejects. No logs, no public monitor browsing, and zero data selling.'}
              </p>
            </div>

            <div className="border border-gray-200 rounded-xl p-6 bg-gray-50/50 hover:bg-white transition-colors">
              <div className="w-10 h-10 rounded-lg bg-[#00bf63]/10 text-[#00bf63] flex items-center justify-center mb-4">
                <Coins className="h-5 w-5" />
              </div>
              <h3 className="text-base font-bold text-gray-900 mb-2">
                {isBn ? 'স্বচ্ছ রেট ও মানিব্যাক গ্যারান্টি' : 'Affordable Pricing in BDT'}
              </h3>
              <p className="text-xs text-gray-600 leading-relaxed">
                {isBn
                  ? 'প্রতিটি পাতার মূল্য স্পষ্টভাবে বাংলাদেশি টাকায় (BDT) প্রদর্শিত হয়। পেপার জ্যাম বা প্রিন্টার ত্রুটিতে শতভাগ রিফান্ড বা তাৎক্ষণিক ফ্রি রিট্রাই পাওয়ার নিশ্চয়তা।'
                  : 'Transparent per-page pricing in Bangladeshi Taka (BDT). Safe-print rule guarantees 100% automatic refund or free retry if paper jams or ink depletes.'}
              </p>
            </div>

            <div className="border border-gray-200 rounded-xl p-6 bg-gray-50/50 hover:bg-white transition-colors">
              <div className="w-10 h-10 rounded-lg bg-[#00bf63]/10 text-[#00bf63] flex items-center justify-center mb-4">
                <Users className="h-5 w-5" />
              </div>
              <h3 className="text-base font-bold text-gray-900 mb-2">
                {isBn ? 'উদ্যোক্তা ক্ষমতায়ন' : 'Partner Empowerment'}
              </h3>
              <p className="text-xs text-gray-600 leading-relaxed">
                {isBn
                  ? 'আমাদের উইন্ডোজ ডেস্কটপ পিওএস এজেন্ট স্থানীয় ফটোকপি ও স্টেশনারি দোকানদারদের শূন্য খরচে স্মার্ট ক্লাউড প্রিন্ট স্টেশনে রূপান্তর করে তাদের আয় বাড়ায়।'
                  : 'We supply local print and stationery shop owners with intelligent desktop POS technology, unlocking new digital revenue without heavy upfront hardware costs.'}
              </p>
            </div>
          </div>
        </div>
      </section>

      {/* Official Business & Merchant Compliance Information Card */}
      <section className="py-14 sm:py-16">
        <div className="container mx-auto px-4 sm:px-6 lg:px-8 max-w-5xl">
          <div className="border-2 border-emerald-500/20 bg-gradient-to-br from-white via-emerald-50/20 to-white rounded-2xl p-6 sm:p-9 shadow-sm">
            <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 pb-6 border-b border-gray-200">
              <div>
                <span className="text-xs font-bold uppercase tracking-wider text-[#00bf63] flex items-center gap-1.5">
                  <Building2 className="h-4 w-4" />
                  {isBn ? 'সরকারি নিবন্ধন ও ব্যবসায়িক তথ্য' : 'Corporate Identity & Merchant Compliance'}
                </span>
                <h3 className="text-xl sm:text-2xl font-black text-gray-900 mt-1">
                  {COMPANY_INFO.legalEntityName} ({COMPANY_INFO.brandName})
                </h3>
              </div>
              <div className="flex items-center gap-2">
                <Badge className="bg-[#00bf63] text-white font-bold text-xs px-3 py-1 shadow-none">
                  {isBn ? '✓ সরকারি নিবন্ধিত' : '✓ Verified Enterprise'}
                </Badge>
              </div>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-2 gap-6 pt-6">
              {/* Left Column: Registration & Legal */}
              <div className="space-y-4">
                <div className="bg-white border border-gray-200 rounded-xl p-4">
                  <span className="text-[11px] font-semibold text-gray-500 uppercase tracking-wide block mb-1">
                    {isBn ? 'ট্রেড লাইসেন্স নম্বর (Trade License No)' : 'Trade License Number'}
                  </span>
                  <span className="text-sm sm:text-base font-mono font-extrabold text-gray-900 bg-gray-100 px-2.5 py-1 rounded inline-block border border-gray-300">
                    {COMPANY_INFO.tradeLicenseNo}
                  </span>
                  <p className="text-[11px] text-gray-500 mt-1.5">
                    {isBn
                      ? 'বাঘা পৌরসভা/সিটি কর্পোরেশন কর্তৃক অনুমোদিত বৈধ বাণিজ্যিক লাইসেন্স।'
                      : 'Officially registered commercial software & printing entity under municipal jurisdiction.'}
                  </p>
                </div>

                <div className="bg-white border border-gray-200 rounded-xl p-4">
                  <span className="text-[11px] font-semibold text-gray-500 uppercase tracking-wide block mb-1">
                    {isBn ? 'নিবন্ধিত মূল কার্যালয়ের ঠিকানা' : 'Registered Physical Office Address'}
                  </span>
                  <div className="flex items-start gap-2.5 text-xs sm:text-sm text-gray-800 font-medium">
                    <MapPin className="h-4 w-4 text-[#00bf63] mt-0.5 flex-shrink-0" />
                    <span>{isBn ? COMPANY_INFO.registeredOfficeBn : COMPANY_INFO.registeredOffice}</span>
                  </div>
                </div>

                <div className="bg-white border border-gray-200 rounded-xl p-4">
                  <span className="text-[11px] font-semibold text-gray-500 uppercase tracking-wide block mb-1">
                    {isBn ? 'অপারেশনাল ও কারিগরি হাব' : 'Operational & Tech Hub'}
                  </span>
                  <div className="flex items-start gap-2.5 text-xs sm:text-sm text-gray-800 font-medium">
                    <Building2 className="h-4 w-4 text-[#00bf63] mt-0.5 flex-shrink-0" />
                    <span>{isBn ? COMPANY_INFO.operationsHubBn : COMPANY_INFO.operationsHub}</span>
                  </div>
                </div>
              </div>

              {/* Right Column: Contact, Currency & Hours */}
              <div className="space-y-4">
                <div className="bg-white border border-gray-200 rounded-xl p-4">
                  <span className="text-[11px] font-semibold text-gray-500 uppercase tracking-wide block mb-1">
                    {isBn ? 'গ্রাহক সেবা ও যোগাযোগ নম্বর' : 'Helpline & Official Inquiries'}
                  </span>
                  <div className="space-y-2">
                    <div className="flex items-center gap-2.5 text-xs sm:text-sm text-gray-900 font-bold">
                      <Phone className="h-4 w-4 text-[#00bf63] flex-shrink-0" />
                      <a href={`tel:${COMPANY_INFO.helplineRaw}`} className="hover:underline">
                        {COMPANY_INFO.helpline}
                      </a>
                    </div>
                    <div className="flex items-center gap-2.5 text-xs sm:text-sm text-gray-800">
                      <Mail className="h-4 w-4 text-[#00bf63] flex-shrink-0" />
                      <a href={`mailto:${COMPANY_INFO.email}`} className="text-[#00bf63] font-semibold hover:underline">
                        {COMPANY_INFO.email}
                      </a>
                    </div>
                  </div>
                </div>

                <div className="bg-white border border-gray-200 rounded-xl p-4">
                  <span className="text-[11px] font-semibold text-gray-500 uppercase tracking-wide block mb-1">
                    {isBn ? 'লেনদেনের মুদ্রা (Billing Currency)' : 'Official Billing Currency'}
                  </span>
                  <div className="flex items-center gap-2 text-xs sm:text-sm font-bold text-gray-900">
                    <span className="text-base text-[#00bf63]">৳</span>
                    <span>Bangladeshi Taka (BDT)</span>
                  </div>
                  <p className="text-[11px] text-gray-500 mt-1">
                    {isBn
                      ? 'ওয়েবসাইটে প্রদর্শিত সকল সেবার মূল্য বাংলাদেশি টাকায় (BDT) নির্ধারিত এবং বাংলাদেশ ব্যাংকের নির্দেশিত পেমেন্ট গেটওয়ে দ্বারা প্রসেস করা হয়।'
                      : 'All product and service pricing across PrintKoro is denominated and settled strictly in BDT through authorized payment gateways.'}
                  </p>
                </div>

                <div className="bg-white border border-gray-200 rounded-xl p-4">
                  <span className="text-[11px] font-semibold text-gray-500 uppercase tracking-wide block mb-1">
                    {isBn ? 'অফিস সময়সূচী' : 'Operating Support Hours'}
                  </span>
                  <div className="flex items-start gap-2 text-xs text-gray-800">
                    <Clock className="h-4 w-4 text-[#00bf63] mt-0.5 flex-shrink-0" />
                    <span>{isBn ? COMPANY_INFO.operatingHoursBn : COMPANY_INFO.operatingHours}</span>
                  </div>
                </div>
              </div>
            </div>

            {/* Quick Policies Links */}
            <div className="mt-6 pt-5 border-t border-gray-200 flex flex-wrap items-center justify-between gap-3 text-xs text-gray-600">
              <span className="font-semibold text-gray-900">
                {isBn ? 'প্রয়োজনীয় আইনি নীতিমালাসমূহ:' : 'Essential Legal Policies:'}
              </span>
              <div className="flex flex-wrap gap-4 font-bold text-emerald-700">
                <Link href="/terms" className="hover:underline flex items-center gap-1">
                  {isBn ? 'শর্তাবলী' : 'Terms & Conditions'} <ExternalLink className="h-3 w-3" />
                </Link>
                <Link href="/refund" className="hover:underline flex items-center gap-1">
                  {isBn ? 'রিফান্ড ও রিটার্ন নীতি' : 'Return & Refund Policy'} <ExternalLink className="h-3 w-3" />
                </Link>
                <Link href="/privacy" className="hover:underline flex items-center gap-1">
                  {isBn ? 'গোপনীয়তা নীতি' : 'Privacy Policy'} <ExternalLink className="h-3 w-3" />
                </Link>
                <Link href="/delivery" className="hover:underline flex items-center gap-1">
                  {isBn ? 'ডেলিভারি নীতিমালা' : 'Delivery Policy'} <ExternalLink className="h-3 w-3" />
                </Link>
              </div>
            </div>
          </div>
        </div>
      </section>

      {/* CTA Section */}
      <section className="pb-16">
        <div className="container mx-auto px-4 sm:px-6 lg:px-8 max-w-4xl text-center">
          <div className="bg-gray-900 text-white rounded-2xl p-8 sm:p-10 border border-gray-800">
            <h3 className="text-xl sm:text-2xl font-bold mb-3">
              {isBn ? 'এখনই শুরু করুন স্মার্ট ও নিরাপদ প্রিন্টিং' : 'Ready to Experience Seamless Printing?'}
            </h3>
            <p className="text-xs sm:text-sm text-gray-300 max-w-xl mx-auto mb-6">
              {isBn
                ? 'পেনড্রাইভের ঝামেলা ভুলে যান। মোবাইল থেকে যেকোনো পিডিএফ আপলোড করুন এবং সবচেয়ে কাছের কিয়স্ক বা পার্টনার দোকান থেকে প্রিন্ট নিন।'
                : 'Upload your documents, skip the line, and pick up your sharp prints at any partner kiosk in under 60 seconds.'}
            </p>
            <div className="flex flex-wrap justify-center gap-3">
              <Link href="/print">
                <Button className="bg-[#00bf63] hover:bg-[#00a656] text-white font-bold px-6 py-2.5 rounded-xl text-sm shadow-none">
                  {isBn ? 'প্রিন্ট শুরু করুন →' : 'Print Your Document →'}
                </Button>
              </Link>
              <Link href="/contact">
                <Button variant="outline" className="bg-transparent border-gray-700 hover:bg-gray-800 text-white font-semibold px-6 py-2.5 rounded-xl text-sm shadow-none">
                  {isBn ? 'যোগাযোগ করুন' : 'Contact Support'}
                </Button>
              </Link>
            </div>
          </div>
        </div>
      </section>
    </div>
  )
}
