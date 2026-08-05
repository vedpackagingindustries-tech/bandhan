'use client'

import { Heart, Mail, Phone, MapPin, ShieldCheck } from 'lucide-react'
import { BandhanLogo } from '@/components/shared/BandhanLogo'
import { useTranslations } from '@/i18n'

export function Footer() {
  const { t } = useTranslations()

  return (
    <footer className="relative mt-8 border-t border-border/50 bg-white">
      {/* Gold accent line at top */}
      <div className="absolute left-0 right-0 top-0 h-px bg-gradient-to-r from-transparent via-gold/40 to-transparent" />

      <div className="mx-auto max-w-7xl px-4 py-12 sm:px-6 lg:px-8 lg:py-16">
        <div className="grid grid-cols-1 gap-10 sm:grid-cols-2 lg:grid-cols-4 lg:gap-8">
          {/* Brand Column */}
          <div className="sm:col-span-2 lg:col-span-1">
            <BandhanLogo className="mb-4" />
            <p className="mt-3 max-w-xs text-sm leading-relaxed text-muted-foreground">
              {t.footer.aboutText}
            </p>
            {/* Social Icons Placeholder */}
            <div className="mt-5 flex items-center gap-3">
              {['facebook', 'twitter', 'instagram', 'youtube'].map((social) => (
                <a
                  key={social}
                  href="#"
                  className="flex h-8 w-8 items-center justify-center rounded-full bg-cream text-muted-foreground transition-all duration-200 hover:bg-burgundy hover:text-white"
                  aria-label={social}
                >
                  <span className="text-xs font-bold uppercase">{social[0]}</span>
                </a>
              ))}
            </div>
          </div>

          {/* Quick Links */}
          <div>
            <h4 className="mb-4 text-sm font-semibold uppercase tracking-wider text-foreground">
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

          {/* Legal */}
          <div>
            <h4 className="mb-4 text-sm font-semibold uppercase tracking-wider text-foreground">
              {t.footer.legal}
            </h4>
            <ul className="space-y-2.5">
              <li>
                <a href="#" className="text-sm text-muted-foreground transition-colors duration-200 hover:text-burgundy">
                  {t.footer.privacyPolicy}
                </a>
              </li>
              <li>
                <a href="#" className="text-sm text-muted-foreground transition-colors duration-200 hover:text-burgundy">
                  {t.footer.termsOfService}
                </a>
              </li>
              <li>
                <a href="#" className="text-sm text-muted-foreground transition-colors duration-200 hover:text-burgundy">
                  {t.footer.refundPolicy}
                </a>
              </li>
            </ul>
          </div>

          {/* Contact Info */}
          <div>
            <h4 className="mb-4 text-sm font-semibold uppercase tracking-wider text-foreground">
              {t.footer.contactUs}
            </h4>
            <ul className="space-y-3">
              <li className="flex items-start gap-2.5">
                <MapPin className="mt-0.5 h-4 w-4 flex-shrink-0 text-gold" />
                <span className="text-sm leading-relaxed text-muted-foreground">
                  {t.footer.address}
                </span>
              </li>
              <li className="flex items-center gap-2.5">
                <Mail className="h-4 w-4 flex-shrink-0 text-gold" />
                <a href={`mailto:${t.footer.email}`} className="text-sm text-muted-foreground transition-colors hover:text-burgundy">
                  {t.footer.email}
                </a>
              </li>
              <li className="flex items-center gap-2.5">
                <Phone className="h-4 w-4 flex-shrink-0 text-gold" />
                <a href={`tel:${t.footer.phone.replace(/\s/g, '')}`} className="text-sm text-muted-foreground transition-colors hover:text-burgundy">
                  {t.footer.phone}
                </a>
              </li>
            </ul>
          </div>
        </div>

        {/* Bottom Bar */}
        <div className="mt-10 flex flex-col items-center justify-between gap-4 border-t border-border/40 pt-6 sm:flex-row">
          <p className="flex items-center gap-1 text-xs text-muted-foreground">
            {t.footer.madeWith}
            <Heart className="inline h-3 w-3 text-burgundy" fill="currentColor" />
          </p>
          <p className="text-xs text-muted-foreground">
            &copy; {new Date().getFullYear()} Bandhan. {t.footer.allRightsReserved}.
          </p>
          {/* Super Admin Login */}
          <a
            href="#admin"
            className="flex items-center gap-1.5 text-xs font-medium text-muted-foreground/60 transition-colors duration-200 hover:text-burgundy"
          >
            <ShieldCheck className="h-3.5 w-3.5" />
            {t.footer.superAdminLogin}
          </a>
        </div>
      </div>
    </footer>
  )
}