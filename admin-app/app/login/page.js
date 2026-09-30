'use client'

import { useState } from 'react'
import { useRouter } from 'next/navigation'
import Link from 'next/link'
import { authenticateAdmin } from '@/lib/admin-auth'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Card, CardContent } from '@/components/ui/card'
import { Lock, Mail, KeyRound, ShieldAlert, ArrowRight, CheckCircle2, Sparkles } from 'lucide-react'
import ThemeToggle from '@/components/admin/ThemeToggle'

export default function AdminLoginPage() {
  const [authMode, setAuthMode] = useState('pin') // 'pin' | 'password'
  const [pin, setPin] = useState('')
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [error, setError] = useState(null)
  const [loading, setLoading] = useState(false)

  const router = useRouter()

  const handleLogin = async (e) => {
    e.preventDefault()
    setError(null)
    setLoading(true)

    try {
      const res = await authenticateAdmin({
        pin: authMode === 'pin' ? pin : null,
        email: authMode === 'password' ? email : null,
        password: authMode === 'password' ? password : null,
      })

      if (res.success) {
        window.location.href = '/'
      } else {
        setError(res.error || 'Authentication failed. Please check your credentials.')
      }
    } catch (err) {
      setError(err.message || 'An unexpected error occurred during login')
    } finally {
      setLoading(false)
    }
  }

  const handleQuickDemoFill = () => {
    setAuthMode('pin')
    setPin('882314')
    setError(null)
  }

  return (
    <div className="min-h-screen bg-slate-50 dark:bg-black flex items-center justify-center p-4 relative transition-colors">
      {/* Top Bar with Theme Toggle */}
      <div className="absolute top-4 right-4 z-20">
        <ThemeToggle />
      </div>

      <div className="w-full max-w-md relative z-10">
        <div className="text-center mb-6">
          <div className="flex justify-center mb-4">
            <img 
              src="/images/printkoro-logo-dark.png" 
              alt="PrintKoro" 
              className="h-9 w-auto dark:filter-none filter brightness-0"
            />
          </div>
          <h1 className="text-2xl font-black text-slate-900 dark:text-white tracking-tight">PrintKoro Admin Portal</h1>
          <p className="text-xs text-slate-500 dark:text-slate-400 mt-1">
            Fleet Operations & Kiosk Station Management
          </p>
        </div>

        <Card className="bg-white dark:bg-[#0a0a0a] border border-slate-200 dark:border-slate-800 rounded-2xl shadow-xl p-6 transition-colors">
          <CardContent className="p-0">
            {/* Mode Switcher */}
            <div className="grid grid-cols-2 gap-1.5 p-1 bg-slate-100 dark:bg-slate-900 rounded-xl mb-5 border border-slate-200 dark:border-slate-800">
              <button
                type="button"
                onClick={() => { setAuthMode('pin'); setError(null) }}
                className={`py-2 text-xs font-bold rounded-lg transition-all flex items-center justify-center gap-1.5 ${
                  authMode === 'pin'
                    ? 'bg-[#00bf63] text-slate-950 shadow-xs'
                    : 'text-slate-600 dark:text-slate-400 hover:text-slate-900 dark:hover:text-white'
                }`}
              >
                <KeyRound className="w-3.5 h-3.5" /> Fast Access PIN
              </button>
              <button
                type="button"
                onClick={() => { setAuthMode('password'); setError(null) }}
                className={`py-2 text-xs font-bold rounded-lg transition-all flex items-center justify-center gap-1.5 ${
                  authMode === 'password'
                    ? 'bg-[#00bf63] text-slate-950 shadow-xs'
                    : 'text-slate-600 dark:text-slate-400 hover:text-slate-900 dark:hover:text-white'
                }`}
              >
                <Mail className="w-3.5 h-3.5" /> Email & Password
              </button>
            </div>

            {error && (
              <div className="mb-5 p-3 rounded-xl bg-red-50 dark:bg-red-500/10 border border-red-200 dark:border-red-500/20 text-red-600 dark:text-red-400 text-xs flex items-center gap-2">
                <ShieldAlert className="w-4 h-4 flex-shrink-0" />
                <span>{error}</span>
              </div>
            )}

            <form onSubmit={handleLogin} className="space-y-4">
              {authMode === 'pin' ? (
                <div>
                  <label className="block text-xs font-bold uppercase tracking-wider text-slate-700 dark:text-slate-300 mb-2">
                    Enter Master PIN
                  </label>
                  <div className="relative">
                    <KeyRound className="w-4 h-4 absolute left-3.5 top-1/2 -translate-y-1/2 text-slate-400" />
                    <Input
                      type="password"
                      maxLength={6}
                      value={pin}
                      onChange={(e) => setPin(e.target.value)}
                      placeholder="••••••"
                      className="bg-slate-50 dark:bg-slate-950 border-slate-200 dark:border-slate-800 pl-10 text-center tracking-widest text-lg font-mono text-slate-900 dark:text-white placeholder:text-slate-400 rounded-xl h-11"
                      required
                    />
                  </div>
                  <p className="text-[11px] text-slate-500 dark:text-slate-400 mt-2">
                    Direct access for authorized hardware maintenance & operations.
                  </p>

                  <div className="mt-4 p-3 bg-slate-50 dark:bg-slate-900/60 border border-slate-200 dark:border-slate-800 rounded-xl flex items-center justify-between">
                    <div>
                      <div className="text-[11px] font-bold text-slate-700 dark:text-slate-300">Quick Fill Credentials</div>
                      <div className="text-[10px] text-slate-500 dark:text-slate-400 font-mono">Master PIN: 882314</div>
                    </div>
                    <Button
                      type="button"
                      size="sm"
                      onClick={handleQuickDemoFill}
                      variant="outline"
                      className="bg-white dark:bg-slate-800 border-slate-200 dark:border-slate-700 text-slate-700 dark:text-slate-300 hover:text-slate-950 dark:hover:text-white text-[10px] h-7 px-2.5 rounded shadow-none"
                    >
                      Fill 882314
                    </Button>
                  </div>
                </div>
              ) : (
                <div className="space-y-3">
                  <div>
                    <label className="block text-xs font-bold uppercase tracking-wider text-slate-700 dark:text-slate-300 mb-1.5">
                      Administrator Email
                    </label>
                    <div className="relative">
                      <Mail className="w-4 h-4 absolute left-3.5 top-1/2 -translate-y-1/2 text-slate-400" />
                      <Input
                        type="email"
                        value={email}
                        onChange={(e) => setEmail(e.target.value)}
                        placeholder="admin@printkoro.com"
                        className="bg-slate-50 dark:bg-slate-950 border-slate-200 dark:border-slate-800 pl-10 text-xs text-slate-900 dark:text-white placeholder:text-slate-400 rounded-xl h-11"
                        required
                      />
                    </div>
                  </div>

                  <div>
                    <label className="block text-xs font-bold uppercase tracking-wider text-slate-700 dark:text-slate-300 mb-1.5">
                      Password
                    </label>
                    <div className="relative">
                      <Lock className="w-4 h-4 absolute left-3.5 top-1/2 -translate-y-1/2 text-slate-400" />
                      <Input
                        type="password"
                        value={password}
                        onChange={(e) => setPassword(e.target.value)}
                        placeholder="••••••••••••"
                        className="bg-slate-50 dark:bg-slate-950 border-slate-200 dark:border-slate-800 pl-10 text-xs text-slate-900 dark:text-white placeholder:text-slate-400 rounded-xl h-11"
                        required
                      />
                    </div>
                  </div>
                </div>
              )}

              <Button
                type="submit"
                disabled={loading}
                className="w-full bg-[#00bf63] hover:bg-[#00a656] text-slate-950 font-bold text-xs h-11 rounded-xl shadow-none mt-2 flex items-center justify-center gap-2"
              >
                {loading ? (
                  <span>Authenticating...</span>
                ) : (
                  <>
                    <span>Enter Admin Station</span>
                    <ArrowRight className="w-4 h-4" />
                  </>
                )}
              </Button>
            </form>

            <div className="mt-6 pt-5 border-t border-slate-200 dark:border-slate-800 text-center">
              <Link
                href="/"
                className="text-xs text-slate-500 dark:text-slate-400 hover:text-slate-900 dark:hover:text-white transition-colors"
              >
                ← Return to PrintKoro Customer Site
              </Link>
            </div>
          </CardContent>
        </Card>
      </div>
    </div>
  )
}
