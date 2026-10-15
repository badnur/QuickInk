'use client'

import React from 'react'
import Link from 'next/link'
import {
  RotateCcw,
  ShieldCheck,
  CheckCircle2,
  AlertTriangle,
  Clock,
  Phone,
  Mail,
  Building2,
  CreditCard,
  Banknote,
  FileText,
  HelpCircle,
  ArrowRight
} from 'lucide-react'
import { useLanguage } from '@/context/LanguageContext'
import { Badge } from '@/components/ui/badge'
import { Card, CardContent } from '@/components/ui/card'
import { COMPANY_INFO } from '@/lib/company-info'

export default function RefundClient() {
  const { lang, toBengaliNumber } = useLanguage()
  const isBn = lang === 'bn'

  return (
    <div className="min-h-screen bg-gray-50/50">
      {/* Header */}
      <section className="bg-gray-950 text-white pt-28 pb-16 border-b border-gray-900 relative overflow-hidden">
        <div className="absolute inset-0 bg-[radial-gradient(circle_at_top_right,rgba(0,191,99,0.12),transparent_50%)]" />
        <div className="container mx-auto px-4 sm:px-6 lg:px-8 max-w-4xl relative z-10 text-center">
          <Badge className="mb-4 bg-[#00bf63]/15 text-[#00bf63] border border-[#00bf63]/30 font-semibold px-3 py-1">
            <RotateCcw className="h-3.5 w-3.5 mr-1.5 inline" />
            {isBn ? 'গ্রাহক সুরক্ষা ও অর্থ ফেরত নীতি' : 'Safe-Print Consumer Protection'}
          </Badge>
          <h1 className="text-3xl sm:text-4xl font-extrabold tracking-tight mb-3">
            {isBn ? 'রিফান্ড ও রিটার্ন নীতিমালা' : 'Return & Refund Policy'}
          </h1>
          <p className="text-xs sm:text-sm text-gray-300 max-w-2xl mx-auto leading-relaxed">
            {isBn
              ? 'প্রিন্টকোরো গ্রাহকদের শতভাগ সন্তুষ্টি নিশ্চিত করতে প্রতিশ্রুতিবদ্ধ। প্রিন্টারে কোনো ত্রুটি দেখা দিলে বা অসন্তুষ্ট হলে দ্রুত ও স্বচ্ছ রিফান্ড নীতি মেনে চলা হয়।'
              : 'PrintKoro is committed to 100% fair and transparent transactions. If a machine error or print jam occurs, your money is safely refunded without hassle.'}
          </p>
          <div className="mt-4 text-[11px] text-gray-400">
            {isBn ? 'সর্বশেষ পরিমার্জন: ১ অক্টোবর, ২০২৬ • কার্যকর তারিখ: ১ জানুয়ারি, ২০২৬' : 'Last Updated: October 1, 2026 • Effective Date: January 1, 2026'}
          </div>
        </div>
      </section>

      {/* Main Content */}
      <div className="container mx-auto px-4 sm:px-6 lg:px-8 max-w-4xl py-12">
        <div className="space-y-8">
          {/* Key Guarantee Banner */}
          <div className="bg-emerald-50 border-2 border-emerald-500/30 rounded-2xl p-5 sm:p-6 flex flex-col sm:flex-row items-start gap-4">
            <div className="w-12 h-12 rounded-xl bg-[#00bf63] text-white flex items-center justify-center shrink-0">
              <ShieldCheck className="h-6 w-6" />
            </div>
            <div>
              <h3 className="text-base sm:text-lg font-bold text-gray-900 mb-1">
                {isBn ? '১০০% সেইফ-প্রিন্ট মানিব্যাক গ্যারান্টি (Safe-Print Zero-Risk Guarantee)' : '100% Safe-Print Zero-Risk Guarantee'}
              </h3>
              <p className="text-xs sm:text-sm text-gray-700 leading-relaxed">
                {isBn
                  ? 'প্রিন্টকোরোর প্ল্যাটফর্ম পলিসি অনুযায়ী: যদি আপনার ডকুমেন্ট প্রিন্টার থেকে শতভাগ সফলভাবে ও নিখুঁতভাবে প্রিন্ট হয়ে বের না হয়, তবে আপনার অ্যাকাউন্ট থেকে এক পয়সাও কাটা হবে না। যে কোনো যান্ত্রিক ব্যর্থতায় তাৎক্ষণিক রিফান্ড বা পুনরায় প্রিন্ট নেওয়ার অধিকার সংরক্ষিত।'
                  : 'Under our Safe-Print Protocol: If physical paper does not cleanly and successfully eject from the kiosk printer, zero money is retained. You receive an automatic refund or a free instant reprint retry.'}
              </p>
            </div>
          </div>

          {/* Section 1: Eligibility */}
          <Card className="bg-white border border-gray-200 rounded-2xl shadow-none p-6">
            <h2 className="text-lg font-bold text-gray-900 mb-4 flex items-center gap-2">
              <span className="w-6 h-6 rounded-full bg-[#00bf63]/10 text-[#00bf63] text-xs font-black flex items-center justify-center">
                ০১
              </span>
              {isBn ? 'কোন কোন ক্ষেত্রে রিফান্ড প্রযোজ্য (Eligibility for Refund)' : '1. Refund Eligibility Scenarios'}
            </h2>
            <div className="space-y-3 text-xs sm:text-sm text-gray-600 leading-relaxed">
              <p>{isBn ? 'গ্রাহক নিম্নলিখিত যে কোনো পরিস্থিতিতে শতভাগ রিফান্ডের জন্য যোগ্য বিবেচিত হবেন:' : 'You are entitled to a full 100% refund under any of the following occurrences:'}</p>
              <ul className="space-y-2.5 list-disc pl-5">
                <li>
                  <strong className="text-gray-900">{isBn ? 'পেপার জ্যাম বা পেপার সংকট:' : 'Paper Jam or Empty Tray:'}</strong>{' '}
                  {isBn
                    ? 'কিয়স্ক বা পার্টনার প্রিন্টারে কাগজ আটকে গেলে অথবা ট্রে-তে কাগজ শেষ হয়ে যাওয়ার কারণে সম্পূর্ণ প্রিন্ট না হলে।'
                    : 'The hardware printer experiences a mechanical paper jam or runs out of blank paper before finishing your job.'}
                </li>
                <li>
                  <strong className="text-gray-900">{isBn ? 'কালি/টোনার শেষ হওয়া বা অস্পষ্ট প্রিন্ট:' : 'Depleted Toner or Illegible Smudging:'}</strong>{' '}
                  {isBn
                    ? 'প্রিন্টারের টোনার সংকটের কারণে প্রিন্ট অস্পষ্ট, ফ্যাকাশে বা অপাঠ্য হলে।'
                    : 'The printer produces severely faint, streaked, or illegible output due to low toner or drum hardware defects.'}
                </li>
                <li>
                  <strong className="text-gray-900">{isBn ? 'বিদ্যুৎ বিভ্রাট বা সিস্টেম ক্র্যাশ:' : 'Power Outage or Hardware Offline:'}</strong>{' '}
                  {isBn
                    ? 'প্রিন্ট চলাকালীন আকস্মিক বিদ্যুৎ চলে গেলে বা কিয়স্ক সফটওয়্যার ইন্টারনেট সংযোগ বিচ্ছিন্ন হয়ে পড়লে।'
                    : 'Unscheduled electricity grid failure or kiosk terminal crash interrupting an active print transaction.'}
                </li>
                <li>
                  <strong className="text-gray-900">{isBn ? 'ডকুমেন্ট মুক্তির পূর্বে বাতিলকরণ:' : 'Cancellation Prior to Print Release:'}</strong>{' '}
                  {isBn
                    ? 'ওটিপি কোড ব্যবহার করে প্রিন্টারে ডকুমেন্ট প্রিন্ট শুরু করার পূর্বে আপনি চাইলে অর্ডারটি বাতিল করতে পারবেন এবং সম্পূর্ণ মূল্য ফেরত পাবেন।'
                    : 'If you choose to cancel your queued print order before dispensing pages at the physical kiosk using your OTP code.'}
                </li>
              </ul>
            </div>
          </Card>

          {/* Section 2: Non-refundable cases */}
          <Card className="bg-white border border-gray-200 rounded-2xl shadow-none p-6">
            <h2 className="text-lg font-bold text-gray-900 mb-4 flex items-center gap-2">
              <span className="w-6 h-6 rounded-full bg-amber-500/10 text-amber-600 text-xs font-black flex items-center justify-center">
                ০২
              </span>
              {isBn ? 'যেসব ক্ষেত্রে রিফান্ড প্রযোজ্য নয় (Non-Refundable Scenarios)' : '2. Non-Refundable Scenarios'}
            </h2>
            <div className="space-y-3 text-xs sm:text-sm text-gray-600 leading-relaxed">
              <p>{isBn ? 'যেহেতু প্রিন্ট সার্ভিস অন-ডিমান্ড কাস্টম সেবা, তাই নিচের ক্ষেত্রে রিফান্ড দেওয়া সম্ভব নয়:' : 'Since on-demand printing permanently consumes paper and toner supplies, refunds cannot be granted under:'}</p>
              <ul className="space-y-2.5 list-disc pl-5">
                <li>
                  <strong className="text-gray-900">{isBn ? 'গ্রাহকের ফাইল আপলোড ভুল:' : 'Customer Document Content Error:'}</strong>{' '}
                  {isBn
                    ? 'গ্রাহক নিজে ভুল ফাইল আপলোড করলে বা নিজের ফাইলে বানান ভুল, লো-রেজোলিউশন ব্লারি ছবি থাকলে এবং প্রিন্ট সফলভাবে সম্পন্ন হলে।'
                    : 'Typos, low-resolution source images, or wrong document uploaded by the user when the printer output faithfully mirrors the user file.'}
                </li>
                <li>
                  <strong className="text-gray-900">{isBn ? 'ভুল সেটিংস নির্বাচন:' : 'User Configuration Mistake:'}</strong>{' '}
                  {isBn
                    ? 'গ্রাহক নিজে কালারের জায়গায় ব্ল্যাক অ্যান্ড হোয়াইট বা সিঙ্গেল সাইডের জায়গায় ডুপ্লেক্স ভুলভাবে সিলেক্ট করে প্রিন্ট নেওয়ার পর।'
                    : 'Selecting monochrome instead of color, or single-sided instead of duplex, when the machine printed strictly according to the user selection.'}
                </li>
                <li>
                  <strong className="text-gray-900">{isBn ? '৪৮ ঘণ্টা ওটিপি মেয়াদোত্তীর্ণ হওয়া:' : 'Expired OTP Without Collection:'}</strong>{' '}
                  {isBn
                    ? 'ওটিপি কোড তৈরি করার ৪৮ ঘণ্টার মধ্যে কিয়স্কে না গেলে ফাইলটি নিরাপত্তার স্বার্থে অটো-ডিলিট হয়ে যায়। তবে ব্যবহারকারী সাপোর্ট ডেস্কে যোগাযোগ করে নতুন টোকেন নিতে পারেন।'
                    : 'Failing to visit any kiosk within 48 hours results in automated RAM purge. Contact support to request a credit reinstatement.'}
                </li>
              </ul>
            </div>
          </Card>

          {/* Section 3: Timeline & Method */}
          <Card className="bg-white border border-gray-200 rounded-2xl shadow-none p-6">
            <h2 className="text-lg font-bold text-gray-900 mb-4 flex items-center gap-2">
              <span className="w-6 h-6 rounded-full bg-[#00bf63]/10 text-[#00bf63] text-xs font-black flex items-center justify-center">
                ০৩
              </span>
              {isBn ? 'রিফান্ড প্রক্রিয়াকরণের সময় ও পদ্ধতি (Refund Timelines & Channels)' : '3. Refund Timelines & Disbursement Channels'}
            </h2>
            <div className="space-y-4 text-xs sm:text-sm text-gray-600 leading-relaxed">
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                <div className="bg-gray-50 border border-gray-200 rounded-xl p-4">
                  <div className="flex items-center gap-2 font-bold text-gray-900 text-xs mb-1">
                    <Banknote className="h-4 w-4 text-[#00bf63]" />
                    {isBn ? 'মোবাইল ব্যাংকিং (bKash / Nagad / Rocket)' : 'MFS (bKash / Nagad / Rocket)'}
                  </div>
                  <p className="text-xs text-gray-600">
                    {isBn
                      ? 'রিফান্ড অনুমোদনের ২৪ থেকে ৭২ কার্যঘণ্টার মধ্যে মূল মোবাইল ওয়ালেটে অর্থ ফেরত পাঠানো হয়।'
                      : 'Reversal sent back to originating wallet within 24 to 72 business hours.'}
                  </p>
                </div>

                <div className="bg-gray-50 border border-gray-200 rounded-xl p-4">
                  <div className="flex items-center gap-2 font-bold text-gray-900 text-xs mb-1">
                    <CreditCard className="h-4 w-4 text-[#00bf63]" />
                    {isBn ? 'ডেবিট/ক্রেডিট কার্ড (Visa / Mastercard)' : 'Debit / Credit Cards'}
                  </div>
                  <p className="text-xs text-gray-600">
                    {isBn
                      ? 'বাংলাদেশ ব্যাংক ও ব্যাংক গেটওয়ের স্ট্যান্ডার্ড নিয়মে ৩ থেকে ৭ কার্যদিবসের মধ্যে কার্ডে জমা হয়।'
                      : 'Settled to customer card account within 3 to 7 working days via bank gateway.'}
                  </p>
                </div>
              </div>

              <div className="bg-emerald-50/70 border border-emerald-200 rounded-xl p-4 text-emerald-900">
                <strong className="block text-xs font-bold mb-1">
                  {isBn ? '⚡ তাৎক্ষণিক প্রিন্ট ক্রেডিট বা রিট্রাই সুবিধা:' : '⚡ Instant Reprint Token or Platform Credit:'}
                </strong>
                <p className="text-xs">
                  {isBn
                    ? 'আপনি চাইলে ব্যাংকিং রিফান্ডের দীর্ঘ সময় অপেক্ষা না করে তাৎক্ষণিকভাবে একই মূল্যের নতুন ৬-সংখ্যার ওটিপি কোড গ্রহণ করে তৎক্ষণাৎ অন্য কোনো কিয়স্ক বা পার্টনার দোকান থেকে প্রিন্ট সম্পন্ন করতে পারবেন।'
                    : 'Instead of waiting for bank gateway processing, you can opt for an immediate replacement OTP code to release your prints at any nearby working machine.'}
                </p>
              </div>
            </div>
          </Card>

          {/* Section 4: How to claim */}
          <Card className="bg-white border border-gray-200 rounded-2xl shadow-none p-6">
            <h2 className="text-lg font-bold text-gray-900 mb-4 flex items-center gap-2">
              <span className="w-6 h-6 rounded-full bg-[#00bf63]/10 text-[#00bf63] text-xs font-black flex items-center justify-center">
                ০৪
              </span>
              {isBn ? 'কীভাবে রিফান্ড দাবি করবেন (How to Claim a Refund)' : '4. How to Submit a Refund Claim'}
            </h2>
            <div className="space-y-3.5 text-xs sm:text-sm text-gray-600 leading-relaxed">
              <p>
                {isBn
                  ? 'যেকোনো প্রিন্ট সমস্যা বা অর্থ ফেরতের জন্য অনুগ্রহ করে আপনার ৬ সংখ্যার ওটিপি (OTP) বা ট্রানজেকশন আইডি সহ আমাদের সাপোর্ট ডেস্কে যোগাযোগ করুন:'
                  : 'To request an expedited refund, reach out to our grievance team with your 6-digit OTP code or transaction ID:'}
              </p>
              <div className="grid grid-cols-1 sm:grid-cols-3 gap-3 pt-2">
                <a
                  href={COMPANY_INFO.whatsappUrl}
                  target="_blank"
                  rel="noreferrer"
                  className="p-3 bg-gray-50 border border-gray-200 rounded-xl text-center hover:border-[#00bf63] transition-colors block"
                >
                  <span className="block text-xs font-bold text-gray-900">WhatsApp Support</span>
                  <span className="text-xs text-[#00bf63] font-semibold">{COMPANY_INFO.whatsapp}</span>
                </a>
                <a
                  href={`tel:${COMPANY_INFO.helplineRaw}`}
                  className="p-3 bg-gray-50 border border-gray-200 rounded-xl text-center hover:border-[#00bf63] transition-colors block"
                >
                  <span className="block text-xs font-bold text-gray-900">Official Helpline</span>
                  <span className="text-xs text-[#00bf63] font-semibold">{COMPANY_INFO.helpline}</span>
                </a>
                <a
                  href={`mailto:${COMPANY_INFO.refundEmail}`}
                  className="p-3 bg-gray-50 border border-gray-200 rounded-xl text-center hover:border-[#00bf63] transition-colors block"
                >
                  <span className="block text-xs font-bold text-gray-900">Email Claims</span>
                  <span className="text-xs text-[#00bf63] font-semibold">{COMPANY_INFO.refundEmail}</span>
                </a>
              </div>
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
              <strong>{isBn ? 'মুদ্রা ও লেনদেন:' : 'Currency & Settlement:'}</strong> All refund disbursements are processed in Bangladeshi Taka (BDT) in accordance with the Consumer Rights Protection Act 2009 and Bangladesh Bank payment gateway regulations.
            </p>
          </div>
        </div>
      </div>
    </div>
  )
}
