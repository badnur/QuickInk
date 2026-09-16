import Link from 'next/link'
import { Printer, Mail, Phone, MapPin, Globe, Share2, Send, AtSign } from 'lucide-react'

export default function Footer() {
  const year = new Date().getFullYear()

  return (
    <footer className="bg-gray-900 text-gray-300">
      <div className="container mx-auto px-4 sm:px-6 lg:px-8 py-16">
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-5 gap-12 mb-12">
          {/* Brand */}
          <div className="lg:col-span-2">
            <div className="flex items-center gap-3 mb-6">
              <img 
                src="/images/quickink-logo.png" 
                alt="QuickInk Logo" 
                className="w-auto"
                style={{ height: '100px' }}
              />
            </div>
            <p className="text-gray-400 mb-6 max-w-sm leading-relaxed">
              Making printing accessible, affordable, and convenient for everyone. Print anything, anytime, anywhere.
            </p>
            <div className="flex gap-4">
              {[Globe, Share2, Send, AtSign].map((Icon, index) => (
                <a
                  key={index}
                  href="#"
                  className="w-10 h-10 bg-gray-800 rounded-lg flex items-center justify-center hover:bg-[#00bf63] transition-colors duration-300"
                >
                  <Icon className="h-5 w-5" />
                </a>
              ))}
            </div>
          </div>

          {/* Quick Links */}
          <div>
            <h3 className="text-white font-bold text-lg mb-6">Quick Links</h3>
            <ul className="space-y-3">
              {[
                { label: 'Home', href: '/' },
                { label: 'Find Printer', href: '/find-printer' },
                { label: 'Become Partner', href: '/partner' },
                { label: 'Contact Us', href: '/contact' }
              ].map((link) => (
                <li key={link.href}>
                  <Link
                    href={link.href}
                    className="text-gray-400 hover:text-[#00bf63] transition-colors duration-300 flex items-center group"
                  >
                    <span className="mr-2 opacity-0 group-hover:opacity-100 transition-opacity">→</span>
                    {link.label}
                  </Link>
                </li>
              ))}
            </ul>
          </div>

          {/* Support */}
          <div>
            <h3 className="text-white font-bold text-lg mb-6">Support</h3>
            <ul className="space-y-3">
              {[
                { label: 'Help Center', href: '#' },
                { label: 'Terms of Service', href: '#' },
                { label: 'Privacy Policy', href: '#' },
                { label: 'FAQs', href: '#' }
              ].map((link) => (
                <li key={link.label}>
                  <Link
                    href={link.href}
                    className="text-gray-400 hover:text-[#00bf63] transition-colors duration-300 flex items-center group"
                  >
                    <span className="mr-2 opacity-0 group-hover:opacity-100 transition-opacity">→</span>
                    {link.label}
                  </Link>
                </li>
              ))}
            </ul>
          </div>

          {/* Contact */}
          <div>
            <h3 className="text-white font-bold text-lg mb-6">Contact</h3>
            <ul className="space-y-4">
              <li className="flex items-start gap-3 text-gray-400 hover:text-[#00bf63] transition-colors group">
                <Mail className="h-5 w-5 mt-1 flex-shrink-0 group-hover:scale-110 transition-transform" />
                <span className="text-sm">support@quickink.online</span>
              </li>
              <li className="flex items-start gap-3 text-gray-400 hover:text-[#00bf63] transition-colors group">
                <Phone className="h-5 w-5 mt-1 flex-shrink-0 group-hover:scale-110 transition-transform" />
                <span className="text-sm">+880 1733-398911</span>
              </li>
              <li className="flex items-start gap-3 text-gray-400 hover:text-[#00bf63] transition-colors group">
                <MapPin className="h-5 w-5 mt-1 flex-shrink-0 group-hover:scale-110 transition-transform" />
                <span className="text-sm">Bagha, Rajshahi, Bangladesh</span>
              </li>
            </ul>
          </div>
        </div>

        {/* Bottom bar */}
        <div className="border-t border-gray-800 pt-8">
          <div className="flex flex-col md:flex-row justify-between items-center gap-4">
            <p className="text-sm text-gray-400">
              © {year} QuickInk. All rights reserved.
            </p>
            <div className="flex gap-6 text-sm text-gray-400">
              <Link href="#" className="hover:text-[#00bf63] transition-colors">Terms</Link>
              <Link href="#" className="hover:text-[#00bf63] transition-colors">Privacy</Link>
              <Link href="#" className="hover:text-[#00bf63] transition-colors">Cookies</Link>
            </div>
          </div>
        </div>
      </div>
    </footer>
  )
}
