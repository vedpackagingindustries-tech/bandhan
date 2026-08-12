import { translations, type Locale, type TranslationKey } from './translations'
import { useLanguageStore } from '@/stores/language-store'
import { useMemo } from 'react'

export type { Locale, TranslationKey }

/**
 * Deep-merge fallback: for every key missing in the active locale,
 * fall back to the English translation. This prevents runtime crashes
 * when a locale object is incomplete (e.g. `hi` missing `topBar`, `nav`, …).
 */
function mergeWithFallback(
  target: Record<string, unknown>,
  fallback: Record<string, unknown>,
): Record<string, unknown> {
  const result = { ...fallback }
  for (const key of Object.keys(target)) {
    const tVal = target[key]
    const fVal = fallback[key]
    if (
      tVal &&
      typeof tVal === 'object' &&
      !Array.isArray(tVal) &&
      fVal &&
      typeof fVal === 'object' &&
      !Array.isArray(fVal)
    ) {
      result[key] = mergeWithFallback(
        tVal as Record<string, unknown>,
        fVal as Record<string, unknown>,
      )
    } else if (tVal !== undefined && tVal !== null) {
      result[key] = tVal
    }
  }
  return result
}

export function useTranslations() {
  const locale = useLanguageStore((s) => s.locale)
  const t = useMemo(
    () =>
      locale === 'en'
        ? translations.en
        : (mergeWithFallback(
            translations[locale] as unknown as Record<string, unknown>,
            translations.en as unknown as Record<string, unknown>,
          ) as unknown as TranslationKey),
    [locale],
  )
  return { t, locale }
}

export function getTranslation(locale: Locale) {
  return locale === 'en'
    ? translations.en
    : (mergeWithFallback(
        translations[locale] as unknown as Record<string, unknown>,
        translations.en as unknown as Record<string, unknown>,
      ) as unknown as TranslationKey)
}
