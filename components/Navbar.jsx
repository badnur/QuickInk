'use client'

import { useState } from 'react'
import Link from 'next/link'
import { Button } from '@/components/ui/button'
import { Menu, X, Printer } from 'lucide-react'

export default function Navbar() {
  const [isOpen, setIsOpen] = useState(false)

  return (
    <nav className="bg-white border-b sticky top-0 z-50 shadow-sm">
      <div className="container mx-auto px-4 sm:px-6 lg:px-8">
        <div className="flex justify-between items-center h-16">
          {/* Logo */}
          <Link href="/" className="flex items-center gap-2">
            <div className="w-10 h-10 bg-blue-600 rounded-lg flex items-center justify-center">
              <Printer className="h-6 w-6 text-white" />
            </div>
            <span className="text-xl font-bold text-gray-900">QuickInk</span>
          </Link>

          {/* Desktop Navigation */}
          <div className="hidden md:flex items-center gap-8">
            <Link href="/" className="text-gray-700 hover:text-blue-600 transition-colors font-medium">
              Home
            </Link>
            <Link href="/find-printer" className="text-gray-700 hover:text-blue-600 transition-colors font-medium">
              Find Printer
            </Link>
            <Link href="/partner" className="text-gray-700 hover:text-blue-600 transition-colors font-medium">
              Become Partner
            </Link>
            <Link href="/contact" className="text-gray-700 hover:text-blue-600 transition-colors font-medium">
              Contact
            </Link>
            <Link href="/find-printer">
              <Button>Print Now</Button>
            </Link>
          </div>

          {/* Mobile Menu Button */}
          <button
            className="md:hidden"
            onClick={() => setIsOpen(!isOpen)}
          >
            {isOpen ? <X className="h-6 w-6" /> : <Menu className="h-6 w-6" />}
          </button>
        </div>

        {/* Mobile Navigation */}
        {isOpen && (
          <div className="md:hidden py-4 border-t">
            <div className="flex flex-col gap-4">
              <Link href="/" className="text-gray-700 hover:text-blue-600 transition-colors font-medium" onClick={() => setIsOpen(false)}>
                Home
              </Link>
              <Link href="/find-printer" className="text-gray-700 hover:text-blue-600 transition-colors font-medium" onClick={() => setIsOpen(false)}>
                Find Printer
              </Link>
              <Link href="/partner" className="text-gray-700 hover:text-blue-600 transition-colors font-medium" onClick={() => setIsOpen(false)}>
                Become Partner
              </Link>
              <Link href="/contact" className="text-gray-700 hover:text-blue-600 transition-colors font-medium" onClick={() => setIsOpen(false)}>
                Contact
              </Link>
              <Link href="/find-printer" onClick={() => setIsOpen(false)}>
                <Button className="w-full">Print Now</Button>
              </Link>
            </div>
          </div>
        )}
      </div>
    </nav>
  )
}
