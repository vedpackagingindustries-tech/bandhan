'use client'

import { MapPin, Globe } from 'lucide-react'
import { LanguageSwitcher } from '@/components/shared/LanguageSwitcher'
import { useTranslations } from '@/i18n'

export function TopInfoBar() {
  const { t } = useTranslations()

  return (
    <div className="relative z-50 border-b border-border/40 bg-white/60 backdrop-blur-md">
      <div className="mx-auto flex h-8 max-w-7xl items-center justify-between px-4 sm:px-6 lg:px-8">
        {/* Left - Org Info */}
        <div className="hidden items-center gap-4 sm:flex">
          <div className="flex items-center gap-1.5 text-[0.65rem] font-medium text-foreground/70">
            <MapPin className="h-2.5 w-2.5 text-gold" />
            <span>{t.topBar.organization}</span>
          </div>
          <span className="text-border">|</span>
          <div className="flex items-center gap-1.5 text-[0.6rem] text-muted-foreground">
            <span>{t.topBar.address}</span>
          </div>
        </div>

        {/* Mobile - Org only */}
        <div className="flex items-center gap-1.5 text-[0.6rem] font-medium text-foreground/70 sm:hidden">
          <MapPin className="h-2.5 w-2.5 text-gold" />
          <span>{t.topBar.organization}</span>
        </div>

        {/* Right - Language only */}
        <div className="flex items-center">
          <LanguageSwitcher />
        </div>
      </div>
    </div>
  )
}
