'use client'

import { Heart, Building2, MapPin, ShieldCheck } from 'lucide-react'
import { BandhanLogo } from '@/components/shared/BandhanLogo'
import { useTranslations } from '@/i18n'

export function Footer() {
  const { t } = useTranslations()

  return (
    <footer className="relative mt-0 border-t border-border/30 bg-white">
      {/* Gold accent line */}
      <div className="absolute left-0 right-0 top-0 h-px bg-gradient-to-r from-transparent via-gold/30 to-transparent" />

      <div className="mx-auto max-w-7xl px-4 py-14 sm:px-6 lg:px-8 lg:py-20">
        {/* Main Footer Content */}
        <div className="grid grid-cols-1 gap-10 sm:grid-cols-2 lg:grid-cols-3 lg:gap-16">
          {/* Brand Column */}
          <div className="sm:col-span-2 lg:col-span-1">
            <BandhanLogo className="mb-5" />
            <p className="mt-2 max-w-sm text-sm leading-relaxed text-muted-foreground">
              {t.footer.aboutText}
            </p>
          </div>

          {/* Quick Links */}
          <div>
            <h4 className="mb-4 text-xs font-semibold uppercase tracking-[0.15em] text-foreground">
              {t.footer.quickLinks}
            </h4>
            <ul className="space-y-2.5">
              {['matrimony', 'business', 'jobs', 'directory'].map((key) => (
                <li key={key}>
                  <a
                    href={`#${key}`}
                    className="text-sm text-muted-foreground transition-colors duration-200 hover:text-burgundy"
                  >
                    {t.nav[key as keyof typeof t.nav]}
                  </a>
                </li>
              ))}
            </ul>
          </div>

          {/* Contact Info - ONLY org & address, no fake phone/email */}
          <div>
            <h4 className="mb-4 text-xs font-semibold uppercase tracking-[0.15em] text-foreground">
              {t.footer.contactUs}
            </h4>
            <ul className="space-y-3">
              <li className="flex items-start gap-2.5">
                <Building2 className="mt-0.5 h-4 w-4 flex-shrink-0 text-gold" />
                <span className="text-sm font-medium leading-relaxed text-foreground">
                  {t.footer.organization}
                </span>
              </li>
              <li className="flex items-start gap-2.5">
                <MapPin className="mt-0.5 h-4 w-4 flex-shrink-0 text-gold" />
                <span className="text-sm leading-relaxed text-muted-foreground">
                  {t.footer.address}
                </span>
              </li>
            </ul>
          </div>
        </div>

        {/* Bottom Bar */}
        <div className="mt-12 flex flex-col items-center justify-between gap-3 border-t border-border/30 pt-6 sm:flex-row">
          <p className="flex items-center gap-1.5 text-xs text-muted-foreground">
            {t.footer.madeWith}
            <Heart className="inline h-3 w-3 text-burgundy" fill="currentColor" />
          </p>
          <p className="text-xs text-muted-foreground">
            &copy; {new Date().getFullYear()} Bandhan. {t.footer.allRightsReserved}.
          </p>
          <a
            href="#admin"
            className="flex items-center gap-1.5 text-xs font-medium text-muted-foreground/50 transition-colors duration-200 hover:text-burgundy"
          >
            <ShieldCheck className="h-3.5 w-3.5" />
            {t.footer.superAdminLogin}
          </a>
        </div>
      </div>
    </footer>
  )
}