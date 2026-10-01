'use client'

import Link from 'next/link'
import { Mail, Phone, MapPin, Globe, Share2, Send, AtSign } from 'lucide-react'
import { useLanguage } from '@/context/LanguageContext'
import LanguageToggle from '@/components/LanguageToggle'

export default function Footer() {
  const year = new Date().getFullYear()
  const { t, toBengaliNumber } = useLanguage()

  return (
    <footer className="bg-gray-950 text-gray-300 border-t border-gray-900">
      <div className="container mx-auto px-4 sm:px-6 lg:px-8 py-16">
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-5 gap-10 mb-12">
          {/* Brand */}
          <div className="lg:col-span-2">
            <div className="flex items-center gap-3 mb-5">
              <img 
                src="/images/printkoro-logo-dark.png" 
                alt="PrintKoro Logo" 
                className="h-9 w-auto"
              />
            </div>
            <p className="text-gray-400 mb-6 max-w-sm leading-relaxed text-xs sm:text-sm">
              {t('footer.about', "PrintKoro is Bangladesh's premier smart self-service printing network. Upload from your phone, pay securely, and print in 60 seconds.")}
            </p>
            <div className="flex items-center gap-4">
              <div className="flex gap-3">
                {[Globe, Share2, Send, AtSign].map((Icon, index) => (
                  <a
                    key={index}
                    href="#"
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

          {/* Support */}
          <div>
            <h3 className="text-white font-bold text-sm tracking-wide uppercase mb-4 text-emerald-400">
              {t('footer.support', 'Support')}
            </h3>
            <ul className="space-y-2.5 text-xs sm:text-sm">
              {[
                { label: t('faq.title', 'FAQs & Help'), href: '/#faq' },
                { label: t('footer.terms', 'Terms of Service'), href: '/terms' },
                { label: t('footer.privacy', 'Privacy Policy'), href: '/privacy' },
                { label: t('nav.becomePartner', 'Partner Program'), href: '/partner' }
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

          {/* Contact */}
          <div>
            <h3 className="text-white font-bold text-sm tracking-wide uppercase mb-4 text-emerald-400">
              {t('footer.contact', 'Contact')}
            </h3>
            <ul className="space-y-3.5 text-xs">
              <li className="flex items-start gap-2.5 text-gray-400 hover:text-white transition-colors">
                <Mail className="h-4 w-4 text-[#00bf63] mt-0.5 flex-shrink-0" />
                <span>{t('footer.helpEmail', 'help@printkoro.com')}</span>
              </li>
              <li className="flex items-start gap-2.5 text-gray-400 hover:text-white transition-colors">
                <Phone className="h-4 w-4 text-[#00bf63] mt-0.5 flex-shrink-0" />
                <span>{t('footer.helpPhone', '+880 1733-398911')}</span>
              </li>
              <li className="flex items-start gap-2.5 text-gray-400 hover:text-white transition-colors">
                <MapPin className="h-4 w-4 text-[#00bf63] mt-0.5 flex-shrink-0" />
                <span>{t('footer.address', 'Dhaka & Rajshahi, Bangladesh')}</span>
              </li>
            </ul>
          </div>
        </div>

        {/* Bottom bar */}
        <div className="border-t border-gray-900 pt-8 flex flex-col sm:flex-row justify-between items-center gap-4 text-xs text-gray-500">
          <p>
            © {toBengaliNumber(year)} PrintKoro.com. {t('footer.allRights', 'All rights reserved.')}
          </p>
          <div className="flex gap-6 text-gray-400">
            <Link href="/terms" className="hover:text-[#00bf63] transition-colors">{t('footer.terms', 'Terms')}</Link>
            <Link href="/privacy" className="hover:text-[#00bf63] transition-colors">{t('footer.privacy', 'Privacy')}</Link>
            <Link href="#" className="hover:text-[#00bf63] transition-colors">{t('footer.cookies', 'Cookies')}</Link>
          </div>
        </div>
      </div>
    </footer>
  )
}
