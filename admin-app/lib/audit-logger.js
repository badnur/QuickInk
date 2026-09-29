import { supabase } from '@/lib/supabase'

// In-memory fallback ring buffer for recent audit logs (keeps last 100 entries)
const fallbackLogs = []

/**
 * Log an administrative action with actor identity, resource, and changes diff
 */
export async function logAdminAction({
  actorId = 'system',
  actorEmail = 'admin@printkoro.com',
  actorRole = 'superadmin',
  action,
  resourceType,
  resourceId = null,
  details = {},
  ip = '127.0.0.1',
}) {
  const logEntry = {
    id: `audit_${Date.now()}_${Math.random().toString(36).substring(2, 7)}`,
    actor_id: actorId,
    actor_email: actorEmail,
    actor_role: actorRole,
    action,
    resource_type: resourceType,
    resource_id: resourceId,
    details: typeof details === 'string' ? details : JSON.stringify(details),
    ip_address: ip,
    created_at: new Date().toISOString(),
  }

  // Prepend to in-memory ring buffer
  fallbackLogs.unshift(logEntry)
  if (fallbackLogs.length > 200) {
    fallbackLogs.pop()
  }

  // Persist to Supabase if admin_audit_logs table exists
  try {
    const { error } = await supabase.from('admin_audit_logs').insert([logEntry])
    if (error) {
      // Table might not exist yet, fallback in-memory is preserved
      console.warn('Persisting audit log to database notice:', error.message)
    }
  } catch (err) {
    // Non-blocking
  }

  return logEntry
}

/**
 * Retrieve recent audit logs
 */
export async function getRecentAuditLogs(limit = 50) {
  try {
    const { data, error } = await supabase
      .from('admin_audit_logs')
      .select('*')
      .order('created_at', { ascending: false })
      .limit(limit)

    if (!error && data && data.length > 0) {
      return data
    }
  } catch (err) {
    // Fall back to memory
  }

  return fallbackLogs.slice(0, limit)
}
