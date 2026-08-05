import { translations, type Locale, type TranslationKey } from './translations'
import { useLanguageStore } from '@/stores/language-store'

export type { Locale, TranslationKey }

export function useTranslations() {
  const locale = useLanguageStore((s) => s.locale)
  const t = translations[locale]
  return { t, locale }
}

export function getTranslation(locale: Locale) {
  return translations[locale]
}
