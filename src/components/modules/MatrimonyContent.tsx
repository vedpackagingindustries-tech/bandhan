'use client'

import { useState, useEffect, useCallback } from 'react'
import { Search, SlidersHorizontal, MapPin, Star, User, X } from 'lucide-react'
import { useTranslations } from '@/i18n'
import { cn } from '@/lib/utils'
import { useSession } from '@/hooks/use-session'
import { apiGet, type MatrimonySearchItem, type GotraItem, type LocationItem, type PaginatedResponse } from '@/lib/api'
import { SkeletonProfileGrid, EmptyState, ErrorState, PaginationBar } from './ModuleShared'
import { motion, AnimatePresence } from 'framer-motion'

interface Props {
  onOpenDetail: (id: string) => void
  onAuthRequired: () => void
  showAdvanced: boolean
  setShowAdvanced: (v: boolean) => void
}

export function MatrimonyContent({ onOpenDetail, onAuthRequired, showAdvanced, setShowAdvanced }: Props) {
  const { t } = useTranslations()
  const mp = t.modulePage
  const { isLoggedIn } = useSession()

  const [activeGender, setActiveGender] = useState<'FEMALE' | 'MALE'>('FEMALE')
  const [page, setPage] = useState(1)
  const [items, setItems] = useState<MatrimonySearchItem[]>([])
  const [totalPages, setTotalPages] = useState(0)
  const [total, setTotal] = useState(0)
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState('')
  const [advFilters, setAdvFilters] = useState<Record<string, string>>({})
  const [gotras, setGotras] = useState<GotraItem[]>([])
  const [districts, setDistricts] = useState<LocationItem[]>([])

  useEffect(() => {
    apiGet<{ gotras: GotraItem[] }>('/gotras').then(r => { if (r.ok) setGotras(r.data.gotras) })
    apiGet<{ locations: LocationItem[] }>('/locations', { level: 'DISTRICT' }).then(r => { if (r.ok) setDistricts(r.data.locations) })
  }, [])

  const fetchProfiles = useCallback(async () => {
    if (!isLoggedIn) return
    setLoading(true)
    setError('')
    const params: Record<string, string | number | undefined> = {
      gender: activeGender,
      page,
      limit: 12,
      ...(advFilters.minAge ? { minAge: parseInt(advFilters.minAge) } : {}),
      ...(advFilters.maxAge ? { maxAge: parseInt(advFilters.maxAge) } : {}),
      ...(advFilters.districtId ? { districtId: advFilters.districtId } : {}),
      ...(advFilters.gotraId ? { gotraId: advFilters.gotraId } : {}),
      ...(advFilters.education ? { education: advFilters.education } : {}),
      ...(advFilters.occupation ? { occupation: advFilters.occupation } : {}),
      ...(advFilters.maritalStatus ? { maritalStatus: advFilters.maritalStatus } : {}),
    }
    const result = await apiGet<PaginatedResponse<MatrimonySearchItem>>('/matrimony/search', params)
    if (result.ok) {
      setItems(result.data.items)
      setTotalPages(result.data.totalPages)
      setTotal(result.data.total)
    } else {
      setError(result.error)
    }
    setLoading(false)
  }, [isLoggedIn, activeGender, page, advFilters])

  useEffect(() => { fetchProfiles() }, [fetchProfiles])

  const handleGenderSwitch = (g: 'FEMALE' | 'MALE') => {
    setActiveGender(g)
    setPage(1)
  }

  const applyAdvancedFilters = (filters: Record<string, string>) => {
    setAdvFilters(filters)
    setShowAdvanced(false)
    setPage(1)
  }

  const clearAllFilters = () => {
    setAdvFilters({})
    setPage(1)
  }

  if (!isLoggedIn) {
    return (
      <div className="px-4 sm:px-6">
        <div className="mx-auto max-w-7xl">
          <EmptyState title={mp.loginRequired} description={mp.emptyMatrimonyAuth} />
        </div>
      </div>
    )
  }

  return (
    <div className="px-4 sm:px-6">
      <div className="mx-auto max-w-7xl space-y-6">
        <div className="flex gap-2">
          <div className="relative flex-1">
            <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground/60" />
            <input type="text" placeholder={mp.searchPlaceholder} className="h-11 w-full rounded-xl border border-border/60 bg-white pl-10 pr-4 text-sm text-foreground placeholder:text-muted-foreground/60 transition-all focus:border-burgundy/30 focus:outline-none focus:ring-2 focus:ring-burgundy/10" />
          </div>
          <button
            onClick={() => setShowAdvanced(true)}
            className={cn('flex h-11 items-center gap-2 rounded-xl border px-4 text-sm font-medium transition-all',
              Object.keys(advFilters).length > 0 ? 'border-burgundy/30 bg-burgundy/5 text-burgundy' : 'border-border/60 bg-white text-foreground hover:bg-cream'
            )}
          >
            <SlidersHorizontal className="h-4 w-4" />
            <span className="hidden sm:inline">{mp.filters}</span>
          </button>
        </div>

        {Object.keys(advFilters).length > 0 && (
          <div className="flex flex-wrap items-center gap-2">
            {advFilters.districtId && (
              <span className="inline-flex items-center gap-1 rounded-full bg-burgundy/8 px-2.5 py-0.5 text-[0.65rem] font-medium text-burgundy">
                {districts.find(d => d.id === advFilters.districtId)?.name || advFilters.districtId}
                <button onClick={() => setAdvFilters(f => { const n = { ...f }; delete n.districtId; return n })}><X className="h-2.5 w-2.5" /></button>
              </span>
            )}
            {advFilters.gotraId && (
              <span className="inline-flex items-center gap-1 rounded-full bg-burgundy/8 px-2.5 py-0.5 text-[0.65rem] font-medium text-burgundy">
                {gotras.find(g => g.id === advFilters.gotraId)?.name || advFilters.gotraId}
                <button onClick={() => setAdvFilters(f => { const n = { ...f }; delete n.gotraId; return n })}><X className="h-2.5 w-2.5" /></button>
              </span>
            )}
            <button onClick={clearAllFilters} className="text-[0.65rem] font-medium text-muted-foreground hover:text-burgundy">{mp.clearFilters}</button>
          </div>
        )}

        <div className="flex gap-2">
          <button
            onClick={() => handleGenderSwitch('FEMALE')}
            className={cn('flex-1 rounded-xl border py-2.5 text-center text-sm font-medium transition-all',
              activeGender === 'FEMALE' ? 'border-burgundy/30 bg-burgundy/5 text-burgundy' : 'border-border/50 bg-white text-foreground hover:bg-cream'
            )}
          >{mp.featuredBrides}</button>
          <button
            onClick={() => handleGenderSwitch('MALE')}
            className={cn('flex-1 rounded-xl border py-2.5 text-center text-sm font-medium transition-all',
              activeGender === 'MALE' ? 'border-burgundy/30 bg-burgundy/5 text-burgundy' : 'border-border/50 bg-white text-foreground hover:bg-cream'
            )}
          >{mp.featuredGrooms}</button>
        </div>

        {!loading && !error && (
          <p className="text-xs text-muted-foreground">{total} {mp.results}</p>
        )}

        {loading ? (
          <SkeletonProfileGrid count={8} />
        ) : error ? (
          <ErrorState message={error} onRetry={fetchProfiles} />
        ) : items.length === 0 ? (
          <EmptyState title={mp.emptyMatrimony} description={mp.noResults} />
        ) : (
          <>
            <div className="grid grid-cols-2 gap-3 sm:grid-cols-3 md:grid-cols-4">
              {items.map((item) => (
                <MatrimonyCard key={item.id} item={item} onClick={() => onOpenDetail(item.id)} t={t} />
              ))}
            </div>
            <PaginationBar page={page} totalPages={totalPages} onPageChange={setPage} />
          </>
        )}
      </div>

      <AnimatePresence>
        {showAdvanced && (
          <MatrimonyAdvancedSearch gotras={gotras} districts={districts} currentFilters={advFilters} onApply={applyAdvancedFilters} onClose={() => setShowAdvanced(false)} t={t} />
        )}
      </AnimatePresence>
    </div>
  )
}

function MatrimonyCard({ item, onClick, t }: { item: MatrimonySearchItem; onClick: () => void; t: ReturnType<typeof useTranslations>['t'] }) {
  const mp = t.modulePage
  const profileName = [item.profile?.firstName, item.profile?.lastName].filter(Boolean).join(' ') || 'Sahu'
  const age = item.dateOfBirth ? computeAgeFromDob(item.dateOfBirth) : null
  const location = item.district?.name || item.city?.name || ''
  const occupation = item.occupation || ''
  const imageUrl = item.media?.url || item.media?.thumbnailUrl

  return (
    <div onClick={onClick} className="group cursor-pointer overflow-hidden rounded-xl border border-border/40 bg-white transition-all hover:shadow-md">
      <div className="relative aspect-[3/4] w-full overflow-hidden">
        {imageUrl ? (
          <img src={imageUrl} alt={profileName} className="absolute inset-0 h-full w-full object-cover transition-transform duration-500 group-hover:scale-105" />
        ) : (
          <div className="absolute inset-0 bg-gradient-to-b from-cream to-warm-gray flex items-center justify-center">
            <User className="h-12 w-12 text-muted-foreground/30" />
          </div>
        )}
        {item.isFeatured && (
          <span className="absolute left-2 top-2 flex items-center gap-1 rounded-full bg-gold/90 px-2 py-0.5 text-[0.6rem] font-semibold text-white">
            <Star className="h-2.5 w-2.5" fill="currentColor" /> Featured
          </span>
        )}
      </div>
      <div className="p-3">
        <h4 className="text-sm font-semibold text-foreground truncate">{profileName}</h4>
        <div className="mt-0.5 flex items-center gap-2 text-xs text-muted-foreground">
          {age && <span>{age} yrs</span>}
          {location && <span className="flex items-center gap-0.5"><MapPin className="h-3 w-3" />{location}</span>}
        </div>
        {occupation && <p className="mt-0.5 text-xs text-muted-foreground truncate">{occupation}</p>}
        <button
          onClick={(e) => { e.stopPropagation(); onClick() }}
          className="mt-2 w-full rounded-lg bg-burgundy/5 py-1.5 text-xs font-medium text-burgundy transition-all hover:bg-burgundy hover:text-white"
        >
          {mp.viewProfile}
        </button>
      </div>
    </div>
  )
}

function MatrimonyAdvancedSearch({ gotras, districts, currentFilters, onApply, onClose, t }: {
  gotras: GotraItem[]
  districts: LocationItem[]
  currentFilters: Record<string, string>
  onApply: (filters: Record<string, string>) => void
  onClose: () => void
  t: ReturnType<typeof useTranslations>['t']
}) {
  const mp = t.modulePage
  const [filters, setFilters] = useState<Record<string, string>>(currentFilters)

  return (
    <div className="fixed inset-0 z-50 flex items-end sm:items-center justify-center">
      <div className="absolute inset-0 bg-black/40 backdrop-blur-sm" onClick={onClose} />
      <motion.div
        initial={{ opacity: 0, y: 100 }}
        animate={{ opacity: 1, y: 0 }}
        exit={{ opacity: 0, y: 100 }}
        transition={{ duration: 0.3 }}
        className="relative z-10 mx-4 mb-4 w-full max-w-lg rounded-2xl border border-border/40 bg-white shadow-2xl sm:mb-0"
      >
        <div className="flex items-center justify-between border-b border-border/30 px-5 py-4">
          <h3 className="text-sm font-bold text-foreground">{mp.advancedSearch}</h3>
          <button onClick={onClose} className="flex h-8 w-8 items-center justify-center rounded-lg hover:bg-cream"><X className="h-4 w-4" /></button>
        </div>
        <div className="max-h-[70vh] overflow-y-auto p-5 space-y-4">
          <div>
            <label className="mb-1.5 block text-xs font-medium text-foreground">{mp.district || 'District'}</label>
            <select value={filters.districtId || ''} onChange={(e) => setFilters(f => ({ ...f, districtId: e.target.value || undefined }))} className="h-10 w-full rounded-lg border border-border/60 bg-white px-3 text-sm text-foreground">
              <option value="">All Districts</option>
              {districts.map(d => <option key={d.id} value={d.id}>{d.name}</option>)}
            </select>
          </div>
          <div>
            <label className="mb-1.5 block text-xs font-medium text-foreground">{t.matrimony.gotra || 'Gotra'}</label>
            <select value={filters.gotraId || ''} onChange={(e) => setFilters(f => ({ ...f, gotraId: e.target.value || undefined }))} className="h-10 w-full rounded-lg border border-border/60 bg-white px-3 text-sm text-foreground">
              <option value="">All Gotras</option>
              {gotras.map(g => <option key={g.id} value={g.id}>{g.name}</option>)}
            </select>
          </div>
          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="mb-1.5 block text-xs font-medium text-foreground">{mp.ageFrom || 'Age From'}</label>
              <input type="number" min={18} max={60} value={filters.minAge || ''} onChange={(e) => setFilters(f => ({ ...f, minAge: e.target.value }))} placeholder="18" className="h-10 w-full rounded-lg border border-border/60 bg-white px-3 text-sm text-foreground" />
            </div>
            <div>
              <label className="mb-1.5 block text-xs font-medium text-foreground">{mp.ageTo || 'Age To'}</label>
              <input type="number" min={18} max={60} value={filters.maxAge || ''} onChange={(e) => setFilters(f => ({ ...f, maxAge: e.target.value }))} placeholder="50" className="h-10 w-full rounded-lg border border-border/60 bg-white px-3 text-sm text-foreground" />
            </div>
          </div>
          <div>
            <label className="mb-1.5 block text-xs font-medium text-foreground">{t.matrimony.education || 'Education'}</label>
            <input type="text" value={filters.education || ''} onChange={(e) => setFilters(f => ({ ...f, education: e.target.value }))} placeholder="e.g. B.Tech, MBA" className="h-10 w-full rounded-lg border border-border/60 bg-white px-3 text-sm text-foreground" />
          </div>
          <div>
            <label className="mb-1.5 block text-xs font-medium text-foreground">{t.matrimony.occupation || 'Occupation'}</label>
            <input type="text" value={filters.occupation || ''} onChange={(e) => setFilters(f => ({ ...f, occupation: e.target.value }))} placeholder="e.g. Doctor, Engineer" className="h-10 w-full rounded-lg border border-border/60 bg-white px-3 text-sm text-foreground" />
          </div>
          <div>
            <label className="mb-1.5 block text-xs font-medium text-foreground">{t.matrimony.maritalStatus || 'Marital Status'}</label>
            <select value={filters.maritalStatus || ''} onChange={(e) => setFilters(f => ({ ...f, maritalStatus: e.target.value || undefined }))} className="h-10 w-full rounded-lg border border-border/60 bg-white px-3 text-sm text-foreground">
              <option value="">Any</option>
              <option value="NEVER_MARRIED">Never Married</option>
              <option value="DIVORCED">Divorced</option>
              <option value="WIDOWED">Widowed</option>
              <option value="AWAITING_DIVORCE">Awaiting Divorce</option>
            </select>
          </div>
        </div>
        <div className="flex gap-2 border-t border-border/30 px-5 py-4">
          <button onClick={() => { setFilters({}); onApply({}) }} className="flex-1 rounded-xl border border-border/60 py-2.5 text-xs font-medium text-foreground hover:bg-cream">{mp.clearFilters}</button>
          <button onClick={() => onApply(filters)} className="flex-1 btn-bandhan-primary text-xs">{mp.applyFilters}</button>
        </div>
      </motion.div>
    </div>
  )
}

function computeAgeFromDob(dob: string): number {
  const birth = new Date(dob)
  const now = new Date()
  let age = now.getFullYear() - birth.getFullYear()
  const monthDiff = now.getMonth() - birth.getMonth()
  if (monthDiff < 0 || (monthDiff === 0 && now.getDate() < birth.getDate())) age--
  return age
}
