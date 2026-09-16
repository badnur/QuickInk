'use client'

import { useState, useEffect } from 'react'
import { usePathname, useRouter } from 'next/navigation'
import { getAdminSession } from '@/lib/admin-auth'
import { supabase } from '@/lib/supabase'
import AdminSidebar from '@/components/AdminSidebar'

export default function AdminLayoutClient({ children }) {
  const [adminUser, setAdminUser] = useState(null)
  const [isLoading, setIsLoading] = useState(true)
  const [isRealtimeConnected, setIsRealtimeConnected] = useState(false)
  const [pendingJobsCount, setPendingJobsCount] = useState(0)
  const [isMobileMenuOpen, setIsMobileMenuOpen] = useState(false)

  const pathname = usePathname()
  const router = useRouter()
  const isLoginPage = pathname === '/login'

  useEffect(() => {
    const session = getAdminSession()
    if (!session && !isLoginPage) {
      router.push('/login')
    } else {
      setAdminUser(session)
    }
    setIsLoading(false)
  }, [pathname, isLoginPage, router])

  useEffect(() => {
    if (isLoginPage) return

    async function fetchPendingCount() {
      try {
        const { count } = await supabase
          .from('print_jobs')
          .select('id', { count: 'exact', head: true })
          .in('status', ['awaiting_redemption', 'redeemed'])
        setPendingJobsCount(count || 0)
        setIsRealtimeConnected(true)
      } catch (e) {
        console.warn('Realtime count fetch notice:', e)
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
        if (status === 'SUBSCRIBED') {
          setIsRealtimeConnected(true)
        }
      })

    return () => {
      supabase.removeChannel(channel)
    }
  }, [isLoginPage])

  useEffect(() => {
    setIsMobileMenuOpen(false)
  }, [pathname])

  if (isLoginPage) {
    return <div className="min-h-screen bg-[#090d16]">{children}</div>
  }

  if (isLoading) {
    return (
      <div className="min-h-screen bg-[#090d16] flex items-center justify-center text-slate-400 text-xs font-semibold">
        <div className="flex flex-col items-center gap-3">
          <div className="w-8 h-8 rounded-xl border-2 border-[#00bf63] border-t-transparent animate-spin" />
          <span>Verifying QuickInk Admin Credentials...</span>
        </div>
      </div>
    )
  }

  return (
    <div className="min-h-screen bg-[#090d16] text-slate-100 flex flex-col md:flex-row antialiased">
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
            className="fixed inset-0 bg-black/70 backdrop-blur-xs"
            onClick={() => setIsMobileMenuOpen(false)}
          />
          <div className="relative z-10 w-64 bg-[#0d131f] h-full shadow-2xl">
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
