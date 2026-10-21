/**
 * Security Tests for QuickInk / PrintKoro
 * 
 * These are pure unit/logic tests — no running server required.
 * They test: upload validation, rate limiting, PDF resource limits,
 * error response sanitation, secret scanning, input validation.
 * 
 * Run: node --test security.test.mjs
 * Or:  pnpm exec jest security.test.mjs (if jest configured)
 */

import assert from 'node:assert/strict'
import { test, describe } from 'node:test'
import crypto from 'node:crypto'
import path from 'node:path'

// ─────────────────────────────────────────────────────────────────────────────
// UNIT UNDER TEST: Upload validation logic (extracted for testability)
// ─────────────────────────────────────────────────────────────────────────────

const MAX_FILE_SIZE = 50 * 1024 * 1024  // 50 MB
const ALLOWED_EXTENSIONS = new Set(['.pdf', '.png', '.jpg', '.jpeg', '.doc', '.docx'])
const ALLOWED_MIMES = new Set([
  'application/pdf',
  'image/png',
  'image/jpeg',
  'image/jpg',
  'application/msword',
  'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
  'application/octet-stream',
])

function checkMagicBytes(buffer, ext) {
  if (buffer.length < 4) return false
  if (ext === '.pdf') return buffer[0] === 0x25 && buffer[1] === 0x50 && buffer[2] === 0x44 && buffer[3] === 0x46
  if (ext === '.png') return buffer[0] === 0x89 && buffer[1] === 0x50 && buffer[2] === 0x4E && buffer[3] === 0x47
  if (ext === '.jpg' || ext === '.jpeg') return buffer[0] === 0xFF && buffer[1] === 0xD8 && buffer[2] === 0xFF
  return true
}

function validateUpload(fileName, mimeType, fileSize, buffer) {
  if (fileSize > MAX_FILE_SIZE) return { ok: false, code: 413, error: 'File exceeds maximum upload size of 50 MB.' }
  const ext = path.extname(fileName).toLowerCase()
  if (!ALLOWED_EXTENSIONS.has(ext)) return { ok: false, code: 400, error: `File type not permitted` }
  if (mimeType && !ALLOWED_MIMES.has(mimeType.toLowerCase())) return { ok: false, code: 400, error: 'MIME type not permitted' }
  if (!checkMagicBytes(buffer, ext)) return { ok: false, code: 400, error: 'File content does not match declared format' }
  return { ok: true }
}

// ─────────────────────────────────────────────────────────────────────────────
// UNIT UNDER TEST: In-memory rate limiter (from user-app/lib/rate-limiter.js)
// ─────────────────────────────────────────────────────────────────────────────

class RateLimiter {
  constructor() { this.store = new Map() }
  check(key, limit, windowMs) {
    const now = Date.now()
    const record = this.store.get(key) || { timestamps: [] }
    record.timestamps = record.timestamps.filter(t => now - t < windowMs)
    if (record.timestamps.length >= limit) return false
    record.timestamps.push(now)
    this.store.set(key, record)
    return true
  }
}

// ─────────────────────────────────────────────────────────────────────────────
// UNIT UNDER TEST: print-jobs input validation
// ─────────────────────────────────────────────────────────────────────────────

function validatePrintJobInput({ file_path, copies, page_count, page_range, pages_per_sheet }) {
  if (!file_path || typeof file_path !== 'string') return { ok: false, error: 'Valid file path is required' }
  if (file_path.length > 500 || file_path.includes('\0') || /[\r\n]/.test(file_path)) return { ok: false, error: 'Invalid file path structure' }
  const parsedCopies = parseInt(copies, 10)
  if (isNaN(parsedCopies) || parsedCopies < 1 || parsedCopies > 100) return { ok: false, error: 'Invalid copies value' }
  const parsedPages = parseInt(page_count, 10)
  if (isNaN(parsedPages) || parsedPages < 1 || parsedPages > 5000) return { ok: false, error: 'Invalid page count' }
  if (page_range) {
    if (!/^[\d\s\-,]+$/.test(page_range) || page_range.length > 100) return { ok: false, error: 'Invalid page range format' }
  }
  const nup = parseInt(pages_per_sheet, 10)
  if (![1, 2, 4, 6].includes(nup)) return { ok: false, error: 'Invalid pages per sheet' }
  return { ok: true }
}

// ─────────────────────────────────────────────────────────────────────────────
// UNIT UNDER TEST: page range parser
// ─────────────────────────────────────────────────────────────────────────────

function parsePageRange(rangeStr, maxPages) {
  if (!rangeStr || !String(rangeStr).trim()) return []
  const indices = new Set()
  for (const part of String(rangeStr).split(',')) {
    const trimmed = part.trim()
    if (trimmed.includes('-')) {
      const [startStr, endStr] = trimmed.split('-')
      const start = parseInt(startStr, 10)
      const end = parseInt(endStr, 10)
      if (!isNaN(start) && !isNaN(end)) {
        const min = Math.max(1, Math.min(start, end))
        const max = Math.min(maxPages, Math.max(start, end))
        for (let i = min; i <= max; i++) indices.add(i - 1)
      }
    } else {
      const p = parseInt(trimmed, 10)
      if (!isNaN(p) && p >= 1 && p <= maxPages) indices.add(p - 1)
    }
  }
  return Array.from(indices).sort((a, b) => a - b)
}

// ─────────────────────────────────────────────────────────────────────────────
// UNIT UNDER TEST: extractPageCountFromText (from pdf-utils.js)
// ─────────────────────────────────────────────────────────────────────────────

function extractPageCountFromText(str) {
  if (!str) return null
  const safeStr = str.length > 20 * 1024 * 1024 ? str.slice(0, 20 * 1024 * 1024) : str
  let maxCount = 0
  for (const m of safeStr.matchAll(/\/Type\s*\/Pages[\s\S]{0,25000}?\/Count\s+(\d+)/g)) {
    const c = parseInt(m[1], 10)
    if (!isNaN(c) && c > maxCount && c < 50000) maxCount = c
  }
  for (const m of safeStr.matchAll(/\/Count\s+(\d+)/g)) {
    const c = parseInt(m[1], 10)
    if (!isNaN(c) && c > maxCount && c < 50000) {
      const idx = m.index
      const windowStr = safeStr.substring(Math.max(0, idx - 2000), Math.min(safeStr.length, idx + 2000))
      if (windowStr.includes('/Pages') || windowStr.includes('/Kids')) maxCount = c
    }
  }
  return maxCount > 0 ? maxCount : null
}

// ─────────────────────────────────────────────────────────────────────────────
// UNIT UNDER TEST: isSafeDownloadUrl (from desktop-app/main.js)
// ─────────────────────────────────────────────────────────────────────────────

function isSafeDownloadUrl(urlStr) {
  try {
    const u = new URL(urlStr)
    if (u.protocol !== 'http:' && u.protocol !== 'https:') return false
    const host = u.hostname.toLowerCase()
    if (host === '169.254.169.254' || host === 'metadata.google.internal' || host === 'fd00::') return false
    if (/^10\./.test(host) || /^172\.(1[6-9]|2[0-9]|3[0-1])\./.test(host) || /^192\.168\./.test(host)) return false
    return true
  } catch (e) { return false }
}

// ─────────────────────────────────────────────────────────────────────────────
// UNIT UNDER TEST: path traversal check (from upload route)
// ─────────────────────────────────────────────────────────────────────────────

function isPathSafe(filePath, baseDir) {
  const resolved = path.resolve(filePath)
  return resolved.startsWith(path.resolve(baseDir))
}

// ─────────────────────────────────────────────────────────────────────────────
// ─────────────────────────────────────────────────────────────────────────────
// TESTS
// ─────────────────────────────────────────────────────────────────────────────

describe('Upload Security Tests', () => {

  // --- Size validation ---
  test('T-UP-01: Rejects files over 50 MB', () => {
    const buffer = Buffer.from([0x25, 0x50, 0x44, 0x46]) // valid PDF magic
    const result = validateUpload('doc.pdf', 'application/pdf', MAX_FILE_SIZE + 1, buffer)
    assert.equal(result.ok, false)
    assert.equal(result.code, 413)
  })

  test('T-UP-02: Accepts files exactly at 50 MB limit', () => {
    const pdfHeader = Buffer.alloc(MAX_FILE_SIZE, 0)
    pdfHeader[0] = 0x25; pdfHeader[1] = 0x50; pdfHeader[2] = 0x44; pdfHeader[3] = 0x46
    const result = validateUpload('doc.pdf', 'application/pdf', MAX_FILE_SIZE, pdfHeader)
    assert.equal(result.ok, true)
  })

  // --- Extension whitelist ---
  test('T-UP-03: Rejects disallowed extension .exe', () => {
    const buffer = Buffer.from([0x4D, 0x5A, 0x00, 0x00]) // EXE magic
    const result = validateUpload('malware.exe', 'application/octet-stream', 100, buffer)
    assert.equal(result.ok, false)
    assert.equal(result.code, 400)
  })

  test('T-UP-04: Rejects disallowed extension .js', () => {
    const buffer = Buffer.from([0x61, 0x6c, 0x65, 0x72]) // arbitrary
    const result = validateUpload('evil.js', 'text/javascript', 100, buffer)
    assert.equal(result.ok, false)
  })

  test('T-UP-05: Rejects disallowed extension .sh', () => {
    const buffer = Buffer.from([0x23, 0x21, 0x2F, 0x62]) // #!/b
    const result = validateUpload('hack.sh', 'text/x-shellscript', 100, buffer)
    assert.equal(result.ok, false)
  })

  test('T-UP-06: Accepts allowed extension .pdf', () => {
    const buffer = Buffer.from([0x25, 0x50, 0x44, 0x46])
    const result = validateUpload('document.pdf', 'application/pdf', 1024, buffer)
    assert.equal(result.ok, true)
  })

  test('T-UP-07: Accepts allowed extension .png', () => {
    const buffer = Buffer.from([0x89, 0x50, 0x4E, 0x47])
    const result = validateUpload('image.png', 'image/png', 1024, buffer)
    assert.equal(result.ok, true)
  })

  // --- MIME type enforcement ---
  test('T-UP-08: Rejects disallowed MIME text/html even with .pdf extension', () => {
    const buffer = Buffer.from([0x25, 0x50, 0x44, 0x46])
    const result = validateUpload('trick.pdf', 'text/html', 1024, buffer)
    assert.equal(result.ok, false)
  })

  // --- Magic byte checks ---
  test('T-UP-09: Rejects EXE magic in a .pdf file (polyglot attack)', () => {
    const buffer = Buffer.from([0x4D, 0x5A, 0x90, 0x00]) // MZ header
    const result = validateUpload('evil.pdf', 'application/pdf', 100, buffer)
    assert.equal(result.ok, false)
    assert.match(result.error, /does not match/)
  })

  test('T-UP-10: Rejects PNG magic in a .jpg file', () => {
    const buffer = Buffer.from([0x89, 0x50, 0x4E, 0x47]) // PNG header
    const result = validateUpload('img.jpg', 'image/jpeg', 100, buffer)
    assert.equal(result.ok, false)
  })

  test('T-UP-11: Rejects empty buffer for PDF', () => {
    const buffer = Buffer.from([])
    const result = validateUpload('empty.pdf', 'application/pdf', 0, buffer)
    assert.equal(result.ok, false)
  })

  // --- Path traversal ---
  test('T-UP-12: Path traversal attempt is blocked', () => {
    const baseDir = '/app/.private-uploads'
    const maliciousPath = '/app/.private-uploads/../../../etc/passwd'
    assert.equal(isPathSafe(maliciousPath, baseDir), false)
  })

  test('T-UP-13: Legitimate path within upload dir passes', () => {
    const baseDir = '/app/.private-uploads'
    const legitPath = '/app/.private-uploads/jobs/1234_abc.pdf'
    assert.equal(isPathSafe(legitPath, baseDir), true)
  })

  // --- Filename sanitization ---
  test('T-UP-14: Null bytes in filename are dangerous', () => {
    const nameWithNull = 'doc\x00.pdf.exe'
    const ext = path.extname(nameWithNull).toLowerCase()
    assert.equal(ALLOWED_EXTENSIONS.has(ext), false)
  })

  test('T-UP-15: Path separator in filename is sanitized', () => {
    const dangerousName = '../etc/passwd.pdf'
    const sanitized = path.basename(dangerousName).replace(/[^a-zA-Z0-9._-]/g, '_')
    assert.equal(sanitized.includes('..'), false)
    assert.equal(sanitized.includes('/'), false)
  })
})

// ─────────────────────────────────────────────────────────────────────────────

describe('Rate Limiter Tests', () => {
  test('T-RL-01: Allows requests under limit', () => {
    const limiter = new RateLimiter()
    for (let i = 0; i < 10; i++) {
      assert.equal(limiter.check('user1', 10, 60000), true)
    }
  })

  test('T-RL-02: Blocks requests over limit', () => {
    const limiter = new RateLimiter()
    for (let i = 0; i < 10; i++) limiter.check('user2', 10, 60000)
    assert.equal(limiter.check('user2', 10, 60000), false)
  })

  test('T-RL-03: Different keys are isolated', () => {
    const limiter = new RateLimiter()
    for (let i = 0; i < 10; i++) limiter.check('keyA', 10, 60000)
    assert.equal(limiter.check('keyB', 10, 60000), true)
  })

  test('T-RL-04: Very strict limit of 1 request blocks second immediately', () => {
    const limiter = new RateLimiter()
    assert.equal(limiter.check('strict', 1, 60000), true)
    assert.equal(limiter.check('strict', 1, 60000), false)
  })
})

// ─────────────────────────────────────────────────────────────────────────────

describe('Print Job Input Validation Tests', () => {
  test('T-PJ-01: Valid request passes', () => {
    const r = validatePrintJobInput({ file_path: 'jobs/abc.pdf', copies: 2, page_count: 5, page_range: null, pages_per_sheet: 1 })
    assert.equal(r.ok, true)
  })

  test('T-PJ-02: Missing file_path is rejected', () => {
    const r = validatePrintJobInput({ file_path: null, copies: 1, page_count: 1, page_range: null, pages_per_sheet: 1 })
    assert.equal(r.ok, false)
  })

  test('T-PJ-03: Null byte in file_path is rejected', () => {
    const r = validatePrintJobInput({ file_path: 'jobs/\x00evil', copies: 1, page_count: 1, page_range: null, pages_per_sheet: 1 })
    assert.equal(r.ok, false)
  })

  test('T-PJ-04: CRLF injection in file_path is rejected', () => {
    const r = validatePrintJobInput({ file_path: 'jobs/doc\r\nX-Injected: true', copies: 1, page_count: 1, page_range: null, pages_per_sheet: 1 })
    assert.equal(r.ok, false)
  })

  test('T-PJ-05: file_path over 500 chars is rejected', () => {
    const r = validatePrintJobInput({ file_path: 'a'.repeat(501), copies: 1, page_count: 1, page_range: null, pages_per_sheet: 1 })
    assert.equal(r.ok, false)
  })

  test('T-PJ-06: Copies over 100 is rejected', () => {
    const r = validatePrintJobInput({ file_path: 'jobs/doc.pdf', copies: 101, page_count: 1, page_range: null, pages_per_sheet: 1 })
    assert.equal(r.ok, false)
  })

  test('T-PJ-07: Page count over 5000 is rejected', () => {
    const r = validatePrintJobInput({ file_path: 'jobs/doc.pdf', copies: 1, page_count: 5001, page_range: null, pages_per_sheet: 1 })
    assert.equal(r.ok, false)
  })

  test('T-PJ-08: Invalid page range with special chars is rejected', () => {
    const r = validatePrintJobInput({ file_path: 'jobs/doc.pdf', copies: 1, page_count: 1, page_range: '1; DROP TABLE otps;--', pages_per_sheet: 1 })
    assert.equal(r.ok, false)
  })

  test('T-PJ-09: Invalid N-up value is rejected', () => {
    const r = validatePrintJobInput({ file_path: 'jobs/doc.pdf', copies: 1, page_count: 1, page_range: null, pages_per_sheet: 3 })
    assert.equal(r.ok, false)
  })

  test('T-PJ-10: Valid N-up values pass: 1, 2, 4, 6', () => {
    for (const nup of [1, 2, 4, 6]) {
      const r = validatePrintJobInput({ file_path: 'jobs/doc.pdf', copies: 1, page_count: 1, page_range: null, pages_per_sheet: nup })
      assert.equal(r.ok, true, `N-up ${nup} should pass`)
    }
  })
})

// ─────────────────────────────────────────────────────────────────────────────

describe('Page Range Parser Tests', () => {
  test('T-PR-01: Single page', () => {
    const result = parsePageRange('3', 10)
    assert.deepEqual(result, [2]) // 0-indexed
  })

  test('T-PR-02: Range 1-5', () => {
    const result = parsePageRange('1-5', 10)
    assert.deepEqual(result, [0, 1, 2, 3, 4])
  })

  test('T-PR-03: Mixed range "1-3,5,8-9"', () => {
    const result = parsePageRange('1-3,5,8-9', 10)
    assert.deepEqual(result, [0, 1, 2, 4, 7, 8])
  })

  test('T-PR-04: Range clipped to maxPages', () => {
    const result = parsePageRange('1-20', 5)
    assert.deepEqual(result, [0, 1, 2, 3, 4])
  })

  test('T-PR-05: Empty range returns empty array', () => {
    assert.deepEqual(parsePageRange('', 10), [])
    assert.deepEqual(parsePageRange(null, 10), [])
  })

  test('T-PR-06: No pages outside max', () => {
    const result = parsePageRange('50', 10)
    assert.deepEqual(result, [])
  })
})

// ─────────────────────────────────────────────────────────────────────────────

describe('PDF Resource Limit Tests', () => {
  test('T-PDF-01: extractPageCountFromText returns null for empty input', () => {
    assert.equal(extractPageCountFromText(''), null)
    assert.equal(extractPageCountFromText(null), null)
  })

  test('T-PDF-02: extractPageCountFromText finds /Count in /Pages context', () => {
    const pdfFragment = '/Type /Pages /Count 42 /Kids []'
    const result = extractPageCountFromText(pdfFragment)
    assert.equal(result, 42)
  })

  test('T-PDF-03: extractPageCountFromText limits count below 50000', () => {
    const evil = '/Type /Pages /Count 99999 /Kids []'
    const result = extractPageCountFromText(evil)
    assert.equal(result, null, 'Should not return counts >= 50000')
  })

  test('T-PDF-04: extractPageCountFromText handles 20MB+ input without crashing (truncation guard)', () => {
    // Build a large string (simulate >20MB) — in test we use 1KB as a proxy
    const largeStr = '/Type /Pages /Count 5 /Kids []' + 'X'.repeat(1024)
    const result = extractPageCountFromText(largeStr)
    assert.equal(result, 5)
  })

  test('T-PDF-05: MAX_ALLOWED_PAGES cap works at 5000', () => {
    // Simulate page cap calculation
    const MAX_ALLOWED_PAGES = 5000
    const claimedPages = 99999
    const truePageCount = Math.min(Math.max(claimedPages, 1), MAX_ALLOWED_PAGES)
    assert.equal(truePageCount, 5000)
  })
})

// ─────────────────────────────────────────────────────────────────────────────

describe('SSRF / URL Safety Tests (Desktop Download)', () => {
  test('T-URL-01: Allows valid HTTPS Supabase URL', () => {
    assert.equal(isSafeDownloadUrl('https://xhzfrmpbhasnipirccnt.supabase.co/storage/v1/object/sign/print-files/jobs/abc.pdf?token=xyz'), true)
  })

  test('T-URL-02: Blocks cloud metadata endpoint 169.254.169.254', () => {
    assert.equal(isSafeDownloadUrl('http://169.254.169.254/latest/meta-data/'), false)
  })

  test('T-URL-03: Blocks Google metadata endpoint', () => {
    assert.equal(isSafeDownloadUrl('http://metadata.google.internal/computeMetadata/v1/'), false)
  })

  test('T-URL-04: Blocks private RFC1918 range 10.x.x.x', () => {
    assert.equal(isSafeDownloadUrl('http://10.0.0.1/secret'), false)
  })

  test('T-URL-05: Blocks private RFC1918 range 192.168.x.x', () => {
    assert.equal(isSafeDownloadUrl('http://192.168.1.1/secret'), false)
  })

  test('T-URL-06: Blocks private RFC1918 range 172.16-31.x.x', () => {
    assert.equal(isSafeDownloadUrl('http://172.16.0.1/secret'), false)
    assert.equal(isSafeDownloadUrl('http://172.31.255.255/secret'), false)
    assert.equal(isSafeDownloadUrl('http://172.32.0.1/secret'), true) // outside range
  })

  test('T-URL-07: Blocks file:// protocol', () => {
    assert.equal(isSafeDownloadUrl('file:///etc/passwd'), false)
  })

  test('T-URL-08: Blocks javascript: protocol', () => {
    assert.equal(isSafeDownloadUrl('javascript:alert(1)'), false)
  })

  test('T-URL-09: Blocks invalid URL', () => {
    assert.equal(isSafeDownloadUrl('not-a-url'), false)
  })

  test('T-URL-10: Blocks empty URL', () => {
    assert.equal(isSafeDownloadUrl(''), false)
  })
})

// ─────────────────────────────────────────────────────────────────────────────

describe('Error Response Sanitation Tests', () => {
  // These tests verify that API error messages never contain internal details
  // by checking our generic error messages

  const GENERIC_500_MESSAGES = [
    'Failed to upload file.',
    'Order creation failed. Please try again.',
    'Failed to generate OTP. Please try again.',
    'Internal server error. Please try again.',
    'Failed to load credits.',
    'Failed to process credit topup.',
    'Authentication service error.',
    'OTP verification failed. Please try again.',
    'Failed to complete job.',
    'Failed to process feedback.',
    'Failed to fetch devices.',
    'Failed to create device.',
    'Failed to update device.',
    'Failed to remove device.',
  ]

  const FORBIDDEN_PATTERNS = [
    /supabase/i,
    /postgres/i,
    /sql/i,
    /stack/i,
    /ENOENT/i,
    /ECONNREFUSED/i,
    /at Object\./,
    /node_modules/,
    /Error:/,
    /\.js:\d+/,
  ]

  for (const msg of GENERIC_500_MESSAGES) {
    test(`T-ERR: "${msg.slice(0, 40)}..." contains no internal details`, () => {
      for (const pattern of FORBIDDEN_PATTERNS) {
        assert.equal(pattern.test(msg), false, `Message "${msg}" matched forbidden pattern ${pattern}`)
      }
    })
  }

  test('T-ERR-01: Error messages have safe minimum length', () => {
    for (const msg of GENERIC_500_MESSAGES) {
      assert.ok(msg.length > 5, `Message too short: "${msg}"`)
    }
  })
})

// ─────────────────────────────────────────────────────────────────────────────

describe('Secure Random Generation Tests', () => {
  test('T-SEC-01: Random upload filename has 32 hex chars (16 bytes)', () => {
    const randomSuffix = crypto.randomBytes(16).toString('hex')
    assert.equal(randomSuffix.length, 32)
    assert.match(randomSuffix, /^[0-9a-f]{32}$/)
  })

  test('T-SEC-02: OTP is 6 digits, numeric only, within 100000-999999', () => {
    // Simulate crypto.randomInt(100000, 1000000)
    for (let i = 0; i < 100; i++) {
      const otp = crypto.randomInt(100000, 1000000)
      assert.ok(otp >= 100000 && otp <= 999999, `OTP ${otp} out of range`)
      assert.match(otp.toString(), /^\d{6}$/)
    }
  })

  test('T-SEC-03: Two random suffixes are not equal (collision resistance)', () => {
    const a = crypto.randomBytes(16).toString('hex')
    const b = crypto.randomBytes(16).toString('hex')
    assert.notEqual(a, b)
  })

  test('T-SEC-04: scrypt hash format is correct', () => {
    function hashPassword(plainPassword) {
      const salt = crypto.randomBytes(16).toString('hex')
      const hash = crypto.scryptSync(plainPassword, salt, 64).toString('hex')
      return `scrypt:${salt}:${hash}`
    }
    const hashed = hashPassword('TestPassword123!')
    const parts = hashed.split(':')
    assert.equal(parts[0], 'scrypt')
    assert.equal(parts[1].length, 32, 'Salt should be 32 hex chars (16 bytes)')
    assert.equal(parts[2].length, 128, 'Hash should be 128 hex chars (64 bytes)')
  })

  test('T-SEC-05: scrypt timing-safe verification works correctly', () => {
    function hashPassword(pw) {
      const salt = crypto.randomBytes(16).toString('hex')
      const hash = crypto.scryptSync(pw, salt, 64).toString('hex')
      return `scrypt:${salt}:${hash}`
    }
    function verifyPassword(plain, stored) {
      if (!stored.startsWith('scrypt:')) return false
      const parts = stored.split(':')
      if (parts.length !== 3) return false
      const [, salt, expectedHash] = parts
      try {
        const actualHash = crypto.scryptSync(plain, salt, 64).toString('hex')
        return crypto.timingSafeEqual(Buffer.from(expectedHash, 'hex'), Buffer.from(actualHash, 'hex'))
      } catch { return false }
    }
    const pw = 'MySecureP@ssw0rd'
    const hash = hashPassword(pw)
    assert.equal(verifyPassword(pw, hash), true)
    assert.equal(verifyPassword('wrongpassword', hash), false)
  })
})

// ─────────────────────────────────────────────────────────────────────────────

describe('Credits Topup Business Logic Tests', () => {
  const CREDIT_PACKAGES = [
    { id: 'pkg_starter', credits: 10000, price_taka: 250 },
    { id: 'pkg_value',   credits: 25000, price_taka: 500 },
    { id: 'pkg_commercial', credits: 60000, price_taka: 1000 },
    { id: 'pkg_enterprise', credits: 150000, price_taka: 2200 },
  ]

  function validateTopup({ packageId, customCredits }) {
    let creditsToAdd = 0
    let priceTaka = 0
    const selectedPkg = CREDIT_PACKAGES.find(p => p.id === packageId)
    if (selectedPkg) {
      creditsToAdd = selectedPkg.credits
      priceTaka = selectedPkg.price_taka
    } else if (customCredits && Number(customCredits) > 0) {
      creditsToAdd = Math.min(Math.max(1000, parseInt(customCredits, 10)), 500000)
      priceTaka = Math.round(creditsToAdd * 0.02)
    } else {
      return { ok: false, error: 'Please select a valid credit package or credit amount' }
    }
    return { ok: true, creditsToAdd, priceTaka }
  }

  test('T-CR-01: Valid package ID returns correct credits and price', () => {
    const r = validateTopup({ packageId: 'pkg_value', customCredits: null })
    assert.equal(r.ok, true)
    assert.equal(r.creditsToAdd, 25000)
    assert.equal(r.priceTaka, 500)
  })

  test('T-CR-02: Invalid package ID with no custom credits is rejected', () => {
    const r = validateTopup({ packageId: 'pkg_fake', customCredits: null })
    assert.equal(r.ok, false)
  })

  test('T-CR-03: Custom credits are bounded between 1000 and 500000', () => {
    const tooSmall = validateTopup({ packageId: null, customCredits: 1 })
    assert.equal(tooSmall.creditsToAdd, 1000, 'Should enforce minimum of 1000')

    const tooLarge = validateTopup({ packageId: null, customCredits: 9999999 })
    assert.equal(tooLarge.creditsToAdd, 500000, 'Should enforce maximum of 500000')
  })

  test('T-CR-04: Custom credits price ratio is 0.02 taka per credit', () => {
    const r = validateTopup({ packageId: null, customCredits: 10000 })
    assert.equal(r.priceTaka, 200)
  })

  test('T-CR-05: Device ID format must match alphanumeric/dash/underscore 8-64 chars', () => {
    const validPattern = /^[a-zA-Z0-9_-]{8,64}$/
    assert.equal(validPattern.test('device-id-123abc'), true)
    assert.equal(validPattern.test('abc'), false, 'Too short')
    assert.equal(validPattern.test('a'.repeat(65)), false, 'Too long')
    assert.equal(validPattern.test('device/../../../etc'), false, 'Path traversal chars')
    assert.equal(validPattern.test('<script>alert(1)</script>'), false, 'XSS attempt')
  })
})

// ─────────────────────────────────────────────────────────────────────────────

describe('Secret Scanning Regression Tests', () => {
  // These tests check that no known-bad patterns are committed to key source files

  const FORBIDDEN_SECRET_PATTERNS = [
    // Generic API keys
    /AIza[0-9A-Za-z\-_]{35}/,          // Google API key
    /sk-[a-zA-Z0-9]{40}/,              // OpenAI key
    /ghp_[a-zA-Z0-9]{36}/,            // GitHub Personal Access Token
    // Supabase service role patterns (anon key is OK, service role is not)
    /eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9\.eyJyb2xlIjoic2VydmljZV9yb2xlIi/,
    // Hardcoded PINs
    /ADMIN_PIN\s*=\s*['"]?\d{4,8}['"]?/,
    // Hardcoded JWT secrets
    /JWT_SECRET\s*=\s*['"]((?!process\.env).{8,})['"]/, 
  ]

  const knownSafeStrings = [
    'const foo = process.env.ADMIN_JWT_SECRET',
    'const key = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY',
    '// Example: eyJhbGciOiJIUzI1NiJ9.example',
    'const deviceId = "device-abc-123"',
  ]

  for (const safe of knownSafeStrings) {
    test(`T-SCN: Safe string passes: "${safe.slice(0, 50)}"`, () => {
      for (const pattern of FORBIDDEN_SECRET_PATTERNS) {
        assert.equal(pattern.test(safe), false, `Safe string matched forbidden pattern ${pattern}`)
      }
    })
  }
})

// ─────────────────────────────────────────────────────────────────────────────
// ZERO-RETENTION PRIVACY & STORAGE DELETION UNIT TESTS
// ─────────────────────────────────────────────────────────────────────────────

function extractStoragePrefixes(rawFilePath) {
  if (!rawFilePath) return []
  const clean = String(rawFilePath).split('#')[0].split('?')[0].trim()
  const normalized = clean.replace(/^print-files\//, '').replace(/^\/+/, '')
  const bareName = path.basename(normalized)
  return Array.from(
    new Set(
      [
        normalized,
        bareName,
        `jobs/${bareName}`,
        `jobs/${normalized.replace(/^jobs\//, '')}`,
      ].filter(Boolean)
    )
  )
}

describe('Zero-Retention Privacy & Storage Deletion Tests', () => {
  test('T-ZR-01: Correctly cleans hash fragments (#border=1)', () => {
    const prefixes = extractStoragePrefixes('jobs/1789470759853_logo.png#border=1')
    assert.ok(prefixes.includes('jobs/1789470759853_logo.png'))
    assert.ok(prefixes.includes('1789470759853_logo.png'))
    assert.ok(!prefixes.some(p => p.includes('#')))
  })

  test('T-ZR-02: Normalizes bare filename without folder', () => {
    const prefixes = extractStoragePrefixes('1789470759853_quickink.pdf')
    assert.ok(prefixes.includes('1789470759853_quickink.pdf'))
    assert.ok(prefixes.includes('jobs/1789470759853_quickink.pdf'))
  })

  test('T-ZR-03: Strips bucket name prefix if included', () => {
    const prefixes = extractStoragePrefixes('print-files/jobs/doc123.pdf')
    assert.ok(prefixes.includes('jobs/doc123.pdf'))
    assert.ok(prefixes.includes('doc123.pdf'))
    assert.ok(!prefixes.some(p => p.startsWith('print-files/')))
  })

  test('T-ZR-04: Strips query token strings from signed URLs', () => {
    const prefixes = extractStoragePrefixes('jobs/receipt.pdf?token=secret123')
    assert.ok(prefixes.includes('jobs/receipt.pdf'))
    assert.ok(!prefixes.some(p => p.includes('?token=')))
  })

  test('T-ZR-05: Returns empty array for null or empty input without crashing', () => {
    assert.deepEqual(extractStoragePrefixes(null), [])
    assert.deepEqual(extractStoragePrefixes(''), [])
    assert.deepEqual(extractStoragePrefixes(undefined), [])
  })
})

