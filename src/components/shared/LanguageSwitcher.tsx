'use client'

import { useLanguageStore, type Locale } from '@/stores/language-store'
import { useTranslations } from '@/i18n'
import { Globe } from 'lucide-react'

export function LanguageSwitcher() {
  const { locale, setLocale } = useLanguageStore()
  const { t } = useTranslations()

  const toggleLocale = () => {
    setLocale(locale === 'en' ? 'hi' : 'en')
  }

  return (
    <button
      onClick={toggleLocale}
      className="group flex items-center gap-1.5 rounded-full border border-border/60 bg-white/80 px-3.5 py-1.5 text-sm font-medium text-foreground backdrop-blur-sm transition-all duration-200 hover:border-gold hover:shadow-[0_2px_8px_rgba(200,169,81,0.15)] active:scale-[0.97]"
      aria-label={locale === 'en' ? t.language.hindi : t.language.english}
    >
      <Globe className="h-3.5 w-3.5 text-gold transition-transform duration-200 group-hover:rotate-12" />
      <span className="transition-colors duration-200 group-hover:text-gold-dark">
        {locale === 'en' ? t.language.hindi : t.language.english}
      </span>
    </button>
  )
}
