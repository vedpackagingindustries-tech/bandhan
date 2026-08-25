'use client'

import { useState, useEffect, useCallback } from 'react'
import { motion } from 'framer-motion'
import {
  ArrowLeft, X, SlidersHorizontal,
  Heart, Briefcase, Search, Building2,
} from 'lucide-react'
import { BandhanLogo } from '@/components/shared/BandhanLogo'
import { SahuSamajFlag } from '@/components/shared/SahuSamajFlag'
import { Footer } from '@/components/layout/Footer'
import { useTranslations } from '@/i18n'
import { cn } from '@/lib/utils'
import { useSession } from '@/hooks/use-session'
import { MatrimonyContent } from './MatrimonyContent'
import { BusinessContent } from './BusinessContent'
import { JobsContent } from './JobsContent'
import { DirectoryContent } from './DirectoryContent'
import { DetailView, fetchDetail, type ModuleKey as DetailModuleKey } from './DetailView'

export type ModuleKey = 'matrimony' | 'business' | 'jobs' | 'directory'

interface ModulePageViewProps {
  module: ModuleKey
  onBack: () => void
}

const moduleMeta: Record<ModuleKey, {
  image: string
  icon: typeof Heart
  color: string
  tagBg: string
  benefitKey: string
  registrationCategory: string
}> = {
  matrimony: { image: '/hero-matrimony.png', icon: Heart, color: 'text-burgundy', tagBg: 'bg-burgundy', benefitKey: 'matrimony', registrationCategory: 'MATRIMONY' },
  business: { image: '/hero-business.png', icon: Briefcase, color: 'text-gold-dark', tagBg: 'bg-gold-dark', benefitKey: 'business', registrationCategory: 'BUSINESS' },
  jobs: { image: '/hero-jobs.png', icon: Search, color: 'text-teal', tagBg: 'bg-teal', benefitKey: 'jobs', registrationCategory: 'JOB' },
  directory: { image: '/hero-directory.png', icon: Building2, color: 'text-burgundy-light', tagBg: 'bg-burgundy-light', benefitKey: 'directory', registrationCategory: 'DIRECTORY' },
}

type AuthMode = 'login' | 'register' | null

export function ModulePageView({ module, onBack }: ModulePageViewProps) {
  const { t } = useTranslations()
  const meta = moduleMeta[module]
  const Icon = meta.icon
  const mp = t.modulePage
  const navTitle = t.nav[module]
  const { isLoggedIn, login } = useSession()

  const [authMode, setAuthMode] = useState<AuthMode>(null)
  const [authEmail, setAuthEmail] = useState('')
  const [authPhone, setAuthPhone] = useState('')
  const [authPassword, setAuthPassword] = useState('')
  const [authError, setAuthError] = useState('')
  const [authLoading, setAuthLoading] = useState(false)

  const [detailId, setDetailId] = useState<string | null>(null)
  const [detailData, setDetailData] = useState<Record<string, unknown> | null>(null)
  const [detailLoading, setDetailLoading] = useState(false)
  const [detailError, setDetailError] = useState('')
  const [showAdvanced, setShowAdvanced] = useState(false)

  useEffect(() => {
    if (!authMode && !showAdvanced) return
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') {
        setAuthMode(null)
        setShowAdvanced(false)
      }
    }
    document.addEventListener('keydown', onKey)
    document.body.style.overflow = 'hidden'
    return () => {
      document.removeEventListener('keydown', onKey)
      document.body.style.overflow = ''
    }
  }, [authMode, showAdvanced])

  const handleAuth = useCallback(async () => {
    if (!authMode) return
    if (!authPassword || (!authEmail && !authPhone)) {
      setAuthError(authMode === 'login' ? 'Email/phone and password are required' : 'Email or phone and password are required')
      return
    }
    if (authMode === 'register' && authPassword.length < 8) {
      setAuthError('Password must be at least 8 characters')
      return
    }
    setAuthLoading(true)
    setAuthError('')
    try {
      const endpoint = authMode === 'login' ? '/api/v1/auth/login' : '/api/v1/auth/register'
      const body: Record<string, string> = { password: authPassword, category: meta.registrationCategory }
      if (authEmail) body.email = authEmail
      if (authPhone) body.phone = authPhone
      const res = await fetch(endpoint, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(body),
      })
      const data = await res.json()
      if (!res.ok) {
        setAuthError(data.error || data.message || 'Request failed')
        return
      }
      if (data.data?.token) {
        login(data.data)
      }
      setAuthMode(null)
      setAuthEmail('')
      setAuthPhone('')
      setAuthPassword('')
    } catch {
      setAuthError('Network error. Please try again.')
    } finally {
      setAuthLoading(false)
    }
  }, [authMode, authEmail, authPhone, authPassword, meta.registrationCategory, login])

  const openDetail = useCallback(async (id: string) => {
    if (!isLoggedIn) {
      setAuthMode('login')
      return
    }
    setDetailId(id)
    setDetailLoading(true)
    setDetailError('')
    setDetailData(null)
    const result = await fetchDetail(module as DetailModuleKey, id)
    if (result.data) {
      setDetailData(result.data)
    } else {
      setDetailError(result.error)
    }
    setDetailLoading(false)
  }, [isLoggedIn, module])

  const closeDetail = useCallback(() => {
    setDetailId(null)
    setDetailData(null)
    setDetailError('')
  }, [])

  return (
    <div className="flex min-h-screen flex-col bg-ivory">
      <header className="sticky top-0 z-40 border-b border-border/40 bg-white/90 backdrop-blur-xl">
        <div className="mx-auto flex h-14 max-w-7xl items-center justify-between px-4 sm:px-6 md:h-16">
          <div className="flex items-center gap-3">
            {detailId ? (
              <button onClick={closeDetail} className="flex h-9 w-9 items-center justify-center rounded-xl transition-all hover:bg-cream" aria-label="Back">
                <ArrowLeft className="h-5 w-5 text-foreground" />
              </button>
            ) : (
              <button onClick={onBack} className="flex h-9 w-9 items-center justify-center rounded-xl transition-all hover:bg-cream" aria-label="Back to home">
                <ArrowLeft className="h-5 w-5 text-foreground" />
              </button>
            )}
            <BandhanLogo />
            <SahuSamajFlag size="sm" className="hidden sm:inline-flex" />
          </div>
          <div className="flex items-center gap-2">
            <span className={cn('hidden items-center gap-1.5 rounded-full px-3 py-1 text-xs font-semibold text-white sm:flex', meta.tagBg)}>
              <Icon className="h-3.5 w-3.5" />
              {navTitle}
            </span>
          </div>
        </div>
      </header>

      <main className="flex-1">
        {detailId ? (
          <div className="px-4 py-6 sm:px-6">
            <div className="mx-auto max-w-3xl">
              {detailLoading ? (
                <div className="space-y-4 animate-pulse">
                  <div className="h-6 w-2/3 rounded bg-muted" />
                  <div className="h-4 w-1/3 rounded bg-muted" />
                  <div className="h-48 w-full rounded-xl bg-muted" />
                </div>
              ) : detailError ? (
                <div className="flex flex-col items-center justify-center py-16">
                  <p className="text-sm text-red-500">{detailError}</p>
                </div>
              ) : detailData ? (
                <DetailView module={module as DetailModuleKey} data={detailData} onBack={closeDetail} onAuthRequired={() => setAuthMode('login')} />
              ) : null}
            </div>
          </div>
        ) : (
          <>
            <section className="relative w-full overflow-hidden">
              <div className="relative aspect-[21/10] w-full sm:aspect-[21/8]">
                <img src={meta.image} alt={navTitle} className="absolute inset-0 h-full w-full object-cover" />
                <div className="absolute inset-0 bg-gradient-to-r from-black/75 via-black/40 to-transparent" />
                <div className="absolute inset-0 bg-gradient-to-t from-black/30 via-transparent to-transparent" />
                <div className="absolute inset-0 flex items-end sm:items-center">
                  <div className="w-full px-5 pb-6 sm:px-8 sm:pb-0 md:px-14">
                    <motion.div initial={{ opacity: 0, y: 16 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.2, duration: 0.6 }} className="max-w-md">
                      <h1 className="text-2xl font-bold text-white sm:text-3xl md:text-4xl font-serif">{navTitle}</h1>
                      <p className="mt-2 text-sm text-white/80">{t.modules[meta.benefitKey].shortBenefit}</p>
                    </motion.div>
                  </div>
                </div>
              </div>
            </section>

            {!isLoggedIn && (
              <section className="px-4 py-6 sm:px-6">
                <div className="mx-auto max-w-7xl">
                  <div className="rounded-2xl border border-border/40 bg-white p-5 shadow-[0_1px_3px_rgba(0,0,0,0.02)] sm:p-6">
                    <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
                      <div>
                        <h2 className="text-base font-bold text-foreground sm:text-lg">{mp.loginTitle}</h2>
                        <p className="mt-1 text-xs text-muted-foreground sm:text-sm">{mp.loginDescription}</p>
                      </div>
                      <div className="flex gap-2">
                        <button onClick={() => setAuthMode('login')} className="btn-bandhan-outline text-xs sm:text-sm">{mp.login}</button>
                        <button onClick={() => setAuthMode('register')} className="btn-bandhan-primary text-xs sm:text-sm">{mp.register}</button>
                      </div>
                    </div>
                  </div>
                </div>
              </section>
            )}

            {module === 'matrimony' && (
              <MatrimonyContent onOpenDetail={openDetail} onAuthRequired={() => setAuthMode('login')} showAdvanced={showAdvanced} setShowAdvanced={setShowAdvanced} />
            )}
            {module === 'business' && (
              <BusinessContent onOpenDetail={openDetail} onAuthRequired={() => setAuthMode('login')} showAdvanced={showAdvanced} setShowAdvanced={setShowAdvanced} />
            )}
            {module === 'jobs' && (
              <JobsContent onOpenDetail={openDetail} onAuthRequired={() => setAuthMode('login')} showAdvanced={showAdvanced} setShowAdvanced={setShowAdvanced} />
            )}
            {module === 'directory' && (
              <DirectoryContent onOpenDetail={openDetail} onAuthRequired={() => setAuthMode('login')} showAdvanced={showAdvanced} setShowAdvanced={setShowAdvanced} />
            )}

            <section className="px-4 py-4 sm:px-6">
              <div className="mx-auto max-w-7xl">
                <div className="relative overflow-hidden rounded-2xl">
                  <div className="relative aspect-[21/9] w-full">
                    <img src={meta.image} alt={mp.advertisement} className="absolute inset-0 h-full w-full object-cover" loading="lazy" />
                    <div className="absolute inset-0 bg-gradient-to-r from-black/60 to-transparent" />
                    <div className="absolute inset-0 flex items-center px-5 sm:px-8">
                      <span className="text-xs font-medium text-white/60 sm:text-sm">{mp.advertisement}</span>
                    </div>
                  </div>
                </div>
              </div>
            </section>
          </>
        )}
      </main>

      <Footer />

      {authMode && (
        <div className="fixed inset-0 z-[60] flex items-center justify-center">
          <div className="absolute inset-0 bg-black/40 backdrop-blur-sm" onClick={() => setAuthMode(null)} />
          <motion.div
            initial={{ opacity: 0, scale: 0.95, y: 12 }}
            animate={{ opacity: 1, scale: 1, y: 0 }}
            transition={{ duration: 0.25 }}
            className="relative z-10 mx-4 w-full max-w-md rounded-2xl border border-border/40 bg-white p-6 shadow-2xl sm:p-8"
          >
            <button onClick={() => setAuthMode(null)} className="absolute right-4 top-4 flex h-8 w-8 items-center justify-center rounded-lg transition-all hover:bg-cream">
              <X className="h-4 w-4 text-muted-foreground" />
            </button>
            <div className="mb-6 flex items-center gap-3">
              <BandhanLogo />
              <SahuSamajFlag size="sm" />
            </div>
            <h2 className="text-lg font-bold text-foreground font-serif">{authMode === 'login' ? mp.loginTitle : mp.registerTitle}</h2>
            <p className="mt-1 text-xs text-muted-foreground">{authMode === 'login' ? mp.loginDescription : mp.registerDescription}</p>
            {authError && <div className="mt-4 rounded-lg bg-red-50 px-3 py-2 text-xs font-medium text-red-600">{authError}</div>}
            <div className="mt-5 space-y-3">
              <div>
                <label className="mb-1 block text-xs font-medium text-foreground">Email</label>
                <input type="email" value={authEmail} onChange={(e) => setAuthEmail(e.target.value)} placeholder="email@example.com" className="h-11 w-full rounded-xl border border-border/60 bg-white px-4 text-sm text-foreground placeholder:text-muted-foreground/60 transition-all focus:border-burgundy/30 focus:outline-none focus:ring-2 focus:ring-burgundy/10" />
              </div>
              <div>
                <label className="mb-1 block text-xs font-medium text-foreground">Phone</label>
                <input type="tel" value={authPhone} onChange={(e) => setAuthPhone(e.target.value)} placeholder="+91 XXXXX XXXXX" className="h-11 w-full rounded-xl border border-border/60 bg-white px-4 text-sm text-foreground placeholder:text-muted-foreground/60 transition-all focus:border-burgundy/30 focus:outline-none focus:ring-2 focus:ring-burgundy/10" />
              </div>
              <div>
                <label className="mb-1 block text-xs font-medium text-foreground">Password</label>
                <input type="password" value={authPassword} onChange={(e) => setAuthPassword(e.target.value)} placeholder="........" className="h-11 w-full rounded-xl border border-border/60 bg-white px-4 text-sm text-foreground placeholder:text-muted-foreground/60 transition-all focus:border-burgundy/30 focus:outline-none focus:ring-2 focus:ring-burgundy/10" />
              </div>
            </div>
            <button onClick={handleAuth} disabled={authLoading} className="btn-bandhan-primary mt-6 w-full text-sm disabled:opacity-50">
              {authLoading ? '...' : authMode === 'login' ? mp.login : mp.register}
            </button>
            <p className="mt-4 text-center text-xs text-muted-foreground">
              {authMode === 'login'
                ? <>{mp.registerTitle} <button onClick={() => { setAuthMode('register'); setAuthError('') }} className="font-medium text-burgundy hover:underline">{mp.register}</button></>
                : <>{mp.loginTitle} <button onClick={() => { setAuthMode('login'); setAuthError('') }} className="font-medium text-burgundy hover:underline">{mp.login}</button></>
              }
            </p>
          </motion.div>
        </div>
      )}
    </div>
  )
}
