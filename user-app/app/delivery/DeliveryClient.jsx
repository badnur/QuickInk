'use client'

import React from 'react'
import Link from 'next/link'
import {
  Truck,
  Zap,
  Clock,
  Printer,
  ShieldCheck,
  CheckCircle2,
  Package,
  MapPin,
  Phone,
  Mail,
  Building2,
  ExternalLink,
  Coins
} from 'lucide-react'
import { useLanguage } from '@/context/LanguageContext'
import { Badge } from '@/components/ui/badge'
import { Card, CardContent } from '@/components/ui/card'
import { COMPANY_INFO } from '@/lib/company-info'

export default function DeliveryClient() {
  const { lang, toBengaliNumber } = useLanguage()
  const isBn = lang === 'bn'

  return (
    <div className="min-h-screen bg-gray-50/50">
      {/* Header */}
      <section className="bg-gray-950 text-white pt-28 pb-16 border-b border-gray-900 relative overflow-hidden">
        <div className="absolute inset-0 bg-[radial-gradient(circle_at_top_right,rgba(0,191,99,0.12),transparent_50%)]" />
        <div className="container mx-auto px-4 sm:px-6 lg:px-8 max-w-4xl relative z-10 text-center">
          <Badge className="mb-4 bg-[#00bf63]/15 text-[#00bf63] border border-[#00bf63]/30 font-semibold px-3 py-1">
            <Zap className="h-3.5 w-3.5 mr-1.5 inline" />
            {isBn ? 'তাৎক্ষণিক ডেলিভারি ও হ্যান্ডওভার' : 'Instant Cloud & Physical Fulfillment'}
          </Badge>
          <h1 className="text-3xl sm:text-4xl font-extrabold tracking-tight mb-3">
            {isBn ? 'ডেলিভারি ও ফুলফিলমেন্ট নীতিমালা' : 'Delivery & Fulfillment Policy'}
          </h1>
          <p className="text-xs sm:text-sm text-gray-300 max-w-2xl mx-auto leading-relaxed">
            {isBn
              ? 'প্রিন্টকোরো ক্লাউড টেকনোলজির মাধ্যমে আপনার ডিজিটাল ডকুমেন্ট মাত্র ৬০ সেকেন্ডে নিকটস্থ কিয়স্ক বা পার্টনার সেন্টারে প্রিন্টের জন্য প্রস্তুত করে তোলে।'
              : 'PrintKoro leverages distributed cloud architecture to fulfill your physical print orders instantaneously across all partner kiosks and service hubs in Bangladesh.'}
          </p>
          <div className="mt-4 text-[11px] text-gray-400">
            {isBn ? 'সর্বশেষ পরিমার্জন: ১ অক্টোবর, ২০২৬ • কার্যকর তারিখ: ১ জানুয়ারি, ২০২৬' : 'Last Updated: October 1, 2026 • Effective Date: January 1, 2026'}
          </div>
        </div>
      </section>

      {/* Main Content */}
      <div className="container mx-auto px-4 sm:px-6 lg:px-8 max-w-4xl py-12">
        <div className="space-y-8">
          {/* Key Metric Banner */}
          <div className="bg-emerald-50 border-2 border-emerald-500/30 rounded-2xl p-5 sm:p-6 flex flex-col sm:flex-row items-start gap-4">
            <div className="w-12 h-12 rounded-xl bg-[#00bf63] text-white flex items-center justify-center shrink-0">
              <Clock className="h-6 w-6" />
            </div>
            <div>
              <h3 className="text-base sm:text-lg font-bold text-gray-900 mb-1">
                {isBn ? '৬০ সেকেন্ড তাৎক্ষণিক ডিজিটাল ডেলিভারি (Instant Turnaround)' : '60-Second Instant Cloud Fulfillment'}
              </h3>
              <p className="text-xs sm:text-sm text-gray-700 leading-relaxed">
                {isBn
                  ? 'আপনার অর্ডার সাবমিট ও পেমেন্ট সম্পন্ন হওয়া মাত্রই স্বয়ংক্রিয় ক্লাউড প্রসেসিং সম্পন্ন হয় এবং গোপন ৬-সংখ্যার ওটিপি কোড তৈরি হয়। এই কোড দিয়ে আপনি যেকোনো সক্রিয় কিয়স্ক বা পার্টনার স্টেশন থেকে সঙ্গে সঙ্গে প্রিন্ট সংগ্রহ করতে পারবেন।'
                  : 'The moment your print job is confirmed, our cloud spools the file in under 60 seconds and issues a secure 6-digit OTP ticket. Physical pages begin dispensing within 5 to 30 seconds upon entering your OTP at any kiosk.'}
              </p>
            </div>
          </div>

          {/* Section 1: Service Modality */}
          <Card className="bg-white border border-gray-200 rounded-2xl shadow-none p-6">
            <h2 className="text-lg font-bold text-gray-900 mb-4 flex items-center gap-2">
              <span className="w-6 h-6 rounded-full bg-[#00bf63]/10 text-[#00bf63] text-xs font-black flex items-center justify-center">
                ০১
              </span>
              {isBn ? 'ডেলিভারির প্রকৃতি ও কার্যপদ্ধতি (Service Nature & Mechanics)' : '1. Nature of Delivery & Mechanics'}
            </h2>
            <div className="space-y-3.5 text-xs sm:text-sm text-gray-600 leading-relaxed">
              <p>
                {isBn
                  ? 'প্রিন্টকোরো প্রধানত একটি অন-ডিমান্ড ডিজিটাল ক্লাউড প্রিন্টিং ও সেলফ-সার্ভিস কিয়স্ক নেটওয়ার্ক। আমাদের সেবায় কোনো বিলম্বিত ডাকযোগে পণ্য প্রেরণের প্রয়োজন হয় না, বরং গ্রাহক নিজে তার সুবিধাজনক সময়ে কিয়স্ক বা পার্টনার শপ থেকে তাত্ক্ষণিকভাবে প্রিন্ট করা কাগজ সংগ্রহ করেন:'
                  : 'PrintKoro primarily operates as an on-demand self-service cloud network. Delivery occurs directly at our physical smart kiosks and partner terminals upon customer verification:'}
              </p>
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 pt-2">
                <div className="bg-gray-50 border border-gray-200 rounded-xl p-4">
                  <strong className="text-gray-900 text-xs block mb-1">
                    {isBn ? 'কিয়স্ক সেলফ-পিকআপ (Self-Pickup)' : 'Kiosk Self-Pickup (Instant)'}
                  </strong>
                  <p className="text-xs text-gray-600">
                    {isBn
                      ? 'যেকোনো প্রিন্টকোরো টাচস্ক্রিন কিয়স্কে গিয়ে স্ক্রিনে ৬-সংখ্যার ওটিপি দিন অথবা কিউআর স্ক্যান করুন। ৫ থেকে ৩০ সেকেন্ডে ফ্রেশ কাগজ প্রিন্ট হয়ে ট্রে-তে চলে আসবে।'
                      : 'Input your 6-digit OTP or scan the QR at any touch kiosk. Sheets eject instantly from the output tray.'}
                  </p>
                  <span className="inline-block mt-2 font-bold text-xs text-[#00bf63]">
                    {isBn ? 'ডেলিভারি ফি: ৳০ (সম্পূর্ণ ফ্রি)' : 'Collection Fee: ৳0 BDT (Free)'}
                  </span>
                </div>

                <div className="bg-gray-50 border border-gray-200 rounded-xl p-4">
                  <strong className="text-gray-900 text-xs block mb-1">
                    {isBn ? 'পার্টনার শপ কাউন্টার (Partner Station)' : 'Partner Shop Counter (Assisted)'}
                  </strong>
                  <p className="text-xs text-gray-600">
                    {isBn
                      ? 'পার্টনার ফটোকপি বা স্টেশনারি দোকানে গিয়ে দোকানদারকে ওটিপি কোড বলুন। দোকানদারের ডেস্কটপ সফটওয়্যার তাৎক্ষণিক কাগজ প্রিন্ট করে আপনার হাতে বুঝিয়ে দেবে।'
                      : 'Show your OTP code to any verified partner shop operator. The desktop agent automatically spools and hands over your fresh printouts.'}
                  </p>
                  <span className="inline-block mt-2 font-bold text-xs text-[#00bf63]">
                    {isBn ? 'ডেলিভারি ফি: ৳০ (সম্পূর্ণ ফ্রি)' : 'Collection Fee: ৳0 BDT (Free)'}
                  </span>
                </div>
              </div>
            </div>
          </Card>

          {/* Section 2: Timeline & Validity */}
          <Card className="bg-white border border-gray-200 rounded-2xl shadow-none p-6">
            <h2 className="text-lg font-bold text-gray-900 mb-4 flex items-center gap-2">
              <span className="w-6 h-6 rounded-full bg-[#00bf63]/10 text-[#00bf63] text-xs font-black flex items-center justify-center">
                ০২
              </span>
              {isBn ? 'ওটিপি মেয়াদ ও ডকুমেন্ট সংরক্ষণ নীতি (OTP Ticket Validity & Storage)' : '2. OTP Ticket Validity & Storage Life'}
            </h2>
            <div className="space-y-3 text-xs sm:text-sm text-gray-600 leading-relaxed">
              <ul className="space-y-2.5 list-disc pl-5">
                <li>
                  <strong className="text-gray-900">{isBn ? '৪৮ ঘণ্টা ওটিপি লাইফটাইম:' : '48-Hour Active Ticket Window:'}</strong>{' '}
                  {isBn
                    ? 'আপনার জেনারেট করা ওটিপি কোডটি ইস্যু হওয়ার সময় থেকে পরবর্তী ৪৮ ঘণ্টার জন্য সক্রিয় থাকে। এই সময়ের মধ্যে যেকোনো কিয়স্ক বা পার্টনার শপ থেকে এটি প্রিন্ট নেওয়া যাবে।'
                    : 'Your generated 6-digit OTP ticket remains redeemable for 48 hours from the exact moment of issuance.'}
                </li>
                <li>
                  <strong className="text-gray-900">{isBn ? 'নিরাপত্তা ও অটো মেমরি ওয়াইপ:' : 'Security & Memory Auto-Wipe:'}</strong>{' '}
                  {isBn
                    ? 'প্রিন্ট পেপার বের হওয়ার সঙ্গে সঙ্গে ফাইলটি মুছে ফেলা হয়। যদি ৪৮ ঘণ্টার মধ্যে ওটিপি ব্যবহার না করা হয়, তবে ব্যবহারকারীর তথ্যের সর্বোচ্চ গোপনীয়তার স্বার্থে ফাইলটি ক্লাউড ক্যাশ থেকে স্থায়ীভাবে ডিলিট করা হয়।'
                    : 'Once printed, documents are purged immediately from volatile RAM. Unclaimed files are permanently purged at 48 hours for data security.'}
                </li>
              </ul>
            </div>
          </Card>

          {/* Section 3: Bulk Courier Doorstep Delivery */}
          <Card className="bg-white border border-gray-200 rounded-2xl shadow-none p-6">
            <h2 className="text-lg font-bold text-gray-900 mb-4 flex items-center gap-2">
              <span className="w-6 h-6 rounded-full bg-[#00bf63]/10 text-[#00bf63] text-xs font-black flex items-center justify-center">
                ০৩
              </span>
              {isBn ? 'হোম/অফিস কুরিয়ার ডেলিভারি নীতি (Doorstep Courier Delivery for Bulk Orders)' : '3. Bulk Printing Courier Delivery Terms'}
            </h2>
            <div className="space-y-3.5 text-xs sm:text-sm text-gray-600 leading-relaxed">
              <p>
                {isBn
                  ? 'থিওরি বা থিসিস পেপার, কর্পোরেট বুকলেট বা বাল্ক ভলিউম (৫০০+ পাতা) প্রিন্টের ক্ষেত্রে যারা হোম/অফিস ডেলিভারি চান, তাদের জন্য বিশেষ কুরিয়ার ডেলিভারি সার্ভিস উপলব্ধ রয়েছে:'
                  : 'For thesis papers, corporate brochures, or bulk university orders (500+ sheets) requesting doorstep delivery, the following courier timelines apply:'}
              </p>
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 pt-1">
                <div className="bg-gray-50 border border-gray-200 rounded-xl p-3.5">
                  <span className="text-xs font-bold text-gray-900 block mb-1">
                    {isBn ? 'ঢাকা ও রাজশাহী মহানগরী' : 'Inside Dhaka & Rajshahi City'}
                  </span>
                  <span className="text-xs text-gray-600 block">
                    {isBn ? 'ডেলিভারি সময়: ২৪ থেকে ৪৮ ঘণ্টা' : 'Delivery Window: 24 to 48 hours'}
                  </span>
                  <span className="text-[11px] text-gray-500 font-semibold block mt-1">
                    {isBn ? 'কুরিয়ার চার্জ: ৳৬০ - ৳১০০ BDT (ওজন অনুযায়ী)' : 'Standard Courier Fee: ৳60 - ৳100 BDT'}
                  </span>
                </div>

                <div className="bg-gray-50 border border-gray-200 rounded-xl p-3.5">
                  <span className="text-xs font-bold text-gray-900 block mb-1">
                    {isBn ? 'সারাদেশে (সমগ্র বাংলাদেশ)' : 'Nationwide (Outside Metro)'}
                  </span>
                  <span className="text-xs text-gray-600 block">
                    {isBn ? 'ডেলিভারি সময়: ৪৮ থেকে ৭২ ঘণ্টা' : 'Delivery Window: 48 to 72 hours'}
                  </span>
                  <span className="text-[11px] text-gray-500 font-semibold block mt-1">
                    {isBn ? 'কুরিয়ার চার্জ: ৳১০০ - ৳১৫০ BDT (ওজন অনুযায়ী)' : 'Nationwide Courier Fee: ৳100 - ৳150 BDT'}
                  </span>
                </div>
              </div>
              <p className="text-[11px] text-gray-500">
                {isBn
                  ? '* কুরিয়ার পার্টনার হিসেবে সুন্দরবন কুরিয়ার, এসএ পরিবহন, স্টিডফাস্ট ও পাঠাও লজিস্টিকস ব্যবহৃত হয়। প্রতিটি কুরিয়ার পার্সেলের ট্র্যাকিং কোড এসএমএস এর মাধ্যমে গ্রাহককে জানানো হয়।'
                  : '* Courier consignments are shipped via verified courier services (Sundarban, Steadfast, Pathao Logistics) with real-time SMS tracking numbers.'}
              </p>
            </div>
          </Card>

          {/* Section 4: Inspection & Quality Handover */}
          <Card className="bg-white border border-gray-200 rounded-2xl shadow-none p-6">
            <h2 className="text-lg font-bold text-gray-900 mb-4 flex items-center gap-2">
              <span className="w-6 h-6 rounded-full bg-[#00bf63]/10 text-[#00bf63] text-xs font-black flex items-center justify-center">
                ০৪
              </span>
              {isBn ? 'কাগজ বুঝে নেওয়া ও ইন্সপেকশন (Inspection upon Handover)' : '4. Quality Inspection Upon Handover'}
            </h2>
            <div className="space-y-3 text-xs sm:text-sm text-gray-600 leading-relaxed">
              <p>
                {isBn
                  ? 'কিয়স্ক থেকে কাগজ বের হওয়ার পর বা পার্টনার দোকানদার থেকে প্রিন্ট সংগ্রহের সময় অনুগ্রহ করে পাতার সংখ্যা ও মান যাচাই করে নিন। কোনো কারিগরি ত্রুটি ধরা পড়লে সঙ্গে সঙ্গে আমাদের হটলাইনে কল দিন বা হোয়াটসঅ্যাপে জানান; আমাদের টিম অবিলম্বে সমাধান বা রিফান্ড প্রদান করবে।'
                  : 'Customers are advised to inspect their sheets directly upon pickup. In the rare event of mechanical smudging or feeder tear, notify our live support desk for an immediate reprint token or 100% refund.'}
              </p>
            </div>
          </Card>

          {/* Section 5: Corporate Entity details */}
          <div className="border border-gray-200 bg-white rounded-2xl p-6 text-xs text-gray-600 space-y-2">
            <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2 border-b border-gray-100 pb-3">
              <strong className="text-sm text-gray-900">
                {COMPANY_INFO.legalEntityName} ({COMPANY_INFO.brandName})
              </strong>
              <span className="font-mono bg-gray-100 px-2 py-0.5 rounded text-[11px] font-bold text-gray-800 border border-gray-200">
                Trade License No: {COMPANY_INFO.tradeLicenseNo}
              </span>
            </div>
            <p>
              <strong>{isBn ? 'নিবন্ধিত কার্যালয়:' : 'Registered Office:'}</strong>{' '}
              {isBn ? COMPANY_INFO.registeredOfficeBn : COMPANY_INFO.registeredOffice}
            </p>
            <p>
              <strong>{isBn ? 'জরুরি সহায়তা ও ডেলিভারি হেল্পলাইন:' : 'Delivery Support Helpline:'}</strong>{' '}
              {COMPANY_INFO.helpline} • {COMPANY_INFO.email}
            </p>
          </div>
        </div>
      </div>
    </div>
  )
}
