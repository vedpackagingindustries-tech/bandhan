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
  title: 'Bandhan – Sahu Samaj Connects | Connecting Hearts, Strengthening Community',
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
  ],
  icons: {
    icon: '/logo-en.jpg',
  },
  openGraph: {
    title: 'Bandhan – Sahu Samaj Connects',
    description: 'Connecting Hearts, Strengthening Community',
    type: 'website',
  },
}

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode
}>) {
  return (
    <html lang="en" suppressHydrationWarning>
      <body
        className={`${geistSans.variable} ${playfair.variable} font-sans antialiased bg-ivory text-foreground`}
      >
        {children}
      </body>
    </html>
  )
}