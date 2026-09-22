'use client'

import Link from 'next/link'
import { usePathname, useRouter } from 'next/navigation'
import {
  LayoutDashboard,
  Printer,
  HardDrive,
  Users,
  BarChart3,
  LogOut,
  ChevronRight,
  ExternalLink
} from 'lucide-react'
import { clearAdminSession } from '@/lib/admin-auth'

export default function AdminSidebar({ user, isConnected = true, pendingJobsCount = 0 }) {
  const pathname = usePathname()
  const router = useRouter()

  const customerAppUrl = process.env.NEXT_PUBLIC_USER_APP_URL || 'http://localhost:3000'

  const navItems = [
    {
      href: '/',
      label: 'Overview',
      icon: LayoutDashboard,
      exact: true,
    },
    {
      href: '/jobs',
      label: 'Live Print Jobs',
      icon: Printer,
      badge: pendingJobsCount > 0 ? pendingJobsCount : null,
    },
    {
      href: '/devices',
      label: 'Devices & Kiosks',
      icon: HardDrive,
    },
    {
      href: '/partners',
      label: 'Partner Applications',
      icon: Users,
    },
    {
      href: '/analytics',
      label: 'Revenue & Volume',
      icon: BarChart3,
    },
  ]

  const handleLogout = () => {
    clearAdminSession()
    router.push('/login')
  }

  return (
    <aside className="w-64 bg-[#0d131f] border-r border-slate-800/80 flex flex-col justify-between h-screen sticky top-0 text-slate-300 select-none z-40">
      {/* Brand Header */}
      <div>
        <div className="p-5 border-b border-slate-800/80 flex items-center justify-between">
          <Link href="/" className="flex items-center gap-2 group">
            <img 
              src="/images/printkoro-logo-dark.png" 
              alt="PrintKoro Admin" 
              className="h-7 w-auto transition-transform group-hover:scale-105"
            />
            <span className="text-[10px] font-bold px-1.5 py-0.5 rounded bg-[#00bf63] text-slate-950 uppercase tracking-wider">
              Admin
            </span>
          </Link>
        </div>

        {/* Realtime Status Indicator */}
        <div className="px-4 pt-3.5 pb-1">
          <div className="bg-slate-900/80 border border-slate-800 rounded-xl px-3 py-2 flex items-center justify-between text-xs">
            <div className="flex items-center gap-2">
              <span className="relative flex h-2 w-2">
                <span className={`animate-ping absolute inline-flex h-full w-full rounded-full ${isConnected ? 'bg-[#00bf63]' : 'bg-amber-400'} opacity-75`}></span>
                <span className={`relative inline-flex rounded-full h-2 w-2 ${isConnected ? 'bg-[#00bf63]' : 'bg-amber-500'}`}></span>
              </span>
              <span className="text-[11px] font-medium text-slate-300">
                {isConnected ? 'Supabase Live' : 'Connecting...'}
              </span>
            </div>
            <a
              href={`${customerAppUrl}/print`}
              target="_blank"
              rel="noreferrer"
              className="text-[10px] text-[#00bf63] hover:text-[#00a656] flex items-center gap-0.5 font-semibold"
            >
              Kiosk View <ExternalLink className="w-2.5 h-2.5" />
            </a>
          </div>
        </div>

        {/* Navigation Section */}
        <nav className="p-3 space-y-1 mt-2">
          <div className="px-3 py-1 text-[10px] font-bold uppercase tracking-wider text-slate-500">
            Management
          </div>
          {navItems.map((item) => {
            const isActive = item.exact ? pathname === item.href : (pathname === item.href || (item.href !== '/' && pathname.startsWith(item.href)))
            const Icon = item.icon

            return (
              <Link
                key={item.href}
                href={item.href}
                className={`flex items-center justify-between px-3 py-2.5 rounded-xl text-xs font-semibold transition-all ${
                  isActive
                    ? 'bg-[#00bf63] text-slate-950 font-bold shadow-lg shadow-[#00bf63]/20'
                    : 'text-slate-400 hover:text-white hover:bg-slate-800/60'
                }`}
              >
                <div className="flex items-center gap-3">
                  <Icon className={`w-4 h-4 ${isActive ? 'text-slate-950' : 'text-slate-400'}`} />
                  <span>{item.label}</span>
                </div>
                {item.badge ? (
                  <span
                    className={`px-1.5 py-0.5 rounded-full text-[10px] font-bold ${
                      isActive ? 'bg-slate-950 text-white' : 'bg-[#00bf63]/20 text-[#00bf63]'
                    }`}
                  >
                    {item.badge}
                  </span>
                ) : (
                  isActive && <ChevronRight className="w-3.5 h-3.5 text-slate-950" />
                )}
              </Link>
            )
          })}
        </nav>
      </div>

      {/* User Footer & Logout */}
      <div className="p-4 border-t border-slate-800/80">
        <div className="bg-slate-900/60 rounded-xl p-3 flex items-center justify-between">
          <div className="flex items-center gap-2.5 min-w-0">
            <div className="w-8 h-8 rounded-full bg-slate-800 border border-slate-700 flex items-center justify-center font-bold text-xs text-[#00bf63] flex-shrink-0">
              {user?.name?.[0]?.toUpperCase() || 'A'}
            </div>
            <div className="min-w-0 flex-1">
              <div className="text-xs font-bold text-white truncate">{user?.name || 'Administrator'}</div>
              <div className="text-[10px] text-slate-400 truncate">{user?.email || 'admin@printkoro.com'}</div>
            </div>
          </div>
          <button
            onClick={handleLogout}
            title="Sign Out"
            className="p-1.5 text-slate-400 hover:text-red-400 hover:bg-red-400/10 rounded-lg transition-colors ml-1"
          >
            <LogOut className="w-4 h-4" />
          </button>
        </div>
      </div>
    </aside>
  )
}
