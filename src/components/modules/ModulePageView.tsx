'use client'

import { useState, useEffect, useCallback } from 'react'
import { motion } from 'framer-motion'
import {
  ArrowLeft, LogIn, UserPlus, Search, SlidersHorizontal,
  Heart, Briefcase, Building2, FileText, MapPin, X,
} from 'lucide-react'
import { BandhanLogo } from '@/components/shared/BandhanLogo'
import { SahuSamajFlag } from '@/components/shared/SahuSamajFlag'
import { Footer } from '@/components/layout/Footer'
import { useTranslations } from '@/i18n'
import { cn } from '@/lib/utils'

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
  jobs: { image: '/hero-jobs.png', icon: FileText, color: 'text-teal', tagBg: 'bg-teal', benefitKey: 'jobs', registrationCategory: 'JOB' },
  directory: { image: '/hero-directory.png', icon: Building2, color: 'text-burgundy-light', tagBg: 'bg-burgundy-light', benefitKey: 'directory', registrationCategory: 'DIRECTORY' },
}

const AUTH_MODAL_KEY = 'bandhan-auth-modal'

type AuthMode = 'login' | 'register' | null

export function ModulePageView({ module, onBack }: ModulePageViewProps) {
  const { t } = useTranslations()
  const meta = moduleMeta[module]
  const Icon = meta.icon
  const mp = t.modulePage
  const navTitle = t.nav[module]
  const [authMode, setAuthMode] = useState<AuthMode>(null)
  const [authEmail, setAuthEmail] = useState('')
  const [authPhone, setAuthPhone] = useState('')
  const [authPassword, setAuthPassword] = useState('')
  const [authError, setAuthError] = useState('')
  const [authLoading, setAuthLoading] = useState(false)

  // ESC to close modal
  useEffect(() => {
    if (!authMode) return
    const onKey = (e: KeyboardEvent) => { if (e.key === 'Escape') setAuthMode(null) }
    document.addEventListener('keydown', onKey)
    document.body.style.overflow = 'hidden'
    return () => { document.removeEventListener('keydown', onKey); document.body.style.overflow = '' }
  }, [authMode])

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
      const endpoint = authMode === 'login' ? '/api/auth/login' : '/api/auth/register'
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

      // Success: close modal
      if (data.data?.token) {
        localStorage.setItem('bandhan-session', JSON.stringify(data.data))
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
  }, [authMode, authEmail, authPhone, authPassword, meta.registrationCategory])

  return (
    <div className="flex min-h-screen flex-col bg-ivory">
      {/* Module Header */}
      <header className="sticky top-0 z-40 border-b border-border/40 bg-white/90 backdrop-blur-xl">
        <div className="mx-auto flex h-14 max-w-7xl items-center justify-between px-4 sm:px-6 md:h-16">
          <div className="flex items-center gap-3">
            <button
              onClick={onBack}
              className="flex h-9 w-9 items-center justify-center rounded-xl transition-all hover:bg-cream"
              aria-label={mp.backToHome}
            >
              <ArrowLeft className="h-5 w-5 text-foreground" />
            </button>
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
        {/* Module Hero Advertisement */}
        <section className="relative w-full overflow-hidden">
          <div className="relative aspect-[21/10] w-full sm:aspect-[21/8]">
            <img src={meta.image} alt={navTitle} className="absolute inset-0 h-full w-full object-cover" />
            <div className="absolute inset-0 bg-gradient-to-r from-black/75 via-black/40 to-transparent" />
            <div className="absolute inset-0 bg-gradient-to-t from-black/30 via-transparent to-transparent" />
            <div className="absolute inset-0 flex items-end sm:items-center">
              <div className="w-full px-5 pb-6 sm:px-8 sm:pb-0 md:px-14">
                <motion.div
                  initial={{ opacity: 0, y: 16 }}
                  animate={{ opacity: 1, y: 0 }}
                  transition={{ delay: 0.2, duration: 0.6 }}
                  className="max-w-md"
                >
                  <h1 className="text-2xl font-bold text-white sm:text-3xl md:text-4xl font-serif">{navTitle}</h1>
                  <p className="mt-2 text-sm text-white/80">{t.modules[meta.benefitKey].shortBenefit}</p>
                </motion.div>
              </div>
            </div>
          </div>
        </section>

        {/* Module Login/Register */}
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
              <div className="mt-3 text-center">
                <button className="text-xs text-muted-foreground transition-colors hover:text-burgundy">{mp.orContinue}</button>
              </div>
            </div>
          </div>
        </section>

        {/* Search + Filters */}
        <section className="px-4 pb-4 sm:px-6 sm:pb-6">
          <div className="mx-auto max-w-7xl">
            <div className="flex gap-2">
              <div className="relative flex-1">
                <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground/60" />
                <input
                  type="text"
                  placeholder={mp.searchPlaceholder}
                  className="h-11 w-full rounded-xl border border-border/60 bg-white pl-10 pr-4 text-sm text-foreground placeholder:text-muted-foreground/60 transition-all focus:border-burgundy/30 focus:outline-none focus:ring-2 focus:ring-burgundy/10"
                />
              </div>
              <button className="flex h-11 items-center gap-2 rounded-xl border border-border/60 bg-white px-4 text-sm font-medium text-foreground transition-all hover:bg-cream">
                <SlidersHorizontal className="h-4 w-4" />
                <span className="hidden sm:inline">{mp.filters}</span>
              </button>
            </div>
          </div>
        </section>

        {/* Module-specific Content */}
        {module === 'matrimony' && <MatrimonyContent />}
        {module === 'business' && <BusinessContent />}
        {module === 'jobs' && <JobsContent />}
        {module === 'directory' && <DirectoryContent />}

        {/* Bottom Advertisement */}
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
      </main>

      <Footer />

      {/* Auth Modal */}
      {authMode && (
        <div className="fixed inset-0 z-[60] flex items-center justify-center">
          <div className="absolute inset-0 bg-black/40 backdrop-blur-sm" onClick={() => setAuthMode(null)} />
          <motion.div
            initial={{ opacity: 0, scale: 0.95, y: 12 }}
            animate={{ opacity: 1, scale: 1, y: 0 }}
            exit={{ opacity: 0, scale: 0.95, y: 12 }}
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

            <h2 className="text-lg font-bold text-foreground font-serif">
              {authMode === 'login' ? mp.loginTitle : mp.registerTitle}
            </h2>
            <p className="mt-1 text-xs text-muted-foreground">
              {authMode === 'login' ? mp.loginDescription : mp.registerDescription}
            </p>

            {authError && (
              <div className="mt-4 rounded-lg bg-red-50 px-3 py-2 text-xs font-medium text-red-600">
                {authError}
              </div>
            )}

            <div className="mt-5 space-y-3">
              <div>
                <label className="mb-1 block text-xs font-medium text-foreground">Email</label>
                <input
                  type="email"
                  value={authEmail}
                  onChange={(e) => setAuthEmail(e.target.value)}
                  placeholder="email@example.com"
                  className="h-11 w-full rounded-xl border border-border/60 bg-white px-4 text-sm text-foreground placeholder:text-muted-foreground/60 transition-all focus:border-burgundy/30 focus:outline-none focus:ring-2 focus:ring-burgundy/10"
                />
              </div>
              <div>
                <label className="mb-1 block text-xs font-medium text-foreground">Phone</label>
                <input
                  type="tel"
                  value={authPhone}
                  onChange={(e) => setAuthPhone(e.target.value)}
                  placeholder="+91 XXXXX XXXXX"
                  className="h-11 w-full rounded-xl border border-border/60 bg-white px-4 text-sm text-foreground placeholder:text-muted-foreground/60 transition-all focus:border-burgundy/30 focus:outline-none focus:ring-2 focus:ring-burgundy/10"
                />
              </div>
              <div>
                <label className="mb-1 block text-xs font-medium text-foreground">Password</label>
                <input
                  type="password"
                  value={authPassword}
                  onChange={(e) => setAuthPassword(e.target.value)}
                  placeholder="••••••••"
                  className="h-11 w-full rounded-xl border border-border/60 bg-white px-4 text-sm text-foreground placeholder:text-muted-foreground/60 transition-all focus:border-burgundy/30 focus:outline-none focus:ring-2 focus:ring-burgundy/10"
                />
              </div>
            </div>

            <button
              onClick={handleAuth}
              disabled={authLoading}
              className="btn-bandhan-primary mt-6 w-full text-sm disabled:opacity-50"
            >
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

/* ─── Module Content Sections ─── */

function MatrimonyContent() {
  const { t } = useTranslations()
  const mp = t.modulePage
  return (
    <div className="px-4 sm:px-6">
      <div className="mx-auto max-w-7xl space-y-6">
        <Section title={mp.featuredBrides}>
          <div className="grid grid-cols-2 gap-3 sm:grid-cols-3 md:grid-cols-4">
            <ProfileCard name={mp.sampleProfileName1} detail={mp.sampleProfileDetail1} />
            <ProfileCard name={mp.sampleProfileName3} detail={mp.sampleProfileDetail3} />
          </div>
        </Section>
        <Section title={mp.featuredGrooms}>
          <div className="grid grid-cols-2 gap-3 sm:grid-cols-3 md:grid-cols-4">
            <ProfileCard name={mp.sampleProfileName2} detail={mp.sampleProfileDetail2} />
            <ProfileCard name={mp.sampleProfileName4} detail={mp.sampleProfileDetail4} />
          </div>
        </Section>
      </div>
    </div>
  )
}

function BusinessContent() {
  const { t } = useTranslations()
  const mp = t.modulePage
  const categoryKeys = ['categoryManufacturing', 'categoryRetail', 'categoryFood', 'categoryConstruction', 'categoryIT', 'categoryHealthcare', 'categoryEducation'] as const
  return (
    <div className="px-4 sm:px-6">
      <div className="mx-auto max-w-7xl space-y-6">
        <Section title={mp.categories}>
          <div className="flex flex-wrap gap-2">
            {categoryKeys.map((key) => (
              <span key={key} className="rounded-full border border-border/50 bg-white px-3 py-1.5 text-xs font-medium text-foreground/80 transition-all hover:border-burgundy/20 hover:text-burgundy">
                {mp[key]}
              </span>
            ))}
          </div>
        </Section>
        <Section title={mp.featuredBusinesses}>
          <div className="grid grid-cols-1 gap-3 sm:grid-cols-2 md:grid-cols-3">
            {([['sampleBusiness1', 'sampleBusinessCat1', 'Raipur'], ['sampleBusiness2', 'sampleBusinessCat2', 'Bhilai'], ['sampleBusiness3', 'sampleBusinessCat3', 'Durg']] as const).map(([nameKey, catKey, loc]) => (
              <div key={nameKey} className="rounded-xl border border-border/40 bg-white p-4 transition-all hover:shadow-md">
                <div className="flex items-start gap-3">
                  <div className="flex h-10 w-10 flex-shrink-0 items-center justify-center rounded-lg bg-gold/10">
                    <Briefcase className="h-5 w-5 text-gold-dark" />
                  </div>
                  <div>
                    <h4 className="text-sm font-semibold text-foreground">{mp[nameKey]}</h4>
                    <p className="mt-0.5 text-xs text-muted-foreground">{mp[catKey]}</p>
                    <div className="mt-1 flex items-center gap-1 text-xs text-muted-foreground/70">
                      <MapPin className="h-3 w-3" />{loc}
                    </div>
                  </div>
                </div>
              </div>
            ))}
          </div>
        </Section>
      </div>
    </div>
  )
}

function JobsContent() {
  const { t } = useTranslations()
  const mp = t.modulePage
  return (
    <div className="px-4 sm:px-6">
      <div className="mx-auto max-w-7xl space-y-6">
        <Section title={mp.featuredJobs}>
          <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
            <JobCard titleKey="sampleJobTitle1" companyKey="sampleJobCompany1" salaryKey="sampleJobSalary1" typeKey="sampleJobType1" locationKey="sampleJobLocation1" />
            <JobCard titleKey="sampleJobTitle2" companyKey="sampleJobCompany2" salaryKey="sampleJobSalary2" typeKey="sampleJobType2" locationKey="sampleJobLocation2" />
          </div>
        </Section>
      </div>
    </div>
  )
}

function JobCard({ titleKey, companyKey, salaryKey, typeKey, locationKey }: { titleKey: string; companyKey: string; salaryKey: string; typeKey: string; locationKey: string }) {
  const { t } = useTranslations()
  const mp = t.modulePage
  return (
    <div className="rounded-xl border border-border/40 bg-white p-4 transition-all hover:shadow-md">
      <h4 className="text-sm font-semibold text-foreground">{mp[titleKey as keyof typeof mp]}</h4>
      <p className="mt-1 text-xs text-muted-foreground">{mp[companyKey as keyof typeof mp]}</p>
      <div className="mt-3 flex flex-wrap items-center gap-2">
        <span className="rounded-full bg-teal/8 px-2.5 py-0.5 text-[0.65rem] font-medium text-teal">{mp[typeKey as keyof typeof mp]}</span>
        <span className="rounded-full bg-gold/10 px-2.5 py-0.5 text-[0.65rem] font-medium text-gold-dark">{mp[salaryKey as keyof typeof mp]}</span>
        <span className="flex items-center gap-1 text-[0.65rem] text-muted-foreground">
          <MapPin className="h-3 w-3" />{mp[locationKey as keyof typeof mp]}
        </span>
      </div>
      <button className="mt-3 btn-bandhan-primary text-xs py-1.5 px-3">{t.featured.applyNow}</button>
    </div>
  )
}

function DirectoryContent() {
  const { t } = useTranslations()
  const mp = t.modulePage
  return (
    <div className="px-4 sm:px-6">
      <div className="mx-auto max-w-7xl space-y-6">
        <Section title={mp.featuredOrganizations}>
          <div className="grid grid-cols-1 gap-3 sm:grid-cols-2 md:grid-cols-3">
            <OrgCard nameKey="sampleOrg1" membersKey="sampleOrgMembers1" locationKey="sampleOrgLocation1" />
            <OrgCard nameKey="sampleOrg2" membersKey="sampleOrgMembers2" locationKey="sampleOrgLocation2" />
            <OrgCard nameKey="sampleOrg3" membersKey="sampleOrgMembers3" locationKey="sampleOrgLocation3" />
          </div>
        </Section>
      </div>
    </div>
  )
}

function OrgCard({ nameKey, membersKey, locationKey }: { nameKey: string; membersKey: string; locationKey: string }) {
  const { t } = useTranslations()
  const mp = t.modulePage
  return (
    <div className="rounded-xl border border-border/40 bg-white p-4 transition-all hover:shadow-md">
      <div className="flex items-start gap-3">
        <div className="flex h-10 w-10 flex-shrink-0 items-center justify-center rounded-lg bg-burgundy-light/8">
          <Building2 className="h-5 w-5 text-burgundy-light" />
        </div>
        <div>
          <h4 className="text-sm font-semibold text-foreground">{mp[nameKey as keyof typeof mp]}</h4>
          <p className="mt-0.5 text-xs text-muted-foreground">{t.featured.members}: {mp[membersKey as keyof typeof mp]}</p>
          <div className="mt-1 flex items-center gap-1 text-xs text-muted-foreground/70">
            <MapPin className="h-3 w-3" />{mp[locationKey as keyof typeof mp]}
          </div>
        </div>
      </div>
    </div>
  )
}

/* ─── Shared Sub-components ─── */

function Section({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <div>
      <div className="mb-3 flex items-center justify-between">
        <h3 className="text-sm font-bold text-foreground sm:text-base">{title}</h3>
      </div>
      {children}
    </div>
  )
}

function ProfileCard({ name, detail }: { name: string; detail: string }) {
  const { t } = useTranslations()
  return (
    <div className="group overflow-hidden rounded-xl border border-border/40 bg-white transition-all hover:shadow-md">
      <div className="aspect-[3/4] w-full bg-gradient-to-b from-cream to-warm-gray" />
      <div className="p-3">
        <h4 className="text-sm font-semibold text-foreground">{name}</h4>
        <p className="mt-0.5 text-xs text-muted-foreground">{detail}</p>
        <button className="mt-2 w-full rounded-lg bg-burgundy/5 py-1.5 text-xs font-medium text-burgundy transition-all hover:bg-burgundy hover:text-white">
          {t.modulePage.viewProfile}
        </button>
      </div>
    </div>
  )
}