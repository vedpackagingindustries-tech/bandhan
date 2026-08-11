'use client'

import { useState, useEffect, useCallback } from 'react'
import dynamic from 'next/dynamic'
import { TopInfoBar } from '@/components/layout/TopInfoBar'
import { Header } from '@/components/layout/Header'
import { Footer } from '@/components/layout/Footer'
import { HeroAdvertisement } from '@/components/home/HeroAdvertisement'
import { LiveCommunityActivity } from '@/components/home/LiveCommunityActivity'
import { ModuleGrid } from '@/components/home/ModuleGrid'
import { PremiumAdBanner } from '@/components/home/PremiumAdBanner'
import { FeaturedCommunityContent } from '@/components/home/FeaturedCommunityContent'
import { FooterAdvertisement } from '@/components/home/FooterAdvertisement'
import { ModulePageView, type ModuleKey } from '@/components/modules/ModulePageView'

// Dynamic import for BrandIntro to avoid blocking initial render
const BrandIntro = dynamic(
  () => import('@/components/home/BrandIntro').then((m) => ({ default: m.BrandIntro })),
  { ssr: false }
)

const validModules: ModuleKey[] = ['matrimony', 'business', 'jobs', 'directory']

export default function Home() {
  const [activeModule, setActiveModule] = useState<ModuleKey | null>(() => {
    if (typeof window === 'undefined') return null
    const hash = window.location.hash.replace('#', '')
    return validModules.includes(hash as ModuleKey) ? (hash as ModuleKey) : null
  })

  // Hash-based routing - subscribe to changes only
  useEffect(() => {
    const onHashChange = () => {
      const hash = window.location.hash.replace('#', '')
      setActiveModule(validModules.includes(hash as ModuleKey) ? (hash as ModuleKey) : null)
    }
    window.addEventListener('hashchange', onHashChange)
    return () => window.removeEventListener('hashchange', onHashChange)
  }, [])

  const goHome = useCallback(() => {
    window.location.hash = ''
    setActiveModule(null)
    window.scrollTo({ top: 0, behavior: 'smooth' })
  }, [])

  // Module page view
  if (activeModule) {
    return <ModulePageView module={activeModule} onBack={goHome} />
  }

  // Homepage
  return (
    <div className="flex min-h-screen flex-col">
      {/* First-Visit Brand Intro Overlay */}
      <BrandIntro />

      {/* Top Information Bar */}
      <TopInfoBar />

      {/* Premium Header with Flag */}
      <Header />

      <main className="flex-1">
        {/* 1. Large Spacious Hero Advertisement */}
        <HeroAdvertisement />

        {/* 2. Live Community Activity */}
        <LiveCommunityActivity />

        {/* 3. 2x2 Main Module Grid */}
        <ModuleGrid />

        {/* 4. Premium Middle Advertisement */}
        <div className="mx-auto max-w-7xl px-4 pt-3 sm:px-6 sm:pt-4">
          <PremiumAdBanner slideIndex={1} />
        </div>

        {/* 5. Featured Community Content (Mata Karma + Flag) */}
        <FeaturedCommunityContent />

        {/* 6. Large Spacious Footer Advertisement */}
        <FooterAdvertisement />
      </main>

      {/* White/Ivory Premium Footer */}
      <Footer />
    </div>
  )
}