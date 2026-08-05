'use client'

import { Header } from '@/components/layout/Header'
import { Footer } from '@/components/layout/Footer'
import { HeroSection } from '@/components/home/HeroSection'
import { StatsSection } from '@/components/home/StatsSection'
import { AdCarousel } from '@/components/shared/AdCarousel'

export default function Home() {
  return (
    <div className="flex min-h-screen flex-col">
      <Header />

      <main className="flex-1">
        {/* Top Advertisement Carousel */}
        <div className="mx-auto max-w-7xl px-4 pt-6 sm:px-6 lg:px-8">
          <AdCarousel />
        </div>

        {/* Hero + Service Cards */}
        <HeroSection />

        {/* Stats Section */}
        <StatsSection />

        {/* Bottom Advertisement Carousel */}
        <div className="mx-auto max-w-7xl px-4 pb-8 sm:px-6 lg:px-8">
          <AdCarousel />
        </div>
      </main>

      <Footer />
    </div>
  )
}