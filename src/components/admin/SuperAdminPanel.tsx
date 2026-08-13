'use client'

import { useState, useEffect, useCallback } from 'react'
import { motion, AnimatePresence } from 'framer-motion'
import {
  ArrowLeft, LogOut, RefreshCw, ShieldCheck, LayoutDashboard,
  Users, Megaphone, Gift, Crown, Settings, Search, Plus, Trash2, Edit3,
  Eye, EyeOff, Check, X, AlertTriangle, ChevronDown,
  Heart, Briefcase, FileText, IndianRupee, Brain, Lock, TreePine, BarChart3,
} from 'lucide-react'
import { BandhanLogo } from '@/components/shared/BandhanLogo'
import { SahuSamajFlag } from '@/components/shared/SahuSamajFlag'
import { useTranslations } from '@/i18n'

type TabId = 'dashboard' | 'users' | 'advertisements' | 'offers' | 'membership' | 'settings'

const TABS: TabId[] = ['dashboard', 'users', 'advertisements', 'offers', 'membership', 'settings']

interface TabDef { id: TabId; icon: typeof Users; labelKey: string }

export function SuperAdminPanel({ onBack }: { onBack: () => void }) {
  const { t } = useTranslations()
  const sa = t.superAdmin

  const [token, setToken] = useState<string | null>(() => {
    if (typeof window === 'undefined') return null
    try { const s = localStorage.getItem('bandhan-admin-session'); return s ? JSON.parse(s).token : null } catch { return null }
  })
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [loading, setLoading] = useState(false)
  const [authError, setAuthError] = useState('')
  const [tab, setTab] = useState<TabId>('dashboard')
  const [dash, setDash] = useState<Record<string, Record<string, number>> | null>(null)
  const [dashLoading, setDashLoading] = useState(false)
  const [userName, setUserName] = useState('')
  const [toast, setToast] = useState('')

  const showToast = useCallback((msg: string) => { setToast(msg); setTimeout(() => setToast(''), 3000) }, [])

  const handleLogin = useCallback(async () => {
    if (!email || !password) { setAuthError('Email and password are required'); return }
    setLoading(true); setAuthError('')
    try {
      const r = await fetch('/api/auth/login', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ email, password }) })
      const d = await r.json()
      if (!r.ok) { setAuthError(d.error || d.message || sa.loginError); return }
      if (d.data?.user?.roleName !== 'SUPER_ADMIN') { setAuthError(sa.notSuperAdmin); return }
      setToken(d.data.token); setUserName(d.data.user?.profile?.displayName || d.data.user?.email || 'Admin')
      localStorage.setItem('bandhan-admin-session', JSON.stringify(d.data))
    } catch { setAuthError('Network error') } finally { setLoading(false) }
  }, [email, password, sa])

  const api = useCallback(async (url: string, opts?: RequestInit) => {
    if (!token) return null
    const r = await fetch(url, { ...opts, headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${token}`, ...(opts?.headers as Record<string, string>) } })
    const d = await r.json()
    if (r.status === 401 || r.status === 403) { setToken(null); localStorage.removeItem('bandhan-admin-session'); return null }
    return d
  }, [token])

  const fetchDash = useCallback(async () => {
    if (!token) return
    setDashLoading(true)
    const d = await api('/api/v1/admin/ops/dashboard')
    if (d?.data) setDash(d.data)
    setDashLoading(false)
  }, [token, api])

  useEffect(() => { if (token) fetchDash() }, [token, fetchDash])
  useEffect(() => { if (token && tab === 'dashboard') fetchDash() }, [tab, token, fetchDash])

  const logout = () => { setToken(null); setDash(null); setUserName(''); localStorage.removeItem('bandhan-admin-session'); setTab('dashboard') }
  const switchTab = (t: TabId) => { setTab(t); setDash(null) }

  const tabDefs: TabDef[] = [
    { id: 'dashboard', icon: LayoutDashboard, labelKey: sa.dashboard },
    { id: 'users', icon: Users, labelKey: sa.users },
    { id: 'advertisements', icon: Megaphone, labelKey: sa.advertisements },
    { id: 'offers', icon: Gift, labelKey: sa.offers },
    { id: 'membership', icon: Crown, labelKey: sa.membership },
    { id: 'settings', icon: Settings, labelKey: sa.settings },
  ]

  // ─── LOGIN ───
  if (!token) return (
    <div className="flex min-h-screen flex-col bg-ivory">
      <header className="sticky top-0 z-40 border-b border-border/40 bg-white/90 backdrop-blur-xl">
        <div className="mx-auto flex h-14 max-w-7xl items-center gap-3 px-4 sm:px-6 md:h-16">
          <button onClick={onBack} className="flex h-9 w-9 items-center justify-center rounded-xl transition-all hover:bg-cream"><ArrowLeft className="h-5 w-5 text-foreground" /></button>
          <BandhanLogo /><SahuSamajFlag size="sm" className="hidden sm:inline-flex" />
        </div>
      </header>
      <main className="flex flex-1 items-center justify-center px-4 py-12">
        <motion.div initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }} transition={{ duration: 0.5 }} className="w-full max-w-sm rounded-2xl border border-border/40 bg-white p-6 shadow-sm sm:p-8">
          <div className="mb-6 flex justify-center"><div className="flex h-12 w-12 items-center justify-center rounded-2xl bg-burgundy/10"><ShieldCheck className="h-6 w-6 text-burgundy" /></div></div>
          <h1 className="text-center text-xl font-bold text-foreground font-serif">{sa.loginTitle}</h1>
          <p className="mt-1 text-center text-xs text-muted-foreground">{sa.loginSubtitle}</p>
          {authError && <div className="mt-4 rounded-lg bg-red-50 px-3 py-2 text-xs font-medium text-red-600">{authError}</div>}
          <div className="mt-5 space-y-3">
            <div><label className="mb-1 block text-xs font-medium text-foreground">{sa.email}</label><input type="email" value={email} onChange={e => setEmail(e.target.value)} onKeyDown={e => e.key === 'Enter' && !loading && handleLogin()} placeholder="admin@bandhan.com" className="h-11 w-full rounded-xl border border-border/60 bg-white px-4 text-sm text-foreground placeholder:text-muted-foreground/60 transition-all focus:border-burgundy/30 focus:outline-none focus:ring-2 focus:ring-burgundy/10" /></div>
            <div><label className="mb-1 block text-xs font-medium text-foreground">{sa.password}</label><input type="password" value={password} onChange={e => setPassword(e.target.value)} onKeyDown={e => e.key === 'Enter' && !loading && handleLogin()} placeholder="............" className="h-11 w-full rounded-xl border border-border/60 bg-white px-4 text-sm text-foreground placeholder:text-muted-foreground/60 transition-all focus:border-burgundy/30 focus:outline-none focus:ring-2 focus:ring-burgundy/10" /></div>
          </div>
          <button onClick={handleLogin} disabled={loading} className="btn-bandhan-primary mt-6 w-full text-sm disabled:opacity-50">{loading ? sa.loggingIn : sa.login}</button>
        </motion.div>
      </main>
    </div>
  )

  // ─── ADMIN PANEL ───
  return (
    <div className="flex min-h-screen flex-col bg-ivory">
      {/* Header */}
      <header className="sticky top-0 z-40 border-b border-border/40 bg-white/90 backdrop-blur-xl">
        <div className="mx-auto flex h-14 max-w-7xl items-center justify-between px-4 sm:px-6 md:h-16">
          <div className="flex items-center gap-3">
            <button onClick={onBack} className="flex h-9 w-9 items-center justify-center rounded-xl transition-all hover:bg-cream"><ArrowLeft className="h-5 w-5 text-foreground" /></button>
            <BandhanLogo />
          </div>
          <div className="flex items-center gap-2">
            <span className="hidden text-xs font-medium text-muted-foreground sm:inline">{userName}</span>
            <button onClick={logout} className="flex h-8 items-center gap-1.5 rounded-lg px-3 text-xs font-medium text-red-500 transition-all hover:bg-red-50"><LogOut className="h-3.5 w-3.5" />{sa.logout}</button>
          </div>
        </div>
        {/* Tab bar */}
        <div className="mx-auto max-w-7xl px-4 sm:px-6 lg:px-8">
          <div className="flex gap-1 overflow-x-auto border-b border-border/20 pb-px -mb-px scrollbar-hide">
            {tabDefs.map(t => <button key={t.id} onClick={() => switchTab(t.id)} className={`flex items-center gap-1.5 whitespace-nowrap border-b-2 px-3 py-2.5 text-xs font-medium transition-all ${tab === t.id ? 'border-burgundy text-burgundy' : 'border-transparent text-muted-foreground hover:text-foreground'}`}><t.icon className="h-3.5 w-3.5" />{t.labelKey}</button>)}
          </div>
        </div>
      </header>

      <main className="flex-1 px-4 py-6 sm:px-6">
        <div className="mx-auto max-w-7xl">
          {tab === 'dashboard' && <DashboardTab sa={sa} dash={dash} dashLoading={dashLoading} fetchDash={fetchDash} />}
          {tab === 'users' && <UsersTab sa={sa} api={api} showToast={showToast} />}
          {tab === 'advertisements' && <AdsTab sa={sa} api={api} showToast={showToast} />}
          {tab === 'offers' && <OffersTab sa={sa} api={api} showToast={showToast} />}
          {tab === 'membership' && <MembershipTab sa={sa} api={api} showToast={showToast} />}
          {tab === 'settings' && <SettingsTab sa={sa} api={api} token={token} showToast={showToast} />}
        </div>
      </main>

      {/* Toast */}
      <AnimatePresence>
        {toast && <motion.div initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0 }} className="fixed bottom-6 right-6 z-50 rounded-xl bg-emerald-600 px-4 py-2.5 text-xs font-medium text-white shadow-lg">{toast}</motion.div>}
      </AnimatePresence>
    </div>
  )
}

/* ═══════════ DASHBOARD TAB ═══════════ */
function DashboardTab({ sa, dash, dashLoading, fetchDash }: { sa: Record<string, string>; dash: Record<string, Record<string, number>> | null; dashLoading: boolean; fetchDash: () => void }) {
  const d = dash
  return (
    <div>
      <div className="mb-4 flex items-center justify-between">
        <div><h1 className="text-lg font-bold text-foreground font-serif">{sa.dashboard}</h1><p className="text-xs text-muted-foreground">Bandhan Operations Center</p></div>
        <button onClick={fetchDash} className="flex h-8 items-center gap-1.5 rounded-lg border border-border/40 px-3 text-xs font-medium text-foreground transition-all hover:bg-white"><RefreshCw className={`h-3.5 w-3.5 ${dashLoading ? 'animate-spin' : ''}`} />{sa.refresh}</button>
      </div>
      {dashLoading && !d && <div className="flex items-center gap-2 py-12 text-sm text-muted-foreground"><RefreshCw className="h-4 w-4 animate-spin" />{sa.loading}</div>}
      {d && <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} className="space-y-4">
        <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
          <SC icon={Users} label={sa.users} value={d.users?.total ?? 0} c="bg-burgundy/10" tc="text-burgundy" />
          <SC icon={Heart} label={sa.matrimony} value={d.matrimony?.totalProfiles ?? 0} c="bg-pink-50" tc="text-pink-600" />
          <SC icon={Briefcase} label={sa.business} value={d.business?.total ?? 0} c="bg-gold/10" tc="text-gold-dark" />
          <SC icon={FileText} label={sa.jobs} value={d.jobs?.total ?? 0} c="bg-teal/10" tc="text-teal" />
        </div>
        <Sec title={sa.users} icon={Users}><div className="grid grid-cols-2 gap-2 sm:grid-cols-4"><M l={sa.active} v={d.users?.active ?? 0} g /><M l={sa.pending} v={d.users?.pending ?? 0} w /><M l={sa.blocked} v={d.users?.blocked ?? 0} b /><M l={sa.premium} v={(d.users?.premium ?? 0) + (d.users?.elite ?? 0)} /></div></Sec>
        <div className="grid grid-cols-1 gap-4 md:grid-cols-3">
          <Sec title={sa.matrimony} icon={Heart}><div className="space-y-1.5"><M l={sa.pending} v={d.matrimony?.pendingApproval ?? 0} w /><M l={sa.approved} v={d.matrimony?.approved ?? 0} g /><M l={sa.featured} v={d.matrimony?.featured ?? 0} /><div className="grid grid-cols-2 gap-2"><M l={sa.male} v={d.matrimony?.male ?? 0} /><M l={sa.female} v={d.matrimony?.female ?? 0} /></div></div></Sec>
          <Sec title={sa.business} icon={Briefcase}><div className="space-y-1.5"><M l={sa.active} v={d.business?.active ?? 0} g /><M l={sa.pending} v={d.business?.pending ?? 0} w /><M l={sa.verified} v={d.business?.verified ?? 0} /><M l={sa.featured} v={d.business?.featured ?? 0} /></div></Sec>
          <Sec title={sa.jobs} icon={FileText}><div className="space-y-1.5"><M l={sa.active} v={d.jobs?.active ?? 0} g /><M l={sa.pending} v={d.jobs?.pending ?? 0} w /><M l={sa.applications} v={d.jobs?.totalApplications ?? 0} /><M l={sa.employers} v={d.jobs?.employers ?? 0} /></div></Sec>
        </div>
        <div className="grid grid-cols-1 gap-4 md:grid-cols-3">
          <Sec title={sa.revenue} icon={IndianRupee}><div className="space-y-1.5"><M l={sa.totalRevenue} v={fmtC(d.revenue?.totalRevenue ?? 0)} /><M l={sa.successPayments} v={d.revenue?.successPayments ?? 0} g /><M l={sa.pendingPayments} v={d.revenue?.pendingPayments ?? 0} w /></div></Sec>
          <Sec title={sa.ai} icon={Brain}><div className="space-y-1.5"><M l={sa.requests} v={d.ai?.totalRequests ?? 0} /><M l={sa.completed} v={d.ai?.completedRequests ?? 0} g /><M l={sa.failed} v={d.ai?.failedRequests ?? 0} b /><M l={sa.activeProviders} v={d.ai?.activeProviders ?? 0} /></div></Sec>
          <Sec title={sa.security} icon={Lock}><div className="space-y-1.5"><M l={sa.recentEvents} v={d.security?.recentSecurityEvents ?? 0} /><M l={sa.criticalEvents} v={d.security?.criticalEvents ?? 0} b /><M l={sa.lockedUsers} v={d.security?.lockedUsers ?? 0} w /></div></Sec>
        </div>
        <div className="grid grid-cols-1 gap-4 md:grid-cols-3">
          <Sec title={sa.gotra} icon={TreePine}><div className="space-y-1.5"><M l={sa.total} v={d.gotra?.total ?? 0} /><M l={sa.active} v={d.gotra?.active ?? 0} g /></div></Sec>
          <Sec title={sa.ads} icon={Megaphone}><div className="space-y-1.5"><M l={sa.active} v={d.advertisements?.activeCampaigns ?? 0} g /><M l={sa.impressions} v={d.advertisements?.totalImpressions ?? 0} /><M l={sa.clicks} v={d.advertisements?.totalClicks ?? 0} /></div></Sec>
          <Sec title={sa.reports} icon={BarChart3}><div className="space-y-1.5"><M l={sa.reportsPending} v={d.reports?.pending ?? 0} w /><M l={sa.reportsResolved} v={d.reports?.resolved ?? 0} g /></div></Sec>
        </div>
      </motion.div>}
    </div>
  )
}

/* ═══════════ USERS TAB ═══════════ */
function UsersTab({ sa, api, showToast }: { sa: Record<string, string>; api: (u: string, o?: RequestInit) => Promise<any>; showToast: (m: string) => void }) {
  const [search, setSearch] = useState('')
  const [users, setUsers] = useState<any[]>([])
  const [loading, setLoading] = useState(false)
  const [selected, setSelected] = useState<string[]>([])

  const fetchUsers = useCallback(async () => {
    setLoading(true)
    const d = await api(`/api/v1/admin/ops/users?limit=50${search ? `&search=${encodeURIComponent(search)}` : ''}`)
    if (d?.data?.users) setUsers(d.data.users)
    setLoading(false)
  }, [api, search])

  useEffect(() => {
    let active = true
    api(`/api/v1/admin/ops/users?limit=50${search ? `&search=${encodeURIComponent(search)}` : ''}`)
      .then(d => { if (active && d?.data?.users) setUsers(d.data.users) })
      .catch(() => {})
    return () => { active = false }
  }, [api, search])

  const toggleSel = (id: string) => setSelected(p => p.includes(id) ? p.filter(x => x !== id) : [...p, id])
  const toggleAll = () => setSelected(users.length === selected.length ? [] : users.map((u: any) => u.id))

  const bulkAction = async (action: string, extra?: Record<string, string>) => {
    if (!selected.length) return
    const d = await api('/api/v1/admin/ops/users', { method: 'POST', body: JSON.stringify({ action, userIds: selected, ...extra }) })
    if (d?.data) { showToast(`${action} done for ${d.data.processed} users`); setSelected([]); fetchUsers() }
    else if (d?.error) showToast(d.error)
  }

  return (
    <div>
      <div className="mb-4 flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
        <h1 className="text-lg font-bold text-foreground font-serif">{sa.users}</h1>
        {selected.length > 0 && (
          <div className="flex items-center gap-2">
            <span className="text-xs text-muted-foreground">{selected.length} {sa.selected}</span>
            <button onClick={() => bulkAction('APPROVE')} className="btn-bandhan-primary py-1 px-3 text-xs">{sa.approve}</button>
            <button onClick={() => bulkAction('BLOCK')} className="rounded-lg bg-red-50 px-3 py-1 text-xs font-medium text-red-600">{sa.block}</button>
            <button onClick={() => bulkAction('UNBLOCK')} className="rounded-lg bg-emerald-50 px-3 py-1 text-xs font-medium text-emerald-600">{sa.unblock}</button>
          </div>
        )}
      </div>
      <div className="relative mb-4"><Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground/60" /><input value={search} onChange={e => setSearch(e.target.value)} placeholder={sa.searchUsers} className="h-11 w-full rounded-xl border border-border/60 bg-white pl-10 pr-4 text-sm" /></div>
      {loading ? <div className="py-12 text-center text-sm text-muted-foreground">{sa.loading}</div> : users.length === 0 ? <p className="py-12 text-center text-sm text-muted-foreground">{sa.noUsers}</p> : (
        <div className="overflow-x-auto rounded-xl border border-border/40 bg-white">
          <table className="w-full text-left text-xs">
            <thead className="border-b border-border/30 bg-ivory/60"><tr>
              <th className="p-3"><input type="checkbox" checked={users.length === selected.length && users.length > 0} onChange={toggleAll} /></th>
              <th className="p-3 font-medium text-muted-foreground">Email</th><th className="hidden p-3 font-medium text-muted-foreground sm:table-cell">Role</th><th className="p-3 font-medium text-muted-foreground">Status</th><th className="hidden p-3 font-medium text-muted-foreground md:table-cell">Tier</th><th className="hidden p-3 font-medium text-muted-foreground lg:table-cell">Joined</th>
            </tr></thead>
            <tbody>{users.map((u: any) => (
              <tr key={u.id} className={`border-b border-border/20 last:border-0 ${selected.includes(u.id) ? 'bg-burgundy/5' : ''}`} onClick={() => toggleSel(u.id)}>
                <td className="p-3"><input type="checkbox" checked={selected.includes(u.id)} readOnly /></td>
                <td className="p-3 font-medium text-foreground">{u.email || u.phone || '-'}</td>
                <td className="hidden p-3 text-muted-foreground sm:table-cell">{u.role?.name || '-'}</td>
                <td className="p-3"><span className={`inline-block rounded-full px-2 py-0.5 text-[0.65rem] font-medium ${u.status === 'ACTIVE' ? 'bg-emerald-50 text-emerald-600' : u.status === 'BLOCKED' ? 'bg-red-50 text-red-600' : 'bg-amber-50 text-amber-600'}`}>{u.status}</span></td>
                <td className="hidden p-3 text-muted-foreground md:table-cell">{u.membershipTier || '-'}</td>
                <td className="hidden p-3 text-muted-foreground lg:table-cell">{u.createdAt ? new Date(u.createdAt).toLocaleDateString() : '-'}</td>
              </tr>
            ))}</tbody>
          </table>
        </div>
      )}
    </div>
  )
}

/* ═══════════ ADS TAB ═══════════ */
function AdsTab({ sa, api, showToast }: { sa: Record<string, string>; api: (u: string, o?: RequestInit) => Promise<any>; showToast: (m: string) => void }) {
  const [ads, setAds] = useState<any[]>([])
  const [rates, setRates] = useState<Record<string, string>>({ AD_HERO_RATE: '5000', AD_MIDDLE_RATE: '3000', AD_BOTTOM_RATE: '2000' })
  const [showForm, setShowForm] = useState(false)
  const [form, setForm] = useState({ name: '', module: 'GENERAL', placement: 'HERO', mediaType: 'IMAGE', mediaUrl: '', linkUrl: '', ctaText: '', ctaTextHi: '', language: 'ALL', device: 'ALL', priority: 0, startDate: '', endDate: '' })

  const fetchAds = useCallback(async () => {
    const d = await api('/api/v1/admin/ops/advertisements?limit=50')
    if (d?.data?.campaigns) setAds(d.data.campaigns)
  }, [api])

  const fetchRates = useCallback(async () => {
    const d = await api('/api/v1/admin/ops/settings?category=ADVERTISEMENT')
    if (d?.data?.settings) {
      const r: Record<string, string> = {}
      d.data.settings.forEach((s: any) => { if (s.key.startsWith('AD_') && s.key.endsWith('_RATE')) r[s.key] = s.value })
      if (Object.keys(r).length > 0) setRates(r)
    }
  }, [api])

  useEffect(() => {
    let active = true
    Promise.all([api('/api/v1/admin/ops/advertisements?limit=50'), api('/api/v1/admin/ops/settings?category=ADVERTISEMENT')])
      .then(([adsRes, ratesRes]) => {
        if (!active) return
        if (adsRes?.data?.campaigns) setAds(adsRes.data.campaigns)
        if (ratesRes?.data?.settings) {
          const r: Record<string, string> = {}
          ratesRes.data.settings.forEach((s: any) => { if (s.key.startsWith('AD_') && s.key.endsWith('_RATE')) r[s.key] = s.value })
          if (Object.keys(r).length > 0) setRates(r)
        }
      })
      .catch(() => {})
    return () => { active = false }
  }, [api])

  const createAd = async () => {
    if (!form.name || !form.mediaUrl) return
    const d = await api('/api/v1/admin/ops/advertisements', { method: 'POST', body: JSON.stringify(form) })
    if (d?.data) { showToast(sa.create); setShowForm(false); setForm({ name: '', module: 'GENERAL', placement: 'HERO', mediaType: 'IMAGE', mediaUrl: '', linkUrl: '', ctaText: '', ctaTextHi: '', language: 'ALL', device: 'ALL', priority: 0, startDate: '', endDate: '' }); fetchAds() }
    else if (d?.error) showToast(d.error)
  }

  const saveRates = async () => {
    const settings = Object.entries(rates).map(([key, value]) => ({ key, value, category: 'ADVERTISEMENT', description: key }))
    const d = await api('/api/v1/admin/ops/settings', { method: 'PUT', body: JSON.stringify({ settings }) })
    if (d?.data) showToast(sa.ratesSaved)
  }

  const toggleStatus = async (id: string, status: string) => {
    const d = await api('/api/v1/admin/campaigns', { method: 'PUT', body: JSON.stringify({ id, status: status === 'ACTIVE' ? 'PAUSED' : 'ACTIVE' }) })
    if (d?.data) fetchAds()
  }

  return (
    <div>
      <div className="mb-4 flex items-center justify-between">
        <h1 className="text-lg font-bold text-foreground font-serif">{sa.advertisements}</h1>
        <button onClick={() => setShowForm(!showForm)} className="btn-bandhan-primary py-1.5 px-3 text-xs"><Plus className="h-3.5 w-3.5" />{sa.createAd}</button>
      </div>
      {/* Ad Rates */}
      <div className="mb-4 rounded-xl border border-border/40 bg-white p-4">
        <h3 className="mb-3 flex items-center gap-2 text-sm font-bold text-foreground"><IndianRupee className="h-4 w-4 text-burgundy" />{sa.adRates} (INR/month)</h3>
        <div className="grid grid-cols-1 gap-3 sm:grid-cols-3">
          {[['AD_HERO_RATE', sa.heroRate], ['AD_MIDDLE_RATE', sa.middleRate], ['AD_BOTTOM_RATE', sa.bottomRate]].map(([key, label]) => (
            <div key={key}><label className="mb-1 block text-xs text-muted-foreground">{label}</label><input value={rates[key as keyof typeof rates] || ''} onChange={e => setRates(p => ({ ...p, [key]: e.target.value }))} className="h-10 w-full rounded-lg border border-border/60 px-3 text-sm" /></div>
          ))}
        </div>
        <button onClick={saveRates} className="btn-bandhan-primary mt-3 py-1.5 px-4 text-xs">{sa.saveRates}</button>
      </div>
      {/* Create Form */}
      <AnimatePresence>{showForm && <motion.div initial={{ opacity: 0, height: 0 }} animate={{ opacity: 1, height: 'auto' }} exit={{ opacity: 0, height: 0 }} className="mb-4 overflow-hidden rounded-xl border border-border/40 bg-white p-4">
        <h3 className="mb-3 text-sm font-bold text-foreground">{sa.createAd}</h3>
        <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
          <Inp label={sa.adName} value={form.name} onChange={v => setForm(p => ({ ...p, name: v }))} />
          <Sel label={sa.adModule} value={form.module} onChange={v => setForm(p => ({ ...p, module: v }))} opts={['GENERAL', 'MATRIMONY', 'BUSINESS', 'JOBS', 'DIRECTORY']} />
          <Sel label={sa.adPlacement} value={form.placement} onChange={v => setForm(p => ({ ...p, placement: v }))} opts={['HERO', 'MIDDLE', 'BOTTOM']} />
          <Sel label={sa.adMediaType} value={form.mediaType} onChange={v => setForm(p => ({ ...p, mediaType: v }))} opts={['IMAGE', 'VIDEO', 'LOTTIE']} />
          <Inp label={sa.adMediaUrl} value={form.mediaUrl} onChange={v => setForm(p => ({ ...p, mediaUrl: v }))} />
          <Inp label={sa.adLinkUrl} value={form.linkUrl} onChange={v => setForm(p => ({ ...p, linkUrl: v }))} />
          <Inp label={sa.adCtaText} value={form.ctaText} onChange={v => setForm(p => ({ ...p, ctaText: v }))} />
          <Inp label={sa.adCtaTextHi} value={form.ctaTextHi} onChange={v => setForm(p => ({ ...p, ctaTextHi: v }))} />
          <Sel label={sa.adLanguage} value={form.language} onChange={v => setForm(p => ({ ...p, language: v }))} opts={['ALL', 'EN', 'HI']} />
          <Sel label={sa.adDevice} value={form.device} onChange={v => setForm(p => ({ ...p, device: v }))} opts={['ALL', 'MOBILE', 'DESKTOP']} />
        </div>
        <div className="mt-3 flex gap-2">
          <button onClick={createAd} className="btn-bandhan-primary py-1.5 px-4 text-xs">{sa.create}</button>
          <button onClick={() => setShowForm(false)} className="rounded-lg border border-border/40 px-4 py-1.5 text-xs font-medium text-muted-foreground hover:bg-cream">{sa.cancel}</button>
        </div>
      </motion.div>}</AnimatePresence>
      {/* Ad List */}
      {ads.length === 0 ? <p className="py-12 text-center text-sm text-muted-foreground">{sa.noAds}</p> : (
        <div className="space-y-2">{ads.map((ad: any) => (
          <div key={ad.id} className="flex flex-col gap-2 rounded-xl border border-border/40 bg-white p-3 sm:flex-row sm:items-center sm:justify-between">
            <div className="flex-1"><p className="text-sm font-medium text-foreground">{ad.name}</p><p className="text-xs text-muted-foreground">{ad.module} / {ad.placement} / {ad.device}</p></div>
            <div className="flex items-center gap-3">
              <span className="text-xs text-muted-foreground">{ad.impressions} imp / {ad.clicks} clicks</span>
              <button onClick={() => toggleStatus(ad.id, ad.status)} className={`rounded-full px-3 py-1 text-[0.65rem] font-medium ${ad.status === 'ACTIVE' ? 'bg-emerald-50 text-emerald-600' : 'bg-amber-50 text-amber-600'}`}>{ad.status}</button>
            </div>
          </div>
        ))}</div>
      )}
    </div>
  )
}

/* ═══════════ OFFERS TAB ═══════════ */
function OffersTab({ sa, api, showToast }: { sa: Record<string, string>; api: (u: string, o?: RequestInit) => Promise<any>; showToast: (m: string) => void }) {
  const [offers, setOffers] = useState<any[]>([])
  const [showForm, setShowForm] = useState(false)
  const [editingId, setEditingId] = useState<string | null>(null)
  const [form, setForm] = useState({ name: '', nameHi: '', description: '', descriptionHi: '', discountType: 'PERCENTAGE', discountValue: 10, applicableTo: 'ALL', applicableTier: 'ALL', promoCode: '', maxUses: 0, minAmount: '', startDate: '', endDate: '' })

  const fetchOffers = useCallback(async () => {
    const d = await api('/api/v1/admin/ops/offers?limit=50')
    if (d?.data?.offers) setOffers(d.data.offers)
  }, [api])
  useEffect(() => {
    let active = true
    api('/api/v1/admin/ops/offers?limit=50')
      .then(d => { if (active && d?.data?.offers) setOffers(d.data.offers) })
      .catch(() => {})
    return () => { active = false }
  }, [api])

  const saveOffer = async () => {
    if (!form.name || !form.discountType) return
    if (editingId) {
      const d = await api('/api/v1/admin/ops/offers', { method: 'PUT', body: JSON.stringify({ id: editingId, ...form }) })
      if (d?.data) { showToast(sa.offerUpdated); resetForm(); fetchOffers() }
      else if (d?.error) showToast(d.error)
    } else {
      const d = await api('/api/v1/admin/ops/offers', { method: 'POST', body: JSON.stringify(form) })
      if (d?.data) { showToast(sa.offerCreated); resetForm(); fetchOffers() }
      else if (d?.error) showToast(d.error)
    }
  }

  const deleteOffer = async (id: string) => {
    const d = await api(`/api/v1/admin/ops/offers?id=${id}`, { method: 'DELETE' })
    if (d?.data) { showToast(sa.offerDeleted); fetchOffers() }
  }

  const resetForm = () => { setShowForm(false); setEditingId(null); setForm({ name: '', nameHi: '', description: '', descriptionHi: '', discountType: 'PERCENTAGE', discountValue: 10, applicableTo: 'ALL', applicableTier: 'ALL', promoCode: '', maxUses: 0, minAmount: '', startDate: '', endDate: '' }) }

  const editOffer = (o: any) => { setEditingId(o.id); setForm({ name: o.name, nameHi: o.nameHi || '', description: o.description || '', descriptionHi: o.descriptionHi || '', discountType: o.discountType, discountValue: o.discountValue, applicableTo: o.applicableTo, applicableTier: o.applicableTier, promoCode: o.promoCode || '', maxUses: o.maxUses, minAmount: o.minAmount?.toString() || '', startDate: o.startDate?.split('T')[0] || '', endDate: o.endDate?.split('T')[0] || '' }); setShowForm(true) }

  return (
    <div>
      <div className="mb-4 flex items-center justify-between">
        <h1 className="text-lg font-bold text-foreground font-serif">{sa.offers}</h1>
        <button onClick={() => { resetForm(); setShowForm(true) }} className="btn-bandhan-primary py-1.5 px-3 text-xs"><Plus className="h-3.5 w-3.5" />{sa.createOffer}</button>
      </div>
      <AnimatePresence>{showForm && <motion.div initial={{ opacity: 0, height: 0 }} animate={{ opacity: 1, height: 'auto' }} exit={{ opacity: 0, height: 0 }} className="mb-4 overflow-hidden rounded-xl border border-border/40 bg-white p-4">
        <h3 className="mb-3 text-sm font-bold text-foreground">{editingId ? sa.edit : sa.createOffer}</h3>
        <div className="grid grid-cols-1 gap-3 sm:grid-cols-2 lg:grid-cols-3">
          <Inp label={sa.offerName} value={form.name} onChange={v => setForm(p => ({ ...p, name: v }))} />
          <Inp label={sa.offerNameHi} value={form.nameHi} onChange={v => setForm(p => ({ ...p, nameHi: v }))} />
          <Sel label={sa.discountType} value={form.discountType} onChange={v => setForm(p => ({ ...p, discountType: v }))} opts={['PERCENTAGE', 'FLAT', 'FREE_TRIAL']} />
          {form.discountType !== 'FREE_TRIAL' && <Inp label={sa.discountValue} value={String(form.discountValue)} onChange={v => setForm(p => ({ ...p, discountValue: parseFloat(v) || 0 }))} type="number" />}
          <Sel label={sa.applicableTo} value={form.applicableTo} onChange={v => setForm(p => ({ ...p, applicableTo: v }))} opts={['ALL', 'MEMBERSHIP', 'ADVERTISEMENT']} />
          <Sel label={sa.applicableTier} value={form.applicableTier} onChange={v => setForm(p => ({ ...p, applicableTier: v }))} opts={['ALL', 'FREE', 'PREMIUM', 'ELITE']} />
          <Inp label={sa.promoCode} value={form.promoCode} onChange={v => setForm(p => ({ ...p, promoCode: v.toUpperCase() }))} />
          <Inp label={sa.maxUses} value={form.maxUses} onChange={v => setForm(p => ({ ...p, maxUses: parseInt(v) || 0 }))} type="number" />
          <Inp label={sa.minAmount} value={form.minAmount} onChange={v => setForm(p => ({ ...p, minAmount: v }))} type="number" />
          <Inp label={sa.adStartDate} value={form.startDate} onChange={v => setForm(p => ({ ...p, startDate: v }))} type="date" />
          <Inp label={sa.adEndDate} value={form.endDate} onChange={v => setForm(p => ({ ...p, endDate: v }))} type="date" />
        </div>
        <Inp label={sa.offerDesc} value={form.description} onChange={v => setForm(p => ({ ...p, description: v }))} />
        <div className="mt-3 flex gap-2">
          <button onClick={saveOffer} className="btn-bandhan-primary py-1.5 px-4 text-xs">{editingId ? sa.update : sa.create}</button>
          <button onClick={resetForm} className="rounded-lg border border-border/40 px-4 py-1.5 text-xs font-medium text-muted-foreground hover:bg-cream">{sa.cancel}</button>
        </div>
      </motion.div>}</AnimatePresence>
      {offers.length === 0 ? <p className="py-12 text-center text-sm text-muted-foreground">{sa.noOffers}</p> : (
        <div className="space-y-2">{offers.map((o: any) => (
          <div key={o.id} className="flex flex-col gap-2 rounded-xl border border-border/40 bg-white p-3 sm:flex-row sm:items-center sm:justify-between">
            <div className="flex-1">
              <p className="text-sm font-medium text-foreground">{o.name}</p>
              <p className="text-xs text-muted-foreground">{o.discountType === 'PERCENTAGE' ? `${o.discountValue}%` : o.discountType === 'FLAT' ? `\u20b9${o.discountValue}` : sa.freeTrial} {o.applicableTo === 'ALL' ? '' : `| ${o.applicableTo}`} {o.promoCode ? `| Code: ${o.promoCode}` : ''}</p>
            </div>
            <div className="flex items-center gap-2">
              <span className={`rounded-full px-2 py-0.5 text-[0.65rem] font-medium ${o.status === 'ACTIVE' ? 'bg-emerald-50 text-emerald-600' : o.status === 'EXPIRED' ? 'bg-gray-100 text-gray-500' : 'bg-amber-50 text-amber-600'}`}>{o.status}</span>
              <button onClick={() => editOffer(o)} className="rounded-lg p-1.5 text-muted-foreground hover:bg-cream"><Edit3 className="h-3.5 w-3.5" /></button>
              <button onClick={() => deleteOffer(o.id)} className="rounded-lg p-1.5 text-red-400 hover:bg-red-50"><Trash2 className="h-3.5 w-3.5" /></button>
            </div>
          </div>
        ))}</div>
      )}
    </div>
  )
}

/* ═══════════ MEMBERSHIP TAB ═══════════ */
function MembershipTab({ sa, api, showToast }: { sa: Record<string, string>; api: (u: string, o?: RequestInit) => Promise<any>; showToast: (m: string) => void }) {
  const [plans, setPlans] = useState<any[]>([])
  const [editing, setEditing] = useState<string | null>(null)
  const [form, setForm] = useState({ name: '', displayName: '', price: 0, durationDays: 30, maxContacts: 10, maxPhotos: 5, priorityListing: false, features: '', status: 'ACTIVE', sortOrder: 0 })

  const fetchPlans = useCallback(async () => {
    const d = await api('/api/v1/admin/ops/membership')
    if (d?.data?.plans) setPlans(d.data.plans)
  }, [api])
  useEffect(() => {
    let active = true
    api('/api/v1/admin/ops/membership')
      .then(d => { if (active && d?.data?.plans) setPlans(d.data.plans) })
      .catch(() => {})
    return () => { active = false }
  }, [api])

  const savePlan = async () => {
    const body: any = { ...form, features: form.features ? form.features.split(',').map((f: string) => f.trim()).filter(Boolean) : [] }
    if (editing) body.id = editing
    const d = await api('/api/v1/admin/ops/membership', { method: 'POST', body: JSON.stringify(body) })
    if (d?.data) { showToast(sa.planSaved); setEditing(null); setForm({ name: '', displayName: '', price: 0, durationDays: 30, maxContacts: 10, maxPhotos: 5, priorityListing: false, features: '', status: 'ACTIVE', sortOrder: 0 }); fetchPlans() }
    else if (d?.error) showToast(d.error)
  }

  const editPlan = (p: any) => {
    setEditing(p.id); setForm({ name: p.name, displayName: p.displayName, price: p.price, durationDays: p.durationDays, maxContacts: p.maxContacts, maxPhotos: p.maxPhotos, priorityListing: p.priorityListing, features: Array.isArray(p.features) ? p.features.join(', ') : (typeof p.features === 'string' ? p.features : ''), status: p.status, sortOrder: p.sortOrder })
  }

  return (
    <div>
      <div className="mb-4 flex items-center justify-between">
        <h1 className="text-lg font-bold text-foreground font-serif">{sa.membership}</h1>
        <button onClick={() => { setEditing(null); setForm({ name: '', displayName: '', price: 0, durationDays: 30, maxContacts: 10, maxPhotos: 5, priorityListing: false, features: '', status: 'ACTIVE', sortOrder: 0 }) }} className="btn-bandhan-primary py-1.5 px-3 text-xs"><Plus className="h-3.5 w-3.5" />{sa.create}</button>
      </div>
      <div className="mb-4 rounded-xl border border-border/40 bg-white p-4">
        <h3 className="mb-3 text-sm font-bold text-foreground">{editing ? sa.edit : sa.create}</h3>
        <div className="grid grid-cols-1 gap-3 sm:grid-cols-2 lg:grid-cols-3">
          <Inp label={sa.planName} value={form.name} onChange={v => setForm(p => ({ ...p, name: v }))} />
          <Inp label={sa.displayName} value={form.displayName} onChange={v => setForm(p => ({ ...p, displayName: v }))} />
          <Inp label={sa.price} value={form.price} onChange={v => setForm(p => ({ ...p, price: parseFloat(v) || 0 }))} type="number" />
          <Inp label={sa.durationDays} value={form.durationDays} onChange={v => setForm(p => ({ ...p, durationDays: parseInt(v) || 30 }))} type="number" />
          <Inp label={sa.maxContacts} value={form.maxContacts} onChange={v => setForm(p => ({ ...p, maxContacts: parseInt(v) || 0 }))} type="number" />
          <Inp label={sa.maxPhotos} value={form.maxPhotos} onChange={v => setForm(p => ({ ...p, maxPhotos: parseInt(v) || 0 }))} type="number" />
          <Inp label={sa.features} value={form.features} onChange={v => setForm(p => ({ ...p, features: v }))} />
        </div>
        <div className="mt-3 flex items-center gap-3">
          <label className="flex items-center gap-2 text-xs text-foreground"><input type="checkbox" checked={form.priorityListing} onChange={e => setForm(p => ({ ...p, priorityListing: e.target.checked }))} />{sa.priorityListing}</label>
          <button onClick={savePlan} className="btn-bandhan-primary py-1.5 px-4 text-xs">{sa.save}</button>
          {editing && <button onClick={() => setEditing(null)} className="rounded-lg border border-border/40 px-4 py-1.5 text-xs font-medium text-muted-foreground hover:bg-cream">{sa.cancel}</button>}
        </div>
      </div>
      <div className="space-y-2">{plans.map((p: any) => (
        <div key={p.id} onClick={() => editPlan(p)} className="flex flex-col gap-1 rounded-xl border border-border/40 bg-white p-4 transition-all hover:shadow-sm sm:flex-row sm:items-center sm:justify-between cursor-pointer">
          <div className="flex-1"><p className="text-sm font-bold text-foreground">{p.displayName}</p><p className="text-xs text-muted-foreground">{p.durationDays} days | {p.maxContacts} contacts | {p.maxPhotos} photos</p></div>
          <div className="flex items-center gap-3"><p className="text-lg font-bold text-burgundy">\u20b9{p.price}</p><button onClick={e => { e.stopPropagation(); editPlan(p) }} className="rounded-lg p-1.5 text-muted-foreground hover:bg-cream"><Edit3 className="h-3.5 w-3.5" /></button></div>
        </div>
      ))}</div>
    </div>
  )
}

/* ═══════════ SETTINGS TAB ═══════════ */
function SettingsTab({ sa, api, token, showToast }: { sa: Record<string, string>; api: (u: string, o?: RequestInit) => Promise<any>; token: string; showToast: (m: string) => void }) {
  const [section, setSection] = useState('password' as string)
  const [curPwd, setCurPwd] = useState('')
  const [newPwd, setNewPwd] = useState('')
  const [cfmPwd, setCfmPwd] = useState('')
  const [pwdLoading, setPwdLoading] = useState(false)
  const [pwdErr, setPwdErr] = useState('')
  const [siteCfg, setSiteCfg] = useState({ SITE_NAME: 'Bandhan', SITE_DESCRIPTION: 'Sahu Samaj Connects', CONTACT_EMAIL: '', CONTACT_PHONE: '', MAINTENANCE_MODE: 'false' })
  const [secCfg, setSecCfg] = useState({ MAX_LOGIN_ATTEMPTS: '5', SESSION_DURATION_DAYS: '30' })
  const [settingsLoading, setSettingsLoading] = useState(false)

  const fetchSettings = useCallback(async () => {
    const d = await api('/api/v1/admin/ops/settings')
    if (d?.data?.settings) {
      const g: Record<string, string> = {}, s: Record<string, string> = {}
      d.data.settings.forEach((st: any) => { const target = st.category === 'GENERAL' ? g : st.category === 'SECURITY' ? s : null; if (target) target[st.key] = st.value })
      if (Object.keys(g).length) setSiteCfg(p => ({ ...p, ...g }))
      if (Object.keys(s).length) setSecCfg(p => ({ ...p, ...s }))
    }
  }, [api])
  useEffect(() => {
    let active = true
    api('/api/v1/admin/ops/settings')
      .then(d => {
        if (!active) return
        if (d?.data?.settings) {
          const g: Record<string, string> = {}, s: Record<string, string> = {}
          d.data.settings.forEach((st: any) => { const target = st.category === 'GENERAL' ? g : st.category === 'SECURITY' ? s : null; if (target) target[st.key] = st.value })
          if (Object.keys(g).length) setSiteCfg(p => ({ ...p, ...g }))
          if (Object.keys(s).length) setSecCfg(p => ({ ...p, ...s }))
        }
      })
      .catch(() => {})
    return () => { active = false }
  }, [api])

  const changePassword = async () => {
    if (newPwd !== cfmPwd) { setPwdErr(sa.passwordMismatch); return }
    if (newPwd.length < 8 || !/[A-Z]/.test(newPwd) || !/[0-9]/.test(newPwd)) { setPwdErr(sa.passwordError); return }
    setPwdErr(''); setPwdLoading(true)
    const r = await fetch('/api/v1/auth/password', { method: 'PUT', headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${token}` }, body: JSON.stringify({ currentPassword: curPwd, newPassword: newPwd }) })
    const d = await r.json()
    if (d.success) { showToast(sa.passwordChanged); setCurPwd(''); setNewPwd(''); setCfmPwd('') }
    else setPwdErr(d.error || 'Failed')
    setPwdLoading(false)
  }

  const saveSiteSettings = async () => {
    setSettingsLoading(true)
    const settings = Object.entries(siteCfg).map(([key, value]) => ({ key, value, category: 'GENERAL', description: key, isPublic: true }))
    const d = await api('/api/v1/admin/settings', { method: 'PUT', body: JSON.stringify({ settings }) })
    if (d?.data) showToast(sa.settingsSaved)
    setSettingsLoading(false)
  }

  const saveSecSettings = async () => {
    setSettingsLoading(true)
    const settings = Object.entries(secCfg).map(([key, value]) => ({ key, value, category: 'SECURITY', description: key }))
    const d = await api('/api/v1/admin/ops/settings', { method: 'PUT', body: JSON.stringify({ settings }) })
    if (d?.data) showToast(sa.settingsSaved)
    setSettingsLoading(false)
  }

  return (
    <div>
      <div className="mb-4 flex gap-2">
        {[['password', sa.changePassword], ['general', sa.siteSettings], ['secSettings', sa.secSettings]].map(([k, l]) => <button key={k} onClick={() => setSection(k)} className={`rounded-lg px-3 py-1.5 text-xs font-medium transition-all ${section === k ? 'bg-burgundy text-white' : 'border border-border/40 text-muted-foreground hover:bg-cream'}`}>{l}</button>)}
      </div>
      {section === 'password' && (
        <div className="mx-auto max-w-sm rounded-xl border border-border/40 bg-white p-5">
          {pwdErr && <div className="mb-3 rounded-lg bg-red-50 px-3 py-2 text-xs font-medium text-red-600">{pwdErr}</div>}
          <div className="space-y-3">
            <div><label className="mb-1 block text-xs font-medium text-foreground">{sa.currentPassword}</label><input type="password" value={curPwd} onChange={e => setCurPwd(e.target.value)} className="h-11 w-full rounded-xl border border-border/60 px-4 text-sm" /></div>
            <div><label className="mb-1 block text-xs font-medium text-foreground">{sa.newPassword}</label><input type="password" value={newPwd} onChange={e => setNewPwd(e.target.value)} className="h-11 w-full rounded-xl border border-border/60 px-4 text-sm" /></div>
            <div><label className="mb-1 block text-xs font-medium text-foreground">{sa.confirmPassword}</label><input type="password" value={cfmPwd} onChange={e => setCfmPwd(e.target.value)} onKeyDown={e => e.key === 'Enter' && changePassword()} className="h-11 w-full rounded-xl border border-border/60 px-4 text-sm" /></div>
          </div>
          <button onClick={changePassword} disabled={pwdLoading} className="btn-bandhan-primary mt-4 w-full py-2 text-sm disabled:opacity-50">{pwdLoading ? sa.saving : sa.save}</button>
        </div>
      )}
      {section === 'general' && (
        <div className="rounded-xl border border-border/40 bg-white p-5">
          <h3 className="mb-3 text-sm font-bold text-foreground">{sa.siteSettings}</h3>
          <div className="space-y-3">
            <Inp label={sa.siteName} value={siteCfg.SITE_NAME || ''} onChange={v => setSiteCfg(p => ({ ...p, SITE_NAME: v }))} />
            <div><label className="mb-1 block text-xs font-medium text-foreground">{sa.siteDescription}</label><textarea value={siteCfg.SITE_DESCRIPTION || ''} onChange={e => setSiteCfg(p => ({ ...p, SITE_DESCRIPTION: e.target.value }))} rows={2} className="w-full rounded-xl border border-border/60 px-4 py-2 text-sm" /></div>
            <Inp label={sa.contactEmail} value={siteCfg.CONTACT_EMAIL || ''} onChange={v => setSiteCfg(p => ({ ...p, CONTACT_EMAIL: v }))} />
            <Inp label={sa.contactPhone} value={siteCfg.CONTACT_PHONE || ''} onChange={v => setSiteCfg(p => ({ ...p, CONTACT_PHONE: v }))} />
          </div>
          <button onClick={saveSiteSettings} disabled={settingsLoading} className="btn-bandhan-primary mt-4 py-2 px-6 text-sm disabled:opacity-50">{settingsLoading ? sa.saving : sa.save}</button>
        </div>
      )}
      {section === 'secSettings' && (
        <div className="rounded-xl border border-border/40 bg-white p-5">
          <h3 className="mb-3 text-sm font-bold text-foreground">{sa.security}</h3>
          <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
            <Inp label={sa.maxLoginAttempts} value={secCfg.MAX_LOGIN_ATTEMPTS || ''} onChange={v => setSecCfg(p => ({ ...p, MAX_LOGIN_ATTEMPTS: v }))} />
            <Inp label={sa.sessionDuration} value={secCfg.SESSION_DURATION_DAYS || ''} onChange={v => setSecCfg(p => ({ ...p, SESSION_DURATION_DAYS: v }))} />
          </div>
          <button onClick={saveSecSettings} disabled={settingsLoading} className="btn-bandhan-primary mt-4 py-2 px-6 text-sm disabled:opacity-50">{settingsLoading ? sa.saving : sa.save}</button>
        </div>
      )}
    </div>
  )
}

/* ═══════════ SHARED COMPONENTS ═══════════ */
const icons = { Heart, Briefcase, FileText, IndianRupee, Brain, Lock, TreePine, Megaphone, BarChart3, Users }
function SC({ icon, label, value, c, tc }: { icon: any; label: string; value: number | string; c: string; tc: string }) {
  const I = icons[icon as keyof typeof icons] || Users
  return <div className="rounded-xl border border-border/40 bg-white p-3.5 transition-all hover:shadow-sm"><div className="flex items-center gap-2.5"><div className={`flex h-9 w-9 items-center justify-center rounded-lg ${c}`}><I className={`h-4 w-4 ${tc}`} /></div><div><p className={`text-lg font-bold ${tc}`}>{typeof value === 'number' ? value.toLocaleString() : value}</p><p className="text-[0.65rem] text-muted-foreground">{label}</p></div></div></div>
}
function Sec({ title, icon, children }: { title: string; icon: any; children: React.ReactNode }) {
  const I = icons[icon as keyof typeof icons] || Users
  return <div className="rounded-xl border border-border/40 bg-white p-4"><div className="mb-3 flex items-center gap-2"><I className="h-4 w-4 text-burgundy" /><h3 className="text-sm font-bold text-foreground">{title}</h3></div>{children}</div>
}
function M({ l, v, g, w, b }: { l: string; v: number | string; g?: boolean; w?: boolean; b?: boolean }) {
  const c = g ? 'text-emerald-600' : w ? 'text-amber-600' : b ? 'text-red-500' : 'text-foreground'
  return <div className="flex items-center justify-between rounded-lg bg-ivory/60 px-3 py-2"><span className="text-xs text-muted-foreground">{l}</span><span className={`text-sm font-semibold ${c}`}>{typeof v === 'number' ? v.toLocaleString() : v}</span></div>
}
function Inp({ label, value, onChange, type = 'text' }: { label: string; value: string | number; onChange: (v: string) => void; type?: string }) {
  return <div><label className="mb-1 block text-xs font-medium text-foreground">{label}</label><input type={type} value={value} onChange={e => onChange(e.target.value)} className="h-10 w-full rounded-lg border border-border/60 bg-white px-3 text-sm text-foreground transition-all focus:border-burgundy/30 focus:outline-none focus:ring-2 focus:ring-burgundy/10" /></div>
}
function Sel({ label, value, onChange, opts }: { label: string; value: string; onChange: (v: string) => void; opts: string[] }) {
  return <div><label className="mb-1 block text-xs font-medium text-foreground">{label}</label><select value={value} onChange={e => onChange(e.target.value)} className="h-10 w-full rounded-lg border border-border/60 bg-white px-3 text-sm text-foreground transition-all focus:border-burgundy/30 focus:outline-none focus:ring-2 focus:ring-burgundy/10">{opts.map(o => <option key={o} value={o}>{o}</option>)}</select></div>
}
function fmtC(a: number): string { if (a >= 100000) return `\u20b9${(a / 100000).toFixed(1)}L`; if (a >= 1000) return `\u20b9${(a / 1000).toFixed(1)}K`; return `\u20b9${a}` }