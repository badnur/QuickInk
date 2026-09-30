'use client'

import { Sun, Moon } from 'lucide-react'
import { useTheme } from '@/context/ThemeContext'

export default function ThemeToggle({ className = '' }) {
  const { theme, toggleTheme, mounted } = useTheme()

  if (!mounted) {
    return (
      <div className={`w-7 h-7 rounded border border-slate-700/60 bg-slate-900/60 ${className}`} />
    )
  }

  const isDark = theme === 'dark'

  return (
    <button
      type="button"
      onClick={toggleTheme}
      title={isDark ? 'Switch to Light Mode' : 'Switch to Dark Mode'}
      aria-label="Toggle color theme"
      className={`h-7 px-2 flex items-center justify-center gap-1.5 rounded text-xs font-medium transition-colors border shadow-none ${
        isDark
          ? 'bg-slate-900 border-slate-800 text-slate-300 hover:text-white hover:bg-slate-800'
          : 'bg-white border-slate-200 text-slate-700 hover:text-slate-950 hover:bg-slate-100'
      } ${className}`}
    >
      {isDark ? (
        <>
          <Sun className="w-3.5 h-3.5 text-amber-400" />
          <span className="hidden sm:inline text-[11px]">Light</span>
        </>
      ) : (
        <>
          <Moon className="w-3.5 h-3.5 text-slate-700" />
          <span className="hidden sm:inline text-[11px]">Dark</span>
        </>
      )}
    </button>
  )
}
