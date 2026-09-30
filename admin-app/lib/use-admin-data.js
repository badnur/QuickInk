'use client'

import { useState, useEffect, useCallback, useRef } from 'react'

// In-memory module cache (persists while navigating across client routes)
const memoryCache = new Map()

const SESSION_PREFIX = 'pk_swr_'
const MAX_STALE_MS = 5 * 60 * 1000 // 5 minutes stale allowed for instant display

export function getCachedData(key) {
  // 1. Check in-memory store (0ms)
  const mem = memoryCache.get(key)
  if (mem && mem.data !== undefined) {
    return mem.data
  }

  // 2. Check sessionStorage (0ms persistence across soft reloads / tab navigations)
  if (typeof window !== 'undefined') {
    try {
      const raw = sessionStorage.getItem(SESSION_PREFIX + key)
      if (raw) {
        const parsed = JSON.parse(raw)
        if (parsed && parsed.data !== undefined) {
          // Put back in memory store
          memoryCache.set(key, { data: parsed.data, timestamp: parsed.timestamp || Date.now() })
          return parsed.data
        }
      }
    } catch (e) {
      // Ignore quota or parsing errors
    }
  }

  return null
}

export function setCachedData(key, data) {
  const timestamp = Date.now()
  memoryCache.set(key, { data, timestamp })

  if (typeof window !== 'undefined') {
    try {
      sessionStorage.setItem(SESSION_PREFIX + key, JSON.stringify({ data, timestamp }))
    } catch (e) {
      // Storage might be full, fallback in memory is intact
    }
  }
}

export function clearCachedData(key) {
  if (!key) {
    memoryCache.clear()
    if (typeof window !== 'undefined') {
      try {
        Object.keys(sessionStorage).forEach((k) => {
          if (k.startsWith(SESSION_PREFIX)) sessionStorage.removeItem(k)
        })
      } catch (e) {}
    }
    return
  }

  memoryCache.delete(key)
  if (typeof window !== 'undefined') {
    try {
      sessionStorage.removeItem(SESSION_PREFIX + key)
    } catch (e) {}
  }
}

/**
 * Intelligent Stale-While-Revalidate Hook for Admin Pages
 * @param {string} key - Cache identifier (e.g. 'stats', 'devices', 'jobs')
 * @param {string} url - API URL to fetch
 * @param {object} options - Configuration options
 */
export function useAdminData(key, url, options = {}) {
  const {
    revalidateInterval = 45000, // Revalidate every 45s automatically
    revalidateOnMount = true,
    enabled = true,
  } = options

  const [data, setData] = useState(() => getCachedData(key))
  const [loading, setLoading] = useState(() => !getCachedData(key))
  const [refreshing, setRefreshing] = useState(false)
  const [error, setError] = useState(null)

  const isMountedRef = useRef(true)

  useEffect(() => {
    isMountedRef.current = true
    return () => {
      isMountedRef.current = false
    }
  }, [])

  const executeFetch = useCallback(async (isManual = false) => {
    if (!enabled || !url) return null

    if (isManual) setRefreshing(true)

    try {
      const fetchUrl = isManual
        ? `${url}${url.includes('?') ? '&' : '?'}refresh=true`
        : url

      const res = await fetch(fetchUrl, {
        headers: { Accept: 'application/json' },
      })

      if (!res.ok) {
        throw new Error(`Failed to load data (${res.status})`)
      }

      const json = await res.json()

      if (isMountedRef.current) {
        setCachedData(key, json)
        setData(json)
        setError(null)
      }

      return json
    } catch (err) {
      if (isMountedRef.current) {
        setError(err.message)
      }
      return null
    } finally {
      if (isMountedRef.current) {
        setLoading(false)
        if (isManual) setRefreshing(false)
      }
    }
  }, [key, url, enabled])

  // Initial revalidation / fetch
  useEffect(() => {
    if (!enabled) return

    const cached = getCachedData(key)
    if (cached) {
      setData(cached)
      setLoading(false)
    }

    if (revalidateOnMount || !cached) {
      executeFetch(false)
    }

    // Periodic background sync
    if (revalidateInterval > 0) {
      const timer = setInterval(() => {
        executeFetch(false)
      }, revalidateInterval)
      return () => clearInterval(timer)
    }
  }, [key, url, enabled, revalidateOnMount, revalidateInterval, executeFetch])

  const mutate = useCallback((updater, revalidate = false) => {
    let nextData
    if (typeof updater === 'function') {
      nextData = updater(getCachedData(key))
    } else {
      nextData = updater
    }

    setCachedData(key, nextData)
    setData(nextData)

    if (revalidate) {
      executeFetch(true)
    }
  }, [key, executeFetch])

  const refetch = useCallback(() => {
    return executeFetch(true)
  }, [executeFetch])

  return {
    data,
    loading,
    refreshing,
    error,
    mutate,
    refetch,
  }
}

/**
 * Prefetch a specific endpoint in the background without UI blocking
 */
export async function prefetchAdminData(key, url) {
  if (typeof window === 'undefined') return

  // If already fresh in memory (fetched within last 30s), skip network
  const existing = memoryCache.get(key)
  if (existing && Date.now() - existing.timestamp < 30000) {
    return
  }

  try {
    const res = await fetch(url, { headers: { Accept: 'application/json' } })
    if (res.ok) {
      const json = await res.json()
      setCachedData(key, json)
    }
  } catch (e) {
    // Non-blocking prefetch failure
  }
}

/**
 * Prefetches all key admin panels in background
 */
export function prefetchAllAdminData() {
  if (typeof window === 'undefined') return

  // Schedule during browser idle time so it doesn't block the main thread
  const runPrefetch = () => {
    const endpoints = [
      { key: 'admin_stats', url: '/api/admin/stats' },
      { key: 'admin_devices', url: '/api/admin/devices' },
      { key: 'admin_jobs_all_50', url: '/api/admin/jobs?status=all' },
      { key: 'admin_partners_all_all', url: '/api/admin/partners' },
      { key: 'admin_pricing_tiers', url: '/api/admin/pricing-tiers' },
      { key: 'admin_feedback_all_100', url: '/api/admin/feedback' },
    ]

    endpoints.forEach(({ key, url }, index) => {
      setTimeout(() => {
        prefetchAdminData(key, url)
      }, index * 200) // staggered by 200ms
    })
  }

  if ('requestIdleCallback' in window) {
    window.requestIdleCallback(runPrefetch, { timeout: 2000 })
  } else {
    setTimeout(runPrefetch, 500)
  }
}
