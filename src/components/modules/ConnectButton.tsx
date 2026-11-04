'use client'

// ═══════════════════════════════════════════════════════════════
// CONNECT button — privacy-first contact workflow.
// The listing owner's phone/email are NEVER shown. Clicking CONNECT
// creates a connection request that goes to the Bandhan ADMIN, who
// mediates contact (WhatsApp/email) with the listing owner.
// ═══════════════════════════════════════════════════════════════

import { useState } from 'react'
import { Link2, Loader2, CheckCircle, X } from 'lucide-react'
import { apiPost } from '@/lib/api'

interface Props {
  module: string // matrimony | business | jobs | directory
  listingId: string
  onAuthRequired?: () => void
  size?: 'sm' | 'md' | 'lg'
}

const API_MODULE: Record<string, string> = {
  matrimony: 'MATRIMONY',
  business: 'BUSINESS',
  jobs: 'JOBS',
  directory: 'DIRECTORY',
}

export function ConnectButton({ module, listingId, onAuthRequired, size = 'md' }: Props) {
  const [open, setOpen] = useState(false)
  const [message, setMessage] = useState('')
  const [loading, setLoading] = useState(false)
  const [done, setDone] = useState(false)
  const [error, setError] = useState('')

  const handleClick = () => {
    setOpen(true)
    setDone(false)
    setError('')
  }

  const submit = async () => {
    setLoading(true)
    setError('')
    const result = await apiPost<{ message: string }>('/connect', {
      module: API_MODULE[module],
      listingId,
      message: message || undefined,
    })
    if (result.ok) {
      setDone(true)
    } else {
      setError(result.error)
    }
    setLoading(false)
  }

  const sizes = {
    sm: 'px-3 py-1.5 text-xs gap-1',
    md: 'px-4 py-2 text-sm gap-1.5',
    lg: 'px-5 py-2.5 text-sm gap-2',
  }

  return (
    <>
      <button
        onClick={handleClick}
        className={`inline-flex items-center justify-center rounded-xl bg-gradient-to-r from-burgundy to-burgundy-light font-semibold text-white shadow-sm transition-all hover:shadow-md active:scale-[0.98] ${sizes[size]}`}
      >
        <Link2 className="h-4 w-4" />
        कनेक्ट करें · CONNECT
      </button>

      {open && (
        <div className="fixed inset-0 z-[70] flex items-center justify-center p-4">
          <div className="absolute inset-0 bg-black/40 backdrop-blur-sm" onClick={() => setOpen(false)} />
          <div className="relative z-10 w-full max-w-sm rounded-2xl border border-border/40 bg-white p-6 shadow-2xl">
            <button onClick={() => setOpen(false)} className="absolute right-4 top-4 rounded-lg p-1 hover:bg-cream" aria-label="Close">
              <X className="h-4 w-4 text-muted-foreground" />
            </button>

            {done ? (
              <div className="py-6 text-center">
                <CheckCircle className="mx-auto h-12 w-12 text-emerald-500" />
                <h3 className="mt-3 text-base font-bold text-foreground">अनुरोध भेजा गया ✓</h3>
                <p className="mt-2 text-xs leading-relaxed text-muted-foreground">
                  आपका कनेक्ट अनुरोध बंधन प्रशासक को भेज दिया गया है। प्रशासक लिस्टिंग मालिक से संपर्क करेंगे।
                  स्वीकृति के बाद आपको सूचित किया जाएगा।
                </p>
                <button onClick={() => setOpen(false)} className="btn-bandhan-primary mt-5 w-full text-sm">ठीक है</button>
              </div>
            ) : (
              <>
                <h3 className="text-base font-bold text-foreground">कनेक्ट अनुरोध (CONNECT Request)</h3>
                <p className="mt-1.5 text-xs leading-relaxed text-muted-foreground">
                  लिस्टिंग मालिक का मोबाइल नंबर/ईमेल गोपनीय है। आपका अनुरोध सीधे <strong>बंधन प्रशासक</strong> को जाएगा —
                  प्रशासक मालिक से WhatsApp/ईमेल के माध्यम से संपर्क करेंगे। (The owner&apos;s contact stays private — your request goes to the admin.)
                </p>
                {error && <div className="mt-3 rounded-lg bg-red-50 px-3 py-2 text-xs font-medium text-red-600">{error}</div>}
                <textarea
                  value={message}
                  onChange={(e) => setMessage(e.target.value)}
                  placeholder="संदेश (वैकल्पिक) — Message (optional)"
                  rows={3}
                  maxLength={500}
                  className="mt-4 w-full rounded-xl border border-border/60 bg-white px-3.5 py-2.5 text-sm placeholder:text-muted-foreground/60 focus:border-burgundy/30 focus:outline-none focus:ring-2 focus:ring-burgundy/10"
                />
                <button
                  onClick={submit}
                  disabled={loading}
                  className="btn-bandhan-primary mt-4 flex w-full items-center justify-center gap-2 text-sm disabled:opacity-50"
                >
                  {loading && <Loader2 className="h-4 w-4 animate-spin" />}
                  अनुरोध भेजें (Send Request)
                </button>
              </>
            )}
          </div>
        </div>
      )}
    </>
  )
}
