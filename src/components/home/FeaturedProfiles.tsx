'use client'

import React, { useState, useRef, useEffect } from 'react'
import { motion } from 'framer-motion'
import {
  ArrowRight, MapPin, Briefcase, Building2, Users, Star,
  ChevronLeft, ChevronRight, Heart,
} from 'lucide-react'
import { useTranslations } from '@/i18n'
import { apiGet, type BusinessListItem, type JobListItem, type DirectoryListItem } from '@/lib/api'
import { EmptyState, ErrorState } from '@/components/modules/ModuleShared'

/* ─── Scroll Container ─── */
function ScrollRow({ children }: { children: React.ReactNode }) {
  const { t } = useTranslations()
  const ref = useRef<HTMLDivElement>(null)
  const scroll = (dir: 'left' | 'right') => {
    if (!ref.current) return
    ref.current.scrollBy({ left: dir === 'left' ? -300 : 300, behavior: 'smooth' })
  }
  return (
    <div className="group/scroll relative">
      <button onClick={() => scroll('left')} className="absolute -left-2 top-1/2 z-10 -translate-y-1/2 hidden sm:flex h-9 w-9 items-center justify-center rounded-full bg-white shadow-lg border border-border/50 transition-all duration-200 hover:shadow-xl hover:scale-105 opacity-0 group-hover/scroll:opacity-100" aria-label={t.aria.scrollLeft}>
        <ChevronLeft className="h-4 w-4 text-foreground" />
      </button>
      <div ref={ref} className="flex gap-4 overflow-x-auto scrollbar-none pb-2 px-1 snap-x snap-mandatory">{children}</div>
      <button onClick={() => scroll('right')} className="absolute -right-2 top-1/2 z-10 -translate-y-1/2 hidden sm:flex h-9 w-9 items-center justify-center rounded-full bg-white shadow-lg border border-border/50 transition-all duration-200 hover:shadow-xl hover:scale-105 opacity-0 group-hover/scroll:opacity-100" aria-label={t.aria.scrollRight}>
        <ChevronRight className="h-4 w-4 text-foreground" />
      </button>
    </div>
  )
}
/* ─── Real Business Card ─── */
function RealBusinessCard({ item, t }: { item: BusinessListItem; t: ReturnType<typeof useTranslations>['t'] }) {
  return (
    <motion.div whileHover={{ y: -4 }} transition={{ duration: 0.3 }} className="group relative min-w-[260px] snap-start flex-shrink-0 overflow-hidden rounded-2xl border border-border/50 bg-white p-5 shadow-[0_1px_3px_rgba(0,0,0,0.02)] transition-all duration-300 hover:shadow-[0_8px_32px_rgba(0,0,0,0.06)]">
      <div className="mb-4 flex h-12 w-12 items-center justify-center rounded-2xl bg-gold/10">
        <Briefcase className="h-6 w-6 text-gold-dark" strokeWidth={1.4} />
      </div>
      <h4 className="text-sm font-semibold text-foreground">{item.name}</h4>
      <div className="mt-1 flex items-center gap-1 text-xs text-muted-foreground">
        {item.category && <span className="rounded-full bg-gold/10 px-2 py-0.5 text-[0.65rem] font-medium text-gold-dark">{item.category}</span>}
      </div>
      <div className="mt-3 flex items-center justify-between text-xs text-muted-foreground">
        {(item.district?.name || item.city?.name) && <span className="flex items-center gap-1"><MapPin className="h-3 w-3" />{item.district?.name || item.city?.name}</span>}
        {item.isVerified && <span className="flex items-center gap-1 text-emerald-500"><Star className="h-3 w-3 fill-current" />Verified</span>}
      </div>
    </motion.div>
  )
}

/* ─── Real Job Card ─── */
function RealJobCard({ item, t }: { item: JobListItem; t: ReturnType<typeof useTranslations>['t'] }) {
  const employerName = [item.employer?.profile?.businessName, item.employer?.profile?.companyName].filter(Boolean).join(' ') || 'Company'
  const salary = (item.salaryMin || item.salaryMax) ? `${item.salaryCurrency === 'INR' ? '₹' : ''}${item.salaryMin?.toLocaleString('en-IN') || ''}${item.salaryMax ? ` - ${item.salaryMax?.toLocaleString('en-IN')}` : ''}` : null
  const locationName = item.location || item.district?.name || item.city?.name
  return (
    <motion.div whileHover={{ y: -4 }} transition={{ duration: 0.3 }} className="group relative min-w-[280px] snap-start flex-shrink-0 overflow-hidden rounded-2xl border border-border/50 bg-white p-5 shadow-[0_1px_3px_rgba(0,0,0,0.02)] transition-all duration-300 hover:shadow-[0_8px_32px_rgba(0,0,0,0.06)]">
      <h4 className="text-sm font-semibold text-foreground">{item.title}</h4>
      <p className="mt-1 text-xs text-muted-foreground">{employerName}</p>
      <div className="mt-3 flex flex-wrap items-center gap-2 text-xs text-muted-foreground">
        {locationName && <span className="flex items-center gap-1"><MapPin className="h-3 w-3" />{locationName}</span>}
        <span className="rounded-full bg-teal/8 px-2 py-0.5 text-[0.65rem] font-medium text-teal">{item.type?.replace(/_/g, ' ') || 'Full-time'}</span>
      </div>
      {salary && <div className="mt-3 flex items-center justify-between"><span className="text-sm font-semibold text-foreground">{salary}</span></div>}
    </motion.div>
  )
}

/* ─── Real Directory Card ─── */
function RealDirectoryCard({ item, t }: { item: DirectoryListItem; t: ReturnType<typeof useTranslations>['t'] }) {
  return (
    <motion.div whileHover={{ y: -4 }} transition={{ duration: 0.3 }} className="group relative min-w-[240px] snap-start flex-shrink-0 overflow-hidden rounded-2xl border border-border/50 bg-white p-5 shadow-[0_1px_3px_rgba(0,0,0,0.02)] transition-all duration-300 hover:shadow-[0_8px_32px_rgba(0,0,0,0.06)]">
      <div className="mb-4 flex h-12 w-12 items-center justify-center rounded-2xl bg-burgundy-light/8">
        <Building2 className="h-6 w-6 text-burgundy-light" strokeWidth={1.4} />
      </div>
      <h4 className="text-sm font-semibold text-foreground">{item.name}</h4>
      <div className="mt-2 flex items-center gap-3 text-xs text-muted-foreground">
        {(item.district?.name || item.city?.name) && <span className="flex items-center gap-1"><MapPin className="h-3 w-3" />{item.district?.name || item.city?.name}</span>}
        {item.memberCount && item.memberCount > 0 && <span className="flex items-center gap-1"><Users className="h-3 w-3" />{item.memberCount}+ {t.featured.members}</span>}
      </div>
    </motion.div>
  )
}

/* ─── Section Wrapper ─── */
function SectionRow({ title, viewAll, children }: { title: string; viewAll: string; children: React.ReactNode }) {
  return (
    <div className="mb-10 last:mb-0">
      <div className="mb-4 flex items-center justify-between">
        <h3 className="text-lg font-semibold text-foreground font-serif">{title}</h3>
        <button className="flex items-center gap-1 text-xs font-medium text-burgundy transition-all duration-200 hover:text-burgundy-dark hover:gap-2">{viewAll}<ArrowRight className="h-3.5 w-3.5" /></button>
      </div>
      <ScrollRow>{children}</ScrollRow>
    </div>
  )
}

/* ─── Main Component ─── */
export function FeaturedProfiles() {
  const { t } = useTranslations()

  // Fetch real data
  const [businesses, setBusinesses] = useState<BusinessListItem[]>([])
  const [jobs, setJobs] = useState<JobListItem[]>([])
  const [directories, setDirectories] = useState<DirectoryListItem[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState('')

  useEffect(() => {
    let cancelled = false
    async function load() {
      try {
        const [bizRes, jobRes, dirRes] = await Promise.all([
          apiGet<{ items: BusinessListItem[] }>('/business', { limit: 4, featured: 'true' }),
          apiGet<{ items: JobListItem[] }>('/jobs', { limit: 4, featured: 'true' }),
          apiGet<{ items: DirectoryListItem[] }>('/directory', { limit: 4, featured: 'true' }),
        ])
        if (cancelled) return
        if (bizRes.ok) setBusinesses(bizRes.data.items)
        if (jobRes.ok) setJobs(jobRes.data.items)
        if (dirRes.ok) setDirectories(dirRes.data.items)
      } catch {
        if (!cancelled) setError('Failed to load featured content')
      } finally {
        if (!cancelled) setLoading(false)
      }
    }
    load()
    return () => { cancelled = true }
  }, [])

  const hasAnyContent = businesses.length > 0 || jobs.length > 0 || directories.length > 0

  // Don't render the section at all if no real data exists and not loading
  if (!loading && !error && !hasAnyContent) return null

  return (
    <section className="section-padding bg-white">
      <div className="mx-auto max-w-7xl px-4 sm:px-6 lg:px-8">
        <motion.div initial={{ opacity: 0, y: 20 }} whileInView={{ opacity: 1, y: 0 }} viewport={{ once: true, margin: '-60px' }} transition={{ duration: 0.6 }} className="mb-12 text-center md:mb-16">
          <span className="inline-block rounded-full bg-burgundy/8 px-4 py-1.5 text-xs font-semibold uppercase tracking-[0.15em] text-burgundy">{t.featured.sectionTitle}</span>
          <h2 className="mt-4 text-2xl font-bold tracking-tight text-foreground sm:text-3xl md:text-4xl font-serif">{t.featured.sectionSubtitle}</h2>
        </motion.div>

        {loading ? (
          <div className="space-y-6">
            {[1, 2, 3].map(i => (
              <div key={i} className="animate-pulse h-40 rounded-2xl bg-muted/30" />
            ))}
          </div>
        ) : error ? (
          <div className="py-8 text-center text-sm text-red-500">{error}</div>
        ) : (
          <>
            {businesses.length > 0 && (
              <SectionRow title={t.featured.businesses.title} viewAll={t.featured.businesses.viewAll}>
                {businesses.map((b) => (
                  <RealBusinessCard key={b.id} item={b} t={t} />
                ))}
              </SectionRow>
            )}
            {jobs.length > 0 && (
              <SectionRow title={t.featured.jobs.title} viewAll={t.featured.jobs.viewAll}>
                {jobs.map((j) => (
                  <RealJobCard key={j.id} item={j} t={t} />
                ))}
              </SectionRow>
            )}
            {directories.length > 0 && (
              <SectionRow title={t.featured.organizations.title} viewAll={t.featured.organizations.viewAll}>
                {directories.map((d) => (
                  <RealDirectoryCard key={d.id} item={d} t={t} />
                ))}
              </SectionRow>
            )}
          </>
        )}
      </div>
    </section>
  )
}
