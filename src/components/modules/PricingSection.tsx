'use client'

// ═══════════════════════════════════════════════════════════════
// Module Pricing Section — dedicated per-module pricing (never mixed).
// Direct UPI payment: server-generated QR → customer pays exact amount
// to the centralized UPI ID → submits UTR → ADMIN VERIFIES the actual
// bank/UPI transaction → only then does the plan activate.
// ═══════════════════════════════════════════════════════════════

import { useEffect, useState } from 'react'
import { Check, Crown, Loader2, QrCode, ShieldCheck, Sparkles, X } from 'lucide-react'
import { apiGet, apiPost } from '@/lib/api'
import { useSession } from '@/hooks/use-session'

interface Plan {
  name: string
  label: string
  days: number | null
  price: number
  description?: string
}

interface ModulePricing {
  module: string
  freeListingDays: number
  trial: { enabled: boolean; days: number } | null
  plans: Plan[]
  oneTimeOnly?: boolean
}

interface PricingData {
  matrimony: ModulePricing
  business: ModulePricing
  jobs: ModulePricing
  directory: ModulePricing
  upiId: string
}

const MODULE_KEY_MAP: Record<string, 'matrimony' | 'business' | 'jobs' | 'directory'> = {
  matrimony: 'matrimony',
  business: 'business',
  jobs: 'jobs',
  directory: 'directory',
}

const API_MODULE_MAP: Record<string, string> = {
  matrimony: 'MATRIMONY',
  business: 'BUSINESS',
  jobs: 'JOBS',
  directory: 'DIRECTORY',
}

interface Props {
  module: string // matrimony | business | jobs | directory
  listingId?: string
  onAuthRequired?: () => void
}

export function PricingSection({ module, listingId, onAuthRequired }: Props) {
  const { isLoggedIn } = useSession()
  const [pricing, setPricing] = useState<PricingData | null>(null)
  const [payment, setPayment] = useState<PaymentSession | null>(null)

  useEffect(() => {
    apiGet<PricingData>('/pricing').then((res) => {
      if (res.ok) setPricing(res.data)
    })
  }, [])

  const key = MODULE_KEY_MAP[module]
  if (!pricing || !key) return null
  const data = pricing[key]
  if (!data) return null

  const title = module === 'matrimony' ? 'मैट्रिमोनी प्रीमियम' : module === 'business' ? 'बिज़नेस प्रीमियम' : module === 'jobs' ? 'जॉब्स प्रीमियम' : 'डायरेक्टरी रजिस्ट्रेशन'
  const accent = module === 'matrimony' ? 'from-burgundy to-burgundy-light' : module === 'business' ? 'from-gold-dark to-gold' : module === 'jobs' ? 'from-teal to-emerald-600' : 'from-burgundy-light to-burgundy'

  const startPayment = async (plan: Plan) => {
    if (!isLoggedIn) {
      onAuthRequired?.()
      return
    }
    const res = await apiPost<PaymentSession>('/payments/qr', {
      module: API_MODULE_MAP[module],
      planName: plan.name,
      listingId: listingId || undefined,
    })
    if (res.ok) setPayment(res.data)
    else alert(res.error)
  }

  return (
    <section id="pricing" className="px-4 py-8 sm:px-6">
      <div className="mx-auto max-w-7xl">
        <div className="text-center">
          <span className="inline-flex items-center gap-1.5 rounded-full bg-burgundy/8 px-3 py-1 text-[0.65rem] font-bold uppercase tracking-wider text-burgundy">
            <Crown className="h-3 w-3" /> Premium Plans
          </span>
          <h2 className="mt-2 font-serif text-xl font-bold text-foreground sm:text-2xl">{title}</h2>
          {data.freeListingDays > 0 && (
            <p className="mt-1 text-xs text-muted-foreground">मुफ़्त लिस्टिंग अवधि: {data.freeListingDays} दिन (Free listing: {data.freeListingDays} days)</p>
          )}
        </div>

        <div className={`mt-6 grid gap-4 sm:grid-cols-2 ${data.plans.length > 2 ? 'lg:grid-cols-4' : 'lg:grid-cols-2'}`}>
          {data.plans.map((plan, i) => (
            <div
              key={plan.name}
              className={`relative overflow-hidden rounded-2xl border bg-white p-5 transition-all hover:shadow-lg ${
                i === 1 ? 'border-burgundy/30 shadow-md' : 'border-border/40'
              }`}
            >
              {i === 1 && (
                <span className="absolute right-0 top-0 rounded-bl-xl bg-burgundy px-2.5 py-1 text-[0.6rem] font-bold text-white">POPULAR</span>
              )}
              <h3 className="text-sm font-bold text-foreground">{plan.label}</h3>
              <div className="mt-2 flex items-baseline gap-1">
                <span className="text-2xl font-bold text-burgundy">₹{plan.price.toLocaleString('en-IN')}</span>
                {plan.days && <span className="text-[0.65rem] text-muted-foreground">/ {plan.days} दिन</span>}
              </div>
              <ul className="mt-3 space-y-1.5">
                {(module === 'matrimony'
                  ? ['प्रोफ़ाइल हाइलाइट', 'टॉप सर्च में दिखें', 'अनलिमिटेड व्यूज़', 'प्रीमियम बैज']
                  : module === 'business'
                    ? ['व्यापार हाइलाइट', 'टॉप लिस्टिंग', 'वेरिफाइड बैज', 'अधिक व्यूज़']
                    : module === 'jobs'
                      ? ['जॉब हाइलाइट', 'टॉप लिस्टिंग', 'अधिक आवेदन', 'प्रीमियम बैज']
                      : ['स्थायी रजिस्ट्रेशन', 'वेरिफाइड एंट्री', 'डायरेक्टरी लिस्टिंग', 'कम्युनिटी विश्वास']
                ).map((f) => (
                  <li key={f} className="flex items-center gap-1.5 text-xs text-foreground/70">
                    <Check className="h-3 w-3 flex-shrink-0 text-emerald-600" /> {f}
                  </li>
                ))}
              </ul>
              <button
                onClick={() => startPayment(plan)}
                className={`mt-4 w-full rounded-xl bg-gradient-to-r ${accent} py-2.5 text-xs font-bold text-white transition-all hover:shadow-md active:scale-[0.98]`}
              >
                ₹{plan.price.toLocaleString('en-IN')} · भुगतान करें
              </button>
            </div>
          ))}
        </div>

        {data.trial?.enabled && module !== 'directory' && (
          <div className="mt-4 flex items-center justify-center gap-2 rounded-xl border border-gold/30 bg-gold/5 px-4 py-3 text-center">
            <Sparkles className="h-4 w-4 flex-shrink-0 text-gold-dark" />
            <p className="text-xs text-foreground/75">
              नए सदस्यों के लिए <strong>{data.trial.days}-दिन का मुफ़्त प्रीमियम ट्रायल</strong> उपलब्ध है — डैशबोर्ड से सक्रिय करें।
            </p>
          </div>
        )}

        <p className="mt-4 flex items-center justify-center gap-1.5 text-center text-[0.65rem] text-muted-foreground">
          <ShieldCheck className="h-3.5 w-3.5" />
          सुरक्षित सीधा UPI भुगतान — कोई पेमेंट गेटवे नहीं। भुगतान की पुष्टि व्यवस्थापक द्वारा वास्तविक बैंक/UPI लेनदेन जांचने के बाद होती है।
        </p>
      </div>

      {payment && <PaymentModal payment={payment} onClose={() => setPayment(null)} />}
    </section>
  )
}

// ─────────────────────────────────────────────────────────────
// Payment modal: QR + UPI ID + UTR submission
// ─────────────────────────────────────────────────────────────
interface PaymentSession {
  paymentId: string
  amount: number
  planLabel: string
  upiId: string
  payeeName: string
  qrDataUrl: string
  status: string
}

function PaymentModal({ payment, onClose }: { payment: PaymentSession; onClose: () => void }) {
  const [utr, setUtr] = useState('')
  const [paymentDate, setPaymentDate] = useState(new Date().toISOString().slice(0, 10))
  const [submitting, setSubmitting] = useState(false)
  const [done, setDone] = useState(false)
  const [error, setError] = useState('')

  const submit = async () => {
    if (!utr.trim()) {
      setError('UTR / रेफरेंस नंबर आवश्यक है')
      return
    }
    setSubmitting(true)
    setError('')
    const res = await apiPost('/payments/submit', {
      paymentId: payment.paymentId,
      utr: utr.trim(),
      paymentDate,
    })
    if (res.ok) {
      setDone(true)
    } else {
      setError(res.error)
    }
    setSubmitting(false)
  }

  return (
    <div className="fixed inset-0 z-[70] flex items-center justify-center p-4">
      <div className="absolute inset-0 bg-black/50 backdrop-blur-sm" onClick={onClose} />
      <div className="relative z-10 max-h-[92vh] w-full max-w-md overflow-y-auto rounded-2xl border border-border/40 bg-white p-6 shadow-2xl">
        <button onClick={onClose} className="absolute right-4 top-4 rounded-lg p-1 hover:bg-cream" aria-label="Close">
          <X className="h-4 w-4 text-muted-foreground" />
        </button>

        {done ? (
          <div className="py-6 text-center">
            <ShieldCheck className="mx-auto h-12 w-12 text-emerald-500" />
            <h3 className="mt-3 text-base font-bold text-foreground">UTR जमा हो गया ✓</h3>
            <p className="mt-2 text-xs leading-relaxed text-muted-foreground">
              प्रशासक आपका वास्तविक बैंक/UPI लेनदेन जांच कर स्वीकृति देंगे। स्वीकृति के बाद आपका प्रीमियम सक्रिय हो जाएगा और
              सूचना मिलेगी। (Admin will verify your actual bank/UPI transaction before activation.)
            </p>
            <button onClick={onClose} className="btn-bandhan-primary mt-5 w-full text-sm">ठीक है</button>
          </div>
        ) : (
          <>
            <div className="flex items-center gap-2">
              <QrCode className="h-5 w-5 text-burgundy" />
              <h3 className="text-base font-bold text-foreground">UPI भुगतान (Direct UPI)</h3>
            </div>

            <div className="mt-3 rounded-xl bg-cream px-3.5 py-2.5 text-xs">
              <div className="flex justify-between"><span className="text-muted-foreground">योजना</span><span className="font-semibold">{payment.planLabel}</span></div>
              <div className="mt-1 flex justify-between"><span className="text-muted-foreground">राशि</span><span className="font-bold text-burgundy">₹{payment.amount.toLocaleString('en-IN')}</span></div>
            </div>

            {/* QR — generated server-side with the admin-controlled UPI ID + exact amount */}
            <div className="mt-4 flex flex-col items-center">
              <img src={payment.qrDataUrl} alt="UPI QR" className="h-52 w-52 rounded-xl border border-border/40" />
              <p className="mt-2 text-center text-[0.65rem] text-muted-foreground">किसी भी UPI ऐप से स्कैन करें (Scan with any UPI app)</p>
            </div>

            <div className="mt-4 rounded-xl border border-border/40 p-3.5 text-sm">
              <p className="text-[0.65rem] uppercase tracking-wider text-muted-foreground">UPI ID (केंद्रीय — बदली नहीं जा सकती)</p>
              <p className="mt-0.5 font-bold text-burgundy">{payment.upiId}</p>
              <p className="mt-0.5 text-[0.65rem] text-muted-foreground">Payee: {payment.payeeName} · Amount: ₹{payment.amount.toFixed(2)}</p>
            </div>

            <div className="mt-4 space-y-3">
              <div>
                <label className="mb-1 block text-xs font-medium">UTR / ट्रांजैक्शन रेफरेंस नंबर *</label>
                <input
                  value={utr}
                  onChange={(e) => setUtr(e.target.value.toUpperCase())}
                  placeholder="जैसे 123456789012"
                  className="h-10 w-full rounded-xl border border-border/60 px-3.5 text-sm focus:border-burgundy/30 focus:outline-none focus:ring-2 focus:ring-burgundy/10"
                />
              </div>
              <div>
                <label className="mb-1 block text-xs font-medium">भुगतान की तारीख *</label>
                <input
                  type="date"
                  value={paymentDate}
                  max={new Date().toISOString().slice(0, 10)}
                  onChange={(e) => setPaymentDate(e.target.value)}
                  className="h-10 w-full rounded-xl border border-border/60 px-3.5 text-sm focus:border-burgundy/30 focus:outline-none focus:ring-2 focus:ring-burgundy/10"
                />
              </div>
            </div>

            {error && <div className="mt-3 rounded-lg bg-red-50 px-3 py-2 text-xs font-medium text-red-600">{error}</div>}

            <button onClick={submit} disabled={submitting} className="btn-bandhan-primary mt-4 flex w-full items-center justify-center gap-2 text-sm disabled:opacity-50">
              {submitting && <Loader2 className="h-4 w-4 animate-spin" />}
              भुगतान हो गया — UTR जमा करें
            </button>
            <p className="mt-3 text-center text-[0.62rem] leading-relaxed text-muted-foreground">
              ⚠️ UTR जमा करना भुगतान का प्रमाण नहीं है। प्रीमियम तभी सक्रिय होगा जब प्रशासक वास्तविक बैंक/UPI लेनदेन की पुष्टि करेंगे।
            </p>
          </>
        )}
      </div>
    </div>
  )
}
