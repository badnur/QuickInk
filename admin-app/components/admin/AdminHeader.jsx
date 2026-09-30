'use client'

import { RefreshCw, ShieldCheck, Menu, X } from 'lucide-react'
import { Button } from '@/components/ui/button'
import ThemeToggle from '@/components/admin/ThemeToggle'

export default function AdminHeader({
  title,
  subtitle,
  onRefresh,
  isRefreshing = false,
  onMobileMenuToggle,
  isMobileMenuOpen = false,
}) {
  return (
    <header className="h-14 border-b border-slate-200 dark:border-slate-800/80 bg-white dark:bg-black px-6 flex items-center justify-between sticky top-0 z-30 transition-colors">
      {/* Title / Left */}
      <div className="flex items-center gap-3">
        {onMobileMenuToggle && (
          <button
            onClick={onMobileMenuToggle}
            className="md:hidden p-1.5 rounded text-slate-500 dark:text-slate-400 hover:text-slate-900 dark:hover:text-white hover:bg-slate-100 dark:hover:bg-slate-900"
          >
            {isMobileMenuOpen ? <X className="w-5 h-5" /> : <Menu className="w-5 h-5" />}
          </button>
        )}
        <div>
          <h1 className="text-sm font-semibold text-slate-900 dark:text-white tracking-tight flex items-center gap-2">
            {title}
          </h1>
          {subtitle && <p className="text-[11px] text-slate-500 dark:text-slate-400 font-normal">{subtitle}</p>}
        </div>
      </div>

      {/* Actions / Right */}
      <div className="flex items-center gap-2">
        {/* Light / Dark Mode Toggle */}
        <ThemeToggle />

        {onRefresh && (
          <Button
            size="sm"
            variant="outline"
            onClick={onRefresh}
            disabled={isRefreshing}
            className="h-7 bg-white dark:bg-slate-950 border-slate-200 dark:border-slate-800 text-slate-700 dark:text-slate-300 hover:text-slate-950 dark:hover:text-white hover:bg-slate-100 dark:hover:bg-slate-900 text-xs flex items-center gap-1.5 shadow-none rounded"
          >
            <RefreshCw className={`w-3 h-3 ${isRefreshing ? 'animate-spin text-[#00bf63]' : ''}`} />
            <span className="hidden sm:inline text-xs font-normal">Refresh</span>
          </Button>
        )}

        <div className="hidden lg:flex items-center gap-1.5 px-2.5 py-1 rounded bg-emerald-50 dark:bg-emerald-950/30 border border-emerald-200 dark:border-emerald-800/50 text-[11px] font-medium text-emerald-700 dark:text-emerald-400">
          <ShieldCheck className="w-3.5 h-3.5" />
          <span>System Verified</span>
        </div>
      </div>
    </header>
  )
}
