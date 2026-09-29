'use client'

import React, { createContext, useContext, useState, useEffect, useCallback } from 'react'
import { translations } from '@/lib/translations'

const LanguageContext = createContext({
  lang: 'bn',
  setLang: () => {},
  toggleLang: () => {},
  t: () => '',
  toBengaliNumber: (v) => v,
})

const BENGALI_DIGITS = ['০', '১', '২', '৩', '৪', '৫', '৬', '৭', '৮', '৯']

export function LanguageProvider({ children }) {
  const [lang, setLangState] = useState('bn')
  const [mounted, setMounted] = useState(false)

  useEffect(() => {
    try {
      const saved = localStorage.getItem('printkoro_lang')
      if (saved === 'en' || saved === 'bn') {
        setLangState(saved)
        document.documentElement.lang = saved
      } else {
        document.documentElement.lang = 'bn'
      }
    } catch (e) {
      // Ignore localStorage error in private browsing
    }
    setMounted(true)
  }, [])

  const setLang = useCallback((newLang) => {
    if (newLang !== 'en' && newLang !== 'bn') return
    setLangState(newLang)
    try {
      localStorage.setItem('printkoro_lang', newLang)
      document.documentElement.lang = newLang
    } catch (e) {
      // ignore
    }
  }, [])

  const toggleLang = useCallback(() => {
    setLang(lang === 'bn' ? 'en' : 'bn')
  }, [lang, setLang])

  /**
   * Helper function to fetch nested translation key e.g. "hero.headlineStart"
   */
  const t = useCallback((keyPath, fallback = '') => {
    if (!keyPath) return fallback
    const keys = keyPath.split('.')
    let current = translations[lang]

    for (const k of keys) {
      if (current && typeof current === 'object' && k in current) {
        current = current[k]
      } else {
        // Fallback to English if key missing in Bangla
        let fallbackObj = translations.en
        for (const fk of keys) {
          if (fallbackObj && typeof fallbackObj === 'object' && fk in fallbackObj) {
            fallbackObj = fallbackObj[fk]
          } else {
            return fallback || keyPath
          }
        }
        return fallbackObj ?? fallback ?? keyPath
      }
    }

    return current ?? fallback ?? keyPath
  }, [lang])

  /**
   * Convert numbers or strings containing numbers to Bengali script if language is 'bn'
   */
  const toBengaliNumber = useCallback((val) => {
    if (val === null || val === undefined) return ''
    if (lang !== 'bn') return String(val)
    return String(val).replace(/[0-9]/g, (digit) => BENGALI_DIGITS[parseInt(digit, 10)])
  }, [lang])

  return (
    <LanguageContext.Provider value={{ lang, setLang, toggleLang, t, toBengaliNumber, mounted }}>
      {children}
    </LanguageContext.Provider>
  )
}

export function useLanguage() {
  const context = useContext(LanguageContext)
  if (!context) {
    throw new Error('useLanguage must be used within a LanguageProvider')
  }
  return context
}
