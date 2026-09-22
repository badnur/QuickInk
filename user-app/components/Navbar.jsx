'use client'

import { useState, useEffect } from 'react'
import Link from 'next/link'
import { usePathname } from 'next/navigation'
import { Button } from '@/components/ui/button'
import { Menu, X } from 'lucide-react'

export default function Navbar() {
  const [isOpen, setIsOpen] = useState(false)
  const [scrolled, setScrolled] = useState(false)
  const pathname = usePathname()

  useEffect(() => {
    const handleScroll = () => {
      setScrolled(window.scrollY > 15)
    }
    window.addEventListener('scroll', handleScroll)
    return () => window.removeEventListener('scroll', handleScroll)
  }, [])

  const navLinks = [
    { href: '/', label: 'Home' },
    { href: '/find-printer', label: 'Find Printer' },
    { href: '/partner', label: 'Become Partner' },
    { href: '/contact', label: 'Contact' }
  ]

  return (
    <nav className={`fixed top-0 left-0 right-0 z-50 transition-all duration-200 ${
      scrolled ? 'bg-white/95 border-b border-gray-200/80 shadow-xs' : 'bg-white border-b border-gray-100'
    }`}>
      <div className="container mx-auto px-4 sm:px-6 lg:px-8">
        <div className="flex justify-between items-center h-20">
          {/* Logo */}
          <Link href="/" className="flex items-center group">
            <img 
              src="/images/printkoro-logo.png" 
              alt="PrintKoro Logo" 
              className="h-8 sm:h-9 md:h-10 w-auto transition-all duration-300 group-hover:scale-105"
            />
          </Link>

          {/* Desktop Navigation */}
          <div className="hidden md:flex items-center gap-8">
            {navLinks.map((link) => {
              const isActive = pathname === link.href
              return (
                <Link
                  key={link.href}
                  href={link.href}
                  className={`text-sm font-semibold transition-colors duration-150 relative py-1 ${
                    isActive
                      ? 'text-[#00bf63]'
                      : 'text-gray-600 hover:text-[#00bf63]'
                  }`}
                >
                  {link.label}
                  {isActive && (
                    <span className="absolute bottom-0 left-0 right-0 h-0.5 bg-[#00bf63] rounded-full" />
                  )}
                </Link>
              )
            })}
            <Link href="/print">
              <Button className="bg-[#00bf63] hover:bg-[#00a656] text-white font-bold px-5 py-2 rounded-xl text-sm transition-colors duration-150 shadow-none">
                Print Now
              </Button>
            </Link>
          </div>

          {/* Mobile Menu Button */}
          <button
            className="md:hidden p-2 rounded-lg text-gray-700 hover:bg-gray-100 transition-colors"
            onClick={() => setIsOpen(!isOpen)}
            aria-label="Toggle menu"
          >
            {isOpen ? <X className="h-5 w-5" /> : <Menu className="h-5 w-5" />}
          </button>
        </div>

        {/* Mobile Navigation */}
        {isOpen && (
          <div className="md:hidden py-3 border-t border-gray-100 animate-in slide-in-from-top">
            <div className="flex flex-col gap-2">
              {navLinks.map((link) => {
                const isActive = pathname === link.href
                return (
                  <Link
                    key={link.href}
                    href={link.href}
                    className={`text-sm font-semibold px-3 py-2 rounded-lg transition-colors ${
                      isActive
                        ? 'text-[#00bf63] bg-[#00bf63]/10 font-bold'
                        : 'text-gray-700 hover:text-[#00bf63] hover:bg-gray-50'
                    }`}
                    onClick={() => setIsOpen(false)}
                  >
                    {link.label}
                  </Link>
                )
              })}
              <Link href="/print" onClick={() => setIsOpen(false)} className="pt-2">
                <Button className="w-full bg-[#00bf63] hover:bg-[#00a656] text-white font-bold rounded-xl py-2 shadow-none">
                  Print Now
                </Button>
              </Link>
            </div>
          </div>
        )}
      </div>
    </nav>
  )
}
