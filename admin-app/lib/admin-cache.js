/**
 * Lightweight in-memory cache for fast Admin API responses.
 * Reduces redundant roundtrips to Supabase Cloud down to 0ms.
 */

const memoryCache = new Map()

export function getCache(key) {
  const item = memoryCache.get(key)
  if (!item) return null

  if (Date.now() > item.expiresAt) {
    memoryCache.delete(key)
    return null
  }

  return item.data
}

export function setCache(key, data, ttlSeconds = 10) {
  memoryCache.set(key, {
    data,
    expiresAt: Date.now() + ttlSeconds * 1000,
  })
}

export function invalidateCache(prefix) {
  if (!prefix) {
    memoryCache.clear()
    return
  }

  for (const key of memoryCache.keys()) {
    if (key.startsWith(prefix)) {
      memoryCache.delete(key)
    }
  }
}
