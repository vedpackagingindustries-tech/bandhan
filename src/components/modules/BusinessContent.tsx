'use client'

import { useState, useEffect, useCallback } from 'react'
import { Search, Briefcase, MapPin, Shield, Star } from 'lucide-react'
import { useTranslations } from '@/i18n'
import { apiGet, type BusinessListItem, type PaginatedResponse } from '@/lib/api'
import { SkeletonGrid, EmptyState, ErrorState, PaginationBar } from './ModuleShared'

interface Props {
  onOpenDetail: (id: string) => void
  onAuthRequired: () => void
  showAdvanced: boolean
  setShowAdvanced: (v: boolean) => void
}

export function BusinessContent({ onOpenDetail }: Props) {
  const { t } = useTranslations()
  const mp = t.modulePage
  const [items, setItems] = useState<BusinessListItem[]>([])
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

  const fetchBusinesses = useCallback(async () => {
    setLoading(true)
    setError('')
    const params: Record<string, string | number | undefined> = {
      page, limit: 12,
      ...(debouncedSearch ? { search: debouncedSearch } : {}),
    }
    const result = await apiGet<PaginatedResponse<BusinessListItem>>('/business', params)
    if (result.ok) {
      setItems(result.data.items)
      setTotalPages(result.data.totalPages)
      setTotal(result.data.total)
    } else {
      setError(result.error)
    }
    setLoading(false)
  }, [page, debouncedSearch])

  useEffect(() => { fetchBusinesses() }, [fetchBusinesses])

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
            className="h-11 w-full rounded-xl border border-border/60 bg-white pl-10 pr-4 text-sm text-foreground placeholder:text-muted-foreground/60 transition-all focus:border-gold-dark/30 focus:outline-none focus:ring-2 focus:ring-gold/10"
          />
        </div>

        {!loading && !error && (
          <p className="text-xs text-muted-foreground">{total} {mp.results}</p>
        )}

        {loading ? (
          <SkeletonGrid count={6} className="grid-cols-1 sm:grid-cols-2 md:grid-cols-3" />
        ) : error ? (
          <ErrorState message={error} onRetry={fetchBusinesses} />
        ) : items.length === 0 ? (
          <EmptyState title={mp.emptyTitle} description={searchQuery ? mp.noResults : mp.emptyDescription} />
        ) : (
          <>
            <div className="grid grid-cols-1 gap-3 sm:grid-cols-2 md:grid-cols-3">
              {items.map((item) => (
                <div key={item.id} onClick={() => onOpenDetail(item.id)} className="group cursor-pointer rounded-xl border border-border/40 bg-white p-4 transition-all hover:shadow-md">
                  <div className="flex items-start gap-3">
                    <div className="flex h-10 w-10 flex-shrink-0 items-center justify-center rounded-lg bg-gold/10">
                      <Briefcase className="h-5 w-5 text-gold-dark" />
                    </div>
                    <div className="min-w-0 flex-1">
                      <div className="flex items-center gap-2">
                        <h4 className="text-sm font-semibold text-foreground truncate">{item.name}</h4>
                        {item.isVerified && <Shield className="h-3.5 w-3.5 flex-shrink-0 text-emerald-500" />}
                        {item.isFeatured && <Star className="h-3.5 w-3.5 flex-shrink-0 text-gold" fill="currentColor" />}
                      </div>
                      {item.category && <p className="mt-0.5 text-xs text-muted-foreground">{item.category}</p>}
                      {(item.district?.name || item.city?.name) && (
                        <div className="mt-1 flex items-center gap-1 text-xs text-muted-foreground/70">
                          <MapPin className="h-3 w-3" />{item.district?.name || item.city?.name}
                        </div>
                      )}
                    </div>
                  </div>
                  {item.description && <p className="mt-2 text-xs text-muted-foreground line-clamp-2">{item.description}</p>}
                  <button className="mt-3 w-full rounded-lg border border-gold-dark/15 py-1.5 text-xs font-medium text-gold-dark transition-all hover:bg-gold-dark hover:text-white">{mp.viewAll}</button>
                </div>
              ))}
            </div>
            <PaginationBar page={page} totalPages={totalPages} onPageChange={setPage} />
          </>
        )}
      </div>
    </div>
  )
}
