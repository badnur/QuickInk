'use client'

import { useState } from 'react'
import { useRouter } from 'next/navigation'
import Link from 'next/link'
import { authenticateAdmin } from '@/lib/admin-auth'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Card, CardContent } from '@/components/ui/card'
import { Lock, Mail, KeyRound, ShieldAlert, ArrowRight, CheckCircle2, Sparkles } from 'lucide-react'

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
        router.push('/')
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
    <div className="min-h-screen bg-[#090d16] flex items-center justify-center p-4 relative overflow-hidden">
      {/* Subtle Background Glows */}
      <div className="absolute top-1/4 left-1/2 -translate-x-1/2 -translate-y-1/2 w-96 h-96 bg-[#00bf63]/10 rounded-full blur-3xl pointer-events-none" />
      <div className="absolute bottom-10 right-10 w-72 h-72 bg-blue-500/5 rounded-full blur-3xl pointer-events-none" />

      <div className="w-full max-w-md relative z-10">
        <div className="text-center mb-6">
          <div className="w-14 h-14 rounded-2xl bg-[#00bf63]/15 border border-[#00bf63]/30 flex items-center justify-center text-[#00bf63] font-black text-2xl mx-auto mb-3 shadow-lg shadow-[#00bf63]/10">
            Q
          </div>
          <h1 className="text-2xl font-black text-white tracking-tight">QuickInk Admin Portal</h1>
          <p className="text-xs text-slate-400 mt-1">
            Fleet Operations & Kiosk Station Management
          </p>
        </div>

        <Card className="bg-[#0d131f]/90 border border-slate-800 backdrop-blur-xl rounded-2xl shadow-2xl p-6">
          <CardContent className="p-0">
            {/* Mode Switcher */}
            <div className="grid grid-cols-2 gap-1.5 p-1 bg-slate-900/80 rounded-xl mb-5 border border-slate-800">
              <button
                type="button"
                onClick={() => { setAuthMode('pin'); setError(null) }}
                className={`py-2 text-xs font-bold rounded-lg transition-all flex items-center justify-center gap-1.5 ${
                  authMode === 'pin'
                    ? 'bg-[#00bf63] text-slate-950 shadow-md'
                    : 'text-slate-400 hover:text-white'
                }`}
              >
                <KeyRound className="w-3.5 h-3.5" /> Fast Access PIN
              </button>
              <button
                type="button"
                onClick={() => { setAuthMode('password'); setError(null) }}
                className={`py-2 text-xs font-bold rounded-lg transition-all flex items-center justify-center gap-1.5 ${
                  authMode === 'password'
                    ? 'bg-[#00bf63] text-slate-950 shadow-md'
                    : 'text-slate-400 hover:text-white'
                }`}
              >
                <Mail className="w-3.5 h-3.5" /> Email & Password
              </button>
            </div>

            {error && (
              <div className="mb-4 p-3 rounded-xl bg-red-500/10 border border-red-500/20 text-red-400 text-xs flex items-center gap-2">
                <ShieldAlert className="w-4 h-4 flex-shrink-0" />
                <span>{error}</span>
              </div>
            )}

            <form onSubmit={handleLogin} className="space-y-4">
              {authMode === 'pin' ? (
                <div>
                  <label className="text-xs font-bold text-slate-300 block mb-1.5">
                    6-Digit Master Admin PIN
                  </label>
                  <div className="relative">
                    <KeyRound className="w-4 h-4 text-slate-500 absolute left-3.5 top-1/2 -translate-y-1/2" />
                    <Input
                      type="password"
                      maxLength={6}
                      placeholder="••••••"
                      value={pin}
                      onChange={(e) => setPin(e.target.value)}
                      className="pl-10 tracking-widest text-center text-lg font-bold bg-slate-900 border-slate-800 text-white placeholder:text-slate-600 focus-visible:border-[#00bf63] rounded-xl h-11 shadow-inner"
                      autoFocus
                    />
                  </div>
                  <div className="flex items-center justify-between mt-2">
                    <span className="text-[11px] text-slate-500">Master station key</span>
                    <button
                      type="button"
                      onClick={handleQuickDemoFill}
                      className="text-[11px] text-[#00bf63] hover:underline font-semibold flex items-center gap-1"
                    >
                      <Sparkles className="w-3 h-3" /> Auto-fill Demo PIN
                    </button>
                  </div>
                </div>
              ) : (
                <>
                  <div>
                    <label className="text-xs font-bold text-slate-300 block mb-1.5">Admin Email</label>
                    <div className="relative">
                      <Mail className="w-4 h-4 text-slate-500 absolute left-3.5 top-1/2 -translate-y-1/2" />
                      <Input
                        type="email"
                        placeholder="admin@quickink.com"
                        value={email}
                        onChange={(e) => setEmail(e.target.value)}
                        className="pl-10 text-xs bg-slate-900 border-slate-800 text-white placeholder:text-slate-600 focus-visible:border-[#00bf63] rounded-xl h-11 shadow-inner"
                        required
                      />
                    </div>
                  </div>

                  <div>
                    <label className="text-xs font-bold text-slate-300 block mb-1.5">Password</label>
                    <div className="relative">
                      <Lock className="w-4 h-4 text-slate-500 absolute left-3.5 top-1/2 -translate-y-1/2" />
                      <Input
                        type="password"
                        placeholder="••••••••"
                        value={password}
                        onChange={(e) => setPassword(e.target.value)}
                        className="pl-10 text-xs bg-slate-900 border-slate-800 text-white placeholder:text-slate-600 focus-visible:border-[#00bf63] rounded-xl h-11 shadow-inner"
                        required
                      />
                    </div>
                  </div>
                </>
              )}

              <Button
                type="submit"
                disabled={loading}
                className="w-full bg-[#00bf63] hover:bg-[#00a656] text-slate-950 font-bold text-sm h-11 rounded-xl shadow-lg shadow-[#00bf63]/20 flex items-center justify-center gap-2 mt-2"
              >
                {loading ? (
                  <div className="w-5 h-5 border-2 border-slate-950 border-t-transparent rounded-full animate-spin" />
                ) : (
                  <>
                    <span>Enter Admin Station</span>
                    <ArrowRight className="w-4 h-4" />
                  </>
                )}
              </Button>
            </form>

            <div className="mt-6 pt-5 border-t border-slate-800/80 text-center">
              <Link
                href="/"
                className="text-xs text-slate-400 hover:text-white transition-colors"
              >
                ← Return to QuickInk Customer Site
              </Link>
            </div>
          </CardContent>
        </Card>
      </div>
    </div>
  )
}
