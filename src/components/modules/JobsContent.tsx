'use client'

import { useState, useEffect, useCallback } from 'react'
import { Search, MapPin, Star, Eye, Users, Loader2, CheckCircle } from 'lucide-react'
import { useTranslations } from '@/i18n'
import { apiGet, apiPost, type JobListItem, type PaginatedResponse } from '@/lib/api'
import { SkeletonGrid, EmptyState, ErrorState, PaginationBar } from './ModuleShared'

interface Props {
  onOpenDetail: (id: string) => void
  onAuthRequired: () => void
  showAdvanced: boolean
  setShowAdvanced: (v: boolean) => void
}

export function JobsContent({ onOpenDetail, onAuthRequired }: Props) {
  const { t } = useTranslations()
  const mp = t.modulePage
  const [items, setItems] = useState<JobListItem[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState('')
  const [searchQuery, setSearchQuery] = useState('')
  const [page, setPage] = useState(1)
  const [totalPages, setTotalPages] = useState(0)
  const [total, setTotal] = useState(0)
  const [debouncedSearch, setDebouncedSearch] = useState('')

  useEffect(() => {
    const timer = setTimeout(() => setDebouncedSearch(searchQuery), 400)
    return () => clearTimeout(timer)
  }, [searchQuery])

  const fetchJobs = useCallback(async () => {
    setLoading(true)
    setError('')
    const params: Record<string, string | number | undefined> = {
      page, limit: 12,
      ...(debouncedSearch ? { search: debouncedSearch } : {}),
    }
    const result = await apiGet<PaginatedResponse<JobListItem>>('/jobs', params)
    if (result.ok) {
      setItems(result.data.items)
      setTotalPages(result.data.totalPages)
      setTotal(result.data.total)
    } else {
      setError(result.error)
    }
    setLoading(false)
  }, [page, debouncedSearch])

  useEffect(() => { fetchJobs() }, [fetchJobs])

  return (
    <div className="px-4 sm:px-6">
      <div className="mx-auto max-w-7xl space-y-6">
        <div className="relative">
          <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground/60" />
          <input
            type="text"
            placeholder={mp.searchPlaceholder}
            value={searchQuery}
            onChange={(e) => { setSearchQuery(e.target.value); setPage(1) }}
            className="h-11 w-full rounded-xl border border-border/60 bg-white pl-10 pr-4 text-sm text-foreground placeholder:text-muted-foreground/60 transition-all focus:border-teal/30 focus:outline-none focus:ring-2 focus:ring-teal/10"
          />
        </div>

        {!loading && !error && (
          <p className="text-xs text-muted-foreground">{total} {mp.results}</p>
        )}

        {loading ? (
          <SkeletonGrid count={6} className="grid-cols-1 sm:grid-cols-2" />
        ) : error ? (
          <ErrorState message={error} onRetry={fetchJobs} />
        ) : items.length === 0 ? (
          <EmptyState title={mp.emptyTitle} description={searchQuery ? mp.noResults : mp.emptyDescription} />
        ) : (
          <>
            <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
              {items.map((item) => {
                const employerName = [item.employer?.profile?.businessName, item.employer?.profile?.companyName, item.employer?.profile?.firstName].filter(Boolean).join(' ') || 'Company'
                const salary = (item.salaryMin || item.salaryMax) ? `${item.salaryCurrency === 'INR' ? '₹' : ''}${item.salaryMin?.toLocaleString('en-IN') || ''}${item.salaryMax ? ` - ${item.salaryMax?.toLocaleString('en-IN')}` : ''}` : null
                const locationName = item.location || item.district?.name || item.city?.name

                return (
                  <div key={item.id} onClick={() => onOpenDetail(item.id)} className="group cursor-pointer rounded-xl border border-border/40 bg-white p-4 transition-all hover:shadow-md">
                    <div className="flex items-start justify-between gap-2">
                      <div className="min-w-0 flex-1">
                        <div className="flex items-center gap-2">
                          <h4 className="text-sm font-semibold text-foreground truncate">{item.title}</h4>
                          {item.isFeatured && <Star className="h-3.5 w-3.5 flex-shrink-0 text-gold" fill="currentColor" />}
                        </div>
                        <p className="mt-1 text-xs text-muted-foreground">{employerName}</p>
                      </div>
                      {item.isRemote && (
                        <span className="flex-shrink-0 rounded-full bg-teal/8 px-2 py-0.5 text-[0.6rem] font-medium text-teal">Remote</span>
                      )}
                    </div>
                    <div className="mt-3 flex flex-wrap items-center gap-2">
                      <span className="rounded-full bg-teal/8 px-2.5 py-0.5 text-[0.65rem] font-medium text-teal">
                        {item.type?.replace(/_/g, ' ') || 'Full-time'}
                      </span>
                      {salary && (
                        <span className="rounded-full bg-gold/10 px-2.5 py-0.5 text-[0.65rem] font-medium text-gold-dark">{salary}</span>
                      )}
                      {locationName && (
                        <span className="flex items-center gap-1 text-[0.65rem] text-muted-foreground">
                          <MapPin className="h-3 w-3" />{locationName}
                        </span>
                      )}
                    </div>
                    <div className="mt-3 flex items-center justify-between">
                      <div className="flex items-center gap-3 text-[0.6rem] text-muted-foreground">
                        {item.applicationsCount > 0 && <span>{item.applicationsCount} applications</span>}
                        <span>{item.viewsCount} views</span>
                      </div>
                      <button className="rounded-lg bg-teal/8 px-3 py-1.5 text-xs font-medium text-teal transition-all hover:bg-teal hover:text-white">{t.featured.applyNow}</button>
                    </div>
                  </div>
                )
              })}
            </div>
            <PaginationBar page={page} totalPages={totalPages} onPageChange={setPage} />
          </>
        )}
      </div>
    </div>
  )
}
