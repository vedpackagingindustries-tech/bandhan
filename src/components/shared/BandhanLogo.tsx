'use client'

import Image from 'next/image'
import { useLanguageStore } from '@/stores/language-store'
import { cn } from '@/lib/utils'

export function BandhanLogo({ className = '' }: { className?: string }) {
  const locale = useLanguageStore((s) => s.locale)

  return (
    <div
      className={cn(
        'relative shrink-0',
        locale === 'hi' ? 'h-14 w-36 md:h-[4.25rem] md:w-44 lg:h-16 lg:w-52' : 'h-12 w-32 md:h-14 md:w-40 lg:h-[3.5rem] lg:w-48',
        className
      )}
    >
      <Image
        src={locale === 'hi' ? '/logo-hi.jpg' : '/logo-en.jpg'}
        alt={
          locale === 'hi'
            ? 'बंधन - साहू समाज कनेक्ट्स - रिश्तों को जोड़ें, समाज को सशक्त बनाएं'
            : 'Bandhan - SAHU SAMAJ CONNECTS - Connecting Hearts, Strengthening Community'
        }
        fill
        sizes="(max-width: 768px) 144px, (max-width: 1024px) 176px, 192px"
        priority
        className="object-contain"
      />
    </div>
  )
}