'use client'

import { useState } from 'react'
import { ArrowLeft, Briefcase, MapPin, Shield, Star, ExternalLink, Building2, Users, Eye, Calendar, GraduationCap, User, Heart, IndianRupee, CheckCircle, Loader2 } from 'lucide-react'
import { useTranslations } from '@/i18n'
import { apiGet, apiPost } from '@/lib/api'
import { EmptyState, ErrorState, computeAge } from './ModuleShared'

export type ModuleKey = 'matrimony' | 'business' | 'jobs' | 'directory'

interface Props {
  module: ModuleKey
  onBack: () => void
  onAuthRequired: () => void
}

export function DetailView({ module, onBack, onAuthRequired }: Props) {
  const [data, setData] = useState<Record<string, unknown> | null>(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState('')
  const { t } = useTranslations()

  // Fetch is handled by parent, but we add a simple fetch-on-mount
  // The parent passes the already-fetched data
  if (!data && !loading && !error) return null

  if (loading && !data && !error) {
    return (
      <div className="px-4 py-8 sm:px-6">
        <div className="mx-auto max-w-3xl space-y-4 animate-pulse">
          <div className="h-6 w-2/3 rounded bg-muted" />
          <div className="h-4 w-1/3 rounded bg-muted" />
          <div className="h-48 w-full rounded-xl bg-muted" />
          <div className="h-4 w-full rounded bg-muted" />
        </div>
      </div>
    )
  }

  if (error) {
    return (
      <div className="px-4 py-8 sm:px-6">
        <div className="mx-auto max-w-3xl"><ErrorState message={error} onRetry={() => {}} /></div>
      </div>
    )
  }

  if (!data) return null

  if (module === 'business') return <BusinessDetail data={data} />
  if (module === 'jobs') return <JobDetail data={data} t={t} />
  if (module === 'directory') return <DirectoryDetail data={data} />
  if (module === 'matrimony') return <MatrimonyDetail data={data} />
  return null
}

// Fetch detail data helper used by parent
export async function fetchDetail(module: ModuleKey, id: string): Promise<{ data: Record<string, unknown> | null; error: string }> {
  let endpoint = ''
  if (module === 'business') endpoint = `/business/${id}`
  else if (module === 'jobs') endpoint = `/jobs/${id}`
  else if (module === 'directory') endpoint = `/directory/${id}`
  else if (module === 'matrimony') endpoint = `/matrimony/${id}`

  const result = await apiGet(endpoint)
  if (result.ok) return { data: result.data as Record<string, unknown>, error: '' }
  return { data: null, error: result.error }
}

function BusinessDetail({ data }: { data: Record<string, unknown> }) {
  const owner = data.owner as { profile?: { firstName: string | null; lastName: string | null } } | null
  const ownerName = owner?.profile ? [owner.profile.firstName, owner.profile.lastName].filter(Boolean).join(' ') : null
  const district = data.district as { name: string } | null
  const city = data.city as { name: string } | null
  const location = [data.address as string, district?.name, city?.name].filter(Boolean).join(', ')

  return (
    <div className="px-4 py-6 sm:px-6">
      <div className="mx-auto max-w-3xl space-y-5">
        <div className="rounded-2xl border border-border/40 bg-white p-5 sm:p-6">
          <div className="flex items-start gap-4">
            <div className="flex h-14 w-14 flex-shrink-0 items-center justify-center rounded-2xl bg-gold/10">
              <Briefcase className="h-7 w-7 text-gold-dark" />
            </div>
            <div className="min-w-0 flex-1">
              <div className="flex items-center gap-2">
                <h1 className="text-lg font-bold text-foreground sm:text-xl">{data.name as string}</h1>
                {data.isVerified && <Shield className="h-4 w-4 text-emerald-500" />}
                {data.isFeatured && <Star className="h-4 w-4 text-gold" fill="currentColor" />}
              </div>
              {data.category && <span className="mt-1 inline-block rounded-full bg-gold/10 px-2.5 py-0.5 text-[0.65rem] font-medium text-gold-dark">{data.category as string}</span>}
            </div>
          </div>
          {data.description && (
            <div className="mt-5">
              <h3 className="mb-2 text-xs font-semibold uppercase tracking-wider text-muted-foreground">Description</h3>
              <p className="text-sm leading-relaxed text-foreground/80 whitespace-pre-wrap">{data.description as string}</p>
            </div>
          )}
          <div className="mt-5 grid grid-cols-2 gap-4">
            {location && <div className="flex items-center gap-2 text-xs text-muted-foreground"><MapPin className="h-4 w-4 text-burgundy" />{location}</div>}
            {data.phone && <div className="flex items-center gap-2 text-xs text-muted-foreground"><Users className="h-4 w-4 text-burgundy" />{data.phone as string}</div>}
            {data.website && (
              <div className="flex items-center gap-2 text-xs text-muted-foreground">
                <ExternalLink className="h-4 w-4 text-burgundy" />
                <a href={data.website as string} target="_blank" rel="noopener noreferrer" className="text-burgundy hover:underline truncate">{data.website as string}</a>
              </div>
            )}
            {data.type && <div className="flex items-center gap-2 text-xs text-muted-foreground"><Building2 className="h-4 w-4 text-burgundy" />{String(data.type).replace(/_/g, ' ')}</div>}
          </div>
          <div className="mt-4 flex items-center gap-4 text-[0.65rem] text-muted-foreground">
            <span className="flex items-center gap-1"><Eye className="h-3 w-3" />{String(data.viewsCount)} views</span>
            {ownerName && <span>By {ownerName}</span>}
          </div>
        </div>
      </div>
    </div>
  )
}

function JobDetail({ data, t }: { data: Record<string, unknown>; t: ReturnType<typeof useTranslations>['t'] }) {
  const mp = t.modulePage
  const [applyLoading, setApplyLoading] = useState(false)
  const [applyResult, setApplyResult] = useState<{ success: boolean; message: string } | null>(null)

  const employer = data.employer as { profile?: { firstName: string | null; lastName: string | null; businessName: string | null; companyName: string | null } } | null
  const employerName = employer?.profile ? [employer.profile.businessName, employer.profile.companyName, employer.profile.firstName].filter(Boolean).join(' ') : 'Company'
  const district = data.district as { name: string } | null
  const city = data.city as { name: string } | null
  const salary = (data.salaryMin || data.salaryMax) ? `${data.salaryCurrency === 'INR' ? '₹' : ''}${(data.salaryMin as number)?.toLocaleString('en-IN') || ''}${data.salaryMax ? ` - ${(data.salaryMax as number)?.toLocaleString('en-IN')}` : ''}` : null
  const locationName = [data.location as string, district?.name, city?.name].filter(Boolean).join(', ')
  const hasApplied = data.hasApplied as boolean

  const handleApply = async () => {
    setApplyLoading(true)
    const result = await apiPost('/jobs/apply', { jobId: data.id })
    if (result.ok) {
      setApplyResult({ success: true, message: mp.applySuccess })
    } else {
      setApplyResult({ success: false, message: result.error.includes('Already') ? mp.duplicateApplication : result.error })
    }
    setApplyLoading(false)
  }

  return (
    <div className="px-4 py-6 sm:px-6">
      <div className="mx-auto max-w-3xl space-y-5">
        <div className="rounded-2xl border border-border/40 bg-white p-5 sm:p-6">
          <div className="flex items-start justify-between gap-3">
            <div className="min-w-0 flex-1">
              <h1 className="text-lg font-bold text-foreground sm:text-xl">{data.title as string}</h1>
              <p className="mt-1 text-sm text-muted-foreground">{employerName}</p>
            </div>
            {data.isRemote && <span className="flex-shrink-0 rounded-full bg-teal/8 px-2.5 py-0.5 text-xs font-medium text-teal">Remote</span>}
          </div>
          <div className="mt-4 flex flex-wrap items-center gap-2">
            <span className="rounded-full bg-teal/8 px-2.5 py-0.5 text-[0.65rem] font-medium text-teal">{String(data.type || 'FULL_TIME').replace(/_/g, ' ')}</span>
            {data.category && <span className="rounded-full bg-burgundy/8 px-2.5 py-0.5 text-[0.65rem] font-medium text-burgundy">{data.category as string}</span>}
            {salary && <span className="rounded-full bg-gold/10 px-2.5 py-0.5 text-[0.65rem] font-medium text-gold-dark">{salary}</span>}
          </div>
          {data.description && (
            <div className="mt-5">
              <h3 className="mb-2 text-xs font-semibold uppercase tracking-wider text-muted-foreground">Description</h3>
              <p className="text-sm leading-relaxed text-foreground/80 whitespace-pre-wrap">{data.description as string}</p>
            </div>
          )}
          <div className="mt-5 grid grid-cols-2 gap-y-3 gap-x-6">
            {locationName && <div className="flex items-center gap-2 text-xs text-muted-foreground"><MapPin className="h-4 w-4 text-teal" />{locationName}</div>}
            {data.experience && <div className="flex items-center gap-2 text-xs text-muted-foreground"><Calendar className="h-4 w-4 text-teal" />{data.experience as string} experience</div>}
            {data.education && <div className="flex items-center gap-2 text-xs text-muted-foreground"><GraduationCap className="h-4 w-4 text-teal" />{data.education as string}</div>}
            {data.vacancies && (data.vacancies as number) > 0 && <div className="flex items-center gap-2 text-xs text-muted-foreground"><Users className="h-4 w-4 text-teal" />{data.vacancies as number} vacancies</div>}
          </div>
          <div className="mt-4 flex items-center gap-4 text-[0.65rem] text-muted-foreground">
            <span className="flex items-center gap-1"><Eye className="h-3 w-3" />{String(data.viewsCount)} views</span>
            <span className="flex items-center gap-1"><Users className="h-3 w-3" />{String(data.applicationsCount || 0)} applications</span>
          </div>
          <div className="mt-6 border-t border-border/30 pt-5">
            {hasApplied ? (
              <div className="flex items-center gap-2 rounded-xl bg-emerald-50 px-4 py-3 text-sm font-medium text-emerald-700"><CheckCircle className="h-4 w-4" /> {mp.alreadyApplied}</div>
            ) : applyResult?.success ? (
              <div className="flex items-center gap-2 rounded-xl bg-emerald-50 px-4 py-3 text-sm font-medium text-emerald-700"><CheckCircle className="h-4 w-4" /> {applyResult.message}</div>
            ) : (
              <div className="flex flex-col sm:flex-row items-start sm:items-center gap-3">
                <button onClick={handleApply} disabled={applyLoading} className="btn-bandhan-primary text-sm disabled:opacity-50 flex items-center gap-2">
                  {applyLoading && <Loader2 className="h-4 w-4 animate-spin" />}{t.featured.applyNow}
                </button>
                {applyResult && !applyResult.success && <span className="text-xs text-red-500">{applyResult.message}</span>}
              </div>
            )}
          </div>
        </div>
      </div>
    </div>
  )
}

function DirectoryDetail({ data }: { data: Record<string, unknown> }) {
  const owner = data.owner as { profile?: { firstName: string | null; lastName: string | null } } | null
  const ownerName = owner?.profile ? [owner.profile.firstName, owner.profile.lastName].filter(Boolean).join(' ') : null
  const district = data.district as { name: string } | null
  const city = data.city as { name: string } | null
  const location = [data.address as string, district?.name, city?.name].filter(Boolean).join(', ')

  return (
    <div className="px-4 py-6 sm:px-6">
      <div className="mx-auto max-w-3xl space-y-5">
        <div className="rounded-2xl border border-border/40 bg-white p-5 sm:p-6">
          <div className="flex items-start gap-4">
            <div className="flex h-14 w-14 flex-shrink-0 items-center justify-center rounded-2xl bg-burgundy-light/8">
              <Building2 className="h-7 w-7 text-burgundy-light" />
            </div>
            <div className="min-w-0 flex-1">
              <div className="flex items-center gap-2">
                <h1 className="text-lg font-bold text-foreground sm:text-xl">{data.name as string}</h1>
                {data.isVerified && <Shield className="h-4 w-4 text-emerald-500" />}
              </div>
              {data.category && <span className="mt-1 inline-block rounded-full bg-burgundy-light/8 px-2.5 py-0.5 text-[0.65rem] font-medium text-burgundy-light">{data.category as string}</span>}
            </div>
          </div>
          {data.description && (
            <div className="mt-5">
              <h3 className="mb-2 text-xs font-semibold uppercase tracking-wider text-muted-foreground">Description</h3>
              <p className="text-sm leading-relaxed text-foreground/80 whitespace-pre-wrap">{data.description as string}</p>
            </div>
          )}
          <div className="mt-5 grid grid-cols-2 gap-4">
            {location && <div className="flex items-center gap-2 text-xs text-muted-foreground"><MapPin className="h-4 w-4 text-burgundy-light" />{location}</div>}
            {data.phone && <div className="flex items-center gap-2 text-xs text-muted-foreground"><Users className="h-4 w-4 text-burgundy-light" />{data.phone as string}</div>}
            {data.website && (
              <div className="flex items-center gap-2 text-xs text-muted-foreground">
                <ExternalLink className="h-4 w-4 text-burgundy-light" />
                <a href={data.website as string} target="_blank" rel="noopener noreferrer" className="text-burgundy-light hover:underline truncate">{data.website as string}</a>
              </div>
            )}
            {data.memberCount && (data.memberCount as number) > 0 && <div className="flex items-center gap-2 text-xs text-muted-foreground"><Users className="h-4 w-4 text-burgundy-light" />{data.memberCount as string} members</div>}
          </div>
          <div className="mt-4 flex items-center gap-4 text-[0.65rem] text-muted-foreground">
            <span className="flex items-center gap-1"><Eye className="h-3 w-3" />{String(data.viewsCount)} views</span>
            {ownerName && <span>By {ownerName}</span>}
          </div>
        </div>
      </div>
    </div>
  )
}

function MatrimonyDetail({ data }: { data: Record<string, unknown> }) {
  const profileData = data.profile as Record<string, unknown> | undefined
  const privacy = data.privacy as { canSeePhone: boolean; canSeeEmail: boolean; isOwner: boolean } | undefined
  const userData = profileData?.user as Record<string, unknown> | undefined
  const gotraData = profileData?.gotraMaster as { name: string } | null
  const districtData = data.district as { name: string } | null
  const cityData = data.city as { name: string } | null
  const media = data.media as Array<{ url: string; thumbnailUrl: string | null; id: string }> | undefined
  const profileName = [profileData?.firstName, profileData?.lastName].filter(Boolean).join(' ') || 'Sahu'
  const age = data.dateOfBirth ? computeAge(data.dateOfBirth as string) : null

  return (
    <div className="px-4 py-6 sm:px-6">
      <div className="mx-auto max-w-3xl space-y-5">
        <div className="rounded-2xl border border-border/40 bg-white p-5 sm:p-6">
          {media && media.length > 0 && (
            <div className="mb-5 flex gap-2 overflow-x-auto pb-2">
              {media.map((m) => (
                <img key={m.id} src={m.url || m.thumbnailUrl || ''} alt="" className="h-48 w-36 flex-shrink-0 rounded-xl object-cover" />
              ))}
            </div>
          )}
          <h1 className="text-lg font-bold text-foreground sm:text-xl">{profileName}</h1>
          <div className="mt-4 grid grid-cols-2 gap-y-3 gap-x-6">
            {age && <div className="flex items-center gap-2 text-xs text-muted-foreground"><Calendar className="h-4 w-4 text-burgundy" />{age} years</div>}
            {data.height && <div className="flex items-center gap-2 text-xs text-muted-foreground"><User className="h-4 w-4 text-burgundy" />{data.height as string}</div>}
            {(districtData?.name || cityData?.name) && <div className="flex items-center gap-2 text-xs text-muted-foreground"><MapPin className="h-4 w-4 text-burgundy" />{[districtData?.name, cityData?.name].filter(Boolean).join(', ')}</div>}
            {gotraData?.name && <div className="flex items-center gap-2 text-xs text-muted-foreground"><Star className="h-4 w-4 text-burgundy" />{gotraData.name}</div>}
            {data.occupation && <div className="flex items-center gap-2 text-xs text-muted-foreground"><Briefcase className="h-4 w-4 text-burgundy" />{data.occupation as string}</div>}
            {data.education && <div className="flex items-center gap-2 text-xs text-muted-foreground"><GraduationCap className="h-4 w-4 text-burgundy" />{data.education as string}</div>}
            {data.maritalStatus && <div className="flex items-center gap-2 text-xs text-muted-foreground"><Heart className="h-4 w-4 text-burgundy" />{String(data.maritalStatus).replace(/_/g, ' ')}</div>}
            {data.annualIncome && <div className="flex items-center gap-2 text-xs text-muted-foreground"><IndianRupee className="h-4 w-4 text-burgundy" />{data.annualIncome as string}</div>}
          </div>
          {data.aboutMe && (
            <div className="mt-5">
              <h3 className="mb-2 text-xs font-semibold uppercase tracking-wider text-muted-foreground">About</h3>
              <p className="text-sm leading-relaxed text-foreground/80 whitespace-pre-wrap">{data.aboutMe as string}</p>
            </div>
          )}
          {data.familyDescription && (
            <div className="mt-4">
              <h3 className="mb-2 text-xs font-semibold uppercase tracking-wider text-muted-foreground">Family</h3>
              <p className="text-sm leading-relaxed text-foreground/80 whitespace-pre-wrap">{data.familyDescription as string}</p>
            </div>
          )}
          {userData && (privacy?.canSeePhone || privacy?.canSeeEmail) && (
            <div className="mt-5 border-t border-border/30 pt-4">
              <h3 className="mb-2 text-xs font-semibold uppercase tracking-wider text-muted-foreground">Contact</h3>
              <div className="space-y-1">
                {privacy?.canSeePhone && (userData.phone as string) && <p className="text-sm text-foreground">{userData.phone as string}</p>}
                {privacy?.canSeeEmail && (userData.email as string) && <p className="text-sm text-burgundy">{userData.email as string}</p>}
              </div>
            </div>
          )}
        </div>
      </div>
    </div>
  )
}
