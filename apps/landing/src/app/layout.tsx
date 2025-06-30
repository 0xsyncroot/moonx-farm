import type { Metadata } from 'next'
import { Inter } from 'next/font/google'
import './globals.css'

const inter = Inter({ subsets: ['latin'] })

export const metadata: Metadata = {
  metadataBase: new URL(process.env.NEXT_PUBLIC_SITE_URL || 'https://moonx.farm'),
  title: 'MoonX Farm - The Future of DeFi Trading',
  description: 'Trade gasless with smart wallets. The first multi-aggregator DEX with Account Abstraction, social login, and MEV protection.',
  keywords: ['DeFi', 'DEX', 'Trading', 'Gasless', 'Account Abstraction', 'Smart Wallets', 'Social Login'],
  authors: [{ name: 'MoonX Farm Team' }],
  creator: 'MoonX Farm',
  publisher: 'MoonX Farm',
  icons: {
    icon: [
      { url: '/favicon.ico', sizes: '32x32', type: 'image/x-icon' },
    ],
    apple: [
      { url: '/logo.png', sizes: '180x180', type: 'image/png' },
    ],
  },
  openGraph: {
    type: 'website',
    locale: 'en_US',
    url: '/',
    title: 'MoonX Farm - The Future of DeFi Trading',
    description: 'Trade gasless with smart wallets. Get the best prices across all DEXs with zero gas fees.',
    siteName: 'MoonX Farm',
    images: [
      {
        url: '/logo.png',
        width: 1200,
        height: 630,
        alt: 'MoonX Farm - DeFi Trading Platform',
      },
    ],
  },
  twitter: {
    card: 'summary_large_image',
    title: 'MoonX Farm - The Future of DeFi Trading',
    description: 'Trade gasless with smart wallets. Get the best prices across all DEXs with zero gas fees.',
    images: ['/logo.png'],
    creator: '@moonxfarm',
  },
  robots: {
    index: true,
    follow: true,
    googleBot: {
      index: true,
      follow: true,
      'max-video-preview': -1,
      'max-image-preview': 'large',
      'max-snippet': -1,
    },
  },
  verification: {
    google: 'your-google-verification-code',
  },
}

export default function RootLayout({
  children,
}: {
  children: React.ReactNode
}) {
  return (
    <html lang="en" className="dark">
      <head>
        <link rel="icon" href="/favicon.ico" sizes="32x32" />
        <link rel="apple-touch-icon" href="/logo.png" />
        <meta name="theme-color" content="#ff7842" />
      </head>
      <body className={inter.className}>
        {children}
      </body>
    </html>
  )
} 