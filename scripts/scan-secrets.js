#!/usr/bin/env node
/**
 * Secret Scanner for PrintKoro / QuickInk Codebase
 * Scans repository files for hardcoded credentials, API keys, tokens, and private keys.
 * In accordance with security guidelines, discovered secrets are ALWAYS redacted in output.
 */

const fs = require('fs')
const path = require('path')
const { execSync } = require('child_process')

const ROOT_DIR = path.resolve(__dirname, '..')

// Directories to ignore
const IGNORED_DIRS = new Set([
  'node_modules',
  '.git',
  '.next',
  'dist',
  'build',
  '.cache',
  'coverage',
  '.temp',
  'scratch'
])

// File extensions to scan
const SCANNED_EXTENSIONS = new Set([
  '.js', '.jsx', '.ts', '.tsx', '.mjs', '.cjs',
  '.json', '.sql', '.html', '.css',
  '.yml', '.yaml', '.md', '.cmd', '.sh', '.ps1'
])

// High-confidence regex patterns for sensitive credentials
const SECRET_PATTERNS = [
  {
    name: 'Private Key Block',
    regex: /-----BEGIN (?:RSA |EC |DSA |OPENSSH |PGP )?PRIVATE KEY-----/i,
  },
  {
    name: 'GitHub Token',
    regex: /(?:ghp_[a-zA-Z0-9]{36}|github_pat_[a-zA-Z0-9_]{50,85})/i,
  },
  {
    name: 'AWS Access Key ID',
    regex: /(?:A3T[A-Z0-9]|AKIA|AGPA|AIDA|AROA|AIPA|ANPA|ANVA|ASIA)[A-Z0-9]{16}/,
  },
  {
    name: 'Hardcoded Fallback JWT Secret',
    regex: /printkoro_superadmin_sec_[a-zA-Z0-9_]+/i,
  },
  {
    name: 'Hardcoded Master PIN Assignment',
    regex: /(?:ADMIN_MASTER_PIN\s*[:=]\s*['"]\d{4,8}['"]|cleanInputPin\s*===\s*['"]\d{4,8}['"])/i,
  },
  {
    name: 'Hardcoded SMS Gateway Key',
    regex: /SMS_API_KEY\s*[:=]\s*['"][a-f0-9]{20,}['"]/i,
  },
  {
    name: 'Generic Hardcoded Secret Assignment',
    regex: /(?:api_key|apiKey|secret_key|private_key|app_secret)\s*[:=]\s*['"][a-zA-Z0-9_\-]{24,}['"]/i,
  },
]

// Whitelisted safe patterns (public anon keys, schema seeds, mock placeholders)
const WHITELIST_PATTERNS = [
  /sb_publishable_[a-zA-Z0-9_\-]+/,
  /NEXT_PUBLIC_SUPABASE_ANON_KEY/,
  /NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY/,
  /crypt\('password123'/,
  /REDACTED/,
  /dev_local_secret_only/,
]

function isWhitelisted(content) {
  return WHITELIST_PATTERNS.some((p) => p.test(content))
}

function scanFile(filePath) {
  const relPath = path.relative(ROOT_DIR, filePath)
  let content = ''
  try {
    content = fs.readFileSync(filePath, 'utf8')
  } catch (err) {
    return []
  }

  const lines = content.split('\n')
  const findings = []

  lines.forEach((line, idx) => {
    // Skip comment-only documentation or whitelisted lines
    if (isWhitelisted(line)) return

    for (const pattern of SECRET_PATTERNS) {
      if (pattern.regex.test(line)) {
        findings.push({
          file: relPath,
          line: idx + 1,
          rule: pattern.name,
        })
      }
    }
  })

  return findings
}

function walkDirectory(dir, fileList = []) {
  const entries = fs.readdirSync(dir, { withFileTypes: true })
  for (const entry of entries) {
    const fullPath = path.join(dir, entry.name)
    if (entry.isDirectory()) {
      if (!IGNORED_DIRS.has(entry.name)) {
        walkDirectory(fullPath, fileList)
      }
    } else {
      const ext = path.extname(entry.name).toLowerCase()
      if (SCANNED_EXTENSIONS.has(ext) && entry.name !== 'scan-secrets.js') {
        fileList.push(fullPath)
      }
    }
  }
  return fileList
}

function checkGitTrackedEnvFiles() {
  try {
    const output = execSync('git ls-files "*.env*" "**/.env*"', {
      cwd: ROOT_DIR,
      encoding: 'utf8',
      stdio: ['pipe', 'pipe', 'ignore'],
    }).trim()

    if (output) {
      return output.split('\n').filter(Boolean)
    }
  } catch (e) {
    // Git not available or error running command
  }
  return []
}

function runScanner() {
  console.log('======================================================')
  console.log('🔍 PrintKoro Security Audit: Scanning Repository for Secrets')
  console.log('======================================================\n')

  // 1. Check for committed .env files
  const trackedEnvFiles = checkGitTrackedEnvFiles()
  let hasErrors = false

  if (trackedEnvFiles.length > 0) {
    console.error('❌ CRITICAL: Git-tracked environment files detected:')
    trackedEnvFiles.forEach((f) => console.error(`   - ${f}`))
    hasErrors = true
  } else {
    console.log('✅ Git tracking check passed: No .env files are tracked by git.')
  }

  // 2. Scan source files
  const allFiles = walkDirectory(ROOT_DIR)
  console.log(`🔎 Scanning ${allFiles.length} source files for hardcoded secrets...\n`)

  const allFindings = []
  for (const f of allFiles) {
    const findings = scanFile(f)
    if (findings.length > 0) {
      allFindings.push(...findings)
    }
  }

  if (allFindings.length > 0) {
    console.error('❌ Hardcoded secrets detected in source code (values redacted):')
    for (const finding of allFindings) {
      console.error(
        `   [SECURITY VIOLATION] ${finding.file}:${finding.line} -> Pattern: ${finding.rule} (Value: [REDACTED_SECRET])`
      )
    }
    hasErrors = true
  } else {
    console.log('✅ Source code scan passed: Zero hardcoded secrets detected.')
  }

  console.log('\n======================================================')
  if (hasErrors) {
    console.error('⚠️  Scan FAILED: Remediate secrets before deployment.')
    process.exit(1)
  } else {
    console.log('🛡️  Scan PASSED: All secrets safely separated into environment variables.')
    process.exit(0)
  }
}

runScanner()
