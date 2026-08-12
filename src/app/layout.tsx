import type { Metadata } from 'next'
import { Geist, Playfair_Display } from 'next/font/google'
import './globals.css'

const geistSans = Geist({
  variable: '--font-geist-sans',
  subsets: ['latin'],
  display: 'swap',
})

const playfair = Playfair_Display({
  variable: '--font-playfair',
  subsets: ['latin'],
  display: 'swap',
})

export const metadata: Metadata = {
  title: {
    default: 'Bandhan – Sahu Samaj Connects | Connecting Hearts, Strengthening Community',
    template: '%s | Bandhan – Sahu Samaj',
  },
  description:
    'Bandhan is the premium digital ecosystem exclusively for Sahu Samaj. Discover matrimony, business directory, jobs, organizations, and AI services — all in one place.',
  keywords: [
    'Bandhan',
    'Sahu Samaj',
    'Matrimony',
    'Business Directory',
    'Jobs',
    'Community',
    'Sahu',
    'Samaj Connects',
    'Vivah',
    'Rishta',
    'Marriage',
  ],
  icons: {
    icon: '/logo-en.jpg',
  },
  openGraph: {
    title: 'Bandhan – Sahu Samaj Connects',
    description: 'Connecting Hearts, Strengthening Community',
    type: 'website',
    siteName: 'Bandhan',
    locale: 'en_IN',
    alternateLocale: 'hi_IN',
  },
  twitter: {
    card: 'summary_large_image',
    title: 'Bandhan – Sahu Samaj Connects',
    description: 'Connecting Hearts, Strengthening Community',
  },
  robots: {
    index: true,
    follow: true,
    // Private matrimony profiles are never exposed in static HTML,
    // so search engine crawling of public pages is safe.
    // Admin routes are API-only (no HTML pages to index).
  },
}

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode
}>) {
  return (
    <html lang="en" suppressHydrationWarning>
      <head>
        <meta name="theme-color" content="#8B1A1A" />
        <link rel="canonical" href="https://bandhan.sahusamaj.com" />
      </head>
      <body
        className={`${geistSans.variable} ${playfair.variable} font-sans antialiased bg-ivory text-foreground`}
      >
        {children}
      </body>
    </html>
  )
}