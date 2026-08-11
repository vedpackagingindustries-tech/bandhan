'use client'

import { motion } from 'framer-motion'
import {
  ArrowLeft, LogIn, UserPlus, Search, SlidersHorizontal,
  Heart, Briefcase, Building2, FileText, MapPin,
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
}> = {
  matrimony: { image: '/hero-matrimony.png', icon: Heart, color: 'text-burgundy', tagBg: 'bg-burgundy', benefitKey: 'matrimony' },
  business: { image: '/hero-business.png', icon: Briefcase, color: 'text-gold-dark', tagBg: 'bg-gold-dark', benefitKey: 'business' },
  jobs: { image: '/hero-jobs.png', icon: FileText, color: 'text-teal', tagBg: 'bg-teal', benefitKey: 'jobs' },
  directory: { image: '/hero-directory.png', icon: Building2, color: 'text-burgundy-light', tagBg: 'bg-burgundy-light', benefitKey: 'directory' },
}

const placeholderProfiles = [
  { name: 'Priya Sahu', detail: 'Raipur, Age 24', type: 'bride' as const },
  { name: 'Rahul Sahu', detail: 'Bhilai, Age 28', type: 'groom' as const },
  { name: 'Anita Sahu', detail: 'Durg, Age 26', type: 'bride' as const },
  { name: 'Vikram Sahu', detail: 'Raipur, Age 30', type: 'groom' as const },
]

const placeholderBusinesses = [
  { name: 'Sahu Enterprises', category: 'Manufacturing', location: 'Raipur' },
  { name: 'Shree Ganesh Traders', category: 'Retail', location: 'Bhilai' },
  { name: 'Sahu Construction', category: 'Construction', location: 'Durg' },
]

const placeholderJobs = [
  { title: 'Account Manager', company: 'Sahu Enterprises', salary: '25K-40K', type: 'Full-time', location: 'Raipur' },
  { title: 'Software Developer', company: 'Tech Solutions', salary: '35K-60K', type: 'Full-time', location: 'Bhilai' },
]

const placeholderOrgs = [
  { name: 'Sahu Yuva Sangathan', members: '2,500+', location: 'Raipur' },
  { name: 'Sahu Mahila Samiti', members: '1,800+', location: 'Bhilai' },
  { name: 'Sahu Vikas Samiti', members: '3,200+', location: 'Durg' },
]

export function ModulePageView({ module, onBack }: ModulePageViewProps) {
  const { t } = useTranslations()
  const meta = moduleMeta[module]
  const Icon = meta.icon
  const mp = t.modulePage
  const navTitle = t.nav[module]

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
                  <button className="btn-bandhan-outline text-xs sm:text-sm">{mp.login}</button>
                  <button className="btn-bandhan-primary text-xs sm:text-sm">{mp.register}</button>
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
                <img src={meta.image} alt="Advertisement" className="absolute inset-0 h-full w-full object-cover" loading="lazy" />
                <div className="absolute inset-0 bg-gradient-to-r from-black/60 to-transparent" />
                <div className="absolute inset-0 flex items-center px-5 sm:px-8">
                  <span className="text-xs font-medium text-white/60 sm:text-sm">Advertisement</span>
                </div>
              </div>
            </div>
          </div>
        </section>
      </main>

      <Footer />
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
            {placeholderProfiles.filter(p => p.type === 'bride').map((p, i) => (
              <ProfileCard key={i} name={p.name} detail={p.detail} />
            ))}
          </div>
        </Section>
        <Section title={mp.featuredGrooms}>
          <div className="grid grid-cols-2 gap-3 sm:grid-cols-3 md:grid-cols-4">
            {placeholderProfiles.filter(p => p.type === 'groom').map((p, i) => (
              <ProfileCard key={i} name={p.name} detail={p.detail} />
            ))}
          </div>
        </Section>
      </div>
    </div>
  )
}

function BusinessContent() {
  const { t } = useTranslations()
  const mp = t.modulePage
  return (
    <div className="px-4 sm:px-6">
      <div className="mx-auto max-w-7xl space-y-6">
        <Section title={mp.categories}>
          <div className="flex flex-wrap gap-2">
            {['Manufacturing', 'Retail', 'Food', 'Construction', 'IT', 'Healthcare', 'Education'].map(cat => (
              <span key={cat} className="rounded-full border border-border/50 bg-white px-3 py-1.5 text-xs font-medium text-foreground/80 transition-all hover:border-burgundy/20 hover:text-burgundy">
                {cat}
              </span>
            ))}
          </div>
        </Section>
        <Section title={mp.featuredBusinesses}>
          <div className="grid grid-cols-1 gap-3 sm:grid-cols-2 md:grid-cols-3">
            {placeholderBusinesses.map((b, i) => (
              <div key={i} className="rounded-xl border border-border/40 bg-white p-4 transition-all hover:shadow-md">
                <div className="flex items-start gap-3">
                  <div className="flex h-10 w-10 flex-shrink-0 items-center justify-center rounded-lg bg-gold/10">
                    <Briefcase className="h-5 w-5 text-gold-dark" />
                  </div>
                  <div>
                    <h4 className="text-sm font-semibold text-foreground">{b.name}</h4>
                    <p className="mt-0.5 text-xs text-muted-foreground">{b.category}</p>
                    <div className="mt-1 flex items-center gap-1 text-xs text-muted-foreground/70">
                      <MapPin className="h-3 w-3" />{b.location}
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
            {placeholderJobs.map((j, i) => (
              <div key={i} className="rounded-xl border border-border/40 bg-white p-4 transition-all hover:shadow-md">
                <h4 className="text-sm font-semibold text-foreground">{j.title}</h4>
                <p className="mt-1 text-xs text-muted-foreground">{j.company}</p>
                <div className="mt-3 flex flex-wrap items-center gap-2">
                  <span className="rounded-full bg-teal/8 px-2.5 py-0.5 text-[0.65rem] font-medium text-teal">{j.type}</span>
                  <span className="rounded-full bg-gold/10 px-2.5 py-0.5 text-[0.65rem] font-medium text-gold-dark">{j.salary}</span>
                  <span className="flex items-center gap-1 text-[0.65rem] text-muted-foreground">
                    <MapPin className="h-3 w-3" />{j.location}
                  </span>
                </div>
                <button className="mt-3 btn-bandhan-primary text-xs py-1.5 px-3">{t.featured.applyNow}</button>
              </div>
            ))}
          </div>
        </Section>
      </div>
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
            {placeholderOrgs.map((o, i) => (
              <div key={i} className="rounded-xl border border-border/40 bg-white p-4 transition-all hover:shadow-md">
                <div className="flex items-start gap-3">
                  <div className="flex h-10 w-10 flex-shrink-0 items-center justify-center rounded-lg bg-burgundy-light/8">
                    <Building2 className="h-5 w-5 text-burgundy-light" />
                  </div>
                  <div>
                    <h4 className="text-sm font-semibold text-foreground">{o.name}</h4>
                    <p className="mt-0.5 text-xs text-muted-foreground">{t.featured.members}: {o.members}</p>
                    <div className="mt-1 flex items-center gap-1 text-xs text-muted-foreground/70">
                      <MapPin className="h-3 w-3" />{o.location}
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
  return (
    <div className="group overflow-hidden rounded-xl border border-border/40 bg-white transition-all hover:shadow-md">
      <div className="aspect-[3/4] w-full bg-gradient-to-b from-cream to-warm-gray" />
      <div className="p-3">
        <h4 className="text-sm font-semibold text-foreground">{name}</h4>
        <p className="mt-0.5 text-xs text-muted-foreground">{detail}</p>
        <button className="mt-2 w-full rounded-lg bg-burgundy/5 py-1.5 text-xs font-medium text-burgundy transition-all hover:bg-burgundy hover:text-white">
          View Profile
        </button>
      </div>
    </div>
  )
}