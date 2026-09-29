'use client'

import { useLanguage } from '@/context/LanguageContext'
import { Globe } from 'lucide-react'

export default function LanguageToggle({ variant = 'navbar', className = '' }) {
  const { lang, setLang, toggleLang } = useLanguage()

  if (variant === 'compact') {
    return (
      <button
        onClick={toggleLang}
        className={`inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-xs font-bold border transition-all duration-200 cursor-pointer ${
          lang === 'bn'
            ? 'bg-emerald-50 text-emerald-800 border-emerald-300 hover:bg-emerald-100'
            : 'bg-gray-100 text-gray-800 border-gray-300 hover:bg-gray-200'
        } ${className}`}
        title={lang === 'bn' ? 'Switch to English' : 'বাংলায় দেখুন'}
      >
        <Globe className="w-3.5 h-3.5 text-[#00bf63]" />
        <span>{lang === 'bn' ? 'বাংলা' : 'EN'}</span>
      </button>
    )
  }

  return (
    <div className={`inline-flex items-center p-0.5 bg-gray-100/90 border border-gray-200/90 rounded-full text-xs font-semibold shadow-inner ${className}`}>
      <button
        type="button"
        onClick={() => setLang('bn')}
        className={`flex items-center gap-1 px-2.5 py-1 rounded-full transition-all duration-200 cursor-pointer ${
          lang === 'bn'
            ? 'bg-[#00bf63] text-white font-bold shadow-xs scale-102'
            : 'text-gray-600 hover:text-gray-900 hover:bg-gray-200/50'
        }`}
      >
        <span className="text-[11px]">🇧🇩</span>
        <span>বাংলা</span>
      </button>

      <button
        type="button"
        onClick={() => setLang('en')}
        className={`flex items-center gap-1 px-2.5 py-1 rounded-full transition-all duration-200 cursor-pointer ${
          lang === 'en'
            ? 'bg-[#00bf63] text-white font-bold shadow-xs scale-102'
            : 'text-gray-600 hover:text-gray-900 hover:bg-gray-200/50'
        }`}
      >
        <span>EN</span>
      </button>
    </div>
  )
}
