'use client'

import { useState, useEffect, useCallback } from 'react'
import { motion } from 'framer-motion'
import {
  ArrowLeft, LogOut, RefreshCw, ShieldCheck,
  Users, Heart, Briefcase, Building2, FileText,
  IndianRupee, Brain, Lock, TreePine, Megaphone,
  BarChart3,
} from 'lucide-react'
import { BandhanLogo } from '@/components/shared/BandhanLogo'
import { SahuSamajFlag } from '@/components/shared/SahuSamajFlag'
import { useTranslations } from '@/i18n'

type DashboardData = Record<string, Record<string, number>> | null

interface SuperAdminPanelProps {
  onBack: () => void
}

export function SuperAdminPanel({ onBack }: SuperAdminPanelProps) {
  const { t } = useTranslations()
  const sa = t.superAdmin

  const [token, setToken] = useState<string | null>(() => {
    if (typeof window === 'undefined') return null
    try {
      const saved = localStorage.getItem('bandhan-admin-session')
      return saved ? JSON.parse(saved).token : null
    } catch { return null }
  })

  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [loading, setLoading] = useState(false)
  const [authError, setAuthError] = useState('')
  const [dashboard, setDashboard] = useState<DashboardData>(null)
  const [dashLoading, setDashLoading] = useState(false)
  const [dashError, setDashError] = useState('')
  const [userName, setUserName] = useState('')

  const handleLogin = useCallback(async () => {
    if (!email || !password) {
      setAuthError('Email and password are required')
      return
    }
    setLoading(true)
    setAuthError('')
    try {
      const res = await fetch('/api/auth/login', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ email, password }),
      })
      const data = await res.json()
      if (!res.ok) {
        setAuthError(data.error || data.message || sa.loginError)
        return
      }
      if (data.data?.user?.roleName !== 'SUPER_ADMIN') {
        setAuthError(sa.notSuperAdmin)
        return
      }
      const session = data.data
      setToken(session.token)
      setUserName(session.user?.profile?.displayName || session.user?.email || 'Admin')
      localStorage.setItem('bandhan-admin-session', JSON.stringify(session))
    } catch {
      setAuthError('Network error. Please try again.')
    } finally {
      setLoading(false)
    }
  }, [email, password, sa])

  const fetchDashboard = useCallback(async () => {
    if (!token) return
    setDashLoading(true)
    setDashError('')
    try {
      const res = await fetch('/api/v1/admin/ops/dashboard', {
        headers: { Authorization: `Bearer ${token}` },
      })
      const data = await res.json()
      if (!res.ok) {
        setDashError(data.error || sa.error)
        if (res.status === 401 || res.status === 403) {
          setToken(null)
          localStorage.removeItem('bandhan-admin-session')
        }
        return
      }
      setDashboard(data.data)
    } catch {
      setDashError(sa.error)
    } finally {
      setDashLoading(false)
    }
  }, [token, sa])

  useEffect(() => {
    if (token) fetchDashboard()
  }, [token, fetchDashboard])

  const handleLogout = () => {
    setToken(null)
    setDashboard(null)
    setUserName('')
    localStorage.removeItem('bandhan-admin-session')
  }

  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === 'Enter' && !loading) handleLogin()
  }

  // LOGIN VIEW
  if (!token) {
    return (
      <div className="flex min-h-screen flex-col bg-ivory">
        <header className="sticky top-0 z-40 border-b border-border/40 bg-white/90 backdrop-blur-xl">
          <div className="mx-auto flex h-14 max-w-7xl items-center gap-3 px-4 sm:px-6 md:h-16">
            <button onClick={onBack} className="flex h-9 w-9 items-center justify-center rounded-xl transition-all hover:bg-cream">
              <ArrowLeft className="h-5 w-5 text-foreground" />
            </button>
            <BandhanLogo />
            <SahuSamajFlag size="sm" className="hidden sm:inline-flex" />
          </div>
        </header>

        <main className="flex flex-1 items-center justify-center px-4 py-12">
          <motion.div
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.5 }}
            className="w-full max-w-sm rounded-2xl border border-border/40 bg-white p-6 shadow-[0_1px_3px_rgba(0,0,0,0.02)] sm:p-8"
          >
            <div className="mb-6 flex items-center justify-center gap-3">
              <div className="flex h-12 w-12 items-center justify-center rounded-2xl bg-burgundy/10">
                <ShieldCheck className="h-6 w-6 text-burgundy" />
              </div>
            </div>

            <h1 className="text-center text-xl font-bold text-foreground font-serif">{sa.loginTitle}</h1>
            <p className="mt-1 text-center text-xs text-muted-foreground">{sa.loginSubtitle}</p>

            {authError && (
              <div className="mt-4 rounded-lg bg-red-50 px-3 py-2 text-xs font-medium text-red-600">{authError}</div>
            )}

            <div className="mt-5 space-y-3">
              <div>
                <label className="mb-1 block text-xs font-medium text-foreground">{sa.email}</label>
                <input
                  type="email" value={email} onChange={(e) => setEmail(e.target.value)}
                  onKeyDown={handleKeyDown}
                  placeholder="admin@bandhan.com"
                  className="h-11 w-full rounded-xl border border-border/60 bg-white px-4 text-sm text-foreground placeholder:text-muted-foreground/60 transition-all focus:border-burgundy/30 focus:outline-none focus:ring-2 focus:ring-burgundy/10"
                />
              </div>
              <div>
                <label className="mb-1 block text-xs font-medium text-foreground">{sa.password}</label>
                <input
                  type="password" value={password} onChange={(e) => setPassword(e.target.value)}
                  onKeyDown={handleKeyDown}
                  placeholder="............"
                  className="h-11 w-full rounded-xl border border-border/60 bg-white px-4 text-sm text-foreground placeholder:text-muted-foreground/60 transition-all focus:border-burgundy/30 focus:outline-none focus:ring-2 focus:ring-burgundy/10"
                />
              </div>
            </div>

            <button
              onClick={handleLogin} disabled={loading}
              className="btn-bandhan-primary mt-6 w-full text-sm disabled:opacity-50"
            >
              {loading ? sa.loggingIn : sa.login}
            </button>
          </motion.div>
        </main>
      </div>
    )
  }

  // DASHBOARD VIEW
  const d = dashboard
  return (
    <div className="flex min-h-screen flex-col bg-ivory">
      <header className="sticky top-0 z-40 border-b border-border/40 bg-white/90 backdrop-blur-xl">
        <div className="mx-auto flex h-14 max-w-7xl items-center justify-between px-4 sm:px-6 md:h-16">
          <div className="flex items-center gap-3">
            <button onClick={onBack} className="flex h-9 w-9 items-center justify-center rounded-xl transition-all hover:bg-cream">
              <ArrowLeft className="h-5 w-5 text-foreground" />
            </button>
            <BandhanLogo />
          </div>
          <div className="flex items-center gap-3">
            <span className="hidden text-xs font-medium text-muted-foreground sm:inline">{sa.welcome}{userName && ` — ${userName}`}</span>
            <button onClick={fetchDashboard} disabled={dashLoading} className="flex h-8 w-8 items-center justify-center rounded-lg transition-all hover:bg-cream" title={sa.refresh}>
              <RefreshCw className={`h-4 w-4 text-muted-foreground ${dashLoading ? 'animate-spin' : ''}`} />
            </button>
            <button onClick={handleLogout} className="flex h-8 items-center gap-1.5 rounded-lg px-3 text-xs font-medium text-red-500 transition-all hover:bg-red-50">
              <LogOut className="h-3.5 w-3.5" />{sa.logout}
            </button>
          </div>
        </div>
      </header>

      <main className="flex-1 px-4 py-6 sm:px-6">
        <div className="mx-auto max-w-7xl">
          <h1 className="mb-1 text-lg font-bold text-foreground sm:text-xl font-serif">{sa.dashboard}</h1>
          <p className="mb-6 text-xs text-muted-foreground">Bandhan Operations Center</p>

          {dashError && (
            <div className="mb-4 rounded-lg bg-red-50 px-3 py-2 text-xs font-medium text-red-600">{dashError}</div>
          )}

          {dashLoading && !d && (
            <div className="flex items-center gap-2 py-12 text-sm text-muted-foreground">
              <RefreshCw className="h-4 w-4 animate-spin" />{sa.loading}
            </div>
          )}

          {d && (
            <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} transition={{ duration: 0.4 }} className="space-y-5">
              {/* Quick Stats Row */}
              <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
                <StatCard icon={Users} label={sa.users} value={d.users?.total ?? 0} color="bg-burgundy/10" textColor="text-burgundy" />
                <StatCard icon={Heart} label={sa.matrimony} value={d.matrimony?.totalProfiles ?? 0} color="bg-pink-50" textColor="text-pink-600" />
                <StatCard icon={Briefcase} label={sa.business} value={d.business?.total ?? 0} color="bg-gold/10" textColor="text-gold-dark" />
                <StatCard icon={FileText} label={sa.jobs} value={d.jobs?.total ?? 0} color="bg-teal/10" textColor="text-teal" />
              </div>

              {/* Users Detail */}
              <Section title={sa.users} icon={Users}>
                <div className="grid grid-cols-2 gap-2 sm:grid-cols-4">
                  <Mini label={sa.active} value={d.users?.active ?? 0} good />
                  <Mini label={sa.pending} value={d.users?.pending ?? 0} warn />
                  <Mini label={sa.blocked} value={d.users?.blocked ?? 0} bad />
                  <Mini label={sa.premium} value={(d.users?.premium ?? 0) + (d.users?.elite ?? 0)} />
                </div>
              </Section>

              {/* Matrimony Detail */}
              <Section title={sa.matrimony} icon={Heart}>
                <div className="grid grid-cols-2 gap-2 sm:grid-cols-4">
                  <Mini label={sa.pending} value={d.matrimony?.pendingApproval ?? 0} warn />
                  <Mini label={sa.approved} value={d.matrimony?.approved ?? 0} good />
                  <Mini label={sa.rejected} value={d.matrimony?.rejected ?? 0} bad />
                  <Mini label={sa.featured} value={d.matrimony?.featured ?? 0} />
                </div>
                <div className="mt-2 grid grid-cols-2 gap-2">
                  <Mini label={sa.male} value={d.matrimony?.male ?? 0} />
                  <Mini label={sa.female} value={d.matrimony?.female ?? 0} />
                </div>
              </Section>

              {/* Business + Jobs + Directory row */}
              <div className="grid grid-cols-1 gap-4 md:grid-cols-3">
                <Section title={sa.business} icon={Briefcase}>
                  <div className="space-y-1.5">
                    <Mini label={sa.active} value={d.business?.active ?? 0} good />
                    <Mini label={sa.pending} value={d.business?.pending ?? 0} warn />
                    <Mini label={sa.verified} value={d.business?.verified ?? 0} />
                    <Mini label={sa.featured} value={d.business?.featured ?? 0} />
                  </div>
                </Section>

                <Section title={sa.jobs} icon={FileText}>
                  <div className="space-y-1.5">
                    <Mini label={sa.active} value={d.jobs?.active ?? 0} good />
                    <Mini label={sa.pending} value={d.jobs?.pending ?? 0} warn />
                    <Mini label={sa.applications} value={d.jobs?.totalApplications ?? 0} />
                    <Mini label={sa.employers} value={d.jobs?.employers ?? 0} />
                  </div>
                </Section>

                <Section title={sa.directory} icon={Building2}>
                  <div className="space-y-1.5">
                    <Mini label={sa.active} value={d.directory?.active ?? 0} good />
                    <Mini label={sa.pending} value={d.directory?.pending ?? 0} warn />
                    <Mini label={sa.verified} value={d.directory?.verified ?? 0} />
                    <Mini label={sa.featured} value={d.directory?.featured ?? 0} />
                  </div>
                </Section>
              </div>

              {/* Revenue + AI + Security row */}
              <div className="grid grid-cols-1 gap-4 md:grid-cols-3">
                <Section title={sa.revenue} icon={IndianRupee}>
                  <div className="space-y-1.5">
                    <Mini label={sa.totalRevenue} value={fmtCur(d.revenue?.totalRevenue ?? 0)} />
                    <Mini label={sa.successPayments} value={d.revenue?.successPayments ?? 0} good />
                    <Mini label={sa.pendingPayments} value={d.revenue?.pendingPayments ?? 0} warn />
                    <Mini label={sa.failedPayments} value={d.revenue?.failedPayments ?? 0} bad />
                  </div>
                </Section>

                <Section title={sa.ai} icon={Brain}>
                  <div className="space-y-1.5">
                    <Mini label={sa.requests} value={d.ai?.totalRequests ?? 0} />
                    <Mini label={sa.completed} value={d.ai?.completedRequests ?? 0} good />
                    <Mini label={sa.failed} value={d.ai?.failedRequests ?? 0} bad />
                    <Mini label={sa.activeProviders} value={d.ai?.activeProviders ?? 0} />
                  </div>
                </Section>

                <Section title={sa.security} icon={Lock}>
                  <div className="space-y-1.5">
                    <Mini label={sa.recentEvents} value={d.security?.recentSecurityEvents ?? 0} />
                    <Mini label={sa.criticalEvents} value={d.security?.criticalEvents ?? 0} bad />
                    <Mini label={sa.lockedUsers} value={d.security?.lockedUsers ?? 0} warn />
                    <Mini label={`${sa.reports} (${sa.pending})`} value={d.reports?.pending ?? 0} warn />
                  </div>
                </Section>
              </div>

              {/* Bottom row: Gotra + Ads + Reports */}
              <div className="grid grid-cols-1 gap-4 md:grid-cols-3">
                <Section title={sa.gotra} icon={TreePine}>
                  <div className="space-y-1.5">
                    <Mini label={sa.total} value={d.gotra?.total ?? 0} />
                    <Mini label={sa.active} value={d.gotra?.active ?? 0} good />
                  </div>
                </Section>

                <Section title={sa.ads} icon={Megaphone}>
                  <div className="space-y-1.5">
                    <Mini label={sa.active} value={d.advertisements?.activeCampaigns ?? 0} good />
                    <Mini label={sa.impressions} value={d.advertisements?.totalImpressions ?? 0} />
                    <Mini label={sa.clicks} value={d.advertisements?.totalClicks ?? 0} />
                  </div>
                </Section>

                <Section title={sa.reports} icon={BarChart3}>
                  <div className="space-y-1.5">
                    <Mini label={sa.pending} value={d.reports?.pending ?? 0} warn />
                    <Mini label={sa.reportsResolved} value={d.reports?.resolved ?? 0} good />
                    <Mini label={sa.rejected} value={d.reports?.dismissed ?? 0} />
                  </div>
                </Section>
              </div>
            </motion.div>
          )}
        </div>
      </main>
    </div>
  )
}

/* Sub-components */

function StatCard({ icon: Icon, label, value, color, textColor }: { icon: typeof Users; label: string; value: number; color: string; textColor: string }) {
  return (
    <div className="rounded-xl border border-border/40 bg-white p-3.5 transition-all hover:shadow-sm">
      <div className="flex items-center gap-2.5">
        <div className={`flex h-9 w-9 items-center justify-center rounded-lg ${color}`}>
          <Icon className={`h-4 w-4 ${textColor}`} />
        </div>
        <div>
          <p className={`text-lg font-bold ${textColor}`}>{typeof value === 'number' ? value.toLocaleString() : value}</p>
          <p className="text-[0.65rem] text-muted-foreground">{label}</p>
        </div>
      </div>
    </div>
  )
}

function Section({ title, icon: Icon, children }: { title: string; icon: typeof Users; children: React.ReactNode }) {
  return (
    <div className="rounded-xl border border-border/40 bg-white p-4">
      <div className="mb-3 flex items-center gap-2">
        <Icon className="h-4 w-4 text-burgundy" />
        <h3 className="text-sm font-bold text-foreground">{title}</h3>
      </div>
      {children}
    </div>
  )
}

function Mini({ label, value, good, warn, bad }: { label: string; value: number | string; good?: boolean; warn?: boolean; bad?: boolean }) {
  const colorClass = good ? 'text-emerald-600' : warn ? 'text-amber-600' : bad ? 'text-red-500' : 'text-foreground'
  return (
    <div className="flex items-center justify-between rounded-lg bg-ivory/60 px-3 py-2">
      <span className="text-xs text-muted-foreground">{label}</span>
      <span className={`text-sm font-semibold ${colorClass}`}>{typeof value === 'number' ? value.toLocaleString() : value}</span>
    </div>
  )
}

function fmtCur(amount: number): string {
  if (amount >= 100000) return `\u20b9${(amount / 100000).toFixed(1)}L`
  if (amount >= 1000) return `\u20b9${(amount / 1000).toFixed(1)}K`
  return `\u20b9${amount}`
}
