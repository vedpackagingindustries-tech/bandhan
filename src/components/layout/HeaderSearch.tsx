'use client'

import React, { useState, useRef, useEffect, useCallback } from 'react'
import { Search, X, ArrowRight, MapPin, Heart, Briefcase, Building2, FileText, Loader2 } from 'lucide-react'
import { motion, AnimatePresence } from 'framer-motion'
import { useRouter } from 'next/navigation'
import { cn } from '@/lib/utils'
import { useSession } from '@/hooks/use-session'
import { apiGet } from '@/lib/api'
import { useTranslations } from '@/i18n'

interface SearchResult {
  id: string
  module?: string
  membershipTier?: string
  registrationCategory?: string
  status?: string
  profileVisible?: boolean
  profile?: {
    firstName: string | null
    lastName: string | null
    displayName: string | null
    gender: string | null
    dateOfBirth: string | null
    city: string | null
    state: string | null
    profilePhotoUrl: string | null
    occupation: string | null
    education: string | null
    gotra: string | null
    gotraId: string | null
    gotraMaster: { id: string; name: string; slug: string } | null
    maritalStatus: string | null
  }
}
const moduleConfig: Record<string, { icon: typeof Heart; color: string; bgColor: string; label: string }> = {
  matrimony: { icon: Heart, color: 'text-burgundy', bgColor: 'bg-burgundy/8', label: 'Matrimony' },
  business: { icon: Briefcase, color: 'text-gold-dark', bgColor: 'bg-gold/10', label: 'Business' },
  jobs: { icon: FileText, color: 'text-teal', bgColor: 'bg-teal/8', label: 'Jobs' },
  directory: { icon: Building2, color: 'text-burgundy-light', bgColor: 'bg-burgundy-light/8', label: 'Directory' },
}
export function HeaderSearch() {
  const { isLoggedIn, login } = useSession()
  const [open, setOpen] = useState(false)
  const [query, setQuery] = useState('')
  const [results, setResults] = useState<SearchResult[]>([])
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState('')
  const [showDropdown, setShowDropdown] = useState(false)
  const [selectedIndex, setSelectedIndex] = useState(-1)
  const inputRef = useRef<HTMLInputElement>(null)
  const dropdownRef = useRef<HTMLDivElement>(null)
  const router = useRouter()
  const { t } = useTranslations()

  useEffect(() => {
    if (!open) { setShowDropdown(false); setResults([]); setQuery(''); return }
    const timer = setTimeout(() => setShowDropdown(true), 200)
    return () => clearTimeout(timer)
  }, [open])

  // Close dropdown on outside click
  useEffect(() => {
    if (!showDropdown) return
    const handleClickOutside = (e: MouseEvent) => {
      if (dropdownRef.current && !dropdownRef.current.contains(e.target as Node)) {
        setShowDropdown(false)
      }
    }
    document.addEventListener('mousedown', handleClickOutside)
    return () => document.removeEventListener('mousedown', handleClickOutside)
  }, [showDropdown])

  const doSearch = useCallback(async () => {
    if (!query.trim() || !isLoggedIn) {
      setResults([])
      return
    }
    setLoading(true)
    setError('')
    try {
      const params: Record<string, string | number | undefined> = { query: query.trim(), limit: 10 }
      const result = await apiGet<{ items: SearchResult[]; total: number }>(
        '/search',
        params,
      )
      if (result.ok) {
        setResults(result.data.items || [])
        setSelectedIndex(0)
      } else {
        setError(result.error)
      }
    } catch {
      setError('Network error')
    }
    setLoading(false)
  }, [query, isLoggedIn])

  const navigateToResult = useCallback((item: SearchResult) => {
    setShowDropdown(false)
    setOpen(false)
    setQuery('')
    const mod = item.registrationCategory?.toLowerCase() || item.module?.toLowerCase()
    if (mod && ['matrimony', 'business', 'jobs', 'directory'].includes(mod)) {
      window.location.hash = `#${mod}`
    }
  }, [])

  const handleKeyDown = useCallback((e: React.KeyboardEvent) => {
    if (e.key === 'Enter' && showDropdown && results.length > 0 && selectedIndex >= 0) {
      navigateToResult(results[selectedIndex])
    }
    if (e.key === 'ArrowDown') {
    e.preventDefault()
    setSelectedIndex(i => Math.min(i + 1, results.length - 1))
  }
    if (e.key === 'ArrowUp') {
    e.preventDefault()
    setSelectedIndex(i => Math.max(i - 1, 0))
  }
    if (e.key === 'Escape') {
    setShowDropdown(false)
    setOpen(false)
    inputRef.current?.blur()
  }
  }, [showDropdown, results, selectedIndex, navigateToResult])

  const handleInputChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    setQuery(e.target.value)
    setSelectedIndex(-1)
  }

  const displayName = (item: SearchResult) => {
    const p = item.profile
    return [p?.firstName, p?.lastName, p?.displayName].filter(Boolean).join(' ') || 'User'
  }

  const getAge = (item: SearchResult) => {
    if (!item.profile?.dateOfBirth) return ''
    const birth = new Date(item.profile.dateOfBirth)
    const now = new Date()
    let age = now.getFullYear() - birth.getFullYear()
    const md = now.getMonth() - birth.getMonth()
    if (md < 0 || (md === 0 && now.getDate() < birth.getDate())) age--
    return age.toString()
  }

  return (
    <>
      <button
        onClick={() => { setOpen(true); setTimeout(() => inputRef.current?.focus(), 100) }}
        className="flex h-9 w-9 items-center justify-center rounded-xl transition-all hover:bg-cream lg:hidden"
        aria-label="Search"
      >
        <Search className="h-4 w-4 text-foreground" strokeWidth={1.5} />
      </button>

      {open && (
        <>
          <div className="fixed inset-0 z-50 bg-black/30 backdrop-blur-sm" onClick={() => { setOpen(false); setShowDropdown(false) }} />
          <motion.div
            initial={{ opacity: 0, y: -8, scale: 0.98 }}
            animate={{ opacity: 1, y: 0, scale: 1 }}
            exit={{ opacity: 0, y: -8, scale: 0.98 }}
            transition={{ duration: 0.2 }}
            className="fixed inset-x-0 top-0 z-50"
          >
            <div className="mx-auto max-w-2xl px-4 pt-16">
              <div className="relative">
                <Search className="absolute left-4 top-1/2 -translate-y-1/2 h-5 w-5 text-muted-foreground/60" />
                <input
                  ref={inputRef}
                  type="text"
                  value={query}
                  onChange={handleInputChange}
                  onKeyDown={handleKeyDown}
                  placeholder="Search members, businesses, jobs..."
                  className="w-full h-12 rounded-2xl border border-border/60 bg-white pl-12 pr-10 text-sm text-foreground placeholder:text-muted-foreground/60 shadow-lg transition-all focus:outline-none focus:ring-2 focus:ring-burgundy/20"
                  autoFocus
                />
                {query && (
                  <button onClick={() => { setQuery(''); setShowDropdown(false); setOpen(false) }} className="absolute right-4 top-1/2 -translate-y-1/2 flex h-6 w-6 items-center justify-center rounded-lg hover:bg-muted/50 transition-all">
                    <X className="h-4 w-4 text-muted-foreground" />
                  </button>
                )}
              </div>

              {/* Results Dropdown */}
              {showDropdown && (
                <div ref={dropdownRef} className="mt-2 max-h-[60vh] overflow-y-auto rounded-2xl border border-border/30 bg-white shadow-2xl">
                  {loading && (
                    <div className="flex items-center justify-center gap-2 p-8">
                      <Loader2 className="h-4 w-4 animate-spin text-muted-foreground" />
                      <span className="text-sm text-muted-foreground">Searching...</span>
                    </div>
                  )}
                  {error && (
                    <div className="flex items-center justify-center gap-2 p-6 text-center">
                      <p className="text-xs text-red-500">{error}</p>
                      <button onClick={doSearch} className="text-xs font-medium text-burgundy hover:underline">Retry</button>
                    </div>
                  )}
                  {!loading && !error && results.length === 0 && query.trim() && (
                    <div className="p-6 text-center">
                      <p className="text-sm text-muted-foreground">No results for &quot;{query}&quot;</p>
                    </div>
                  )}
                  {!loading && !error && results.length > 0 && (
                    <>
                      <div className="p-1">
                        <p className="px-3 text-[0.65rem] font-medium uppercase tracking-wider text-muted-foreground">
                          {results.length} result{results.length !== 1 ? 's' : ''} found
                        </p>
                      </div>
                      <div className="pb-2">
                        {results.map((item, idx) => {
                          const config = moduleConfig[item.registrationCategory?.toLowerCase() || 'directory']
                          const Icon = config?.icon || Building2
                          const p = item.profile
                          const name = displayName(item)
                          const age = getAge(item)
                          const loc = p?.city || ''
                          const occ = p?.occupation || ''
                          return (
                            <button
                              key={item.id}
                              onClick={() => navigateToResult(item)}
                              onMouseEnter={() => setSelectedIndex(idx)}
                              className={cn(
                                'w-full flex items-center gap-3 px-3 py-2.5 text-left transition-colors duration-100',
                                idx === selectedIndex ? 'bg-burgundy/5 text-burgundy' : 'hover:bg-muted/50',
                              )}
                            >
                              <div className={cn('flex h-9 w-9 flex-shrink-0 items-center justify-center rounded-lg', config?.bgColor)}>
                                <Icon className={cn('h-4.5 w-4.5', config?.color)} strokeWidth={1.3} />
                              </div>
                              <div className="min-w-0 flex-1">
                                <div className="flex items-baseline gap-1.5">
                                  <span className="text-sm font-medium text-foreground truncate">{name}</span>
                                  {age && <span className="text-xs text-muted-foreground">, {age}y</span>}
                                </div>
                                <div className="flex items-center gap-2 text-[0.65rem] text-muted-foreground">
                                  {loc && <span className="flex items-center gap-0.5"><MapPin className="h-3 w-3" />{loc}</span>}
                                  {occ && <span className="flex items-center gap-0.5"><Briefcase className="h-3 w-3" />{occ}</span>}
                                </div>
                              </div>
                              <ArrowRight className={cn('h-4 w-4 flex-shrink-0 opacity-30', idx === selectedIndex && 'opacity-100 text-burgundy')} />
                            </button>
                          )
                        })}
                      </div>
                    </>
                  )}
                </div>
              )}
            </div>
          </motion.div>
        </>
      )}
    </>
  )
}