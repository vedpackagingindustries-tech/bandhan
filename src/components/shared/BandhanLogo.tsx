'use client'

import Image from 'next/image'
import { useLanguageStore } from '@/stores/language-store'
import { cn } from '@/lib/utils'

export function BandhanLogo({ className = '' }: { className?: string }) {
  const locale = useLanguageStore((s) => s.locale)

  if (locale === 'hi') {
    return (
      <div
        className={cn(
          'relative shrink-0 overflow-hidden rounded-xl',
          'h-12 w-[6.5rem] shadow-sm md:h-14 md:w-[8rem] lg:h-[3.6rem] lg:w-[9.5rem]',
          className
        )}
      >
        <Image
          src='/hindi-official.jpg'
          alt='बंधन - साहू समाज कनेक्ट्स - रिश्तों को जोड़ें, समाज को सशक्त बनाएं'
          fill
          sizes='(max-width: 768px) 104px, (max-width: 1024px) 128px, 152px'
          priority
          className='object-cover'
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
      <Image
        src='/logo-en.jpg'
        alt='Bandhan - SAHU SAMAJ CONNECTS - Connecting Hearts, Strengthening Community'
        fill
        sizes='(max-width: 768px) 128px, (max-width: 1024px) 160px, 192px'
        priority
        className='object-contain'
      />
    </div>
  )
}
