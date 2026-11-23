'use client'

import { useState, useEffect, useCallback } from 'react'
import { motion } from 'framer-motion'
import {
  ArrowLeft, X, SlidersHorizontal,
  Heart, Briefcase, Search, Building2, UserRound,
  Eye, EyeOff,
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
import { PricingSection } from './PricingSection'
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

type AuthMode = 'login' | 'register' | 'forgot' | null

// Hindi error mapping for login/register (server messages stay truthful;
// common cases are surfaced in Hindi + English)
function authErrorHi(raw: string): string {
  const s = (raw || '').toLowerCase()
  if (s.includes('invalid') && (s.includes('credential') || s.includes('password')))
    return 'ईमेल/फ़ोन या पासवर्ड गलत है। पुनः प्रयास करें। (Invalid email/phone or password)'
  if (s.includes('not found') || s.includes('no user'))
    return 'इस ईमेल/फ़ोन से कोई खाता नहीं मिला। पहले रजिस्टर करें। (No account found — please register first)'
  if (s.includes('already') && (s.includes('exist') || s.includes('register')))
    return 'यह ईमेल/फ़ोन पहले से पंजीकृत है। कृपया लॉग इन करें। (Already registered — please log in)'
  if (s.includes('locked') || s.includes('too many') || s.includes('rate'))
    return 'बहुत अधिक प्रयास। कुछ देर बाद पुनः प्रयास करें। (Too many attempts — try again later)'
  if (s.includes('pending approval') || s.includes('pending'))
    return 'खाता अभी स्वीकृति की प्रतीक्षा में है। कृपया व्यवस्थापक से संपर्क करें। (Account pending admin approval)'
  if (s.includes('blocked'))
    return 'खाता प्रतिबंधित है। कृपया समर्थन से संपर्क करें। (Account blocked — contact support)'
  if (s.includes('8 characters') || s.includes('at least 8'))
    return 'पासवर्ड कम से कम 8 अक्षरों का होना चाहिए। (Password must be at least 8 characters)'
  if (s.includes('uppercase'))
    return 'पासवर्ड में कम से कम एक बड़ा अक्षर (A–Z) होना चाहिए। (Password needs an uppercase letter)'
  if (s.includes('digit') || s.includes('number'))
    return 'पासवर्ड में कम से कम एक अंक (0–9) होना चाहिए। (Password needs a digit)'
  if (s.includes('expired'))
    return 'कोड समाप्त हो गया। नया कोड मांगें। (Code expired — request a new one)'
  if (s.includes('max attempts') || s.includes('attempts exceeded'))
    return 'अधिक गलत प्रयास। नया कोड मांगें। (Too many failed attempts — request a new code)'
  if (s.includes('invalid otp') || s.includes('invalid verification') || s.includes('invalid authentication code'))
    return 'कोड गलत है। पुनः जांचें। (Incorrect code — please re-check)'
  if (s.includes('verified') && s.includes('not'))
    return 'आपका खाता सत्यापित नहीं है। कृपया OTP सत्यापन पूरा करें। (Account not verified — complete OTP verification)'
  if (s.includes('network'))
    return 'नेटवर्क त्रुटि। कृपया अपना इंटरनेट जांचें और पुनः प्रयास करें। (Network error — check your connection)'
  return raw
}

export function ModulePageView({ module, onBack }: ModulePageViewProps) {
  const { t } = useTranslations()
  const meta = moduleMeta[module]
  const Icon = meta.icon
  const mp = t.modulePage
  const navTitle = t.nav[module]
  const { isLoggedIn, login } = useSession()

  const [authMode, setAuthMode] = useState<AuthMode>(null)
  const [authName, setAuthName] = useState('')
  const [authEmail, setAuthEmail] = useState('')
  const [authPhone, setAuthPhone] = useState('')
  const [authPassword, setAuthPassword] = useState('')
  const [authError, setAuthError] = useState('')
  const [authLoading, setAuthLoading] = useState(false)
  // Registration success / OTP step
  const [authSuccess, setAuthSuccess] = useState('')
  const [otpRequired, setOtpRequired] = useState(false)
  const [otpUserId, setOtpUserId] = useState('')
  const [otpIdentifier, setOtpIdentifier] = useState('')
  const [otpCode, setOtpCode] = useState('')
  // Forgot-password flow stages
  const [forgotStage, setForgotStage] = useState<'IDENTIFIER' | 'RESET'>('IDENTIFIER')
  const [forgotIdentifier, setForgotIdentifier] = useState('')
  const [forgotOtp, setForgotOtp] = useState('')
  const [forgotNewPassword, setForgotNewPassword] = useState('')
  const [showPassword, setShowPassword] = useState(false)

  const [detailId, setDetailId] = useState<string | null>(null)
  const [detailData, setDetailData] = useState<Record<string, unknown> | null>(null)
  const [detailLoading, setDetailLoading] = useState(false)
  const [detailError, setDetailError] = useState('')
  const [showAdvanced, setShowAdvanced] = useState(false)

  const closeAuth = useCallback(() => {
    setAuthMode(null)
    setAuthError('')
    setAuthSuccess('')
    setAuthName('')
    setAuthEmail('')
    setAuthPhone('')
    setAuthPassword('')
    setOtpRequired(false)
    setOtpUserId('')
    setOtpIdentifier('')
    setOtpCode('')
    setForgotStage('IDENTIFIER')
    setForgotIdentifier('')
    setForgotOtp('')
    setForgotNewPassword('')
    setShowPassword(false)
  }, [])

  useEffect(() => {
    if (!authMode && !showAdvanced) return
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') {
        closeAuth()
        setShowAdvanced(false)
      }
    }
    document.addEventListener('keydown', onKey)
    document.body.style.overflow = 'hidden'
    return () => {
      document.removeEventListener('keydown', onKey)
      document.body.style.overflow = ''
    }
  }, [authMode, showAdvanced, closeAuth])

  // Silent-login with credentials (after registration / OTP verify)
  const autoLogin = useCallback(async (identifierEmail: string, identifierPhone: string, pwd: string) => {
    try {
      const body: Record<string, string> = { password: pwd }
      if (identifierEmail) body.email = identifierEmail
      if (identifierPhone) body.phone = identifierPhone
      const res = await fetch('/api/v1/auth/login', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(body),
      })
      const data = await res.json()
      if (res.ok && data.data?.token) {
        login(data.data)
        setAuthMode(null)
        setAuthSuccess('')
      } else {
        // Registration succeeded but auto-login failed — send user to login
        setAuthMode('login')
        setAuthSuccess('')
      }
    } catch {
      setAuthMode('login')
      setAuthSuccess('')
    }
  }, [login])

  const handleAuth = useCallback(async () => {
    if (authLoading) return // double-click protection

    // ─── FORGOT PASSWORD flow ───
    if (authMode === 'forgot') {
      if (forgotStage === 'IDENTIFIER') {
        if (!forgotIdentifier) {
          setAuthError('ईमेल या फ़ोन आवश्यक है। (Email or phone is required)')
          return
        }
        setAuthLoading(true)
        setAuthError('')
        try {
          const res = await fetch('/api/v1/auth/password', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ identifier: forgotIdentifier }),
          })
          const data = await res.json()
          if (!res.ok) {
            setAuthError(authErrorHi(data.error || data.message || 'Request failed'))
            return
          }
          setForgotStage('RESET')
          setAuthSuccess('यदि खाता मौजूद है तो सत्यापन कोड भेजा गया है। (If the account exists, a verification code has been sent.)')
        } catch {
          setAuthError('नेटवर्क त्रुटि। कृपया पुनः प्रयास करें। (Network error. Please try again.)')
        } finally {
          setAuthLoading(false)
        }
        return
      }
      // Stage RESET: verify OTP + set new password
      if (!forgotOtp || !forgotNewPassword) {
        setAuthError('कोड और नया पासवर्ड आवश्यक हैं। (Code and new password are required)')
        return
      }
      if (forgotNewPassword.length < 8 || !/[A-Z]/.test(forgotNewPassword) || !/[0-9]/.test(forgotNewPassword)) {
        setAuthError('पासवर्ड: 8+ अक्षर, एक बड़ा अक्षर (A-Z), एक अंक (0-9)। (Password: 8+ chars, one uppercase, one digit)')
        return
      }
      setAuthLoading(true)
      setAuthError('')
      try {
        const res = await fetch('/api/v1/auth/password', {
          method: 'PATCH',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ identifier: forgotIdentifier, otpCode: forgotOtp, newPassword: forgotNewPassword }),
        })
        const data = await res.json()
        if (!res.ok) {
          setAuthError(authErrorHi(data.error || data.message || 'Request failed'))
          return
        }
        setForgotStage('IDENTIFIER')
        setForgotIdentifier('')
        setForgotOtp('')
        setForgotNewPassword('')
        setAuthSuccess('')
        setAuthMode('login')
        setAuthError('पासवर्ड बदल गया। नए पासवर्ड से लॉग इन करें। (Password changed — log in with your new password.)')
      } catch {
        setAuthError('नेटवर्क त्रुटि। कृपया पुनः प्रयास करें। (Network error. Please try again.)')
      } finally {
        setAuthLoading(false)
      }
      return
    }

    // ─── OTP VERIFY step (registration continuation) ───
    if (authMode === 'register' && otpRequired) {
      if (!otpCode || otpCode.length < 4) {
        setAuthError('6-अंकीय कोड दर्ज करें। (Enter the verification code)')
        return
      }
      setAuthLoading(true)
      setAuthError('')
      try {
        const res = await fetch('/api/v1/auth/otp/verify', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ identifier: otpIdentifier, otpCode, userId: otpUserId }),
        })
        const data = await res.json()
        if (!res.ok) {
          setAuthError(authErrorHi(data.error || data.message || 'Verification failed'))
          return
        }
        await autoLogin(authEmail, authPhone, authPassword)
      } catch {
        setAuthError('नेटवर्क त्रुटि। कृपया पुनः प्रयास करें। (Network error. Please try again.)')
      } finally {
        setAuthLoading(false)
      }
      return
    }

    // ─── LOGIN / REGISTER ───
    if (!authPassword || (!authEmail && !authPhone)) {
      setAuthError('ईमेल/फ़ोन और पासवर्ड आवश्यक हैं। (Email/phone and password are required)')
      return
    }
    if (authMode === 'register' && authPassword.length < 8) {
      setAuthError('पासवर्ड कम से कम 8 अक्षरों का होना चाहिए। (Password must be at least 8 characters)')
      return
    }
    if (authMode === 'register' && !/[A-Z]/.test(authPassword)) {
      setAuthError('पासवर्ड में कम से कम एक बड़ा अक्षर (A–Z) होना चाहिए। (Password needs at least one uppercase letter)')
      return
    }
    if (authMode === 'register' && !/[0-9]/.test(authPassword)) {
      setAuthError('पासवर्ड में कम से कम एक अंक (0–9) होना चाहिए। (Password needs at least one digit)')
      return
    }
    setAuthLoading(true)
    setAuthError('')
    try {
      const endpoint = authMode === 'login' ? '/api/v1/auth/login' : '/api/v1/auth/register'
      const body: Record<string, string> = { password: authPassword, category: meta.registrationCategory }
      if (authEmail) body.email = authEmail
      if (authPhone) body.phone = authPhone
      if (authMode === 'register' && authName.trim()) {
        const nameParts = authName.trim().split(/\s+/)
        body.firstName = nameParts[0]
        if (nameParts.length > 1) body.lastName = nameParts.slice(1).join(' ')
      }
      const res = await fetch(endpoint, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(body),
      })
      const data = await res.json()
      if (!res.ok) {
        setAuthError(authErrorHi(data.error || data.message || 'Request failed'))
        return
      }
      if (authMode === 'register') {
        // Registration succeeded — NEVER close silently.
        if (data.data?.otpDelivered) {
          setOtpRequired(true)
          setOtpUserId(data.data.userId || '')
          setOtpIdentifier(authEmail || authPhone)
          setAuthSuccess('रजिस्ट्रेशन सफल! सत्यापन कोड दर्ज करें। (Registration successful! Enter the verification code.)')
        } else {
          setAuthSuccess('रजिस्ट्रेशन सफल! खाता सक्रिय है — लॉग इन हो रहे हैं… (Registration successful — logging you in…)')
          await autoLogin(authEmail, authPhone, authPassword)
          setAuthName('')
          setAuthPassword('')
        }
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
      setAuthError('नेटवर्क त्रुटि। कृपया पुनः प्रयास करें। (Network error. Please try again.)')
    } finally {
      setAuthLoading(false)
    }
  }, [authMode, authEmail, authPhone, authPassword, authName, authLoading, otpRequired, otpCode, otpIdentifier, otpUserId, forgotStage, forgotIdentifier, forgotOtp, forgotNewPassword, meta.registrationCategory, login, autoLogin])

  // Real-time password rule hint (register mode only)
  const pwdChecks = authMode === 'register' ? [
    { ok: authPassword.length >= 8, label: '8+ अक्षर' },
    { ok: /[A-Z]/.test(authPassword), label: 'बड़ा अक्षर (A-Z)' },
    { ok: /[0-9]/.test(authPassword), label: 'अंक (0-9)' },
  ] : []

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
            {/* My Account entry */}
            <a
              href="#account"
              className="flex h-9 items-center gap-1.5 rounded-xl px-2.5 text-[0.75rem] font-semibold text-foreground/70 transition-all hover:bg-cream hover:text-burgundy"
              aria-label="मेरा खाता · My Account"
              title="मेरा खाता · My Account"
            >
              <UserRound className="h-4 w-4" strokeWidth={1.75} />
              <span className="hidden md:inline">खाता</span>
            </a>
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
                <DetailView module={module as DetailModuleKey} data={detailData} detailId={detailId} onBack={closeDetail} onAuthRequired={() => setAuthMode('login')} />
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

            {/* Dedicated per-module pricing + direct UPI payment flow */}
            <PricingSection module={module} onAuthRequired={() => setAuthMode('login')} />

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
          <div className="absolute inset-0 bg-black/40 backdrop-blur-sm" onClick={closeAuth} />
          <motion.div
            initial={{ opacity: 0, scale: 0.95, y: 12 }}
            animate={{ opacity: 1, scale: 1, y: 0 }}
            transition={{ duration: 0.25 }}
            className="relative z-10 mx-4 w-full max-w-md rounded-2xl border border-border/40 bg-white p-6 shadow-2xl sm:p-8"
          >
            <button onClick={closeAuth} className="absolute right-4 top-4 flex h-8 w-8 items-center justify-center rounded-lg transition-all hover:bg-cream">
              <X className="h-4 w-4 text-muted-foreground" />
            </button>
            <div className="mb-6 flex items-center gap-3">
              <BandhanLogo />
              <SahuSamajFlag size="sm" />
            </div>
            <h2 className="text-lg font-bold text-foreground font-serif">
              {authMode === 'forgot' ? 'पासवर्ड रीसेट करें' : authMode === 'login' ? mp.loginTitle : otpRequired ? 'सत्यापन कोड' : mp.registerTitle}
            </h2>
            <p className="mt-1 text-xs text-muted-foreground">
              {authMode === 'forgot'
                ? forgotStage === 'IDENTIFIER'
                  ? 'अपना पंजीकृत ईमेल या फ़ोन दर्ज करें। (Enter your registered email or phone)'
                  : `कोड ${forgotIdentifier} पर भेजा गया — कोड और नया पासवर्ड दर्ज करें।`
                : authMode === 'login'
                  ? mp.loginDescription
                  : otpRequired
                    ? `कोड ${otpIdentifier} पर भेजा गया है। (Code sent to ${otpIdentifier})`
                    : mp.registerDescription}
            </p>
            {authSuccess && <div className="mt-4 rounded-lg bg-emerald-50 px-3 py-2 text-xs font-medium text-emerald-700">{authSuccess}</div>}
            {authError && <div className="mt-4 rounded-lg bg-red-50 px-3 py-2 text-xs font-medium text-red-600">{authError}</div>}
            <div className="mt-5 space-y-3">
              {authMode === 'register' && otpRequired && (
                <div>
                  <label className="mb-1 block text-xs font-medium text-foreground">सत्यापन कोड (Verification code)</label>
                  <input type="text" inputMode="numeric" autoComplete="one-time-code" maxLength={6} value={otpCode} onChange={(e) => setOtpCode(e.target.value.replace(/\D/g, ''))} placeholder="000000" className="h-11 w-full rounded-xl border border-border/60 bg-white px-4 text-center text-lg font-semibold tracking-[0.4em] text-foreground placeholder:text-muted-foreground/60 transition-all focus:border-burgundy/30 focus:outline-none focus:ring-2 focus:ring-burgundy/10" />
                </div>
              )}
              {authMode === 'forgot' && forgotStage === 'RESET' && (
                <div>
                  <label className="mb-1 block text-xs font-medium text-foreground">सत्यापन कोड (Verification code)</label>
                  <input type="text" inputMode="numeric" autoComplete="one-time-code" maxLength={6} value={forgotOtp} onChange={(e) => setForgotOtp(e.target.value.replace(/\D/g, ''))} placeholder="000000" className="h-11 w-full rounded-xl border border-border/60 bg-white px-4 text-center text-lg font-semibold tracking-[0.4em] text-foreground placeholder:text-muted-foreground/60 transition-all focus:border-burgundy/30 focus:outline-none focus:ring-2 focus:ring-burgundy/10" />
                </div>
              )}
              {authMode === 'forgot' && forgotStage === 'RESET' && (
                <div>
                  <label className="mb-1 block text-xs font-medium text-foreground">नया पासवर्ड (New password)</label>
                  <input type="password" value={forgotNewPassword} onChange={(e) => setForgotNewPassword(e.target.value)} placeholder="........" className="h-11 w-full rounded-xl border border-border/60 bg-white px-4 text-sm text-foreground placeholder:text-muted-foreground/60 transition-all focus:border-burgundy/30 focus:outline-none focus:ring-2 focus:ring-burgundy/10" />
                  <p className="mt-1 text-[0.6rem] text-muted-foreground">8+ अक्षर, एक बड़ा अक्षर (A-Z), एक अंक (0-9)।</p>
                </div>
              )}
              {authMode === 'forgot' && forgotStage === 'IDENTIFIER' && (
                <div>
                  <label className="mb-1 block text-xs font-medium text-foreground">ईमेल या फ़ोन (Email or phone)</label>
                  <input type="text" value={forgotIdentifier} onChange={(e) => setForgotIdentifier(e.target.value)} placeholder="email@example.com या +91 XXXXX XXXXX" className="h-11 w-full rounded-xl border border-border/60 bg-white px-4 text-sm text-foreground placeholder:text-muted-foreground/60 transition-all focus:border-burgundy/30 focus:outline-none focus:ring-2 focus:ring-burgundy/10" />
                </div>
              )}
              {authMode !== 'forgot' && !otpRequired && (
                <>
                  {authMode === 'register' && (
                    <div>
                      <label className="mb-1 block text-xs font-medium text-foreground">नाम (Name) <span className="text-muted-foreground/70">— वैकल्पिक</span></label>
                      <input type="text" value={authName} onChange={(e) => setAuthName(e.target.value)} placeholder="पूरा नाम" className="h-11 w-full rounded-xl border border-border/60 bg-white px-4 text-sm text-foreground placeholder:text-muted-foreground/60 transition-all focus:border-burgundy/30 focus:outline-none focus:ring-2 focus:ring-burgundy/10" />
                    </div>
                  )}
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
                    <div className="relative">
                      <input type={showPassword ? 'text' : 'password'} value={authPassword} onChange={(e) => setAuthPassword(e.target.value)} placeholder="........" className="h-11 w-full rounded-xl border border-border/60 bg-white px-4 pr-11 text-sm text-foreground placeholder:text-muted-foreground/60 transition-all focus:border-burgundy/30 focus:outline-none focus:ring-2 focus:ring-burgundy/10" />
                      <button type="button" onClick={() => setShowPassword(!showPassword)} className="absolute right-3 top-1/2 -translate-y-1/2 text-muted-foreground hover:text-foreground" aria-label={showPassword ? 'पासवर्ड छुपाएं' : 'पासवर्ड दिखाएं'}>
                        {showPassword ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
                      </button>
                    </div>
                    {authMode === 'register' && (
                      <div className="mt-1.5 flex flex-wrap gap-1.5">
                        {pwdChecks.map((c) => (
                          <span key={c.label} className={cn('rounded-full px-2 py-0.5 text-[0.6rem] font-medium', c.ok ? 'bg-emerald-50 text-emerald-700' : 'bg-stone-100 text-stone-500')}>
                            {c.ok ? '✓ ' : ''}{c.label}
                          </span>
                        ))}
                      </div>
                    )}
                  </div>
                </>
              )}
            </div>
            <button onClick={handleAuth} disabled={authLoading} className="btn-bandhan-primary mt-6 w-full text-sm disabled:opacity-50">
              {authLoading
                ? '...'
                : authMode === 'forgot'
                  ? forgotStage === 'IDENTIFIER' ? 'कोड भेजें' : 'पासवर्ड रीसेट करें'
                  : authMode === 'login'
                    ? mp.login
                    : otpRequired ? 'कोड सत्यापित करें' : mp.register}
            </button>
            <p className="mt-4 text-center text-xs text-muted-foreground">
              {authMode === 'forgot'
                ? <button onClick={() => { setAuthMode('login'); setForgotStage('IDENTIFIER'); setAuthError(''); setAuthSuccess('') }} className="font-medium text-burgundy hover:underline">लॉग इन पर वापस जाएं</button>
                : authMode === 'login'
                  ? <>
                    {mp.registerTitle} <button onClick={() => { setAuthMode('register'); setAuthError(''); setAuthSuccess('') }} className="font-medium text-burgundy hover:underline">{mp.register}</button>
                    <span className="mx-2 text-border">·</span>
                    <button onClick={() => { setAuthMode('forgot'); setForgotIdentifier(authEmail || authPhone); setAuthError(''); setAuthSuccess('') }} className="font-medium text-burgundy hover:underline">पासवर्ड भूल गए?</button>
                  </>
                  : <>{mp.loginTitle} <button onClick={() => { setAuthMode('login'); setOtpRequired(false); setAuthError(''); setAuthSuccess('') }} className="font-medium text-burgundy hover:underline">{mp.login}</button></>
              }
            </p>
          </motion.div>
        </div>
      )}
    </div>
  )
}
