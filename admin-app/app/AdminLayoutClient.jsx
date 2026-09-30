'use client'

import { useState, useEffect, useRef } from 'react'
import { usePathname, useRouter } from 'next/navigation'
import { getAdminSession, verifyServerSession } from '@/lib/admin-auth'
import { supabase } from '@/lib/supabase'
import { prefetchAllAdminData } from '@/lib/use-admin-data'
import AdminSidebar from '@/components/admin/AdminSidebar'

export default function AdminLayoutClient({ children }) {
  // Optimistic initial session: if cached in localStorage, zero loading wait (0ms)
  const [adminUser, setAdminUser] = useState(() => getAdminSession())
  const [isLoading, setIsLoading] = useState(() => {
    if (typeof window === 'undefined') return false
    return !getAdminSession()
  })
  const [isRealtimeConnected, setIsRealtimeConnected] = useState(false)
  const [pendingJobsCount, setPendingJobsCount] = useState(0)
  const [isMobileMenuOpen, setIsMobileMenuOpen] = useState(false)

  const pathname = usePathname()
  const router = useRouter()
  const isLoginPage = pathname === '/login'
  const sessionCheckedRef = useRef(false)

  // Trigger background prefetch for all key data on app launch
  useEffect(() => {
    if (!isLoginPage && adminUser) {
      prefetchAllAdminData()
    }
  }, [isLoginPage, adminUser])

  // Verify server session once in background without blocking the UI
  useEffect(() => {
    if (isLoginPage) {
      setIsLoading(false)
      return
    }

    // If already verified this session, skip redundant network calls
    if (sessionCheckedRef.current) return
    sessionCheckedRef.current = true

    let isMounted = true
    async function verify() {
      try {
        const verified = await verifyServerSession()
        if (!isMounted) return
        if (verified) {
          setAdminUser(verified)
        } else if (!getAdminSession()) {
          router.push('/login')
        }
      } catch (e) {
        // Fallback to cached session
      } finally {
        if (isMounted) setIsLoading(false)
      }
    }

    verify()

    return () => {
      isMounted = false
    }
  }, [isLoginPage, router])

  // Single global background subscription for pending print jobs count
  useEffect(() => {
    if (isLoginPage) return

    let isMounted = true
    async function fetchPendingCount() {
      try {
        const { count } = await supabase
          .from('print_jobs')
          .select('id', { count: 'exact', head: true })
          .in('status', ['awaiting_redemption', 'redeemed'])
        if (isMounted) {
          setPendingJobsCount(count || 0)
          setIsRealtimeConnected(true)
        }
      } catch (e) {
        // Soft fallback
      }
    }

    fetchPendingCount()

    const channel = supabase
      .channel('admin_global_jobs')
      .on(
        'postgres_changes',
        { event: '*', schema: 'public', table: 'print_jobs' },
        () => {
          fetchPendingCount()
        }
      )
      .subscribe((status) => {
        if (status === 'SUBSCRIBED' && isMounted) {
          setIsRealtimeConnected(true)
        }
      })

    return () => {
      isMounted = false
      supabase.removeChannel(channel)
    }
  }, [isLoginPage])

  // Auto-close mobile menu on navigation
  useEffect(() => {
    setIsMobileMenuOpen(false)
  }, [pathname])

  if (isLoginPage) {
    return <div className="min-h-screen bg-slate-50 dark:bg-black">{children}</div>
  }

  // Only show blocking spinner if user has zero cached session (fresh browser window)
  if (isLoading && !adminUser) {
    return (
      <div className="min-h-screen bg-slate-50 dark:bg-black flex items-center justify-center text-slate-500 dark:text-slate-400 text-xs">
        <div className="flex flex-col items-center gap-2">
          <div className="w-5 h-5 rounded-full border-2 border-[#00bf63] border-t-transparent animate-spin" />
          <span>Opening Admin Portal...</span>
        </div>
      </div>
    )
  }

  return (
    <div className="min-h-screen bg-slate-50 dark:bg-black text-slate-900 dark:text-slate-100 flex flex-col md:flex-row antialiased transition-colors">
      {/* Desktop Sidebar */}
      <div className="hidden md:block flex-shrink-0">
        <AdminSidebar
          user={adminUser}
          isConnected={isRealtimeConnected}
          pendingJobsCount={pendingJobsCount}
        />
      </div>

      {/* Mobile Sidebar Overlay */}
      {isMobileMenuOpen && (
        <div className="fixed inset-0 z-50 md:hidden flex">
          <div
            className="fixed inset-0 bg-black/60"
            onClick={() => setIsMobileMenuOpen(false)}
          />
          <div className="relative z-10 w-64 bg-white dark:bg-black h-full border-r border-slate-200 dark:border-slate-800">
            <AdminSidebar
              user={adminUser}
              isConnected={isRealtimeConnected}
              pendingJobsCount={pendingJobsCount}
            />
          </div>
        </div>
      )}

      {/* Main Content Viewport */}
      <div className="flex-1 flex flex-col min-w-0 overflow-x-hidden">
        {children}
      </div>
    </div>
  )
}
