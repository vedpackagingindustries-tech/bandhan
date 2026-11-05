'use client'

// ═══════════════════════════════════════════════════════════════
// MY ACCOUNT — user-facing dashboard:
//   1. मेरे भुगतान (My Payments): UPI payment history + status +
//      printable receipt (blob fetch — Bearer protected API).
//   2. मेरी सदस्यता (My Subscriptions): per-module entitlements +
//      one-time free trial activation.
//   3. मेरे पसंदीदा (My Favourites): max 5 per module (server enforced).
// ═══════════════════════════════════════════════════════════════

import { useCallback, useEffect, useState } from 'react'
import {
  ArrowLeft, Heart, Briefcase, Search, Building2, ReceiptText,
  Crown, Loader2, X, Wallet, Sparkles, RefreshCw, ExternalLink, LogOut,
} from 'lucide-react'
import { BandhanLogo } from '@/components/shared/BandhanLogo'
import { apiGet, apiDelete, apiPost } from '@/lib/api'
import { useSession } from '@/hooks/use-session'
import { cn } from '@/lib/utils'

type TabId = 'payments' | 'subscriptions' | 'favourites'

interface PaymentRow {
  id: string
  amount: number
  status: string
  category: string | null
  module: string | null
  planLabel: string | null
  planName: string | null
  utr: string | null
  receiptNo: string | null
  paymentDate: string | null
  createdAt: string
  verifiedAt: string | null
}

interface SubscriptionRow {
  id: string
  module: string
  planName: string
  planLabel: string | null
  isTrial: boolean
  status: string
  startedAt: string
  expiresAt: string | null
}

interface SubscriptionsData {
  subscriptions: SubscriptionRow[]
  payments: PaymentRow[]
  entitlements: Record<string, { active: boolean; planLabel: string | null; expiresAt: string | null }>
  trialEligibility: { usedCount: number; modules: Record<string, boolean> }
}

interface FavItem {
  id: string
  module: string
  listingId: string
  createdAt: string
  listing: Record<string, unknown> | null
}

interface FavouritesData {
  items: FavItem[]
  limits: { max: number }
  counts: Record<string, number>
}

const MODULE_META: Record<string, { label: string; hi: string; icon: typeof Heart; color: string; bg: string; href: string }> = {
  MATRIMONY: { label: 'Matrimony', hi: 'मैट्रिमोनी', icon: Heart, color: 'text-burgundy', bg: 'bg-burgundy/8', href: '#matrimony' },
  BUSINESS: { label: 'Business', hi: 'बिज़नेस', icon: Briefcase, color: 'text-gold-dark', bg: 'bg-gold/10', href: '#business' },
  JOBS: { label: 'Jobs', hi: 'जॉब्स', icon: Search, color: 'text-teal', bg: 'bg-teal/8', href: '#jobs' },
  DIRECTORY: { label: 'Directory', hi: 'डायरेक्टरी', icon: Building2, color: 'text-burgundy-light', bg: 'bg-burgundy-light/8', href: '#directory' },
}

const STATUS_STYLE: Record<string, string> = {
  PENDING: 'bg-amber-50 text-amber-700 border-amber-200',
  UNDER_REVIEW: 'bg-blue-50 text-blue-700 border-blue-200',
  APPROVED: 'bg-emerald-50 text-emerald-700 border-emerald-200',
  SUCCESS: 'bg-emerald-50 text-emerald-700 border-emerald-200',
  REJECTED: 'bg-red-50 text-red-700 border-red-200',
  FAILED: 'bg-red-50 text-red-700 border-red-200',
  EXPIRED: 'bg-stone-100 text-stone-600 border-stone-200',
  CANCELLED: 'bg-stone-100 text-stone-600 border-stone-200',
  ACTIVE: 'bg-emerald-50 text-emerald-700 border-emerald-200',
}

const STATUS_HI: Record<string, string> = {
  PENDING: 'प्रतीक्षारत — प्रशासक जांच कर रहे हैं',
  UNDER_REVIEW: 'समीक्षा में',
  APPROVED: 'स्वीकृत ✓',
  SUCCESS: 'स्वीकृत ✓',
  REJECTED: 'अस्वीकृत',
  FAILED: 'विफल',
  ACTIVE: 'सक्रिय',
  EXPIRED: 'समाप्त',
  CANCELLED: 'रद्द',
}

function fmtIST(d: string | null | undefined): string {
  if (!d) return '—'
  try {
    return new Intl.DateTimeFormat('en-IN', { timeZone: 'Asia/Kolkata', dateStyle: 'medium', timeStyle: 'short' }).format(new Date(d))
  } catch { return '—' }
}

export function MyAccountView({ onBack }: { onBack: () => void }) {
  const { isLoggedIn, logout } = useSession()
  const [tab, setTab] = useState<TabId>('payments')
  const [data, setData] = useState<SubscriptionsData | null>(null)
  const [favs, setFavs] = useState<FavouritesData | null>(null)
  const [loading, setLoading] = useState(false)
  const [toast, setToast] = useState('')
  const [activating, setActivating] = useState<string | null>(null)
  const [receiptLoading, setReceiptLoading] = useState<string | null>(null)

  const showToast = (m: string) => { setToast(m); setTimeout(() => setToast(''), 3200) }

  const load = useCallback(async (): Promise<void> => {
    if (!isLoggedIn) return
    setLoading(true)
    const [subRes, favRes] = await Promise.all([
      apiGet<SubscriptionsData>('/subscriptions'),
      apiGet<FavouritesData>('/favourites', { limit: 100 }),
    ])
    if (subRes.ok) setData(subRes.data)
    if (favRes.ok) setFavs(favRes.data)
    setLoading(false)
  }, [isLoggedIn])

  useEffect(() => {
    let cancelled = false
    const run = async () => {
      const [subRes, favRes] = await Promise.all([
        apiGet<SubscriptionsData>('/subscriptions'),
        apiGet<FavouritesData>('/favourites', { limit: 100 }),
      ])
      if (cancelled) return
      if (subRes.ok) setData(subRes.data)
      if (favRes.ok) setFavs(favRes.data)
    }
    run()
    return () => { cancelled = true }
  }, [isLoggedIn])

  // Open the Bearer-protected HTML receipt via a fetched blob
  const openReceipt = async (paymentId: string) => {
    setReceiptLoading(paymentId)
    try {
      const { getSession } = await import('@/lib/session')
      const token = getSession()?.token
      const res = await fetch(`/api/v1/payments/${paymentId}/receipt`, {
        headers: token ? { Authorization: `Bearer ${token}` } : undefined,
      })
      if (!res.ok) { showToast('रसीद उपलब्ध नहीं है — केवल स्वीकृत भुगतान की रसीद देखी जा सकती है।'); setReceiptLoading(null); return }
      const html = await res.text()
      const url = URL.createObjectURL(new Blob([html], { type: 'text/html' }))
      window.open(url, '_blank', 'noopener')
      setTimeout(() => URL.revokeObjectURL(url), 60_000)
    } catch { showToast('नेटवर्क त्रुटि — रसीद नहीं खुली।') }
    setReceiptLoading(null)
  }

  const activateTrial = async (module: string) => {
    setActivating(module)
    const res = await apiPost<{ message: string }>('/subscriptions/trial', { module })
    showToast(res.ok ? res.data.message : res.error)
    if (res.ok) await load()
    setActivating(null)
  }

  const removeFavourite = async (fav: FavItem) => {
    const res = await apiDelete(`/favourites?id=${fav.id}`)
    if (res.ok) {
      setFavs((prev) => prev ? {
        ...prev,
        items: prev.items.filter((i) => i.id !== fav.id),
        counts: { ...prev.counts, [fav.module]: Math.max(0, (prev.counts[fav.module] ?? 1) - 1) },
      } : prev)
      showToast('पसंदीदा से हटा दिया गया। (Removed from favourites)')
    } else showToast(res.error)
  }

  // ─── Logged-out gate ───
  if (!isLoggedIn) {
    return (
      <div className="flex min-h-screen flex-col bg-ivory">
        <AccountHeader onBack={onBack} />
        <main className="flex flex-1 items-center justify-center px-4 py-16">
          <div className="w-full max-w-sm rounded-2xl border border-border/40 bg-white p-8 text-center shadow-sm">
            <Crown className="mx-auto h-10 w-10 text-burgundy" />
            <h1 className="mt-3 font-serif text-lg font-bold text-foreground">मेरा खाता (My Account)</h1>
            <p className="mt-2 text-xs leading-relaxed text-muted-foreground">
              कृपया पहले लॉग इन करें। मैट्रिमोनी / बिज़नेस / जॉब्स पेज पर जाकर लॉग इन या रजिस्टर करें।
            </p>
            <button onClick={onBack} className="btn-bandhan-primary mt-5 w-full text-sm">होम पर जाएं</button>
          </div>
        </main>
      </div>
    )
  }

  const payments = data?.payments ?? []
  const maxFav = favs?.limits.max ?? 5

  return (
    <div className="flex min-h-screen flex-col bg-ivory">
      <AccountHeader onBack={onBack} onRefresh={load} refreshing={loading} onLogout={logout} />

      <main className="mx-auto w-full max-w-5xl flex-1 px-4 py-6 sm:px-6">
        {/* Tabs */}
        <div className="flex gap-1.5 overflow-x-auto rounded-2xl border border-border/40 bg-white p-1.5">
          {([
            { id: 'payments' as TabId, label: 'मेरे भुगतान', icon: Wallet, count: payments.length },
            { id: 'subscriptions' as TabId, label: 'मेरी सदस्यता', icon: Crown, count: Object.values(data?.entitlements ?? {}).filter((e) => e.active).length },
            { id: 'favourites' as TabId, label: 'मेरे पसंदीदा', icon: Heart, count: favs?.items.length ?? 0 },
          ]).map(({ id, label, icon: Icon, count }) => (
            <button
              key={id}
              onClick={() => setTab(id)}
              className={cn(
                'flex flex-1 items-center justify-center gap-1.5 whitespace-nowrap rounded-xl px-3 py-2.5 text-xs font-semibold transition-all sm:text-sm',
                tab === id ? 'bg-burgundy text-white shadow-sm' : 'text-foreground/60 hover:bg-cream'
              )}
            >
              <Icon className="h-4 w-4" />
              {label}
              <span className={cn('rounded-full px-1.5 py-0.5 text-[0.6rem]', tab === id ? 'bg-white/20' : 'bg-cream text-muted-foreground')}>{count}</span>
            </button>
          ))}
        </div>

        {/* ─── PAYMENTS ─── */}
        {tab === 'payments' && (
          <section className="mt-5 space-y-3">
            <p className="rounded-xl border border-gold/30 bg-gold/5 px-4 py-2.5 text-[0.68rem] leading-relaxed text-foreground/70">
              ⚠️ UTR जमा करना भुगतान का प्रमाण नहीं है — प्रीमियम तभी सक्रिय होगा जब प्रशासक वास्तविक बैंक/UPI लेनदेन की पुष्टि करेंगे।
              (UTR submission is not proof — activation happens only after admin verifies the actual bank/UPI transaction.)
            </p>
            {payments.length === 0 ? (
              <EmptyBlock
                icon={<Wallet className="h-8 w-8" />}
                title="अभी कोई भुगतान नहीं"
                body="किसी मॉड्यूल का प्रीमियम खरीदने पर भुगतान यहां दिखेगा।"
              />
            ) : payments.map((p) => (
              <div key={p.id} className="rounded-2xl border border-border/40 bg-white p-4 sm:p-5">
                <div className="flex flex-wrap items-start justify-between gap-2">
                  <div>
                    <div className="flex items-center gap-2">
                      <h3 className="text-sm font-bold text-foreground">{p.planLabel ?? p.planName ?? 'प्रीमियम'}</h3>
                      {p.module && (
                        <span className={cn('rounded-full px-2 py-0.5 text-[0.6rem] font-semibold', MODULE_META[p.module]?.bg, MODULE_META[p.module]?.color)}>
                          {MODULE_META[p.module]?.hi ?? p.module}
                        </span>
                      )}
                    </div>
                    <p className="mt-0.5 text-[0.65rem] text-muted-foreground">
                      {p.receiptNo ? `रसीद: ${p.receiptNo} · ` : ''}जमा: {fmtIST(p.createdAt)}
                      {p.paymentDate ? ` · भुगतान तिथि: ${p.paymentDate}` : ''}
                    </p>
                  </div>
                  <div className="text-right">
                    <p className="text-lg font-bold text-burgundy">₹{p.amount.toLocaleString('en-IN')}</p>
                    <span className={cn('mt-0.5 inline-block rounded-full border px-2 py-0.5 text-[0.6rem] font-semibold', STATUS_STYLE[p.status] ?? 'bg-stone-100 text-stone-600 border-stone-200')}>
                      {STATUS_HI[p.status] ?? p.status}
                    </span>
                  </div>
                </div>
                {p.utr && <p className="mt-2 text-[0.65rem] text-muted-foreground">UTR: <span className="font-mono font-semibold text-foreground/70">{p.utr}</span>{p.verifiedAt ? ` · सत्यापित: ${fmtIST(p.verifiedAt)}` : ''}</p>}
                {['APPROVED', 'SUCCESS'].includes(p.status) && (
                  <button
                    onClick={() => openReceipt(p.id)}
                    disabled={receiptLoading === p.id}
                    className="mt-3 inline-flex items-center gap-1.5 rounded-xl border border-burgundy/30 bg-burgundy/5 px-3 py-1.5 text-[0.68rem] font-semibold text-burgundy transition-all hover:bg-burgundy/10 disabled:opacity-50"
                  >
                    {receiptLoading === p.id ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <ReceiptText className="h-3.5 w-3.5" />}
                    रसीद देखें (View Receipt)
                  </button>
                )}
                {p.status === 'REJECTED' && (
                  <p className="mt-2 text-[0.65rem] text-red-600">भुगतान सत्यापित नहीं हो सका। कृपया प्रशासक से संपर्क करें या सही UTR के साथ पुनः प्रयास करें।</p>
                )}
              </div>
            ))}
          </section>
        )}

        {/* ─── SUBSCRIPTIONS ─── */}
        {tab === 'subscriptions' && (
          <section className="mt-5 grid gap-3 sm:grid-cols-2">
            {Object.entries(MODULE_META).map(([mod, meta]) => {
              const ent = data?.entitlements?.[mod] ?? { active: false, planLabel: null, expiresAt: null }
              const trialEligible = data?.trialEligibility?.modules?.[mod] === true
              const Icon = meta.icon
              return (
                <div key={mod} className="rounded-2xl border border-border/40 bg-white p-5">
                  <div className="flex items-center justify-between">
                    <div className="flex items-center gap-2.5">
                      <span className={cn('flex h-10 w-10 items-center justify-center rounded-xl', meta.bg)}>
                        <Icon className={cn('h-5 w-5', meta.color)} />
                      </span>
                      <div>
                        <h3 className="text-sm font-bold text-foreground">{meta.hi} <span className="font-normal text-muted-foreground">· {meta.label}</span></h3>
                        <p className="text-[0.65rem] text-muted-foreground">स्वतंत्र सदस्यता — अन्य मॉड्यूल से अलग</p>
                      </div>
                    </div>
                    <span className={cn('rounded-full border px-2 py-0.5 text-[0.6rem] font-semibold', ent.active ? STATUS_STYLE.ACTIVE : STATUS_STYLE.EXPIRED)}>
                      {ent.active ? 'सक्रिय' : 'निष्क्रिय'}
                    </span>
                  </div>
                  {ent.active ? (
                    <div className="mt-3.5 rounded-xl bg-emerald-50/60 px-3.5 py-2.5">
                      <p className="flex items-center gap-1.5 text-xs font-semibold text-emerald-700">
                        <Crown className="h-3.5 w-3.5" /> {ent.planLabel ?? 'प्रीमियम'}
                      </p>
                      <p className="mt-0.5 text-[0.65rem] text-emerald-700/80">समाप्ति: {fmtIST(ent.expiresAt)}</p>
                    </div>
                  ) : (
                    <div className="mt-3.5 space-y-2.5">
                      {trialEligible && mod !== 'DIRECTORY' && (
                        <button
                          onClick={() => activateTrial(mod)}
                          disabled={activating === mod}
                          className="flex w-full items-center justify-center gap-1.5 rounded-xl border border-gold/40 bg-gold/10 py-2 text-xs font-bold text-gold-dark transition-all hover:bg-gold/20 disabled:opacity-50"
                        >
                          {activating === mod ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <Sparkles className="h-3.5 w-3.5" />}
                          मुफ़्त ट्रायल सक्रिय करें (7 दिन)
                        </button>
                      )}
                      <a href={meta.href} className="flex w-full items-center justify-center gap-1.5 rounded-xl bg-gradient-to-r from-burgundy to-burgundy-light py-2 text-xs font-bold text-white transition-all hover:shadow-md">
                        प्रीमियम खरीदें <ExternalLink className="h-3 w-3" />
                      </a>
                    </div>
                  )}
                </div>
              )
            })}
            <p className="sm:col-span-2 rounded-xl border border-border/40 bg-white px-4 py-2.5 text-center text-[0.65rem] text-muted-foreground">
              उपयोग किए गए ट्रायल: {data?.trialEligibility?.usedCount ?? 0} / 3 · प्रत्येक मॉड्यूल का ट्रायल जीवन में एक बार ही।
            </p>
          </section>
        )}

        {/* ─── FAVOURITES ─── */}
        {tab === 'favourites' && (
          <section className="mt-5 space-y-3">
            <div className="grid grid-cols-3 gap-2">
              {(['MATRIMONY', 'BUSINESS', 'JOBS'] as const).map((mod) => {
                const meta = MODULE_META[mod]
                const Icon = meta.icon
                const c = favs?.counts?.[mod] ?? 0
                return (
                  <div key={mod} className={cn('rounded-xl border border-border/40 bg-white px-3 py-2.5 text-center')}>
                    <Icon className={cn('mx-auto h-4 w-4', meta.color)} />
                    <p className="mt-1 text-[0.65rem] font-medium text-muted-foreground">{meta.hi}</p>
                    <p className="text-sm font-bold text-foreground">{c} <span className="text-[0.6rem] font-normal text-muted-foreground">/ {maxFav}</span></p>
                  </div>
                )
              })}
            </div>
            <p className="rounded-xl border border-gold/30 bg-gold/5 px-4 py-2 text-[0.68rem] text-foreground/70">
              प्रत्येक श्रेणी में अधिकतम {maxFav} पसंदीदा (सर्वर-प्रवर्तित)। Max {maxFav} favourites per category.
            </p>
            {(favs?.items.length ?? 0) === 0 ? (
              <EmptyBlock
                icon={<Heart className="h-8 w-8" />}
                title="अभी कोई पसंदीदा नहीं"
                body="लिस्टिंग खोलकर ❤️ बटन दबाएं — यहां सेव होगा।"
              />
            ) : favs!.items.map((f) => {
              const meta = MODULE_META[f.module] ?? MODULE_META.BUSINESS
              const Icon = meta.icon
              const l = f.listing as Record<string, unknown> | null
              const lo = (l ?? {}) as { profile?: { firstName?: string | null; lastName?: string | null; displayName?: string | null }; name?: string; title?: string }
              const title = f.module === 'MATRIMONY'
                ? [lo.profile?.firstName, lo.profile?.lastName].filter(Boolean).join(' ') || lo.profile?.displayName || 'प्रोफ़ाइल'
                : f.module === 'JOBS'
                  ? String(lo.title ?? 'जॉब')
                  : String(lo.name ?? 'लिस्टिंग')
              return (
                <div key={f.id} className="flex items-center gap-3 rounded-2xl border border-border/40 bg-white p-3.5">
                  <span className={cn('flex h-10 w-10 flex-shrink-0 items-center justify-center rounded-xl', meta.bg)}>
                    <Icon className={cn('h-5 w-5', meta.color)} />
                  </span>
                  <div className="min-w-0 flex-1">
                    <p className="truncate text-sm font-semibold text-foreground">{title}</p>
                    <p className="text-[0.62rem] text-muted-foreground">{meta.hi} · जोड़ा गया: {fmtIST(f.createdAt)}</p>
                  </div>
                  <a href={meta.href} className="rounded-lg p-2 text-burgundy transition-all hover:bg-cream" aria-label="Open listing">
                    <ExternalLink className="h-4 w-4" />
                  </a>
                  <button onClick={() => removeFavourite(f)} className="rounded-lg p-2 text-red-400 transition-all hover:bg-red-50 hover:text-red-600" aria-label="Remove favourite">
                    <X className="h-4 w-4" />
                  </button>
                </div>
              )
            })}
          </section>
        )}
      </main>

      {toast && (
        <div className="fixed bottom-5 left-1/2 z-[80] -translate-x-1/2 rounded-xl bg-foreground px-4 py-2.5 text-xs font-medium text-white shadow-lg">
          {toast}
        </div>
      )}
    </div>
  )
}

function AccountHeader({ onBack, onRefresh, refreshing, onLogout }: {
  onBack: () => void
  onRefresh?: () => void
  refreshing?: boolean
  onLogout?: () => void
}) {
  return (
    <header className="sticky top-0 z-40 border-b border-border/40 bg-white/90 backdrop-blur-xl">
      <div className="mx-auto flex h-14 max-w-7xl items-center justify-between px-4 sm:px-6 md:h-16">
        <div className="flex items-center gap-3">
          <button onClick={onBack} className="flex h-9 w-9 items-center justify-center rounded-xl transition-all hover:bg-cream" aria-label="Back">
            <ArrowLeft className="h-5 w-5 text-foreground" />
          </button>
          <BandhanLogo />
        </div>
        <div className="flex items-center gap-1.5">
          {onRefresh && (
            <button onClick={onRefresh} className="flex h-9 w-9 items-center justify-center rounded-xl transition-all hover:bg-cream" aria-label="Refresh">
              <RefreshCw className={cn('h-4 w-4 text-foreground/70', refreshing && 'animate-spin')} />
            </button>
          )}
          {onLogout && (
            <button onClick={onLogout} className="flex h-9 items-center gap-1.5 rounded-xl px-3 text-xs font-semibold text-red-500 transition-all hover:bg-red-50" aria-label="Logout">
              <LogOut className="h-4 w-4" /> <span className="hidden sm:inline">लॉग आउट</span>
            </button>
          )}
        </div>
      </div>
    </header>
  )
}

function EmptyBlock({ icon, title, body }: { icon: React.ReactNode; title: string; body: string }) {
  return (
    <div className="flex flex-col items-center justify-center rounded-2xl border border-dashed border-border/60 bg-white/60 px-6 py-14 text-center">
      <span className="text-burgundy/30">{icon}</span>
      <h3 className="mt-3 text-sm font-bold text-foreground">{title}</h3>
      <p className="mt-1 max-w-xs text-xs leading-relaxed text-muted-foreground">{body}</p>
    </div>
  )
}
