'use client'

// ═══════════════════════════════════════════════════════════════
// MASTER ADMIN — Payments, Revenue, Connections, Showcase, Reports
// Tabs for the SuperAdminPanel. All data comes from real production
// APIs; approvals are atomic; revenue counts VERIFIED payments only.
// ═══════════════════════════════════════════════════════════════

import { useState, useEffect, useCallback } from 'react'
import {
  Check, X, Search, RefreshCw, Loader2, IndianRupee, Printer,
  FileSpreadsheet, MessageCircle, Trash2, Crown, AlertTriangle, Users,
} from 'lucide-react'

// Shared types
interface AdminJson { success?: boolean; error?: string; data?: Record<string, unknown> }
interface AdminApi { (url: string, opts?: RequestInit): Promise<AdminJson | null> }
type Toast = (msg: string) => void

const STATUS_STYLES: Record<string, string> = {
  PENDING: 'bg-amber-100 text-amber-800',
  APPROVED: 'bg-emerald-100 text-emerald-800',
  SUCCESS: 'bg-emerald-100 text-emerald-800',
  REJECTED: 'bg-red-100 text-red-800',
  REFUNDED: 'bg-sky-100 text-sky-800',
  INITIATED: 'bg-stone-100 text-stone-600',
  CANCELLED: 'bg-stone-100 text-stone-600',
  FAILED: 'bg-red-100 text-red-800',
}

const CATEGORY_LABELS: Record<string, string> = {
  MATRIMONY_PREMIUM: 'Matrimony', BUSINESS_PREMIUM: 'Business', JOBS_PREMIUM: 'Jobs',
  DIRECTORY_REGISTRATION: 'Directory', HERO_ADVERTISEMENT: 'Hero Ad', OTHER: 'Other',
  MEMBERSHIP: 'Membership', BUSINESS_FEATURED: 'Biz Featured', JOB_FEATURED: 'Job Featured',
  ADVERTISEMENT: 'Advertisement', SPONSORED_LISTING: 'Sponsored',
}

const fmtIST = new Intl.DateTimeFormat('en-IN', { timeZone: 'Asia/Kolkata', dateStyle: 'medium', timeStyle: 'short' })
const fmtINR = (n: number) => `₹${Number(n || 0).toLocaleString('en-IN', { maximumFractionDigits: 2 })}`

// ═══════════════════════════════════════════════════════════════
// 1. PAYMENTS — searchable register + approve/reject + receipt
// ═══════════════════════════════════════════════════════════════
interface PaymentRow {
  id: string; receiptNo: string | null; amount: number; status: string
  category: string | null; purpose: string; planLabel: string | null; utr: string | null
  paymentDate: string | null; createdAt: string; verifiedAt: string | null
  verificationNotes: string | null
  user?: { phone: string | null; email: string | null; profile?: { firstName: string | null; lastName: string | null } }
  verifiedBy?: { profile?: { firstName: string | null; lastName: string | null } } | null
}

export function PaymentsAdminTab({ api, showToast }: { api: AdminApi; showToast: Toast }) {
  const [rows, setRows] = useState<PaymentRow[]>([])
  const [total, setTotal] = useState(0)
  const [totalAmount, setTotalAmount] = useState(0)
  const [q, setQ] = useState('')
  const [status, setStatus] = useState('ALL')
  const [category, setCategory] = useState('ALL')
  const [loading, setLoading] = useState(false)
  const [busyId, setBusyId] = useState<string | null>(null)
  const [confirming, setConfirming] = useState<{ row: PaymentRow; action: 'APPROVE' | 'REJECT' } | null>(null)
  const [notes, setNotes] = useState('')

  const fetchRows = useCallback(async () => {
    setLoading(true)
    const params = new URLSearchParams({ limit: '50' })
    if (q) params.set('q', q)
    if (status !== 'ALL') params.set('status', status)
    if (category !== 'ALL') params.set('category', category)
    const d = await api(`/api/v1/admin/payments?${params}`)
    if (d?.data) {
      setRows(((d.data as Record<string, unknown>).items as PaymentRow[]) ?? [])
      setTotal(((d.data as Record<string, unknown>).total as number) ?? 0)
      setTotalAmount(((d.data as Record<string, unknown>).totalAmount as number) ?? 0)
    }
    setLoading(false)
  }, [api, q, status, category])

  useEffect(() => { fetchRows() }, [fetchRows])

  const act = async () => {
    if (!confirming) return
    setBusyId(confirming.row.id)
    const d = await api(`/api/v1/admin/payments/${confirming.row.id}`, {
      method: 'PATCH',
      body: JSON.stringify({ action: confirming.action, notes: notes || undefined }),
    })
    if (d?.success) {
      showToast(confirming.action === 'APPROVE' ? `✓ Approved — receipt ${((d.data as Record<string, unknown>)?.receiptNo as string) ?? ''}` : '✗ Rejected — revenue unchanged')
      setConfirming(null); setNotes('')
      fetchRows()
    } else {
      showToast(d?.error ?? 'Action failed')
    }
    setBusyId(null)
  }

  const nameOf = (r: PaymentRow) =>
    r.user?.profile ? [r.user.profile.firstName, r.user.profile.lastName].filter(Boolean).join(' ') : '—'

  return (
    <div className="space-y-4">
      <div className="flex flex-wrap items-center gap-2">
        <div className="relative flex-1 min-w-[180px]">
          <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
          <input value={q} onChange={(e) => setQ(e.target.value)} placeholder="Search: name / mobile / UTR / receipt / ID"
            className="h-10 w-full rounded-xl border border-border/60 bg-white pl-9 pr-3 text-xs focus:border-burgundy/30 focus:outline-none focus:ring-2 focus:ring-burgundy/10" />
        </div>
        <select value={status} onChange={(e) => setStatus(e.target.value)} className="h-10 rounded-xl border border-border/60 bg-white px-3 text-xs">
          {['ALL', 'PENDING', 'APPROVED', 'REJECTED', 'INITIATED', 'REFUNDED'].map((s) => <option key={s} value={s}>{s}</option>)}
        </select>
        <select value={category} onChange={(e) => setCategory(e.target.value)} className="h-10 rounded-xl border border-border/60 bg-white px-3 text-xs">
          {['ALL', 'MATRIMONY_PREMIUM', 'BUSINESS_PREMIUM', 'JOBS_PREMIUM', 'DIRECTORY_REGISTRATION', 'HERO_ADVERTISEMENT'].map((c) => <option key={c} value={c}>{c === 'ALL' ? 'ALL' : CATEGORY_LABELS[c]}</option>)}
        </select>
        <button onClick={fetchRows} className="flex h-10 items-center gap-1.5 rounded-xl border border-border/60 bg-white px-3 text-xs hover:bg-cream">
          <RefreshCw className={`h-3.5 w-3.5 ${loading ? 'animate-spin' : ''}`} /> Refresh
        </button>
        <span className="ml-auto text-xs text-muted-foreground">{total} payments · {fmtINR(totalAmount)}</span>
      </div>

      <div className="overflow-x-auto rounded-xl border border-border/40 bg-white">
        <table className="w-full min-w-[900px] text-left text-xs">
          <thead className="border-b border-border/40 bg-cream/60 text-[0.65rem] uppercase tracking-wider text-muted-foreground">
            <tr>
              <th className="px-3 py-2.5">Receipt / Txn</th>
              <th className="px-3 py-2.5">Customer</th>
              <th className="px-3 py-2.5">Category</th>
              <th className="px-3 py-2.5">Plan</th>
              <th className="px-3 py-2.5 text-right">Amount</th>
              <th className="px-3 py-2.5">UTR</th>
              <th className="px-3 py-2.5">Paid On (IST)</th>
              <th className="px-3 py-2.5">Status</th>
              <th className="px-3 py-2.5">Actions</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-border/30">
            {rows.length === 0 && (
              <tr><td colSpan={9} className="px-3 py-10 text-center text-muted-foreground">कोई भुगतान नहीं (No payments match the filters)</td></tr>
            )}
            {rows.map((r) => (
              <tr key={r.id} className="hover:bg-cream/30">
                <td className="px-3 py-2.5 font-mono text-[0.65rem]">{r.receiptNo ?? '—'}<br /><span className="text-muted-foreground">{r.id.slice(-8)}</span></td>
                <td className="px-3 py-2.5">{nameOf(r)}<br /><span className="text-muted-foreground">{r.user?.phone ?? ''}</span></td>
                <td className="px-3 py-2.5">{CATEGORY_LABELS[r.category ?? r.purpose] ?? r.category}</td>
                <td className="px-3 py-2.5">{r.planLabel ?? '—'}</td>
                <td className="px-3 py-2.5 text-right font-bold text-burgundy">{fmtINR(r.amount)}</td>
                <td className="px-3 py-2.5 font-mono text-[0.65rem]">{r.utr ?? '—'}</td>
                <td className="px-3 py-2.5">{r.paymentDate ? fmtIST.format(new Date(r.paymentDate)) : '—'}</td>
                <td className="px-3 py-2.5">
                  <span className={`rounded-full px-2 py-0.5 text-[0.6rem] font-bold ${STATUS_STYLES[r.status] ?? 'bg-stone-100'}`}>{r.status}</span>
                  {r.verifiedAt && <div className="mt-0.5 text-[0.6rem] text-muted-foreground">by {r.verifiedBy?.profile?.firstName ?? 'admin'}</div>}
                </td>
                <td className="px-3 py-2.5">
                  {r.status === 'PENDING' || (r.status === 'INITIATED' && r.utr) ? (
                    <div className="flex gap-1">
                      <button onClick={() => { setConfirming({ row: r, action: 'APPROVE' }); setNotes('') }}
                        className="rounded-lg bg-emerald-600 px-2 py-1 text-[0.6rem] font-bold text-white hover:bg-emerald-700">Approve</button>
                      <button onClick={() => { setConfirming({ row: r, action: 'REJECT' }); setNotes('') }}
                        className="rounded-lg bg-red-600 px-2 py-1 text-[0.6rem] font-bold text-white hover:bg-red-700">Reject</button>
                    </div>
                  ) : ['APPROVED', 'SUCCESS'].includes(r.status) ? (
                    <a href={`/api/v1/payments/${r.id}/receipt`} target="_blank" rel="noopener noreferrer"
                      className="inline-flex items-center gap-1 rounded-lg border border-border/60 px-2 py-1 text-[0.6rem] font-semibold hover:bg-cream">
                      <Printer className="h-3 w-3" /> Receipt
                    </a>
                  ) : <span className="text-muted-foreground">—</span>}
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      {confirming && (
        <div className="fixed inset-0 z-[80] flex items-center justify-center p-4">
          <div className="absolute inset-0 bg-black/40 backdrop-blur-sm" onClick={() => setConfirming(null)} />
          <div className="relative z-10 w-full max-w-sm rounded-2xl border border-border/40 bg-white p-6 shadow-2xl">
            <div className="flex items-center gap-2">
              <AlertTriangle className={`h-5 w-5 ${confirming.action === 'APPROVE' ? 'text-emerald-600' : 'text-red-600'}`} />
              <h3 className="text-sm font-bold">Confirm {confirming.action === 'APPROVE' ? 'Approval' : 'Rejection'}</h3>
            </div>
            <p className="mt-2 text-xs leading-relaxed text-muted-foreground">
              {confirming.action === 'APPROVE'
                ? `मैंने वास्तविक बैंक/UPI लेनदेन जांच लिया है। ₹${confirming.row.amount} का भुगतान मिला है। (I have verified the actual bank/UPI transaction — ${fmtINR(confirming.row.amount)} was received.) Plan activates immediately and cannot be undone.`
                : `भुगतान सत्यापित नहीं हो सका। राजस्व अपरिवर्तित रहेगा। (Payment could not be verified. Revenue remains unchanged.)`}
            </p>
            <div className="mt-2 rounded-lg bg-cream px-3 py-2 text-xs">
              <div className="flex justify-between"><span>{nameOf(confirming.row)} · {confirming.row.user?.phone ?? ''}</span></div>
              <div className="flex justify-between font-bold"><span>{CATEGORY_LABELS[confirming.row.category ?? ''] ?? ''} — {confirming.row.planLabel}</span><span>{fmtINR(confirming.row.amount)}</span></div>
              <div className="flex justify-between text-muted-foreground"><span>UTR</span><span className="font-mono">{confirming.row.utr ?? '—'}</span></div>
            </div>
            <textarea value={notes} onChange={(e) => setNotes(e.target.value)} rows={2} placeholder="Verification notes (optional)"
              className="mt-3 w-full rounded-xl border border-border/60 px-3 py-2 text-xs focus:border-burgundy/30 focus:outline-none" />
            <div className="mt-4 flex gap-2">
              <button onClick={() => setConfirming(null)} className="flex-1 rounded-xl border border-border/60 py-2.5 text-xs font-semibold hover:bg-cream">Cancel</button>
              <button onClick={act} disabled={busyId === confirming.row.id}
                className={`flex flex-1 items-center justify-center gap-1.5 rounded-xl py-2.5 text-xs font-bold text-white disabled:opacity-50 ${confirming.action === 'APPROVE' ? 'bg-emerald-600 hover:bg-emerald-700' : 'bg-red-600 hover:bg-red-700'}`}>
                {busyId === confirming.row.id && <Loader2 className="h-3.5 w-3.5 animate-spin" />}
                {confirming.action === 'APPROVE' ? 'हां, स्वीकृत करें' : 'हां, अस्वीकृत करें'}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}

// ═══════════════════════════════════════════════════════════════
// 2. REVENUE — category cards + date presets + trends
// ═══════════════════════════════════════════════════════════════
interface RevenueData {
  categories: Array<{ key: string; label: string; totalRevenue: number; totalTransactions: number; todayCollection: number; thisMonth: number; thisYear: number; pending: { count: number; amount: number }; rejected: { count: number } }>
  consolidated: { totalRevenue: number; totalTransactions: number; todayCollection: number; thisMonth: number; thisYear: number; pending: { count: number; amount: number }; rejected: { count: number } }
  range: { label: string; revenue: number; transactions: number; byCategory: Array<{ key: string; label: string; amount: number; count: number }> }
  series: { daily: Array<{ day: string; amount: number }>; monthly: Array<{ month: string; amount: number }>; yearly: Array<{ year: string; amount: number }> }
  topCustomers: Array<{ key: string; name: string; phone: string; count: number; amount: number }>
}

const PRESETS = [
  { key: 'today', label: 'आज' }, { key: 'yesterday', label: 'कल' },
  { key: 'last7days', label: '7 दिन' }, { key: 'last30days', label: '30 दिन' },
  { key: 'thisMonth', label: 'यह माह' }, { key: 'lastMonth', label: 'पिछला माह' },
  { key: 'thisYear', label: 'यह वर्ष' }, { key: 'lastYear', label: 'पिछला वर्ष' },
  { key: 'all', label: 'सभी' },
]

export function RevenueAdminTab({ api }: { api: AdminApi }) {
  const [data, setData] = useState<RevenueData | null>(null)
  const [preset, setPreset] = useState('last30days')
  const [loading, setLoading] = useState(false)

  const fetchRevenue = useCallback(async () => {
    setLoading(true)
    const d = await api(`/api/v1/admin/revenue?preset=${preset}`)
    if (d?.data) setData(d.data as unknown as RevenueData)
    setLoading(false)
  }, [api, preset])

  useEffect(() => { fetchRevenue() }, [fetchRevenue])

  if (!data) {
    return <div className="flex justify-center py-16"><Loader2 className="h-6 w-6 animate-spin text-burgundy" /></div>
  }

  const maxDaily = Math.max(1, ...data.series.daily.map((d) => d.amount))

  return (
    <div className="space-y-5">
      {/* Consolidated card */}
      <div className="rounded-2xl bg-gradient-to-r from-burgundy to-burgundy-light p-5 text-white">
        <div className="flex flex-wrap items-center justify-between gap-3">
          <div>
            <p className="text-[0.65rem] uppercase tracking-widest opacity-80">कुल सत्यापित राजस्व (Total verified revenue — all time)</p>
            <p className="mt-1 font-serif text-3xl font-bold">{fmtINR(data.consolidated.totalRevenue)}</p>
            <p className="mt-0.5 text-xs opacity-80">{data.consolidated.totalTransactions} verified transactions · आज {fmtINR(data.consolidated.todayCollection)} · यह माह {fmtINR(data.consolidated.thisMonth)} · यह वर्ष {fmtINR(data.consolidated.thisYear)}</p>
          </div>
          <div className="rounded-xl bg-white/15 px-4 py-3 text-center backdrop-blur">
            <p className="text-[0.6rem] uppercase tracking-wider opacity-80">Pending (not revenue)</p>
            <p className="text-lg font-bold">{fmtINR(data.consolidated.pending.amount)}</p>
            <p className="text-[0.6rem] opacity-80">{data.consolidated.pending.count} awaiting verification</p>
          </div>
        </div>
      </div>

      {/* Date presets */}
      <div className="flex flex-wrap gap-1.5">
        {PRESETS.map((p) => (
          <button key={p.key} onClick={() => setPreset(p.key)}
            className={`rounded-lg px-3 py-1.5 text-xs font-semibold transition-all ${preset === p.key ? 'bg-burgundy text-white' : 'border border-border/60 bg-white text-muted-foreground hover:bg-cream'}`}>
            {p.label}
          </button>
        ))}
        <span className="ml-auto self-center text-xs text-muted-foreground">
          {data.range.label}: <strong className="text-burgundy">{fmtINR(data.range.revenue)}</strong> ({data.range.transactions} txn)
        </span>
      </div>

      {/* Category cards */}
      <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
        {data.categories.map((c) => (
          <div key={c.key} className="rounded-2xl border border-border/40 bg-white p-4">
            <div className="flex items-center justify-between">
              <p className="text-xs font-bold text-foreground">{c.label}</p>
              <span className="rounded-full bg-burgundy/8 px-2 py-0.5 text-[0.6rem] font-bold text-burgundy">{c.totalTransactions} txn</span>
            </div>
            <p className="mt-2 font-serif text-xl font-bold text-burgundy">{fmtINR(c.totalRevenue)}</p>
            <div className="mt-2 grid grid-cols-3 gap-1 text-center text-[0.6rem]">
              <div className="rounded-lg bg-cream px-1 py-1.5"><p className="text-muted-foreground">आज</p><p className="font-bold">{fmtINR(c.todayCollection)}</p></div>
              <div className="rounded-lg bg-cream px-1 py-1.5"><p className="text-muted-foreground">माह</p><p className="font-bold">{fmtINR(c.thisMonth)}</p></div>
              <div className="rounded-lg bg-cream px-1 py-1.5"><p className="text-muted-foreground">वर्ष</p><p className="font-bold">{fmtINR(c.thisYear)}</p></div>
            </div>
            {(c.pending.count > 0 || c.rejected.count > 0) && (
              <p className="mt-2 text-[0.6rem] text-muted-foreground">
                {c.pending.count > 0 && <span className="text-amber-600">{c.pending.count} pending ({fmtINR(c.pending.amount)}) </span>}
                {c.rejected.count > 0 && <span className="text-red-500">{c.rejected.count} rejected</span>}
              </p>
            )}
          </div>
        ))}
      </div>

      {/* Daily trend (simple bars — no heavy chart lib needed) */}
      <div className="rounded-2xl border border-border/40 bg-white p-4">
        <p className="text-xs font-bold text-foreground">दैनिक संग्रह — अंतिम 30 दिन (Daily collection, IST)</p>
        <div className="mt-3 flex h-24 items-end gap-[3px]">
          {data.series.daily.map((d) => (
            <div key={d.day} className="group relative flex-1" title={`${d.day}: ${fmtINR(d.amount)}`}>
              <div className="w-full rounded-t bg-burgundy/70 transition-all group-hover:bg-burgundy" style={{ height: `${Math.max(2, (d.amount / maxDaily) * 96)}px` }} />
            </div>
          ))}
        </div>
        <div className="mt-1 flex justify-between text-[0.6rem] text-muted-foreground">
          <span>{data.series.daily[0]?.day}</span><span>{data.series.daily[data.series.daily.length - 1]?.day}</span>
        </div>
      </div>

      {/* Top customers */}
      {data.topCustomers.length > 0 && (
        <div className="rounded-2xl border border-border/40 bg-white p-4">
          <p className="text-xs font-bold text-foreground">ग्राहक-वार संग्रह (Customer-wise — verified)</p>
          <table className="mt-2 w-full text-left text-xs">
            <thead className="text-[0.6rem] uppercase text-muted-foreground"><tr><th className="py-1.5">Customer</th><th>Mobile</th><th className="text-right">Txns</th><th className="text-right">Total</th></tr></thead>
            <tbody className="divide-y divide-border/30">
              {data.topCustomers.map((c) => (
                <tr key={c.key}><td className="py-1.5">{c.name}</td><td className="font-mono text-[0.65rem]">{c.phone}</td><td className="text-right">{c.count}</td><td className="text-right font-bold">{fmtINR(c.amount)}</td></tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </div>
  )
}

// ═══════════════════════════════════════════════════════════════
// 3. CONNECTIONS — CONNECT requests with WhatsApp click-to-chat
// ═══════════════════════════════════════════════════════════════
interface ConnectionRow {
  id: string; module: string; listingId: string; status: string
  requesterName: string | null; requesterPhone: string | null; message: string | null
  adminNotes: string | null; ownerNotifiedVia: string | null; createdAt: string
  listingTitle: string | null
  requester?: { phone: string | null; profile?: { firstName: string | null; lastName: string | null; city: string | null } }
  owner?: { userId: string; name: string | null; phone: string | null; email: string | null } | null
  whatsappLinks?: { toOwner: string | null; toRequester: string | null }
}

const CONNECT_STATUSES = ['PENDING', 'CONTACTED', 'ACCEPTED', 'REJECTED', 'CLOSED']

export function ConnectionsAdminTab({ api, showToast }: { api: AdminApi; showToast: Toast }) {
  const [rows, setRows] = useState<ConnectionRow[]>([])
  const [status, setStatus] = useState('PENDING')
  const [loading, setLoading] = useState(false)

  const fetchRows = useCallback(async () => {
    setLoading(true)
    const d = await api(`/api/v1/admin/connect?status=${status}&limit=50`)
    if (d?.data) setRows(((d.data as Record<string, unknown>).items as ConnectionRow[]) ?? [])
    setLoading(false)
  }, [api, status])

  useEffect(() => { fetchRows() }, [fetchRows])

  const update = async (id: string, newStatus: string, ownerNotifiedVia?: string) => {
    const d = await api(`/api/v1/admin/connect/${id}`, {
      method: 'PATCH',
      body: JSON.stringify({ status: newStatus, ...(ownerNotifiedVia ? { ownerNotifiedVia } : {}) }),
    })
    if (d?.success) { showToast(`✓ ${newStatus}`); fetchRows() }
    else showToast(d?.error ?? 'Failed')
  }

  return (
    <div className="space-y-4">
      <div className="flex flex-wrap gap-1.5">
        {CONNECT_STATUSES.map((s) => (
          <button key={s} onClick={() => setStatus(s)}
            className={`rounded-lg px-3 py-1.5 text-xs font-semibold ${status === s ? 'bg-burgundy text-white' : 'border border-border/60 bg-white text-muted-foreground hover:bg-cream'}`}>{s}</button>
        ))}
        <button onClick={fetchRows} className="ml-auto flex items-center gap-1.5 rounded-lg border border-border/60 bg-white px-3 py-1.5 text-xs hover:bg-cream">
          <RefreshCw className={`h-3.5 w-3.5 ${loading ? 'animate-spin' : ''}`} /> Refresh
        </button>
      </div>

      <div className="space-y-3">
        {rows.length === 0 && <p className="py-10 text-center text-sm text-muted-foreground">कोई अनुरोध नहीं (No requests)</p>}
        {rows.map((r) => (
          <div key={r.id} className="rounded-2xl border border-border/40 bg-white p-4">
            <div className="flex flex-wrap items-start justify-between gap-3">
              <div className="min-w-0">
                <div className="flex flex-wrap items-center gap-2">
                  <span className="rounded-full bg-burgundy/8 px-2 py-0.5 text-[0.6rem] font-bold text-burgundy">{r.module}</span>
                  <span className={`rounded-full px-2 py-0.5 text-[0.6rem] font-bold ${STATUS_STYLES[r.status] ?? ''}`}>{r.status}</span>
                  <span className="text-[0.6rem] text-muted-foreground">{fmtIST.format(new Date(r.createdAt))}</span>
                </div>
                <p className="mt-1.5 text-sm font-bold text-foreground">
                  {r.requesterName ?? r.requester?.profile?.firstName ?? '—'}
                  <span className="ml-2 font-mono text-xs font-normal text-muted-foreground">{r.requesterPhone ?? r.requester?.phone ?? ''}</span>
                </p>
                <p className="text-xs text-muted-foreground">
                  → <span className="font-semibold text-foreground/80">{r.listingTitle ?? r.listingId}</span> ({r.module.toLowerCase()} listing)
                </p>
                {r.message && <p className="mt-1 rounded-lg bg-cream px-2.5 py-1.5 text-xs italic text-foreground/70">“{r.message}”</p>}
                {/* Listing owner — ADMIN ONLY view */}
                {r.owner && (
                  <p className="mt-1.5 text-[0.65rem] text-muted-foreground">
                    Owner: <span className="font-semibold text-foreground/80">{r.owner.name ?? '—'}</span> · <span className="font-mono">{r.owner.phone ?? 'no phone'}</span> {r.owner.email ? `· ${r.owner.email}` : ''}
                  </p>
                )}
              </div>
              <div className="flex flex-col items-end gap-2">
                <div className="flex flex-wrap justify-end gap-1">
                  {r.status === 'PENDING' && (
                    <button onClick={() => update(r.id, 'CONTACTED')} className="rounded-lg bg-sky-600 px-2.5 py-1 text-[0.6rem] font-bold text-white hover:bg-sky-700">Mark Contacted</button>
                  )}
                  {['PENDING', 'CONTACTED'].includes(r.status) && (
                    <>
                      <button onClick={() => update(r.id, 'ACCEPTED')} className="rounded-lg bg-emerald-600 px-2.5 py-1 text-[0.6rem] font-bold text-white hover:bg-emerald-700">Accept</button>
                      <button onClick={() => update(r.id, 'REJECTED')} className="rounded-lg bg-red-600 px-2.5 py-1 text-[0.6rem] font-bold text-white hover:bg-red-700">Reject</button>
                    </>
                  )}
                  {r.status !== 'CLOSED' && (
                    <button onClick={() => update(r.id, 'CLOSED')} className="rounded-lg border border-border/60 px-2.5 py-1 text-[0.6rem] font-bold hover:bg-cream">Close</button>
                  )}
                </div>
                {/* WhatsApp click-to-chat — admin-authorized workflow */}
                {r.whatsappLinks?.toOwner && (
                  <a href={r.whatsappLinks.toOwner} target="_blank" rel="noopener noreferrer" onClick={() => update(r.id, r.status === 'PENDING' ? 'CONTACTED' : r.status, 'WHATSAPP')}
                    className="inline-flex items-center gap-1.5 rounded-lg bg-[#25D366]/10 px-2.5 py-1 text-[0.6rem] font-bold text-[#128C7E] hover:bg-[#25D366]/20">
                    <MessageCircle className="h-3 w-3" /> WhatsApp मालिक से
                  </a>
                )}
                {r.whatsappLinks?.toRequester && (
                  <a href={r.whatsappLinks.toRequester} target="_blank" rel="noopener noreferrer"
                    className="inline-flex items-center gap-1.5 rounded-lg bg-sky-50 px-2.5 py-1 text-[0.6rem] font-bold text-sky-700 hover:bg-sky-100">
                    <MessageCircle className="h-3 w-3" /> WhatsApp ग्राहक से
                  </a>
                )}
              </div>
            </div>
          </div>
        ))}
      </div>
    </div>
  )
}

// ═══════════════════════════════════════════════════════════════
// 4. SHOWCASE — monthly top-10 management
// ═══════════════════════════════════════════════════════════════
interface ShowcaseRow {
  id: string; module: string; listingId: string; title: string | null; subtitle: string | null
  rank: number; score: number | null; status: string; startsAt: string; endsAt: string
}

export function ShowcaseAdminTab({ api, showToast }: { api: AdminApi; showToast: Toast }) {
  const [rows, setRows] = useState<ShowcaseRow[]>([])
  const [loading, setLoading] = useState(false)
  const [generating, setGenerating] = useState(false)

  const fetchRows = useCallback(async () => {
    setLoading(true)
    const d = await api('/api/v1/admin/showcase')
    if (d?.data) setRows(((d.data as Record<string, unknown>).items as ShowcaseRow[]) ?? [])
    setLoading(false)
  }, [api])

  useEffect(() => { fetchRows() }, [fetchRows])

  const generate = async () => {
    setGenerating(true)
    const d = await api('/api/v1/admin/showcase', { method: 'POST', body: JSON.stringify({}) })
    if (d?.success) showToast(`✓ Generated: ${JSON.stringify((d.data as Record<string, unknown>)?.generated)}`)
    else showToast(d?.error ?? 'Generation failed')
    fetchRows()
    setGenerating(false)
  }

  const remove = async (id: string) => {
    const d = await api('/api/v1/admin/showcase', { method: 'PATCH', body: JSON.stringify({ id, action: 'REMOVE' }) })
    if (d?.success) { showToast('✓ Removed'); fetchRows() }
  }

  const moduleColors: Record<string, string> = { MATRIMONY: 'bg-burgundy', BUSINESS: 'bg-gold-dark', JOBS: 'bg-teal' }

  return (
    <div className="space-y-4">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <p className="text-xs leading-relaxed text-muted-foreground">
          मासिक टॉप-10 (प्रति श्रेणी) — केवल वास्तविक सत्यापित प्रीमियम लिस्टिंग। हीरो में <strong>2 दिन</strong> के लिए दिखाई देता है, फिर स्वतः समाप्त।
        </p>
        <button onClick={generate} disabled={generating}
          className="flex items-center gap-1.5 rounded-xl bg-burgundy px-4 py-2 text-xs font-bold text-white hover:bg-burgundy-light disabled:opacity-50">
          {generating ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <Crown className="h-3.5 w-3.5" />}
          Generate / Refresh Top 10
        </button>
      </div>

      {rows.length === 0 && !loading && (
        <div className="rounded-2xl border border-dashed border-border/60 py-10 text-center">
          <Crown className="mx-auto h-8 w-8 text-muted-foreground/40" />
          <p className="mt-2 text-xs text-muted-foreground">इस माह का शोकेस तैयार नहीं है। Generate दबाएं।<br />प्रीमियम लिस्टिंग होने पर ही प्रविष्टियां बनती हैं।</p>
        </div>
      )}

      {(['MATRIMONY', 'BUSINESS', 'JOBS'] as const).map((mod) => {
        const items = rows.filter((r) => r.module === mod)
        if (items.length === 0) return null
        return (
          <div key={mod} className="rounded-2xl border border-border/40 bg-white p-4">
            <div className="flex items-center gap-2">
              <span className={`rounded-lg ${moduleColors[mod]} px-2 py-0.5 text-[0.6rem] font-bold text-white`}>{mod}</span>
              <span className="text-xs font-bold text-foreground">Top {items.length}</span>
            </div>
            <div className="mt-3 grid gap-2 sm:grid-cols-2">
              {items.map((r) => (
                <div key={r.id} className="flex items-center gap-3 rounded-xl border border-border/30 p-2.5">
                  <span className="flex h-7 w-7 flex-shrink-0 items-center justify-center rounded-full bg-gold/15 text-xs font-bold text-gold-dark">#{r.rank}</span>
                  <div className="min-w-0 flex-1">
                    <p className="truncate text-xs font-semibold text-foreground">{r.title}</p>
                    <p className="truncate text-[0.65rem] text-muted-foreground">{r.subtitle ?? ''} · score {r.score?.toFixed(0)}</p>
                  </div>
                  <button onClick={() => remove(r.id)} className="rounded-lg p-1.5 text-red-400 hover:bg-red-50" aria-label="Remove">
                    <Trash2 className="h-3.5 w-3.5" />
                  </button>
                </div>
              ))}
            </div>
          </div>
        )
      })}
    </div>
  )
}

// ═══════════════════════════════════════════════════════════════
// 5. REPORTS — Excel export + print
// ═══════════════════════════════════════════════════════════════
const REPORT_TYPES = [
  { key: 'COMPLETE', label: 'Complete Revenue', hi: 'संपूर्ण राजस्व' },
  { key: 'MATRIMONY', label: 'Matrimony Revenue', hi: 'मैट्रिमोनी' },
  { key: 'BUSINESS', label: 'Business Revenue', hi: 'बिज़नेस' },
  { key: 'JOBS', label: 'Jobs Revenue', hi: 'जॉब्स' },
  { key: 'DIRECTORY', label: 'Directory Revenue', hi: 'डायरेक्टरी' },
  { key: 'HERO_AD', label: 'Hero Ad Revenue', hi: 'हीरो विज्ञापन' },
  { key: 'PENDING', label: 'Pending Payments', hi: 'लंबित' },
  { key: 'APPROVED', label: 'Approved Payments', hi: 'स्वीकृत' },
  { key: 'REJECTED', label: 'Rejected Payments', hi: 'अस्वीकृत' },
  { key: 'CUSTOMER', label: 'Customer-wise', hi: 'ग्राहक-वार' },
  { key: 'DAILY', label: 'Daily Collection', hi: 'दैनिक' },
  { key: 'MONTHLY', label: 'Monthly Collection', hi: 'मासिक' },
  { key: 'YEARLY', label: 'Yearly Collection', hi: 'वार्षिक' },
]

export function ReportsAdminTab({ token, showToast }: { token: string | null; showToast: Toast }) {
  const [preset, setPreset] = useState('thisMonth')
  const [startDate, setStartDate] = useState('')
  const [endDate, setEndDate] = useState('')

  const url = (type: string, format: 'xlsx' | 'print') => {
    const params = new URLSearchParams({ type, preset })
    if (preset === 'custom') {
      if (startDate) params.set('startDate', startDate)
      if (endDate) params.set('endDate', endDate)
    }
    return format === 'xlsx'
      ? `/api/v1/admin/reports/export?${params}`
      : `/admin/reports/print?${params}`
  }

  return (
    <div className="space-y-4">
      <div className="flex flex-wrap items-center gap-2">
        <select value={preset} onChange={(e) => setPreset(e.target.value)} className="h-10 rounded-xl border border-border/60 bg-white px-3 text-xs">
          {PRESETS.map((p) => <option key={p.key} value={p.key}>{p.label}</option>)}
          <option value="custom">कस्टम तिथि</option>
        </select>
        {preset === 'custom' && (
          <>
            <input type="date" value={startDate} onChange={(e) => setStartDate(e.target.value)} className="h-10 rounded-xl border border-border/60 px-3 text-xs" />
            <span className="text-xs text-muted-foreground">से</span>
            <input type="date" value={endDate} onChange={(e) => setEndDate(e.target.value)} className="h-10 rounded-xl border border-border/60 px-3 text-xs" />
          </>
        )}
      </div>

      <div className="grid gap-2.5 sm:grid-cols-2 lg:grid-cols-3">
        {REPORT_TYPES.map((r) => (
          <div key={r.key} className="flex items-center justify-between rounded-xl border border-border/40 bg-white p-3.5">
            <div>
              <p className="text-xs font-bold text-foreground">{r.label}</p>
              <p className="text-[0.65rem] text-muted-foreground">{r.hi}</p>
            </div>
            <div className="flex gap-1.5">
              <a href={url(r.key, 'xlsx')} onClick={() => showToast('📊 Excel report downloading…')}
                className="inline-flex items-center gap-1 rounded-lg bg-emerald-700 px-2.5 py-1.5 text-[0.6rem] font-bold text-white hover:bg-emerald-800">
                <FileSpreadsheet className="h-3 w-3" /> .xlsx
              </a>
            </div>
          </div>
        ))}
      </div>
      <p className="text-[0.65rem] leading-relaxed text-muted-foreground">
        Excel रिपोर्ट में: BANDHAN शीर्षक, तिथि सीमा, व्यावसायिक हेडर, INR प्रारूप, ऑटो-फ़िल्टर, फ्रोज़न हेडर, श्रेणी-वार योग और ग्रैंड टोटल शामिल हैं। केवल सत्यापित भुगतान राजस्व में गिने जाते हैं।
      </p>
    </div>
  )
}

// ═══════════════════════════════════════════════════════════════
// 6. MASTER SETTINGS — UPI ID + per-module pricing (admin controlled)
// ═══════════════════════════════════════════════════════════════
interface ModulePricingCfg {
  module: string
  freeListingDays: number
  trial: { enabled: boolean; days: number } | null
  plans: Array<{ name: string; label: string; days: number | null; price: number }>
  oneTimeOnly?: boolean
}

const SETTINGS_MODULES: Array<{ key: string; configKey: string; label: string }> = [
  { key: 'MATRIMONY', configKey: 'pricing.matrimony', label: 'Matrimony' },
  { key: 'BUSINESS', configKey: 'pricing.business', label: 'Business' },
  { key: 'JOBS', configKey: 'pricing.jobs', label: 'Jobs' },
  { key: 'DIRECTORY', configKey: 'pricing.directory', label: 'Directory' },
  { key: 'HERO_AD', configKey: 'pricing.heroAd', label: 'Hero Advertisement' },
]

export function MasterSettingsTab({ api, showToast }: { api: AdminApi; showToast: Toast }) {
  const [upiId, setUpiId] = useState('')
  const [upiName, setUpiName] = useState('')
  const [pricing, setPricing] = useState<Record<string, ModulePricingCfg>>({})
  const [saving, setSaving] = useState('')

  useEffect(() => {
    api('/api/v1/admin/settings').then((d) => {
      if (!d?.data) return
      const cfgs = ((d.data as Record<string, unknown>).configs ?? (d.data as Record<string, unknown>).items ?? d.data) as Array<{ key: string; value: string }>
      const found = new Set<string>()
      for (const c of cfgs) {
        try {
          if (c.key === 'payment.upiId') { setUpiId(c.value); found.add('upi') }
          if (c.key === 'payment.upiName') { setUpiName(c.value); found.add('upiName') }
          const mod = SETTINGS_MODULES.find((m) => m.configKey === c.key)
          if (mod) { setPricing((prev) => ({ ...prev, [mod.key]: JSON.parse(c.value) })); found.add(mod.configKey) }
        } catch { /* ignore malformed */ }
      }
      // Pre-fill with platform defaults for anything not yet configured
      if (!found.has('upi')) setUpiId('9301056006')
      if (!found.has('upiName')) setUpiName('BANDHAN')
      const DEFAULTS: Record<string, ModulePricingCfg> = {
        MATRIMONY: { module: 'MATRIMONY', freeListingDays: 5, trial: { enabled: true, days: 7 }, plans: [
          { name: 'MONTHLY', label: '1 Month', days: 30, price: 250 }, { name: 'QUARTERLY', label: '3 Months', days: 90, price: 600 },
          { name: 'HALFYEARLY', label: '6 Months', days: 180, price: 1500 }, { name: 'YEARLY', label: '1 Year', days: 365, price: 2500 }] },
        BUSINESS: { module: 'BUSINESS', freeListingDays: 5, trial: { enabled: true, days: 7 }, plans: [
          { name: 'MONTHLY', label: '1 Month', days: 30, price: 900 }, { name: 'QUARTERLY', label: '3 Months', days: 90, price: 1000 },
          { name: 'HALFYEARLY', label: '6 Months', days: 180, price: 3000 }, { name: 'YEARLY', label: '1 Year', days: 365, price: 9900 }] },
        JOBS: { module: 'JOBS', freeListingDays: 5, trial: { enabled: true, days: 7 }, plans: [
          { name: 'MONTHLY', label: '1 Month', days: 30, price: 300 }, { name: 'QUARTERLY', label: '3 Months', days: 90, price: 800 },
          { name: 'HALFYEARLY', label: '6 Months', days: 180, price: 1500 }, { name: 'YEARLY', label: '1 Year', days: 365, price: 5000 }] },
        DIRECTORY: { module: 'DIRECTORY', freeListingDays: 0, trial: null, oneTimeOnly: true, plans: [
          { name: 'ONETIME', label: 'One-time Registration', days: null, price: 250 }] },
        HERO_AD: { module: 'HERO_AD', freeListingDays: 0, trial: null, plans: [
          { name: 'MONTHLY', label: '1 Month', days: 30, price: 1000 }, { name: 'QUARTERLY', label: '3 Months', days: 90, price: 2500 },
          { name: 'HALFYEARLY', label: '6 Months', days: 180, price: 4500 }, { name: 'YEARLY', label: '1 Year', days: 365, price: 10000 }] },
      }
      setPricing((prev) => {
        const next = { ...prev }
        for (const mod of SETTINGS_MODULES) {
          if (!found.has(mod.configKey) && !next[mod.key]) next[mod.key] = DEFAULTS[mod.key]
        }
        return next
      })
    })
  }, [api])

  const saveUpi = async () => {
    setSaving('upi')
    const d = await api('/api/v1/admin/settings', {
      method: 'PUT',
      body: JSON.stringify({ settings: [
        { key: 'payment.upiId', value: upiId, category: 'PAYMENT', isPublic: true, description: 'Centralized receiving UPI ID (no gateway)' },
        { key: 'payment.upiName', value: upiName, category: 'PAYMENT', isPublic: true, description: 'UPI payee name' },
      ] }),
    })
    showToast(d?.success ? '✓ UPI ID saved — all QR codes now use it' : (d?.error ?? 'Save failed'))
    setSaving('')
  }

  const saveModule = async (mod: { key: string; configKey: string; label: string }) => {
    const cfg = pricing[mod.key]
    if (!cfg) return
    setSaving(mod.key)
    const d = await api('/api/v1/admin/settings', {
      method: 'PUT',
      body: JSON.stringify({ settings: [
        { key: mod.configKey, value: JSON.stringify(cfg), category: 'MEMBERSHIP', isPublic: true, description: `${mod.label} pricing config` },
      ] }),
    })
    showToast(d?.success ? `✓ ${mod.label} pricing saved` : (d?.error ?? 'Save failed'))
    setSaving('')
  }

  const updatePlan = (modKey: string, planIdx: number, field: 'price' | 'label', value: string) => {
    setPricing((prev) => {
      const cfg = { ...prev[modKey] }
      cfg.plans = cfg.plans.map((p, i) => i === planIdx ? { ...p, [field]: field === 'price' ? Number(value) || 0 : value } : p)
      return { ...prev, [modKey]: cfg }
    })
  }

  return (
    <div className="space-y-5">
      {/* Central UPI */}
      <div className="rounded-2xl border border-gold/40 bg-gold/5 p-5">
        <div className="flex items-center gap-2">
          <IndianRupee className="h-4 w-4 text-gold-dark" />
          <h3 className="text-sm font-bold text-foreground">केंद्रीय UPI ID (Central UPI — Master Controlled)</h3>
        </div>
        <p className="mt-1 text-[0.65rem] text-muted-foreground">सभी भुगतान (मैट्रिमोनी, बिज़नेस, जॉब्स, डायरेक्टरी, हीरो विज्ञापन) इसी UPI ID पर जाते हैं। ग्राहक इसे बदल नहीं सकते। कोई पेमेंट गेटवे नहीं।</p>
        <div className="mt-3 flex flex-wrap gap-2">
          <input value={upiId} onChange={(e) => setUpiId(e.target.value.trim())} placeholder="UPI ID (जैसे 9301056006)"
            className="h-10 w-56 rounded-xl border border-border/60 bg-white px-3.5 font-mono text-sm focus:border-burgundy/30 focus:outline-none" />
          <input value={upiName} onChange={(e) => setUpiName(e.target.value.trim())} placeholder="Payee Name (जैसे BANDHAN)"
            className="h-10 w-44 rounded-xl border border-border/60 bg-white px-3.5 text-sm focus:border-burgundy/30 focus:outline-none" />
          <button onClick={saveUpi} disabled={saving === 'upi' || !upiId}
            className="flex h-10 items-center gap-1.5 rounded-xl bg-burgundy px-4 text-xs font-bold text-white hover:bg-burgundy-light disabled:opacity-50">
            {saving === 'upi' ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <Check className="h-3.5 w-3.5" />} Save UPI
          </button>
        </div>
      </div>

      {/* Per-module pricing */}
      {SETTINGS_MODULES.map((mod) => {
        const cfg = pricing[mod.key]
        return (
          <div key={mod.key} className="rounded-2xl border border-border/40 bg-white p-4">
            <div className="flex flex-wrap items-center justify-between gap-2">
              <h3 className="text-sm font-bold text-foreground">{mod.label} Pricing</h3>
              {cfg && (
                <button onClick={() => saveModule(mod)} disabled={saving === mod.key}
                  className="flex items-center gap-1 rounded-lg bg-burgundy px-3 py-1.5 text-[0.6rem] font-bold text-white hover:bg-burgundy-light disabled:opacity-50">
                  {saving === mod.key ? <Loader2 className="h-3 w-3 animate-spin" /> : <Check className="h-3 w-3" />} Save
                </button>
              )}
            </div>
            {!cfg ? (
              <p className="mt-2 text-[0.65rem] text-muted-foreground">Loading defaults… (save will persist the platform defaults)</p>
            ) : (
              <>
                <div className="mt-2 flex flex-wrap items-center gap-3 text-xs">
                  {mod.key !== 'DIRECTORY' && mod.key !== 'HERO_AD' && (
                    <>
                      <label className="flex items-center gap-1.5">
                        मुफ़्त अवधि (दिन):
                        <input type="number" min={0} value={cfg.freeListingDays ?? 0}
                          onChange={(e) => setPricing((p) => ({ ...p, [mod.key]: { ...cfg, freeListingDays: Number(e.target.value) || 0 } }))}
                          className="h-8 w-16 rounded-lg border border-border/60 px-2 text-xs" />
                      </label>
                      {cfg.trial && (
                        <label className="flex items-center gap-1.5">
                          ट्रायल: {cfg.trial.days} दिन
                          <input type="checkbox" checked={cfg.trial.enabled}
                            onChange={(e) => setPricing((p) => ({ ...p, [mod.key]: { ...cfg, trial: { ...cfg.trial!, enabled: e.target.checked } } }))}
                            className="h-3.5 w-3.5" />
                        </label>
                      )}
                    </>
                  )}
                  {mod.key === 'DIRECTORY' && <span className="text-[0.65rem] text-muted-foreground">केवल एक बार रजिस्ट्रेशन शुल्क — कोई सब्सक्रिप्शन नहीं</span>}
                </div>
                <div className="mt-3 space-y-2">
                  {cfg.plans.map((p, i) => (
                    <div key={p.name} className="flex flex-wrap items-center gap-2">
                      <span className="w-24 rounded-lg bg-cream px-2 py-1 text-[0.65rem] font-bold text-foreground">{p.name}</span>
                      <input value={p.label} onChange={(e) => updatePlan(mod.key, i, 'label', e.target.value)}
                        className="h-8 w-32 rounded-lg border border-border/60 px-2 text-xs" />
                      <span className="text-xs text-muted-foreground">₹</span>
                      <input type="number" min={0} value={p.price} onChange={(e) => updatePlan(mod.key, i, 'price', e.target.value)}
                        className="h-8 w-24 rounded-lg border border-border/60 px-2 text-xs font-bold" />
                      {p.days ? <span className="text-[0.6rem] text-muted-foreground">{p.days} दिन</span> : <span className="text-[0.6rem] text-muted-foreground">एक बार</span>}
                    </div>
                  ))}
                </div>
              </>
            )}
          </div>
        )
      })}

      <p className="flex items-center gap-1.5 text-[0.65rem] text-muted-foreground">
        <Users className="h-3 w-3" /> कीमत बदलने पर मौजूदा खरीद प्रभावित नहीं होती — हर लेनदेन में खरीद के समय की कीमत (price snapshot) सुरक्षित रहती है।
      </p>
    </div>
  )
}
