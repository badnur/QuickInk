'use client'

import Link from 'next/link'
import { Mail, Phone, MapPin, Globe, Share2, Send, AtSign, Building2, ShieldCheck, Clock, FileText } from 'lucide-react'
import { useLanguage } from '@/context/LanguageContext'
import LanguageToggle from '@/components/LanguageToggle'
import { COMPANY_INFO } from '@/lib/company-info'

export default function Footer() {
  const year = new Date().getFullYear()
  const { t, toBengaliNumber, lang } = useLanguage()
  const isBn = lang === 'bn'

  return (
    <footer className="bg-gray-950 text-gray-300 border-t border-gray-900">
      <div className="container mx-auto px-4 sm:px-6 lg:px-8 py-16">
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-5 gap-10 mb-12">
          {/* Brand & Mission */}
          <div className="lg:col-span-2">
            <div className="flex items-center gap-3 mb-4">
              <img 
                src="/images/printkoro-logo-dark.png" 
                alt="PrintKoro Logo" 
                className="h-9 w-auto"
              />
            </div>
            <p className="text-gray-400 mb-5 max-w-sm leading-relaxed text-xs sm:text-sm">
              {t('footer.about', "PrintKoro is Bangladesh's premier smart self-service printing network. Upload from your phone, pay securely, and print in 60 seconds.")}
            </p>

            {/* Merchant Identity & Trade License Tag */}
            <div className="bg-gray-900/80 border border-gray-800 rounded-xl p-3.5 mb-5 max-w-sm space-y-1.5 text-xs">
              <div className="flex items-center justify-between">
                <span className="text-gray-400 font-semibold">{isBn ? 'পরিচালক সত্ত্বা:' : 'Operating Entity:'}</span>
                <span className="text-white font-bold">{COMPANY_INFO.legalEntityName}</span>
              </div>
              <div className="flex items-center justify-between">
                <span className="text-gray-400 font-semibold">{isBn ? 'ট্রেড লাইসেন্স নং:' : 'Trade License No:'}</span>
                <span className="font-mono text-emerald-400 font-bold bg-emerald-950/40 px-2 py-0.5 rounded border border-emerald-900/50">
                  {COMPANY_INFO.tradeLicenseNo}
                </span>
              </div>
              <div className="text-[11px] text-gray-500 pt-1 border-t border-gray-800/80 flex items-center gap-1">
                <ShieldCheck className="w-3.5 h-3.5 text-[#00bf63]" />
                <span>{isBn ? 'বাংলাদেশি টাকায় (BDT) অনুমোদিত গেটওয়ে' : 'All transactions securely settled in BDT (৳)'}</span>
              </div>
            </div>

            <div className="flex items-center gap-4">
              <div className="flex gap-2.5">
                {[Globe, Share2, Send, AtSign].map((Icon, index) => (
                  <a
                    key={index}
                    href="#"
                    aria-label="Social Link"
                    className="w-9 h-9 bg-gray-900 border border-gray-800 rounded-lg flex items-center justify-center hover:bg-[#00bf63] hover:text-white hover:border-[#00bf63] transition-all duration-200"
                  >
                    <Icon className="h-4 w-4" />
                  </a>
                ))}
              </div>
              <div className="pl-2 border-l border-gray-800">
                <LanguageToggle variant="compact" />
              </div>
            </div>
          </div>

          {/* Quick Links */}
          <div>
            <h3 className="text-white font-bold text-sm tracking-wide uppercase mb-4 text-emerald-400">
              {t('footer.quickLinks', 'Quick Links')}
            </h3>
            <ul className="space-y-2.5 text-xs sm:text-sm">
              {[
                { label: t('nav.home', 'Home'), href: '/' },
                { label: t('footer.aboutUs', 'About Us (আমাদের সম্পর্কে)'), href: '/about' },
                { label: t('nav.findPrinter', 'Find Printer'), href: '/find-printer' },
                { label: t('nav.becomePartner', 'Become Partner'), href: '/partner' },
                { label: t('nav.contact', 'Contact Us'), href: '/contact' }
              ].map((link) => (
                <li key={link.href}>
                  <Link
                    href={link.href}
                    className="text-gray-400 hover:text-[#00bf63] transition-colors duration-200 flex items-center group"
                  >
                    <span className="mr-1.5 opacity-0 group-hover:opacity-100 transition-opacity text-[#00bf63]">→</span>
                    {link.label}
                  </Link>
                </li>
              ))}
            </ul>
          </div>

          {/* Legal & Policies (Payment Gateway Mandatory) */}
          <div>
            <h3 className="text-white font-bold text-sm tracking-wide uppercase mb-4 text-emerald-400">
              {t('footer.support', 'Policies & Support')}
            </h3>
            <ul className="space-y-2.5 text-xs sm:text-sm">
              {[
                { label: t('footer.terms', 'Terms & Conditions (শর্তাবলী)'), href: '/terms' },
                { label: t('footer.refund', 'Return & Refund Policy (রিফান্ড নীতি)'), href: '/refund' },
                { label: t('footer.privacy', 'Privacy Policy (গোপনীয়তা নীতি)'), href: '/privacy' },
                { label: t('footer.delivery', 'Delivery Policy (ডেলিভারি নীতিমালা)'), href: '/delivery' },
                { label: t('faq.title', 'FAQs & Help'), href: '/#faq' }
              ].map((link, idx) => (
                <li key={idx}>
                  <Link
                    href={link.href}
                    className="text-gray-400 hover:text-[#00bf63] transition-colors duration-200 flex items-center group"
                  >
                    <span className="mr-1.5 opacity-0 group-hover:opacity-100 transition-opacity text-[#00bf63]">→</span>
                    {link.label}
                  </Link>
                </li>
              ))}
            </ul>
          </div>

          {/* Contact & Physical Office Address */}
          <div>
            <h3 className="text-white font-bold text-sm tracking-wide uppercase mb-4 text-emerald-400">
              {t('footer.contact', 'Business Address')}
            </h3>
            <ul className="space-y-3.5 text-xs">
              <li className="flex items-start gap-2.5 text-gray-400 hover:text-white transition-colors">
                <MapPin className="h-4 w-4 text-[#00bf63] mt-0.5 flex-shrink-0" />
                <div>
                  <strong className="text-gray-300 block">{isBn ? 'নিবন্ধিত কার্যালয়:' : 'Registered Office:'}</strong>
                  <span>{isBn ? COMPANY_INFO.registeredOfficeBn : COMPANY_INFO.registeredOffice}</span>
                </div>
              </li>
              <li className="flex items-start gap-2.5 text-gray-400 hover:text-white transition-colors">
                <Building2 className="h-4 w-4 text-[#00bf63] mt-0.5 flex-shrink-0" />
                <div>
                  <strong className="text-gray-300 block">{isBn ? 'অপারেশনাল হাব:' : 'Operations Hub:'}</strong>
                  <span>{isBn ? COMPANY_INFO.operationsHubBn : COMPANY_INFO.operationsHub}</span>
                </div>
              </li>
              <li className="flex items-start gap-2.5 text-gray-400 hover:text-white transition-colors">
                <Phone className="h-4 w-4 text-[#00bf63] mt-0.5 flex-shrink-0" />
                <div>
                  <strong className="text-gray-300 block">{isBn ? 'হেল্পলাইন ও হোয়াটসঅ্যাপ:' : 'Helpline & WhatsApp:'}</strong>
                  <a href={`tel:${COMPANY_INFO.helplineRaw}`} className="hover:text-[#00bf63] font-semibold">
                    {COMPANY_INFO.helpline}
                  </a>
                </div>
              </li>
              <li className="flex items-start gap-2.5 text-gray-400 hover:text-white transition-colors">
                <Mail className="h-4 w-4 text-[#00bf63] mt-0.5 flex-shrink-0" />
                <div>
                  <strong className="text-gray-300 block">{isBn ? 'ইমেইল সহায়তা:' : 'Official Email:'}</strong>
                  <a href={`mailto:${COMPANY_INFO.email}`} className="text-[#00bf63] hover:underline font-semibold">
                    {COMPANY_INFO.email}
                  </a>
                </div>
              </li>
            </ul>
          </div>
        </div>

        {/* Bottom bar */}
        <div className="border-t border-gray-900 pt-8 flex flex-col md:flex-row justify-between items-center gap-4 text-xs text-gray-500">
          <div className="text-center md:text-left space-y-1">
            <p>
              © {toBengaliNumber(year)} {COMPANY_INFO.legalEntityName} ({COMPANY_INFO.brandName}). {t('footer.allRights', 'All rights reserved.')}
            </p>
            <p className="text-[11px] text-gray-600">
              Government Registered Enterprise • Trade License No: <span className="font-mono text-gray-400">{COMPANY_INFO.tradeLicenseNo}</span>
            </p>
          </div>
          <div className="flex flex-wrap justify-center gap-4 sm:gap-6 text-gray-400 text-xs">
            <Link href="/about" className="hover:text-[#00bf63] transition-colors">{t('footer.aboutUs', 'About Us')}</Link>
            <Link href="/terms" className="hover:text-[#00bf63] transition-colors">{t('footer.terms', 'Terms & Conditions')}</Link>
            <Link href="/refund" className="hover:text-[#00bf63] transition-colors">{t('footer.refund', 'Refund Policy')}</Link>
            <Link href="/privacy" className="hover:text-[#00bf63] transition-colors">{t('footer.privacy', 'Privacy Policy')}</Link>
            <Link href="/delivery" className="hover:text-[#00bf63] transition-colors">{t('footer.delivery', 'Delivery Policy')}</Link>
          </div>
        </div>
      </div>
    </footer>
  )
}
