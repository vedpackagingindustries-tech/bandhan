'use client'

import Image from 'next/image'
import { useLanguageStore, type Locale } from '@/stores/language-store'
import { useTranslations } from '@/i18n'

export function BandhanLogo({ className = '' }: { className?: string }) {
  const locale = useLanguageStore((s) => s.locale)
  const { t } = useTranslations()

  return (
    <div className={`relative flex items-center ${className}`}>
      <Image
        src={locale === 'hi' ? '/logo-hi.jpg' : '/logo-en.jpg'}
        alt={locale === 'hi' ? 'बंधन - साहू समाज कनेक्ट्स' : 'Bandhan - Sahu Samaj Connects'}
        width={220}
        height={56}
        priority
        className={`h-auto object-contain transition-opacity duration-300 ${
          locale === 'hi' ? 'w-44 md:w-56' : 'w-48 md:w-60'
        }`}
      />
    </div>
  )
}
