'use client'

import { useRef } from 'react'
import { motion } from 'framer-motion'
// Images use native <img> for maximum compatibility
import { ArrowRight, MapPin, Briefcase, Building2, Users, Clock, Star, ChevronLeft, ChevronRight, Heart } from 'lucide-react'
import { useTranslations } from '@/i18n'
import { cn } from '@/lib/utils'

/* ─── Sample Data ─── */
interface ProfileCard {
  name: string
  age: string
  location: string
  profession: string
  image: string
}

const sampleBrides: ProfileCard[] = [
  { name: 'Ananya Sahu', age: '24', location: 'Raipur', profession: 'Software Engineer', image: '/featured-bride.png' },
  { name: 'Kavita Sahu', age: '26', location: 'Bhilai', profession: 'Doctor', image: '/featured-bride.png' },
  { name: 'Pooja Sahu', age: '23', location: 'Durg', profession: 'Teacher', image: '/featured-bride.png' },
  { name: 'Ritu Sahu', age: '25', location: 'Raipur', profession: 'CA', image: '/featured-bride.png' },
]

const sampleGrooms: ProfileCard[] = [
  { name: 'Vikram Sahu', age: '28', location: 'Raipur', profession: 'Business Owner', image: '/featured-groom.png' },
  { name: 'Rahul Sahu', age: '30', location: 'Bhilai', profession: 'Civil Engineer', image: '/featured-groom.png' },
  { name: 'Amit Sahu', age: '27', location: 'Durg', profession: 'IT Professional', image: '/featured-groom.png' },
  { name: 'Sanjay Sahu', age: '29', location: 'Raipur', profession: 'Doctor', image: '/featured-groom.png' },
]

interface BusinessCard {
  name: string
  category: string
  location: string
  rating: string
}

const sampleBusinesses: BusinessCard[] = [
  { name: 'Sahu Enterprises', category: 'Manufacturing', location: 'Raipur', rating: '4.8' },
  { name: 'Sahu Traders', category: 'Wholesale', location: 'Bhilai', rating: '4.5' },
  { name: 'Sahu Constructions', category: 'Construction', location: 'Durg', rating: '4.9' },
  { name: 'Sahu Foods', category: 'Food & Beverage', location: 'Raipur', rating: '4.7' },
]

interface JobCard {
  title: string
  company: string
  location: string
  type: string
  salary: string
}

const sampleJobs: JobCard[] = [
  { title: 'Senior Developer', company: 'Sahu Technologies', location: 'Raipur', type: 'Full-time', salary: '12-18 LPA' },
  { title: 'Marketing Manager', company: 'Sahu Enterprises', location: 'Bhilai', type: 'Full-time', salary: '8-12 LPA' },
  { title: 'Accountant', company: 'Sahu & Associates', location: 'Durg', type: 'Full-time', salary: '5-7 LPA' },
  { title: 'Site Engineer', company: 'Sahu Constructions', location: 'Raipur', type: 'Full-time', salary: '6-9 LPA' },
]

interface OrgCard {
  name: string
  location: string
  members: string
}

const sampleOrgs: OrgCard[] = [
  { name: 'Sahu Yuva Sangathan', location: 'Raipur', members: '2,500+' },
  { name: 'Sahu Mahila Samiti', location: 'Bhilai', members: '1,800+' },
  { name: 'Sahu Seva Trust', location: 'Durg', members: '3,200+' },
  { name: 'Sahu Shiksha Samiti', location: 'Raipur', members: '1,500+' },
]

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
      <button
        onClick={() => scroll('left')}
        className="absolute -left-2 top-1/2 z-10 -translate-y-1/2 hidden sm:flex h-9 w-9 items-center justify-center rounded-full bg-white shadow-lg border border-border/50 transition-all duration-200 hover:shadow-xl hover:scale-105 opacity-0 group-hover/scroll:opacity-100"
        aria-label={t.aria.scrollLeft}
      >
        <ChevronLeft className="h-4 w-4 text-foreground" />
      </button>
      <div ref={ref} className="flex gap-4 overflow-x-auto scrollbar-none pb-2 px-1 snap-x snap-mandatory">
        {children}
      </div>
      <button
        onClick={() => scroll('right')}
        className="absolute -right-2 top-1/2 z-10 -translate-y-1/2 hidden sm:flex h-9 w-9 items-center justify-center rounded-full bg-white shadow-lg border border-border/50 transition-all duration-200 hover:shadow-xl hover:scale-105 opacity-0 group-hover/scroll:opacity-100"
        aria-label={t.aria.scrollRight}
      >
        <ChevronRight className="h-4 w-4 text-foreground" />
      </button>
    </div>
  )
}

/* ─── Profile Card ─── */
function ProfileCardComponent({ profile, t }: { profile: ProfileCard; t: ReturnType<typeof useTranslations>['t'] }) {
  return (
    <motion.div
      whileHover={{ y: -4 }}
      transition={{ duration: 0.3 }}
      className="group relative min-w-[220px] snap-start flex-shrink-0 overflow-hidden rounded-2xl border border-border/50 bg-white shadow-[0_1px_3px_rgba(0,0,0,0.02)] transition-all duration-300 hover:shadow-[0_8px_32px_rgba(0,0,0,0.06)]"
    >
      {/* Image */}
      <div className="relative h-64 overflow-hidden">
        <img
          src={profile.image}
          alt={profile.name}
          className="absolute inset-0 h-full w-full object-cover object-top transition-transform duration-500 group-hover:scale-105"
        />
        <div className="absolute inset-0 bg-gradient-to-t from-black/50 via-transparent to-transparent" />
        <button className="absolute right-3 top-3 flex h-8 w-8 items-center justify-center rounded-full bg-white/80 backdrop-blur-sm transition-all duration-200 hover:bg-burgundy hover:text-white">
          <Heart className="h-4 w-4" strokeWidth={1.5} />
        </button>
        <div className="absolute bottom-3 left-3">
          <h4 className="text-sm font-semibold text-white">{profile.name}</h4>
        </div>
      </div>

      {/* Details */}
      <div className="p-4">
        <div className="flex items-center gap-3 text-xs text-muted-foreground">
          <span className="flex items-center gap-1">
            <span className="font-medium text-foreground">{t.featured.age}:</span> {profile.age}
          </span>
          <span className="flex items-center gap-1">
            <MapPin className="h-3 w-3" />{profile.location}
          </span>
        </div>
        <div className="mt-2 flex items-center gap-1 text-xs text-muted-foreground">
          <Briefcase className="h-3 w-3" />{profile.profession}
        </div>
        <button className="mt-3 w-full rounded-xl border border-burgundy/15 py-2 text-xs font-medium text-burgundy transition-all duration-200 hover:bg-burgundy hover:text-white">
          {t.featured.viewProfile}
        </button>
      </div>
    </motion.div>
  )
}

/* ─── Business Card ─── */
function BusinessCardComponent({ business, t }: { business: BusinessCard; t: ReturnType<typeof useTranslations>['t'] }) {
  return (
    <motion.div
      whileHover={{ y: -4 }}
      transition={{ duration: 0.3 }}
      className="group relative min-w-[260px] snap-start flex-shrink-0 overflow-hidden rounded-2xl border border-border/50 bg-white p-5 shadow-[0_1px_3px_rgba(0,0,0,0.02)] transition-all duration-300 hover:shadow-[0_8px_32px_rgba(0,0,0,0.06)]"
    >
      <div className="mb-4 flex h-12 w-12 items-center justify-center rounded-2xl bg-gold/10">
        <Briefcase className="h-6 w-6 text-gold-dark" strokeWidth={1.4} />
      </div>
      <h4 className="text-sm font-semibold text-foreground">{business.name}</h4>
      <div className="mt-1 flex items-center gap-1 text-xs text-muted-foreground">
        <span className="rounded-full bg-gold/10 px-2 py-0.5 text-[0.65rem] font-medium text-gold-dark">{business.category}</span>
      </div>
      <div className="mt-3 flex items-center justify-between text-xs text-muted-foreground">
        <span className="flex items-center gap-1"><MapPin className="h-3 w-3" />{business.location}</span>
        <span className="flex items-center gap-1 text-gold-dark"><Star className="h-3 w-3 fill-current" />{business.rating}</span>
      </div>
      <button className="mt-4 w-full rounded-xl border border-gold-dark/15 py-2 text-xs font-medium text-gold-dark transition-all duration-200 hover:bg-gold-dark hover:text-white">
        {t.featured.viewDetails}
      </button>
    </motion.div>
  )
}

/* ─── Job Card ─── */
function JobCardComponent({ job, t }: { job: JobCard; t: ReturnType<typeof useTranslations>['t'] }) {
  return (
    <motion.div
      whileHover={{ y: -4 }}
      transition={{ duration: 0.3 }}
      className="group relative min-w-[280px] snap-start flex-shrink-0 overflow-hidden rounded-2xl border border-border/50 bg-white p-5 shadow-[0_1px_3px_rgba(0,0,0,0.02)] transition-all duration-300 hover:shadow-[0_8px_32px_rgba(0,0,0,0.06)]"
    >
      <h4 className="text-sm font-semibold text-foreground">{job.title}</h4>
      <p className="mt-1 text-xs text-muted-foreground">{job.company}</p>
      <div className="mt-3 flex flex-wrap items-center gap-2 text-xs text-muted-foreground">
        <span className="flex items-center gap-1"><MapPin className="h-3 w-3" />{job.location}</span>
        <span className="rounded-full bg-teal/8 px-2 py-0.5 text-[0.65rem] font-medium text-teal">{job.type}</span>
      </div>
      <div className="mt-3 flex items-center justify-between">
        <span className="text-sm font-semibold text-foreground">{job.salary}</span>
      </div>
      <button className="mt-4 w-full rounded-xl border border-teal/15 py-2 text-xs font-medium text-teal transition-all duration-200 hover:bg-teal hover:text-white">
        {t.featured.applyNow}
      </button>
    </motion.div>
  )
}

/* ─── Organization Card ─── */
function OrgCardComponent({ org, t }: { org: OrgCard; t: ReturnType<typeof useTranslations>['t'] }) {
  return (
    <motion.div
      whileHover={{ y: -4 }}
      transition={{ duration: 0.3 }}
      className="group relative min-w-[240px] snap-start flex-shrink-0 overflow-hidden rounded-2xl border border-border/50 bg-white p-5 shadow-[0_1px_3px_rgba(0,0,0,0.02)] transition-all duration-300 hover:shadow-[0_8px_32px_rgba(0,0,0,0.06)]"
    >
      <div className="mb-4 flex h-12 w-12 items-center justify-center rounded-2xl bg-burgundy-light/8">
        <Building2 className="h-6 w-6 text-burgundy-light" strokeWidth={1.4} />
      </div>
      <h4 className="text-sm font-semibold text-foreground">{org.name}</h4>
      <div className="mt-2 flex items-center gap-3 text-xs text-muted-foreground">
        <span className="flex items-center gap-1"><MapPin className="h-3 w-3" />{org.location}</span>
        <span className="flex items-center gap-1"><Users className="h-3 w-3" />{org.members} {t.featured.members}</span>
      </div>
      <button className="mt-4 w-full rounded-xl border border-burgundy-light/15 py-2 text-xs font-medium text-burgundy-light transition-all duration-200 hover:bg-burgundy-light hover:text-white">
        {t.featured.viewDetails}
      </button>
    </motion.div>
  )
}

/* ─── Section Wrapper ─── */
function SectionRow({
  title,
  viewAll,
  children,
}: {
  title: string
  viewAll: string
  children: React.ReactNode
}) {
  return (
    <div className="mb-10 last:mb-0">
      <div className="mb-4 flex items-center justify-between">
        <h3 className="text-lg font-semibold text-foreground font-serif">{title}</h3>
        <button className="flex items-center gap-1 text-xs font-medium text-burgundy transition-all duration-200 hover:text-burgundy-dark hover:gap-2">
          {viewAll}
          <ArrowRight className="h-3.5 w-3.5" />
        </button>
      </div>
      <ScrollRow>{children}</ScrollRow>
    </div>
  )
}

/* ─── Main Component ─── */
export function FeaturedProfiles() {
  const { t } = useTranslations()

  return (
    <section className="section-padding bg-white">
      <div className="mx-auto max-w-7xl px-4 sm:px-6 lg:px-8">
        {/* Section Header */}
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          whileInView={{ opacity: 1, y: 0 }}
          viewport={{ once: true, margin: '-60px' }}
          transition={{ duration: 0.6 }}
          className="mb-12 text-center md:mb-16"
        >
          <span className="inline-block rounded-full bg-burgundy/8 px-4 py-1.5 text-xs font-semibold uppercase tracking-[0.15em] text-burgundy">
            {t.featured.sectionTitle}
          </span>
          <h2 className="mt-4 text-2xl font-bold tracking-tight text-foreground sm:text-3xl md:text-4xl font-serif">
            {t.featured.sectionSubtitle}
          </h2>
        </motion.div>

        {/* Brides */}
        <SectionRow title={t.featured.brides.title} viewAll={t.featured.brides.viewAll}>
          {sampleBrides.map((b) => (
            <ProfileCardComponent key={b.name} profile={b} t={t} />
          ))}
        </SectionRow>

        {/* Grooms */}
        <SectionRow title={t.featured.grooms.title} viewAll={t.featured.grooms.viewAll}>
          {sampleGrooms.map((g) => (
            <ProfileCardComponent key={g.name} profile={g} t={t} />
          ))}
        </SectionRow>

        {/* Businesses */}
        <SectionRow title={t.featured.businesses.title} viewAll={t.featured.businesses.viewAll}>
          {sampleBusinesses.map((b) => (
            <BusinessCardComponent key={b.name} business={b} t={t} />
          ))}
        </SectionRow>

        {/* Jobs */}
        <SectionRow title={t.featured.jobs.title} viewAll={t.featured.jobs.viewAll}>
          {sampleJobs.map((j) => (
            <JobCardComponent key={j.title + j.company} job={j} t={t} />
          ))}
        </SectionRow>

        {/* Organizations */}
        <SectionRow title={t.featured.organizations.title} viewAll={t.featured.organizations.viewAll}>
          {sampleOrgs.map((o) => (
            <OrgCardComponent key={o.name} org={o} t={t} />
          ))}
        </SectionRow>
      </div>
    </section>
  )
}