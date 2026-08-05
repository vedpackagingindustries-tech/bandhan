'use client'

import { TopInfoBar } from '@/components/layout/TopInfoBar'
import { Header } from '@/components/layout/Header'
import { Footer } from '@/components/layout/Footer'
import { PremiumHeroCarousel } from '@/components/home/PremiumHeroCarousel'
import { PremiumServiceCards } from '@/components/home/PremiumServiceCards'
import { PremiumAdBanner } from '@/components/home/PremiumAdBanner'
import { FeaturedProfiles } from '@/components/home/FeaturedProfiles'
import { SuccessStories } from '@/components/home/SuccessStories'
import { PremiumStats } from '@/components/home/PremiumStats'

export default function Home() {
  return (
    <div className="flex min-h-screen flex-col">
      {/* Top Information Bar */}
      <TopInfoBar />

      {/* Main Header */}
      <Header />

      <main className="flex-1">
        {/* Hero Image Carousel */}
        <PremiumHeroCarousel />

        {/* Premium Service Cards */}
        <PremiumServiceCards />

        {/* Middle Advertisement */}
        <div className="mx-auto max-w-7xl px-4 sm:px-6 lg:px-8">
          <PremiumAdBanner slideIndex={1} />
        </div>

        {/* Featured Profiles Section */}
        <FeaturedProfiles />

        {/* Success Stories */}
        <SuccessStories />

        {/* Community Stats */}
        <PremiumStats />

        {/* Bottom Advertisement */}
        <div className="mx-auto max-w-7xl px-4 pb-6 sm:px-6 lg:px-8">
          <PremiumAdBanner slideIndex={2} />
        </div>
      </main>

      {/* Footer */}
      <Footer />
    </div>
  )
}