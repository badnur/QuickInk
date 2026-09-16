'use client'

import { RefreshCw, Search, Bell, ShieldCheck, Menu, X } from 'lucide-react'
import { Button } from '@/components/ui/button'

export default function AdminHeader({
  title,
  subtitle,
  onRefresh,
  isRefreshing = false,
  onMobileMenuToggle,
  isMobileMenuOpen = false,
}) {
  return (
    <header className="h-16 border-b border-slate-800/80 bg-[#0d131f]/80 backdrop-blur-md px-6 flex items-center justify-between sticky top-0 z-30">
      {/* Title / Left */}
      <div className="flex items-center gap-3">
        {onMobileMenuToggle && (
          <button
            onClick={onMobileMenuToggle}
            className="md:hidden p-2 rounded-lg text-slate-400 hover:text-white hover:bg-slate-800"
          >
            {isMobileMenuOpen ? <X className="w-5 h-5" /> : <Menu className="w-5 h-5" />}
          </button>
        )}
        <div>
          <h1 className="text-base font-bold text-white tracking-tight flex items-center gap-2">
            {title}
          </h1>
          {subtitle && <p className="text-[11px] text-slate-400 font-medium">{subtitle}</p>}
        </div>
      </div>

      {/* Actions / Right */}
      <div className="flex items-center gap-3">
        {onRefresh && (
          <Button
            size="sm"
            variant="outline"
            onClick={onRefresh}
            disabled={isRefreshing}
            className="h-8 bg-slate-900 border-slate-800 text-slate-300 hover:text-white hover:bg-slate-800 text-xs flex items-center gap-1.5 shadow-none"
          >
            <RefreshCw className={`w-3.5 h-3.5 ${isRefreshing ? 'animate-spin text-[#00bf63]' : ''}`} />
            <span className="hidden sm:inline">Refresh</span>
          </Button>
        )}

        <div className="hidden lg:flex items-center gap-1.5 px-3 py-1 rounded-lg bg-emerald-950/40 border border-emerald-800/50 text-[11px] font-semibold text-emerald-400">
          <ShieldCheck className="w-3.5 h-3.5" />
          <span>System Verified</span>
        </div>
      </div>
    </header>
  )
}
