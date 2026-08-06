'use client'

import { useLanguageStore } from '@/stores/language-store'
import { cn } from '@/lib/utils'

export function BandhanLogo({ className = '' }: { className?: string }) {
  const locale = useLanguageStore((s) => s.locale)

  if (locale === 'hi') {
    return (
      <div
        className={cn(
          'relative shrink-0',
          'h-12 w-[6.5rem] md:h-14 md:w-[8rem] lg:h-[3.6rem] lg:w-[9.5rem]',
          className
        )}
      >
        <img
          src='/logo-hi.jpg'
          alt='बंधन - साहू समाज कनेक्ट्स'
          className='absolute inset-0 h-full w-full object-contain'
        />
      </div>
    )
  }

  return (
    <div
      className={cn(
        'relative shrink-0',
        'h-12 w-32 md:h-14 md:w-40 lg:h-[3.5rem] lg:w-48',
        className
      )}
    >
      <img
        src='/logo-en.jpg'
        alt='Bandhan - SAHU SAMAJ CONNECTS'
        className='absolute inset-0 h-full w-full object-contain'
      />
    </div>
  )
}
